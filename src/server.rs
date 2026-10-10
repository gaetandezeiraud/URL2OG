use std::fs;
use std::io::{self, Read};
use std::path::Path;
use std::thread;

use tiny_http::{Header, Method, Response, ResponseBox, Server};
use url::Url;

use crate::{cache, chromium, pagecache};

pub fn run(port: &str, allowed: &'static [String]) {
    fs::create_dir_all(cache::dir()).expect("cannot create cache directory");
    let server = Server::http(format!("0.0.0.0:{port}")).expect("cannot bind port");
    println!("Server running on port {port}");

    for req in server.incoming_requests() {
        thread::spawn(move || {
            let res = route(req.method(), req.url(), allowed);
            let _ = req.respond(res);
        });
    }
}

fn route(method: &Method, raw: &str, allowed: &[String]) -> ResponseBox {
    let (path, query) = raw.split_once('?').unwrap_or((raw, ""));
    match (method, path) {
        (Method::Get, "/health") => json(200, r#"{"status":"OK"}"#),
        (Method::Get, "/") => {
            let url = url::form_urlencoded::parse(query.as_bytes())
                .find(|(k, _)| k == "url")
                .and_then(|(_, v)| normalize(&v));
            match url {
                None => json(400, r#"{"error":"Invalid or missing URL"}"#),
                Some(url) if !domain_allowed(&url, allowed) => {
                    json(403, r#"{"error":"Domain not allowed"}"#)
                }
                Some(url) => screenshot(&url),
            }
        }
        _ => json(404, r#"{"error":"Not found"}"#),
    }
}

// Serve the cached image, capturing it first on a miss
fn screenshot(url: &Url) -> ResponseBox {
    let path = cache::file(url);
    match ensure_cached(url, &path).and_then(|status| Ok((status, pagecache::read(&path)?))) {
        Ok((status, bytes)) => image(bytes, status),
        Err(e) => {
            eprintln!("Screenshot generation failed for {url}: {e}");
            json(500, r#"{"error":"Failed to generate screenshot"}"#)
        }
    }
}

fn ensure_cached(url: &Url, path: &Path) -> io::Result<&'static str> {
    if cache::is_fresh(path) {
        return Ok("HIT");
    }
    let _slot = chromium::Slot::acquire();
    // Another request may have captured it while this one waited for a slot
    if cache::is_fresh(path) {
        return Ok("HIT");
    }
    chromium::screenshot(url, path)?;
    cache::remove_expired();
    Ok("MISS")
}

// Accepts URLs without scheme (defaults to https), rejects anything without a host
pub fn normalize(raw: &str) -> Option<Url> {
    let lower = raw.to_ascii_lowercase();
    let full = if lower.starts_with("http://") || lower.starts_with("https://") {
        raw.to_string()
    } else {
        format!("https://{raw}")
    };
    Url::parse(&full)
        .ok()
        .filter(|u| u.host_str().is_some_and(|h| !h.is_empty()))
}

// Exact domain or any of its subdomains
fn domain_allowed(url: &Url, allowed: &[String]) -> bool {
    let host = url.host_str().unwrap_or_default();
    allowed.iter().any(|d| {
        host.strip_suffix(d.as_str())
            .is_some_and(|rest| rest.is_empty() || rest.ends_with('.'))
    })
}

fn header(k: &str, v: &str) -> Header {
    Header::from_bytes(k.as_bytes(), v.as_bytes()).unwrap()
}

fn respond<R: Read + Send + 'static>(res: Response<R>, content_type: &str) -> ResponseBox {
    res.with_header(header("Access-Control-Allow-Origin", "*"))
        .with_header(header("Access-Control-Allow-Methods", "GET"))
        .with_header(header("Content-Type", content_type))
        .boxed()
}

fn json(status: u16, body: &str) -> ResponseBox {
    respond(
        Response::from_string(body).with_status_code(status),
        "application/json",
    )
}

fn image(bytes: Vec<u8>, cache_status: &str) -> ResponseBox {
    let res = Response::from_data(bytes)
        .with_header(header("Cache-Control", "public, max-age=86400"))
        .with_header(header("X-Cache", cache_status));
    respond(res, "image/png")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status(raw: &str) -> u16 {
        route(&Method::Get, raw, &["example.com".into()])
            .status_code()
            .0
    }

    fn allowed(raw: &str) -> bool {
        domain_allowed(&normalize(raw).unwrap(), &["example.com".into()])
    }

    #[test]
    fn normalize_urls() {
        assert_eq!(
            normalize("example.com").unwrap().as_str(),
            "https://example.com/"
        );
        assert_eq!(normalize("HTTP://example.com").unwrap().scheme(), "http");
        assert!(normalize("http://").is_none());
        assert!(normalize("").is_none());
    }

    #[test]
    fn domains() {
        assert!(allowed("example.com"));
        assert!(allowed("https://www.example.com"));
        assert!(!allowed("https://evilexample.com"));
        assert!(!allowed("https://example.com.evil.com"));
    }

    #[test]
    fn same_page_same_cache_file() {
        let a = cache::file(&normalize("example.com").unwrap());
        assert_eq!(a, cache::file(&normalize("https://example.com/").unwrap()));
    }

    #[test]
    fn routes() {
        assert_eq!(status("/health"), 200);
        assert_eq!(status("/nope"), 404);
        assert_eq!(status("/"), 400);
        assert_eq!(status("/?url=http%3A%2F%2F"), 400);
        assert_eq!(status("/?url=https://evil.com"), 403);
        assert_eq!(route(&Method::Post, "/", &[]).status_code().0, 404);
    }
}

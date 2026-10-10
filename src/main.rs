mod cache;
mod chromium;
mod pagecache;
mod server;

use std::env;
use std::process::exit;

fn main() {
    let mut args = env::args().skip(1);
    if args.next().as_deref() == Some("clean") {
        let Some(url) = args.next().as_deref().and_then(server::normalize) else {
            eprintln!("Usage: url2og clean <WEBSITE_URL>");
            exit(1);
        };
        exit(cache::clean(&url));
    }

    let allowed: Vec<String> = env::var("ALLOWED_DOMAINS")
        .unwrap_or_default()
        .split(',')
        .map(|d| d.trim().to_lowercase())
        .filter(|d| !d.is_empty())
        .collect();
    if allowed.is_empty() {
        eprintln!("No allowed domains configured in ALLOWED_DOMAINS");
        exit(1);
    }

    let port = env::var("PORT").unwrap_or_else(|_| "3000".into());
    server::run(&port, allowed.leak());
}

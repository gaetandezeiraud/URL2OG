# URL2OG Service

A simple service to generate Open Graph images or screenshots from URLs, with disk-based caching and domain allowlist.
Published Docker images target linux/amd64 only.

The server idles at a few MiB: Chromium is only started (`chromium --headless --screenshot`) on a cache miss.

## Domains

```
ALLOWED_DOMAINS=example.com,google.com
```

## Usage

```
GET http://localhost:3000/?url=https://nomads.com
```

## Caching

Screenshots are captured again after 30 days. To drop one sooner:

```
url2og clean <WEBSITE_URL>
```

## Development

Requires [Rust](https://rustup.rs) and Chromium.

```
ALLOWED_DOMAINS=example.com cargo run
```

Set `CHROMIUM_PATH` to use a browser other than `/usr/lib/chromium/chromium`, `CACHE_DIR` to change the cache location (default `./cache`), `PORT` to change the port (default `3000`), `MAX_CAPTURES` to allow more simultaneous Chromium captures (default `1`, each needs ~250Mi).

## Tests

```
cargo test
```

# URL2OG Service

A simple service to generate Open Graph images or screenshots from URLs, with disk-based caching and domain allowlist.
Published Docker images target linux/amd64 only.

## Domains

```
ALLOWED_DOMAINS=example.com,google.com
```

## Usage

```
GET http://localhost:3000/?url=https://nomads.com
```

## Caching

```
bun run clean <WEBSITE_URL>
```

## Development

Requires [Bun](https://bun.sh). Bun loads `.env` automatically.

```
bun install
bun run dev
```

Set `CHROMIUM_PATH` to use a browser other than `/usr/bin/chromium`.

## Tests

```
bun test
```

Coverage is enforced at 90% minimum (lines and functions) via `bunfig.toml`. Puppeteer is mocked, so no browser is needed.

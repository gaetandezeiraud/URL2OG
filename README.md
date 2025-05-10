# URL2OG Service

A simple service to generate Open Graph images or screenshots from URLs, with disk-based caching and domain allowlist.
Built to support ARM64 architecture, with workarounds implemented to ensure Puppeteer compatibility.

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
npm run clean <WEBSITE_URL>
```

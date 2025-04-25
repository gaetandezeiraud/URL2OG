# URL2OG Service

A simple service to generate Open Graph images or screenshots from URLs, with disk-based caching and domain allowlist.

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
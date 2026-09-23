import { describe, expect, test, beforeAll, afterAll, beforeEach, spyOn } from 'bun:test';
import { rm } from 'node:fs/promises';
import { fakeBrowser } from './setup.js';
import { CACHE_DIR, ensureCacheDir } from '../src/cache.js';
import { startServer } from '../src/server.js';

describe('server', () => {
  let server;
  let base;

  beforeAll(async () => {
    server = await startServer(0);
    base = server.url.origin;
  });

  afterAll(() => {
    server.stop(true);
  });

  beforeEach(async () => {
    fakeBrowser.reset();
    process.env.ALLOWED_DOMAINS = 'example.com';
    await rm(CACHE_DIR, { recursive: true, force: true });
    await ensureCacheDir();
  });

  test('GET /health returns OK', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'OK' });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('unknown routes return 404', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  test('missing url returns 400', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid or missing URL' });
  });

  test('invalid url returns 400', async () => {
    const res = await fetch(`${base}/?url=${encodeURIComponent('http://')}`);
    expect(res.status).toBe(400);
  });

  test('disallowed domain returns 403', async () => {
    const res = await fetch(`${base}/?url=https://evil.com`);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Domain not allowed' });
  });

  test('generates then serves from cache', async () => {
    const url = `${base}/?url=${encodeURIComponent('https://example.com')}`;

    const miss = await fetch(url);
    expect(miss.status).toBe(200);
    expect(miss.headers.get('content-type')).toBe('image/png');
    expect(miss.headers.get('x-cache')).toBe('MISS');
    expect(miss.headers.get('cache-control')).toBe('public, max-age=86400');
    const missBody = new Uint8Array(await miss.arrayBuffer());
    expect(fakeBrowser.launchOptions).not.toBeNull();

    fakeBrowser.reset();
    const hit = await fetch(url);
    expect(hit.status).toBe(200);
    expect(hit.headers.get('x-cache')).toBe('HIT');
    expect(new Uint8Array(await hit.arrayBuffer())).toEqual(missBody);
    expect(fakeBrowser.launchOptions).toBeNull(); // no browser launched on hit
  });

  test('screenshot failure returns 500', async () => {
    fakeBrowser.gotoError = new Error('boom');
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await fetch(`${base}/?url=https://example.com`);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to generate screenshot' });
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('missing ALLOWED_DOMAINS returns 500', async () => {
    delete process.env.ALLOWED_DOMAINS;
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await fetch(`${base}/?url=https://example.com`);
      expect(res.status).toBe(500);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

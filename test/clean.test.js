import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { ensureCacheDir, getCacheFilePath, getCachedImage, saveToCache } from '../src/cache.js';
import { main } from '../src/clean.js';

const URL_A = 'https://example.com/clean-test';

describe('clean', () => {
  let logSpy;
  let errorSpy;

  beforeEach(async () => {
    await ensureCacheDir();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('fails without a URL', async () => {
    expect(await main(undefined)).toBe(1);
    expect(errorSpy.mock.calls[0][0]).toContain('No URL provided');
  });

  test('deletes an existing cached image', async () => {
    await saveToCache(URL_A, new Uint8Array([1, 2, 3]));
    expect(await main(URL_A)).toBe(0);
    expect(await getCachedImage(URL_A)).toBeNull();
    expect(logSpy.mock.calls[0][0]).toContain('Successfully deleted');
  });

  test('fails when nothing is cached', async () => {
    expect(await main(URL_A)).toBe(1);
    expect(logSpy.mock.calls[0][0]).toContain('No cached image found');
  });

  test('fails on unexpected errors', async () => {
    // unlink on a directory fails with a non-ENOENT error
    await mkdir(getCacheFilePath(URL_A), { recursive: true });
    try {
      expect(await main(URL_A)).toBe(1);
      expect(errorSpy.mock.calls[0][0]).toContain('Error deleting cached image');
    } finally {
      await rm(getCacheFilePath(URL_A), { recursive: true, force: true });
    }
  });

  test('runs as a CLI script', () => {
    const proc = Bun.spawnSync([process.execPath, 'src/clean.js'], { env: process.env });
    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain('No URL provided');
  });
});

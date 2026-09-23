import { describe, expect, test, beforeAll, spyOn } from 'bun:test';
import { mkdir, rm, exists } from 'node:fs/promises';
import path from 'node:path';
import {
  CACHE_DIR,
  ensureCacheDir,
  getCacheFilePath,
  getCachedImage,
  saveToCache,
  deleteCachedImage,
} from '../src/cache.js';

const URL_A = 'https://example.com/cache-test';

describe('cache', () => {
  beforeAll(async () => {
    await rm(CACHE_DIR, { recursive: true, force: true });
  });

  test('uses CACHE_DIR from the environment', () => {
    expect(CACHE_DIR).toBe(process.env.CACHE_DIR);
  });

  test('creates the cache directory', async () => {
    await ensureCacheDir();
    expect(await exists(CACHE_DIR)).toBe(true);
  });

  test('logs when the cache directory cannot be created', async () => {
    // A regular file in place of the directory makes mkdir fail
    await rm(CACHE_DIR, { recursive: true, force: true });
    await Bun.write(CACHE_DIR, 'not a directory');
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      await ensureCacheDir();
      expect(errorSpy).toHaveBeenCalledWith('Error creating cache directory:', expect.any(Error));
    } finally {
      errorSpy.mockRestore();
      await rm(CACHE_DIR, { force: true });
      await ensureCacheDir();
    }
  });

  test('builds a stable md5-based file path', () => {
    const filePath = getCacheFilePath(URL_A);
    expect(path.dirname(filePath)).toBe(CACHE_DIR);
    expect(path.basename(filePath)).toMatch(/^[0-9a-f]{32}\.png$/);
    expect(getCacheFilePath(URL_A)).toBe(filePath);
    expect(getCacheFilePath(`${URL_A}/other`)).not.toBe(filePath);
  });

  test('returns null on cache miss', async () => {
    expect(await getCachedImage(URL_A)).toBeNull();
  });

  test('saves and reads back an image', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    await saveToCache(URL_A, data);
    expect(await getCachedImage(URL_A)).toEqual(data);
  });

  test('deletes a cached image', async () => {
    await saveToCache(URL_A, new Uint8Array([1]));
    expect(await deleteCachedImage(URL_A)).toBe(true);
    expect(await getCachedImage(URL_A)).toBeNull();
    expect(await deleteCachedImage(URL_A)).toBe(false);
  });

  test('logs save errors without throwing', async () => {
    const writeSpy = spyOn(Bun, 'write').mockRejectedValue(new Error('disk full'));
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      await saveToCache(URL_A, new Uint8Array([1]));
      expect(errorSpy).toHaveBeenCalledWith('Error saving to cache:', expect.any(Error));
    } finally {
      writeSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test('rethrows unexpected delete errors', async () => {
    // Deleting a directory with unlink fails with a non-ENOENT error
    await mkdir(getCacheFilePath(URL_A), { recursive: true });
    try {
      await expect(deleteCachedImage(URL_A)).rejects.toThrow();
    } finally {
      await rm(getCacheFilePath(URL_A), { recursive: true, force: true });
    }
  });
});

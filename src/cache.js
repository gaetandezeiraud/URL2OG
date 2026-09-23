import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

// Cache directory
export const CACHE_DIR = process.env.CACHE_DIR || path.join(import.meta.dir, '../cache');

// Ensure cache directory exists
export async function ensureCacheDir() {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

// Generate MD5 hash of URL for unique filename
function getCacheKey(url) {
  return new Bun.CryptoHasher('md5').update(url).digest('hex');
}

// Get cache file path
export function getCacheFilePath(url) {
  const key = getCacheKey(url);
  return path.join(CACHE_DIR, `${key}.png`);
}

// Check if cached image exists
export async function getCachedImage(url) {
  const file = Bun.file(getCacheFilePath(url));
  if (!(await file.exists())) {
    return null; // Cache miss
  }
  return await file.bytes(); // Return file contents
}

// Save image to cache
export async function saveToCache(url, imageBuffer) {
  try {
    await Bun.write(getCacheFilePath(url), imageBuffer);
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
}

// Delete cached image, returns false if it did not exist
export async function deleteCachedImage(url) {
  try {
    await unlink(getCacheFilePath(url));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

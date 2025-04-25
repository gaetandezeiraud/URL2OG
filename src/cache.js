const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Cache directory
const CACHE_DIR = path.join(__dirname, '../cache');

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

// Generate MD5 hash of URL for unique filename
function getCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

// Get cache file path
function getCacheFilePath(url) {
  const key = getCacheKey(url);
  return path.join(CACHE_DIR, `${key}.png`);
}

// Check if cached image exists
async function getCachedImage(url) {
  const filePath = getCacheFilePath(url);
  try {
    await fs.access(filePath); // Check if file exists
    return await fs.readFile(filePath); // Return file buffer
  } catch {
    return null; // Cache miss
  }
}

// Save image to cache
async function saveToCache(url, imageBuffer) {
  const filePath = getCacheFilePath(url);
  try {
    await fs.writeFile(filePath, imageBuffer);
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
}

module.exports = { ensureCacheDir, getCachedImage, saveToCache };
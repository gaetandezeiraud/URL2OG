const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Cache directory
const CACHE_DIR = path.join(__dirname, '../cache');

// Generate MD5 hash of URL for unique filename
function getCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

// Get cache file path
function getCacheFilePath(url) {
  const key = getCacheKey(url);
  return path.join(CACHE_DIR, `${key}.png`);
}

// Delete cached image for a URL
async function deleteCachedImage(url) {
  if (!url) {
    console.error('Error: No URL provided. Usage: npm run clean <WEBSITE_URL>');
    process.exit(1);
  }

  const filePath = getCacheFilePath(url);
  try {
    await fs.access(filePath); // Check if file exists
    await fs.unlink(filePath); // Delete the file
    console.log(`Successfully deleted cached image for ${url}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`No cached image found for ${url}`);
    } else {
      console.error(`Error deleting cached image for ${url}:`, error.message);
    }
    process.exit(1);
  }
}

// Run the script with the provided URL (from command line argument)
const url = process.argv[2];
deleteCachedImage(url);
require('dotenv').config();
const express = require('express');
const { generateScreenshot } = require('./screenshot');
const { validateUrl, validateDomain } = require('./utils');
const { ensureCacheDir, getCachedImage, saveToCache } = require('./cache');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize cache directory
ensureCacheDir();

// Middleware to parse JSON and handle CORS
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

// API endpoint: /?url=<website>
app.get('/', async (req, res) => {
  const { url } = req.query;

  // Validate URL
  if (!url || !validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL' });
  }

  // Validate domain
  if (!validateDomain(url)) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    // Check cache
    const cachedImage = await getCachedImage(url);
    if (cachedImage) {
      // Cache hit: Serve cached image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('X-Cache', 'HIT');
      return res.send(cachedImage);
    }

    // Cache miss: Generate screenshot
    const imageBuffer = await generateScreenshot(url);

    // Save to cache
    await saveToCache(url, imageBuffer);

    // Set response headers and send image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('X-Cache', 'MISS');
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating screenshot:', error);
    res.status(500).json({ error: 'Failed to generate screenshot' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
import { generateScreenshot } from './screenshot.js';
import { validateUrl, validateDomain } from './utils.js';
import { ensureCacheDir, getCachedImage, saveToCache } from './cache.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function image(buffer, cacheStatus) {
  return new Response(buffer, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      'X-Cache': cacheStatus,
    },
  });
}

// API endpoint: /?url=<website>
export async function handleScreenshot(req) {
  const url = new URL(req.url).searchParams.get('url');

  // Validate URL
  if (!url || !validateUrl(url)) {
    return json({ error: 'Invalid or missing URL' }, 400);
  }

  try {
    // Validate domain
    if (!validateDomain(url)) {
      return json({ error: 'Domain not allowed' }, 403);
    }

    // Check cache
    const cachedImage = await getCachedImage(url);
    if (cachedImage) {
      return image(cachedImage, 'HIT');
    }

    // Cache miss: Generate screenshot
    const imageBuffer = await generateScreenshot(url);

    // Save to cache
    await saveToCache(url, imageBuffer);

    return image(imageBuffer, 'MISS');
  } catch (error) {
    console.error('Error generating screenshot:', error);
    return json({ error: 'Failed to generate screenshot' }, 500);
  }
}

export async function startServer(port = process.env.PORT || 3000) {
  // Initialize cache directory
  await ensureCacheDir();

  return Bun.serve({
    port,
    routes: {
      '/': { GET: handleScreenshot },
      // Health check endpoint
      '/health': { GET: () => json({ status: 'OK' }) },
    },
    fetch() {
      return json({ error: 'Not found' }, 404);
    },
  });
}

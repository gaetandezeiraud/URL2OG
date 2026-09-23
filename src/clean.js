import { deleteCachedImage } from './cache.js';

// Delete the cached image for a URL, returns the process exit code
export async function main(url) {
  if (!url) {
    console.error('Error: No URL provided. Usage: bun run clean <WEBSITE_URL>');
    return 1;
  }

  try {
    if (await deleteCachedImage(url)) {
      console.log(`Successfully deleted cached image for ${url}`);
      return 0;
    }
    console.log(`No cached image found for ${url}`);
    return 1;
  } catch (error) {
    console.error(`Error deleting cached image for ${url}:`, error.message);
    return 1;
  }
}

// Run the script with the provided URL (from command line argument)
if (import.meta.main) {
  process.exit(await main(process.argv[2]));
}

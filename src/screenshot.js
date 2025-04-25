const puppeteer = require('puppeteer');
const sharp = require('sharp');

async function generateScreenshot(url) {
  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Set viewport for Open Graph image (1200x630 is standard)
    await page.setViewport({ width: 1200, height: 630 });

    // Navigate to URL and wait for page to load
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Take screenshot
    const screenshot = await page.screenshot({ type: 'png' });

    // Optimize image with sharp
    const optimizedImage = await sharp(screenshot)
      .resize(1200, 630, { fit: 'cover' }) // Ensure exact dimensions
      .png({ quality: 80 }) // Optimize quality
      .toBuffer();

    return optimizedImage;
  } catch (error) {
    throw new Error(`Failed to generate screenshot: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateScreenshot };
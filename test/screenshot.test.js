import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test';
import sharp from 'sharp';
import { fakeBrowser } from './setup.js';
import { generateScreenshot } from '../src/screenshot.js';

describe('generateScreenshot', () => {
  let errorSpy;

  beforeEach(() => {
    fakeBrowser.reset();
    delete process.env.CHROMIUM_PATH;
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('returns a 1200x630 PNG and closes the browser', async () => {
    const image = await generateScreenshot('https://example.com');
    const metadata = await sharp(image).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(fakeBrowser.closed).toBe(true);
  });

  test('uses /usr/bin/chromium by default', async () => {
    await generateScreenshot('https://example.com');
    expect(fakeBrowser.launchOptions.executablePath).toBe('/usr/bin/chromium');
    expect(fakeBrowser.launchOptions.headless).toBe(true);
  });

  test('uses CHROMIUM_PATH when set', async () => {
    process.env.CHROMIUM_PATH = '/opt/chrome';
    await generateScreenshot('https://example.com');
    expect(fakeBrowser.launchOptions.executablePath).toBe('/opt/chrome');
  });

  test('wraps navigation errors and still closes the browser', async () => {
    fakeBrowser.gotoError = new Error('timeout');
    await expect(generateScreenshot('https://example.com')).rejects.toThrow(
      'Failed to generate screenshot: timeout',
    );
    expect(fakeBrowser.closed).toBe(true);
  });

  test('logs browser close errors without failing', async () => {
    fakeBrowser.closeError = new Error('already closed');
    const image = await generateScreenshot('https://example.com');
    expect(image.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalledWith('Failed to close browser:', fakeBrowser.closeError);
  });
});

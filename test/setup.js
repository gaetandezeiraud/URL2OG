import { mock } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

// Isolated cache directory, must be set before src/cache.js is imported
process.env.CACHE_DIR = mkdtempSync(path.join(tmpdir(), 'url2og-test-'));

// Fake puppeteer-core so tests never start a real browser
export const fakeBrowser = {
  launchOptions: null,
  gotoError: null,
  closeError: null,
  closed: false,
  screenshot: await sharp({
    create: { width: 1200, height: 630, channels: 3, background: '#336699' },
  })
    .png()
    .toBuffer(),
  reset() {
    this.launchOptions = null;
    this.gotoError = null;
    this.closeError = null;
    this.closed = false;
  },
};

mock.module('puppeteer-core', () => ({
  default: {
    async launch(options) {
      fakeBrowser.launchOptions = options;
      return {
        async newPage() {
          return {
            async setViewport() {},
            async goto() {
              if (fakeBrowser.gotoError) throw fakeBrowser.gotoError;
            },
            async screenshot() {
              return fakeBrowser.screenshot;
            },
          };
        },
        async close() {
          fakeBrowser.closed = true;
          if (fakeBrowser.closeError) throw fakeBrowser.closeError;
        },
      };
    },
  },
}));

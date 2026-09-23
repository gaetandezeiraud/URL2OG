import { describe, expect, test, beforeEach } from 'bun:test';
import { validateUrl, validateDomain } from '../src/utils.js';

describe('validateUrl', () => {
  test('accepts http and https URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true);
    expect(validateUrl('http://example.com/path?q=1')).toBe(true);
  });

  test('accepts URLs without scheme', () => {
    expect(validateUrl('example.com')).toBe(true);
  });

  test('rejects invalid URLs', () => {
    expect(validateUrl('https://exa mple.com')).toBe(false);
    expect(validateUrl('http://')).toBe(false);
  });
});

describe('validateDomain', () => {
  beforeEach(() => {
    process.env.ALLOWED_DOMAINS = ' Example.com , google.com';
  });

  test('allows exact domain matches', () => {
    expect(validateDomain('https://example.com')).toBe(true);
    expect(validateDomain('google.com/search')).toBe(true);
  });

  test('allows subdomains', () => {
    expect(validateDomain('https://www.example.com')).toBe(true);
  });

  test('rejects other domains', () => {
    expect(validateDomain('https://evil.com')).toBe(false);
    expect(validateDomain('https://notexample.com')).toBe(false);
    expect(validateDomain('https://example.com.evil.com')).toBe(false);
  });

  test('rejects unparsable URLs', () => {
    expect(validateDomain('https://exa mple.com')).toBe(false);
  });

  test('throws when no domains are configured', () => {
    delete process.env.ALLOWED_DOMAINS;
    expect(() => validateDomain('https://example.com')).toThrow('No allowed domains configured');
  });
});

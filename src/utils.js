function validateUrl(url) {
    try {
      // Ensure URL starts with http:// or https://
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  function validateDomain(url) {
    const allowedDomains = process.env.ALLOWED_DOMAINS
      ? process.env.ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase())
      : [];
    if (!allowedDomains.length) {
      throw new Error('No allowed domains configured in ALLOWED_DOMAINS');
    }
  
    try {
      const { hostname } = new URL(url.startsWith('http') ? url : `https://${url}`);
      // Allow exact matches or subdomains
      return allowedDomains.some((domain) => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }
  
  module.exports = { validateUrl, validateDomain };
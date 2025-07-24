/**
 * URL utilities for DOM Snapshot extension
 */

/**
 * Normalizes URL by removing hash fragments and optionally query parameters
 */
const normalizeUrl = (url: string, removeQuery = false): string => {
  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

    if (removeQuery) {
      return baseUrl;
    }

    return `${baseUrl}${urlObj.search}`;
  } catch {
    // Fallback for invalid URLs
    const cleanUrl = url.split('#')[0];
    return removeQuery ? cleanUrl.split('?')[0] : cleanUrl;
  }
};

/**
 * Checks if URL is valid for snapshot capture
 */
const isValidUrl = (url: string): boolean => {
  if (!url) return false;

  try {
    const urlObj = new URL(url);

    // Block chrome:// and other internal schemes
    const blockedSchemes = ['chrome:', 'chrome-extension:', 'about:', 'moz-extension:', 'safari-extension:'];
    if (blockedSchemes.some(scheme => url.startsWith(scheme))) {
      return false;
    }

    // Only allow http and https
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Gets display name for URL (for UI purposes)
 */
const getDisplayName = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
};

/**
 * Extracts domain from URL
 */
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'Unknown';
  }
};

/**
 * Formats URL for display in limited space
 */
const formatUrlForDisplay = (url: string, maxLength = 40): string => {
  const displayName = getDisplayName(url);
  if (displayName.length <= maxLength) {
    return displayName;
  }

  return displayName.substring(0, maxLength - 3) + '...';
};

export { normalizeUrl, isValidUrl, getDisplayName, extractDomain, formatUrlForDisplay };

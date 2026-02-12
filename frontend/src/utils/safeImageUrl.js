/**
 * Only allow http:, https:, or data: URLs for img src to prevent XSS (e.g. javascript:).
 * @param {string} url - Candidate URL
 * @param {string} fallback - Returned when url is invalid or uses a disallowed protocol
 * @returns {string}
 */
export function safeImageUrl(url, fallback = '') {
  if (!url || typeof url !== 'string') return fallback;
  const s = String(url).trim();
  try {
    const u = new URL(s, 'https://example.com');
    if (['http:', 'https:', 'data:'].includes(u.protocol)) return s;
  } catch (_) {}
  return fallback;
}

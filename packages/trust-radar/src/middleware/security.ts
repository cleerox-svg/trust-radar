/**
 * Security headers middleware.
 * Adds defense-in-depth HTTP headers to every response.
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Basic XSS protection (legacy browsers)
  headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy — send origin only to same-origin, nothing to cross-origin
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — disable features we don't use
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Content Security Policy
  headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdn.fontshare.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://lrxradar.com https://api.lrxradar.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "));

  // HSTS — enforce HTTPS (1 year, include subdomains)
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

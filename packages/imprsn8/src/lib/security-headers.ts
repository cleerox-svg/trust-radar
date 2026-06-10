// Security headers for HTML responses (security audit 2026-06-10, finding M5).
//
// Both server-rendered templates (templates/homepage.ts, templates/dashboard.ts)
// rely on inline <script>/<style> blocks and inline event handlers, so
// script-src/style-src need 'unsafe-inline'. Stylesheets and fonts are pulled
// from Google Fonts, Fontshare, and jsDelivr (see the <head> of each template).

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com https://cdn.fontshare.com https://cdn.jsdelivr.net",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const HTML_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/** Builds a text/html response with the security headers applied. */
export function htmlResponse(html: string, cacheControl: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
      ...HTML_SECURITY_HEADERS,
    },
  });
}

/** Returns a mutable copy of `response` with the security headers set (for ASSETS passthrough). */
export function withSecurityHeaders(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(HTML_SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}

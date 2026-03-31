/**
 * Averrow — robots.txt and sitemap.xml for the public corporate site.
 * Includes honeypot Disallow paths that malicious bots will specifically crawl.
 */

export function renderRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /v2/
Disallow: /api/
Disallow: /admin-portal/
Disallow: /internal-staff/
Disallow: /internal-docs/

# Sitemap
Sitemap: https://averrow.com/sitemap.xml
`;
}

export function renderSitemapXml(): string {
  const pages = [
    "/",
    "/platform",
    "/pricing",
    "/about",
    "/security",
    "/blog",
    "/blog/email-security-posture-brand-defense",
    "/blog/cost-brand-impersonation-mid-market",
    "/blog/ai-powered-threat-narratives",
    "/blog/lookalike-domains-threat-hiding",
    "/changelog",
    "/contact",
    "/scan",
    "/team",
    "/privacy",
    "/terms",
  ];

  const urls = pages.map(
    (p) =>
      `  <url><loc>https://averrow.com${p}</loc><changefreq>weekly</changefreq></url>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

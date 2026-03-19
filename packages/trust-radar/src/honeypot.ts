/**
 * Honeypot Pages — Serves realistic-looking pages on lrxradar.com with trap addresses.
 *
 * These pages contain visible email addresses and hidden spider traps.
 * Only served when the request hostname is lrxradar.com.
 */

export function serveHoneypotPage(page: string): Response {
  const date = (new Date().toISOString().split("T")[0] ?? "").replace(/-/g, "");

  const pages: Record<string, { title: string; content: string; email: string }> = {
    contact: {
      title: "Contact Us \u2014 LRX Radar",
      email: `honey-contact-${date}@lrxradar.com`,
      content: "For general inquiries, reach out to our team.",
    },
    team: {
      title: "Our Team \u2014 LRX Radar",
      email: `honey-team-${date}@lrxradar.com`,
      content: "Meet the team behind LRX Radar.",
    },
    careers: {
      title: "Careers \u2014 LRX Radar",
      email: `honey-careers-${date}@lrxradar.com`,
      content: "We are always looking for talented individuals.",
    },
    about: {
      title: "About \u2014 LRX Radar",
      email: `honey-about-${date}@lrxradar.com`,
      content: "LRX Radar provides threat intelligence solutions.",
    },
  };

  const p = pages[page] ?? pages["contact"] ?? {
    title: "Contact Us \u2014 LRX Radar",
    email: `honey-contact-${date}@lrxradar.com`,
    content: "For general inquiries, reach out to our team.",
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${p.title}</title>
<style>body{font-family:system-ui;max-width:600px;margin:60px auto;color:#333;padding:0 20px}
h1{font-size:24px}a{color:#0066cc}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:13px;color:#999}</style></head>
<body>
<h1>${(p.title.split("\u2014")[0] ?? p.title).trim()}</h1>
<p>${p.content}</p>
<p>Email: <a href="mailto:${p.email}">${p.email}</a></p>
<div class="footer">
  <p>&copy; 2026 LRX Enterprises Inc. All rights reserved.</p>
  <p><a href="https://trustradar.ca">Trust Radar</a> | <a href="/contact">Contact</a> | <a href="/about">About</a></p>
</div>
<!-- spider traps -->
<div style="position:absolute;left:-9999px;height:0;overflow:hidden" aria-hidden="true">
  <a href="mailto:spider-honey-${page}-${date}@lrxradar.com">support</a>
  <a href="mailto:spider-honey-${page}b-${date}@lrxradar.com">info</a>
</div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=86400" },
  });
}

/**
 * Honeypot Pages — Serves realistic-looking pages with trap addresses.
 *
 * These pages contain visible email addresses and hidden spider traps.
 * Served from both trustradar.ca and lrxradar.com.
 */

export function serveHoneypotPage(page: string, domain = "trustradar.ca"): Response {
  const date = (new Date().toISOString().split("T")[0] ?? "").replace(/-/g, "");
  const isTrustRadar = domain === "trustradar.ca";
  const brandName = isTrustRadar ? "Trust Radar" : "LRX Radar";
  const companyName = "LRX Enterprises Inc.";

  // Seed trap addresses for trustradar.ca (static — harvesters parse raw HTML)
  const trustRadarSeeds: Record<string, string> = {
    contact: "info-cp01@trustradar.ca",
    team: "hr-hp01@trustradar.ca",
    careers: "hr-hp01@trustradar.ca",
    about: "admin-wh01@trustradar.ca",
  };

  const pages: Record<string, { title: string; content: string; email: string }> = {
    contact: {
      title: `Contact Us \u2014 ${brandName}`,
      email: isTrustRadar
        ? trustRadarSeeds["contact"]!
        : `honey-contact-${date}@trustradar.ca`,
      content: isTrustRadar
        ? "Have questions about our threat intelligence platform? Get in touch with our team."
        : "For general inquiries, reach out to our team.",
    },
    team: {
      title: `Our Team \u2014 ${brandName}`,
      email: isTrustRadar
        ? trustRadarSeeds["team"]!
        : `honey-team-${date}@trustradar.ca`,
      content: `Meet the team behind ${brandName}.`,
    },
    careers: {
      title: `Careers \u2014 ${brandName}`,
      email: isTrustRadar
        ? trustRadarSeeds["careers"]!
        : `honey-careers-${date}@trustradar.ca`,
      content: "We are always looking for talented individuals.",
    },
    about: {
      title: `About \u2014 ${brandName}`,
      email: isTrustRadar
        ? trustRadarSeeds["about"]!
        : `honey-about-${date}@trustradar.ca`,
      content: `${brandName} provides real-time threat intelligence and brand protection solutions.`,
    },
  };

  const p = pages[page] ?? pages["contact"]!;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${p.title}</title>
<meta name="description" content="${brandName} — Real-time threat intelligence and brand protection">
<style>body{font-family:system-ui;max-width:600px;margin:60px auto;color:#333;padding:0 20px}
h1{font-size:24px}a{color:#0066cc}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:13px;color:#999}</style></head>
<body>
<h1>${(p.title.split("\u2014")[0] ?? p.title).trim()}</h1>
<p>${p.content}</p>
<p>Email: <a href="mailto:${p.email}">${p.email}</a></p>${isTrustRadar && page === "contact" ? `
<p>For support inquiries: <a href="mailto:support-fp01@trustradar.ca">support-fp01@trustradar.ca</a></p>
<p>Sales: <a href="mailto:sales-bd01@trustradar.ca">sales-bd01@trustradar.ca</a></p>` : ""}
<div class="footer">
  <p>&copy; 2026 ${companyName}. All rights reserved.</p>
  <p><a href="https://trustradar.ca">Trust Radar</a> | <a href="/contact">Contact</a> | <a href="/about">About</a></p>
</div>
<!-- ${p.email} -->
<div style="position:absolute;left:-9999px;height:0;overflow:hidden" aria-hidden="true">
  <a href="mailto:spider-honey-${page}-${date}@${domain}">support</a>
  <a href="mailto:spider-honey-${page}b-${date}@${domain}">info</a>${isTrustRadar ? `
  <a href="mailto:dev-gp01@trustradar.ca">dev</a>` : ""}
</div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=86400" },
  });
}

/**
 * Spider Trap Injector — Generates hidden HTML containing trap email addresses.
 *
 * Produces HTML snippets with hidden mailto links and meta tags that
 * email-harvesting bots will scrape. Addresses contain encoded metadata
 * for tracking which trap caught which spammer.
 */

export function generateSpiderTraps(domain: string = "lrxradar.com"): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const traps = [
    `spider-pub-footer-${date}`,
    `spider-pub-meta-${date}`,
    `spider-pub-comment-${date}`,
    `spider-pub-hidden-${date}`,
  ];

  return `
    <!-- Trust Radar monitoring -->
    <div style="position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden" aria-hidden="true">
      <a href="mailto:${traps[0]}@${domain}">contact us</a>
      <a href="mailto:${traps[1]}@${domain}">support</a>
    </div>
    <meta name="reply-to" content="${traps[2]}@${domain}">
  `.trim();
}

/**
 * Averrow — Honeypot Pages for Spider Traps
 * Served at /admin-portal and /internal-staff — paths listed as Disallow in robots.txt.
 * Malicious bots specifically crawl disallowed paths, making these effective honeypots.
 */
import { wrapPage } from "./shared";

export function renderAdminPortalPage(): string {
  return wrapPage(
    "Admin Portal — Averrow",
    "Internal administration portal for Averrow platform management.",
    `
<style>
.hp-section {
  max-width: 720px;
  margin: 3rem auto;
  padding: 0 2rem;
}
.hp-section h1 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1rem;
}
.hp-section p {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 0.75rem;
}
.hp-contacts {
  background: var(--bg-secondary, #0d1520);
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 1.5rem 2rem;
  margin-top: 1.5rem;
}
.hp-contacts h3 {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}
.hp-contact-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.05));
  font-size: 14px;
}
.hp-contact-row:last-child { border-bottom: none; }
.hp-contact-row .name { color: var(--text-primary); }
.hp-contact-row .email { color: var(--link-color, #78A0C8); }
</style>

<section class="hp-section">
  <h1>Administration Portal</h1>
  <p>This area is restricted to authorized Averrow staff. If you need access, please contact the IT department.</p>
  <p>For platform issues, reach out to the operations team below.</p>

  <div class="hp-contacts">
    <h3>Admin Contacts</h3>
    <div class="hp-contact-row">
      <span class="name">Robert Taylor — IT Director</span>
      <span class="email">robert.taylor.hp01@averrow.com</span>
    </div>
    <div class="hp-contact-row">
      <span class="name">Lisa Martinez — DevOps Lead</span>
      <span class="email">lisa.martinez.hp02@trustradar.ca</span>
    </div>
    <div class="hp-contact-row">
      <span class="name">Kevin Park — Infrastructure</span>
      <span class="email">kevin.park.hp03@averrow.com</span>
    </div>
  </div>
</section>
<!-- Admin support: robert.taylor.hp01@averrow.com | lisa.martinez.hp02@trustradar.ca -->
`
  );
}

export function renderInternalStaffPage(): string {
  return wrapPage(
    "Internal Staff Directory — Averrow",
    "Internal staff directory for Averrow employees.",
    `
<section class="hp-section">
  <h1>Staff Directory</h1>
  <p>Internal use only. For external inquiries, please use our <a href="/contact">contact page</a>.</p>

  <div class="hp-contacts">
    <h3>Department Leads</h3>
    <div class="hp-contact-row">
      <span class="name">Amanda White — Customer Success</span>
      <span class="email">amanda.white.hp04@trustradar.ca</span>
    </div>
    <div class="hp-contact-row">
      <span class="name">Chris Johnson — Threat Research</span>
      <span class="email">chris.johnson.hp05@averrow.com</span>
    </div>
    <div class="hp-contact-row">
      <span class="name">Rachel Kim — Product</span>
      <span class="email">rachel.kim.hp06@trustradar.ca</span>
    </div>
    <div class="hp-contact-row">
      <span class="name">Tom Harris — Compliance</span>
      <span class="email">tom.harris.hp07@averrow.com</span>
    </div>
  </div>
</section>
<!-- Staff directory: amanda.white.hp04@trustradar.ca | chris.johnson.hp05@averrow.com -->

<style>
.hp-section {
  max-width: 720px;
  margin: 3rem auto;
  padding: 0 2rem;
}
.hp-section h1 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1rem;
}
.hp-section p {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 0.75rem;
}
.hp-contacts {
  background: var(--bg-secondary, #0d1520);
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 1.5rem 2rem;
  margin-top: 1.5rem;
}
.hp-contacts h3 {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}
.hp-contact-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.05));
  font-size: 14px;
}
.hp-contact-row:last-child { border-bottom: none; }
.hp-contact-row .name { color: var(--text-primary); }
.hp-contact-row .email { color: var(--link-color, #78A0C8); }
</style>
`
  );
}

/**
 * Trust Radar — Pricing Page
 * Served at /pricing
 */
import { wrapPage } from "./shared";
import { generateSpiderTraps } from "../seeders/spider-injector";

export function renderPricingPage(): string {
  return wrapPage(
    "Pricing — Trust Radar",
    "Simple, transparent pricing. Enterprise-grade brand protection from $799/mo. Free scan available.",
    `
<style>
.pricing-hero { padding: 8rem 0 4rem; text-align: center; background: var(--gradient-hero); }
.pricing-hero h1 { font-family: var(--font-display); font-size: clamp(2.5rem,4vw,3.5rem); font-weight: 800; margin-bottom: 1rem; }
.pricing-hero p { font-size: 1.1rem; color: var(--text-secondary); max-width: 560px; margin: 0 auto; line-height: 1.7; }

.pricing-section { padding: 4rem 0 5rem; }
.pricing-grid { max-width: 1200px; margin: 0 auto; padding: 0 2rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
.price-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 2rem; display: flex; flex-direction: column; position: relative; transition: all 0.3s; }
.price-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.price-card.popular { border-color: var(--accent); box-shadow: var(--shadow-glow); }
.price-card.popular::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
.popular-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--accent); color: white; font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 100px; letter-spacing: 0.05em; }
.price-tier { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
.price-desc { font-size: 0.82rem; color: var(--text-tertiary); margin-bottom: 1.25rem; }
.price-amount { font-family: var(--font-display); font-size: 2.5rem; font-weight: 800; margin-bottom: 0.25rem; }
.price-amount span { font-size: 1rem; font-weight: 400; color: var(--text-tertiary); }
.price-billing { font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 1.5rem; }
.price-divider { height: 1px; background: var(--border); margin-bottom: 1.5rem; }
.price-features { list-style: none; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 2rem; }
.price-features li { font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 0.5rem; }
.price-features li::before { content: '✓'; color: var(--green); font-weight: 700; flex-shrink: 0; }
.price-cta { margin-top: auto; }

.compare-section { padding: 5rem 0; background: var(--bg-tertiary); }
.compare-table-wrap { max-width: 900px; margin: 2rem auto 0; padding: 0 2rem; overflow-x: auto; }
.compare-table { width: 100%; border-collapse: collapse; background: var(--bg-secondary); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border); }
.compare-table th { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); text-align: left; padding: 1rem; background: var(--bg-tertiary); border-bottom: 1px solid var(--border); }
.compare-table th.highlight { color: var(--accent); }
.compare-table td { font-size: 0.85rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
.compare-table tr:last-child td { border-bottom: none; }
.compare-table td:first-child { font-weight: 600; color: var(--text-primary); }

.faq-section { padding: 5rem 0; }
.faq-list { max-width: 720px; margin: 2rem auto 0; padding: 0 2rem; }
.faq-item { border-bottom: 1px solid var(--border); }
.faq-q { font-family: var(--font-body); font-size: 0.95rem; font-weight: 600; padding: 1.25rem 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: none; border: none; width: 100%; text-align: left; color: var(--text-primary); }
.faq-q:hover { color: var(--accent); }
.faq-arrow { font-size: 0.85rem; color: var(--text-tertiary); transition: transform 0.2s; }
.faq-a { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.7; padding: 0 0 1.25rem; display: none; }
.faq-item.open .faq-a { display: block; }
.faq-item.open .faq-arrow { transform: rotate(180deg); }

.cta-block { padding: 5rem 0; text-align: center; background: var(--bg-tertiary); }
.cta-block h2 { font-family: var(--font-display); font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
.cta-block p { color: var(--text-secondary); max-width: 480px; margin: 0 auto 2rem; }
.cta-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

@media (max-width: 1024px) { .pricing-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .pricing-grid { grid-template-columns: 1fr; max-width: 420px; } }
</style>

<section class="pricing-hero">
  <div class="container">
    <div class="section-label" style="text-align:center;">Pricing</div>
    <h1>Simple, transparent pricing.</h1>
    <p>Enterprise-grade brand protection at a fraction of incumbent costs. Start free, scale when you're ready.</p>
  </div>
</section>

<section class="pricing-section">
  <div class="pricing-grid">
    <!-- Free -->
    <div class="price-card">
      <div class="price-tier">Free</div>
      <div class="price-desc">Brand Exposure Report</div>
      <div class="price-amount">$0</div>
      <div class="price-billing">One-time scan</div>
      <div class="price-divider"></div>
      <ul class="price-features">
        <li>Email security grade</li>
        <li>Threat feed check</li>
        <li>Lookalike domain scan</li>
        <li>Social handle check</li>
        <li>AI assessment</li>
        <li>Shareable report link</li>
      </ul>
      <div class="price-cta"><a href="/scan" class="btn btn-outline" style="width:100%;justify-content:center;">Scan Your Brand</a></div>
    </div>

    <!-- Professional -->
    <div class="price-card popular">
      <span class="popular-badge">POPULAR</span>
      <div class="price-tier">Professional</div>
      <div class="price-desc">For growing companies</div>
      <div class="price-amount">$799<span>/mo</span></div>
      <div class="price-billing">Billed monthly or annually</div>
      <div class="price-divider"></div>
      <ul class="price-features">
        <li>Everything in Free</li>
        <li>Continuous 24/7 monitoring</li>
        <li>AI Analyst agent</li>
        <li>Daily Observer briefings</li>
        <li>Email security alerts</li>
        <li>Social monitoring (6 platforms)</li>
        <li>AI-powered impersonation detection with confidence scoring</li>
        <li>Takedown evidence generation</li>
        <li>Lookalike domain tracking</li>
        <li>Up to 5 brands</li>
      </ul>
      <div class="price-cta"><a href="/contact" class="btn btn-primary" style="width:100%;justify-content:center;">Get Started</a></div>
    </div>

    <!-- Business -->
    <div class="price-card">
      <div class="price-tier">Business</div>
      <div class="price-desc">For security teams &amp; MSSPs</div>
      <div class="price-amount">$1,999<span>/mo</span></div>
      <div class="price-billing">Billed monthly or annually</div>
      <div class="price-divider"></div>
      <ul class="price-features">
        <li>Everything in Professional</li>
        <li>Up to 25 brands</li>
        <li>AI-powered social monitoring across 6 platforms</li>
        <li>STIX 2.1 export</li>
        <li>Full API access</li>
        <li>Webhook notifications</li>
        <li>CT log monitoring</li>
        <li>Priority support</li>
      </ul>
      <div class="price-cta"><a href="/contact" class="btn btn-outline" style="width:100%;justify-content:center;">Contact Sales</a></div>
    </div>

    <!-- Enterprise -->
    <div class="price-card">
      <div class="price-tier">Enterprise</div>
      <div class="price-desc">Custom deployment</div>
      <div class="price-amount" style="font-size:1.8rem;">Custom</div>
      <div class="price-billing">Starting at $4,999/mo</div>
      <div class="price-divider"></div>
      <ul class="price-features">
        <li>Everything in Business</li>
        <li>Unlimited brands</li>
        <li>SSO (SAML / OIDC)</li>
        <li>Custom AI tuning</li>
        <li>Dedicated account team</li>
        <li>SLA guarantee</li>
        <li>SCIM provisioning</li>
      </ul>
      <div class="price-cta"><a href="/contact" class="btn btn-outline" style="width:100%;justify-content:center;">Talk to Us</a></div>
    </div>
  </div>
</section>

<!-- Competitor Comparison -->
<section class="compare-section">
  <div class="container" style="text-align:center;">
    <div class="section-label" style="text-align:center;">Comparison</div>
    <h2 style="font-family:var(--font-display);font-size:1.75rem;font-weight:700;">How We Compare</h2>
  </div>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead>
        <tr>
          <th></th>
          <th class="highlight">Trust Radar Professional</th>
          <th>Incumbent Entry-Level</th>
          <th>Enterprise Platform</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Annual Cost</td><td style="color:var(--accent);font-weight:600;">$9,588/yr</td><td>$20,000–$30,000/yr</td><td>$50,000–$150,000+/yr</td></tr>
        <tr><td>Setup Time</td><td>Minutes (zero config)</td><td>Days to weeks</td><td>Weeks to months</td></tr>
        <tr><td>Email Security Analysis</td><td style="color:var(--green);">✓ Full posture engine</td><td style="color:var(--red);">✗ Not included</td><td style="color:var(--amber);">~ Limited</td></tr>
        <tr><td>AI-Powered Analysis</td><td style="color:var(--green);">✓ Native AI agents</td><td style="color:var(--red);">✗ Manual triage</td><td style="color:var(--amber);">~ Basic ML rules</td></tr>
        <tr><td>Social Monitoring</td><td style="color:var(--green);">✓ 6 platforms</td><td style="color:var(--amber);">~ 2-3 platforms</td><td style="color:var(--green);">✓ Comprehensive</td></tr>
        <tr><td>Minimum Commitment</td><td>Monthly</td><td>Annual contract</td><td>Multi-year contract</td></tr>
      </tbody>
    </table>
  </div>
</section>

<!-- FAQ -->
<section class="faq-section">
  <div class="container" style="text-align:center;">
    <h2 style="font-family:var(--font-display);font-size:1.75rem;font-weight:700;">Frequently Asked Questions</h2>
  </div>
  <div class="faq-list">
    <div class="faq-item">
      <button class="faq-q" onclick="this.parentElement.classList.toggle('open')">How does the free scan work? <span class="faq-arrow">▼</span></button>
      <div class="faq-a">Enter any domain and we'll run a comprehensive brand exposure assessment — checking email security, threat feeds, lookalike domains, and social handle availability. Results are available immediately with no account required.</div>
    </div>
    <div class="faq-item">
      <button class="faq-q" onclick="this.parentElement.classList.toggle('open')">What's included in continuous monitoring? <span class="faq-arrow">▼</span></button>
      <div class="faq-a">Professional and above plans include continuous 24/7 monitoring across all threat feeds, daily AI-generated briefings, real-time alerts on new threats, and ongoing social platform monitoring with AI-powered impersonation detection.</div>
    </div>
    <div class="faq-item">
      <button class="faq-q" onclick="this.parentElement.classList.toggle('open')">Can I switch plans? <span class="faq-arrow">▼</span></button>
      <div class="faq-a">Yes. You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle. No penalties for switching.</div>
    </div>
    <div class="faq-item">
      <button class="faq-q" onclick="this.parentElement.classList.toggle('open')">Do you offer annual billing? <span class="faq-arrow">▼</span></button>
      <div class="faq-a">Yes. Annual billing includes a discount. Contact our sales team for annual pricing details.</div>
    </div>
    <div class="faq-item">
      <button class="faq-q" onclick="this.parentElement.classList.toggle('open')">What payment methods do you accept? <span class="faq-arrow">▼</span></button>
      <div class="faq-a">We accept all major credit cards. Enterprise customers can arrange invoicing and wire transfers.</div>
    </div>
    <div class="faq-item">
      <button class="faq-q" onclick="this.parentElement.classList.toggle('open')">Is there a minimum contract? <span class="faq-arrow">▼</span></button>
      <div class="faq-a">No. Professional and Business plans are month-to-month with no minimum commitment. Enterprise plans are customized to your needs.</div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-block">
  <div class="container">
    <h2>Ready to protect your brand?</h2>
    <p>Start with a free scan or talk to our team about the right plan for you.</p>
    <div class="cta-actions">
      <a href="/scan" class="btn btn-primary btn-lg">Start Free Scan</a>
      <a href="/contact" class="btn btn-outline btn-lg">Contact Sales</a>
    </div>
  </div>
</section>
${generateSpiderTraps("trustradar.ca", "pricing")}
`
  );
}

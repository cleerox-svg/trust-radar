/**
 * Trust Radar — About Page
 * Served at /about
 */
import { wrapPage } from "./shared";
import { generateSpiderTraps } from "../seeders/spider-injector";

export function renderAboutPage(): string {
  return wrapPage(
    "About — Trust Radar",
    "LRX Enterprises Inc. Making brand threat intelligence accessible. AI-native, edge-first, radically accessible.",
    `
<style>
.about-hero { padding: 8rem 0 4rem; text-align: center; background: var(--gradient-hero); }
.about-hero h1 { font-family: var(--font-display); font-size: clamp(2.5rem,4vw,3.5rem); font-weight: 800; margin-bottom: 1rem; }
.about-hero p { font-size: 1.1rem; color: var(--text-secondary); max-width: 560px; margin: 0 auto; line-height: 1.7; }

.about-section { padding: 5rem 0; }
.about-section:nth-child(even) { background: var(--bg-tertiary); }
.about-content { max-width: 720px; margin: 0 auto; padding: 0 2rem; }
.about-content h2 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; }
.about-content p { color: var(--text-secondary); line-height: 1.8; margin-bottom: 1.5rem; font-size: 1rem; }

.principles-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
.principle-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 2rem; position: relative; overflow: hidden; }
.principle-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: var(--radius-lg) var(--radius-lg) 0 0; opacity: 0; transition: opacity 0.3s; }
.principle-card:hover::before { opacity: 1; }
.principle-card:nth-child(1)::before { background: var(--accent); }
.principle-card:nth-child(2)::before { background: var(--coral); }
.principle-card:nth-child(3)::before { background: var(--green); }
.principle-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-glow); transition: all 0.3s; }
.principle-num { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; color: var(--accent); margin-bottom: 0.75rem; }
.principle-card h3 { font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; margin-bottom: 0.75rem; }
.principle-card p { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.65; }

.facts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 900px; margin: 2rem auto 0; padding: 0 2rem; }
.fact-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; transition: border-color 0.2s; }
.fact-card:hover { border-color: var(--accent); }
.fact-value { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
.fact-label { font-size: 0.78rem; color: var(--text-tertiary); }

.tech-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; max-width: 800px; margin: 2rem auto 0; padding: 0 2rem; }
.tech-item { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; }
.tech-name { font-family: var(--font-mono); font-size: 0.82rem; font-weight: 600; color: var(--accent); margin-bottom: 0.35rem; }
.tech-desc { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; }

.cta-block { padding: 5rem 0; text-align: center; }
.cta-block h2 { font-family: var(--font-display); font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
.cta-block p { color: var(--text-secondary); max-width: 480px; margin: 0 auto 2rem; }
.cta-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

@media (max-width: 768px) {
  .principles-grid, .facts-grid { grid-template-columns: 1fr; }
  .tech-grid { grid-template-columns: 1fr; }
}
</style>

<section class="about-hero">
  <div class="container">
    <div class="section-label" style="text-align:center;">About</div>
    <h1>Making brand threat intelligence<br>accessible.</h1>
    <p>LRX Enterprises Inc. is building the trust infrastructure that every company deserves — not just enterprises with six-figure security budgets.</p>
  </div>
</section>

<!-- Our Story -->
<section class="about-section">
  <div class="about-content">
    <h2>Our Story</h2>
    <p>Enterprise brand protection platforms cost $20,000 to $150,000+ per year and require dedicated security analysts to operate. Meanwhile, mid-market companies — the ones actually being targeted by phishing campaigns and brand impersonation — have no affordable option.</p>
    <p>Trust Radar exists to close that gap. Founded in Canada, built AI-native from day one, and deployed on edge infrastructure that keeps costs 10-50x lower than traditional platforms. We believe every company should be able to see their brand the way attackers do.</p>
  </div>
</section>

<!-- Principles -->
<section class="about-section" style="text-align:center;">
  <div class="container">
    <div class="section-label" style="text-align:center;">Our Approach</div>
    <h2 style="font-family:var(--font-display);font-size:1.75rem;font-weight:700;margin-bottom:2rem;">Three Principles</h2>
  </div>
  <div class="principles-grid">
    <div class="principle-card">
      <div class="principle-num">01</div>
      <h3>Outside-In First</h3>
      <p>See your brand the way attackers do. Trust Radar works instantly with zero setup — it scans the open internet and reports what it finds. Optionally connect your security platforms for deeper signal.</p>
    </div>
    <div class="principle-card">
      <div class="principle-num">02</div>
      <h3>AI-Native</h3>
      <p>Intelligence, not alert dumps. AI agents that reason, correlate, and narrate. Built with the most advanced AI available, from the ground up — not bolted on as an afterthought.</p>
    </div>
    <div class="principle-card">
      <div class="principle-num">03</div>
      <h3>Radically Accessible</h3>
      <p>Enterprise intelligence without enterprise pricing. Edge-native architecture on Cloudflare Workers keeps infrastructure costs 10-50x lower than traditional security platforms.</p>
    </div>
  </div>
</section>

<!-- Company Facts -->
<section class="about-section" style="text-align:center;">
  <div class="container">
    <h2 style="font-family:var(--font-display);font-size:1.75rem;font-weight:700;margin-bottom:0.5rem;">Company Facts</h2>
  </div>
  <div class="facts-grid">
    <div class="fact-card"><div class="fact-value">🇨🇦 Canada</div><div class="fact-label">Incorporated</div></div>
    <div class="fact-card"><div class="fact-value">AI-Native</div><div class="fact-label">Powered by advanced AI agents</div></div>
    <div class="fact-card"><div class="fact-value">Edge-First</div><div class="fact-label">Cloudflare Workers, zero cold starts</div></div>
    <div class="fact-card"><div class="fact-value">6+</div><div class="fact-label">Integrated threat intelligence feeds</div></div>
    <div class="fact-card"><div class="fact-value">50-66%</div><div class="fact-label">Less than incumbent platforms</div></div>
    <div class="fact-card"><div class="fact-value">SOC 2</div><div class="fact-label">Compliance roadmap in progress</div></div>
  </div>
</section>

<!-- Technology -->
<section class="about-section" style="text-align:center;">
  <div class="container">
    <h2 style="font-family:var(--font-display);font-size:1.75rem;font-weight:700;margin-bottom:0.5rem;">Technology</h2>
    <p style="color:var(--text-secondary);margin-bottom:1rem;">Every choice optimized for performance, reliability, and cost.</p>
  </div>
  <div class="tech-grid">
    <div class="tech-item"><div class="tech-name">Cloudflare Workers</div><div class="tech-desc">Edge-native compute with zero cold starts. Globally distributed, no traditional servers to compromise.</div></div>
    <div class="tech-item"><div class="tech-name">D1 Database</div><div class="tech-desc">SQLite-based, encrypted at rest, automatic backups. Low-cost, high-reliability relational storage.</div></div>
    <div class="tech-item"><div class="tech-name">Advanced AI Agents</div><div class="tech-desc">Multi-signal threat reasoning and natural language narrative generation. Configurable via API key.</div></div>
    <div class="tech-item"><div class="tech-name">KV + R2</div><div class="tech-desc">Distributed caching and object storage. TTL-based expiry, encrypted, globally replicated.</div></div>
  </div>
</section>

<!-- CTA -->
<section class="cta-block">
  <div class="container">
    <h2>See what Trust Radar can do.</h2>
    <p>Explore the platform or run a free brand exposure scan.</p>
    <div class="cta-actions">
      <a href="/platform" class="btn btn-primary btn-lg">Explore Platform</a>
      <a href="/scan" class="btn btn-outline btn-lg">Free Scan</a>
    </div>
  </div>
</section>
${generateSpiderTraps("averrow.com", "about")}
`
  );
}

/**
 * Trust Radar — Shared Components
 * Reusable nav, footer, head, and page wrapper for the corporate site.
 */

/* ──────────────────────────────────────────────────────────
   renderNav — sticky glassmorphic navigation bar
   ────────────────────────────────────────────────────────── */
export function renderNav(): string {
  return `
<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-brand">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12.5" stroke="var(--accent)" stroke-width="2"/>
        <circle cx="14" cy="14" r="7" stroke="var(--accent)" stroke-width="1.2" opacity="0.4"/>
        <circle cx="14" cy="14" r="2" fill="var(--accent)"/>
        <line x1="14" y1="14" x2="14" y2="3" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="5s" repeatCount="indefinite"/>
        </line>
      </svg>
      <div>
        <span class="nav-brand-text">Trust Radar</span>
        <span class="nav-brand-sub">by LRX Enterprise</span>
      </div>
    </a>
    <ul class="nav-links">
      <li><a href="/platform">Platform</a></li>
      <li><a href="/pricing">Pricing</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/security">Security</a></li>
      <li><a href="/blog">Blog</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
    <div class="nav-right">
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
        <span id="theme-icon">\u2600</span>
      </button>
      <a href="/login" class="btn btn-outline" style="font-size:0.82rem;padding:0.45rem 1rem;">Login</a>
      <a href="/scan" class="btn btn-primary" style="font-size:0.82rem;padding:0.45rem 1rem;">Free Scan</a>
    </div>
  </div>
</nav>`;
}

/* ──────────────────────────────────────────────────────────
   renderFooter — 4-column footer
   ────────────────────────────────────────────────────────── */
export function renderFooter(): string {
  return `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand-block">
        <a href="/" class="nav-brand" style="margin-bottom:0.5rem">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12.5" stroke="var(--accent)" stroke-width="2"/>
            <circle cx="14" cy="14" r="7" stroke="var(--accent)" stroke-width="1" opacity="0.4"/>
            <circle cx="14" cy="14" r="2" fill="var(--accent)"/>
          </svg>
          <div>
            <span class="nav-brand-text" style="font-size:1rem">Trust Radar</span>
          </div>
        </a>
        <p>AI-powered brand threat intelligence platform by LRX Enterprise Inc. Continuous monitoring for impersonation, phishing, and social media abuse.</p>
        <p style="margin-top:1rem;font-size:0.82rem;color:var(--text-tertiary)">
          <a href="mailto:hello@trustradar.ca" style="color:var(--text-tertiary);transition:color 0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-tertiary)'">hello@trustradar.ca</a>
        </p>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Product</div>
        <ul>
          <li><a href="/platform">Platform</a></li>
          <li><a href="/pricing">Pricing</a></li>
          <li><a href="/scan">Free Scan</a></li>
          <li><a href="#">Changelog</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Resources</div>
        <ul>
          <li><a href="/blog">Blog</a></li>
          <li><a href="#">Documentation</a></li>
          <li><a href="#">API Reference</a></li>
          <li><a href="/security">Security</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Company</div>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="#">Careers</a></li>
          <li><a href="#">Partners</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Legal</div>
        <ul>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/terms">Terms</a></li>
          <li><a href="#">DPA</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-legal">&copy; 2026 LRX Enterprises Inc. All rights reserved. | Built on Cloudflare Workers</span>
      <div class="footer-badges">
        <span class="footer-badge-item"><span class="fb-dot" style="background:#f6821f"></span> Cloudflare</span>
        <span class="footer-badge-item"><span class="fb-dot" style="background:var(--accent)"></span> Anthropic</span>
        <span class="footer-badge-item"><span class="fb-dot" style="background:var(--green)"></span> SOC 2 (Planned)</span>
      </div>
    </div>
  </div>
</footer>`;
}

/* ──────────────────────────────────────────────────────────
   renderHead — <head> content with full design-system CSS
   ────────────────────────────────────────────────────────── */
export function renderHead(title: string, description: string): string {
  return `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
/* ═══════════════════════════════════════════════════════════
   TRUST RADAR — DESIGN SYSTEM
   LRX Enterprise Inc.
   ═══════════════════════════════════════════════════════════ */

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

/* ── THEME TOKENS ── */
:root {
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* Accent stays consistent across themes */
  --accent: #0891b2;
  --accent-hover: #0e7490;
  --accent-light: #06b6d4;
  --accent-ultra: #22d3ee;
  --accent-bg: rgba(8, 145, 178, 0.08);
  --accent-bg-strong: rgba(8, 145, 178, 0.15);
  --coral: #f97316;
  --coral-bg: rgba(249, 115, 22, 0.08);
  --green: #10b981;
  --green-bg: rgba(16, 185, 129, 0.08);
  --red: #ef4444;
  --red-bg: rgba(239, 68, 68, 0.08);
  --amber: #f59e0b;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}

[data-theme="light"] {
  --bg-primary: #fafbfc;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f1f5f9;
  --bg-code: #f8fafc;
  --bg-elevated: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
  --text-inverse: #ffffff;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.08);
  --shadow-glow: 0 0 40px rgba(8,145,178,0.12);
  --gradient-hero: linear-gradient(135deg, #fafbfc 0%, #f0f9ff 50%, #f0fdf4 100%);
  --illustration-fill: #0f172a;
  --illustration-stroke: #0891b2;
  --nav-bg: rgba(250,251,252,0.85);
}

[data-theme="dark"] {
  --bg-primary: #0b1120;
  --bg-secondary: #111827;
  --bg-tertiary: #1a2332;
  --bg-code: #162036;
  --bg-elevated: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --text-inverse: #0f172a;
  --border: #1e293b;
  --border-strong: #334155;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.3);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.4);
  --shadow-glow: 0 0 60px rgba(8,145,178,0.15);
  --gradient-hero: linear-gradient(135deg, #0b1120 0%, #0c1a2e 50%, #0b1120 100%);
  --illustration-fill: #f1f5f9;
  --illustration-stroke: #22d3ee;
  --nav-bg: rgba(11,17,32,0.85);
}

html { scroll-behavior: smooth; }

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body);
  line-height: 1.65;
  transition: background 0.4s, color 0.3s;
  overflow-x: hidden;
}

a { color: inherit; text-decoration: none; }
img { max-width: 100%; }

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* ── NAV ── */
.nav {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
  background: var(--nav-bg);
  backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid var(--border);
  transition: background 0.3s, border 0.3s;
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.nav-brand svg { transition: transform 0.3s; }
.nav-brand:hover svg { transform: rotate(15deg); }

.nav-brand-text {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
}

.nav-brand-sub {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-tertiary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: block;
  margin-top: -2px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  list-style: none;
}

.nav-links a {
  padding: 0.5rem 0.85rem;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.nav-links a:hover {
  color: var(--text-primary);
  background: var(--accent-bg);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.theme-toggle {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.theme-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── BUTTONS ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.4rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 0.88rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn-primary {
  background: var(--accent);
  color: white;
  position: relative;
  overflow: hidden;
}
.btn-primary::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  transition: none;
}
.btn-primary:hover::after {
  animation: shimmer 0.6s forwards;
}
@keyframes shimmer {
  to { left: 120%; }
}

.btn-primary:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 20px rgba(8,145,178,0.35);
  transform: translateY(-1px);
}

.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 1.5px solid var(--border-strong);
}

.btn-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-ghost {
  background: transparent;
  color: var(--accent);
  padding: 0.5rem 0.75rem;
}

.btn-ghost:hover { background: var(--accent-bg); }

.btn-lg {
  padding: 0.85rem 2rem;
  font-size: 0.95rem;
}

/* ── SECTIONS ── */
section {
  padding: 7rem 0;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.section-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
  max-width: 640px;
}

.section-desc {
  font-size: 1.05rem;
  color: var(--text-secondary);
  line-height: 1.75;
  max-width: 560px;
  margin-bottom: 3.5rem;
}

/* ── DIVIDERS ── */
.tr-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--border) 20%, var(--accent) 50%, var(--border) 80%, transparent 100%);
  border: none;
  margin: 0;
}
.tr-divider-animated {
  height: 1px;
  border: none;
  background: linear-gradient(90deg, transparent, var(--border), var(--accent), var(--border), transparent);
  background-size: 200% 100%;
  animation: dividerSlide 3s linear infinite;
}
@keyframes dividerSlide {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

/* ── PLATFORM CARDS ── */
.platform-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.platform-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  opacity: 0;
  transition: opacity 0.3s;
}

.platform-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
  transform: translateY(-2px);
}

.platform-card:hover::before { opacity: 1; }
.platform-card:nth-child(1)::before { background: var(--accent); }
.platform-card:nth-child(2)::before { background: var(--coral); }
.platform-card:nth-child(3)::before { background: var(--green); }

.pc-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
}

.pc-icon-teal { background: var(--accent-bg); color: var(--accent); }
.pc-icon-coral { background: var(--coral-bg); color: var(--coral); }
.pc-icon-green { background: var(--green-bg); color: var(--green); }

.platform-card h3 {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.platform-card p {
  font-size: 0.92rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 1.25rem;
}

.pc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pc-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 500;
  padding: 0.25rem 0.6rem;
  border-radius: 100px;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  border: 1px solid var(--border);
  transition: all 0.3s;
}

/* ── FOOTER ── */
.footer {
  padding: 5rem 0 2.5rem;
  border-top: 1px solid var(--border);
  transition: border 0.3s;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 4rem;
}

.footer-brand-block p {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-top: 1rem;
  max-width: 280px;
}

.footer-col-title {
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.footer-col ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.footer-col a {
  font-size: 0.85rem;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.footer-col a:hover { color: var(--accent); }

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-legal {
  font-size: 0.78rem;
  color: var(--text-tertiary);
}

.footer-badges {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.footer-badge-item {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.fb-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* ── ANIMATIONS ── */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(8,145,178,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(8,145,178,0); }
}

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .footer-grid { grid-template-columns: 1fr 1fr; gap: 2rem; }
}

@media (max-width: 768px) {
  section { padding: 4.5rem 0; }
  .nav-links { display: none; }
  .footer-grid { grid-template-columns: 1fr; }
}
</style>`;
}

/* ──────────────────────────────────────────────────────────
   wrapPage — full HTML document wrapper
   ────────────────────────────────────────────────────────── */
export function wrapPage(title: string, description: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
${renderHead(title, description)}
</head>
<body>

${renderNav()}

${content}

${renderFooter()}

<script>
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  document.getElementById('theme-icon').textContent = next === 'light' ? '\\u2600' : '\\u263E';
  localStorage.setItem('tr-theme', next);
}

// Load saved theme
const saved = localStorage.getItem('tr-theme');
if (saved) {
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-icon').textContent = saved === 'light' ? '\\u2600' : '\\u263E';
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Intersection observer for scroll animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.platform-card, .feature-row, .price-card, .fact-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease, background 0.3s, border 0.3s, box-shadow 0.3s';
  observer.observe(el);
});
</script>

</body>
</html>`;
}

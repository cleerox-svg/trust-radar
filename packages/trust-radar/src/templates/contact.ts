/**
 * Trust Radar — Contact Page
 *
 * Two-column layout with contact form (left) and info sidebar (right).
 * Form submits to POST /api/contact via fetch with JSON body.
 */

export function renderContactPage(): string {
  return `
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contact Us — Trust Radar</title>
<meta name="description" content="Get in touch with the Trust Radar team. Reach out for product demos, enterprise pricing, partnerships, security reports, or general inquiries.">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
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

/* ── CONTACT PAGE ── */
.contact-hero {
  padding-top: 10rem;
  padding-bottom: 4rem;
  text-align: center;
}

.contact-hero .section-title {
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.contact-hero .section-desc {
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 0;
}

.contact-grid {
  display: grid;
  grid-template-columns: 60% 40%;
  gap: 3rem;
  margin-bottom: 5rem;
}

.contact-form-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2.5rem;
  box-shadow: var(--shadow-sm);
}

.contact-form-card h3 {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.contact-form-card .form-subtitle {
  font-size: 0.92rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--text-primary);
}

.form-group label .required {
  color: var(--red);
  margin-left: 2px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.7rem 1rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  -webkit-appearance: none;
  appearance: none;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-tertiary);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.form-group select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8.825L.35 3.175l.7-.7L6 7.425l4.95-4.95.7.7z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  padding-right: 2.5rem;
  cursor: pointer;
}

.form-group textarea {
  resize: vertical;
  min-height: 60px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-submit-btn {
  width: 100%;
  padding: 0.85rem 2rem;
  margin-top: 0.5rem;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 600;
  color: white;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.form-submit-btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  transition: none;
}

.form-submit-btn:hover::after {
  animation: shimmer 0.6s forwards;
}

.form-submit-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 20px rgba(8,145,178,0.35);
  transform: translateY(-1px);
}

.form-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.form-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  font-weight: 500;
  display: none;
}

.form-message.success {
  display: block;
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid var(--green);
}

.form-message.error {
  display: block;
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid var(--red);
}

/* ── SIDEBAR ── */
.contact-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sidebar-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: var(--shadow-sm);
}

.sidebar-card h3 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
}

.sidebar-email-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-email-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.sidebar-email-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sidebar-email-link {
  font-size: 0.9rem;
  color: var(--accent);
  transition: color 0.2s;
}

.sidebar-email-link:hover {
  color: var(--accent-hover);
}

.sidebar-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-info-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.sidebar-info-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--accent-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.sidebar-info-text {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.sidebar-info-text strong {
  display: block;
  color: var(--text-primary);
  font-weight: 600;
  margin-bottom: 0.1rem;
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

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .contact-grid { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr 1fr; gap: 2rem; }
}

@media (max-width: 768px) {
  section { padding: 4.5rem 0; }
  .nav-links { display: none; }
  .footer-grid { grid-template-columns: 1fr; }
  .form-row { grid-template-columns: 1fr; }
  .contact-hero { padding-top: 7rem; padding-bottom: 2rem; }
  .contact-form-card { padding: 1.5rem; }
  .sidebar-card { padding: 1.5rem; }
}
</style>
</head>
<body>

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
</nav>

<section class="contact-hero">
  <div class="container">
    <div class="section-label">Contact Us</div>
    <h1 class="section-title">Get in Touch</h1>
    <p class="section-desc">Have questions about Trust Radar? We'd love to hear from you. Fill out the form below and our team will get back to you shortly.</p>
  </div>
</section>

<section style="padding-top:0;">
  <div class="container">
    <div class="contact-grid">

      <!-- LEFT: Contact Form (60%) -->
      <div class="contact-form-card">
        <h3>Send us a message</h3>
        <p class="form-subtitle">Fill out the form and we'll be in touch as soon as possible.</p>

        <form id="contactForm" novalidate>
          <div class="form-row">
            <div class="form-group">
              <label for="name">Name <span class="required">*</span></label>
              <input type="text" id="name" name="name" placeholder="Your full name" required>
            </div>
            <div class="form-group">
              <label for="email">Work Email <span class="required">*</span></label>
              <input type="email" id="email" name="email" placeholder="you@company.com" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="company">Company</label>
              <input type="text" id="company" name="company" placeholder="Your company name">
            </div>
            <div class="form-group">
              <label for="interest">Interest</label>
              <select id="interest" name="interest">
                <option value="general">General Inquiry</option>
                <option value="demo">Product Demo</option>
                <option value="enterprise">Enterprise Pricing</option>
                <option value="partnership">Partnership</option>
                <option value="security">Security Report</option>
                <option value="careers">Careers</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="message">Message</label>
            <textarea id="message" name="message" rows="5" placeholder="Tell us how we can help..."></textarea>
          </div>

          <button type="submit" class="form-submit-btn" id="submitBtn">Send Message</button>
        </form>

        <div class="form-message" id="formMessage"></div>
      </div>

      <!-- RIGHT: Contact Info Sidebar (40%) -->
      <div class="contact-sidebar">
        <div class="sidebar-card">
          <h3>Contact Information</h3>
          <ul class="sidebar-email-list">
            <li class="sidebar-email-item">
              <span class="sidebar-email-label">Email</span>
              <a href="mailto:hello@trustradar.ca" class="sidebar-email-link">hello@trustradar.ca</a>
            </li>
            <li class="sidebar-email-item">
              <span class="sidebar-email-label">Security</span>
              <a href="mailto:security@trustradar.ca" class="sidebar-email-link">security@trustradar.ca</a>
            </li>
            <li class="sidebar-email-item">
              <span class="sidebar-email-label">Sales</span>
              <a href="mailto:sales@trustradar.ca" class="sidebar-email-link">sales@trustradar.ca</a>
            </li>
            <li class="sidebar-email-item">
              <span class="sidebar-email-label">Careers</span>
              <a href="mailto:careers@trustradar.ca" class="sidebar-email-link">careers@trustradar.ca</a>
            </li>
          </ul>
        </div>

        <div class="sidebar-card">
          <h3>Quick Info</h3>
          <div class="sidebar-info">
            <div class="sidebar-info-item">
              <div class="sidebar-info-icon">\u23F1</div>
              <div class="sidebar-info-text">
                <strong>Response Time</strong>
                We typically respond within 24 hours.
              </div>
            </div>
            <div class="sidebar-info-item">
              <div class="sidebar-info-icon">\uD83C\uDDE8\uD83C\uDDE6</div>
              <div class="sidebar-info-text">
                <strong>Location</strong>
                Based in Canada
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</section>

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
</footer>

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

// Contact form submission
document.getElementById('contactForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('formMessage');
  const form = this;

  // Reset message
  msg.className = 'form-message';
  msg.style.display = 'none';

  // Basic validation
  const name = form.name.value.trim();
  const email = form.email.value.trim();

  if (!name || !email) {
    msg.textContent = 'Please fill in all required fields.';
    msg.className = 'form-message error';
    msg.style.display = 'block';
    return;
  }

  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.className = 'form-message error';
    msg.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        company: form.company.value.trim(),
        interest: form.interest.value,
        message: form.message.value.trim()
      })
    });

    if (res.ok) {
      msg.textContent = 'Thank you! Your message has been sent. We\\'ll get back to you soon.';
      msg.className = 'form-message success';
      msg.style.display = 'block';
      form.reset();
    } else {
      const data = await res.json().catch(() => ({}));
      msg.textContent = data.error || 'Something went wrong. Please try again later.';
      msg.className = 'form-message error';
      msg.style.display = 'block';
    }
  } catch (err) {
    msg.textContent = 'Network error. Please check your connection and try again.';
    msg.className = 'form-message error';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }
});
</script>

</body>
</html>`;
}

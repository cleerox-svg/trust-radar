/**
 * Trust Radar — Corporate Landing Page
 * Full single-page corporate site served at /
 */

import { generateSpiderTraps } from "../seeders/spider-injector";

export function renderLandingPage(): string {
  return `
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trust Radar — AI-Powered Brand Threat Intelligence | LRX Enterprises</title>
<meta name="description" content="Trust Radar continuously monitors for brand impersonation, phishing, email vulnerabilities, and social media abuse. AI-powered threat intelligence by LRX Enterprises Inc.">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
/* ═══════════════════════════════════════════════════════════
   TRUST RADAR — CORPORATE SITE
   LRX Enterprises Inc.
   ═══════════════════════════════════════════════════════════ */

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

/* ── THEME TOKENS ── */
:root {
  --font-display: 'Plus Jakarta Sans', sans-serif;
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

/* ── HERO ── */
.hero {
  padding: 10rem 0 6rem;
  background: var(--gradient-hero);
  position: relative;
  overflow: hidden;
}

.hero-grid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  background-image:
    radial-gradient(circle at 20% 20%, rgba(8,145,178,0.12) 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(16,185,129,0.08) 0%, transparent 40%),
    radial-gradient(circle at 60% 30%, rgba(249,115,22,0.04) 0%, transparent 35%),
    radial-gradient(circle at 40% 70%, rgba(8,145,178,0.06) 0%, transparent 45%);
}
.hero-grid-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 50% 50%, transparent 0%, var(--bg-primary) 70%);
  opacity: 0.4;
}

.hero-inner {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.hero-content { max-width: 560px; }

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  background: var(--accent-bg);
  border: 1px solid rgba(8,145,178,0.2);
  border-radius: 100px;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--accent);
  letter-spacing: 0.03em;
  margin-bottom: 1.75rem;
  animation: fadeIn 0.6s 0.1s both;
}

.hero-badge-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(8,145,178,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(8,145,178,0); }
}

.hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 4.5vw, 3.75rem);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.035em;
  margin-bottom: 1.5rem;
  animation: fadeIn 0.6s 0.2s both;
}

.hero h1 em {
  font-style: normal;
  color: var(--accent);
  position: relative;
}

.hero h1 em::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--accent);
  opacity: 0.3;
  border-radius: 2px;
}

.hero-desc {
  font-size: 1.12rem;
  color: var(--text-secondary);
  line-height: 1.75;
  margin-bottom: 2.5rem;
  max-width: 480px;
  animation: fadeIn 0.6s 0.35s both;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  animation: fadeIn 0.6s 0.5s both;
}

.hero-meta {
  display: flex;
  gap: 2rem;
  margin-top: 3rem;
  animation: fadeIn 0.6s 0.65s both;
}

.hero-meta-item {
  display: flex;
  flex-direction: column;
}

.hero-meta-num {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
}

.hero-meta-label {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  margin-top: 0.15rem;
}

/* ── HERO ILLUSTRATION ── */
.hero-illustration {
  position: relative;
  animation: fadeIn 0.8s 0.3s both;
}

.hero-visual {
  width: 100%;
  aspect-ratio: 1;
  position: relative;
}

.hero-radar {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-radar svg { width: 100%; height: 100%; }

/* ── OBSERVATORY WATERMARK ── */
.observatory-watermark {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.observatory-inner {
  width: 90%;
  max-width: 1100px;
  opacity: 0;
  filter: blur(0.5px);
  transform: perspective(1200px) rotateX(8deg) rotateY(-3deg) scale(0.92);
  animation: observatoryFadeIn 2s 0.5s forwards;
}
[data-theme="light"] .observatory-inner { opacity: 0; }
[data-theme="dark"] .observatory-inner { opacity: 0; }
@keyframes observatoryFadeIn {
  to { opacity: 1; }
}
[data-theme="light"] .observatory-inner { --obs-opacity: 0.10; }
[data-theme="dark"] .observatory-inner { --obs-opacity: 0.14; }
.obs-dashboard {
  opacity: var(--obs-opacity, 0.06);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 200px;
  gap: 1rem;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-primary);
}
.obs-stat-card {
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 1rem;
  text-align: center;
}
.obs-stat-num { font-size: 1.5rem; font-weight: 700; font-family: var(--font-display); }
.obs-stat-label { color: var(--text-tertiary); margin-top: 0.25rem; }
.obs-chart {
  grid-column: 1 / 4;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 1rem;
  height: 100px;
}
.obs-chart-label { font-weight: 600; margin-bottom: 0.5rem; }
.obs-chart-bars { display: flex; align-items: flex-end; gap: 4px; height: 60px; }
.obs-bar { background: var(--accent); border-radius: 2px 2px 0 0; flex: 1; min-width: 8px; }
.obs-gauge-wrap {
  grid-row: 1 / 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 1rem;
}
.obs-gauge-score { font-size: 2rem; font-weight: 800; font-family: var(--font-display); color: var(--accent); }
.obs-gauge-grade { font-size: 0.8rem; color: var(--text-tertiary); }

.radar-ring-light { fill: none; stroke: var(--border); stroke-width: 1; }
.radar-ring-accent { fill: none; stroke: var(--accent); stroke-width: 1; opacity: 0.2; }

.sweep-group {
  transform-origin: 250px 250px;
  animation: radarSweep 5s linear infinite;
}

@keyframes radarSweep {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Floating threat cards around the radar */
.float-card {
  position: absolute;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.85rem;
  box-shadow: var(--shadow-md), 0 0 20px rgba(8,145,178,0.08);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  animation: floatIn 0.8s both;
  transition: all 0.3s;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}
.float-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), 0 0 25px rgba(8,145,178,0.15);
}

.float-card .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.float-card .fc-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.float-card .fc-value {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
}

.fc-1 { top: 8%; right: -5%; animation-delay: 0.8s; }
.fc-2 { top: 35%; left: -12%; animation-delay: 1.1s; }
.fc-3 { bottom: 20%; right: -8%; animation-delay: 1.4s; }
.fc-4 { bottom: 5%; left: 5%; animation-delay: 1.7s; }

@keyframes floatIn {
  from { opacity: 0; transform: translateY(12px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── LOGOS / TRUST BAR ── */
.trust-bar {
  padding: 4rem 0;
  border-bottom: 1px solid var(--border);
  transition: border 0.3s;
}

.trust-bar-inner {
  text-align: center;
}

.trust-bar-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-tertiary);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 2rem;
}

.trust-bar-feeds {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 3rem;
  flex-wrap: wrap;
}

.feed-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-tertiary);
  transition: color 0.2s;
}

.feed-badge:hover { color: var(--text-secondary); }

.feed-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px rgba(16,185,129,0.4);
}

/* ── SECTION STRUCTURE ── */
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

/* ── ANIMATED GRADIENT DIVIDER ── */
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

/* ── PLATFORM SECTION ── */
.platform-section {
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  transition: background 0.3s, border 0.3s;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

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
  box-shadow: 0 0 30px rgba(8,145,178,0.15), var(--shadow-lg);
  transform: translateY(-3px);
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

/* ── FEATURE ROW ── */
.feature-section { overflow: hidden; }

.feature-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: center;
  margin-bottom: 8rem;
}

.feature-row:last-child { margin-bottom: 0; }
.feature-row.reversed { direction: rtl; }
.feature-row.reversed > * { direction: ltr; }

.feature-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}

.feature-label-teal { color: var(--accent); }
.feature-label-coral { color: var(--coral); }
.feature-label-green { color: var(--green); }

.feature-text h3 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: 1rem;
}

.feature-text p {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.8;
  margin-bottom: 1.75rem;
}

.feature-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.feature-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  font-size: 0.92rem;
  color: var(--text-secondary);
}

.feature-list-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 0.65rem;
  font-weight: 700;
}

.fli-teal { background: var(--accent-bg); color: var(--accent); }
.fli-coral { background: var(--coral-bg); color: var(--coral); }

/* ── FEATURE VISUALS ── */
.feature-visual {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 2rem;
  box-shadow: var(--shadow-md);
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.fv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.25rem;
}

.fv-title {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.fv-badge {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 100px;
}

.fv-badge-live {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid rgba(16,185,129,0.2);
}

/* Email posture bars */
.posture-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}

.posture-row:last-child { border-bottom: none; }

.posture-label {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  width: 52px;
  color: var(--text-primary);
}

.posture-bar-track {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.posture-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 1.2s ease-out;
}

.posture-bar-green { background: linear-gradient(90deg, var(--green), #34d399); }
.posture-bar-amber { background: linear-gradient(90deg, var(--amber), #fbbf24); }
.posture-bar-teal { background: linear-gradient(90deg, var(--accent), var(--accent-light)); }

.posture-status {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  width: 75px;
  text-align: right;
}

.ps-pass { color: var(--green); }
.ps-warn { color: var(--amber); }
.ps-info { color: var(--accent); }

.posture-grade {
  text-align: center;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}

.grade-letter {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 800;
  color: var(--green);
  letter-spacing: -0.02em;
}

.grade-label {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  margin-top: 0.15rem;
}

/* Social grid */
.social-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.social-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1rem;
  text-align: center;
  transition: all 0.2s;
}

.social-item:hover { border-color: var(--accent); }

.si-icon {
  font-size: 1.35rem;
  display: block;
  margin-bottom: 0.4rem;
}

.si-name {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-tertiary);
  display: block;
  margin-bottom: 0.5rem;
}

.si-status {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 100px;
  display: inline-block;
}

.sis-ok { background: var(--green-bg); color: var(--green); }
.sis-alert { background: var(--red-bg); color: var(--red); }
.sis-warn { background: var(--coral-bg); color: var(--coral); }

/* AI narrative block */
.narrative-block {
  border-left: 3px solid var(--accent);
  padding: 1.25rem 1.25rem 1.25rem 1.5rem;
  background: var(--accent-bg);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  margin-top: 1rem;
}

.narrative-agent {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.04em;
  margin-bottom: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.narrative-agent::before {
  content: '';
  width: 7px;
  height: 7px;
  background: var(--accent);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.narrative-text {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.75;
}

/* ── ABOUT / COMPANY ── */
.about-section {
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  transition: all 0.3s;
}

.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: start;
}

.about-text h3 {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2.5rem;
}

.about-text h3:first-of-type { margin-top: 0; }

.about-text p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.8;
}

.company-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-top: 2rem;
}

.fact-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  transition: all 0.3s;
}

.fact-card:hover { border-color: var(--accent); }

.fact-num {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--accent);
}

.fact-label {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

/* ── PRICING ── */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.price-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  transition: all 0.3s;
  position: relative;
}

.price-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.price-card.popular {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}

.price-popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: white;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.25rem 0.85rem;
  border-radius: 100px;
  letter-spacing: 0.06em;
}

.price-tier {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.price-amount {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 0.25rem;
}

.price-amount span {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-tertiary);
}

.price-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 1.75rem;
  min-height: 2.5rem;
}

.price-divider {
  height: 1px;
  background: var(--border);
  margin-bottom: 1.5rem;
}

.price-features {
  list-style: none;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 2rem;
}

.price-features li {
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  line-height: 1.5;
}

.price-check {
  color: var(--accent);
  font-weight: 700;
  font-size: 0.85rem;
  margin-top: 1px;
  flex-shrink: 0;
}

.price-btn {
  width: 100%;
  text-align: center;
  justify-content: center;
}

/* ── CTA SECTION ── */
.cta-section {
  text-align: center;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  transition: all 0.3s;
}

.cta-section .section-title {
  margin: 0 auto 1rem;
  text-align: center;
}

.cta-section .section-desc {
  margin: 0 auto 2.5rem;
  text-align: center;
  max-width: 500px;
}

/* ── SCAN PREVIEW ── */
.scan-preview {
  max-width: 720px;
  margin: 3rem auto 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  transition: all 0.3s;
}

.scan-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.scan-bar-dots {
  display: flex;
  gap: 6px;
}

.scan-bar-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border-strong);
}

.scan-bar-url {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.scan-body {
  padding: 1.5rem;
}

.scan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.scan-domain {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-tertiary);
}

.scan-score-area {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.scan-score {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 800;
}

.scan-risk {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.2rem 0.65rem;
  border-radius: 100px;
}

.risk-moderate { background: var(--coral-bg); color: var(--coral); border: 1px solid rgba(249,115,22,0.2); }

.scan-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.sc-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.85rem;
}

.sc-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.sc-card-title {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sc-grade {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
}

.sc-grade-b { background: var(--green-bg); color: var(--green); }
.sc-grade-c { background: var(--coral-bg); color: var(--coral); }

.sc-items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sc-items li {
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sci-icon { font-size: 0.7rem; }
.sci-pass { color: var(--green); }
.sci-warn { color: var(--amber); }
.sci-fail { color: var(--red); }

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

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .hero-inner { grid-template-columns: 1fr; gap: 3rem; }
  .hero-illustration { max-width: 480px; margin: 0 auto; }
  .feature-row, .feature-row.reversed { grid-template-columns: 1fr; gap: 2.5rem; direction: ltr; }
  .about-grid { grid-template-columns: 1fr; }
  .pricing-grid { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr 1fr; gap: 2rem; }
}

@media (max-width: 768px) {
  section { padding: 4rem 0; }
  .hero-inner { text-align: center; }
  .hero-content { max-width: 100%; }
  .hero-illustration { display: none; }
  .hero-desc { margin-left: auto; margin-right: auto; }
  .hero-actions { justify-content: center; }
  .hero-meta { flex-direction: column; gap: 1rem; justify-content: center; align-items: center; }
  .hero h1 { font-size: clamp(2rem, 6vw, 2.75rem); }
  .platform-grid { grid-template-columns: 1fr; }
  .feature-row { grid-template-columns: 1fr; gap: 2rem; }
  .feature-row.reversed { direction: ltr; }
  .pricing-grid { grid-template-columns: 1fr; max-width: 420px; }
  .about-grid { grid-template-columns: 1fr; }
  .nav-links { display: none !important; }
  .hero { padding: 7rem 0 4rem; }
  .social-grid { grid-template-columns: repeat(2, 1fr); }
  .scan-cards { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
  .company-facts { grid-template-columns: 1fr 1fr; }
  .trust-bar-feeds { gap: 1.5rem; }
}

@media (max-width: 480px) {
  .company-facts { grid-template-columns: 1fr; }
  .hero-meta { flex-direction: column; gap: 1rem; align-items: center; }
}

/* ── MOBILE MENU ── */
.nav-hamburger {
  display: none;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.nav-hamburger:hover { border-color: var(--accent); color: var(--accent); }

.mobile-menu {
  display: none;
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 1rem 2rem;
  z-index: 999;
  flex-direction: column;
  gap: 0.25rem;
  box-shadow: var(--shadow-lg);
}
.mobile-menu.open { display: flex; }
.mobile-menu a {
  display: block;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}
.mobile-menu a:hover { background: var(--accent-bg); color: var(--accent); }

@media (max-width: 768px) {
  .nav-hamburger { display: flex; }
  .nav-links { display: none !important; }
  .nav-right .btn { display: none; }
  .nav-right .theme-toggle { order: 2; }
  .nav-right .nav-hamburger { order: 1; }
}
</style>
</head>
<body>

<!-- ═══ NAV ═══ -->
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
        <span class="nav-brand-sub">by LRX Enterprises</span>
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
      <button class="nav-hamburger" onclick="toggleMobileMenu()" aria-label="Toggle menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
        <span id="theme-icon">☀</span>
      </button>
      <a href="/login" class="btn btn-outline" style="font-size:0.82rem;padding:0.45rem 1rem;">Login</a>
      <a href="/scan" class="btn btn-primary" style="font-size:0.82rem;padding:0.45rem 1rem;">Free Scan</a>
    </div>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="/platform">Platform</a>
  <a href="/pricing">Pricing</a>
  <a href="/about">About</a>
  <a href="/security">Security</a>
  <a href="/blog">Blog</a>
  <a href="/contact">Contact</a>
  <a href="/login">Login</a>
  <a href="/scan">Free Scan</a>
</div>

<!-- ═══ HERO ═══ -->
<section class="hero">
  <div class="hero-grid-bg"></div>
  <!-- Observatory Watermark — ghosted dashboard behind hero -->
  <div class="observatory-watermark">
    <div class="observatory-inner">
      <div class="obs-dashboard">
        <div class="obs-stat-card"><div class="obs-stat-num" style="color:var(--red)">12</div><div class="obs-stat-label">Active Threats</div></div>
        <div class="obs-stat-card"><div class="obs-stat-num" style="color:var(--green)">B+</div><div class="obs-stat-label">Email Grade</div></div>
        <div class="obs-stat-card"><div class="obs-stat-num" style="color:var(--amber)">3</div><div class="obs-stat-label">Social Alerts</div></div>
        <div class="obs-gauge-wrap"><svg viewBox="0 0 120 120" width="80" height="80"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8"/><circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="8" stroke-dasharray="235 327" stroke-linecap="round" transform="rotate(-90 60 60)"/></svg><div class="obs-gauge-score">72</div><div class="obs-gauge-grade">Brand Score</div></div>
        <div class="obs-chart"><div class="obs-chart-label">7-Day Threat Trend</div><div class="obs-chart-bars"><div class="obs-bar" style="height:35%"></div><div class="obs-bar" style="height:50%"></div><div class="obs-bar" style="height:40%"></div><div class="obs-bar" style="height:70%"></div><div class="obs-bar" style="height:55%"></div><div class="obs-bar" style="height:80%"></div><div class="obs-bar" style="height:65%"></div></div></div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="hero-inner">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="hero-badge-dot"></span>
          AI-Powered Brand Threat Intelligence
        </div>
        <h1>See your brand the way <em>attackers</em> do.</h1>
        <p class="hero-desc">Trust Radar continuously monitors for brand impersonation, phishing infrastructure, email security gaps, and social media abuse — delivering AI-powered intelligence, not alert noise.</p>
        <div class="hero-actions">
          <a href="/scan" class="btn btn-primary btn-lg">Scan Your Brand — Free</a>
          <a href="#platform" class="btn btn-outline btn-lg">Explore Platform</a>
        </div>
        <div class="hero-meta">
          <div class="hero-meta-item">
            <span class="hero-meta-num">24/7</span>
            <span class="hero-meta-label">Continuous monitoring</span>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-num">6+</span>
            <span class="hero-meta-label">Social platforms</span>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-num">&lt;5min</span>
            <span class="hero-meta-label">Threat detection</span>
          </div>
        </div>
      </div>

      <div class="hero-illustration">
        <div class="hero-visual">
          <div class="hero-radar">
            <svg viewBox="0 0 500 500" fill="none">
              <circle class="radar-ring-light" cx="250" cy="250" r="60"/>
              <circle class="radar-ring-light" cx="250" cy="250" r="120"/>
              <circle class="radar-ring-accent" cx="250" cy="250" r="180"/>
              <circle class="radar-ring-light" cx="250" cy="250" r="220"/>
              <line x1="250" y1="30" x2="250" y2="470" stroke="var(--border)" stroke-width="0.5"/>
              <line x1="30" y1="250" x2="470" y2="250" stroke="var(--border)" stroke-width="0.5"/>
              <g class="sweep-group">
                <defs>
                  <linearGradient id="sg" gradientTransform="rotate(80)">
                    <stop offset="0%" stop-color="rgba(8,145,178,0)"/>
                    <stop offset="100%" stop-color="rgba(8,145,178,0.18)"/>
                  </linearGradient>
                </defs>
                <path d="M250 250 L250 30 A220 220 0 0 1 405 105 Z" fill="url(#sg)"/>
                <line x1="250" y1="250" x2="250" y2="30" stroke="var(--accent)" stroke-width="1.5" opacity="0.5"/>
              </g>
              <!-- Threat nodes -->
              <circle cx="310" cy="140" r="6" fill="var(--red)" opacity="0.7"><animate attributeName="opacity" values="0;0.7;0.4;0.7;0" dur="4s" repeatCount="indefinite"/></circle>
              <circle cx="165" cy="310" r="5" fill="var(--red)" opacity="0.5"><animate attributeName="opacity" values="0;0.5;0.3;0.5;0" dur="5s" begin="1s" repeatCount="indefinite"/></circle>
              <circle cx="380" cy="280" r="4" fill="var(--coral)" opacity="0.6"><animate attributeName="opacity" values="0;0.6;0.3;0.6;0" dur="4.5s" begin="2s" repeatCount="indefinite"/></circle>
              <!-- Safe nodes -->
              <circle cx="280" cy="210" r="5" fill="var(--green)" opacity="0.5"><animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite"/></circle>
              <circle cx="200" cy="190" r="4" fill="var(--green)" opacity="0.4"><animate attributeName="opacity" values="0.1;0.4;0.1" dur="4s" begin="0.5s" repeatCount="indefinite"/></circle>
              <!-- Connection lines -->
              <line x1="310" y1="140" x2="380" y2="280" stroke="var(--red)" stroke-width="0.5" opacity="0.2" stroke-dasharray="4 4"/>
              <line x1="165" y1="310" x2="310" y2="140" stroke="var(--red)" stroke-width="0.5" opacity="0.15" stroke-dasharray="4 4"/>
            </svg>
          </div>
          <!-- Floating info cards -->
          <div class="float-card fc-1">
            <span class="dot" style="background:var(--red)"></span>
            <div>
              <span class="fc-label">Phishing domain</span>
              <span class="fc-value" style="color:var(--red)">acme-login.net</span>
            </div>
          </div>
          <div class="float-card fc-2">
            <span class="dot" style="background:var(--green)"></span>
            <div>
              <span class="fc-label">Email posture</span>
              <span class="fc-value" style="color:var(--green)">Grade B+</span>
            </div>
          </div>
          <div class="float-card fc-3">
            <span class="dot" style="background:var(--coral)"></span>
            <div>
              <span class="fc-label">Instagram</span>
              <span class="fc-value" style="color:var(--coral)">Impersonation</span>
            </div>
          </div>
          <div class="float-card fc-4">
            <span class="dot" style="background:var(--accent)"></span>
            <div>
              <span class="fc-label">CT log alert</span>
              <span class="fc-value" style="color:var(--accent)">New cert issued</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══ TRUST BAR ═══ -->
<div class="trust-bar">
  <div class="container">
    <div class="trust-bar-inner">
      <div class="trust-bar-label">Integrated Threat Intelligence Feeds</div>
      <div class="trust-bar-feeds">
        <span class="feed-badge"><span class="feed-dot"></span> Phishing Database</span>
        <span class="feed-badge"><span class="feed-dot"></span> Malware URL Feed</span>
        <span class="feed-badge"><span class="feed-dot"></span> Phishing Intelligence</span>
        <span class="feed-badge"><span class="feed-dot"></span> Certificate Transparency</span>
        <span class="feed-badge"><span class="feed-dot"></span> HIBP</span>
        <span class="feed-badge"><span class="feed-dot"></span> Cloudflare Radar</span>
      </div>
    </div>
  </div>
</div>

<div class="tr-divider-animated"></div>

<!-- ═══ PLATFORM ═══ -->
<section class="platform-section" id="platform">
  <div class="container">
    <div class="section-label">The Platform</div>
    <div class="section-title">Outside-in brand protection, powered by AI agents.</div>
    <div class="section-desc">Trust Radar operates from the attacker's perspective — scanning the open internet, social platforms, DNS infrastructure, and threat feeds to build a complete picture of your brand's exposure.</div>

    <div class="platform-grid">
      <div class="platform-card">
        <div class="pc-icon pc-icon-teal">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <h3>Threat Detection</h3>
        <p>Continuous scanning across phishing databases, malware feeds, and certificate transparency logs. AI agents correlate signals into attack narratives — not just IOC lists.</p>
        <div class="pc-tags">
          <span class="pc-tag">Phishing Feeds</span>
          <span class="pc-tag">Malware URLs</span>
          <span class="pc-tag">Phishing Detection</span>
          <span class="pc-tag">CT Logs</span>
          <span class="pc-tag">HIBP</span>
        </div>
      </div>

      <div class="platform-card">
        <div class="pc-icon pc-icon-coral">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <h3>Email Security Posture</h3>
        <p>Deep outside-in analysis of SPF, DKIM, and DMARC configuration. Grade your email authentication posture and track improvements over time. No competitor in brand protection does this.</p>
        <div class="pc-tags">
          <span class="pc-tag">SPF Validation</span>
          <span class="pc-tag">Multi-Selector DKIM</span>
          <span class="pc-tag">DMARC Policy</span>
          <span class="pc-tag">MX Detection</span>
        </div>
      </div>

      <div class="platform-card">
        <div class="pc-icon pc-icon-green">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <h3>Social Brand Monitoring</h3>
        <p>Monitor your brand identity across Twitter/X, LinkedIn, Instagram, TikTok, GitHub, and YouTube. Detect impersonation accounts, handle squatting, and unauthorized brand usage.</p>
        <div class="pc-tags">
          <span class="pc-tag">Impersonation Detection</span>
          <span class="pc-tag">Handle Squatting</span>
          <span class="pc-tag">6+ Platforms</span>
          <span class="pc-tag">AI Scoring</span>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="tr-divider"></div>

<!-- ═══ FEATURES ═══ -->
<section class="feature-section" id="features">
  <div class="container">
    <div class="section-label">Deep Dive</div>
    <div class="section-title">Four layers of brand intelligence.</div>
    <div class="section-desc">Each capability feeds into the others. Email posture informs phishing risk. Social impersonation correlates with domain squatting. AI agents reason across all signals.</div>

    <!-- Feature 1: Email Security -->
    <div class="feature-row">
      <div class="feature-text">
        <div class="feature-label feature-label-teal">Email Security Posture Engine</div>
        <h3>Your email config is your front door.</h3>
        <p>Most brand impersonation starts with email. Trust Radar performs enterprise-grade outside-in analysis of your SPF, DKIM, and DMARC deployment — the controls that determine whether attackers can spoof your domain. We check multiple DKIM selectors across enterprise email security providers and grade your posture from A+ to F.</p>
        <ul class="feature-list">
          <li><span class="feature-list-icon fli-teal">✓</span> Multi-selector DKIM verification across 12+ enterprise selectors</li>
          <li><span class="feature-list-icon fli-teal">✓</span> MX provider detection with provider-aware scoring</li>
          <li><span class="feature-list-icon fli-teal">✓</span> Historical grade tracking — see improvement over time</li>
          <li><span class="feature-list-icon fli-teal">✓</span> Grade change alerts trigger Analyst agent investigation</li>
        </ul>
      </div>
      <div class="feature-visual">
        <div class="fv-header">
          <span class="fv-title">Email Posture Report</span>
          <span class="fv-badge fv-badge-live">● Live</span>
        </div>
        <div class="posture-row">
          <span class="posture-label">SPF</span>
          <div class="posture-bar-track"><div class="posture-bar posture-bar-green" style="width:95%"></div></div>
          <span class="posture-status ps-pass">✓ Strict</span>
        </div>
        <div class="posture-row">
          <span class="posture-label">DKIM</span>
          <div class="posture-bar-track"><div class="posture-bar posture-bar-amber" style="width:58%"></div></div>
          <span class="posture-status ps-warn">⚠ 2 of 5</span>
        </div>
        <div class="posture-row">
          <span class="posture-label">DMARC</span>
          <div class="posture-bar-track"><div class="posture-bar posture-bar-green" style="width:100%"></div></div>
          <span class="posture-status ps-pass">✓ Reject</span>
        </div>
        <div class="posture-row">
          <span class="posture-label">MX</span>
          <div class="posture-bar-track"><div class="posture-bar posture-bar-teal" style="width:88%"></div></div>
          <span class="posture-status ps-info">Google WS</span>
        </div>
        <div class="posture-grade">
          <div class="grade-letter">B+</div>
          <div class="grade-label">Overall Email Security Grade</div>
        </div>
      </div>
    </div>

    <!-- Feature 2: Social Monitoring -->
    <div class="feature-row reversed">
      <div class="feature-text">
        <div class="feature-label feature-label-coral">Social Brand Monitoring</div>
        <h3>Every platform. Every impersonator.</h3>
        <p>Attackers don't just register fake domains — they create fake social profiles using your brand name, executive names, and logos. Trust Radar monitors major platforms for handle squatting, impersonation accounts, and unauthorized brand usage, scoring each finding with AI-powered confidence assessment.</p>
        <ul class="feature-list">
          <li><span class="feature-list-icon fli-coral">✓</span> Handle reservation status — know which platforms have your name</li>
          <li><span class="feature-list-icon fli-coral">✓</span> Impersonation signal analysis (followers, age, content, verification)</li>
          <li><span class="feature-list-icon fli-coral">✓</span> Executive name monitoring for C-suite impersonation</li>
          <li><span class="feature-list-icon fli-coral">✓</span> Evidence collection for platform takedown requests</li>
        </ul>
      </div>
      <div class="feature-visual">
        <div class="fv-header">
          <span class="fv-title">Social Monitor — AcmeCorp</span>
          <span class="fv-badge fv-badge-live">● Live</span>
        </div>
        <div class="social-grid">
          <div class="social-item"><span class="si-icon">𝕏</span><span class="si-name">Twitter/X</span><span class="si-status sis-ok">SECURED</span></div>
          <div class="social-item"><span class="si-icon">◉</span><span class="si-name">Instagram</span><span class="si-status sis-alert">ALERT</span></div>
          <div class="social-item"><span class="si-icon">in</span><span class="si-name">LinkedIn</span><span class="si-status sis-ok">SECURED</span></div>
          <div class="social-item"><span class="si-icon">▶</span><span class="si-name">YouTube</span><span class="si-status sis-warn">UNCLAIMED</span></div>
          <div class="social-item"><span class="si-icon">♪</span><span class="si-name">TikTok</span><span class="si-status sis-alert">SUSPICIOUS</span></div>
          <div class="social-item"><span class="si-icon">⌥</span><span class="si-name">GitHub</span><span class="si-status sis-ok">SECURED</span></div>
        </div>
        <div class="narrative-block">
          <div class="narrative-agent">Analyst Agent — Social Assessment</div>
          <div class="narrative-text">Instagram handle @acmecorp is claimed by a 30-day-old account with 12 followers that uses your logo as its profile photo. Combined with bio text referencing "official customer support," this scores 0.89 impersonation confidence. Recommend immediate platform report.</div>
        </div>
      </div>
    </div>

    <!-- Feature 3: AI Narratives -->
    <div class="feature-row">
      <div class="feature-text">
        <div class="feature-label feature-label-green">AI Threat Narratives</div>
        <h3>Intelligence briefs, not alert fatigue.</h3>
        <p>Trust Radar's Analyst and Observer AI agents don't produce alert dumps. They correlate signals across email posture, domain impersonation, social monitoring, and threat feeds to construct coherent attack narratives with specific, actionable recommendations. Daily briefings from the Observer agent keep you informed without drowning you.</p>
        <ul class="feature-list">
          <li><span class="feature-list-icon fli-teal">✓</span> Multi-signal correlation into human-readable threat stories</li>
          <li><span class="feature-list-icon fli-teal">✓</span> Severity auto-escalation when signals compound</li>
          <li><span class="feature-list-icon fli-teal">✓</span> Daily Observer briefings with trend analysis</li>
          <li><span class="feature-list-icon fli-teal">✓</span> STIX 2.1 export for SIEM integration</li>
        </ul>
      </div>
      <div class="feature-visual">
        <div class="fv-header">
          <span class="fv-title">Threat Narrative — TN-2026-0342</span>
          <span class="fv-badge" style="background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.2)">HIGH</span>
        </div>
        <div class="narrative-block" style="margin-top:0;border-left-color:var(--red);">
          <div class="narrative-agent" style="color:var(--red)">Analyst Agent — Correlated Threat</div>
          <div class="narrative-text">Three domains registered within 48 hours share hosting infrastructure with a known phishing database entry targeting your brand. Two domains have MX records, suggesting email capability. Combined with your DKIM gap (2 of 5 selectors), spoofed emails from these domains have elevated deliverability risk.</div>
        </div>
        <div style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:0.4rem;">
          <span style="font-family:var(--font-mono);font-size:0.65rem;padding:0.2rem 0.6rem;border-radius:100px;background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.15);">3 LOOKALIKE DOMAINS</span>
          <span style="font-family:var(--font-mono);font-size:0.65rem;padding:0.2rem 0.6rem;border-radius:100px;background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.15);">PHISHING DB MATCH</span>
          <span style="font-family:var(--font-mono);font-size:0.65rem;padding:0.2rem 0.6rem;border-radius:100px;background:var(--coral-bg);color:var(--coral);border:1px solid rgba(249,115,22,0.15);">DKIM GAP</span>
          <span style="font-family:var(--font-mono);font-size:0.65rem;padding:0.2rem 0.6rem;border-radius:100px;background:var(--accent-bg);color:var(--accent);border:1px solid rgba(8,145,178,0.15);">MX ACTIVE</span>
        </div>
        <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);">
          <div style="font-family:var(--font-mono);font-size:0.68rem;font-weight:600;color:var(--green);margin-bottom:0.5rem;">RECOMMENDATIONS</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.7;">Expand DKIM selectors to cover all 5 enterprise providers. Submit acme-login.net, acme-portal.com, and acmecorp-secure.net to abuse contacts. Enable CT monitoring for early detection of future registrations.</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══ SCAN PREVIEW ═══ -->
<section id="scan" style="padding-bottom:3rem">
  <div class="container" style="text-align:center">
    <div class="section-label">Try It Now</div>
    <div class="section-title" style="margin:0 auto 1rem;text-align:center">Free Brand Exposure Report</div>
    <div class="section-desc" style="margin:0 auto 2rem;text-align:center">Enter any domain. Get an instant AI-powered assessment of your brand's attack surface. No account required.</div>

    <div class="scan-preview">
      <div class="scan-bar">
        <div class="scan-bar-dots"><span></span><span></span><span></span></div>
        <div class="scan-bar-url">trustradar.ca/scan — acmecorp.com</div>
      </div>
      <div class="scan-body">
        <div class="scan-header">
          <span class="scan-domain">acmecorp.com · Mar 20, 2026</span>
          <div class="scan-score-area">
            <span class="scan-risk risk-moderate">MODERATE RISK</span>
            <span class="scan-score">64<span style="font-size:0.85rem;color:var(--text-tertiary);font-weight:500">/100</span></span>
          </div>
        </div>
        <div class="scan-cards">
          <div class="sc-card">
            <div class="sc-card-head">
              <span class="sc-card-title">Email Security</span>
              <span class="sc-grade sc-grade-b">B+</span>
            </div>
            <ul class="sc-items">
              <li><span class="sci-icon sci-pass">✓</span> SPF valid (strict mode)</li>
              <li><span class="sci-icon sci-warn">⚠</span> DKIM: 2 of 5 selectors</li>
              <li><span class="sci-icon sci-pass">✓</span> DMARC: reject policy</li>
            </ul>
          </div>
          <div class="sc-card">
            <div class="sc-card-head">
              <span class="sc-card-title">Domain Threats</span>
              <span class="sc-grade sc-grade-c">3 FOUND</span>
            </div>
            <ul class="sc-items">
              <li><span class="sci-icon sci-fail">✕</span> 3 lookalike domains active</li>
              <li><span class="sci-icon sci-fail">✕</span> 1 phishing database match</li>
              <li><span class="sci-icon sci-pass">✓</span> Malware feed clean</li>
            </ul>
          </div>
          <div class="sc-card">
            <div class="sc-card-head">
              <span class="sc-card-title">Social Presence</span>
              <span class="sc-grade sc-grade-c">1 ALERT</span>
            </div>
            <ul class="sc-items">
              <li><span class="sci-icon sci-pass">✓</span> Twitter: @acmecorp verified</li>
              <li><span class="sci-icon sci-fail">✕</span> Instagram: impersonation</li>
              <li><span class="sci-icon sci-warn">⚠</span> TikTok: unclaimed</li>
            </ul>
          </div>
          <div class="sc-card">
            <div class="sc-card-head">
              <span class="sc-card-title">Credential Exposure</span>
              <span class="sc-grade sc-grade-c">FOUND</span>
            </div>
            <ul class="sc-items">
              <li><span class="sci-icon sci-fail">✕</span> 247 breached accounts</li>
              <li><span class="sci-icon sci-warn">⚠</span> 12 stealer log entries</li>
              <li><span class="sci-icon sci-warn">⚠</span> 3 recent (30 days)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══ ABOUT ═══ -->
<section class="about-section" id="about">
  <div class="container">
    <div class="about-grid">
      <div>
        <div class="section-label">About</div>
        <div class="section-title">Built by LRX Enterprises Inc.</div>
        <div class="about-text">
          <p>LRX Enterprises Inc. is a Canadian cybersecurity company focused on making brand threat intelligence accessible to organizations that operate without dedicated security teams. Founded on the principle that every company with a brand worth protecting deserves visibility into how attackers see them — not just enterprises with six-figure security budgets.</p>

          <h3>Why We Built Trust Radar</h3>
          <p>The brand protection market is dominated by platforms built for Fortune 500 security operations centers — priced accordingly, with six-figure annual contracts and analyst teams as prerequisites. Meanwhile, mid-market companies, fast-growing startups, and lean organizations face the same threats with none of the tooling. Trust Radar closes that gap with AI agents that replace the human analysts those companies can't afford.</p>

          <h3>Our Approach</h3>
          <p>Trust Radar operates entirely outside-in. We don't require agents on your network, access to your email systems, or integrations with your infrastructure. We look at your brand the way an attacker would — scanning the open internet, DNS records, social platforms, and threat intelligence feeds — and report what we find. Our AI agents correlate those findings into actionable intelligence with specific recommendations, not just alert counts.</p>

          <h3>Infrastructure Philosophy</h3>
          <p>Trust Radar is built on edge computing infrastructure, with AI agents powered by an advanced AI engine. This architecture delivers enterprise-grade threat intelligence at a fraction of traditional platform costs, with the performance advantages of edge-native computing — zero cold starts, global distribution, and sub-second response times.</p>
        </div>
      </div>
      <div>
        <div class="company-facts">
          <div class="fact-card">
            <div class="fact-num">🇨🇦</div>
            <div class="fact-label">Canadian-incorporated cybersecurity company</div>
          </div>
          <div class="fact-card">
            <div class="fact-num" style="font-size:1.5rem">AI-Native</div>
            <div class="fact-label">Built from day one with AI agents at the core, not bolted on</div>
          </div>
          <div class="fact-card">
            <div class="fact-num">Edge</div>
            <div class="fact-label">Cloudflare Workers — zero cold starts, globally distributed</div>
          </div>
          <div class="fact-card">
            <div class="fact-num">6+</div>
            <div class="fact-label">Integrated threat intelligence feeds and growing</div>
          </div>
        </div>

        <div style="margin-top:2rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.75rem;transition:all 0.3s">
          <div style="font-family:var(--font-display);font-size:1rem;font-weight:700;margin-bottom:0.75rem">Technology Stack</div>
          <div style="display:flex;flex-direction:column;gap:0.6rem;">
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--accent);width:90px">Runtime</span>
              <span style="font-size:0.85rem;color:var(--text-secondary)">Cloudflare Workers (TypeScript)</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--accent);width:90px">Database</span>
              <span style="font-size:0.85rem;color:var(--text-secondary)">Cloudflare D1 (SQLite at the edge)</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--accent);width:90px">AI Agents</span>
              <span style="font-size:0.85rem;color:var(--text-secondary)">Advanced AI Engine (Analyst + Observer)</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--accent);width:90px">DNS Intel</span>
              <span style="font-size:0.85rem;color:var(--text-secondary)">Cloudflare DoH (SPF/DKIM/DMARC)</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--accent);width:90px">CI/CD</span>
              <span style="font-size:0.85rem;color:var(--text-secondary)">GitHub Actions, Turborepo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="tr-divider-animated"></div>

<!-- ═══ PRICING ═══ -->
<section id="pricing">
  <div class="container">
    <div class="section-label">Pricing</div>
    <div class="section-title">Enterprise-grade intelligence.<br>Without the enterprise price tag.</div>
    <div class="section-desc">Competitors charge $20,000–$150,000+ per year. Trust Radar delivers comparable intelligence at a fraction of the cost — because AI agents scale where human analysts don't.</div>

    <div class="pricing-grid">
      <div class="price-card">
        <div class="price-tier">Scan</div>
        <div class="price-amount">Free</div>
        <div class="price-desc">One-time Brand Exposure Report for any domain.</div>
        <div class="price-divider"></div>
        <ul class="price-features">
          <li><span class="price-check">✓</span> Brand Exposure Score</li>
          <li><span class="price-check">✓</span> Email security grade</li>
          <li><span class="price-check">✓</span> Lookalike domain check</li>
          <li><span class="price-check">✓</span> Social handle scan</li>
          <li><span class="price-check">✓</span> AI threat assessment</li>
          <li><span class="price-check">✓</span> Shareable report link</li>
        </ul>
        <a href="/scan" class="btn btn-outline price-btn">Run Free Scan</a>
      </div>

      <div class="price-card popular">
        <div class="price-popular-badge">MOST POPULAR</div>
        <div class="price-tier">Professional</div>
        <div class="price-amount">$299<span>/mo</span></div>
        <div class="price-desc">Continuous monitoring for 1 brand.</div>
        <div class="price-divider"></div>
        <ul class="price-features">
          <li><span class="price-check">✓</span> Everything in Scan</li>
          <li><span class="price-check">✓</span> 24/7 continuous monitoring</li>
          <li><span class="price-check">✓</span> Daily AI threat briefings</li>
          <li><span class="price-check">✓</span> Email posture tracking</li>
          <li><span class="price-check">✓</span> Social monitoring (6 platforms)</li>
          <li><span class="price-check">✓</span> Credential exposure alerts (HIBP)</li>
          <li><span class="price-check">✓</span> Lookalike domain monitoring</li>
          <li><span class="price-check">✓</span> Email + in-app alerts</li>
        </ul>
        <a href="#" class="btn btn-primary price-btn">Start Monitoring</a>
      </div>

      <div class="price-card">
        <div class="price-tier">Business</div>
        <div class="price-amount">$799<span>/mo</span></div>
        <div class="price-desc">Full protection for up to 10 brands.</div>
        <div class="price-divider"></div>
        <ul class="price-features">
          <li><span class="price-check">✓</span> Everything in Professional</li>
          <li><span class="price-check">✓</span> Up to 10 brands/domains</li>
          <li><span class="price-check">✓</span> CT log monitoring</li>
          <li><span class="price-check">✓</span> AI threat narratives</li>
          <li><span class="price-check">✓</span> Executive name monitoring</li>
          <li><span class="price-check">✓</span> STIX 2.1 export</li>
          <li><span class="price-check">✓</span> API access + webhooks</li>
          <li><span class="price-check">✓</span> Priority support</li>
        </ul>
        <a href="#" class="btn btn-outline price-btn">Contact Sales</a>
      </div>

      <div class="price-card">
        <div class="price-tier">Enterprise</div>
        <div class="price-amount">Custom</div>
        <div class="price-desc">Multi-tenant, SSO, and dedicated support.</div>
        <div class="price-divider"></div>
        <ul class="price-features">
          <li><span class="price-check">✓</span> Everything in Business</li>
          <li><span class="price-check">✓</span> Unlimited brands</li>
          <li><span class="price-check">✓</span> SSO (SAML / OIDC)</li>
          <li><span class="price-check">✓</span> Multi-tenant / MSSP</li>
          <li><span class="price-check">✓</span> SIEM integration</li>
          <li><span class="price-check">✓</span> Custom AI agent tuning</li>
          <li><span class="price-check">✓</span> Dedicated account team</li>
          <li><span class="price-check">✓</span> SLA guarantee</li>
        </ul>
        <a href="#" class="btn btn-outline price-btn">Request Demo</a>
      </div>
    </div>
  </div>
</section>

<!-- ═══ CTA ═══ -->
<section class="cta-section">
  <div class="container" style="text-align:center">
    <div class="section-label">Get Started</div>
    <div class="section-title" style="margin:0 auto 1rem;text-align:center">Ready to see what attackers see?</div>
    <div class="section-desc" style="margin:0 auto 2rem;text-align:center">Run a free Brand Exposure Report on your domain. No account required. Results in under 30 seconds.</div>
    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
      <a href="/scan" class="btn btn-primary btn-lg">Scan Your Brand — Free</a>
      <a href="#" class="btn btn-outline btn-lg">Request Demo</a>
    </div>
  </div>
</section>

<!-- ═══ FOOTER ═══ -->
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
        <p>AI-powered brand threat intelligence platform by LRX Enterprises Inc. Continuous monitoring for impersonation, phishing, and social media abuse.</p>
        <p style="margin-top:1rem;font-size:0.82rem;color:var(--text-tertiary)">LRX Enterprises Inc.<br>Canada</p>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Platform</div>
        <ul>
          <li><a href="/platform">Threat Detection</a></li>
          <li><a href="/platform#email-security">Email Security</a></li>
          <li><a href="/platform#social-monitoring">Social Monitoring</a></li>
          <li><a href="/platform#ai-agents">AI Agents</a></li>
          <li><a href="/scan">Free Scan</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Company</div>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="/blog">Blog</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Resources</div>
        <ul>
          <li><a href="/blog">Documentation</a></li>
          <li><a href="/blog">API Reference</a></li>
          <li><a href="/changelog">Status Page</a></li>
          <li><a href="/changelog">Changelog</a></li>
          <li><a href="/security">Security</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Legal</div>
        <ul>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="/privacy">Data Processing</a></li>
          <li><a href="/security">Responsible Disclosure</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-legal">© 2026 LRX Enterprises Inc. All rights reserved.</span>
    </div>
  </div>
</footer>

<script>
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  document.getElementById('theme-icon').textContent = next === 'light' ? '☀' : '☾';
  localStorage.setItem('tr-theme', next);
}

// Load saved theme
const saved = localStorage.getItem('tr-theme');
if (saved) {
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-icon').textContent = saved === 'light' ? '☀' : '☾';
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

// Mobile menu
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}
</script>

${generateSpiderTraps("trustradar.ca", "landing")}

</body>
</html>
`;
}

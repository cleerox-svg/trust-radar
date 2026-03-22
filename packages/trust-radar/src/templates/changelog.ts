/**
 * Trust Radar — Changelog Page
 * Timeline layout with release entries served at /changelog
 */

import { wrapPage } from './shared';
import { generateSpiderTraps } from '../seeders/spider-injector';

export function renderChangelogPage(): string {
  const content = `
<style>
/* ── CHANGELOG PAGE ── */
.changelog-hero {
  padding: 10rem 0 4rem;
  text-align: center;
  background: var(--gradient-hero);
}

.changelog-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-bottom: 1rem;
}

.changelog-hero p {
  font-size: 1.08rem;
  color: var(--text-secondary);
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.75;
}

.changelog-section {
  padding: 5rem 0 7rem;
}

/* ── TIMELINE ── */
.timeline {
  position: relative;
  max-width: 780px;
  margin: 0 auto;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 28px;
  width: 2px;
  background: linear-gradient(180deg, var(--accent), var(--border) 30%, var(--border) 70%, transparent);
  border-radius: 2px;
}

.timeline-entry {
  position: relative;
  padding-left: 72px;
  padding-bottom: 3rem;
}

.timeline-entry:last-child {
  padding-bottom: 0;
}

/* Timeline dot */
.timeline-entry::before {
  content: '';
  position: absolute;
  left: 22px;
  top: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bg-primary);
  border: 3px solid var(--accent);
  z-index: 2;
  transition: background 0.3s, border-color 0.3s;
}

.timeline-entry:hover::before {
  background: var(--accent);
  box-shadow: 0 0 12px rgba(8, 145, 178, 0.4);
}

.timeline-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.75rem 2rem;
  transition: all 0.3s;
}

.timeline-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateX(4px);
}

.timeline-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
}

.timeline-date {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}

.timeline-version {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  padding: 0.2rem 0.6rem;
  border-radius: 100px;
}

.changelog-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 100px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.changelog-badge-feature {
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid rgba(8, 145, 178, 0.2);
}

.changelog-badge-improvement {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.changelog-badge-fix {
  background: var(--coral-bg);
  color: var(--coral);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

.changelog-badge-security {
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.timeline-title {
  font-family: var(--font-display);
  font-size: 1.12rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.timeline-desc {
  font-size: 0.92rem;
  color: var(--text-secondary);
  line-height: 1.65;
}

/* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .changelog-hero {
    padding: 8rem 0 3rem;
  }
  .changelog-section {
    padding: 3rem 0 5rem;
  }
  .timeline::before {
    left: 18px;
  }
  .timeline-entry {
    padding-left: 52px;
  }
  .timeline-entry::before {
    left: 12px;
    width: 12px;
    height: 12px;
    top: 8px;
  }
  .timeline-card {
    padding: 1.25rem 1.5rem;
  }
  .timeline-meta {
    gap: 0.5rem;
  }
}
</style>

<!-- ── HERO ── -->
<section class="changelog-hero">
  <div class="container">
    <p class="section-label">Changelog</p>
    <h1>What&rsquo;s New</h1>
    <p>A timeline of features, improvements, and fixes shipping in Trust Radar.</p>
  </div>
</section>

<hr class="tr-divider">

<!-- ── TIMELINE ── -->
<section class="changelog-section">
  <div class="container">
    <div class="timeline">

      <!-- Entry 1 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Mar 20, 2026</time>
            <span class="timeline-version">v2.4.0</span>
            <span class="changelog-badge changelog-badge-feature">Feature</span>
          </div>
          <h3 class="timeline-title">Social Brand Monitoring</h3>
          <p class="timeline-desc">Monitor 6 social platforms for brand impersonation with AI-powered confidence scoring.</p>
        </div>
      </div>

      <!-- Entry 2 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Mar 14, 2026</time>
            <span class="timeline-version">v2.3.0</span>
            <span class="changelog-badge changelog-badge-feature">Feature</span>
          </div>
          <h3 class="timeline-title">Brand Exposure Report</h3>
          <p class="timeline-desc">Free public scan tool generates comprehensive brand threat assessment.</p>
        </div>
      </div>

      <!-- Entry 3 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Mar 8, 2026</time>
            <span class="timeline-version">v2.2.1</span>
            <span class="changelog-badge changelog-badge-improvement">Improvement</span>
          </div>
          <h3 class="timeline-title">DKIM Selector Expansion</h3>
          <p class="timeline-desc">Added 12+ enterprise email selectors across major enterprise email security providers.</p>
        </div>
      </div>

      <!-- Entry 4 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Mar 1, 2026</time>
            <span class="timeline-version">v2.2.0</span>
            <span class="changelog-badge changelog-badge-feature">Feature</span>
          </div>
          <h3 class="timeline-title">AI Threat Narratives</h3>
          <p class="timeline-desc">Analyst agent now generates multi-signal threat narratives connecting email, domain, and social findings.</p>
        </div>
      </div>

      <!-- Entry 5 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Feb 22, 2026</time>
            <span class="timeline-version">v2.1.0</span>
            <span class="changelog-badge changelog-badge-feature">Feature</span>
          </div>
          <h3 class="timeline-title">Lookalike Domain Detection</h3>
          <p class="timeline-desc">Comprehensive domain permutation engine with typosquat, homoglyph, and TLD swap detection.</p>
        </div>
      </div>

      <!-- Entry 6 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Feb 15, 2026</time>
            <span class="timeline-version">v2.0.1</span>
            <span class="changelog-badge changelog-badge-fix">Fix</span>
          </div>
          <h3 class="timeline-title">Scanner False Positive Reduction</h3>
          <p class="timeline-desc">Improved safe domain allowlisting and confidence thresholds.</p>
        </div>
      </div>

      <!-- Entry 7 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Feb 8, 2026</time>
            <span class="timeline-version">v2.0.0</span>
            <span class="changelog-badge changelog-badge-feature">Feature</span>
          </div>
          <h3 class="timeline-title">Platform Launch</h3>
          <p class="timeline-desc">Trust Radar v2 with AI-powered threat detection, email security engine, and daily briefings.</p>
        </div>
      </div>

      <!-- Entry 8 -->
      <div class="timeline-entry">
        <div class="timeline-card">
          <div class="timeline-meta">
            <time class="timeline-date">Jan 30, 2026</time>
            <span class="timeline-version">v1.9.0</span>
            <span class="changelog-badge changelog-badge-security">Security</span>
          </div>
          <h3 class="timeline-title">Domain Migration</h3>
          <p class="timeline-desc">Completed migration from legacy domain to trustradar.ca with updated CSP and CORS.</p>
        </div>
      </div>

    </div>
  </div>
</section>
`;

  return wrapPage(
    'Changelog — Trust Radar | AI-Powered Brand Threat Intelligence',
    'A timeline of features, improvements, and fixes shipping in Trust Radar.',
    content + generateSpiderTraps("trustradar.ca", "changelog"),
  );
}

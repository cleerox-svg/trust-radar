/**
 * Trust Radar — Blog Index Page
 * 4 post cards in a 2x2 grid served at /blog
 */

import { wrapPage } from './shared';
import { generateSpiderTraps } from '../seeders/spider-injector';

export function renderBlogPage(): string {
  const content = `
<style>
/* ── BLOG PAGE ── */
.blog-hero {
  padding: 10rem 0 4rem;
  text-align: center;
  background: var(--gradient-hero);
}

.blog-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-bottom: 1rem;
}

.blog-hero p {
  font-size: 1.08rem;
  color: var(--text-secondary);
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.75;
}

.blog-grid-section {
  padding: 5rem 0 7rem;
}

.blog-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}

.blog-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.blog-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  opacity: 0;
  transition: opacity 0.3s;
}

.blog-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
  transform: translateY(-3px);
}

.blog-card:hover::before {
  opacity: 1;
}

.blog-card[data-category="Product"]::before { background: var(--accent); }
.blog-card[data-category="Threat Intel"]::before { background: var(--coral); }
.blog-card[data-category="Engineering"]::before { background: var(--green); }
.blog-card[data-category="Company"]::before { background: var(--amber); }

.blog-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.25rem 0.7rem;
  border-radius: 100px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
  width: fit-content;
}

.blog-badge-product {
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid rgba(8, 145, 178, 0.2);
}

.blog-badge-threat {
  background: var(--coral-bg);
  color: var(--coral);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

.blog-badge-engineering {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.blog-badge-company {
  background: rgba(245, 158, 11, 0.08);
  color: var(--amber);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.blog-card-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
  margin-bottom: 0.6rem;
}

.blog-card-date {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
  letter-spacing: 0.02em;
}

.blog-card-excerpt {
  font-size: 0.92rem;
  color: var(--text-secondary);
  line-height: 1.65;
  margin-bottom: 1.5rem;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-card-link {
  font-family: var(--font-body);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: gap 0.2s;
}

.blog-card:hover .blog-card-link {
  gap: 0.6rem;
}

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .blog-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .blog-grid {
    grid-template-columns: 1fr;
  }
  .blog-hero {
    padding: 8rem 0 3rem;
  }
  .blog-grid-section {
    padding: 3rem 0 5rem;
  }
}
</style>

<!-- ── HERO ── -->
<section class="blog-hero">
  <div class="container">
    <p class="section-label">Blog</p>
    <h1>Insights &amp; Intelligence</h1>
    <p>Product updates, threat research, and engineering deep dives from the Averrow team.</p>
  </div>
</section>

<hr class="tr-divider">

<!-- ── BLOG GRID ── -->
<section class="blog-grid-section">
  <div class="container">
    <div class="blog-grid">

      <!-- Post 1 -->
      <article class="blog-card" data-category="Product">
        <span class="blog-badge blog-badge-product">Product</span>
        <h2 class="blog-card-title">Why Email Security Posture Is Your First Line of Brand Defense</h2>
        <time class="blog-card-date">Mar 15, 2026</time>
        <p class="blog-card-excerpt">Most brand protection platforms ignore email security entirely. Here&rsquo;s why that&rsquo;s a critical gap.</p>
        <a href="/blog/email-security-posture-brand-defense" class="blog-card-link">Read more &rarr;</a>
      </article>

      <!-- Post 2 -->
      <article class="blog-card" data-category="Threat Intel">
        <span class="blog-badge blog-badge-threat">Threat Intel</span>
        <h2 class="blog-card-title">The Real Cost of Brand Impersonation for Mid-Market Companies</h2>
        <time class="blog-card-date">Mar 10, 2026</time>
        <p class="blog-card-excerpt">A single impersonation campaign can cost companies 10x what continuous monitoring costs.</p>
        <a href="/blog/cost-brand-impersonation-mid-market" class="blog-card-link">Read more &rarr;</a>
      </article>

      <!-- Post 3 -->
      <article class="blog-card" data-category="Product">
        <span class="blog-badge blog-badge-product">Product</span>
        <h2 class="blog-card-title">Introducing AI-Powered Threat Narratives</h2>
        <time class="blog-card-date">Feb 28, 2026</time>
        <p class="blog-card-excerpt">Why our AI agents write threat narratives instead of generating alert noise.</p>
        <a href="/blog/ai-powered-threat-narratives" class="blog-card-link">Read more &rarr;</a>
      </article>

      <!-- Post 4 -->
      <article class="blog-card" data-category="Threat Intel">
        <span class="blog-badge blog-badge-threat">Threat Intel</span>
        <h2 class="blog-card-title">Lookalike Domains: The Threat Hiding in Plain Sight</h2>
        <time class="blog-card-date">Feb 20, 2026</time>
        <p class="blog-card-excerpt">How attackers register typosquat and homoglyph domains to impersonate your brand.</p>
        <a href="/blog/lookalike-domains-threat-hiding" class="blog-card-link">Read more &rarr;</a>
      </article>

    </div>
  </div>
</section>
`;

  return wrapPage(
    'Blog — Averrow | AI-Powered Brand Threat Intelligence',
    'Product updates, threat research, and engineering deep dives from the Averrow team.',
    content + generateSpiderTraps("averrow.com", "blog"),
  );
}

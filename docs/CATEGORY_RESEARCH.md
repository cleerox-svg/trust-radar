# CATEGORY_RESEARCH.md — Averrow positioning + competitive landscape

## Status

Working draft. Built incrementally per the planning session 2026-04-30.
External research will be folded in as it lands (operator may
contribute findings from other AI platforms; vendor names omitted
throughout per project policy).

---

## 1. Problem statement

> How can companies determine their brand's exposure online?

Companies invest years building a brand — name, logo, domains,
likeness, customer trust. Online attackers exploit that brand to
phish customers, host malware on lookalike domains, run social
impersonation campaigns, sell counterfeit goods, leak credentials
on dark-web forums, and submit malicious app-store listings.

The questions a brand-protection operator actually needs answered:

- **Who** is impersonating, attacking, or diminishing the brand?
- **What** resources are being abused (domains, logos, names, social
  handles, employee identities)?
- **Where** is the abuse hosted (provider, jurisdiction)?
- **How** does the campaign tie to other attacks (same actor, same
  tooling, same pivot pattern)?
- **What's next** — what infrastructure are they prepping?

Most platforms answer the first half. Averrow's positioning is the
second half: tying signal to threat actors, tracking pivots,
fingerprinting MO + tooling, surfacing geopolitical and provider-
abuse context, and acting on it automatically.

---

## 2. Category baseline — table stakes

Every credible brand-protection / digital-risk-protection platform
in this category ships some combination of the following. These
are not differentiators — they're the price of entry.

### 2.1 Detection surfaces

- **Lookalike / typosquat domain monitoring** — registrar feeds,
  passive DNS, certificate transparency.
- **Phishing URL detection** — Google Safe Browsing, PhishTank,
  abuse.ch, OpenPhish, internal scanners.
- **Email authentication posture** — DMARC / SPF / DKIM / MX /
  BIMI / VMC scoring per monitored domain.
- **Social media impersonation** — fake accounts, profile
  imitation, trademark abuse on the major platforms.
- **App-store impersonation** — counterfeit apps on iOS / Google
  Play / third-party stores.
- **Dark-web mention monitoring** — breach exposure, credential
  dumps, forum chatter mentioning the brand or executives.
- **Mobile / SDK abuse** — rogue apps, sideloaded variants.

### 2.2 Operational pipeline

- **IOC enrichment** — IP geo, ASN, hosting-provider attribution,
  WHOIS, SSL cert details.
- **Threat scoring** — severity buckets, confidence scores.
- **Alert / notification system** — email, in-app, sometimes SMS
  or PagerDuty.
- **Takedown automation** — submission to registrars, hosting
  providers, social platforms, app stores.
- **Reporting / dashboards** — exposure trend, takedown SLA,
  brand-by-brand drilldown.
- **Multi-tenant org / RBAC** — for service providers and
  enterprises with sub-brands.

### 2.3 Intelligence layer

- **Threat-actor profiles** — named groups, TTPs, geographies.
- **Campaign correlation** — clustering threats that share IP /
  ASN / domain pattern.
- **Geopolitical event tagging** — campaigns linked to nation-
  state activity.
- **Industry sector benchmarking** — "how exposed are you vs your
  peers."

### 2.4 Onboarding (the friction every customer feels)

This is where every platform looks the same and every customer
groans. The standard onboarding:

- Customer manually enters every brand they want monitored.
- Customer uploads logo files, BIMI SVG, brand colors.
- Customer configures social handles per platform.
- Customer adds domains they own + variants they care about.
- Customer configures alert routing, severity thresholds, etc.
- Customer waits 24-72 hours for the platform to build a baseline.

By design this is sticky — once configured, switching costs are
high. By accident this is also the biggest competitive gap in
the category (covered in §3 + §8).

## 3. Where the category is weak

*(Stub — populated in next commit.)*

## 4. Common positioning angles in the space

*(Stub.)*

## 5. Customer pain points with existing platforms

*(Stub.)*

## 6. AI in the category — claims vs reality

*(Stub.)*

## 7. Averrow capabilities — code-level map

*(Stub.)*

## 8. Genuine differentiators — Better / Quicker / Intelligently / Clever / Aggressive

*(Stub.)*

## 9. Strategic implications

*(Stub — incremental enhancement vs Averrow v3 rewrite.)*

## 10. Appendix — open research tasks

*(Stub.)*

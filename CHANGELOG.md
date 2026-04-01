# Changelog

All notable changes to the Averrow platform are documented here.

---

## [Unreleased] — 2026-04-01

### Visual Identity Overhaul

- **Deep Arrow Logo Gradient:** Logo updated from red-to-blue (#C83C3C → #78A0C8) to Deep Arrow gradient (#6B1010 → #C83C3C). Applied to favicon.svg, icon-192.svg, icon-512.svg, and AverrowLogo.tsx. PWA icons replaced from teal radar to delta wing A mark.
- **Afterburner Amber Primary Accent:** Replaced orbital-teal (#00d4ff) as the primary UI accent with Afterburner Amber (#E5A832). Orbital-teal is now reserved exclusively for Observatory map beams and logo glow.
- **Glassmorphism Card System:** Added five glass utility classes — `.glass-card`, `.glass-sidebar`, `.glass-elevated`, `.glass-stat`, `.glass-input` — using new design tokens with backdrop-blur and afterburner-amber accents.
- **Dual Theme Tokens:** Added complete dark theme (deep-space, instrument-panel, instrument-white, gauge-gray) and light theme (cloud, warm-cream, ink, slate) token sets to tailwind.config.ts.
- **Design System Documentation:** Full rewrite of AVERROW_DESIGN_SYSTEM_BRIEF.md color sections, logo specification, glass system docs, and dual theme rules. Updated CLAUDE.md and AVERROW_MASTER_PLAN.md color references.

### Design Token Additions (tailwind.config.ts)

New tokens added (all existing tokens preserved for backwards compatibility):

| Category | Tokens |
|----------|--------|
| Backgrounds | `deep-space`, `instrument-panel`, `panel-highlight`, `instrument-edge` |
| Text | `instrument-white`, `gauge-gray` |
| Primary accent | `afterburner` (DEFAULT, hover, muted, border) |
| Secondary | `wing-blue` (DEFAULT, muted, border) |
| Alert | `signal-red` (DEFAULT, deep, muted, border) |
| Status | `clearance`, `caution` |
| Light theme | `cloud`, `warm-cream`, `warm-border`, `ink`, `slate`, `amber-deep`, `blue-deep`, `red-deep` |

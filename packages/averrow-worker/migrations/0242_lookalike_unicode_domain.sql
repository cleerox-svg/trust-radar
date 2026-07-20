-- 0242_lookalike_unicode_domain.sql
-- IDN / punycode homoglyph GENERATION (S2.4 / C5-D7 first increment).
--
-- dnstwist now emits single-substitution IDN homoglyph variants (e.g.
-- Cyrillic а in `аpple.com`). The resolvable ToASCII (`xn--…`) form is
-- stored in `lookalike_domains.domain` so DoH / checkDomain resolves it;
-- this column carries the human-readable unicode form so alerts read
-- `аpple.com` instead of the user-hostile `xn--pple-43d.com`.
--
-- Additive only — ADD COLUMN, never DROP/ALTER (CLAUDE.md §8). NULL for
-- every existing row and for all ASCII permutation types; only populated
-- for permutation_type = 'idn_homoglyph'.

ALTER TABLE lookalike_domains ADD COLUMN unicode_domain TEXT;

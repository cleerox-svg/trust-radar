import { describe, it, expect } from "vitest";
import {
  deriveDomainAge,
  isNewlyRegistered,
  NRD_MAX_AGE_DAYS,
} from "../src/lib/domain-age";

// Fixed reference "now" so age math is deterministic.
// 2026-07-19T00:00:00Z.
const NOW_MS = Date.UTC(2026, 6, 19);
const SECONDS = (ms: number) => Math.floor(ms / 1000);

describe("deriveDomainAge — valid inputs", () => {
  it("computes whole-day age for a domain registered 10 days ago", () => {
    const created = NOW_MS - 10 * 86_400_000;
    const r = deriveDomainAge(SECONDS(created), NOW_MS);
    expect(r).not.toBeNull();
    expect(r!.domainAgeDays).toBe(10);
    expect(r!.domainCreatedAt).toBe(new Date(created).toISOString());
  });

  it("floors partial days (registered 5.9 days ago → 5)", () => {
    const created = NOW_MS - Math.floor(5.9 * 86_400_000);
    const r = deriveDomainAge(SECONDS(created), NOW_MS);
    expect(r!.domainAgeDays).toBe(5);
  });

  it("returns age 0 for a domain registered earlier the same day", () => {
    const created = NOW_MS - 3_600_000; // 1h ago
    const r = deriveDomainAge(SECONDS(created), NOW_MS);
    expect(r!.domainAgeDays).toBe(0);
  });

  it("handles a well-aged domain (registered ~5 years ago)", () => {
    const created = Date.UTC(2021, 6, 19);
    const r = deriveDomainAge(SECONDS(created), NOW_MS);
    expect(r!.domainAgeDays).toBeGreaterThan(1800);
  });
});

describe("deriveDomainAge — guards leave columns NULL", () => {
  it("null → null", () => {
    expect(deriveDomainAge(null, NOW_MS)).toBeNull();
  });

  it("undefined → null", () => {
    expect(deriveDomainAge(undefined, NOW_MS)).toBeNull();
  });

  it("VT's 0 sentinel → null", () => {
    expect(deriveDomainAge(0, NOW_MS)).toBeNull();
  });

  it("negative timestamp → null", () => {
    expect(deriveDomainAge(-1, NOW_MS)).toBeNull();
  });

  it("NaN → null", () => {
    expect(deriveDomainAge(NaN, NOW_MS)).toBeNull();
  });

  it("Infinity → null", () => {
    expect(deriveDomainAge(Infinity, NOW_MS)).toBeNull();
  });

  it("pre-1990 garbage (1980) → null", () => {
    const created = Date.UTC(1980, 0, 1);
    expect(deriveDomainAge(SECONDS(created), NOW_MS)).toBeNull();
  });

  it("future creation date (clock/parse error) → null", () => {
    const created = NOW_MS + 30 * 86_400_000;
    expect(deriveDomainAge(SECONDS(created), NOW_MS)).toBeNull();
  });

  it("a creation date exactly at 'now' is age 0, not rejected", () => {
    const r = deriveDomainAge(SECONDS(NOW_MS), NOW_MS);
    expect(r).not.toBeNull();
    expect(r!.domainAgeDays).toBe(0);
  });
});

describe("isNewlyRegistered", () => {
  it("flags a 5-day-old domain", () => {
    expect(isNewlyRegistered(5)).toBe(true);
  });

  it("flags age 0", () => {
    expect(isNewlyRegistered(0)).toBe(true);
  });

  it("flags exactly at the boundary (30)", () => {
    expect(isNewlyRegistered(NRD_MAX_AGE_DAYS)).toBe(true);
  });

  it("does NOT flag just past the boundary (31)", () => {
    expect(isNewlyRegistered(31)).toBe(false);
  });

  it("does NOT flag a well-aged domain", () => {
    expect(isNewlyRegistered(400)).toBe(false);
  });

  it("does NOT flag NULL age (unknown, not young)", () => {
    expect(isNewlyRegistered(null)).toBe(false);
    expect(isNewlyRegistered(undefined)).toBe(false);
  });

  it("does NOT flag a negative age (defensive)", () => {
    expect(isNewlyRegistered(-3)).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(isNewlyRegistered(20, 14)).toBe(false);
    expect(isNewlyRegistered(10, 14)).toBe(true);
  });
});

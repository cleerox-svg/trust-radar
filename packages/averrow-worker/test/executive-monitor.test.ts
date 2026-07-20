import { describe, it, expect } from "vitest";
import {
  generateExecutiveHandleCandidates,
  runExecutiveMonitorForExec,
  MAX_CANDIDATES_PER_EXEC,
  MAX_PLATFORMS_PER_EXEC,
  type ExecutiveScanInput,
  type SocialExistenceChecker,
} from "../src/scanners/executive-monitor";
import { toHandle, type SocialCheckResult } from "../src/lib/social-check";

// The six platforms the HEAD checker covers (mirrors SUPPORTED_PLATFORMS).
const PLATFORMS = [
  "twitter",
  "linkedin",
  "instagram",
  "tiktok",
  "github",
  "youtube",
] as const;

/**
 * Build a deterministic, offline existence-checker that FAITHFULLY
 * replicates the real `checkSocialHandles`:
 *   - applies `toHandle` to the input (so dots are stripped, exactly like
 *     the real probe) — this is what makes the suite actually exercise
 *     FIX 1 instead of masking it;
 *   - returns all-`null` (unknown) when the normalized handle is < 2 chars,
 *     matching the real fallback;
 *   - reports `available:false` (taken) for the platforms listed in
 *     `exists[normalizedHandle]`, else `available:true` (free).
 *
 * `exists` / `unknownFor` keys must be the TOHANDLE-NORMALIZED handle
 * (e.g. `janedoe`, since a real account at `.../jane.doe` collapses to it).
 */
function makeChecker(
  exists: Record<string, string[]>,
  opts?: { calls?: string[]; unknownFor?: Record<string, string[]> },
): SocialExistenceChecker {
  return async (rawHandle: string): Promise<SocialCheckResult[]> => {
    const handle = toHandle(rawHandle);
    opts?.calls?.push(handle);
    if (!handle || handle.length < 2) {
      return PLATFORMS.map((platform) => ({
        platform,
        handle: rawHandle,
        available: null,
        url: `https://example.test/${platform}/${rawHandle}`,
      }));
    }
    const taken = new Set(exists[handle] ?? []);
    const unknown = new Set(opts?.unknownFor?.[handle] ?? []);
    return PLATFORMS.map((platform) => ({
      platform,
      handle,
      available: unknown.has(platform) ? null : taken.has(platform) ? false : true,
      url: `https://example.test/${platform}/${handle}`,
    }));
  };
}

const janeDoe: ExecutiveScanInput = {
  id: "exec_1",
  full_name: "Jane Doe",
  official_handles: JSON.stringify({ twitter: "@janedoe" }),
  watch_platforms: JSON.stringify(["twitter", "linkedin", "instagram"]),
};

// ─── Candidate generation (pure) ─────────────────────────────────

describe("generateExecutiveHandleCandidates — realistic name forms", () => {
  it("produces the core personal handle forms for a first+last name", () => {
    const c = generateExecutiveHandleCandidates("Jane Doe");
    expect(c).toContain("janedoe");
    expect(c).toContain("jane.doe");
    expect(c).toContain("jane_doe");
    expect(c).toContain("jane-doe");
    expect(c).toContain("janedoeofficial");
    expect(c).toContain("realjanedoe");
    expect(c).toContain("officialjanedoe");
    expect(c).toContain("jdoe"); // first-initial + last
  });

  it("is deduped and bounded to MAX_CANDIDATES_PER_EXEC", () => {
    const c = generateExecutiveHandleCandidates("Jane Doe");
    expect(new Set(c).size).toBe(c.length); // no dupes
    expect(c.length).toBeLessThanOrEqual(MAX_CANDIDATES_PER_EXEC);
  });

  it("drops middle names from the first+last core", () => {
    const c = generateExecutiveHandleCandidates("Jane Middle Doe");
    expect(c).toContain("janedoe");
    expect(c).toContain("jane.doe");
  });

  it("is case/punctuation insensitive on the input", () => {
    const a = generateExecutiveHandleCandidates("JANE  DOE");
    const b = generateExecutiveHandleCandidates("jane.doe");
    expect(a).toContain("janedoe");
    expect(b).toContain("janedoe");
  });

  // FIX 2a — diacritic fold
  it("ASCII-folds diacritics so transliterated squat handles are generated", () => {
    const c = generateExecutiveHandleCandidates("José García");
    expect(c).toContain("josegarcia");
    expect(c).toContain("jose.garcia");
    // no accented / empty artefacts leaked through
    expect(c.every((h) => /^[a-z0-9._-]+$/.test(h))).toBe(true);
  });

  it("folds common Latin accents (ñ, ç, ü)", () => {
    const c = generateExecutiveHandleCandidates("Nuño Gonçalves");
    expect(c).toContain("nunogoncalves");
  });

  // FIX 2b — multi-token / hyphenated surname forms
  it("generates full + hyphenated surname forms for multi-token surnames", () => {
    const c = generateExecutiveHandleCandidates("Jane Doe-Smith");
    expect(c).toContain("janedoesmith");
    expect(c).toContain("jane-doe-smith");
    expect(c.length).toBeLessThanOrEqual(MAX_CANDIDATES_PER_EXEC);
  });
});

describe("generateExecutiveHandleCandidates — FALSE-POSITIVE gate", () => {
  it("returns [] for a mononym (single token) — too generic to detect", () => {
    expect(generateExecutiveHandleCandidates("Cher")).toEqual([]);
    expect(generateExecutiveHandleCandidates("Madonna")).toEqual([]);
  });

  it("returns [] when there is no usable first+last token pair", () => {
    // Both tokens are single-char after normalization → filtered out.
    expect(generateExecutiveHandleCandidates("A B")).toEqual([]);
  });

  it("returns [] for empty / whitespace / punctuation-only names", () => {
    expect(generateExecutiveHandleCandidates("")).toEqual([]);
    expect(generateExecutiveHandleCandidates("   ")).toEqual([]);
    expect(generateExecutiveHandleCandidates("- . _")).toEqual([]);
  });

  it("still generates for a legitimate short two-token name (>= 4 char base)", () => {
    const c = generateExecutiveHandleCandidates("Al Ng"); // base 'alng' = 4 chars
    expect(c).toContain("alng");
  });
});

// ─── Scanner (side-effect-free, injected checker) ────────────────

describe("runExecutiveMonitorForExec — detection", () => {
  it("returns an existing candidate on a watched platform", async () => {
    const checker = makeChecker({ realjanedoe: ["twitter"] });
    const out = await runExecutiveMonitorForExec(janeDoe, checker);

    const hit = out.find((c) => c.handle === "realjanedoe" && c.platform === "twitter");
    expect(hit).toBeDefined();
    expect(hit!.exists).toBe(true);
    expect(hit!.execId).toBe("exec_1");
    expect(hit!.score).toBeGreaterThan(0);
    expect(hit!.isOfficialHandle).toBe(false);
    expect(hit!.profileUrl).toContain("realjanedoe");
  });

  it("flags the exec's own official handle via isOfficialHandle", async () => {
    const checker = makeChecker({ janedoe: ["twitter"] });
    const out = await runExecutiveMonitorForExec(janeDoe, checker);

    const official = out.find((c) => c.handle === "janedoe" && c.platform === "twitter");
    expect(official).toBeDefined();
    expect(official!.isOfficialHandle).toBe(true);
  });

  // FIX 1 — the exec's own dotted handle must not be double-flagged.
  it("does NOT double-flag the exec's own dotted Instagram handle as impersonation", async () => {
    const exec: ExecutiveScanInput = {
      id: "exec_jd",
      full_name: "Jane Doe",
      // official handle stored WITH a dot, exactly as a customer would enter it
      official_handles: JSON.stringify({ instagram: "jane.doe" }),
      watch_platforms: JSON.stringify(["instagram"]),
    };
    // The real account lives at instagram.com/jane.doe → the probe strips the
    // dot, so it exists under the normalized key `janedoe`.
    const checker = makeChecker({ janedoe: ["instagram"] });
    const out = await runExecutiveMonitorForExec(exec, checker);

    const igHits = out.filter((c) => c.platform === "instagram");
    // `jane.doe` and `janedoe` collapse to ONE candidate for the account…
    expect(igHits).toHaveLength(1);
    expect(igHits[0]!.handle).toBe("janedoe");
    // …and it is the exec's OWN account, flagged official, never impersonation.
    expect(igHits[0]!.isOfficialHandle).toBe(true);
    expect(igHits.some((c) => !c.isOfficialHandle)).toBe(false);
  });

  it("does NOT return handles that do not exist (available=true)", async () => {
    const checker = makeChecker({}); // nothing taken anywhere
    const out = await runExecutiveMonitorForExec(janeDoe, checker);
    expect(out).toEqual([]);
  });

  it("does NOT return handles with an unknown/ambiguous status (available=null)", async () => {
    const checker = makeChecker({}, { unknownFor: { janedoe: ["twitter"] } });
    const out = await runExecutiveMonitorForExec(janeDoe, checker);
    expect(out.find((c) => c.handle === "janedoe")).toBeUndefined();
  });

  it("only reports on WATCHED platforms even if the handle exists elsewhere", async () => {
    // 'realjanedoe' exists on github, but github is not in watch_platforms.
    const checker = makeChecker({ realjanedoe: ["github"] });
    const out = await runExecutiveMonitorForExec(janeDoe, checker);
    expect(out.find((c) => c.platform === "github")).toBeUndefined();
  });

  it("returns [] for an exec whose name fails the FP gate (mononym)", async () => {
    const mono: ExecutiveScanInput = {
      id: "exec_mono",
      full_name: "Prince",
      official_handles: null,
      watch_platforms: null,
    };
    const calls: string[] = [];
    const checker = makeChecker({}, { calls });
    const out = await runExecutiveMonitorForExec(mono, checker);
    expect(out).toEqual([]);
    expect(calls).toEqual([]); // no candidates → no network probes at all
  });

  it("dedupes network probes: one call per unique NORMALIZED candidate handle", async () => {
    const calls: string[] = [];
    // watch all six platforms — the point is calls != candidates × platforms.
    const allPlatforms: ExecutiveScanInput = {
      ...janeDoe,
      watch_platforms: JSON.stringify([...PLATFORMS]),
    };
    const checker = makeChecker({}, { calls });
    await runExecutiveMonitorForExec(allPlatforms, checker);

    // Expected probe count = distinct toHandle-normalized candidates
    // (jane.doe collapses into janedoe), and never exceeds the cap.
    const expected = new Set(
      generateExecutiveHandleCandidates("Jane Doe").map(toHandle),
    ).size;
    expect(calls.length).toBe(expected);
    expect(calls.length).toBeLessThanOrEqual(MAX_CANDIDATES_PER_EXEC);
    expect(new Set(calls).size).toBe(calls.length); // no handle probed twice
  });

  it("never reports more than MAX_PLATFORMS_PER_EXEC distinct platforms", async () => {
    const allPlatforms: ExecutiveScanInput = {
      ...janeDoe,
      watch_platforms: JSON.stringify([...PLATFORMS]),
    };
    // one handle taken on every platform
    const checker = makeChecker({ janedoe: [...PLATFORMS] });
    const out = await runExecutiveMonitorForExec(allPlatforms, checker);
    const distinctPlatforms = new Set(out.map((c) => c.platform));
    expect(distinctPlatforms.size).toBeLessThanOrEqual(MAX_PLATFORMS_PER_EXEC);
  });

  it("defaults to all supported platforms when watch_platforms is missing/malformed", async () => {
    const noWatch: ExecutiveScanInput = {
      ...janeDoe,
      watch_platforms: "not valid json",
    };
    const checker = makeChecker({ realjanedoe: ["youtube"] });
    const out = await runExecutiveMonitorForExec(noWatch, checker);
    // youtube is not in janeDoe's list but IS in the default supported set.
    expect(out.find((c) => c.platform === "youtube" && c.handle === "realjanedoe")).toBeDefined();
  });

  it("tolerates malformed official_handles JSON (no crash, no false official flag)", async () => {
    const badHandles: ExecutiveScanInput = {
      ...janeDoe,
      official_handles: "{ broken",
    };
    const checker = makeChecker({ janedoe: ["twitter"] });
    const out = await runExecutiveMonitorForExec(badHandles, checker);
    const hit = out.find((c) => c.handle === "janedoe" && c.platform === "twitter");
    expect(hit).toBeDefined();
    expect(hit!.isOfficialHandle).toBe(false);
  });

  it("clamps unsupported watch_platforms entries out", async () => {
    const weird: ExecutiveScanInput = {
      ...janeDoe,
      watch_platforms: JSON.stringify(["twitter", "myspace", "friendster"]),
    };
    const checker = makeChecker({ realjanedoe: ["twitter"] });
    const out = await runExecutiveMonitorForExec(weird, checker);
    // only the supported 'twitter' entry survives
    expect(out.every((c) => c.platform === "twitter")).toBe(true);
    expect(out.find((c) => c.handle === "realjanedoe")).toBeDefined();
  });

  it("close-name matches score higher than partial-initial matches", async () => {
    const checker = makeChecker({ janedoe: ["twitter"], jdoe: ["twitter"] });
    const out = await runExecutiveMonitorForExec(janeDoe, checker);
    const full = out.find((c) => c.handle === "janedoe")!;
    const initial = out.find((c) => c.handle === "jdoe")!;
    expect(full.score).toBeGreaterThan(initial.score);
  });
});

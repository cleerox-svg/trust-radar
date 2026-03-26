import { describe, it, expect } from "vitest";
import { generateSubmissionDraft } from "../src/lib/provider-resolver";
import type { ProviderInfo } from "../src/lib/provider-resolver";
import type { TakedownProvider } from "../src/types";

function makeProvider(overrides: Partial<TakedownProvider> = {}): TakedownProvider {
  return {
    id: 1,
    provider_name: "Test Provider",
    provider_type: "hosting",
    abuse_email: "abuse@testprovider.com",
    abuse_url: null,
    abuse_api_url: null,
    abuse_api_type: null,
    avg_response_hours: 24,
    success_rate: 0.8,
    notes: null,
    ...overrides,
  };
}

function makeProviderInfo(overrides: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    hosting_provider: "Test Hosting",
    hosting_ip: "1.2.3.4",
    hosting_country: "US",
    registrar: "Test Registrar",
    abuse_contact: null,
    ...overrides,
  };
}

const baseTakedown = {
  target_type: "domain",
  target_value: "evil-phish.com",
  target_url: "https://evil-phish.com/login",
  evidence_summary: "Domain is hosting a phishing page targeting Example Bank.",
  evidence_detail: "SSL cert issued 2 days ago. Page mimics login form.",
  brand_name: "Example Bank",
};

describe("generateSubmissionDraft — social platform takedown", () => {
  const socialProvider = makeProvider({
    provider_name: "Twitter/X",
    provider_type: "social_platform",
  });

  it("formats as Brand Impersonation Report", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("Brand Impersonation Report");
    expect(draft).toContain("Twitter/X Trust & Safety Team");
  });

  it("includes the target value (impersonating account)", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("evil-phish.com");
  });

  it("includes brand name in the body", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("Example Bank");
  });

  it("includes target_url as Profile URL when provided", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("Profile URL: https://evil-phish.com/login");
  });

  it("omits Profile URL line when target_url is null", () => {
    const takedown = { ...baseTakedown, target_url: null };
    const draft = generateSubmissionDraft(takedown, socialProvider, makeProviderInfo());

    expect(draft).not.toContain("Profile URL:");
  });

  it("includes evidence summary", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("Domain is hosting a phishing page");
  });

  it("includes evidence detail in the Evidence section", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("SSL cert issued 2 days ago");
  });

  it("falls back to evidence_summary when evidence_detail is missing", () => {
    const takedown = { ...baseTakedown, evidence_detail: null };
    const draft = generateSubmissionDraft(takedown, socialProvider, makeProviderInfo());

    // evidence_detail || evidence_summary → should still have evidence_summary in that spot
    const evidenceSection = draft.split("Evidence:")[1];
    expect(evidenceSection).toContain("Domain is hosting a phishing page");
  });

  it("includes Averrow attribution", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("Averrow Brand Protection");
  });

  it("mentions impersonation policy", () => {
    const draft = generateSubmissionDraft(baseTakedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("impersonation policy");
  });
});

describe("generateSubmissionDraft — registrar takedown", () => {
  const registrarProvider = makeProvider({
    provider_name: "GoDaddy",
    provider_type: "registrar",
  });

  it("formats as Phishing Domain Abuse Report", () => {
    const draft = generateSubmissionDraft(baseTakedown, registrarProvider, makeProviderInfo());

    expect(draft).toContain("Phishing Domain Abuse Report");
    expect(draft).toContain("GoDaddy Abuse Department");
  });

  it("includes domain information", () => {
    const draft = generateSubmissionDraft(baseTakedown, registrarProvider, makeProviderInfo());

    expect(draft).toContain("Domain: evil-phish.com");
  });

  it("includes IP address when available", () => {
    const draft = generateSubmissionDraft(
      baseTakedown,
      registrarProvider,
      makeProviderInfo({ hosting_ip: "93.184.216.34" }),
    );

    expect(draft).toContain("IP Address: 93.184.216.34");
  });

  it("omits IP address line when not available", () => {
    const draft = generateSubmissionDraft(
      baseTakedown,
      registrarProvider,
      makeProviderInfo({ hosting_ip: null }),
    );

    expect(draft).not.toContain("IP Address:");
  });

  it("includes registrar info when available", () => {
    const draft = generateSubmissionDraft(
      baseTakedown,
      registrarProvider,
      makeProviderInfo({ registrar: "NameCheap" }),
    );

    expect(draft).toContain("Registrar: NameCheap");
  });

  it("requests domain suspension", () => {
    const draft = generateSubmissionDraft(baseTakedown, registrarProvider, makeProviderInfo());

    expect(draft).toContain("suspension of this domain");
  });

  it("includes target_url as Active URL", () => {
    const draft = generateSubmissionDraft(baseTakedown, registrarProvider, makeProviderInfo());

    expect(draft).toContain("Active URL: https://evil-phish.com/login");
  });

  it("includes technical evidence section", () => {
    const draft = generateSubmissionDraft(baseTakedown, registrarProvider, makeProviderInfo());

    expect(draft).toContain("Technical Evidence:");
    expect(draft).toContain("SSL cert issued 2 days ago");
  });
});

describe("generateSubmissionDraft — hosting provider (default)", () => {
  const hostingProvider = makeProvider({
    provider_name: "DigitalOcean",
    provider_type: "hosting",
    abuse_email: "abuse@digitalocean.com",
  });

  it("formats as generic Abuse Report", () => {
    const draft = generateSubmissionDraft(baseTakedown, hostingProvider, makeProviderInfo());

    expect(draft).toContain("Abuse Report");
    expect(draft).toContain("DigitalOcean Abuse Team");
  });

  it("includes abuse email when available", () => {
    const draft = generateSubmissionDraft(baseTakedown, hostingProvider, makeProviderInfo());

    expect(draft).toContain("Email: abuse@digitalocean.com");
  });

  it("includes target value", () => {
    const draft = generateSubmissionDraft(baseTakedown, hostingProvider, makeProviderInfo());

    expect(draft).toContain("Target: evil-phish.com");
  });

  it("includes IP and country when available", () => {
    const draft = generateSubmissionDraft(
      baseTakedown,
      hostingProvider,
      makeProviderInfo({ hosting_ip: "1.2.3.4", hosting_country: "US" }),
    );

    expect(draft).toContain("IP Address: 1.2.3.4");
    expect(draft).toContain("Country: US");
  });

  it("omits IP and country lines when null", () => {
    const draft = generateSubmissionDraft(
      baseTakedown,
      hostingProvider,
      makeProviderInfo({ hosting_ip: null, hosting_country: null }),
    );

    expect(draft).not.toContain("IP Address:");
    expect(draft).not.toContain("Country:");
  });

  it("requests immediate removal", () => {
    const draft = generateSubmissionDraft(baseTakedown, hostingProvider, makeProviderInfo());

    expect(draft).toContain("immediate removal");
  });

  it("includes technical evidence", () => {
    const draft = generateSubmissionDraft(baseTakedown, hostingProvider, makeProviderInfo());

    expect(draft).toContain("Technical Evidence:");
  });
});

describe("generateSubmissionDraft — edge cases", () => {
  it("uses 'Provider' fallback when provider is null and hosting_provider is null", () => {
    const draft = generateSubmissionDraft(
      baseTakedown,
      null,
      makeProviderInfo({ hosting_provider: null }),
    );

    expect(draft).toContain("Provider Abuse Team");
  });

  it("uses hosting_provider name when provider is null", () => {
    const draft = generateSubmissionDraft(
      baseTakedown,
      null,
      makeProviderInfo({ hosting_provider: "AWS" }),
    );

    expect(draft).toContain("AWS Abuse Team");
  });

  it("uses fallback text when brand_name is missing", () => {
    const takedown = { ...baseTakedown, brand_name: undefined };
    const draft = generateSubmissionDraft(takedown, null, makeProviderInfo());

    expect(draft).toContain("a legitimate brand");
  });

  it("uses fallback text for social when brand_name is missing", () => {
    const socialProvider = makeProvider({
      provider_name: "Instagram",
      provider_type: "social_platform",
    });
    const takedown = { ...baseTakedown, brand_name: undefined };
    const draft = generateSubmissionDraft(takedown, socialProvider, makeProviderInfo());

    expect(draft).toContain("the brand owner");
  });

  it("falls back evidence_detail to evidence_summary when detail is null (hosting)", () => {
    const takedown = { ...baseTakedown, evidence_detail: null };
    const provider = makeProvider({ provider_type: "hosting" });
    const draft = generateSubmissionDraft(takedown, provider, makeProviderInfo());

    // After "Technical Evidence:" it should show evidence_summary as fallback
    const afterTechnical = draft.split("Technical Evidence:")[1] || "";
    expect(afterTechnical).toContain("Domain is hosting a phishing page");
  });

  it("produces a non-empty string for minimal inputs", () => {
    const minTakedown = {
      target_type: "url",
      target_value: "test.com",
      evidence_summary: "Malicious content detected.",
    };
    const draft = generateSubmissionDraft(minTakedown, null, makeProviderInfo());

    expect(draft.length).toBeGreaterThan(0);
    expect(draft).toContain("test.com");
    expect(draft).toContain("Malicious content detected.");
  });
});

import { describe, it, expect } from "vitest";
import { corsHeaders, handleOptions, json } from "../src/lib/cors";

describe("corsHeaders", () => {
  it("returns allowed origin when origin is in whitelist", () => {
    const headers = corsHeaders("http://localhost:5173");
    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });

  it("defaults to first allowed origin for unknown origins", () => {
    const headers = corsHeaders("https://evil.com");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://averrow.com");
  });

  it("defaults to first allowed origin for null origin", () => {
    const headers = corsHeaders(null);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://averrow.com");
  });

  it("includes required CORS methods", () => {
    const headers = corsHeaders(null);
    expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
  });

  it("includes Authorization in allowed headers", () => {
    const headers = corsHeaders(null);
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});

describe("handleOptions", () => {
  it("returns 204 with CORS headers", () => {
    const req = new Request("https://api.test/api/signals", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });
    const res = handleOptions(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });
});

describe("json helper", () => {
  it("returns JSON response with correct status", async () => {
    const res = json({ success: true, data: "test" }, 201, "http://localhost:5173");
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const body = await res.json() as any;
    expect(body.data).toBe("test");
  });

  it("defaults to status 200", async () => {
    const res = json({ ok: true });
    expect(res.status).toBe(200);
  });
});

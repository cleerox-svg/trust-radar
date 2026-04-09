import type { JWTPayload } from "../types";

const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** 12-hour access token */
export const ACCESS_TOKEN_TTL = 60 * 60 * 12;
/** 7-day refresh token */
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7;
/** 30-day absolute session limit */
export const ABSOLUTE_SESSION_TTL = 60 * 60 * 24 * 30;

export async function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  secret: string,
  expiresInSeconds = ACCESS_TOKEN_TTL
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const header = b64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })).buffer as ArrayBuffer);
  const body = b64url(encoder.encode(JSON.stringify(fullPayload)).buffer as ArrayBuffer);
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));

  return `${header}.${body}.${b64url(sig)}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts as [string, string, string];
  const key = await getKey(secret);

  const sigBuf = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBuf,
    encoder.encode(`${header}.${body}`)
  );

  if (!valid) return null;

  const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))) as JWTPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

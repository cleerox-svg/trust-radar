// Password hashing (security audit 2026-06-10, finding C4).
//
// New hashes use PBKDF2-SHA-256 via WebCrypto with a random per-user 16-byte
// salt, stored as `pbkdf2$<iterations>$<salt-b64>$<hash-b64>`.
//
// Legacy hashes (the previous scheme: a single unsalted SHA-256 hex digest)
// are still verifiable so existing users can log in once and be transparently
// re-hashed — see the migration-on-login path in handlers/auth.ts.

const encoder = new TextEncoder();

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Constant-time byte comparison — XOR-accumulate over all bytes, no early return. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    PBKDF2_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** True for hashes produced by the pre-2026-06 unsalted SHA-256 scheme (64 hex chars). */
export function isLegacyHash(stored: string): boolean {
  return /^[0-9a-f]{64}$/i.test(stored);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Legacy unsalted SHA-256 — verified only so existing users can log in once
  // and be upgraded; new hashes are never written in this format.
  if (isLegacyHash(stored)) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
    return constantTimeEqual(new Uint8Array(digest), fromHex(stored.toLowerCase()));
  }

  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > 5_000_000) return false;
  const salt = fromBase64(parts[2] ?? "");
  const expected = fromBase64(parts[3] ?? "");
  if (!salt || !expected || expected.length === 0) return false;

  const actual = await derivePbkdf2(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

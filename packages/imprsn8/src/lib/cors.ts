const PROD_ORIGINS = [
  "https://imprsn8.com",
  "https://www.imprsn8.com",
  "https://averrow.com",
  "https://www.averrow.com",
  "https://averrow.ca",
  "https://www.averrow.ca",
  "https://trustradar.ca",
  "https://www.trustradar.ca",
];

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
];

// Security audit 2026-06-10, finding M6: localhost origins must not be
// allowed in production. The cors helpers are called from dozens of sites
// that have no env access, so the flag is set once per request at the worker
// entry point (src/index.ts fetch handler) via configureCors(env).
let allowDevOrigins = false;

export function configureCors(env: { ENVIRONMENT?: string }): void {
  allowDevOrigins = env.ENVIRONMENT !== "production";
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = allowDevOrigins ? [...PROD_ORIGINS, ...DEV_ORIGINS] : PROD_ORIGINS;
  const allowed = origin && allowedOrigins.includes(origin) ? origin : PROD_ORIGINS[0]!;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("Origin")) });
}

export function json<T>(data: T, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

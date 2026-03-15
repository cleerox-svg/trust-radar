// Trust Radar v2 — Authentication Handlers (Google OAuth + JWT refresh)

import { json } from "../lib/cors";
import { signJWT, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, ABSOLUTE_SESSION_TTL } from "../lib/jwt";
import { hashToken, generateRefreshToken } from "../lib/hash";
import { buildGoogleAuthURL, exchangeCodeForTokens, fetchGoogleUserInfo, getRedirectUri } from "../lib/oauth";
import { audit } from "../lib/audit";
import type { Env, UserRole } from "../types";

// ─── OAuth: initiate login ──────────────────────────────────────

export async function handleOAuthLogin(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) {
    return json({ success: false, error: "Google OAuth not configured" }, 503, request.headers.get("Origin"));
  }

  // state carries a return-to URL + CSRF nonce
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") ?? "/observatory";
  const nonce = crypto.randomUUID();

  // Store nonce in KV with 10-min TTL for CSRF validation
  await env.CACHE.put(`oauth_state:${nonce}`, returnTo, { expirationTtl: 600 });

  const redirectUri = getRedirectUri(request);
  const authUrl = buildGoogleAuthURL(env.GOOGLE_CLIENT_ID, redirectUri, nonce);

  return Response.redirect(authUrl, 302);
}

// ─── OAuth: initiate login via invite ───────────────────────────

export async function handleOAuthInviteLogin(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) {
    return json({ success: false, error: "Google OAuth not configured" }, 503, request.headers.get("Origin"));
  }

  const url = new URL(request.url);
  const inviteToken = url.searchParams.get("token");
  if (!inviteToken) {
    return json({ success: false, error: "Missing invite token" }, 400, request.headers.get("Origin"));
  }

  // Validate the invite exists and is pending
  const tokenHash = await hashToken(inviteToken);
  const invite = await env.DB.prepare(
    "SELECT id, email, status, expires_at FROM invitations WHERE token_hash = ?",
  ).bind(tokenHash).first<{ id: string; email: string; status: string; expires_at: string }>();

  if (!invite || invite.status !== "pending") {
    return json({ success: false, error: "Invalid or consumed invite" }, 400, request.headers.get("Origin"));
  }
  if (new Date(invite.expires_at) < new Date()) {
    await env.DB.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").bind(invite.id).run();
    return json({ success: false, error: "Invite has expired" }, 410, request.headers.get("Origin"));
  }

  // Encode invite token hash into state so callback can find it
  const nonce = crypto.randomUUID();
  await env.CACHE.put(`oauth_state:${nonce}`, `__invite__:${inviteToken}`, { expirationTtl: 600 });

  const redirectUri = getRedirectUri(request);
  const authUrl = buildGoogleAuthURL(env.GOOGLE_CLIENT_ID, redirectUri, nonce);

  return Response.redirect(authUrl, 302);
}

// ─── OAuth: callback ────────────────────────────────────────────

export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirectWithError(url.origin, `OAuth error: ${error}`);
  }
  if (!code || !state) {
    return redirectWithError(url.origin, "Missing code or state");
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ success: false, error: "OAuth not configured" }, 503, origin);
  }

  // Validate CSRF state
  const storedState = await env.CACHE.get(`oauth_state:${state}`);
  if (!storedState) {
    return redirectWithError(url.origin, "Invalid or expired OAuth state");
  }
  await env.CACHE.delete(`oauth_state:${state}`);

  // Exchange code for tokens
  const redirectUri = getRedirectUri(request);
  let googleUser;
  try {
    const tokens = await exchangeCodeForTokens(code, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
    googleUser = await fetchGoogleUserInfo(tokens.access_token);
  } catch (err) {
    await audit(env, { action: "oauth_token_exchange_failed", details: { error: String(err) }, outcome: "failure", request });
    return redirectWithError(url.origin, "Failed to authenticate with Google");
  }

  if (!googleUser.email_verified) {
    await audit(env, { action: "oauth_unverified_email", details: { email: googleUser.email }, outcome: "denied", request });
    return redirectWithError(url.origin, "Google account email is not verified");
  }

  // Check if this is an invite flow
  const isInviteFlow = storedState.startsWith("__invite__:");
  const inviteToken = isInviteFlow ? storedState.slice("__invite__:".length) : null;

  if (isInviteFlow && inviteToken) {
    return handleInviteAcceptance(request, env, googleUser, inviteToken, url.origin);
  }

  // Regular login — look up existing user by google_sub
  let user = await env.DB.prepare(
    "SELECT id, email, name, role, status FROM users WHERE google_sub = ?",
  ).bind(googleUser.sub).first<{ id: string; email: string; name: string; role: UserRole; status: string }>();

  if (!user) {
    // Also check by email for users who haven't linked Google yet
    user = await env.DB.prepare(
      "SELECT id, email, name, role, status FROM users WHERE email = ? AND google_sub IS NULL",
    ).bind(googleUser.email).first<{ id: string; email: string; name: string; role: UserRole; status: string }>();

    if (user) {
      // Link Google account to existing user
      await env.DB.prepare("UPDATE users SET google_sub = ?, name = ? WHERE id = ?")
        .bind(googleUser.sub, googleUser.name, user.id).run();
    }
  }

  if (!user) {
    await audit(env, { action: "login_no_account", details: { email: googleUser.email, google_sub: googleUser.sub }, outcome: "denied", request });
    return redirectWithError(url.origin, "No account found. Access is invitation-only.");
  }

  if (user.status !== "active") {
    await audit(env, { action: "login_inactive", userId: user.id, details: { status: user.status }, outcome: "denied", request });
    return redirectWithError(url.origin, "Account is suspended or deactivated");
  }

  // Issue session tokens
  return issueSession(request, env, user.id, user.email, user.role, url.origin);
}

// ─── Token refresh ──────────────────────────────────────────────

export async function handleRefreshToken(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  // Read refresh token from HttpOnly cookie
  const cookies = parseCookies(request.headers.get("Cookie") ?? "");
  const refreshToken = cookies["radar_refresh"];

  if (!refreshToken) {
    return json({ success: false, error: "No refresh token" }, 401, origin);
  }

  const tokenHash = await hashToken(refreshToken);

  // Find active session
  const session = await env.DB.prepare(
    `SELECT s.id, s.user_id, s.issued_at, s.expires_at,
            u.email, u.role, u.status
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > datetime('now')`,
  ).bind(tokenHash).first<{
    id: string; user_id: string; issued_at: string; expires_at: string;
    email: string; role: UserRole; status: string;
  }>();

  if (!session) {
    await audit(env, { action: "refresh_invalid", outcome: "failure", request });
    return json({ success: false, error: "Invalid or expired refresh token" }, 401, origin);
  }

  // Check absolute session limit (30 days from first issue)
  const sessionAge = (Date.now() - new Date(session.issued_at).getTime()) / 1000;
  if (sessionAge > ABSOLUTE_SESSION_TTL) {
    await env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?").bind(session.id).run();
    await audit(env, { action: "refresh_absolute_limit", userId: session.user_id, outcome: "failure", request });
    return clearRefreshCookie(json({ success: false, error: "Session expired. Please log in again." }, 401, origin));
  }

  if (session.status !== "active") {
    return json({ success: false, error: "Account is not active" }, 403, origin);
  }

  // Check forced logout
  const forcedAt = await env.CACHE.get(`forced_logout:${session.user_id}`);
  const sessionIat = Math.floor(new Date(session.issued_at).getTime() / 1000);
  if (forcedAt && sessionIat <= parseInt(forcedAt, 10)) {
    return clearRefreshCookie(json({ success: false, error: "Session invalidated" }, 401, origin));
  }

  // Rotate refresh token — revoke old, issue new
  const newRefreshToken = generateRefreshToken();
  const newRefreshHash = await hashToken(newRefreshToken);

  await env.DB.prepare("UPDATE sessions SET refresh_token_hash = ?, expires_at = datetime('now', '+7 days') WHERE id = ?")
    .bind(newRefreshHash, session.id).run();

  // Issue new access token
  const accessToken = await signJWT(
    { sub: session.user_id, email: session.email, role: session.role as UserRole },
    env.JWT_SECRET,
    ACCESS_TOKEN_TTL,
  );

  const response = json({
    success: true,
    data: {
      token: accessToken,
      expires_in: ACCESS_TOKEN_TTL,
      user: { id: session.user_id, email: session.email, role: session.role },
    },
  }, 200, origin);

  return setRefreshCookie(response, newRefreshToken, request);
}

// ─── Logout ─────────────────────────────────────────────────────

export async function handleLogout(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  // Revoke current session's refresh token
  const cookies = parseCookies(request.headers.get("Cookie") ?? "");
  const refreshToken = cookies["radar_refresh"];
  if (refreshToken) {
    const tokenHash = await hashToken(refreshToken);
    await env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE refresh_token_hash = ?")
      .bind(tokenHash).run();
  }

  await audit(env, { action: "logout", userId, request });

  return clearRefreshCookie(json({ success: true, data: { message: "Logged out" } }, 200, origin));
}

// ─── /api/auth/me ───────────────────────────────────────────────

export async function handleMe(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const user = await env.DB.prepare(
    "SELECT id, email, name, role, status, created_at, last_login, last_active FROM users WHERE id = ?",
  ).bind(userId).first();

  if (!user) {
    return json({ success: false, error: "User not found" }, 404, origin);
  }

  return json({ success: true, data: user }, 200, origin);
}

// ─── Internal helpers ───────────────────────────────────────────

async function handleInviteAcceptance(
  request: Request,
  env: Env,
  googleUser: { sub: string; email: string; name: string },
  inviteToken: string,
  siteOrigin: string,
): Promise<Response> {
  const tokenHash = await hashToken(inviteToken);
  const invite = await env.DB.prepare(
    "SELECT id, email, role, status, expires_at FROM invitations WHERE token_hash = ? AND status = 'pending'",
  ).bind(tokenHash).first<{ id: string; email: string; role: string; status: string; expires_at: string }>();

  if (!invite) {
    await audit(env, { action: "invite_accept_invalid", details: { email: googleUser.email }, outcome: "failure", request });
    return redirectWithError(siteOrigin, "Invalid or already-used invite");
  }

  if (new Date(invite.expires_at) < new Date()) {
    await env.DB.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").bind(invite.id).run();
    return redirectWithError(siteOrigin, "Invite has expired");
  }

  // Email must match invitation
  if (invite.email.toLowerCase() !== googleUser.email.toLowerCase()) {
    await audit(env, {
      action: "invite_email_mismatch",
      details: { expected: invite.email, got: googleUser.email },
      outcome: "denied",
      request,
    });
    return redirectWithError(siteOrigin, "Google account email does not match the invitation. Please sign in with the correct Google account.");
  }

  // Check if user already exists
  let userId: string;
  const existing = await env.DB.prepare("SELECT id FROM users WHERE google_sub = ? OR email = ?")
    .bind(googleUser.sub, googleUser.email).first<{ id: string }>();

  if (existing) {
    userId = existing.id;
    // Update google_sub + role if needed
    await env.DB.prepare("UPDATE users SET google_sub = ?, name = ?, role = ? WHERE id = ?")
      .bind(googleUser.sub, googleUser.name, invite.role, userId).run();
  } else {
    userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, google_sub, email, name, role, status, invited_by)
       VALUES (?, ?, ?, ?, ?, 'active', (SELECT invited_by FROM invitations WHERE id = ?))`,
    ).bind(userId, googleUser.sub, googleUser.email, googleUser.name, invite.role, invite.id).run();
  }

  // Mark invitation as accepted
  await env.DB.prepare("UPDATE invitations SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?")
    .bind(invite.id).run();

  await audit(env, {
    action: "invite_accepted",
    userId,
    resourceType: "invitation",
    resourceId: invite.id,
    details: { role: invite.role, email: googleUser.email },
    request,
  });

  return issueSession(request, env, userId, googleUser.email, invite.role as UserRole, siteOrigin);
}

async function issueSession(
  request: Request,
  env: Env,
  userId: string,
  email: string,
  role: UserRole,
  siteOrigin: string,
): Promise<Response> {
  // Generate tokens
  const accessToken = await signJWT({ sub: userId, email, role }, env.JWT_SECRET, ACCESS_TOKEN_TTL);
  const refreshToken = generateRefreshToken();
  const refreshHash = await hashToken(refreshToken);

  // Create session record
  const sessionId = crypto.randomUUID();
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? null;
  const ua = request.headers.get("User-Agent") ?? null;

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, datetime('now', '+7 days'), ?, ?)`,
  ).bind(sessionId, userId, refreshHash, ip, ua).run();

  // Update last_login
  await env.DB.prepare("UPDATE users SET last_login = datetime('now'), last_active = datetime('now') WHERE id = ?")
    .bind(userId).run();

  await audit(env, { action: "login", userId, details: { method: "google_oauth" }, request });

  // Redirect to frontend with access token as hash fragment (never hits server)
  const redirectUrl = `${siteOrigin}/auth/callback#token=${accessToken}&expires_in=${ACCESS_TOKEN_TTL}`;
  const response = new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });

  return setRefreshCookie(response, refreshToken, request);
}

function setRefreshCookie(response: Response, refreshToken: string, request: Request): Response {
  const isSecure = new URL(request.url).protocol === "https:";
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `radar_refresh=${refreshToken}; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Strict; Path=/api/auth; Max-Age=${REFRESH_TOKEN_TTL}`,
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function clearRefreshCookie(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", "radar_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function redirectWithError(origin: string, message: string): Response {
  const encoded = encodeURIComponent(message);
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/auth/error?message=${encoded}` },
  });
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  }
  return cookies;
}

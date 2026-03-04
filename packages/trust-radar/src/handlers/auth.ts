import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/hash";
import { signJWT } from "../lib/jwt";
import { json } from "../lib/cors";
import type { Env } from "../types";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);
  }

  const { email, password } = parsed.data;

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();

  if (existing) {
    return json({ success: false, error: "Email already registered" }, 409, origin);
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)"
  )
    .bind(id, email, passwordHash)
    .run();

  const token = await signJWT({ sub: id, email, plan: "free" }, env.JWT_SECRET);

  return json({ success: true, data: { token, user: { id, email, plan: "free" } } }, 201, origin);
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);

  if (!parsed.success) {
    return json({ success: false, error: "Invalid request" }, 400, origin);
  }

  const { email, password } = parsed.data;

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, plan FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: string; email: string; password_hash: string; plan: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ success: false, error: "Invalid credentials" }, 401, origin);
  }

  const token = await signJWT(
    { sub: user.id, email: user.email, plan: user.plan as "free" | "pro" | "enterprise" },
    env.JWT_SECRET
  );

  return json(
    { success: true, data: { token, user: { id: user.id, email: user.email, plan: user.plan } } },
    200,
    origin
  );
}

export async function handleMe(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const user = await env.DB.prepare(
    "SELECT id, email, plan, scans_used, scans_limit, created_at FROM users WHERE id = ?"
  )
    .bind(userId)
    .first();

  if (!user) {
    return json({ success: false, error: "User not found" }, 404, origin);
  }

  return json({ success: true, data: user }, 200, origin);
}

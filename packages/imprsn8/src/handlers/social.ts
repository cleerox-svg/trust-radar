import { z } from "zod";
import { json } from "../lib/cors";
import type { Env, Platform } from "../types";

const AddSocialSchema = z.object({
  platform: z.enum(["linkedin", "twitter", "github", "instagram", "tiktok", "youtube", "website"]),
  handle: z.string().min(1).max(100),
  profile_url: z.string().url().optional(),
});

export async function handleListSocials(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const rows = await env.DB.prepare(
    "SELECT id, platform, handle, profile_url, verified, created_at FROM social_profiles WHERE user_id = ?"
  ).bind(userId).all();
  return json({ success: true, data: rows.results }, 200, origin);
}

export async function handleAddSocial(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = AddSocialSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { platform, handle, profile_url } = parsed.data;
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO social_profiles (id, user_id, platform, handle, profile_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, platform) DO UPDATE SET handle = excluded.handle, profile_url = excluded.profile_url`
  ).bind(id, userId, platform, handle, profile_url ?? null).run();

  return json({ success: true, data: { id, platform, handle, profile_url } }, 201, origin);
}

export async function handleDeleteSocial(request: Request, env: Env, userId: string, platform: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  await env.DB.prepare(
    "DELETE FROM social_profiles WHERE user_id = ? AND platform = ?"
  ).bind(userId, platform).run();
  return json({ success: true, message: "Social profile removed" }, 200, origin);
}

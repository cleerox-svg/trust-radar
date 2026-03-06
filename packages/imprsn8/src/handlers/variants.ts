import { z } from "zod";
import { json } from "../lib/cors";
import type { Env } from "../types";

const VARIANT_TYPES = ["homoglyph", "separator", "suffix", "prefix", "swap", "other"] as const;
const PLATFORMS = ["tiktok", "instagram", "x", "youtube", "facebook", "linkedin", "twitch", "threads", "snapchat", "pinterest"] as const;

const AddVariantSchema = z.object({
  platform: z.enum(PLATFORMS),
  original_handle: z.string().min(1).max(100),
  variant_handle: z.string().min(1).max(100),
  variant_type: z.enum(VARIANT_TYPES),
});

export interface HandleVariant {
  id: string;
  influencer_id: string;
  platform: string;
  original_handle: string;
  variant_handle: string;
  variant_type: string;
  is_active: number;
  created_at: string;
}

export async function handleListVariants(request: Request, env: Env, influencerId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const rows = await env.DB.prepare(
    `SELECT * FROM handle_variants WHERE influencer_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 200`
  ).bind(influencerId).all<HandleVariant>();
  return json({ success: true, data: rows.results }, 200, origin);
}

export async function handleAddVariant(request: Request, env: Env, influencerId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = AddVariantSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { platform, original_handle, variant_handle, variant_type } = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO handle_variants (id, influencer_id, platform, original_handle, variant_handle, variant_type, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(id, influencerId, platform, original_handle, variant_handle, variant_type, now).run();

  const variant = await env.DB.prepare("SELECT * FROM handle_variants WHERE id = ?").bind(id).first<HandleVariant>();
  return json({ success: true, data: variant }, 201, origin);
}

export async function handleDeleteVariant(request: Request, env: Env, influencerId: string, variantId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  await env.DB.prepare(
    `UPDATE handle_variants SET is_active = 0 WHERE id = ? AND influencer_id = ?`
  ).bind(variantId, influencerId).run();
  return json({ success: true, message: "Variant removed" }, 200, origin);
}

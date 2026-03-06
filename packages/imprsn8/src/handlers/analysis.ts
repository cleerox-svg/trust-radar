import { z } from "zod";
import { json } from "../lib/cors";
import type { Env, ScoreBreakdown, AnalysisType } from "../types";

const AnalysisSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bio"),
    input_text: z.string().min(10).max(2000),
    platform: z.enum(["linkedin", "twitter", "github", "instagram", "website"]).optional(),
  }),
  z.object({
    type: z.literal("content"),
    input_text: z.string().min(10).max(5000),
    platform: z.enum(["linkedin", "twitter", "github", "instagram", "tiktok", "youtube"]).optional(),
  }),
  z.object({
    type: z.literal("profile"),
    input_url: z.string().url(),
    platform: z.enum(["linkedin", "twitter", "github", "instagram"]),
  }),
  z.object({
    type: z.literal("portfolio"),
    input_url: z.string().url(),
  }),
]);

function scoreText(text: string): { score: number; breakdown: ScoreBreakdown; strengths: string[]; suggestions: string[] } {
  const breakdown: ScoreBreakdown = { clarity: 50, professionalism: 50, consistency: 50, impact: 50 };
  const strengths: string[] = [];
  const suggestions: string[] = [];

  // Clarity
  const words = text.split(/\s+/).filter(Boolean);
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);
  if (avgWordLen < 8) { breakdown.clarity += 20; strengths.push("Uses clear, accessible language"); }
  else { breakdown.clarity -= 10; suggestions.push("Simplify your language for broader clarity"); }
  if (words.length > 20 && words.length < 150) { breakdown.clarity += 10; }
  if (words.length < 10) { breakdown.clarity -= 20; suggestions.push("Add more detail to give readers a clear picture"); }

  // Professionalism
  const hasContactInfo = /\b[\w.+-]+@[\w-]+\.\w+\b|https?:\/\//.test(text);
  if (hasContactInfo) { breakdown.professionalism += 10; strengths.push("Includes contact information or links"); }
  const hasFirstPerson = /\bI\b|\bmy\b|\bme\b/i.test(text);
  if (hasFirstPerson) { breakdown.professionalism += 5; }
  const hasProfessionalTerms = /\bexperience\b|\bskills?\b|\bspecialize\b|\bexpert\b|\bleader\b/i.test(text);
  if (hasProfessionalTerms) { breakdown.professionalism += 15; strengths.push("Highlights professional expertise"); }
  const hasExclamation = (text.match(/!/g) || []).length > 2;
  if (hasExclamation) { breakdown.professionalism -= 10; suggestions.push("Reduce exclamation marks for a more professional tone"); }

  // Consistency (heuristic: presence of structured info)
  const hasNumbers = /\d+/.test(text);
  if (hasNumbers) { breakdown.consistency += 10; strengths.push("Uses specific numbers and metrics"); }
  const hasBullets = /[•\-*]\s/.test(text);
  if (hasBullets) { breakdown.consistency += 15; strengths.push("Well-structured with bullet points"); }

  // Impact
  const impactTerms = /\bdrove\b|\bachieved\b|\bincreased\b|\breduced\b|\bland\b|\bbuild\b|\bcreated\b|\blaunch/i;
  if (impactTerms.test(text)) { breakdown.impact += 20; strengths.push("Demonstrates concrete impact"); }
  else { suggestions.push("Add action verbs and measurable outcomes to show impact"); }
  if (words.length > 50) { breakdown.impact += 5; }

  // Clamp
  for (const k of Object.keys(breakdown) as (keyof ScoreBreakdown)[]) {
    breakdown[k] = Math.max(0, Math.min(100, breakdown[k]));
  }

  if (suggestions.length === 0) suggestions.push("Great work! Consider A/B testing different versions");
  if (strengths.length === 0) strengths.push("Good foundation to build on");

  const score = Math.round(
    (breakdown.clarity + breakdown.professionalism + breakdown.consistency + breakdown.impact) / 4
  );

  return { score, breakdown, strengths, suggestions };
}

export async function handleAnalyze(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = AnalysisSchema.safeParse(body);

  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const data = parsed.data;
  const inputText = "input_text" in data ? data.input_text : undefined;
  const inputUrl = "input_url" in data ? data.input_url : undefined;
  const platform = "platform" in data ? data.platform : undefined;

  // If it's a URL-based analysis, we'd call an external service — for now score the URL as text
  const textToScore = inputText ?? inputUrl ?? "";
  const { score, breakdown, strengths, suggestions } = scoreText(textToScore);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO analyses (id, user_id, type, input_text, input_url, platform, score, breakdown, suggestions, strengths)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, data.type,
    inputText ?? null, inputUrl ?? null, platform ?? null,
    score, JSON.stringify(breakdown), JSON.stringify(suggestions), JSON.stringify(strengths)
  ).run();

  // Update user stats — guarded in case migration 0008 hasn't run yet on this DB
  try {
    await env.DB.prepare(
      "UPDATE users SET total_analyses = total_analyses + 1, impression_score = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(score, userId).run();
  } catch {
    // Columns not yet present — skip; migration will add them on next deploy
  }

  return json({ success: true, data: { id, type: data.type, score, breakdown, strengths, suggestions } }, 200, origin);
}

export async function handleAnalysisHistory(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "10", 10));
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const rows = await env.DB.prepare(
    `SELECT id, type, input_url, platform, score, breakdown, suggestions, strengths, created_at
     FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(userId, limit, offset).all();

  const analyses = rows.results.map((r) => ({
    ...r,
    breakdown: JSON.parse(r["breakdown"] as string),
    suggestions: JSON.parse(r["suggestions"] as string),
    strengths: JSON.parse(r["strengths"] as string),
  }));

  return json({ success: true, data: analyses }, 200, origin);
}

export async function handleScoreHistory(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const rows = await env.DB.prepare(
    "SELECT score, snapshot_at as date FROM score_history WHERE user_id = ? ORDER BY snapshot_at ASC LIMIT 90"
  ).bind(userId).all();
  return json({ success: true, data: rows.results }, 200, origin);
}

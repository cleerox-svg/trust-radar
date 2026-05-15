/**
 * Averrow — Abuse Mailbox responder
 *
 * Wave-3 PR-AD: ack-on-receipt + 24h determination emails for the
 * abuse_inbox_messages flow. Pairs with:
 *   - handlers/abuseMailboxEmail.ts  (calls sendAck after INSERT)
 *   - lib/abuse-mailbox-classifier.ts (calls sendDetermination after
 *     classification completes)
 *
 * Both paths are best-effort: a Resend failure stamps an error
 * breadcrumb to console.warn but never propagates — losing an
 * outbound email is far better than losing the inbound capture.
 *
 * Suppression rules — we DON'T send to:
 *   - empty / malformed addresses
 *   - addresses on our own domains (would loop back into the same
 *     inbox handler if the recipient bounces or auto-replies)
 *   - obvious harvester / probe submissions (no submitter address
 *     extractable from the forwarded body)
 *
 * The submitter SLA from the marketing report-abuse page is:
 *   "instant ack + determination within 24 hours"
 * Ack runs synchronously from the email handler (typical latency
 * ~1-3 seconds end-to-end). Determination runs after the classifier
 * lands; since the classifier is a backfill batch (not real-time),
 * the realistic latency is the backfill cadence — well under 24h.
 */
import type { Env } from "../types";
import { logger } from "./logger";

const FROM_ADDRESS = "Averrow Abuse Triage <abuse-noreply@averrow.com>";

const SELF_DOMAINS = new Set([
  "averrow.com", "www.averrow.com",
  "averrow.ca", "www.averrow.ca",
  "trustradar.ca", "www.trustradar.ca",
  "lrxradar.com", "www.lrxradar.com",
]);

/**
 * Decide whether to send a responder email to `toAddress`. Suppresses
 * empty/malformed addresses, own-domain loops, and submissions where
 * the original submitter never identified themselves (a noreply
 * forwarder, harvester probe, etc.).
 *
 * The returned reason is logged on suppression so the operator can
 * audit silent drops in the abuse-mailbox surface.
 */
export function shouldRespond(toAddress: string | null | undefined): { send: boolean; reason: string } {
  if (!toAddress) return { send: false, reason: "no-address" };
  const trimmed = toAddress.trim().toLowerCase();
  if (!trimmed) return { send: false, reason: "empty-address" };
  const at = trimmed.indexOf("@");
  if (at < 1 || at === trimmed.length - 1) return { send: false, reason: "malformed-address" };
  const domain = trimmed.slice(at + 1);
  if (SELF_DOMAINS.has(domain)) return { send: false, reason: "own-domain-loop" };
  // Obvious noreply senders — we still send because some legit
  // platforms (Gmail group forwards) use 'noreply' in the From line
  // but accept replies. Reverse: a forwarded message FROM noreply
  // is fine to reply to since the human operator set up the forward.
  return { send: true, reason: "ok" };
}

interface ResendBody {
  id?: string;
  name?: string;
  message?: string;
  error?: string;
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let parsed: ResendBody = {};
      try { parsed = JSON.parse(body) as ResendBody; } catch { /* non-JSON */ }
      const err = [
        `HTTP ${res.status}`,
        parsed.name ?? null,
        parsed.message ?? parsed.error ?? body.slice(0, 200),
      ].filter(Boolean).join(" / ");
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Ack-on-receipt ─────────────────────────────────────────────

interface AckContext {
  /** abuse_inbox_messages.id — used in the email subject so a
   *  reply from the submitter can be threaded by support. */
  messageId: string;
  /** abuse_inbox_messages.original_subject — what the submitter
   *  forwarded. Echoing it back proves we received the right one. */
  originalSubject: string | null;
  /** Public alias the submission hit (abuse@/phishing@/report@/security@). */
  inboundAlias: string;
}

function ackHtml(ctx: AckContext): string {
  const echoSubject = ctx.originalSubject
    ? `<p style="margin:1.2em 0 0.5em;">Subject we received:</p>
       <blockquote style="margin:0;padding:0.6em 1em;border-left:3px solid #E5A832;color:#666;background:#f7f7f7;font-family:ui-monospace,Menlo,monospace;font-size:13px;">${escapeHtml(ctx.originalSubject)}</blockquote>`
    : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Report received — Averrow Abuse Triage</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;line-height:1.55;max-width:640px;margin:32px auto;padding:0 16px;">
  <p style="margin:0 0 1em;font-size:16px;"><strong>Thanks for the report.</strong></p>
  <p style="margin:0 0 1em;">A human analyst will review your submission. You'll get a determination email back within 24 hours with our triage result and any action we're taking.</p>
  ${echoSubject}
  <p style="margin:1.4em 0 0.4em;font-size:13px;color:#777;">Confirmation: <code style="font-family:ui-monospace,Menlo,monospace;background:#f3f3f3;padding:2px 6px;border-radius:3px;font-size:12px;">${escapeHtml(ctx.messageId)}</code></p>
  <p style="margin:0 0 0.4em;font-size:13px;color:#777;">Reached us via <code style="font-family:ui-monospace,Menlo,monospace;background:#f3f3f3;padding:2px 6px;border-radius:3px;font-size:12px;">${escapeHtml(ctx.inboundAlias)}</code></p>
  <hr style="margin:2em 0;border:none;border-top:1px solid #e5e5e5;">
  <p style="font-size:12px;color:#999;margin:0;">Averrow — threat intelligence + brand protection. <a href="https://averrow.com/report-abuse" style="color:#999;">averrow.com/report-abuse</a></p>
</body></html>`;
}

function ackText(ctx: AckContext): string {
  const echo = ctx.originalSubject ? `\n\nSubject we received:\n  ${ctx.originalSubject}` : "";
  return `Thanks for the report.

A human analyst will review your submission. You'll get a determination email back within 24 hours with our triage result and any action we're taking.${echo}

Confirmation: ${ctx.messageId}
Reached us via ${ctx.inboundAlias}

— Averrow Abuse Triage
https://averrow.com/report-abuse
`;
}

/**
 * Send the instant-ack email to `toAddress`. Caller is responsible
 * for marking abuse_inbox_messages.ack_sent_at = datetime('now') on
 * success. Returns ok=false (with reason) on any failure so the
 * caller can decide whether to retry on the next pass.
 */
export async function sendAck(
  env: Env,
  toAddress: string | null | undefined,
  ctx: AckContext,
): Promise<{ ok: boolean; reason: string }> {
  const decision = shouldRespond(toAddress);
  if (!decision.send) return { ok: false, reason: decision.reason };
  if (!env.RESEND_API_KEY) return { ok: false, reason: "no-resend-key" };

  const subject = `[Averrow] Report received — ${ctx.originalSubject ?? "your forwarded message"}`.slice(0, 140);
  const html = ackHtml(ctx);
  const text = ackText(ctx);
  const res = await sendViaResend(env.RESEND_API_KEY, toAddress!.trim().toLowerCase(), subject, html, text);
  if (!res.ok) {
    logger.warn("abuse_mailbox_ack_send_failed", { error: res.error, to: toAddress, msg_id: ctx.messageId });
    return { ok: false, reason: res.error ?? "send-failed" };
  }
  return { ok: true, reason: "sent" };
}

// ─── 24h determination ──────────────────────────────────────────

interface DeterminationContext {
  messageId: string;
  originalSubject: string | null;
  classification: string;   // phishing | spam | benign | malware | ambiguous
  confidence: number;       // 0-100
  reasoning: string;
  action: string;           // safe | review | escalate | takedown
}

const VERDICT_COPY: Record<string, { label: string; line: string }> = {
  phishing:  { label: "PHISHING CONFIRMED",   line: "We identified this as a phishing attempt. Don't engage with the sender; the URLs and headers are now in our threat intelligence so other monitored brands benefit too." },
  malware:   { label: "MALWARE INDICATORS",   line: "We found malware indicators in the attached or linked content. Don't open attachments or click links from the original message." },
  spam:      { label: "SPAM",                 line: "We classified this as unsolicited commercial email rather than a targeted threat. Your address is in a bulk list — consider unsubscribing or filtering at your provider." },
  benign:    { label: "BENIGN",               line: "After review we don't believe this message is a threat. It may be a legitimate but unfamiliar sender, or a marketing send from an opted-in list." },
  ambiguous: { label: "NEEDS HUMAN REVIEW",   line: "Our automated triage couldn't reach a confident verdict. A human analyst will reach out separately if we need more context from you." },
};

function determinationHtml(ctx: DeterminationContext): string {
  const v = VERDICT_COPY[ctx.classification] ?? VERDICT_COPY.ambiguous!;
  const echoSubject = ctx.originalSubject
    ? `<p style="margin:1.2em 0 0.5em;">Subject we triaged:</p>
       <blockquote style="margin:0;padding:0.6em 1em;border-left:3px solid #E5A832;color:#666;background:#f7f7f7;font-family:ui-monospace,Menlo,monospace;font-size:13px;">${escapeHtml(ctx.originalSubject)}</blockquote>`
    : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Determination — Averrow Abuse Triage</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;line-height:1.55;max-width:640px;margin:32px auto;padding:0 16px;">
  <p style="margin:0 0 0.4em;font-size:12px;letter-spacing:0.12em;color:#888;text-transform:uppercase;font-weight:600;">Determination</p>
  <p style="margin:0 0 0.8em;font-size:22px;font-weight:700;color:#222;">${escapeHtml(v.label)}</p>
  <p style="margin:0 0 1em;">${escapeHtml(v.line)}</p>
  ${echoSubject}
  <p style="margin:1.4em 0 0.5em;font-size:13px;color:#666;"><strong>Analyst notes:</strong> ${escapeHtml(ctx.reasoning)}</p>
  <p style="margin:0 0 0.4em;font-size:13px;color:#777;">Confidence: <strong style="color:#222;">${ctx.confidence}%</strong></p>
  <p style="margin:0 0 0.4em;font-size:13px;color:#777;">Action taken: <code style="font-family:ui-monospace,Menlo,monospace;background:#f3f3f3;padding:2px 6px;border-radius:3px;font-size:12px;">${escapeHtml(ctx.action)}</code></p>
  <p style="margin:1.4em 0 0.4em;font-size:13px;color:#777;">Reference: <code style="font-family:ui-monospace,Menlo,monospace;background:#f3f3f3;padding:2px 6px;border-radius:3px;font-size:12px;">${escapeHtml(ctx.messageId)}</code></p>
  <hr style="margin:2em 0;border:none;border-top:1px solid #e5e5e5;">
  <p style="font-size:12px;color:#999;margin:0;">Averrow — threat intelligence + brand protection. <a href="https://averrow.com/report-abuse" style="color:#999;">averrow.com/report-abuse</a></p>
</body></html>`;
}

function determinationText(ctx: DeterminationContext): string {
  const v = VERDICT_COPY[ctx.classification] ?? VERDICT_COPY.ambiguous!;
  const echo = ctx.originalSubject ? `\n\nSubject we triaged:\n  ${ctx.originalSubject}` : "";
  return `Determination: ${v.label}

${v.line}${echo}

Analyst notes: ${ctx.reasoning}
Confidence: ${ctx.confidence}%
Action taken: ${ctx.action}

Reference: ${ctx.messageId}

— Averrow Abuse Triage
https://averrow.com/report-abuse
`;
}

/**
 * Send the 24h determination email. Triggered after the classifier
 * has stamped classification/confidence/action on the row. Caller
 * is responsible for marking determination_sent_at on success.
 */
export async function sendDetermination(
  env: Env,
  toAddress: string | null | undefined,
  ctx: DeterminationContext,
): Promise<{ ok: boolean; reason: string }> {
  const decision = shouldRespond(toAddress);
  if (!decision.send) return { ok: false, reason: decision.reason };
  if (!env.RESEND_API_KEY) return { ok: false, reason: "no-resend-key" };

  const v = VERDICT_COPY[ctx.classification] ?? VERDICT_COPY.ambiguous!;
  const subject = `[Averrow] Determination: ${v.label} — ${ctx.originalSubject ?? "your forwarded message"}`.slice(0, 140);
  const res = await sendViaResend(
    env.RESEND_API_KEY,
    toAddress!.trim().toLowerCase(),
    subject,
    determinationHtml(ctx),
    determinationText(ctx),
  );
  if (!res.ok) {
    logger.warn("abuse_mailbox_determination_send_failed", { error: res.error, to: toAddress, msg_id: ctx.messageId });
    return { ok: false, reason: res.error ?? "send-failed" };
  }
  return { ok: true, reason: "sent" };
}

// ─── Helpers ─────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

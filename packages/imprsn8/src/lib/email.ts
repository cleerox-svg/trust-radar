/**
 * Email integration stub.
 *
 * TODO (future): configure email provider in admin settings.
 * When EMAIL_PROVIDER env var is set to "sendgrid", "resend", or "postmark",
 * this module will send real transactional email via the respective API.
 * Until then, all send functions are no-ops that return { sent: false, reason: "no_provider" }.
 *
 * Required env vars when active:
 *   EMAIL_PROVIDER  = "sendgrid" | "resend" | "postmark"
 *   EMAIL_FROM      = "noreply@yourdomain.com"
 *   EMAIL_API_KEY   = <provider API key>
 */

import type { Env } from "../types";

export type EmailResult = { sent: boolean; reason?: string };

export interface InviteEmailParams {
  to: string;
  influencerName: string;
  inviteUrl: string;
  expiresAt: string;
  notes?: string;
}

/**
 * Sends an influencer invite email.
 * Currently a no-op — returns { sent: false, reason: "no_provider" } until
 * email provider is configured via EMAIL_PROVIDER env var.
 */
export async function sendInviteEmail(
  _params: InviteEmailParams,
  env: Env,
): Promise<EmailResult> {
  // TODO: check env.EMAIL_PROVIDER and dispatch to real provider
  // Example integration points:
  //   "resend"     → POST https://api.resend.com/emails  (Authorization: Bearer EMAIL_API_KEY)
  //   "sendgrid"   → POST https://api.sendgrid.com/v3/mail/send
  //   "postmark"   → POST https://api.postmarkapp.com/email
  void env; // suppress unused warning until implemented
  return { sent: false, reason: "no_provider" };
}

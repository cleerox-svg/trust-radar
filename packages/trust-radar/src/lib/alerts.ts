/**
 * Unified alerts pipeline — creation, retrieval, and status management.
 *
 * Alert types map to specific brand-threat detection modules:
 *   social_impersonation, phishing_detected, email_grade_change,
 *   lookalike_domain_active, ct_certificate_issued, threat_feed_match
 */

export type AlertType =
  | 'social_impersonation'
  | 'app_store_impersonation'
  | 'phishing_detected'
  | 'email_grade_change'
  | 'lookalike_domain_active'
  | 'ct_certificate_issued'
  | 'threat_feed_match'
  | 'bimi_removed'
  | 'dmarc_downgraded'
  | 'vmc_expiring'
  | 'typosquat_bimi'
  | 'takedown_resurrected';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';

export interface CreateAlertParams {
  brandId: string;
  userId: string;
  alertType: AlertType;
  severity: Severity;
  title: string;
  summary: string;
  details?: Record<string, any>;
  sourceType?: string;
  sourceId?: string;
  aiAssessment?: string;
  aiRecommendations?: string[];
}

export interface Alert {
  id: string;
  brand_id: string;
  user_id: string;
  alert_type: AlertType;
  severity: Severity;
  title: string;
  summary: string;
  details: string | null;
  source_type: string | null;
  source_id: string | null;
  ai_assessment: string | null;
  ai_recommendations: string | null;
  status: AlertStatus;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  email_sent: number;
  webhook_sent: number;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new alert and return its ID.
 */
export async function createAlert(db: D1Database, params: CreateAlertParams): Promise<string> {
  const id = crypto.randomUUID();
  const detailsJson = params.details ? JSON.stringify(params.details) : null;
  const recommendationsJson = params.aiRecommendations ? JSON.stringify(params.aiRecommendations) : null;

  await db.prepare(
    `INSERT INTO alerts (id, brand_id, user_id, alert_type, severity, title, summary, details, source_type, source_id, ai_assessment, ai_recommendations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    params.brandId,
    params.userId,
    params.alertType,
    params.severity,
    params.title,
    params.summary,
    detailsJson,
    params.sourceType ?? null,
    params.sourceId ?? null,
    params.aiAssessment ?? null,
    recommendationsJson,
  ).run();

  return id;
}

/**
 * Query alerts with optional filters and pagination.
 */
export async function getAlerts(db: D1Database, userId: string, opts?: {
  status?: AlertStatus;
  severity?: Severity;
  brandId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: Alert[]; total: number }> {
  const limit = Math.min(100, opts?.limit ?? 50);
  const offset = opts?.offset ?? 0;

  let where = `WHERE user_id = ?`;
  const params: unknown[] = [userId];

  if (opts?.status) {
    where += ` AND status = ?`;
    params.push(opts.status);
  }
  if (opts?.severity) {
    where += ` AND severity = ?`;
    params.push(opts.severity);
  }
  if (opts?.brandId) {
    where += ` AND brand_id = ?`;
    params.push(opts.brandId);
  }

  // Get total count
  const countRow = await db.prepare(
    `SELECT COUNT(*) as c FROM alerts ${where}`
  ).bind(...params).first<{ c: number }>();
  const total = countRow?.c ?? 0;

  // Get paginated results
  const rows = await db.prepare(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all<Alert>();

  return { alerts: rows.results, total };
}

/**
 * Update alert status with appropriate timestamp tracking.
 */
export async function updateAlertStatus(
  db: D1Database,
  alertId: string,
  status: AlertStatus,
  notes?: string,
): Promise<boolean> {
  let extra = ``;
  const params: unknown[] = [status];

  if (status === 'acknowledged') {
    extra = `, acknowledged_at = datetime('now')`;
  } else if (status === 'resolved' || status === 'false_positive') {
    extra = `, resolved_at = datetime('now')`;
    if (notes) {
      extra += `, resolution_notes = ?`;
      params.push(notes);
    }
  }

  params.push(alertId);

  const result = await db.prepare(
    `UPDATE alerts SET status = ?${extra}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...params).run();

  return (result.meta.changes ?? 0) > 0;
}

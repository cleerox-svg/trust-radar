// Unified Profile types shared between averrow-ops and averrow-tenant.
//
// Per SHARED_LOGIN_SPEC §2 these surfaces must stay structurally
// identical. The shared component model is the canonical source of
// truth — both products import the same ProfilePage and pass
// product-specific deltas (apiClient, features, onLogout, etc.).

export interface ProfileUser {
  id: string;
  email: string;
  /** Backend-computed: display_name ?? name. */
  name: string;
  role: string;
  display_name?: string | null;
  timezone?: string | null;
  theme_preference?: 'dark' | 'light' | null;
  passkey_count?: number;
  organization?: {
    id:    number;
    name:  string;
    slug:  string;
    plan:  string;
    role:  string;
  } | null;
}

export interface PasskeyDevice {
  id:           string;
  device_label: string | null;
  user_agent:   string | null;
  backed_up:    number;
  /** ["internal"] = Touch ID / Face ID / Windows Hello. */
  transports:   string[];
  created_at:   string;
  last_used_at: string | null;
}

export interface SessionRow {
  id:           string;
  ip_address:   string | null;
  user_agent:   string | null;
  issued_at:    string;
}

export interface SessionSummary {
  total:    number;
  sessions: SessionRow[];
}

// ─── HTTP client adapter ─────────────────────────────────────
//
// Each app passes its own client. Keeps ProfilePage HTTP-agnostic
// (averrow-ops uses lib/api, averrow-tenant uses lib/api with
// different shape; both wrap the same backend endpoints).

export interface ProfileApiResponse<T> {
  success: boolean;
  data?:   T;
  error?:  string;
}

export interface ProfileApiClient {
  get<T>(path: string):                Promise<ProfileApiResponse<T>>;
  patch<T>(path: string, body: unknown): Promise<ProfileApiResponse<T>>;
  post<T>(path: string, body?: unknown): Promise<ProfileApiResponse<T>>;
  delete<T>(path: string):             Promise<ProfileApiResponse<T>>;
}

// ─── Per-product feature flags ────────────────────────────────

export type ProfileFeature =
  | 'identity'
  | 'account'
  | 'preferences'
  | 'install'
  | 'passkeys'
  | 'notifications'
  | 'security'
  | 'organization'   // staff-only — current org context
  | 'billing';       // tenant-only — links to /settings/billing

// ─── Passkey adapter ─────────────────────────────────────────
//
// Both apps already have their own @simplewebauthn/browser
// integrations in lib/passkeys.ts. ProfilePage doesn't talk to
// WebAuthn directly; it calls the registerPasskey callback from
// the host app, which handles the OS prompt + finish.

export interface PasskeyAdapter {
  isSupported:      () => boolean;
  list:             () => Promise<PasskeyDevice[]>;
  register:         (deviceLabel?: string) => Promise<void>;
  remove:           (id: string) => Promise<void>;
}

// ─── ProfilePage props ───────────────────────────────────────

export interface ProfilePageProps {
  user:           ProfileUser;
  apiClient:      ProfileApiClient;
  features:       ProfileFeature[];
  passkeyAdapter: PasskeyAdapter;
  /** Product brand text shown in the page heading. */
  productName:    string;
  /** Product subtitle below brand. e.g. "Threat Interceptor" or "Tenant". */
  productSubtitle?: string;
  /** Refresh /api/auth/me after profile edits. */
  onUserUpdated:  () => void;
  /** Called after ProfilePage mutates anything that needs cache busting. */
  onToast:        (message: string, kind: 'success' | 'error') => void;
  /** Navigate to a path within the host app — e.g. /notifications/preferences,
   *  /settings/billing. ProfilePage uses this for the link rows. */
  onNavigate:     (path: string) => void;
  /** Logout button handler — host app handles backend revocation
   *  + redirect. */
  onLogout:       () => void;
  /** Routes for the inline link rows. Defaults shown in comments. */
  notificationsHref?: string;        // default: /notifications/preferences
  billingHref?:       string;        // default: /settings/billing

  /** SecuritySection: GET endpoint for active sessions list.
   *  Default: /api/admin/sessions (existing /v2 admin endpoint). */
  sessionsEndpoint?: string;
  /** SecuritySection: POST endpoint to revoke OTHER sessions.
   *  Default: /api/admin/users/:userId/force-logout (must include
   *  the calling user's id; consumer fills it in). */
  revokeEndpoint?:   string;
}

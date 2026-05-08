// /tenant/profile — averrow-tenant profile route.
//
// Per SHARED_LOGIN_SPEC §2 the Profile UI is canonical and lives
// in @averrow/shared/profile. Both averrow-ops and averrow-tenant
// render the same ProfilePage with product-specific deltas.
// Edit the shared component, NOT this wrapper.

import { useNavigate } from 'react-router-dom';
import { ProfilePage } from '@averrow/shared/profile';
import type { ProfileApiClient, ProfileApiResponse, PasskeyAdapter } from '@averrow/shared/profile';
import { useAuth } from '@/lib/auth';
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api';
import { isPasskeySupported, registerPasskey, listPasskeys, removePasskey } from '@/lib/passkeys';

// Adapter: tenant's apiGet/apiPost/apiPatch/apiDelete throw on
// non-2xx, so wrap each in try/catch to produce the
// ProfileApiResponse shape the shared component expects.
async function adapt<T>(p: Promise<{ success: true; data: T; total?: number }>): Promise<ProfileApiResponse<T>> {
  try {
    const res = await p;
    return { success: res.success, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
}

const apiClient: ProfileApiClient = {
  get:    <T,>(path: string) => adapt<T>(apiGet<T>(path)),
  patch:  <T,>(path: string, body: unknown) => adapt<T>(apiPatch<T>(path, body)),
  post:   <T,>(path: string, body?: unknown) => adapt<T>(apiPost<T>(path, body ?? {})),
  delete: <T,>(path: string) => adapt<T>(apiDelete<T>(path)),
};

const passkeyAdapter: PasskeyAdapter = {
  isSupported: isPasskeySupported,
  list:        listPasskeys,
  register:    registerPasskey,
  remove:      removePasskey,
};

export function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  // Tiny in-page toast — averrow-tenant doesn't have a global toast
  // provider yet. ProfilePage's onToast is best-effort surface;
  // network errors land here as a brief native alert. When the
  // tenant gets a Toast provider this swaps to it.
  const onToast = (msg: string, kind: 'success' | 'error') => {
    if (typeof window !== 'undefined' && kind === 'error') {
      // Don't alert on success — too noisy.
      console.error(msg);
    }
  };

  return (
    <ProfilePage
      user={{
        id:               user.id,
        email:            user.email,
        name:             user.name,
        role:             user.role,
        display_name:     user.display_name ?? null,
        organization:     user.organization
          ? {
              id:    user.organization.id,
              name:  user.organization.name,
              slug:  user.organization.slug,
              plan:  user.organization.plan,
              role:  user.organization.role,
            }
          : null,
      }}
      apiClient={apiClient}
      passkeyAdapter={passkeyAdapter}
      // Tenant features. No 'security' yet — backend admin sessions
      // endpoint is super_admin-only; a tenant-scoped session list
      // lands in a follow-up. Billing is the tenant-only delta.
      features={['identity', 'account', 'preferences', 'passkeys', 'notifications', 'billing']}
      productName="Averrow"
      productSubtitle="Tenant"
      onUserUpdated={() => { /* AuthProvider on next mount; tenant doesn't refetch /me eagerly */ }}
      onToast={onToast}
      onNavigate={(path) => navigate(path)}
      onLogout={() => { void logout(); }}
      billingHref="/settings/billing"
      notificationsHref="/notifications"
    />
  );
}

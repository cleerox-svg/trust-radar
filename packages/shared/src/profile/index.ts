// @averrow/shared/profile — unified Profile page for averrow-ops
// and averrow-tenant per SHARED_LOGIN_SPEC §2.
//
// Both apps import ProfilePage and pass product-specific deltas:
//
//   <ProfilePage
//     user={user}
//     apiClient={...}
//     features={['identity', 'account', 'preferences', 'passkeys',
//                'notifications', 'security', /* 'billing' (tenant)
//                | 'install' (PWA) | 'organization' (staff) */]}
//     passkeyAdapter={...}
//     productName="Averrow"
//     productSubtitle="Threat Interceptor"
//     onUserUpdated={refreshUser}
//     onToast={(msg, kind) => showToast(msg, kind)}
//     onNavigate={(path) => navigate(path)}
//     onLogout={logout}
//   />

export { ProfilePage } from './ProfilePage';
export type {
  ProfileUser, ProfileApiClient, ProfileApiResponse, ProfileFeature,
  ProfilePageProps, PasskeyDevice, PasskeyAdapter, SessionRow, SessionSummary,
} from './types';

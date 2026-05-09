// Re-export the canonical avatar helpers from @averrow/shared/avatar.
// Per the unification arc, parseInitials / colorForUserId /
// SELF_AVATAR_COLOR live in the shared package. This file
// preserves the @/lib/avatar import path so existing call sites
// don't need to change.
export { parseInitials, colorForUserId, SELF_AVATAR_COLOR } from '@averrow/shared/avatar';

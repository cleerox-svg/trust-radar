// /tenant passkey lib — thin wrapper over @averrow/shared/passkeys.
//
// Per SHARED_LOGIN_SPEC the WebAuthn flows are canonical and live
// in the shared package. This file just instantiates the client
// with the tenant HTTP adapter (try/catch around the throwing
// apiGet/apiPost/apiDelete to produce the standard envelope) and
// re-exports the surface so existing call sites keep working.

import { createPasskeyClient } from '@averrow/shared/passkeys';
import type { PasskeyApiResponse, PasskeyHttpClient } from '@averrow/shared/passkeys';
import { apiGet, apiPost, apiDelete } from './api';

async function adapt<T>(p: Promise<{ success: true; data: T; total?: number }>): Promise<PasskeyApiResponse<T>> {
  try {
    const res = await p;
    return { success: res.success, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
}

const httpClient: PasskeyHttpClient = {
  get:    <T,>(path: string) => adapt<T>(apiGet<T>(path)),
  post:   <T,>(path: string, body?: unknown) => adapt<T>(apiPost<T>(path, body ?? {})),
  delete: <T,>(path: string) => adapt<T>(apiDelete<T>(path)),
};

const client = createPasskeyClient(httpClient, { defaultReturnTo: '/tenant/' });

export const isPasskeySupported   = client.isSupported;
export const isAutofillSupported  = client.isAutofillSupported;
export const startConditionalUI   = client.startConditionalUI;
export const signInWithPasskey    = client.signInWithPasskey;
export const registerPasskey      = client.registerPasskey;
export const listPasskeys         = client.listPasskeys;
export const removePasskey        = client.removePasskey;

export type { PasskeyDevice, SignInOptions } from '@averrow/shared/passkeys';

// Passkey (WebAuthn) browser-side helpers for averrow-tenant.
//
// Mirrors averrow-ops/src/lib/passkeys.ts using the tenant's
// apiGet/apiPost/apiDelete wrappers. Both products talk to the
// same backend endpoints (/api/passkeys/*); only the HTTP client
// shape differs.
//
// FUTURE: lift this whole module into @averrow/shared once a
// shared HTTP client adapter pattern is in place.

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import { apiGet, apiPost, apiDelete } from './api';

export interface PasskeyDevice {
  id:           string;
  device_label: string | null;
  user_agent:   string | null;
  backed_up:    number;
  transports:   string[];
  created_at:   string;
  last_used_at: string | null;
}

export function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn();
}

export async function isAutofillSupported(): Promise<boolean> {
  try {
    return await browserSupportsWebAuthnAutofill();
  } catch {
    return false;
  }
}

export async function registerPasskey(deviceLabel?: string): Promise<void> {
  if (!isPasskeySupported()) throw new Error('This browser does not support passkeys.');

  const begin = await apiPost<PublicKeyCredentialCreationOptionsJSON>(
    '/api/passkeys/register/begin', {},
  );
  if (!begin.data) throw new Error('Failed to start passkey registration.');

  const attResp = await startRegistration({ optionsJSON: begin.data });

  await apiPost<{ success: boolean }>('/api/passkeys/register/finish', {
    response: attResp,
    device_label: deviceLabel,
  });
}

interface BeginResponse extends PublicKeyCredentialRequestOptionsJSON {
  challenge_key: string;
}

export interface SignInOptions {
  email?:       string;
  conditional?: boolean;
  returnTo?:    string;
}

export async function signInWithPasskey(opts: SignInOptions = {}): Promise<boolean> {
  if (!isPasskeySupported()) throw new Error('This browser does not support passkeys.');

  const begin = await apiPost<BeginResponse>('/api/passkeys/auth/begin', { email: opts.email });
  if (!begin.data) throw new Error('Failed to start passkey sign-in.');

  const { challenge_key, ...optionsJSON } = begin.data;

  let assertResp;
  try {
    assertResp = await startAuthentication({
      optionsJSON,
      useBrowserAutofill: opts.conditional ?? false,
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
      return false;
    }
    throw err;
  }

  const finish = await apiPost<{ access_token: string; expires_in: number; return_to: string }>(
    '/api/passkeys/auth/finish',
    { response: assertResp, challenge_key, return_to: opts.returnTo ?? '/tenant/' },
  );
  if (!finish.data) throw new Error('Passkey verification failed.');

  const { access_token, expires_in, return_to } = finish.data;
  window.location.assign(`${return_to}#token=${access_token}&expires_in=${expires_in}`);
  return true;
}

export async function startConditionalUI(returnTo?: string): Promise<void> {
  if (!isPasskeySupported()) return;
  if (!(await isAutofillSupported())) return;
  try {
    await signInWithPasskey({ conditional: true, returnTo });
  } catch { /* silent */ }
}

export async function listPasskeys(): Promise<PasskeyDevice[]> {
  const res = await apiGet<PasskeyDevice[]>('/api/passkeys');
  return res.data ?? [];
}

export async function removePasskey(id: string): Promise<void> {
  await apiDelete(`/api/passkeys/${id}`);
}

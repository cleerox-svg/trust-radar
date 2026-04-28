// Auto-prompt to set up biometric sign-in (Touch ID / Face ID /
// Windows Hello / Android fingerprint) on first sign-in. Triggers when:
//   · WebAuthn supported (isPasskeySupported)
//   · user has zero passkeys (passkey_count === 0)
//   · user hasn't dismissed before on this device (localStorage flag)
//
// Dismissal lives in localStorage per-device. A user with multiple
// devices sees the prompt once on each — that's intentional, since
// each device needs its own platform-authenticator credential.
//
// "Maybe later" closes WITHOUT marking dismissed (gives the user a
// chance to come back to it on the next visit). Only "Set up
// biometric" or the click-outside / × close path marks dismissed.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { isPasskeySupported, registerPasskey } from '@/lib/passkeys';

const DISMISS_KEY = 'averrow.passkey-prompt.dismissed';

function isDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; }
  catch { return false; }
}

function markDismissed(): void {
  try { localStorage.setItem(DISMISS_KEY, '1'); }
  catch { /* SSR / private mode */ }
}

export function FirstSignInPasskeyPrompt() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if ((user.passkey_count ?? 0) > 0) return;
    if (isDismissed()) return;
    if (!isPasskeySupported()) return;
    // Slight delay so the prompt doesn't slam in right at sign-in.
    const t = window.setTimeout(() => setOpen(true), 1000);
    return () => window.clearTimeout(t);
  }, [user]);

  if (!open) return null;

  const onAdd = async () => {
    setBusy(true);
    try {
      await registerPasskey();
      showToast('Biometric sign-in is set up.', 'success');
      markDismissed();
      setOpen(false);
      // Refresh /me so passkey_count goes 0 → 1 (suppresses the
      // re-prompt on next mount).
      await refreshUser();
    } catch (err) {
      // DOMException with NotAllowedError = user cancelled the OS
      // prompt — silent close, no dismiss flag.
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setOpen(false);
      } else {
        showToast(err instanceof Error ? err.message : "Couldn't add passkey", 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const onSkip = () => {
    markDismissed();
    setOpen(false);
  };

  // "Maybe later" — close without dismissing, so the prompt shows again
  // next session.
  const onMaybeLater = () => setOpen(false);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="passkey-prompt-title"
      onClick={onSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 550,
        background: 'rgba(4,9,18,0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sm:items-center"
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(160deg, var(--bg-card) 0%, var(--bg-card-deep, var(--bg-card)) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border-strong, var(--border-base))',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, var(--green), rgba(60,184,120,0.7))',
            color: 'var(--text-on-amber, #0A0F1E)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px rgba(60,184,120,0.40)',
          }}
        >
          <svg
            width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <h2
          id="passkey-prompt-title"
          style={{
            color: 'var(--text-primary)',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.3,
            textAlign: 'center',
            margin: 0,
          }}
        >
          Sign in faster next time?
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: 'center',
            margin: '8px 0 0',
          }}
        >
          Set up biometric sign-in (Touch ID, Face ID, Windows Hello, or
          your phone's fingerprint) for one-tap access. No password
          required. Your biometric stays on this device — only a public
          key is shared with Averrow.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void onAdd()}
            disabled={busy}
            className="font-mono uppercase"
            style={{
              background: 'linear-gradient(135deg, var(--green), rgba(60,184,120,0.7))',
              color: 'var(--text-on-amber, #0A0F1E)',
              border: '1px solid rgba(60,184,120,0.60)',
              padding: '12px 20px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.10em',
              minHeight: 44,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: '0 4px 16px rgba(60,184,120,0.30)',
            }}
          >
            {busy ? 'Setting up…' : 'Set up biometric'}
          </button>
          <button
            type="button"
            onClick={onMaybeLater}
            disabled={busy}
            className="font-mono uppercase"
            style={{
              background: 'transparent',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-base)',
              padding: '10px 20px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              minHeight: 40,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>
        <p
          className="font-mono"
          style={{
            color: 'var(--text-tertiary)',
            fontSize: 10,
            lineHeight: 1.5,
            textAlign: 'center',
            letterSpacing: '0.02em',
            margin: '12px 0 0',
          }}
        >
          You can add or remove passkeys anytime from your Profile.
        </p>
      </div>
    </div>,
    document.body,
  );
}

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { AverrowLogo } from '@/components/brand/AverrowLogo';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import {
  isPasskeySupported, signInWithPasskey, startConditionalUI,
} from '@/lib/passkeys';

type MagicLinkState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string; minutes: number }
  | { kind: 'error'; message: string };

export function Login() {
  const { login } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [magicLink, setMagicLink] = useState<MagicLinkState>({ kind: 'idle' });

  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const conditionalStarted = useRef(false);

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
    // Conditional UI: starts the WebAuthn ceremony in the background so
    // the OS credential picker appears in the email field's autofill
    // dropdown. Only fire once per page load — re-firing aborts the
    // prior ceremony and looks broken to the user.
    if (!conditionalStarted.current && isPasskeySupported()) {
      conditionalStarted.current = true;
      startConditionalUI('/v2/observatory');
    }
  }, []);

  const handlePasskey = async () => {
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      const ok = await signInWithPasskey({
        email: email.trim() || undefined,
        returnTo: '/v2/observatory',
      });
      if (!ok) {
        // User dismissed the OS prompt — silent return.
        setPasskeyBusy(false);
      }
      // On success, signInWithPasskey navigates the page; this component unmounts.
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'Passkey sign-in failed.');
      setPasskeyBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setMagicLink({ kind: 'sending' });
    try {
      const res = await api.post<{ message?: string; expires_in_minutes?: number; error?: string }>(
        '/api/auth/magic-link/request',
        { email: email.trim(), return_to: '/v2/observatory' },
      );
      if (res.success === false) {
        setMagicLink({ kind: 'error', message: res.error || 'Request failed.' });
        return;
      }
      setMagicLink({
        kind: 'sent',
        email: email.trim(),
        minutes: res.data?.expires_in_minutes ?? 30,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.';
      setMagicLink({ kind: 'error', message });
    }
  };

  return (
    <div className="animate-fade-in min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-full max-w-sm px-6 text-center space-y-8">
        <AverrowLogo size="large" />
        <div>
          <h1 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
            Sign in to access the Observatory
          </p>
        </div>

        {/* ─── Primary: Passkey (when supported) ─────── */}
        {passkeySupported && (
          <div className="space-y-2">
            <Button
              onClick={handlePasskey}
              size="lg"
              variant="primary"
              disabled={passkeyBusy}
              className="w-full"
            >
              {passkeyBusy ? 'Verifying…' : 'Sign in with passkey'}
            </Button>
            {passkeyError && (
              <p className="text-[11px]" style={{ color: '#f87171' }}>
                {passkeyError}
              </p>
            )}
          </div>
        )}

        {/* ─── Google ─────────────────────────────────── */}
        <Button
          onClick={login}
          size={passkeySupported ? 'md' : 'lg'}
          variant={passkeySupported ? 'secondary' : 'primary'}
          className="w-full"
        >
          Sign in with Google
        </Button>

        {/* ─── Divider ────────────────────────────────── */}
        <div className="flex items-center gap-3" aria-hidden>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
            or
          </span>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* ─── Magic-link form ────────────────────────── */}
        {magicLink.kind === 'sent' ? (
          <div
            className="text-left p-4 rounded-lg space-y-2"
            style={{ background: 'rgba(60,184,120,0.08)', border: '1px solid rgba(60,184,120,0.25)' }}
          >
            <p className="text-[13px] font-medium" style={{ color: '#3CB878' }}>
              Check your inbox
            </p>
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
              If an account exists for <span className="font-mono">{magicLink.email}</span>, we just sent
              a sign-in link. It expires in {magicLink.minutes} minutes and can only be used once.
            </p>
            <button
              onClick={() => { setMagicLink({ kind: 'idle' }); setEmail(''); setShowEmail(false); }}
              className="text-[11px] underline"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Use a different email
            </button>
          </div>
        ) : showEmail ? (
          <form onSubmit={handleSubmit} className="space-y-3 text-left">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Work email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                /* `username webauthn` enables the OS credential picker
                   to surface passkey suggestions inline in this field
                   (browser autofill / Conditional UI). */
                autoComplete="username webauthn"
                autoFocus
                required
                disabled={magicLink.kind === 'sending'}
                className="w-full px-3 py-2.5 rounded-md text-[14px]"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.92)',
                }}
              />
            </label>
            {magicLink.kind === 'error' && (
              <p className="text-[11px]" style={{ color: '#f87171' }}>
                {magicLink.message}
              </p>
            )}
            <Button type="submit" size="md" disabled={magicLink.kind === 'sending'} className="w-full">
              {magicLink.kind === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
            <button
              type="button"
              onClick={() => { setShowEmail(false); setMagicLink({ kind: 'idle' }); }}
              className="block w-full text-[11px]"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowEmail(true)}
            className="text-[12px] underline"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Sign in with email instead
          </button>
        )}
      </div>
    </div>
  );
}

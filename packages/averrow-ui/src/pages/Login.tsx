import { useAuth } from '@/lib/auth';
import { AverrowLogo } from '@/components/brand/AverrowLogo';
import { Button } from '@/components/ui/Button';

export function Login() {
  const { login } = useAuth();

  return (
    <div className="animate-fade-in min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="text-center space-y-8">
        <AverrowLogo size="large" />
        <div>
          <h1 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
            Sign in to access the Observatory
          </p>
        </div>
        <Button onClick={login} size="lg">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}

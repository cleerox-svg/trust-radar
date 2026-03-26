import { useAuth } from '@/lib/auth';
import { AverrowLogo } from '@/components/brand/AverrowLogo';
import { Button } from '@/components/ui/Button';

export function Login() {
  const { login } = useAuth();

  return (
    <div className="animate-fade-in min-h-screen bg-cockpit flex items-center justify-center">
      <div className="text-center space-y-8">
        <AverrowLogo size="large" />
        <div>
          <h1 className="font-display text-2xl font-bold text-parchment mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-contrail/60">
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

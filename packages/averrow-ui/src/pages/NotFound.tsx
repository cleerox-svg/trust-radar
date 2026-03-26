import { Card, CardHeader } from '@/components/ui/Card';

export function NotFound() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Not Found</h1>
      <Card>
        <CardHeader>404</CardHeader>
        <p className="text-sm text-contrail/60">The page you're looking for doesn't exist.</p>
      </Card>
    </div>
  );
}

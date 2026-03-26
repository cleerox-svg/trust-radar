import { Card, CardHeader } from '@/components/ui/Card';

export function Takedowns() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Takedowns</h1>
      <Card>
        <CardHeader>Takedown Requests</CardHeader>
        <p className="text-sm text-contrail/60">Takedowns view — migrating from legacy SPA</p>
      </Card>
    </div>
  );
}

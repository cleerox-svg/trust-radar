import { Card, CardHeader } from '@/components/ui/Card';

export function Observatory() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Observatory</h1>
      <Card>
        <CardHeader>Threat Map</CardHeader>
        <p className="text-sm text-contrail/60">Observatory view — migrating from legacy SPA</p>
      </Card>
    </div>
  );
}

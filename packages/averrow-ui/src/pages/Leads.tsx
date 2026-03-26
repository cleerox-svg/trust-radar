import { Card, CardHeader } from '@/components/ui/Card';

export function Leads() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Leads</h1>
      <Card>
        <CardHeader>Lead Pipeline</CardHeader>
        <p className="text-sm text-contrail/60">Leads view — migrating from legacy SPA</p>
      </Card>
    </div>
  );
}

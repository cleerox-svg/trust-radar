import { Card, CardHeader } from '@/components/ui/Card';

export function Agents() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Agents</h1>
      <Card>
        <CardHeader>Agent Overview</CardHeader>
        <p className="text-sm text-contrail/60">Agents view — migrating from legacy SPA</p>
      </Card>
    </div>
  );
}

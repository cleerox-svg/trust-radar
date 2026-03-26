import { Card, CardHeader } from '@/components/ui/Card';

export function AgentConfig() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Agent Config</h1>
      <Card>
        <CardHeader>Configuration</CardHeader>
        <p className="text-sm text-contrail/60">Agent configuration — migrating from legacy SPA</p>
      </Card>
    </div>
  );
}

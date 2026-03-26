import { Card, CardHeader } from '@/components/ui/Card';

export function SpamTrap() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Spam Trap</h1>
      <Card>
        <CardHeader>Spam Intelligence</CardHeader>
        <p className="text-sm text-contrail/60">Spam trap view — migrating from legacy SPA</p>
      </Card>
    </div>
  );
}

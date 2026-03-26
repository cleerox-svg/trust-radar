import { Card, CardHeader } from '@/components/ui/Card';

export function AdminDashboard() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-xl font-bold text-parchment mb-6">Admin Dashboard</h1>
      <Card>
        <CardHeader>System Overview</CardHeader>
        <p className="text-sm text-contrail/60">Admin dashboard — migrating from legacy SPA</p>
      </Card>
    </div>
  );
}

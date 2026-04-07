import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignDetail } from '@/hooks/useCampaigns';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaignDetail(campaignId || '');

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate('/campaigns')} className="font-mono text-xs text-contrail/50 hover:text-accent transition-colors">
        &larr; Back to Operations
      </button>
      <Card hover={false}>
        <h1 className="font-display text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {campaign?.name || 'Campaign'}
        </h1>
        <p className="text-sm text-contrail/60">Detail view coming soon</p>
      </Card>
    </div>
  );
}

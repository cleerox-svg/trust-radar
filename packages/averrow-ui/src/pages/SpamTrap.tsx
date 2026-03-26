import { useState } from 'react';
import { useSpamTrapStats, useSpamTrapCaptures, useSpamTrapCapture, useSpamTrapHealth, useSpamTrapCampaigns } from '@/hooks/useSpamTrap';
import type { SpamTrapCapture } from '@/hooks/useSpamTrap';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Table, Th, Td } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { relativeTime } from '@/lib/time';

function authVariant(result: string | null): 'success' | 'critical' | 'default' {
  if (!result) return 'default';
  if (result.toLowerCase() === 'pass') return 'success';
  if (result.toLowerCase() === 'fail') return 'critical';
  return 'default';
}

function categoryVariant(cat: string): 'critical' | 'high' | 'default' {
  const c = cat.toLowerCase();
  if (c === 'phishing' || c === 'malware') return 'critical';
  if (c === 'spam') return 'high';
  return 'default';
}

function severityVariant(s: string): 'critical' | 'high' | 'medium' | 'low' | 'default' {
  const sv = s.toLowerCase();
  if (sv === 'critical') return 'critical';
  if (sv === 'high') return 'high';
  if (sv === 'medium') return 'medium';
  if (sv === 'low') return 'low';
  return 'default';
}

function healthVariant(count: number): 'success' | 'info' | 'default' {
  if (count > 10) return 'success';
  if (count > 0) return 'info';
  return 'default';
}

function CaptureDetail({ captureId }: { captureId: number }) {
  const { data, isLoading } = useSpamTrapCapture(captureId);

  if (isLoading) return <Skeleton className="h-32 rounded-lg mt-3" />;
  if (!data) return null;

  const detail = data as Record<string, unknown>;

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <span className="font-mono text-[10px] text-contrail/40 uppercase">SPF</span>
          <div className="text-sm text-parchment">{String(detail.spf_result ?? 'none')}</div>
        </div>
        <div>
          <span className="font-mono text-[10px] text-contrail/40 uppercase">DKIM</span>
          <div className="text-sm text-parchment">{String(detail.dkim_result ?? 'none')}</div>
        </div>
        <div>
          <span className="font-mono text-[10px] text-contrail/40 uppercase">DMARC</span>
          <div className="text-sm text-parchment">{String(detail.dmarc_result ?? 'none')}</div>
        </div>
      </div>

      {Boolean(detail.sender_ip) && (
        <div>
          <span className="font-mono text-[10px] text-contrail/40 uppercase">Sender IP</span>
          <div className="font-mono text-xs text-parchment">{String(detail.sender_ip)}</div>
        </div>
      )}

      {Boolean(detail.body_preview) && (
        <div>
          <span className="font-mono text-[10px] text-contrail/40 uppercase block mb-1">Body Preview</span>
          <div className="font-mono bg-cockpit p-4 rounded-lg text-xs max-h-60 overflow-auto text-contrail/70 whitespace-pre-wrap">
            {String(detail.body_preview)}
          </div>
        </div>
      )}

      {Array.isArray(detail.extracted_urls) && (detail.extracted_urls as string[]).length > 0 && (
        <div>
          <span className="font-mono text-[10px] text-contrail/40 uppercase block mb-1">Extracted URLs</span>
          <ul className="space-y-0.5">
            {(detail.extracted_urls as string[]).map((url, i) => (
              <li key={i} className="font-mono text-xs text-accent truncate">{url}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CaptureRow({ capture, isExpanded, onToggle }: { capture: SpamTrapCapture; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={onToggle}>
        <Td><span className="font-mono text-xs">{capture.from_address ?? capture.from_domain ?? '—'}</span></Td>
        <Td><span className="text-xs text-parchment/80 truncate block max-w-[200px]">{capture.subject ?? '—'}</span></Td>
        <Td><span className="text-xs text-contrail/60">{capture.brand_name ?? '—'}</span></Td>
        <Td><Badge variant={authVariant(capture.spf_result)}>{capture.spf_result ?? 'none'}</Badge></Td>
        <Td><Badge variant={authVariant(capture.dkim_result)}>{capture.dkim_result ?? 'none'}</Badge></Td>
        <Td><Badge variant={authVariant(capture.dmarc_result)}>{capture.dmarc_result ?? 'none'}</Badge></Td>
        <Td><Badge variant={categoryVariant(capture.category)}>{capture.category}</Badge></Td>
        <Td><Badge variant={severityVariant(capture.severity)}>{capture.severity}</Badge></Td>
        <Td><span className="font-mono text-xs text-contrail/40">{relativeTime(capture.captured_at)}</span></Td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="px-3 pb-3">
            <CaptureDetail captureId={capture.id} />
          </td>
        </tr>
      )}
    </>
  );
}

export function SpamTrap() {
  const [expandedCaptureId, setExpandedCaptureId] = useState<number | null>(null);
  const { data: stats } = useSpamTrapStats();
  const { data: capturesRes, isLoading } = useSpamTrapCaptures();
  const { data: health } = useSpamTrapHealth();
  const { data: campaigns } = useSpamTrapCampaigns();

  const captures = capturesRes?.data || [];

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-xl font-bold text-parchment">Spam Trap Command Center</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Captured" value={stats?.total_captures ?? '—'} sublabel={stats ? `+${stats.captures_24h} last 24h` : undefined} />
        <StatCard label="Brands Spoofed" value={stats?.brands_spoofed ?? '—'} />
        <StatCard label="Unique IPs" value={stats?.unique_ips ?? '—'} />
        <StatCard label="Auth Fail Rate" value={stats ? `${(stats.auth_fail_rate * 100).toFixed(1)}%` : '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card hover={false}>
          <SectionLabel className="mb-3">Trap Health</SectionLabel>
          {health?.length ? (
            <div className="space-y-2">
              {health.map(h => (
                <div key={h.channel} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-parchment/80">{h.channel}</span>
                  <Badge variant={healthVariant(h.count)}>{h.count}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-contrail/40">No health data available.</p>
          )}
        </Card>

        <Card hover={false}>
          <SectionLabel className="mb-3">Seed Campaigns</SectionLabel>
          {campaigns?.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Channel</Th>
                  <Th className="text-right">Catches</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.name}>
                    <Td><span className="text-sm text-parchment/80">{c.name}</span></Td>
                    <Td><Badge variant="info">{c.channel}</Badge></Td>
                    <Td className="text-right"><span className="font-mono text-sm text-parchment">{c.catches}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-contrail/40">No campaigns found.</p>
          )}
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SectionLabel>Recent Captures</SectionLabel>
          <Badge variant="info">{captures.length}</Badge>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (
          <Card hover={false} className="p-0 overflow-hidden">
            <Table>
              <thead>
                <tr>
                  <Th>From</Th>
                  <Th>Subject</Th>
                  <Th>Brand</Th>
                  <Th>SPF</Th>
                  <Th>DKIM</Th>
                  <Th>DMARC</Th>
                  <Th>Category</Th>
                  <Th>Severity</Th>
                  <Th>Time</Th>
                </tr>
              </thead>
              <tbody>
                {captures.map(cap => (
                  <CaptureRow
                    key={cap.id}
                    capture={cap}
                    isExpanded={expandedCaptureId === cap.id}
                    onToggle={() => setExpandedCaptureId(expandedCaptureId === cap.id ? null : cap.id)}
                  />
                ))}
              </tbody>
            </Table>
            {captures.length === 0 && (
              <p className="text-sm text-contrail/40 text-center py-8">No captures recorded yet.</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

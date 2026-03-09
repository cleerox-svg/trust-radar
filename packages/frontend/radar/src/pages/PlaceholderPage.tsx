import { Card, CardContent } from "../components/ui";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: string;
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">{title}</h1>
      <p className="text-sm text-[--text-secondary] mb-6">{description}</p>
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {icon && <span className="text-4xl mb-4">{icon}</span>}
            <h3 className="text-lg font-semibold text-[--text-primary] mb-2">Coming Soon</h3>
            <p className="text-sm text-[--text-tertiary] max-w-md">
              This module is under development. It will be available in an upcoming release.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Pre-built placeholder exports ──
export const ThreatMapPage = () => <PlaceholderPage title="Threat Map" description="Interactive global threat visualization with real-time data" icon="🗺️" />;
export const BrandExposurePage = () => <PlaceholderPage title="Brand Exposure Engine" description="Attack surface overview and brand risk scoring" icon="🛡️" />;
export const DailyBriefingPage = () => <PlaceholderPage title="Daily Briefing" description="AI-generated threat intelligence briefing" icon="📋" />;
export const InvestigationsPage = () => <PlaceholderPage title="Investigations" description="Case management with LRX ticket IDs and status workflow" icon="🔬" />;
export const TakedownsPage = () => <PlaceholderPage title="Takedowns & Response" description="Erasure orchestrator with provider tracking" icon="⚡" />;
export const AgentHubPage = () => <PlaceholderPage title="Agent Hub" description="AI agent command center with status monitoring and HITL approval" icon="🤖" />;
export const TrustBotPage = () => <PlaceholderPage title="TrustBot" description="AI-powered threat intelligence assistant" icon="💬" />;
export const FeedAnalyticsPage = () => <PlaceholderPage title="Feed Analytics" description="Intelligence feed performance and KPI dashboard" icon="📊" />;
export const SocialIntelPage = () => <PlaceholderPage title="Social Intel" description="Community-sourced IOCs with confidence scoring" icon="👥" />;
export const DarkWebPage = () => <PlaceholderPage title="Dark Web Monitor" description="Breach and credential exposure monitoring" icon="🕵️" />;
export const ATOPage = () => <PlaceholderPage title="Account Takeover" description="Suspicious login detection and alerting" icon="🔒" />;
export const EmailAuthPage = () => <PlaceholderPage title="Email Authentication" description="SPF/DKIM/DMARC compliance monitoring" icon="📧" />;
export const CloudStatusPage = () => <PlaceholderPage title="Cloud Status" description="CSP/SaaS/Social platform status monitoring" icon="☁️" />;

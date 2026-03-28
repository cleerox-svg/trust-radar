import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateIntegration } from '@/hooks/useOrganization';
import type { IntegrationDef } from './IntegrationCard';

interface ConnectIntegrationSheetProps {
  open: boolean;
  onClose: () => void;
  integration: IntegrationDef | null;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

const INTEGRATION_FIELDS: Record<string, FieldDef[]> = {
  splunk: [
    { key: 'hec_url', label: 'HEC URL', placeholder: 'https://your-splunk.com:8088' },
    { key: 'hec_token', label: 'HEC Token', placeholder: 'Your HEC token', type: 'password' },
    { key: 'index', label: 'Index', placeholder: 'averrow_threats' },
    { key: 'source_type', label: 'Source Type', placeholder: 'averrow:threat' },
  ],
  sentinel: [
    { key: 'workspace_id', label: 'Workspace ID', placeholder: 'Log Analytics workspace ID' },
    { key: 'shared_key', label: 'Shared Key', placeholder: 'Primary or secondary key', type: 'password' },
    { key: 'log_type', label: 'Log Type', placeholder: 'AverrowThreats' },
  ],
  elastic: [
    { key: 'url', label: 'Elasticsearch URL', placeholder: 'https://your-elastic.com:9200' },
    { key: 'api_key', label: 'API Key', placeholder: 'Your API key', type: 'password' },
    { key: 'index', label: 'Index', placeholder: 'averrow-threats' },
  ],
  qradar: [
    { key: 'url', label: 'QRadar URL', placeholder: 'https://qradar.company.com' },
    { key: 'api_token', label: 'API Token', placeholder: 'Your API token', type: 'password' },
  ],
  jira: [
    { key: 'url', label: 'Jira URL', placeholder: 'https://company.atlassian.net' },
    { key: 'api_token', label: 'API Token', placeholder: 'Your API token', type: 'password' },
    { key: 'email', label: 'Email', placeholder: 'admin@company.com' },
    { key: 'project_key', label: 'Project Key', placeholder: 'SEC' },
  ],
  servicenow: [
    { key: 'instance', label: 'Instance URL', placeholder: 'https://company.service-now.com' },
    { key: 'username', label: 'Username', placeholder: 'api_user' },
    { key: 'password', label: 'Password', placeholder: 'Password', type: 'password' },
  ],
  pagerduty: [
    { key: 'routing_key', label: 'Routing Key', placeholder: 'Your routing key', type: 'password' },
  ],
  linear: [
    { key: 'api_key', label: 'API Key', placeholder: 'Your Linear API key', type: 'password' },
    { key: 'team_id', label: 'Team ID', placeholder: 'Team identifier' },
  ],
  mimecast: [
    { key: 'base_url', label: 'API Base URL', placeholder: 'https://api.mimecast.com' },
    { key: 'access_key', label: 'Access Key', placeholder: 'Your access key', type: 'password' },
    { key: 'secret_key', label: 'Secret Key', placeholder: 'Your secret key', type: 'password' },
  ],
  proofpoint: [
    { key: 'base_url', label: 'API Base URL', placeholder: 'https://tap-api-v2.proofpoint.com' },
    { key: 'principal', label: 'Principal', placeholder: 'Service principal', type: 'password' },
    { key: 'secret', label: 'Secret', placeholder: 'Secret key', type: 'password' },
  ],
  defender: [
    { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Azure tenant ID' },
    { key: 'client_id', label: 'Client ID', placeholder: 'App registration client ID' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'Client secret', type: 'password' },
  ],
  crowdstrike: [
    { key: 'base_url', label: 'API Base URL', placeholder: 'https://api.crowdstrike.com' },
    { key: 'client_id', label: 'Client ID', placeholder: 'API client ID' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'API client secret', type: 'password' },
  ],
};

export function ConnectIntegrationSheet({ open, onClose, integration }: ConnectIntegrationSheetProps) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const create = useCreateIntegration();

  if (!open || !integration) return null;

  const fields = INTEGRATION_FIELDS[integration.type] ?? [
    { key: 'api_url', label: 'API URL', placeholder: 'https://...' },
    { key: 'api_key', label: 'API Key', placeholder: 'Your API key', type: 'password' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      type: integration.type,
      category: integration.category,
      name: integration.name,
      config,
    });
    setConfig({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-instrument border border-white/10 rounded-t-2xl sm:rounded-xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="font-mono text-xs font-bold text-accent uppercase tracking-wider">
          Connect {integration.name}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-[11px] text-contrail/60 font-mono uppercase tracking-wide mb-1">
                {field.label}
              </label>
              <Input
                type={field.type ?? 'text'}
                value={config[field.key] ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full"
              />
            </div>
          ))}

          <div className="flex gap-2 pt-3">
            <Button type="button" variant="secondary" size="md" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={create.isPending} className="flex-1">
              {create.isPending ? 'Connecting...' : 'Save & Connect'}
            </Button>
          </div>
          {create.isError && (
            <p className="text-[11px] text-accent">Failed to connect. Please check your credentials.</p>
          )}
        </form>
      </div>
    </div>
  );
}

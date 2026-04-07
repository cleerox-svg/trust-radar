import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

export interface IntegrationDef {
  type: string;
  category: string;
  name: string;
  description: string;
  logoChar: string;
}

interface IntegrationCardProps {
  def: IntegrationDef;
  connected?: boolean;
  status?: string;
  lastSync?: string | null;
  eventsSent?: number;
  lastError?: string | null;
  onConnect: () => void;
  onConfigure?: () => void;
  onDisconnect?: () => void;
}

export function IntegrationCard({
  def,
  connected,
  status,
  lastSync,
  eventsSent,
  lastError,
  onConnect,
  onConfigure,
  onDisconnect,
}: IntegrationCardProps) {
  const isError = status === 'error';
  const isConnected = connected || status === 'connected';

  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 flex flex-col gap-3 transition-all',
        isConnected && !isError && 'border-positive/30',
        isError && 'border-accent/30',
        !isConnected && !isError && 'border-white/[0.06]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-contrail shrink-0">
          {def.logoChar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-parchment">{def.name}</div>
          <div className="text-[11px] text-contrail/50 truncate">{def.description}</div>
        </div>
        {isConnected && !isError && (
          <div className="w-2 h-2 rounded-full bg-positive shrink-0 mt-1.5" />
        )}
        {isError && (
          <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
        )}
      </div>

      {isConnected && !isError && (
        <div className="text-[10px] text-white/55 font-mono space-y-0.5">
          {lastSync && <div>Last sync: {new Date(lastSync).toLocaleDateString()}</div>}
          <div>{eventsSent ?? 0} events sent</div>
        </div>
      )}

      {isError && lastError && (
        <div className="text-[10px] text-accent/70 font-mono truncate">{lastError}</div>
      )}

      <div className="flex gap-2 mt-auto">
        {!isConnected && !isError && (
          <Button variant="secondary" size="sm" onClick={onConnect} className="w-full">
            Connect
          </Button>
        )}
        {isConnected && !isError && (
          <>
            <Button variant="secondary" size="sm" onClick={onConfigure} className="flex-1">
              Configure
            </Button>
            <Button variant="ghost" size="sm" onClick={onDisconnect} className="text-accent/70">
              Disconnect
            </Button>
          </>
        )}
        {isError && (
          <Button variant="secondary" size="sm" onClick={onConnect} className="w-full">
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}

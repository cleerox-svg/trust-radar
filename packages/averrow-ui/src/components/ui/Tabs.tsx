import { cn } from '@/lib/cn';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'font-mono text-xs font-semibold px-4 py-1.5 rounded-md transition-all',
            activeTab === tab.id
              ? 'bg-accent/10 text-accent border border-accent/25'
              : 'text-contrail/50 hover:bg-white/5 hover:text-parchment border border-transparent'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-1.5 text-[10px]',
              activeTab === tab.id ? 'text-accent/70' : 'text-white/50'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

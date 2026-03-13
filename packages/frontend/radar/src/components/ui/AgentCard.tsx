import { cn } from "../../lib/cn";
import { StatusDot } from "./StatusDot";

type AgentStatus = "active" | "scanning" | "alert" | "idle" | "offline";

interface AgentCardProps {
  name: string;
  description: string;
  status: AgentStatus;
  lastRun?: string;
  runsToday?: number;
  color?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AgentCard({
  name,
  description,
  status,
  lastRun,
  runsToday,
  color = "#3B82F6",
  icon,
  className,
  onClick,
}: AgentCardProps) {
  return (
    <div
      className={cn(
        "group rounded-lg border border-[--border-subtle] bg-surface-raised p-4 transition-all duration-200 cursor-pointer",
        "hover:-translate-y-0.5 hover:shadow-lg",
        status === "offline" && "opacity-60",
        className
      )}
      style={{
        ["--agent-color" as string]: color,
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-lg" style={{ color }}>{icon}</span>
          )}
          <div>
            <h4 className="text-sm font-semibold text-[--text-primary]">{name}</h4>
            <p className="text-xs text-[--text-tertiary] mt-0.5">{description}</p>
          </div>
        </div>
        <StatusDot variant={status} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-[--text-tertiary]">
        {lastRun && <span className="font-mono">Last: {lastRun}</span>}
        {runsToday !== undefined && <span className="font-mono">{runsToday} runs today</span>}
      </div>
      {/* Bottom color accent on hover */}
      <div
        className="mt-3 h-0.5 w-0 rounded-full transition-all duration-200 group-hover:w-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

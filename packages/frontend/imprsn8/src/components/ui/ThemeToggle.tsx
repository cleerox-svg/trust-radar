import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "../../lib/theme";

const OPTIONS: { value: ThemeMode; icon: React.ReactNode; label: string }[] = [
  { value: "light",  icon: <Sun size={13} />,     label: "Light" },
  { value: "dark",   icon: <Moon size={13} />,    label: "Dark" },
  { value: "system", icon: <Monitor size={13} />, label: "System" },
];

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg p-0.5
        bg-brand-border/30 border border-brand-border ${className}`}
      title="Toggle theme"
    >
      {OPTIONS.map(({ value, icon, label }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          title={label}
          className={`p-1.5 rounded-md transition-all duration-150 ${
            mode === value
              ? "bg-brand-purple text-white shadow-sm"
              : "text-brand-muted hover:text-brand-purple"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

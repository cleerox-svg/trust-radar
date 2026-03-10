import { useEffect, useRef, useState } from "react";

interface AgentNode {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  connections: string[];
}

const AGENTS: AgentNode[] = [
  { id: "sentinel", label: "Sentinel", color: "#22D3EE", x: 50, y: 20, radius: 18, connections: ["nexus", "herald", "arbiter"] },
  { id: "reaper", label: "Reaper", color: "#EF4444", x: 85, y: 35, radius: 14, connections: ["arbiter", "sentinel"] },
  { id: "phantom", label: "Phantom", color: "#A855F7", x: 20, y: 40, radius: 14, connections: ["nexus", "prism"] },
  { id: "prism", label: "Prism", color: "#3B82F6", x: 35, y: 65, radius: 14, connections: ["sentinel", "reaper"] },
  { id: "oracle", label: "Oracle", color: "#F59E0B", x: 70, y: 60, radius: 14, connections: ["nexus", "herald"] },
  { id: "nexus", label: "Nexus", color: "#10B981", x: 50, y: 48, radius: 20, connections: [] },
  { id: "aegis", label: "Aegis", color: "#6366F1", x: 15, y: 70, radius: 12, connections: ["nexus"] },
  { id: "vanguard", label: "Vanguard", color: "#EC4899", x: 85, y: 70, radius: 12, connections: ["nexus", "herald"] },
  { id: "herald", label: "Herald", color: "#14B8A6", x: 65, y: 82, radius: 14, connections: [] },
  { id: "arbiter", label: "Arbiter", color: "#F97316", x: 35, y: 85, radius: 14, connections: [] },
];

function getNode(id: string) {
  return AGENTS.find((a) => a.id === id);
}

interface Props {
  className?: string;
  activeAgent?: string;
}

export function AgentNetworkGraph({ className, activeAgent }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const highlight = hovered ?? activeAgent ?? null;

  // Build all edges
  const edges: Array<{ from: AgentNode; to: AgentNode }> = [];
  for (const node of AGENTS) {
    for (const connId of node.connections) {
      const target = getNode(connId);
      if (target) edges.push({ from: node, to: target });
    }
  }

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="w-full"
        style={{ minHeight: 280 }}
      >
        <defs>
          {AGENTS.map((a) => (
            <radialGradient key={`g-${a.id}`} id={`glow-${a.id}`}>
              <stop offset="0%" stopColor={a.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={a.color} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const isHighlighted = highlight === e.from.id || highlight === e.to.id;
          return (
            <line
              key={i}
              x1={e.from.x}
              y1={e.from.y}
              x2={e.to.x}
              y2={e.to.y}
              stroke={isHighlighted ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}
              strokeWidth={isHighlighted ? 0.4 : 0.2}
              style={{ transition: "all 300ms ease" }}
            />
          );
        })}

        {/* Data flow particles (animated dots along edges) */}
        {animated && edges.slice(0, 6).map((e, i) => (
          <circle key={`p-${i}`} r={0.4} fill="var(--cyan-400)" opacity={0.6}>
            <animateMotion
              dur={`${3 + i * 0.5}s`}
              repeatCount="indefinite"
              path={`M${e.from.x},${e.from.y} L${e.to.x},${e.to.y}`}
            />
          </circle>
        ))}

        {/* Nodes */}
        {AGENTS.map((agent) => {
          const isActive = highlight === agent.id;
          const scale = isActive ? 1.15 : 1;
          return (
            <g
              key={agent.id}
              onMouseEnter={() => setHovered(agent.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer", transition: "transform 300ms ease" }}
            >
              {/* Glow */}
              <circle
                cx={agent.x}
                cy={agent.y}
                r={agent.radius * 1.5 * scale}
                fill={`url(#glow-${agent.id})`}
                opacity={isActive ? 1 : 0.3}
                style={{ transition: "opacity 300ms ease" }}
              />
              {/* Core circle */}
              <circle
                cx={agent.x}
                cy={agent.y}
                r={agent.radius * 0.35 * scale}
                fill={agent.color}
                opacity={isActive ? 1 : 0.7}
                style={{ transition: "all 300ms ease" }}
              />
              {/* Ring */}
              <circle
                cx={agent.x}
                cy={agent.y}
                r={agent.radius * 0.5 * scale}
                fill="none"
                stroke={agent.color}
                strokeWidth={0.3}
                opacity={isActive ? 0.8 : 0.2}
                style={{ transition: "all 300ms ease" }}
              />
              {/* Label */}
              <text
                x={agent.x}
                y={agent.y + agent.radius * 0.5 + 4}
                textAnchor="middle"
                fill={isActive ? agent.color : "var(--text-tertiary)"}
                fontSize={3}
                fontFamily="monospace"
                fontWeight={isActive ? 700 : 400}
                style={{ transition: "fill 300ms ease" }}
              >
                {agent.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

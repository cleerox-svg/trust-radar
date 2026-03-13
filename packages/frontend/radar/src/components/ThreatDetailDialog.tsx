/**
 * ThreatDetailDialog — Modal showing full IOC detail + timeline + action buttons.
 *
 * Opens when a user clicks on a threat row in the ThreatMapPage intelligence tabs.
 * Shows severity badge, domain, IOC info, timeline, and actionable takedown/copy buttons.
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Badge, Separator,
} from "./ui";
import { Button } from "./ui/Button";
import {
  Shield, Globe, Clock, AlertTriangle, Copy, ExternalLink, Ban, Flag, Server, Target,
} from "lucide-react";
import type { Threat } from "../lib/api";
import { cn } from "../lib/cn";

interface ThreatDetailDialogProps {
  threat: Threat | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const severityConfig: Record<string, { variant: "critical" | "high" | "medium" | "low" | "info"; label: string }> = {
  critical: { variant: "critical", label: "CRITICAL" },
  high:     { variant: "high",     label: "HIGH" },
  medium:   { variant: "medium",   label: "MEDIUM" },
  low:      { variant: "low",      label: "LOW" },
  info:     { variant: "info",     label: "INFO" },
};

const statusColors: Record<string, string> = {
  new:            "text-threat-critical",
  investigating:  "text-threat-high",
  confirmed:      "text-threat-medium",
  mitigated:      "text-blue-500",
  resolved:       "text-threat-low",
  false_positive: "text-[--text-tertiary]",
};

function InfoRow({ icon: Icon, label, value, mono = false }: { icon: typeof Globe; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-[--text-tertiary] mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-2xs uppercase tracking-widest text-[--text-tertiary] mb-0.5">{label}</p>
        <p className={cn("text-sm text-[--text-primary] break-all", mono && "font-mono")}>{value || "—"}</p>
      </div>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function ThreatDetailDialog({ threat, open, onOpenChange }: ThreatDetailDialogProps) {
  if (!threat) return null;

  const sev = severityConfig[threat.severity] || severityConfig.medium;
  const statusClass = statusColors[threat.status] || "text-[--text-primary]";
  const confidence = typeof threat.confidence === "number"
    ? (threat.confidence <= 1 ? Math.round(threat.confidence * 100) : Math.round(threat.confidence))
    : 0;

  const timelineEvents = [
    { label: "First Seen", time: threat.first_seen },
    { label: "Last Seen", time: threat.last_seen },
    { label: "Ingested", time: threat.created_at },
  ].filter((e) => e.time);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const relativeTime = (ts: string) => {
    try {
      const diff = Date.now() - new Date(ts).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-raised border-[--border-default]">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={sev.variant}>{sev.label}</Badge>
            <Badge className={statusClass}>
              {threat.status.toUpperCase().replace("_", " ")}
            </Badge>
            <span className="text-blue-500 font-mono text-sm ml-auto">{confidence}%</span>
          </div>
          <DialogTitle className="text-lg mt-2">{threat.title}</DialogTitle>
        </DialogHeader>

        <Separator />

        {/* IOC Details */}
        <div className="space-y-0">
          {threat.domain && (
            <InfoRow icon={Globe} label="Domain" value={
              <span className="flex items-center gap-2">
                <span className="text-threat-critical">{threat.domain}</span>
                <button onClick={() => copyToClipboard(threat.domain!)} className="text-[--text-tertiary] hover:text-[--text-primary]">
                  <Copy className="w-3 h-3" />
                </button>
              </span>
            } mono />
          )}
          <InfoRow icon={AlertTriangle} label="Type" value={threat.type} />
          <InfoRow icon={Shield} label="Source" value={threat.source.toUpperCase()} />
          <InfoRow icon={Flag} label="Country" value={threat.country_code || "Unknown"} />
          {threat.ip_address && (
            <InfoRow icon={Server} label="IP Address" value={
              <span className="flex items-center gap-2">
                {threat.ip_address}
                <button onClick={() => copyToClipboard(threat.ip_address!)} className="text-[--text-tertiary] hover:text-[--text-primary]">
                  <Copy className="w-3 h-3" />
                </button>
              </span>
            } mono />
          )}
          {threat.ioc_value && (
            <InfoRow icon={Target} label={`IOC (${threat.ioc_type || "indicator"})`} value={
              <span className="flex items-center gap-2">
                <span className="text-threat-high">{threat.ioc_value}</span>
                <button onClick={() => copyToClipboard(threat.ioc_value!)} className="text-[--text-tertiary] hover:text-[--text-primary]">
                  <Copy className="w-3 h-3" />
                </button>
              </span>
            } mono />
          )}
        </div>

        <Separator />

        {/* Timeline */}
        {timelineEvents.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[--text-tertiary] mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Timeline
            </h4>
            <div className="relative pl-4 border-l-2 border-[--border-default] space-y-3">
              {timelineEvents.map((event) => (
                <div key={event.label} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-surface-raised" />
                  <p className="text-2xs uppercase tracking-widest text-[--text-tertiary]">{event.label}</p>
                  <p className="text-sm text-[--text-primary] font-mono">{formatTime(event.time!)}</p>
                  <p className="text-xs text-[--text-tertiary]">{relativeTime(event.time!)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div>
          <h4 className="text-xs uppercase tracking-widest text-[--text-tertiary] mb-3">Actions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {threat.domain && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => window.open(`https://www.virustotal.com/gui/domain/${threat.domain}`, "_blank", "noopener")}
              >
                <ExternalLink className="w-4 h-4 mr-2" /> VirusTotal Lookup
              </Button>
            )}
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => copyToClipboard(JSON.stringify(threat, null, 2))}>
              <Copy className="w-4 h-4 mr-2" /> Copy IOC JSON
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-threat-critical hover:text-threat-critical">
              <Ban className="w-4 h-4 mr-2" /> Request Takedown
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
              <Flag className="w-4 h-4 mr-2" /> Flag for Review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

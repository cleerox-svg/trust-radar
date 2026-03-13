/**
 * BrandExposurePage — Brand Exposure Engine.
 *
 * Features:
 * - Domain scan input (admin/analyst enters a domain)
 * - Full scan results: email security (SPF, DMARC), lookalikes, feed cross-ref
 * - Trust score per brand
 * - Scan history for all previously scanned brands
 * - Risk factors + recommendations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { brandScan, type BrandScanResult, type BrandScanRecord, trustScores } from "../lib/api";
import { Card, CardContent, Badge, ScoreRing } from "../components/ui";
import { cn } from "../lib/cn";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search, Shield, ShieldCheck, ShieldAlert, ShieldX, Globe2, Mail,
  AlertTriangle, CheckCircle2, XCircle, FileSearch, Clock, ExternalLink,
  RefreshCw, History, ChevronDown, ChevronRight,
} from "lucide-react";

function PolicyBadge({ policy, type }: { policy: string | null; type: "spf" | "dmarc" }) {
  if (!policy) return <Badge variant="critical">Missing</Badge>;
  if (type === "spf") {
    if (policy === "hardfail") return <Badge variant="low">hardfail (-all)</Badge>;
    if (policy === "softfail") return <Badge variant="medium">softfail (~all)</Badge>;
    return <Badge variant="high">{policy}</Badge>;
  }
  if (type === "dmarc") {
    if (policy === "reject") return <Badge variant="low">reject</Badge>;
    if (policy === "quarantine") return <Badge variant="medium">quarantine</Badge>;
    return <Badge variant="high">{policy}</Badge>;
  }
  return <Badge>{policy}</Badge>;
}

export function BrandExposurePage() {
  const queryClient = useQueryClient();
  const [domainInput, setDomainInput] = useState("");
  const [currentResult, setCurrentResult] = useState<BrandScanResult | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: historyData } = useQuery({
    queryKey: ["brand-scan-history", selectedDomain],
    queryFn: () => brandScan.history(selectedDomain ?? undefined),
  });

  const { data: scores } = useQuery({
    queryKey: ["trust-scores"],
    queryFn: () => trustScores.list(),
  });

  const scanMutation = useMutation({
    mutationFn: (domain: string) => brandScan.scan(domain),
    onSuccess: (result) => {
      setCurrentResult(result);
      queryClient.invalidateQueries({ queryKey: ["brand-scan-history"] });
      queryClient.invalidateQueries({ queryKey: ["trust-scores"] });
    },
  });

  const handleScan = () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain || !domain.includes(".")) return;
    scanMutation.mutate(domain);
  };

  const scannedDomains = historyData?.domains ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Brand Exposure Engine</h1>
        <p className="text-sm text-[--text-secondary]">Scan any domain for email security, lookalike threats, and intelligence feed matches</p>
      </div>

      {/* ─── Domain Scan Input ────────────────────────────────── */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-tertiary]" />
              <input
                type="text"
                placeholder="Enter domain to scan (e.g., acmebank.com)"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                className="w-full pl-10 pr-4 py-2.5 bg-[--surface-base] border border-[--border-subtle] rounded-lg text-sm text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
            <button
              onClick={handleScan}
              disabled={scanMutation.isPending || !domainInput.trim()}
              className="px-6 py-2.5 bg-cyan-500 hover:bg-blue-500 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {scanMutation.isPending ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</>
              ) : (
                <><FileSearch className="w-4 h-4" /> Deep Scan</>
              )}
            </button>
          </div>
          {scanMutation.isError && (
            <p className="text-xs text-threat-critical mt-2">Scan failed: {(scanMutation.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Scan Results ─────────────────────────────────────── */}
      {currentResult && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Trust Score Hero */}
          <Card>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-8 py-4">
                <ScoreRing score={currentResult.trustScore} size="xl" />
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-lg font-display font-bold text-[--text-primary] mb-1">
                    {currentResult.domain}
                  </h2>
                  <p className="text-2xl font-bold font-mono text-blue-500 mb-2">
                    Trust Score: {currentResult.trustScore}/100
                  </p>
                  <p className="text-sm text-[--text-secondary] mb-3">
                    {currentResult.trustScore >= 80 ? "Strong security posture. Keep monitoring for changes." :
                     currentResult.trustScore >= 60 ? "Moderate risk. Some security controls need attention." :
                     currentResult.trustScore >= 40 ? "Elevated risk. Multiple security gaps detected." :
                     "Critical risk. Immediate action required to protect this brand."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={currentResult.lookalikeCount > 5 ? "critical" : currentResult.lookalikeCount > 0 ? "high" : "low"}>
                      {currentResult.lookalikeCount} Lookalikes
                    </Badge>
                    <Badge variant={currentResult.feedMentions > 5 ? "critical" : currentResult.feedMentions > 0 ? "high" : "low"}>
                      {currentResult.feedMentions} Feed Mentions
                    </Badge>
                    <Badge variant="info">Scanned in {currentResult.durationMs}ms</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Security */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500" /> SPF Record
                  </h3>
                  <PolicyBadge policy={currentResult.spf.policy} type="spf" />
                </div>
                {currentResult.spf.record ? (
                  <code className="text-[10px] text-[--text-secondary] font-mono break-all block bg-[--surface-base] p-2 rounded">{currentResult.spf.record}</code>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-threat-critical">
                    <XCircle className="w-3.5 h-3.5" /> No SPF record found
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500" /> DMARC
                  </h3>
                  <PolicyBadge policy={currentResult.dmarc.policy} type="dmarc" />
                </div>
                {currentResult.dmarc.record ? (
                  <code className="text-[10px] text-[--text-secondary] font-mono break-all block bg-[--surface-base] p-2 rounded">{currentResult.dmarc.record}</code>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-threat-critical">
                    <XCircle className="w-3.5 h-3.5" /> No DMARC record found
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2 mb-3">
                  <Globe2 className="w-4 h-4 text-blue-500" /> MX Records
                </h3>
                {currentResult.mx.length > 0 ? (
                  <div className="space-y-1">
                    {currentResult.mx.map((mx, i) => (
                      <div key={i} className="text-xs font-mono text-[--text-secondary] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                        <span className="truncate">{mx}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-threat-critical">
                    <XCircle className="w-3.5 h-3.5" /> No MX records
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lookalike Domains */}
          {currentResult.lookalikes.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-threat-high" />
                  Registered Lookalike Domains ({currentResult.lookalikeCount})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {currentResult.lookalikes.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-[--surface-base] border border-[--border-subtle]">
                      <ShieldAlert className="w-3.5 h-3.5 text-threat-critical shrink-0" />
                      <span className="text-xs font-mono text-[--text-primary] truncate flex-1">{l.domain}</span>
                      {l.ip && <span className="text-[9px] text-[--text-tertiary] font-mono">{l.ip}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feed Matches */}
          {currentResult.feedMatches.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-threat-critical" />
                  Threat Feed Matches ({currentResult.feedMentions})
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {currentResult.feedMatches.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded bg-[--surface-base] border border-[--border-subtle]">
                      <Badge variant={m.severity as "critical" | "high" | "medium" | "low"} className="text-2xs shrink-0">{m.severity}</Badge>
                      <span className="text-xs text-[--text-primary] flex-1 truncate">{m.title}</span>
                      <span className="text-[9px] text-[--text-tertiary] font-mono shrink-0">{m.source}</span>
                      <span className="text-[9px] text-[--text-tertiary]">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Factors + Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-threat-critical mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Risk Factors
                </h3>
                <div className="space-y-2">
                  {currentResult.riskFactors.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[--text-secondary]">
                      <XCircle className="w-3.5 h-3.5 text-threat-critical shrink-0 mt-0.5" />
                      {r}
                    </div>
                  ))}
                  {currentResult.riskFactors.length === 0 && (
                    <p className="text-xs text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> No significant risk factors detected
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-blue-500 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Recommendations
                </h3>
                <div className="space-y-2">
                  {currentResult.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[--text-secondary]">
                      <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      {r}
                    </div>
                  ))}
                  {currentResult.recommendations.length === 0 && (
                    <p className="text-xs text-green-400">All checks passed. No actions needed.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ─── Scan History ─────────────────────────────────────── */}
      <Card>
        <CardContent>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-semibold text-[--text-primary] w-full text-left"
          >
            <History className="w-4 h-4 text-blue-500" />
            Scan History
            <ChevronDown className={cn("w-4 h-4 text-[--text-tertiary] ml-auto transition-transform", showHistory && "rotate-180")} />
          </button>

          {showHistory && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4">
              {/* Scanned domains filter */}
              {scannedDomains.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setSelectedDomain(null)}
                    className={cn(
                      "text-xs px-3 py-1 rounded-full border font-mono transition-colors",
                      !selectedDomain ? "bg-blue-500/10 text-blue-500 border-blue-500/40" : "text-[--text-tertiary] border-[--border-subtle]"
                    )}
                  >
                    All
                  </button>
                  {scannedDomains.map(d => (
                    <button
                      key={d.domain}
                      onClick={() => setSelectedDomain(d.domain)}
                      className={cn(
                        "text-xs px-3 py-1 rounded-full border font-mono transition-colors",
                        selectedDomain === d.domain ? "bg-blue-500/10 text-blue-500 border-blue-500/40" : "text-[--text-tertiary] border-[--border-subtle]"
                      )}
                    >
                      {d.domain} ({d.scan_count})
                    </button>
                  ))}
                </div>
              )}

              {/* Trust Score History */}
              {scores && scores.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                        <th className="pb-2 pr-4">Domain</th>
                        <th className="pb-2 pr-4">Score</th>
                        <th className="pb-2 pr-4">Delta</th>
                        <th className="pb-2 pr-4">Risk</th>
                        <th className="pb-2">Measured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.slice(0, 20).map((s) => (
                        <tr key={s.id} className="border-b border-[--border-subtle] last:border-0">
                          <td className="py-2 pr-4 font-medium text-[--text-primary] font-mono text-xs">{s.domain ?? "\u2014"}</td>
                          <td className="py-2 pr-4 tabular-nums text-[--text-primary] font-mono">{s.score}</td>
                          <td className="py-2 pr-4 tabular-nums">
                            <span className={s.delta > 0 ? "text-green-400" : s.delta < 0 ? "text-red-400" : "text-[--text-tertiary]"}>
                              {s.delta > 0 ? "+" : ""}{s.delta}
                            </span>
                          </td>
                          <td className="py-2 pr-4"><Badge variant={s.risk_level as "critical" | "high" | "medium" | "low"}>{s.risk_level}</Badge></td>
                          <td className="py-2 text-[--text-tertiary] text-xs">{new Date(s.measured_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(!scores || scores.length === 0) && (!historyData || historyData.scans.length === 0) && (
                <p className="text-xs text-[--text-tertiary] py-4 text-center">No scan history yet. Run a scan above to get started.</p>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

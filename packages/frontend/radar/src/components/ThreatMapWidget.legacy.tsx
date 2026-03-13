/**
 * ThreatMapWidget — Premium interactive threat intelligence world map.
 *
 * Features:
 *   - Choropleth heatmap with radial glow fills per severity
 *   - Animated attack arc lines from APT origins to target nations
 *   - Pulsing threat hotspots with radiating rings
 *   - Continent-level aggregation toggle
 *   - Real-time threat flow particle animations
 *   - SVG filter-based glow effects
 *   - Zoom, pan, fullscreen, dual view (targets / origins)
 *   - Mobile-friendly: pinch-to-zoom, two-finger pan
 *   - Country quick view: click to see top brands, attack types, hosting providers
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Flame, Target, Crosshair, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Globe2, Map as MapIcon, Activity, X, Shield, Server, Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { threats, providers as providersApi, type ThreatStats } from "../lib/api";
import { cn } from "../lib/cn";
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  Graticule,
  Marker,
  Line,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ─── ISO mappings ─────────────────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  "840": "USA", "124": "Canada", "484": "Mexico", "076": "Brazil", "032": "Argentina",
  "170": "Colombia", "604": "Peru", "152": "Chile", "862": "Venezuela",
  "826": "United Kingdom", "250": "France", "276": "Germany", "380": "Italy",
  "724": "Spain", "616": "Poland", "804": "Ukraine", "578": "Norway", "752": "Sweden",
  "643": "Russia", "792": "Turkey", "364": "Iran", "682": "Saudi Arabia", "368": "Iraq",
  "818": "Egypt", "566": "Nigeria", "710": "South Africa", "404": "Kenya",
  "180": "DR Congo", "012": "Algeria", "231": "Ethiopia",
  "156": "China", "356": "India", "392": "Japan", "410": "South Korea",
  "586": "Pakistan", "764": "Thailand", "704": "Vietnam", "360": "Indonesia",
  "608": "Philippines", "036": "Australia", "554": "New Zealand",
  "408": "N. Korea", "458": "Malaysia", "716": "Zimbabwe", "528": "Netherlands",
  "246": "Finland", "642": "Romania", "203": "Czechia", "756": "Switzerland",
  "056": "Belgium", "620": "Portugal", "208": "Denmark", "372": "Ireland",
  "702": "Singapore", "344": "Hong Kong", "158": "Taiwan", "784": "UAE",
  "376": "Israel", "288": "Ghana", "834": "Tanzania", "218": "Ecuador",
  "050": "Bangladesh",
};

const LABEL_COORDS: Record<string, [number, number]> = {
  "840": [-98, 39], "124": [-106, 56], "076": [-53, -10], "643": [90, 62],
  "156": [104, 35], "356": [79, 22], "036": [134, -25], "566": [8, 10],
  "710": [25, -29], "276": [10, 51], "250": [2, 46], "826": [-2, 54],
  "392": [138, 36], "484": [-102, 24], "032": [-64, -34], "170": [-73, 4],
  "818": [30, 27], "364": [53, 32], "682": [45, 24], "804": [32, 49],
  "792": [35, 39], "380": [12, 42], "724": [-4, 40], "410": [128, 36],
  "528": [5, 52], "752": [16, 62], "616": [20, 52],
};

const ALPHA2_TO_NUMERIC: Record<string, string> = {
  US: "840", CA: "124", MX: "484", BR: "076", AR: "032", CO: "170", PE: "604",
  CL: "152", VE: "862", EC: "218",
  GB: "826", FR: "250", DE: "276", IT: "380", ES: "724", PL: "616", UA: "804",
  NO: "578", SE: "752", NL: "528", FI: "246", RO: "642", CZ: "203", CH: "756",
  BE: "056", PT: "620", DK: "208", IE: "372",
  RU: "643", TR: "792", IR: "364", SA: "682", IQ: "368", IL: "376", AE: "784",
  EG: "818", NG: "566", ZA: "710", KE: "404", CD: "180", DZ: "012", ET: "231",
  GH: "288", TZ: "834", MA: "504",
  CN: "156", IN: "356", JP: "392", KR: "410", KP: "408", PK: "586",
  BD: "050", TH: "764", VN: "704", MY: "458", SG: "702", ID: "360",
  PH: "608", TW: "158", HK: "344",
  AU: "036", NZ: "554",
};

// ─── Continent grouping ────────────────────────────────────────
const CONTINENT_MAP: Record<string, string> = {
  US: "North America", CA: "North America", MX: "North America",
  BR: "South America", AR: "South America", CO: "South America", PE: "South America",
  CL: "South America", VE: "South America", EC: "South America",
  GB: "Europe", FR: "Europe", DE: "Europe", IT: "Europe", ES: "Europe",
  PL: "Europe", UA: "Europe", NO: "Europe", SE: "Europe", NL: "Europe",
  FI: "Europe", RO: "Europe", CZ: "Europe", CH: "Europe", BE: "Europe",
  PT: "Europe", DK: "Europe", IE: "Europe", TR: "Europe",
  RU: "Eurasia", CN: "Asia", IN: "Asia", JP: "Asia", KR: "Asia", KP: "Asia",
  PK: "Asia", BD: "Asia", TH: "Asia", VN: "Asia", MY: "Asia", SG: "Asia",
  ID: "Asia", PH: "Asia", TW: "Asia", HK: "Asia",
  IR: "Middle East", SA: "Middle East", IQ: "Middle East", IL: "Middle East", AE: "Middle East",
  EG: "Africa", NG: "Africa", ZA: "Africa", KE: "Africa", CD: "Africa",
  DZ: "Africa", ET: "Africa", GH: "Africa", TZ: "Africa",
  AU: "Oceania", NZ: "Oceania",
};

const CONTINENT_CENTERS: Record<string, [number, number]> = {
  "North America": [-100, 40],
  "South America": [-58, -15],
  "Europe": [15, 50],
  "Eurasia": [60, 55],
  "Asia": [105, 30],
  "Middle East": [48, 28],
  "Africa": [20, 5],
  "Oceania": [140, -25],
};

// ─── APT origin fallback (used when no live origin data) ────────
const APT_ORIGIN_FALLBACK: Record<string, { coords: [number, number]; type: string; severity: string }> = {
  "643": { coords: [37, 55], type: "APT / Infrastructure", severity: "critical" },
  "156": { coords: [116, 39], type: "State-Sponsored", severity: "critical" },
  "408": { coords: [125, 39], type: "Financial / Crypto", severity: "high" },
  "364": { coords: [51, 35], type: "Critical Infrastructure", severity: "high" },
  "566": { coords: [7, 9], type: "BEC / Social Engineering", severity: "medium" },
  "076": { coords: [-47, -15], type: "Banking Trojans", severity: "medium" },
};

// Coordinate lookup for alpha-2 codes (for dynamic origins)
const ALPHA2_COORDS: Record<string, [number, number]> = {
  US: [-98, 39], CA: [-106, 56], MX: [-102, 24], BR: [-53, -10], AR: [-64, -34],
  GB: [-2, 54], FR: [2, 46], DE: [10, 51], IT: [12, 42], ES: [-4, 40],
  PL: [20, 52], UA: [32, 49], NL: [5, 52], SE: [16, 62], RO: [25, 46],
  RU: [37, 55], TR: [35, 39], IR: [53, 32], SA: [45, 24], IQ: [44, 33],
  EG: [30, 27], NG: [8, 10], ZA: [25, -29], KE: [38, 1],
  CN: [104, 35], IN: [79, 22], JP: [138, 36], KR: [128, 36], KP: [125, 39],
  PK: [70, 30], BD: [90, 24], TH: [101, 15], VN: [106, 16], ID: [117, -2],
  PH: [122, 13], AU: [134, -25], NZ: [172, -41], SG: [104, 1], MY: [102, 4],
  HK: [114, 22], TW: [121, 24], IL: [35, 31], AE: [54, 24],
};

// Target coordinates for attack arcs (top target nations)
const TARGET_COORDS: [number, number][] = [
  [-98, 39],   // USA
  [-2, 54],    // UK
  [10, 51],    // Germany
  [139, 36],   // Japan
  [134, -25],  // Australia
  [2, 46],     // France
];

type ViewMode = "targets" | "origins";
type AggMode = "country" | "continent";

const SEV_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#EAB308",
  low:      "#22C55E",
  info:     "#3B82F6",
};

const SEV_GLOW: Record<string, string> = {
  critical: "rgba(239, 68, 68, 0.6)",
  high:     "rgba(249, 115, 22, 0.5)",
  medium:   "rgba(234, 179, 8, 0.4)",
  low:      "rgba(34, 197, 94, 0.3)",
};

const ATTACK_TYPE_COLORS: Record<string, string> = {
  phishing: "#EF4444", malware: "#F59E0B", scam: "#A78BFA",
  c2: "#FB923C", ransomware: "#EC4899", impersonation: "#818CF8",
  reputation: "#6B7280", unknown: "#64748B",
};

export function ThreatMapWidget() {
  const { data: stats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const [viewMode, setViewMode] = useState<ViewMode>("targets");
  const [aggMode, setAggMode] = useState<AggMode>("country");
  const [tooltipContent, setTooltipContent] = useState("");
  const [tooltipSeverity, setTooltipSeverity] = useState("");
  const [zoom, setZoom] = useState(1.25);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [center, setCenter] = useState<[number, number]>([10, 20]);
  const [showArcs, setShowArcs] = useState(true);
  const [animTick, setAnimTick] = useState(0);

  // Selected country for quick view panel
  const [selectedCountry, setSelectedCountry] = useState<{
    numericId: string; alpha2: string; name: string;
  } | null>(null);

  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; center: [number, number] } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const touchDragStart = useRef<{ x: number; y: number; center: [number, number] } | null>(null);

  // Animation tick for pulsing effects
  useEffect(() => {
    const interval = setInterval(() => setAnimTick((t) => (t + 1) % 360), 50);
    return () => clearInterval(interval);
  }, []);

  // Escape to exit fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(Math.max(z + (e.deltaY > 0 ? -0.15 : 0.15), 1), 6));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Pinch-to-zoom + two-finger pan
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
      // Track midpoint for two-finger panning
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      lastPinchCenter.current = { x: cx, y: cy };
      touchDragStart.current = { x: cx, y: cy, center: [...center] as [number, number] };
    } else if (e.touches.length === 1) {
      // Single finger drag for panning
      touchDragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        center: [...center] as [number, number],
      };
    }
  }, [center]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      // Pinch-to-zoom
      if (lastPinchDist.current !== null) {
        const delta = (dist - lastPinchDist.current) * 0.01;
        setZoom((z) => Math.min(Math.max(z + delta, 1), 6));
        lastPinchDist.current = dist;
      }

      // Two-finger pan (midpoint tracking)
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (touchDragStart.current && lastPinchCenter.current) {
        const sensitivity = 0.3 / zoom;
        const panX = (cx - lastPinchCenter.current.x) * sensitivity;
        const panY = (cy - lastPinchCenter.current.y) * sensitivity;
        setCenter((prev) => [
          prev[0] - panX,
          Math.max(-60, Math.min(80, prev[1] + panY)),
        ]);
        lastPinchCenter.current = { x: cx, y: cy };
      }
    } else if (e.touches.length === 1 && touchDragStart.current) {
      // Single-finger pan
      e.preventDefault();
      const sensitivity = 0.3 / zoom;
      const dx = (e.touches[0].clientX - touchDragStart.current.x) * sensitivity;
      const dy = (e.touches[0].clientY - touchDragStart.current.y) * sensitivity;
      setCenter([
        touchDragStart.current.center[0] - dx,
        Math.max(-60, Math.min(80, touchDragStart.current.center[1] + dy)),
      ]);
    }
  }, [zoom]);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
    lastPinchCenter.current = null;
    touchDragStart.current = null;
  }, []);

  // Desktop click-drag panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, center: [...center] as [number, number] };
  }, [center]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const sensitivity = 0.3 / zoom;
    const dx = (e.clientX - dragStart.current.x) * sensitivity;
    const dy = (e.clientY - dragStart.current.y) * sensitivity;
    setCenter([
      dragStart.current.center[0] - dx,
      Math.max(-60, Math.min(80, dragStart.current.center[1] + dy)),
    ]);
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragStart.current = null;
  }, []);

  // ─── Aggregate by-country stats ─────────────────────────────
  const countryData = useMemo(() => {
    const map = new Map<string, { count: number; maxSeverity: string; countryCode: string }>();
    if (!stats) return map;

    stats.byCountry.forEach((c) => {
      const numericId = ALPHA2_TO_NUMERIC[c.country_code];
      if (!numericId) return;
      map.set(numericId, { count: c.count, maxSeverity: "medium", countryCode: c.country_code });
    });

    const maxCount = Math.max(...stats.byCountry.map((c) => c.count), 1);
    map.forEach((data) => {
      const ratio = data.count / maxCount;
      if (ratio > 0.7) data.maxSeverity = "critical";
      else if (ratio > 0.4) data.maxSeverity = "high";
      else if (ratio > 0.15) data.maxSeverity = "medium";
      else data.maxSeverity = "low";
    });

    return map;
  }, [stats]);

  // ─── Continent aggregation ──────────────────────────────────
  const continentData = useMemo(() => {
    const map = new Map<string, { count: number; maxSeverity: string; countries: number }>();
    if (!stats) return map;

    stats.byCountry.forEach((c) => {
      const continent = CONTINENT_MAP[c.country_code] ?? "Other";
      const existing = map.get(continent) ?? { count: 0, maxSeverity: "low", countries: 0 };
      existing.count += c.count;
      existing.countries++;
      map.set(continent, existing);
    });

    const maxCount = Math.max(...Array.from(map.values()).map((d) => d.count), 1);
    map.forEach((data) => {
      const ratio = data.count / maxCount;
      if (ratio > 0.7) data.maxSeverity = "critical";
      else if (ratio > 0.4) data.maxSeverity = "high";
      else if (ratio > 0.15) data.maxSeverity = "medium";
      else data.maxSeverity = "low";
    });

    return map;
  }, [stats]);

  // ─── Origin mode — driven by real topOriginsToday data ────────
  const originData = useMemo(() => {
    const origins: Record<string, { count: number; type: string; severity: string; coords: [number, number] }> = {};
    const topOrigins = stats?.topOriginsToday ?? [];

    if (topOrigins.length > 0) {
      // Use real origin data from today's threat feeds
      const maxCount = Math.max(...topOrigins.map(o => o.count), 1);
      topOrigins.forEach((o) => {
        const numericId = ALPHA2_TO_NUMERIC[o.country_code];
        if (!numericId) return;
        const coords = ALPHA2_COORDS[o.country_code] ?? LABEL_COORDS[numericId];
        if (!coords) return;
        const ratio = o.count / maxCount;
        const severity = ratio > 0.7 ? "critical" : ratio > 0.4 ? "high" : ratio > 0.15 ? "medium" : "low";
        origins[numericId] = {
          count: o.count,
          type: "Threat Origin",
          severity,
          coords,
        };
      });
    } else {
      // Fallback to known APT origins when no live data
      for (const [id, info] of Object.entries(APT_ORIGIN_FALLBACK)) {
        const countryEntry = stats?.byCountry.find((c) => ALPHA2_TO_NUMERIC[c.country_code] === id);
        origins[id] = {
          count: countryEntry?.count ?? 50,
          type: info.type,
          severity: info.severity,
          coords: info.coords,
        };
      }
    }

    return origins;
  }, [stats]);

  // ─── Attack arcs (origin → top targets) ─────────────────────
  const attackArcs = useMemo(() => {
    if (viewMode !== "origins" || !showArcs) return [];
    const arcs: Array<{ from: [number, number]; to: [number, number]; severity: string; id: string }> = [];
    // Use top 6 origins (from real data or fallback) for arc lines
    const topEntries = Object.entries(originData)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 6);
    topEntries.forEach(([id, origin]) => {
      // Draw arcs to targets that aren't the origin itself
      TARGET_COORDS.forEach((target, ti) => {
        const dist = Math.abs(origin.coords[0] - target[0]) + Math.abs(origin.coords[1] - target[1]);
        if (dist < 5) return; // Skip self-arcs
        arcs.push({
          from: origin.coords,
          to: target,
          severity: origin.severity,
          id: `arc-${id}-${ti}`,
        });
      });
    });
    return arcs;
  }, [viewMode, showArcs, originData]);

  // ─── Hotspot markers (top threat countries) ──────────────────
  const hotspots = useMemo(() => {
    const spots: Array<{
      coords: [number, number]; count: number; severity: string;
      name: string; id: string;
    }> = [];

    if (aggMode === "continent") {
      continentData.forEach((data, continent) => {
        const coords = CONTINENT_CENTERS[continent];
        if (!coords) return;
        spots.push({
          coords,
          count: data.count,
          severity: data.maxSeverity,
          name: `${continent} (${data.countries} countries)`,
          id: `continent-${continent}`,
        });
      });
    } else {
      countryData.forEach((data, numericId) => {
        const coords = LABEL_COORDS[numericId];
        if (!coords || data.count < 2) return;
        spots.push({
          coords,
          count: data.count,
          severity: data.maxSeverity,
          name: COUNTRY_NAMES[numericId] ?? "",
          id: `hotspot-${numericId}`,
        });
      });
    }

    return spots.sort((a, b) => b.count - a.count).slice(0, 20);
  }, [countryData, continentData, aggMode]);

  // ─── Recent threat blips (animated incoming threat markers) ────
  const recentBlips = useMemo(() => {
    const blips: Array<{
      coords: [number, number]; severity: string; type: string;
      label: string; id: string;
    }> = [];
    const recent = stats?.recentThreats ?? [];
    // Show up to 8 most recent threats with known country codes
    recent.filter(t => t.country_code).slice(0, 8).forEach((t) => {
      const coords = ALPHA2_COORDS[t.country_code!];
      if (!coords) return;
      // Offset slightly so they don't stack exactly on hotspots
      const jitter: [number, number] = [
        coords[0] + (Math.sin(t.id.charCodeAt(0)) * 3),
        coords[1] + (Math.cos(t.id.charCodeAt(1)) * 2),
      ];
      blips.push({
        coords: jitter,
        severity: t.severity,
        type: t.type,
        label: t.domain || t.ioc_value || t.title?.slice(0, 20) || "threat",
        id: `blip-${t.id}`,
      });
    });
    return blips;
  }, [stats]);

  const getCountryFill = useCallback((geoId: string): string => {
    if (viewMode === "origins") {
      const origin = originData[geoId];
      if (!origin) return "rgba(148, 163, 184, 0.15)";
      const maxOriginCount = Math.max(...Object.values(originData).map(o => o.count), 1);
      const intensity = Math.min(origin.count / maxOriginCount, 1);
      return origin.severity === "critical"
        ? `rgba(239, 68, 68, ${0.12 + intensity * 0.55})`
        : origin.severity === "high"
        ? `rgba(249, 115, 22, ${0.12 + intensity * 0.48})`
        : `rgba(234, 179, 8, ${0.08 + intensity * 0.42})`;
    }

    const data = countryData.get(geoId);
    if (!data) return "rgba(148, 163, 184, 0.15)";

    const intensity = Math.min(data.count / 50, 1);
    const colors: Record<string, string> = {
      critical: `rgba(239, 68, 68, ${0.15 + intensity * 0.55})`,
      high:     `rgba(249, 115, 22, ${0.12 + intensity * 0.48})`,
      medium:   `rgba(234, 179, 8, ${0.08 + intensity * 0.42})`,
      low:      `rgba(34, 197, 94, ${0.06 + intensity * 0.34})`,
    };
    return colors[data.maxSeverity] || colors.low;
  }, [viewMode, countryData, originData]);

  const totalThreats = useMemo(() => {
    let total = 0;
    countryData.forEach((d) => (total += d.count));
    return total;
  }, [countryData]);

  // ─── Fetch provider data for origin quick view ──────────
  const { data: providerData } = useQuery({
    queryKey: ["provider-stats-map"],
    queryFn: () => providersApi.stats("30d"),
    staleTime: 5 * 60 * 1000,
  });

  // ─── Quick view data for selected country ────────────────
  const quickViewData = useMemo(() => {
    if (!selectedCountry || !stats) return null;
    const cc = selectedCountry.alpha2;
    const numId = selectedCountry.numericId;
    const recent = stats.recentThreats ?? [];
    const countryThreats = recent.filter((t) => t.country_code === cc);

    if (viewMode === "targets") {
      // Top 5 attack types for this target country
      const typeCounts = new Map<string, number>();
      countryThreats.forEach((t) => {
        typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
      });
      // Also aggregate from byType if this is the main country
      const countryEntry = stats.byCountry.find((c) => c.country_code === cc);
      if (countryEntry && countryThreats.length === 0) {
        // fallback: use global type distribution weighted by country share
        const ratio = countryEntry.count / Math.max(stats.summary.total ?? 1, 1);
        stats.byType.forEach((t) => {
          typeCounts.set(t.type, Math.max(typeCounts.get(t.type) ?? 0, Math.round(t.count * ratio)));
        });
      }
      const attackTypes = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      // Top 5 targeted brands/domains
      const domainCounts = new Map<string, { count: number; severity: string }>();
      countryThreats.forEach((t) => {
        const d = t.domain || t.ioc_value;
        if (!d) return;
        const existing = domainCounts.get(d);
        if (existing) {
          existing.count++;
        } else {
          domainCounts.set(d, { count: 1, severity: t.severity });
        }
      });
      const brands = Array.from(domainCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([domain, data]) => ({ domain, ...data }));

      const totalCount = countryData.get(numId)?.count ?? countryThreats.length;
      const severity = countryData.get(numId)?.maxSeverity ?? "medium";

      return { mode: "target" as const, attackTypes, brands, totalCount, severity };
    } else {
      // Origin mode: top 5 hosting providers for this origin country
      const providersList = providerData?.providers ?? [];
      const matchedProviders = providersList
        .filter((p) => p.top_countries?.includes(cc))
        .sort((a, b) => b.threat_count - a.threat_count)
        .slice(0, 5)
        .map((p) => ({
          name: p.provider_name,
          count: p.threat_count,
          critical: p.critical_count,
          high: p.high_count,
          trend: p.trend_direction,
          trendPct: p.trend_pct,
        }));

      // If no match, show top global providers as fallback
      const hostingProviders = matchedProviders.length > 0
        ? matchedProviders
        : providersList.slice(0, 5).map((p) => ({
            name: p.provider_name,
            count: p.threat_count,
            critical: p.critical_count,
            high: p.high_count,
            trend: p.trend_direction,
            trendPct: p.trend_pct,
          }));

      const originInfo = originData[numId];
      const totalCount = originInfo?.count ?? 0;
      const severity = originInfo?.severity ?? "medium";

      return { mode: "origin" as const, hostingProviders, totalCount, severity };
    }
  }, [selectedCountry, stats, viewMode, countryData, originData, providerData]);

  // ─── Country click handler ──────────────────────────────
  const handleCountryClick = useCallback((geoId: string, name: string) => {
    // Find alpha2 from numeric
    const alpha2 = Object.entries(ALPHA2_TO_NUMERIC).find(([, num]) => num === geoId)?.[0] ?? "";
    if (selectedCountry?.numericId === geoId) {
      setSelectedCountry(null); // Toggle off
    } else {
      setSelectedCountry({ numericId: geoId, alpha2, name });
    }
  }, [selectedCountry]);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 6));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));
  const resetView = () => { setZoom(1.25); setCenter([10, 20]); setSelectedCountry(null); };

  // Pulse value for animations (0-1 cycle)
  const pulse = Math.sin(animTick * 0.05) * 0.5 + 0.5;

  return (
    <div
      ref={mapRef}
      className={cn(
        "rounded-lg border border-[--border-subtle] bg-surface-raised relative overflow-hidden select-none transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-none"
          : "h-[400px] sm:h-[500px] lg:h-[650px]",
        isDragging.current ? "cursor-grabbing" : "cursor-grab"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "none" }}
    >
      {/* ─── Ambient glow overlays ─── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.03] via-transparent to-red-500/[0.02]" />
        <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-blue-500/[0.04] blur-[80px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-1/3 h-1/4 bg-red-500/[0.03] blur-[60px] rounded-full" />
      </div>

      {/* ─── Title + view controls ─── */}
      <div className="absolute top-3 left-3 lg:top-4 lg:left-4 z-10 flex flex-col gap-2">
        <div className="bg-[--surface-base]/90 p-2 lg:p-3 rounded-md border border-[--border-subtle] backdrop-blur-md shadow-lg">
          <h3 className="text-[--text-primary] font-bold tracking-wider flex items-center text-xs lg:text-sm">
            <Flame className="w-3 h-3 lg:w-4 lg:h-4 text-threat-critical mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">
              {viewMode === "targets" ? "GLOBAL THREAT HEATMAP" : "ATTACK ORIGIN MAP"}
            </span>
            <span className="sm:hidden">
              {viewMode === "targets" ? "THREATS" : "ORIGINS"}
            </span>
          </h3>
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("targets")}
            className={cn(
              "text-2xs px-2 py-1 rounded-md border backdrop-blur-md transition-all font-mono",
              viewMode === "targets"
                ? "bg-blue-500/20 text-blue-500 border-blue-500/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                : "bg-[--surface-base]/60 text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
            )}
          >
            <Target className="w-3 h-3 inline mr-1" />Targets
          </button>
          <button
            onClick={() => setViewMode("origins")}
            className={cn(
              "text-2xs px-2 py-1 rounded-md border backdrop-blur-md transition-all font-mono",
              viewMode === "origins"
                ? "bg-threat-critical/20 text-threat-critical border-threat-critical/40 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                : "bg-[--surface-base]/60 text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
            )}
          >
            <Crosshair className="w-3 h-3 inline mr-1" />Origins
          </button>
        </div>

        {/* Aggregation mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setAggMode("country")}
            className={cn(
              "text-2xs px-2 py-1 rounded-md border backdrop-blur-md transition-all font-mono",
              aggMode === "country"
                ? "bg-blue-500/15 text-cyan-300 border-blue-500/30"
                : "bg-[--surface-base]/60 text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
            )}
          >
            <MapIcon className="w-3 h-3 inline mr-1" />Country
          </button>
          <button
            onClick={() => setAggMode("continent")}
            className={cn(
              "text-2xs px-2 py-1 rounded-md border backdrop-blur-md transition-all font-mono",
              aggMode === "continent"
                ? "bg-blue-500/15 text-cyan-300 border-blue-500/30"
                : "bg-[--surface-base]/60 text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
            )}
          >
            <Globe2 className="w-3 h-3 inline mr-1" />Continent
          </button>
        </div>

        {/* Attack arcs toggle (origins mode) */}
        {viewMode === "origins" && (
          <button
            onClick={() => setShowArcs(!showArcs)}
            className={cn(
              "text-2xs px-2 py-1 rounded-md border backdrop-blur-md transition-all font-mono",
              showArcs
                ? "bg-purple-400/15 text-purple-300 border-purple-400/30"
                : "bg-[--surface-base]/60 text-[--text-tertiary] border-[--border-subtle]"
            )}
          >
            <Activity className="w-3 h-3 inline mr-1" />Arcs
          </button>
        )}
      </div>

      {/* ─── Right: Zoom + Legend ─── */}
      <div className="absolute top-3 right-3 lg:top-4 lg:right-4 z-10 flex flex-col gap-1">
        <div className="bg-[--surface-base]/90 rounded-md border border-[--border-subtle] backdrop-blur-md shadow-lg flex flex-col">
          <button onClick={zoomIn} className="p-1.5 hover:bg-surface-overlay/50 rounded-t-md transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-[--border-subtle]" />
          <button onClick={zoomOut} className="p-1.5 hover:bg-surface-overlay/50 transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-[--border-subtle]" />
          <button onClick={resetView} className="p-1.5 hover:bg-surface-overlay/50 transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title="Reset view">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-[--border-subtle]" />
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 hover:bg-surface-overlay/50 rounded-b-md transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Legend */}
        <div className="bg-[--surface-base]/90 p-2 rounded-md border border-[--border-subtle] backdrop-blur-md shadow-lg hidden sm:block mt-1">
          <div className="space-y-1">
            {[
              { label: "Critical", color: SEV_COLORS.critical, glow: SEV_GLOW.critical },
              { label: "High", color: SEV_COLORS.high, glow: SEV_GLOW.high },
              { label: "Medium", color: SEV_COLORS.medium, glow: SEV_GLOW.medium },
              { label: "Low", color: SEV_COLORS.low, glow: SEV_GLOW.low },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: l.color,
                    boxShadow: `0 0 6px ${l.glow}, 0 0 12px ${l.glow}`,
                  }}
                />
                <span className="text-[9px] font-mono text-[--text-tertiary]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tooltip ─── */}
      {tooltipContent && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-4 py-2.5 text-xs font-mono pointer-events-none backdrop-blur-md shadow-2xl rounded-lg border"
          style={{
            background: "rgba(10, 14, 26, 0.95)",
            borderColor: tooltipSeverity ? (SEV_COLORS[tooltipSeverity] ?? "var(--border-default)") + "40" : "var(--border-default)",
            boxShadow: tooltipSeverity
              ? `0 0 20px ${SEV_GLOW[tooltipSeverity] ?? "transparent"}, 0 4px 24px rgba(0,0,0,0.5)`
              : "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          <span
            className="text-sm font-bold"
            style={{ color: tooltipSeverity ? SEV_COLORS[tooltipSeverity] : "var(--text-primary)" }}
          >
            {tooltipContent}
          </span>
        </div>
      )}

      {/* ─── SVG Map ─── */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120 * zoom, center }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* SVG Definitions for glow filters */}
        <defs>
          <filter id="glow-critical" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor="#EF4444" floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-high" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor="#F97316" floodOpacity="0.5" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-medium" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feFlood floodColor="#EAB308" floodOpacity="0.4" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-low" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feFlood floodColor="#22C55E" floodOpacity="0.3" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-arc" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feFlood floodColor="#22D3EE" floodOpacity="0.4" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Radial gradient for hotspot halos */}
          <radialGradient id="halo-critical">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="halo-high">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="halo-medium">
            <stop offset="0%" stopColor="#EAB308" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="halo-low">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </radialGradient>
        </defs>

        <Sphere
          id="sphere-bg"
          fill="var(--surface-void, #060A12)"
          stroke="#22D3EE"
          strokeWidth={0.3}
          strokeOpacity={0.12}
        />
        <Graticule stroke="#22D3EE" strokeWidth={0.25} strokeOpacity={0.08} />

        {/* Country geometries */}
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoId = geo.id as string;
              const name = COUNTRY_NAMES[geoId] || geo.properties?.name || "";
              const data = viewMode === "targets" ? countryData.get(geoId) : null;
              const originInfo = viewMode === "origins" ? originData[geoId] : null;
              const hasData = !!(data || originInfo);
              const isSelected = selectedCountry?.numericId === geoId;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isSelected ? "rgba(34, 211, 238, 0.35)" : getCountryFill(geoId)}
                  stroke={isSelected ? "#22D3EE" : hasData ? "#22D3EE" : "#475569"}
                  strokeWidth={isSelected ? 1.2 : hasData ? 0.6 : 0.4}
                  strokeOpacity={isSelected ? 0.8 : hasData ? 0.4 : 0.35}
                  style={{
                    default: { outline: "none" },
                    hover: {
                      fill: isSelected
                        ? "rgba(34, 211, 238, 0.45)"
                        : hasData
                        ? "rgba(34, 211, 238, 0.3)"
                        : "rgba(148, 163, 184, 0.25)",
                      stroke: "#22D3EE",
                      strokeWidth: isSelected ? 1.4 : 0.8,
                      strokeOpacity: 0.6,
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: { outline: "none" },
                  }}
                  onClick={() => handleCountryClick(geoId, name)}
                  onMouseEnter={() => {
                    if (data) {
                      setTooltipContent(`${name}: ${data.count} threats · ${data.maxSeverity.toUpperCase()}`);
                      setTooltipSeverity(data.maxSeverity);
                    } else if (originInfo) {
                      setTooltipContent(`${name}: ${originInfo.count} attacks · ${originInfo.type}`);
                      setTooltipSeverity(originInfo.severity);
                    } else {
                      setTooltipContent(name);
                      setTooltipSeverity("");
                    }
                  }}
                  onMouseLeave={() => { setTooltipContent(""); setTooltipSeverity(""); }}
                />
              );
            })
          }
        </Geographies>

        {/* ─── Attack arc lines (origins mode) ─── */}
        {attackArcs.map((arc) => (
          <g key={arc.id}>
            {/* Glow layer */}
            <Line
              from={arc.from}
              to={arc.to}
              stroke={SEV_COLORS[arc.severity] ?? "#EF4444"}
              strokeWidth={2}
              strokeOpacity={0.15}
              strokeLinecap="round"
              filter="url(#glow-arc)"
            />
            {/* Main arc */}
            <Line
              from={arc.from}
              to={arc.to}
              stroke={SEV_COLORS[arc.severity] ?? "#EF4444"}
              strokeWidth={1}
              strokeOpacity={0.3 + pulse * 0.3}
              strokeLinecap="round"
              strokeDasharray="4 3"
            />
          </g>
        ))}

        {/* ─── Pulsing hotspot markers ─── */}
        {hotspots.map((spot) => {
          const maxCount = Math.max(...hotspots.map((s) => s.count), 1);
          const normalizedSize = Math.max(3, Math.min(20, (spot.count / maxCount) * 18 + 3));
          const color = SEV_COLORS[spot.severity] ?? "#22C55E";
          const isContinent = aggMode === "continent";

          return (
            <Marker key={spot.id} coordinates={spot.coords}>
              {/* Outer radiating halo */}
              <circle
                r={normalizedSize * (isContinent ? 3 : 2.2) + pulse * (isContinent ? 8 : 5)}
                fill={`url(#halo-${spot.severity})`}
                opacity={0.4 + pulse * 0.3}
              />

              {/* Pulsing ring 1 */}
              <circle
                r={normalizedSize * 1.8 + pulse * 4}
                fill="none"
                stroke={color}
                strokeWidth={0.5}
                opacity={0.3 - pulse * 0.2}
              />

              {/* Pulsing ring 2 */}
              <circle
                r={normalizedSize * 1.2 + pulse * 2}
                fill="none"
                stroke={color}
                strokeWidth={0.6}
                opacity={0.4 - pulse * 0.15}
              />

              {/* Core dot */}
              <circle
                r={normalizedSize * 0.6}
                fill={color}
                opacity={0.85}
                filter={`url(#glow-${spot.severity})`}
              />

              {/* Inner bright core */}
              <circle
                r={normalizedSize * 0.25}
                fill="white"
                opacity={0.7 + pulse * 0.3}
              />

              {/* Label */}
              <text
                textAnchor="middle"
                y={-normalizedSize * (isContinent ? 1.8 : 1.3) - 4}
                style={{
                  fontSize: isContinent ? 7 : 5.5,
                  fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                  textShadow: `0 0 8px rgba(0,0,0,0.9), 0 0 4px ${color}40`,
                  fill: color,
                  fontWeight: "bold",
                  pointerEvents: "none",
                }}
              >
                {spot.name}
              </text>

              {/* Count label */}
              <text
                textAnchor="middle"
                y={normalizedSize * (isContinent ? 1.8 : 1.3) + 6}
                style={{
                  fontSize: isContinent ? 6 : 4.5,
                  fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                  textShadow: "0 0 6px rgba(0,0,0,0.9)",
                  fill: "rgba(241, 245, 249, 0.8)",
                  fontWeight: "bold",
                  pointerEvents: "none",
                }}
              >
                {spot.count.toLocaleString()}
              </text>
            </Marker>
          );
        })}

        {/* Country labels (for countries not in hotspots, in country mode) */}
        {aggMode === "country" &&
          Object.entries(LABEL_COORDS).map(([iso, coords]) => {
            const name = COUNTRY_NAMES[iso] || "";
            const data = countryData.get(iso);
            const isHotspot = hotspots.some((s) => s.id === `hotspot-${iso}`);
            if (isHotspot) return null; // Already rendered as hotspot marker
            if (!data || data.count === 0) {
              // Render faint label for non-data countries
              return (
                <Marker key={`label-${iso}`} coordinates={coords}>
                  <text
                    textAnchor="middle"
                    y={2}
                    style={{
                      fontSize: 4,
                      fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                      textShadow: "0 0 3px rgba(0,0,0,0.8)",
                      fill: "#64748B",
                      pointerEvents: "none",
                    }}
                  >
                    {name}
                  </text>
                </Marker>
              );
            }
            return null;
          })}

        {/* ─── Recent threat blips (animated incoming markers) ─── */}
        {recentBlips.map((blip) => {
          const color = SEV_COLORS[blip.severity] ?? "#22D3EE";
          return (
            <Marker key={blip.id} coordinates={blip.coords}>
              {/* Expanding ring animation */}
              <circle
                r={6 + pulse * 8}
                fill="none"
                stroke={color}
                strokeWidth={0.8}
                opacity={0.5 - pulse * 0.4}
              />
              {/* Core blip */}
              <circle
                r={2.5}
                fill={color}
                opacity={0.9}
                filter={`url(#glow-${blip.severity})`}
              />
              {/* Bright center */}
              <circle r={1} fill="white" opacity={0.6 + pulse * 0.4} />
              {/* Label */}
              <text
                textAnchor="middle"
                y={-8}
                style={{
                  fontSize: 3.5,
                  fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                  textShadow: `0 0 4px rgba(0,0,0,0.9)`,
                  fill: color,
                  opacity: 0.8,
                  pointerEvents: "none",
                }}
              >
                {blip.label}
              </text>
            </Marker>
          );
        })}
      </ComposableMap>

      {/* ─── Scan-line animation ─── */}
      <div className="threat-map-scanline absolute inset-x-0 h-[2px] pointer-events-none z-[5]" />

      {/* ─── Edge vignette ─── */}
      <div className="absolute inset-0 pointer-events-none z-[4]"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(6,10,18,0.6) 100%)",
        }}
      />

      {/* ─── Grid overlay ─── */}
      <div className="absolute inset-0 pointer-events-none z-[3] opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(34,211,238,1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* ─── Country Quick View Panel ─── */}
      {selectedCountry && quickViewData && (
        <div className="absolute bottom-14 right-3 lg:bottom-16 lg:right-4 z-20 w-[280px] sm:w-[320px] threat-quickview-enter">
          <div
            className="rounded-xl border overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(10,14,26,0.97) 0%, rgba(17,24,39,0.95) 100%)",
              borderColor: quickViewData.severity === "critical" ? "rgba(239,68,68,0.4)"
                : quickViewData.severity === "high" ? "rgba(249,115,22,0.35)"
                : "rgba(34,211,238,0.25)",
              boxShadow: quickViewData.severity === "critical"
                ? "0 0 30px rgba(239,68,68,0.15), 0 8px 32px rgba(0,0,0,0.5)"
                : quickViewData.severity === "high"
                ? "0 0 25px rgba(249,115,22,0.12), 0 8px 32px rgba(0,0,0,0.5)"
                : "0 0 25px rgba(34,211,238,0.1), 0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Gradient top accent bar */}
            <div
              className="h-[2px]"
              style={{
                background: quickViewData.severity === "critical"
                  ? "linear-gradient(90deg, #EF4444, #F97316, #EF4444)"
                  : quickViewData.severity === "high"
                  ? "linear-gradient(90deg, #F97316, #EAB308, #F97316)"
                  : "linear-gradient(90deg, #22D3EE, #06B6D4, #22D3EE)",
              }}
            />

            {/* Header */}
            <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-white/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: SEV_COLORS[quickViewData.severity] ?? "#22D3EE" }}
                />
                <span className="text-xs font-bold text-[--text-primary] truncate">
                  {selectedCountry.name}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border shrink-0" style={{
                  color: SEV_COLORS[quickViewData.severity] ?? "#22D3EE",
                  borderColor: (SEV_COLORS[quickViewData.severity] ?? "#22D3EE") + "40",
                  backgroundColor: (SEV_COLORS[quickViewData.severity] ?? "#22D3EE") + "15",
                }}>
                  {quickViewData.totalCount} {viewMode === "targets" ? "threats" : "attacks"}
                </span>
              </div>
              <button
                onClick={() => setSelectedCountry(null)}
                className="p-1 rounded-md hover:bg-white/10 text-[--text-tertiary] hover:text-[--text-primary] transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-3.5 py-3 space-y-3">
              {quickViewData.mode === "target" ? (
                <>
                  {/* Attack Types */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-[9px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary]">
                        Attack Types
                      </span>
                    </div>
                    {quickViewData.attackTypes.length > 0 ? (
                      <div className="space-y-1.5">
                        {quickViewData.attackTypes.map((at, i) => {
                          const maxC = quickViewData.attackTypes[0]?.count ?? 1;
                          const pct = Math.round((at.count / maxC) * 100);
                          const typeColor = ATTACK_TYPE_COLORS[at.type] ?? "#64748B";
                          return (
                            <div key={at.type} className="flex items-center gap-2 group">
                              <span className="text-[9px] font-mono text-[--text-tertiary] w-3">{i + 1}</span>
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                              <span className="text-[11px] text-[--text-primary] flex-1 capitalize truncate">{at.type}</span>
                              <div className="w-14 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, backgroundColor: typeColor, opacity: 0.8 }}
                                />
                              </div>
                              <span className="text-[10px] font-mono tabular-nums w-6 text-right" style={{ color: typeColor }}>
                                {at.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-[--text-tertiary] italic">No attack data available</p>
                    )}
                  </div>

                  {/* Separator */}
                  <div className="border-t border-white/[0.06]" />

                  {/* Targeted Brands */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="w-3 h-3 text-blue-500" />
                      <span className="text-[9px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary]">
                        Targeted Brands
                      </span>
                    </div>
                    {quickViewData.brands.length > 0 ? (
                      <div className="space-y-1.5">
                        {quickViewData.brands.map((b, i) => (
                          <div key={b.domain} className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-[--text-tertiary] w-3">{i + 1}</span>
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: SEV_COLORS[b.severity] ?? "#22D3EE" }}
                            />
                            <span className="text-[11px] font-mono text-[--text-primary] flex-1 truncate">{b.domain}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                              color: SEV_COLORS[b.severity] ?? "#22D3EE",
                              backgroundColor: (SEV_COLORS[b.severity] ?? "#22D3EE") + "15",
                            }}>
                              {b.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-[--text-tertiary] italic">No brand data available</p>
                    )}
                  </div>
                </>
              ) : (
                /* Origin mode: Hosting Providers */
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Server className="w-3 h-3 text-orange-400" />
                    <span className="text-[9px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary]">
                      Hosting Providers
                    </span>
                  </div>
                  {quickViewData.hostingProviders.length > 0 ? (
                    <div className="space-y-2">
                      {quickViewData.hostingProviders.map((hp, i) => {
                        const maxC = quickViewData.hostingProviders[0]?.count ?? 1;
                        const pct = Math.round((hp.count / maxC) * 100);
                        return (
                          <div key={hp.name} className="group">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-mono text-[--text-tertiary] w-3">{i + 1}</span>
                              <span className="text-[11px] text-[--text-primary] font-medium flex-1 truncate">{hp.name}</span>
                              <span className="text-[10px] font-mono tabular-nums text-[--text-secondary]">{hp.count}</span>
                              <span className={cn(
                                "text-[9px] font-mono",
                                hp.trend === "up" ? "text-threat-critical" : hp.trend === "down" ? "text-green-400" : "text-[--text-tertiary]"
                              )}>
                                {hp.trend === "up" ? "\u2191" : hp.trend === "down" ? "\u2193" : "\u2192"}{Math.abs(hp.trendPct)}%
                              </span>
                            </div>
                            <div className="ml-5 flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex gap-1.5">
                                {hp.critical > 0 && (
                                  <span className="text-[8px] font-mono text-threat-critical">{hp.critical}C</span>
                                )}
                                {hp.high > 0 && (
                                  <span className="text-[8px] font-mono text-threat-high">{hp.high}H</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[--text-tertiary] italic">No provider data available</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3.5 py-1.5 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[8px] font-mono text-[--text-tertiary] uppercase tracking-wider">
                {viewMode === "targets" ? "TARGET" : "ORIGIN"} INTEL
              </span>
              <span className="text-[8px] font-mono text-[--text-tertiary]">
                TAP COUNTRY TO DISMISS
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats bar ─── */}
      <div className="absolute bottom-3 left-3 right-3 lg:bottom-4 lg:left-4 lg:right-4 z-10 bg-[--surface-base]/90 backdrop-blur-md rounded-md border border-[--border-subtle] px-3 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[9px] lg:text-2xs font-mono text-blue-500 font-semibold">LIVE</span>
          </div>
          <span className="text-[9px] lg:text-2xs font-mono text-[--text-tertiary]">
            {countryData.size} REGIONS {"\u00b7"} {aggMode.toUpperCase()} {"\u00b7"} {viewMode === "targets" ? "TARGET" : "ORIGIN"} VIEW
          </span>
        </div>
        <div className="flex items-center gap-3">
          {zoom > 1.3 && (
            <span className="text-[9px] font-mono text-blue-500/70">{zoom.toFixed(1)}{"\u00d7"}</span>
          )}
          {/* Daily threats count (matches KPI bar above) */}
          {stats?.dailyStats && (
            <span className="text-[9px] lg:text-2xs font-mono text-amber-400">
              {stats.dailyStats.threatsFlagged} TODAY
            </span>
          )}
          <span className="text-[9px] lg:text-2xs font-mono font-bold" style={{
            color: totalThreats > 0 ? "#EF4444" : "#22D3EE",
          }}>
            {totalThreats.toLocaleString()} TOTAL
          </span>
        </div>
      </div>
    </div>
  );
}

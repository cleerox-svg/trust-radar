// Averrow Design System — Component Barrel
// Future-facing import path: @/design-system/components
//
// Usage:
//   import { Card, Button, Badge, Avatar, StatCard, ... } from '@/design-system/components'
//
// Components live in components/ui/ during restructure.
// This barrel re-exports everything. When files move to design-system/components/
// in a later session, only this file changes — no callsite updates needed.

// ── Foundation ─────────────────────────────────────────────────────────────
export { Card, CardHeader, CardBody } from '../../components/ui/Card';
export type { CardProps, CardVariant } from '../../components/ui/Card';

export { Button } from '../../components/ui/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from '../../components/ui/Button';

export { Badge } from '../../components/ui/Badge';
export type { BadgeProps, Severity, BadgeStatus, BadgeSize } from '../../components/ui/Badge';

export { Avatar } from '../../components/ui/Avatar';
export type { AvatarProps, AvatarSeverity } from '../../components/ui/Avatar';

export { StatCard, SimpleStatCard, DetailStatCard } from '../../components/ui/StatCard';
export type { StatCardProps } from '../../components/ui/StatCard';

// ── Data display ───────────────────────────────────────────────────────────
export { DataRow, SeverityDot } from '../../components/ui/DataRow';
export type { DataRowProps, SeverityDotProps } from '../../components/ui/DataRow';

export { GlowNumber } from '../../components/ui/GlowNumber';
export type { GlowNumberProps, GlowSize, GlowFormat } from '../../components/ui/GlowNumber';

export { LiveIndicator } from '../../components/ui/LiveIndicator';
export type { LiveIndicatorProps } from '../../components/ui/LiveIndicator';

export { SectionLabel } from '../../components/ui/SectionLabel';
export type { SectionLabelProps } from '../../components/ui/SectionLabel';

// ── Navigation & layout ────────────────────────────────────────────────────
export { Tabs } from '../../components/ui/Tabs';
export type { Tab, TabsProps } from '../../components/ui/Tabs';

export { FilterBar } from '../../components/ui/FilterBar';
export type { FilterBarProps, FilterOption } from '../../components/ui/FilterBar';

export { PageHeader } from '../../components/ui/PageHeader';
export type { PageHeaderProps } from '../../components/ui/PageHeader';

export { StatGrid } from '../../components/ui/StatGrid';
export type { StatGridProps } from '../../components/ui/StatGrid';

// ── Form elements ──────────────────────────────────────────────────────────
export { Input } from '../../components/ui/Input';

export { Select } from '../../components/ui/Select';

// ── Feedback ───────────────────────────────────────────────────────────────
export { EmptyState } from '../../components/ui/EmptyState';

export { Skeleton } from '../../components/ui/Skeleton';

// ── Aliases (backward compat — import new names for new code) ──────────────
export { Card as DeepCard } from '../../components/ui/Card';
export { Button as DimensionalButton } from '../../components/ui/Button';
export { Badge as SeverityChip } from '../../components/ui/Badge';
export { Avatar as DimensionalAvatar } from '../../components/ui/Avatar';

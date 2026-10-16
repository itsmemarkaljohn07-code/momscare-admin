import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

const COLOR_MAP = {
  pink:   { bg: 'var(--stat-1)', fg: 'var(--stat-1-foreground)' },
  mint:   { bg: 'var(--stat-2)', fg: 'var(--stat-2-foreground)' },
  purple: { bg: 'var(--stat-3)', fg: 'var(--stat-3-foreground)' },
  amber:  { bg: 'var(--stat-4)', fg: 'var(--stat-4-foreground)' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'pink',
  trend,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: keyof typeof COLOR_MAP;
  trend?: { value: number; positive: boolean } | null;
}) {
  const c = COLOR_MAP[color];
  const TrendIcon = trend?.positive ? TrendingUp : TrendingDown;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border p-5 shadow-soft transition-transform hover:-translate-y-0.5"
      style={{
        backgroundColor: c.bg,
        color: c.fg,
        borderColor: `color-mix(in srgb, ${c.fg} 22%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium opacity-80">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p className="flex items-center gap-1 text-xs font-medium opacity-90">
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend.value)}% vs last week
            </p>
          )}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
          style={{ backgroundColor: `color-mix(in srgb, ${c.fg} 14%, transparent)` }}
        >
          <Icon className="h-5 w-5" style={{ color: c.fg }} />
        </div>
      </div>
    </div>
  );
}
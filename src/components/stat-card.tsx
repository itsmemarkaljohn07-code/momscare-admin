import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

const COLOR_MAP = {
  pink:   { text: 'var(--accent-pink)',   bg: 'var(--accent-pink-bg)' },
  purple: { text: 'var(--accent-purple)', bg: 'var(--accent-purple-bg)' },
  mint:   { text: 'var(--accent-mint)',   bg: 'var(--accent-mint-bg)' },
  amber:  { text: 'var(--accent-amber)',  bg: 'var(--accent-amber-bg)' },
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
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: c.text }} />
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p
              className={`flex items-center gap-1 text-xs font-medium ${
                trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              }`}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend.value)}% vs last week
            </p>
          )}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
          style={{ backgroundColor: c.bg, boxShadow: `0 0 0 4px ${c.bg}` }}
        >
          <Icon className="h-5 w-5" style={{ color: c.text }} />
        </div>
      </CardContent>
    </Card>
  );
}
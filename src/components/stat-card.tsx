import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

const COLOR_MAP = {
  pink:   { bg: 'bg-[#fce8f3]', text: 'text-[#d9609a]', ring: 'ring-[#f6c9e2]/50' },
  purple: { bg: 'bg-[#f0e6fb]', text: 'text-[#9b6fc4]', ring: 'ring-[#dcc4f2]/50' },
  mint:   { bg: 'bg-[#e0f5f2]', text: 'text-[#4fa89c]', ring: 'ring-[#bfe8e1]/50' },
  amber:  { bg: 'bg-[#fdf1e0]', text: 'text-[#d99a3a]', ring: 'ring-[#f5ddb0]/50' },
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
      <div className={`absolute inset-x-0 top-0 h-1 ${c.bg}`} />
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p
              className={`flex items-center gap-1 text-xs font-medium ${
                trend.positive ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend.value)}% vs last week
            </p>
          )}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg} ring-4 ${c.ring} transition-transform group-hover:scale-105`}
        >
          <Icon className={`h-5 w-5 ${c.text}`} />
        </div>
      </CardContent>
    </Card>
  );
}
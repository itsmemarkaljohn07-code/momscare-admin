import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

const COLOR_MAP = {
  pink:   { bg: 'bg-[#fce8f3]', text: 'text-[#d9609a]' },
  purple: { bg: 'bg-[#f0e6fb]', text: 'text-[#9b6fc4]' },
  mint:   { bg: 'bg-[#e0f5f2]', text: 'text-[#4fa89c]' },
  amber:  { bg: 'bg-[#fdf1e0]', text: 'text-[#d99a3a]' },
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
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {trend && (
            <p className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.positive ? '+' : ''}
              {trend.value}% vs last week
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
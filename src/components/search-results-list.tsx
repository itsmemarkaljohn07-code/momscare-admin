import Link from 'next/link';
import { Users, Stethoscope, ShieldCheck, CalendarDays, SearchX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SearchItem, SearchItemType } from '@/lib/build-search-index';

const TYPE_ICON: Record<SearchItemType, typeof Users> = {
  patient: Users,
  doctor: Stethoscope,
  admin: ShieldCheck,
  appointment: CalendarDays,
};

const TYPE_GROUP_LABEL: Record<SearchItemType, string> = {
  patient: 'Patients',
  doctor: 'Doctors',
  appointment: 'Appointments',
  admin: 'Admins',
};

const TYPE_ORDER: SearchItemType[] = ['patient', 'doctor', 'appointment', 'admin'];

export function SearchResultsList({ results }: { results: SearchItem[] }) {
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <SearchX className="h-8 w-8" />
          <p className="text-sm">No results found.</p>
        </CardContent>
      </Card>
    );
  }

  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {grouped.map(({ type, items }) => {
        const Icon = TYPE_ICON[type];
        return (
          <div key={type} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {TYPE_GROUP_LABEL[type]} ({items.length})
            </p>
            <div className="space-y-1.5">
              {items.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  href={r.url}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
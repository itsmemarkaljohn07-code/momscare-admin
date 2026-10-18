'use client';

import { useMemo, useState } from 'react';
import { LoadMoreButton } from '@/components/load-more';
import { useLoadMore } from '@/hooks/use-load-more';
import Link from 'next/link';
import { CalendarClock, Camera, ChevronRight, Search, SearchX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FilterChip, FilterSelect } from '@/components/filter-controls';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { TRIMESTER_LABELS, type Trimester } from '@/lib/pregnancy-display';

export interface PatientCardData {
  uid: string;
  fullName: string;
  email: string | null;
  week: number | null;
  trimester: Trimester | null;
  progress: number | null;
  dueLabel: string | null;
  dueSortKey: string | null;
  photoCount: number;
  lastUploadLabel: string | null;
  lastUploadAt: string | null;
  nextAppointment: { label: string; dateLabel: string; time: string } | null;
  pendingCount: number;
}

type SortKey = 'recent' | 'due' | 'name';
type TrimesterFilter = 'all' | Trimester;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recent activity' },
  { value: 'due', label: 'Due date (earliest first)' },
  { value: 'name', label: 'Name (A–Z)' },
];

// Nulls always sort last, whichever direction.
function compareNullable(a: string | null, b: string | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b) * direction;
}

function PatientCard({ p }: { p: PatientCardData }) {
  const avatar = getAvatarStyle(p.uid);

  return (
    <Link
      href={`/doctor/${p.uid}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full rounded-2xl shadow-soft transition-all group-hover:-translate-y-0.5 group-hover:shadow-card">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${avatar.bg} ${avatar.text}`}
            >
              {getInitials(p.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{p.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.email ?? 'No email on file'}
              </p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>

          {p.week !== null ? (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  Week {p.week}
                  {p.trimester && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {TRIMESTER_LABELS[p.trimester]}
                    </span>
                  )}
                </p>
                {p.dueLabel && (
                  <p className="shrink-0 text-xs text-muted-foreground">Due {p.dueLabel}</p>
                )}
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Pregnancy progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.progress ?? 0}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${p.progress ?? 0}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No due date set</p>
          )}

          <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
            <p className="flex min-w-0 items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {p.nextAppointment
                  ? `Next: ${p.nextAppointment.label} · ${p.nextAppointment.dateLabel}, ${p.nextAppointment.time}`
                  : 'No upcoming appointment'}
              </span>
            </p>
            <p className="flex min-w-0 items-center gap-2">
              <Camera className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {p.photoCount === 0
                  ? 'No photos yet'
                  : `${p.photoCount} photo${p.photoCount === 1 ? '' : 's'}${
                      p.lastUploadLabel ? ` · last ${p.lastUploadLabel}` : ''
                    }`}
              </span>
            </p>
            {p.pendingCount > 0 && (
              <p>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: 'var(--status-pending-bg)',
                    color: 'var(--status-pending)',
                  }}
                >
                  {p.pendingCount} awaiting your approval
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DoctorPatientsBrowser({ patients }: { patients: PatientCardData[] }) {
  const [query, setQuery] = useState('');
  const [trimester, setTrimester] = useState<TrimesterFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)
    );
  }, [patients, query]);

  // Counts follow the search box, so a chip shows what picking it gives.
  const counts = useMemo(() => {
    const c: Record<TrimesterFilter, number> = { all: searched.length, 1: 0, 2: 0, 3: 0 };
    for (const p of searched) if (p.trimester) c[p.trimester] += 1;
    return c;
  }, [searched]);

  const visible = useMemo(() => {
    const list = searched.filter((p) => trimester === 'all' || p.trimester === trimester);
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.fullName.localeCompare(b.fullName);
      if (sort === 'due') return compareNullable(a.dueSortKey, b.dueSortKey, 1);
      return compareNullable(a.lastUploadAt, b.lastUploadAt, -1);
    });
  }, [searched, trimester, sort]);

  // 20 cards at a time; a new search, filter or sort starts from the first 20.
  const page = useLoadMore(visible, 20, `${query.trim().toLowerCase()}|${trimester}|${sort}`);

  const isFiltered = query.trim() !== '' || trimester !== 'all';

  function clearFilters() {
    setQuery('');
    setTrimester('all');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="rounded-full pl-10"
            />
          </div>
          <div className="w-full sm:ml-auto sm:w-56">
            <FilterSelect
              label="Sort patients"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={trimester === 'all'} onClick={() => setTrimester('all')} count={counts.all}>
            All
          </FilterChip>
          {([1, 2, 3] as const).map((t) => (
            <FilterChip key={t} active={trimester === t} onClick={() => setTrimester(t)} count={counts[t]}>
              {TRIMESTER_LABELS[t]}
            </FilterChip>
          ))}
        </div>

        {isFiltered && (
          <p className="text-sm text-muted-foreground">
            Showing {visible.length} of {patients.length} patient{patients.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-semibold">No patients match</p>
            <p className="text-sm text-muted-foreground">
              Try a different name or trimester.
            </p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {page.visible.map((p) => (
              <PatientCard key={p.uid} p={p} />
            ))}
          </div>
          <LoadMoreButton hasMore={page.hasMore} onClick={page.loadMore} shown={page.shown} total={page.total} />
        </>
      )}
    </div>
  );
}
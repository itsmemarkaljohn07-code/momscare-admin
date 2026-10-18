'use client';

import { useMemo, useState } from 'react';
import { LoadMoreButton } from '@/components/load-more';
import { useLoadMore } from '@/hooks/use-load-more';
import { SearchX } from 'lucide-react';
import { DoctorSnapshotCard } from '@/components/doctor-snapshot-card';
import { SnapshotViewer } from '@/components/snapshot-viewer';
import { FilterChip, FilterSelect } from '@/components/filter-controls';
import type { AdminSnapshotPhoto } from '@/lib/get-user-snapshots';

// Deliberately permissive: anything the server page passes that has a
// patient id/name alongside the photo fields satisfies these.
export interface BrowserPhoto extends AdminSnapshotPhoto {
  patientUid: string;
  patientName?: string | null;
}

export interface BrowserGroup {
  dateKey: string;
  label: string;
  items: BrowserPhoto[];
}

type TypeFilter = 'all' | AdminSnapshotPhoto['type'];

const TYPE_CHIPS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bump', label: 'Bump' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'milestone', label: 'Milestone' },
];

export function DoctorSnapshotsBrowser({ groups }: { groups: BrowserGroup[] }) {
  const [patientFilter, setPatientFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [activeId, setActiveId] = useState<string | null>(null);

  const totalPhotos = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);

  const patients = useMemo(() => {
    const byUid = new Map<string, string>();
    for (const g of groups) {
      for (const p of g.items) {
        if (!byUid.has(p.patientUid)) byUid.set(p.patientUid, p.patientName ?? 'Unnamed patient');
      }
    }
    return Array.from(byUid, ([uid, name]) => ({ uid, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [groups]);

  // Type counts reflect the selected patient, so the chips always show
  // what you'd actually get by picking them.
  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = { all: 0, bump: 0, ultrasound: 0, milestone: 0 };
    for (const g of groups) {
      for (const p of g.items) {
        if (patientFilter !== 'all' && p.patientUid !== patientFilter) continue;
        counts.all += 1;
        counts[p.type] += 1;
      }
    }
    return counts;
  }, [groups, patientFilter]);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (p) =>
              (patientFilter === 'all' || p.patientUid === patientFilter) &&
              (typeFilter === 'all' || p.type === typeFilter)
          ),
        }))
        .filter((g) => g.items.length > 0),
    [groups, patientFilter, typeFilter]
  );

  // One flat list in display order — what the viewer steps through.
  const flat = useMemo(() => visibleGroups.flatMap((g) => g.items), [visibleGroups]);
  // 20 photos at a time, keeping their date groups; a new filter starts
  // from the first 20. The viewer still steps through every match.
  const page = useLoadMore(flat, 20, `${patientFilter}|${typeFilter}`);
  const shownGroups = useMemo(() => {
    const shown = new Set(page.visible.map((p) => p.id));
    return visibleGroups
      .map((g) => ({ ...g, total: g.items.length, items: g.items.filter((p) => shown.has(p.id)) }))
      .filter((g) => g.items.length > 0);
  }, [visibleGroups, page.visible]);
  const activeIndex = activeId ? flat.findIndex((p) => p.id === activeId) : -1;
  const active = activeIndex >= 0 ? flat[activeIndex] : null;

  const isFiltered = patientFilter !== 'all' || typeFilter !== 'all';

  function clearFilters() {
    setPatientFilter('all');
    setTypeFilter('all');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {TYPE_CHIPS.map((c) => (
              <FilterChip
                key={c.value}
                active={typeFilter === c.value}
                onClick={() => setTypeFilter(c.value)}
                count={typeCounts[c.value]}
              >
                {c.label}
              </FilterChip>
            ))}
          </div>

          {patients.length > 1 && (
            <div className="w-full sm:w-56">
              <FilterSelect
                label="Filter by patient"
                value={patientFilter}
                onChange={setPatientFilter}
                options={[
                  { value: 'all', label: 'All patients' },
                  ...patients.map((p) => ({ value: p.uid, label: p.name })),
                ]}
              />
            </div>
          )}
        </div>

        {isFiltered && (
          <p className="text-sm text-muted-foreground">
            Showing {flat.length} of {totalPhotos} photo{totalPhotos === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-semibold">No photos match these filters</p>
            <p className="text-sm text-muted-foreground">
              Try a different patient or photo type.
            </p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        shownGroups.map((group) => (
          <section key={group.dateKey} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {group.label}
                <span className="ml-1.5 font-normal opacity-70">· {group.total}</span>
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
              {group.items.map((photo) => (
                <DoctorSnapshotCard
                  key={photo.id}
                  photo={photo}
                  patientUid={photo.patientUid}
                  patientName={photo.patientName}
                  onOpen={() => setActiveId(photo.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <LoadMoreButton hasMore={page.hasMore} onClick={page.loadMore} shown={page.shown} total={page.total} />

      <SnapshotViewer
        photo={active}
        patientUid={active?.patientUid ?? ''}
        patientName={active?.patientName}
        open={!!active}
        onOpenChange={(open) => {
          if (!open) setActiveId(null);
        }}
        position={active ? { index: activeIndex, total: flat.length } : undefined}
        onPrev={activeIndex > 0 ? () => setActiveId(flat[activeIndex - 1].id) : undefined}
        onNext={
          activeIndex >= 0 && activeIndex < flat.length - 1
            ? () => setActiveId(flat[activeIndex + 1].id)
            : undefined
        }
      />
    </div>
  );
}
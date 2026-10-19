'use client';

import { useMemo, useState } from 'react';
import { Camera, ImageOff } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadMoreButton } from '@/components/load-more';
import { SNAPSHOT_TYPE_LABELS, SnapshotViewer } from '@/components/snapshot-viewer';
import { useLoadMore } from '@/hooks/use-load-more';
import { formatClinicDate } from '@/lib/pregnancy-display';
import type { AdminSnapshotPhoto, SnapshotDayGroup } from '@/lib/get-user-snapshots';

/** Keeps a tile's shape close to the photo's own (portrait or landscape)
 *  without extreme panoramas or slivers. */
function clampRatio(r: number): number {
  return Math.min(1.8, Math.max(0.6, r));
}

function SnapshotTile({ photo, onOpen }: { photo: AdminSnapshotPhoto; onOpen: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const typeLabel = SNAPSHOT_TYPE_LABELS[photo.type] ?? photo.type;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-soft">
      <button
        type="button"
        onClick={onOpen}
        disabled={failed}
        aria-label={`Open ${typeLabel} snapshot, week ${photo.week}`}
        className="relative block w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        style={{ aspectRatio: ratio ? clampRatio(ratio) : 4 / 5 }}
      >
        {failed ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
            <ImageOff className="h-5 w-5" aria-hidden="true" />
            Image unavailable
          </span>
        ) : (
          <>
            {ratio === null && <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.imageUrl}
              alt=""
              loading="lazy"
              onLoad={(e) => {
                const img = e.currentTarget;
                setRatio(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 4 / 5);
              }}
              onError={() => setFailed(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${ratio === null ? 'opacity-0' : 'opacity-100'}`}
            />
          </>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
          {typeLabel}
        </span>
      </button>
      <div className="min-w-0 space-y-1 p-3">
        <p className="text-xs text-muted-foreground">
          Week {photo.week} · {photo.createdAt ? formatClinicDate(photo.createdAt, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unknown'}
        </p>
        {photo.caption && <p className="line-clamp-2 break-words text-sm">{photo.caption}</p>}
      </div>
    </article>
  );
}

/**
 * The patient's Snapshots for an admin: grouped by upload day, 20 at a
 * time, opened in the read-only viewer (no comments, no edits).
 */
export function AdminPatientSnapshots({
  groups,
  patientUid,
  patientName,
}: {
  groups: SnapshotDayGroup[];
  patientUid: string;
  patientName: string;
}) {
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const page = useLoadMore(flat, 20);
  const [activeId, setActiveId] = useState<string | null>(null);

  const shownGroups = useMemo(() => {
    const shown = new Set(page.visible.map((p) => p.id));
    return groups
      .map((g) => ({ ...g, total: g.items.length, items: g.items.filter((p) => shown.has(p.id)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, page.visible]);

  const activeIndex = activeId ? flat.findIndex((p) => p.id === activeId) : -1;
  const active = activeIndex >= 0 ? flat[activeIndex] : null;

  if (flat.length === 0) {
    return <EmptyState icon={Camera} title="No snapshots yet" description="Photos the patient uploads in the app appear here." />;
  }

  return (
    <div className="space-y-6">
      {shownGroups.map((group) => (
        <section key={group.dateKey} className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {group.label}
              <span className="ml-1.5 font-normal opacity-70">· {group.total}</span>
            </h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4">
            {group.items.map((photo) => (
              <SnapshotTile key={photo.id} photo={photo} onOpen={() => setActiveId(photo.id)} />
            ))}
          </div>
        </section>
      ))}

      <LoadMoreButton hasMore={page.hasMore} onClick={page.loadMore} shown={page.shown} total={page.total} />

      <SnapshotViewer
        readOnly
        photo={active}
        patientUid={patientUid}
        patientName={patientName}
        open={!!active}
        onOpenChange={(o) => !o && setActiveId(null)}
        position={active ? { index: activeIndex, total: flat.length } : undefined}
        onPrev={activeIndex > 0 ? () => setActiveId(flat[activeIndex - 1].id) : undefined}
        onNext={activeIndex >= 0 && activeIndex < flat.length - 1 ? () => setActiveId(flat[activeIndex + 1].id) : undefined}
      />
    </div>
  );
}

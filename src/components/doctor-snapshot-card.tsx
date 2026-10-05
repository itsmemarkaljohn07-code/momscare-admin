'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Maximize2 } from 'lucide-react';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { formatClinicDate } from '@/lib/pregnancy-display';
import {
  SNAPSHOT_TYPE_LABELS,
  SnapshotHealthMetrics,
  SnapshotViewer,
} from '@/components/snapshot-viewer';
import type { AdminSnapshotPhoto } from '@/lib/get-user-snapshots';

export function DoctorSnapshotCard({
  photo,
  patientUid,
  patientName,
  onOpen,
}: {
  photo: AdminSnapshotPhoto;
  patientUid: string;
  patientName?: string | null;
  /** When a parent owns the viewer (the list page, which adds
   *  previous/next), it passes this; otherwise the card opens its own
   *  single-photo viewer. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const typeLabel = SNAPSHOT_TYPE_LABELS[photo.type] ?? photo.type;
  const avatar = getAvatarStyle(patientUid);

  function handleOpen() {
    if (onOpen) onOpen();
    else setOpen(true);
  }

  return (
    <>
      <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-card">
        <button
          type="button"
          onClick={handleOpen}
          aria-label={`Open ${typeLabel} snapshot${patientName ? ` from ${patientName}` : ''}`}
          className="relative block aspect-[4/5] w-full overflow-hidden bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {typeLabel}
          </span>
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </button>

        <div className="min-w-0 flex-1 space-y-2 p-3">
          {patientName && (
            <Link
              href={`/doctor/${patientUid}`}
              className="flex min-w-0 items-center gap-2 hover:underline"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatar.bg} ${avatar.text}`}
              >
                {getInitials(patientName)}
              </span>
              <span className="truncate text-sm font-semibold">{patientName}</span>
            </Link>
          )}

          <p className="text-xs text-muted-foreground">
            Week {photo.week} · {formatClinicDate(photo.createdAt, { month: 'short', day: 'numeric' })}
          </p>

          {photo.caption && <p className="line-clamp-2 break-words text-sm">{photo.caption}</p>}

          <SnapshotHealthMetrics health={photo.healthSnapshot} variant="compact" />
        </div>
      </article>

      {!onOpen && (
        <SnapshotViewer
          photo={photo}
          patientUid={patientUid}
          patientName={patientName}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
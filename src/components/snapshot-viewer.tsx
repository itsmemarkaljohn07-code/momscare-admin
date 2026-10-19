'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DoctorCommentThread } from '@/components/doctor-comment-thread';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { formatClinicDateTime } from '@/lib/pregnancy-display';
import type { AdminSnapshotPhoto } from '@/lib/get-user-snapshots';

export const SNAPSHOT_TYPE_LABELS: Record<string, string> = {
  bump: 'Bump',
  ultrasound: 'Ultrasound',
  milestone: 'Milestone',
};

const MOOD_NAMES = ['Low', 'Okay', 'Good', 'Great', 'Amazing'];
const MOOD_MOUTH_PATHS = [
  'M6 11.5 Q9 8.5 12 11.5',
  'M6.5 11.3 Q9 10.3 11.5 11.3',
  'M6.5 11 Q9 11.8 11.5 11',
  'M6 11 Q9 13.2 12 11',
  'M5.5 10.5 Q9 14.5 12.5 10.5',
];

function WeightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 2.5v3M5.5 5.5h7M9 5.5L5.5 12a3.5 3.5 0 007 0L9 5.5Z" stroke="var(--accent-purple)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M1.5 9.5h3l1.5-4 2.5 8 2-6 1.2 2h5.3" stroke="var(--accent-pink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KicksIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <ellipse cx="9" cy="11" rx="3.2" ry="4.3" stroke="var(--accent-mint)" strokeWidth="1.4" />
      <circle cx="6.3" cy="4.3" r="1" stroke="var(--accent-mint)" strokeWidth="1.3" />
      <circle cx="10.9" cy="3.5" r="0.9" stroke="var(--accent-mint)" strokeWidth="1.3" />
    </svg>
  );
}

function MoodIcon({ mood }: { mood: number }) {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="var(--primary)" strokeWidth="1.4" />
      <circle cx="6.5" cy="7.5" r="0.9" fill="var(--primary)" />
      <circle cx="11.5" cy="7.5" r="0.9" fill="var(--primary)" />
      <path d={MOOD_MOUTH_PATHS[mood] ?? MOOD_MOUTH_PATHS[2]} stroke="var(--primary)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

type Health = NonNullable<AdminSnapshotPhoto['healthSnapshot']>;

function metricItems(h: Health) {
  const mood = MOOD_NAMES[h.mood] ?? '—';
  return [
    { key: 'weight', label: 'Weight', short: `${h.weight} kg`, icon: <WeightIcon /> },
    { key: 'bp', label: 'Blood pressure', short: `${h.bpSys}/${h.bpDia}`, icon: <PulseIcon /> },
    { key: 'kicks', label: 'Kicks', short: `${h.kicks} kicks`, full: `${h.kicks}`, icon: <KicksIcon /> },
    { key: 'mood', label: 'Mood', short: mood, icon: <MoodIcon mood={h.mood} /> },
  ];
}

export function SnapshotHealthMetrics({
  health,
  variant = 'compact',
}: {
  health?: AdminSnapshotPhoto['healthSnapshot'];
  variant?: 'compact' | 'full';
}) {
  if (!health) {
    return (
      <p className="text-xs text-muted-foreground">
        {variant === 'full' ? 'No health data was recorded with this photo.' : 'No health data'}
      </p>
    );
  }

  const items = metricItems(health);

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((m) => (
          <span key={m.key} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {m.icon}
            {m.short}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((m) => (
        <div key={m.key} className="rounded-xl border bg-muted/40 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {m.icon}
            {m.label}
          </p>
          <p className="text-sm font-semibold">{m.full ?? m.short}</p>
        </div>
      ))}
    </div>
  );
}

export function SnapshotViewer({
  photo,
  patientUid,
  patientName,
  open,
  onOpenChange,
  position,
  onPrev,
  onNext,
  readOnly = false,
}: {
  photo: AdminSnapshotPhoto | null;
  patientUid: string;
  patientName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown as "3 / 12" when the viewer is stepping through a list. */
  position?: { index: number; total: number };
  /** Provide these to enable previous/next. Leave undefined at the ends. */
  onPrev?: () => void;
  onNext?: () => void;
  /** View only (admins): no comment thread or form, and the patient name
   *  doesn't link to the doctor page. Default false (doctor pages). */
  readOnly?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // Never hijack the arrow keys while someone is typing a comment.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onPrev, onNext]);

  if (!photo) return null;

  const avatar = getAvatarStyle(patientUid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <div className="grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="relative flex min-h-[220px] items-center justify-center bg-black/90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.imageUrl}
              alt="Patient snapshot"
              className="max-h-[50vh] w-full object-contain md:max-h-[80vh]"
            />
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
            {position && position.total > 1 && (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white">
                {position.index + 1} / {position.total}
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-4 p-5">
            <DialogHeader>
              <DialogTitle className="pr-8">
                {patientName && readOnly ? (
                  <span className="truncate">{patientName}</span>
                ) : patientName ? (
                  <Link
                    href={`/doctor/${patientUid}`}
                    className="inline-flex min-w-0 items-center gap-2 hover:underline"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatar.bg} ${avatar.text}`}
                    >
                      {getInitials(patientName)}
                    </span>
                    <span className="truncate">{patientName}</span>
                  </Link>
                ) : (
                  'Snapshot'
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                {SNAPSHOT_TYPE_LABELS[photo.type] ?? photo.type}
              </span>
              <span className="text-muted-foreground">Week {photo.week}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{formatClinicDateTime(photo.createdAt)}</span>
            </div>

            {photo.caption && (
              <p className="whitespace-pre-wrap break-words text-sm">{photo.caption}</p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Health data at upload
              </p>
              <SnapshotHealthMetrics health={photo.healthSnapshot} variant="full" />
            </div>

            {readOnly ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                View only. Comments on Snapshots are between the patient and her doctor.
              </p>
            ) : (
              <DoctorCommentThread key={photo.id} patientUid={patientUid} photoId={photo.id} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
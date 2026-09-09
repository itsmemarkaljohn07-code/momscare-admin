import { Card, CardContent } from '@/components/ui/card';
import type { AdminSnapshotPhoto } from '@/lib/get-user-snapshots';

const TYPE_LABELS: Record<string, string> = {
  bump: 'Bump',
  ultrasound: 'Ultrasound',
  milestone: 'Milestone',
};

// Same minimalist icon language and mood-mouth curves already used
// throughout the mobile app's Health Tracker and this dashboard's
// other pages — kept visually identical for consistency.
const MOOD_NAMES = ['Low', 'Okay', 'Good', 'Great', 'Amazing'];
const MOOD_MOUTH_PATHS = [
  'M6 11.5 Q9 8.5 12 11.5',
  'M6.5 11.3 Q9 10.3 11.5 11.3',
  'M6.5 11 Q9 11.8 11.5 11',
  'M6 11 Q9 13.2 12 11',
  'M5.5 10.5 Q9 14.5 12.5 10.5',
];

export function AdminSnapshotCard({ photo }: { photo: AdminSnapshotPhoto }) {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square w-full bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt="Patient snapshot" className="h-full w-full object-cover" />
      </div>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
            {TYPE_LABELS[photo.type] ?? photo.type}
          </span>
          <span className="text-muted-foreground">Week {photo.week}</span>
        </div>

        {photo.caption && <p className="text-sm">{photo.caption}</p>}

        {photo.healthSnapshot ? (
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M9 2.5v3M5.5 5.5h7M9 5.5L5.5 12a3.5 3.5 0 007 0L9 5.5Z"
                      stroke="#b57fd4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{photo.healthSnapshot.weight}kg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M1.5 9.5h3l1.5-4 2.5 8 2-6 1.2 2h5.3"
                      stroke="#e07eb8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{photo.healthSnapshot.bpSys}/{photo.healthSnapshot.bpDia}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <ellipse cx="9" cy="11" rx="3.2" ry="4.3" stroke="#6dbfbf" strokeWidth="1.4"/>
                <circle cx="6.3" cy="4.3" r="1" stroke="#6dbfbf" strokeWidth="1.3"/>
                <circle cx="10.9" cy="3.5" r="0.9" stroke="#6dbfbf" strokeWidth="1.3"/>
              </svg>
              <span>{photo.healthSnapshot.kicks} kicks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#d9609a" strokeWidth="1.4"/>
                <circle cx="6.5" cy="7.5" r="0.9" fill="#d9609a"/>
                <circle cx="11.5" cy="7.5" r="0.9" fill="#d9609a"/>
                <path d={MOOD_MOUTH_PATHS[photo.healthSnapshot.mood]} stroke="#d9609a" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
              </svg>
              <span>{MOOD_NAMES[photo.healthSnapshot.mood]}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No health data recorded for this photo</p>
        )}
      </CardContent>
    </Card>
  );
}
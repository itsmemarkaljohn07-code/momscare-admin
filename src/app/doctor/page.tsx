import Link from 'next/link';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorPatients } from '@/lib/get-doctor-patients';
import { getDoctorRecentSnapshots } from '@/lib/get-doctor-recent-snapshots';
import { PageHeader } from '@/components/page-header';
import { DoctorOverviewStats, DoctorUpcomingCard } from '@/components/doctor-overview-live';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, ChevronRight } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = { bump: 'Bump', ultrasound: 'Ultrasound', milestone: 'Milestone' };

function formatDate(dateIso: string | null): string {
  if (!dateIso) return '';
  return new Date(dateIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function DoctorOverviewPage() {
  const session = await getDoctorSession();
  if (!session) return null;

  // Appointment numbers and lists come from the layout's live list.
  const [patients, recentSnapshots] = await Promise.all([
    getDoctorPatients(session.doctorName),
    getDoctorRecentSnapshots(session.doctorName, 6),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description={`Welcome back, ${session.doctorName}`} />

      <DoctorOverviewStats patients={patients.length} snapshots={recentSnapshots.length} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Snapshots</CardTitle>
            <Link href="/doctor/snapshots" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -my-2 -mr-2">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentSnapshots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <Camera className="h-6 w-6" aria-hidden="true" />
                No snapshots uploaded yet.
              </div>
            ) : (
              <div className="space-y-1">
                {recentSnapshots.map((s) => (
                  <Link
                    key={s.photoId}
                    href={`/doctor/${s.patientUid}`}
                    className="flex min-h-11 items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt="Snapshot" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={s.patientName}>{s.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[s.type] ?? s.type} · Week {s.week} · {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <DoctorUpcomingCard />
      </div>
    </div>
  );
}
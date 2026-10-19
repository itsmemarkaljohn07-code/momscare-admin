import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserSnapshots } from '@/lib/get-user-snapshots';
import { PatientViewLive } from '@/components/patient-view-live';
import { ClinicalNotesPanel } from '@/components/clinical-notes-panel';
import { AdminPatientSnapshots } from '@/components/admin-patient-snapshots';
import { ChevronLeft } from 'lucide-react';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  // The patient and her Snapshots, read on the server (Admin SDK): the
  // rules let only the patient read her own snapshots from a browser.
  const { patient: user, groups, totalPhotos } = await getUserSnapshots(uid);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Patients
      </Link>

      {/* lg and up: Snapshots left, information right. Below lg: the
          information first, then the Snapshots. One page scroll. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="order-2 min-w-0 space-y-4 lg:order-1" aria-labelledby="patient-snapshots">
          <div className="flex items-baseline justify-between gap-3 border-b pb-3">
            <h2 id="patient-snapshots" className="text-lg font-semibold">Snapshots</h2>
            <p className="text-sm text-muted-foreground">
              {totalPhotos} photo{totalPhotos === 1 ? '' : 's'} · view only
            </p>
          </div>
          <AdminPatientSnapshots groups={groups} patientUid={uid} patientName={user.fullName} />
        </section>

        <div className="order-1 min-w-0 space-y-5 lg:order-2">
          <PatientViewLive initial={user} />
          <ClinicalNotesPanel patientUid={uid} viewerRole="admin" />
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserSnapshots } from '@/lib/get-user-snapshots';
import { PatientViewLive } from '@/components/patient-view-live';
import { ClinicalNotesPanel } from '@/components/clinical-notes-panel';
import { AdminPatientSnapshots } from '@/components/admin-patient-snapshots';
import { PatientReportDownload } from '@/components/patient-report-download';
import { PatientStaysCard } from '@/components/patient-stays-card';
import { AdminClinicReadingsCard } from '@/components/admin-clinic-readings-card';
import { getClinicReadings } from '@/lib/get-clinic-readings';
import { latestPatientReported } from '@/lib/patient-reported';
import { ChevronLeft } from 'lucide-react';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  // The patient and her Snapshots, read on the server (Admin SDK): the
  // rules let only the patient read her own snapshots from a browser.
  const [{ patient: user, groups, totalPhotos }, readings] = await Promise.all([getUserSnapshots(uid), getClinicReadings(uid)]);

  if (!user) {
    notFound();
  }
  // Her own latest weight and blood pressure, kept apart from the clinic values.
  const reported = latestPatientReported(groups.flatMap((g) => g.items));

  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Patients
      </Link>

      {/* lg and up: Snapshots, Birth stays and Patient report left; the
          information and Clinical notes right. Below lg the two columns
          dissolve (display: contents) into one list in this order:
          information, Snapshots, Birth stays, Patient report, Clinical
          notes. One page scroll. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:block lg:min-w-0 lg:space-y-5">
          {/* Clinic readings (view only) come first, before the Snapshots,
              as on the doctor page; on phones right after the information. */}
          <div className="order-2 min-w-0">
            <AdminClinicReadingsCard rows={'rows' in readings ? readings.rows : null} reported={reported} />
          </div>
          <section className="order-2 min-w-0 space-y-4" aria-labelledby="patient-snapshots">
            <div className="flex items-baseline justify-between gap-3 border-b pb-3">
              <h2 id="patient-snapshots" className="text-lg font-semibold">Snapshots</h2>
              <p className="text-sm text-muted-foreground">
                {totalPhotos} photo{totalPhotos === 1 ? '' : 's'} · view only
              </p>
            </div>
            <AdminPatientSnapshots groups={groups} patientUid={uid} patientName={user.fullName} />
          </section>
          <div className="order-3 min-w-0">
            <PatientStaysCard uid={uid} patientName={user.fullName} />
          </div>
          <div className="order-4 min-w-0">
            <PatientReportDownload patientUid={uid} />
          </div>
        </div>

        <div className="contents lg:block lg:min-w-0 lg:space-y-5">
          <div className="order-1 min-w-0">
            <PatientViewLive initial={user} />
          </div>
          <div className="order-5 min-w-0">
            <ClinicalNotesPanel patientUid={uid} viewerRole="admin" />
          </div>
        </div>
      </div>
    </div>
  );
}

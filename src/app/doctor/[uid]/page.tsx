import { notFound } from 'next/navigation';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getUserSnapshots } from '@/lib/get-user-snapshots';
import { DoctorSnapshotCard } from '@/components/doctor-snapshot-card';
import { ClinicReadingsCard } from '@/components/clinic-readings-card';
import { latestPatientReported } from '@/lib/patient-reported';
import { ClinicalNotesPanel } from '@/components/clinical-notes-panel';
import { PatientReportDownload } from '@/components/patient-report-download';
import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { Camera, ChevronLeft } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

export default async function DoctorPatientSnapshotsPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const session = await getDoctorSession();
  const { uid } = await params;
  const { patient, groups, totalPhotos } = await getUserSnapshots(uid);

  if (!patient || !session) {
    notFound();
  }

  // Server-side security check — a doctor can only view patients
  // actually assigned to them, verified against the same
  // assignedDoctorNames array the appointment system maintains.
  if (!patient.assignedDoctorNames.includes(session.doctorName)) {
    notFound();
  }

  // The latest weight and blood pressure the patient logged with a
  // Snapshot (photos come newest first), from the data fetched above.
  const reported = latestPatientReported(groups.flatMap((g) => g.items));

  return (
    <div className="space-y-6">
      <Link
        href="/doctor/patients"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to My Patients
      </Link>

      <PageHeader
        title={patient.fullName}
        description={`${totalPhotos} photo${totalPhotos === 1 ? '' : 's'} uploaded. Health readings, clinical notes and Snapshots with comments.`}
      />

      <ClinicReadingsCard patientUid={uid} patientName={patient.fullName} reported={reported} />

      <PatientReportDownload patientUid={uid} />

      <ClinicalNotesPanel
        patientUid={uid}
        viewerRole="doctor"
        currentDoctorUid={session.uid}
      />

      {groups.length === 0 && (
        <EmptyState icon={Camera} title="No photos yet" description="Photos this patient uploads in the app will appear here." />
      )}

      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {group.label}
              <span className="ml-1.5 font-normal opacity-70">· {group.items.length}</span>
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {group.items.map((photo) => (
              <DoctorSnapshotCard key={photo.id} photo={photo} patientUid={uid} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
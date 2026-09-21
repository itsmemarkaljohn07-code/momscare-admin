import { notFound } from 'next/navigation';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getUserSnapshots } from '@/lib/get-user-snapshots';
import { DoctorSnapshotCard } from '@/components/doctor-snapshot-card';
import { PatientHealthTrends } from '@/components/patient-health-trends';
import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

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

  // Same data already fetched above for the day-grouped photo grid —
  // flattened back into one chronological list for the trend charts,
  // no additional Firestore read.
  const allPhotos = groups.flatMap((g) => g.items);

  return (
    <div className="space-y-6">
      <Link
        href="/doctor"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to My Patients
      </Link>

      <PageHeader
        title={patient.fullName}
        description={`${totalPhotos} photo${totalPhotos === 1 ? '' : 's'} uploaded`}
      />

      <PatientHealthTrends photos={allPhotos} />

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
      )}

      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {group.label}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.items.map((photo) => (
              <DoctorSnapshotCard key={photo.id} photo={photo} patientUid={uid} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
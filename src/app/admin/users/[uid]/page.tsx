import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserById } from '@/lib/get-users';
import { PatientViewLive } from '@/components/patient-view-live';
import { ClinicalNotesPanel } from '@/components/clinical-notes-panel';
import { ChevronLeft } from 'lucide-react';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const user = await getUserById(uid);

  if (!user) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-5">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Patients
      </Link>

      <PatientViewLive initial={user} />

      <ClinicalNotesPanel patientUid={uid} viewerRole="admin" />
    </div>
  );
}
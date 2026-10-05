import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorAllSnapshots } from '@/lib/get-doctor-all-snapshots';
import { DoctorSnapshotsBrowser } from '@/components/doctor-snapshots-browser';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Camera } from 'lucide-react';

export default async function DoctorSnapshotsPage() {
  const session = await getDoctorSession();
  const groups = session ? await getDoctorAllSnapshots(session.doctorName) : [];
  const totalPhotos = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Snapshots"
        description={`${totalPhotos} photo${totalPhotos === 1 ? '' : 's'} from your patients`}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No snapshots yet"
          description="Photos your patients upload will appear here."
        />
      ) : (
        <DoctorSnapshotsBrowser groups={groups} />
      )}
    </div>
  );
}
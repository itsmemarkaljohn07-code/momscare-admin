import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorAllSnapshots } from '@/lib/get-doctor-all-snapshots';
import { DoctorSnapshotCard } from '@/components/doctor-snapshot-card';
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
        groups.map((group) => (
          <div key={group.dateKey} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((photo) => (
                <DoctorSnapshotCard
                  key={photo.id}
                  photo={photo}
                  patientUid={photo.patientUid}
                  patientName={photo.patientName}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
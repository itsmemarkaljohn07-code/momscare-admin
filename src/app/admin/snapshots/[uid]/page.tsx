import { notFound } from 'next/navigation';
import { getUserSnapshots } from '@/lib/get-user-snapshots';
import { AdminSnapshotCard } from '@/components/admin-snapshot-card';
import { PageHeader } from '@/components/page-header';

export default async function PatientSnapshotsPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const { patient, groups, totalPhotos } = await getUserSnapshots(uid);

  if (!patient) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={patient.fullName}
        description={`${totalPhotos} photo${totalPhotos === 1 ? '' : 's'} uploaded`}
      />

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
      )}

      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold">{group.label}</p>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.items.map((photo) => (
              <AdminSnapshotCard key={photo.id} photo={photo} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
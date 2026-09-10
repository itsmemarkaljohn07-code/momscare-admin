import Link from 'next/link';
import { getSnapshotUsers } from '@/lib/get-snapshot-users';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Users as UsersIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

export default async function SnapshotsListPage() {
  const patients = await getSnapshotUsers();
  const totalPhotos = patients.reduce((sum, p) => sum + p.photoCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Snapshot Monitoring"
        description="Patient-uploaded pregnancy progress photos"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Patients with Photos" value={patients.length} icon={UsersIcon} color="pink" />
        <StatCard label="Total Photos" value={totalPhotos} icon={Camera} color="purple" />
      </div>

        {patients.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No Snapshot photos yet"
          description="Patients haven't uploaded any pregnancy photos."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <Link key={p.uid} href={`/admin/snapshots/${p.uid}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{p.fullName}</p>
                    <Badge variant="secondary">{p.photoCount} photos</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Last upload:{' '}
                    {p.lastUploadAt ? new Date(p.lastUploadAt).toLocaleDateString() : '—'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
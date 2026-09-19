import Link from 'next/link';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorPatients } from '@/lib/get-doctor-patients';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

export default async function DoctorPatientsPage() {
  const session = await getDoctorSession();
  const patients = session ? await getDoctorPatients(session.doctorName) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Patients"
        description={`${patients.length} patient${patients.length === 1 ? '' : 's'} assigned to you`}
      />

      {patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No patients yet"
          description="Patients appear here once they have an appointment booked with you."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <Link key={p.uid} href={`/doctor/${p.uid}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{p.fullName}</p>
                    <Badge variant="secondary">{p.photoCount} photos</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                  <p className="text-xs text-muted-foreground">Due: {p.dueDate ?? '—'}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
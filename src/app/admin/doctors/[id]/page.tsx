import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDoctorById } from '@/lib/get-doctors';
import { DoctorViewLive } from '@/components/doctor-view-live';
import { ChevronLeft } from 'lucide-react';

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doctor = await getDoctorById(id);

  if (!doctor) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-5">
      <Link
        href="/admin/doctors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Doctors
      </Link>

      <DoctorViewLive initial={doctor} />
    </div>
  );
}
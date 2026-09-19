import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminById } from '@/lib/get-admins';
import { AdminViewLive } from '@/components/admin-view-live';
import { ChevronLeft } from 'lucide-react';

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const admin = await getAdminById(uid);

  if (!admin) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-5">
      <Link
        href="/admin/admins"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Admins
      </Link>

      <AdminViewLive initial={admin} />
    </div>
  );
}
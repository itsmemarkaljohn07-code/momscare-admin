import { ListSkeleton } from '@/components/list-skeleton';

export default function DoctorProfileLoading() {
  return (
    <div className="max-w-2xl">
      <ListSkeleton rows={3} toolbar={false} />
    </div>
  );
}

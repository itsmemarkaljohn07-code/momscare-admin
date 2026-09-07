import { Skeleton } from '@/components/ui/skeleton';

export default function UserDetailLoading() {
  return (
    <div className="max-w-xl space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
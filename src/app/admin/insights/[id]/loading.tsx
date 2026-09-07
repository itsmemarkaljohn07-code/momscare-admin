import { Skeleton } from '@/components/ui/skeleton';

export default function InsightDetailLoading() {
  return (
    <div className="max-w-3xl space-y-4">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
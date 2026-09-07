import { Skeleton } from '@/components/ui/skeleton';

export function LoadingTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="space-y-3 rounded-md border p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
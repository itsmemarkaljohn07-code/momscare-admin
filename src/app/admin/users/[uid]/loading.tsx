import { Skeleton } from '@/components/ui/skeleton';

export default function UserDetailLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-5 w-36" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="order-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:order-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
          ))}
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <Skeleton className="h-14 w-64 max-w-full" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

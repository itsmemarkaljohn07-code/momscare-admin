import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading placeholder for a page: heading, optional toolbar, then rows
 * (a table/list) or cards (a grid). Announced as busy to screen readers.
 */
export function ListSkeleton({
  rows = 6,
  variant = 'rows',
  toolbar = true,
}: {
  rows?: number;
  variant?: 'rows' | 'cards';
  toolbar?: boolean;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2 border-b pb-5">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {toolbar && <Skeleton className="h-10 w-full max-w-sm rounded-full" />}
      {variant === 'rows' ? (
        <div className="space-y-3 rounded-2xl border p-4">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  );
}

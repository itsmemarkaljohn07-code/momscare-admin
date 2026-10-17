'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** "Load more" under a growing list. Renders nothing once everything is
 *  shown; shows a spinner and blocks repeat clicks while loading. */
export function LoadMoreButton({
  hasMore,
  loading = false,
  onClick,
  shown,
  total,
}: {
  hasMore: boolean;
  loading?: boolean;
  onClick: () => void;
  /** Optional "Showing X of Y" line (lists whose total is known). */
  shown?: number;
  total?: number;
}) {
  if (!hasMore) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 pt-1">
      <Button
        type="button"
        variant="outline"
        className="rounded-full px-5"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading…
          </>
        ) : (
          'Load more'
        )}
      </Button>
      {shown !== undefined && total !== undefined && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing {shown} of {total}
        </p>
      )}
    </div>
  );
}

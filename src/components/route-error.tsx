'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, WifiOff, ShieldAlert, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFriendlyError } from '@/lib/error-messages';

// A distinct icon for the two situations a person is most likely to
// actually hit in the field (their own connection, or a permissions
// mistake) — everything else shares the generic warning icon rather
// than trying to have a bespoke icon per error code. Returns a plain
// string, not a component reference, so nothing gets constructed
// during render.
function iconKindFor(title: string): 'connection' | 'permission' | 'generic' {
  if (/connection|internet/i.test(title)) return 'connection';
  if (/permission/i.test(title)) return 'permission';
  return 'generic';
}

export function RouteError({
  error,
  reset,
  title,
  description,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Optional context on top of the classified message — e.g. "We
   *  couldn't load your patients." Omit to show the classified
   *  title/description as-is. */
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // The raw error always reaches the console/dev tools for
    // debugging — it just never reaches the screen.
    console.error(error);
  }, [error]);

  const classified = getFriendlyError(error, 'route error boundary');
  const iconKind = iconKindFor(classified.title);

  function retry() {
    // reset() alone would re-render the same failed server result;
    // refresh() makes the server fetch the data again first.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending)' }}
      >
        {iconKind === 'connection' && <WifiOff className="h-5 w-5" />}
        {iconKind === 'permission' && <ShieldAlert className="h-5 w-5" />}
        {iconKind === 'generic' && <AlertTriangle className="h-5 w-5" />}
      </span>
      <div className="space-y-1">
        <p className="font-semibold">{title ?? classified.title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description ?? classified.description}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="gap-1.5 rounded-full"
        onClick={retry}
        disabled={isPending}
      >
        <RotateCcw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Retrying…' : 'Try again'}
      </Button>
    </div>
  );
}
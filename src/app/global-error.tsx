'use client';

// This is the ONE boundary that also has to replace the root layout
// itself, since a crash here means even the sidebar/header couldn't
// render — so it renders its own minimal <html>/<body> rather than
// relying on layout.tsx, which is exactly what a global-error.tsx
// is for in Next.js.
import { RouteError } from '@/components/route-error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <RouteError error={error} reset={reset} />
        </div>
      </body>
    </html>
  );
}
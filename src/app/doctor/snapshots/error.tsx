'use client';

import { RouteError } from '@/components/route-error';

export default function PatientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} title="We couldn't load your patients" />;
}
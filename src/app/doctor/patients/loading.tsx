export default function PatientsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-10 w-full max-w-sm animate-pulse rounded-full bg-muted" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-muted/70" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
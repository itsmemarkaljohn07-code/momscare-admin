'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium md:min-h-9 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--action-ring)] ${
        active
          ? 'border-[var(--action)] bg-[var(--action-soft)] text-[var(--action-soft-foreground)]'
          : 'border-input text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      {children}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 text-[11px] font-semibold ${
            active ? 'bg-background/70' : 'bg-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Read by screen readers; the visible text is the selected option. */
  label: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-full md:h-9 border border-input bg-background pl-3.5 pr-9 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring dark:[color-scheme:dark]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </label>
  );
}
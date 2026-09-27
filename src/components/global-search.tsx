'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Users, Stethoscope, ShieldCheck, CalendarDays, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { SearchItem, SearchItemType } from '@/lib/build-search-index';

const TYPE_ICON: Record<SearchItemType, typeof Users> = {
  patient: Users,
  doctor: Stethoscope,
  admin: ShieldCheck,
  appointment: CalendarDays,
};

const TYPE_LABEL: Record<SearchItemType, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  admin: 'Admin',
  appointment: 'Appointment',
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchItem[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function ensureIndexLoaded() {
    if (index !== null) return;
    try {
      const res = await fetch('/api/admin/search-index');
      if (res.ok) {
        const data = await res.json();
        setIndex(data.items);
      }
    } catch {
      // Silent by design — a failed background index fetch just means
      // search returns nothing yet; not worth interrupting with a
      // toast for what's a quiet, optional convenience feature.
    }
  }

  const q = query.trim().toLowerCase();
  const results = q && index
    ? index
        .filter((i) => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q))
        .slice(0, 8)
    : [];

  function goToFullResults() {
    if (!query.trim()) return;
    router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onFocus={() => {
            setIsOpen(true);
            ensureIndexLoaded();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') goToFullResults();
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder="Search patients, doctors, appointments..."
          className="rounded-full pl-8"
        />
      </div>

      {isOpen && q && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-md border bg-popover shadow-md">
          {index === null ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No results for &quot;{query}&quot;.</p>
          ) : (
            <>
              {results.map((r) => {
                const Icon = TYPE_ICON[r.type];
                return (
                  <Link
                    key={`${r.type}-${r.id}`}
                    href={r.url}
                    className="flex items-center gap-2.5 border-b p-2.5 text-sm last:border-b-0 hover:bg-muted/50"
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {TYPE_LABEL[r.type]} · {r.subtitle}
                      </p>
                    </div>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={goToFullResults}
                className="w-full p-2.5 text-center text-sm font-medium text-primary hover:bg-muted/50"
              >
                See all results for &quot;{query}&quot;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clock3, Layers, Newspaper, Pencil, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { formatRelativeTime } from '@/lib/format-relative-time';

export interface InsightListItem {
  id: string;
  title: string;
  excerpt: string;
  heroTag: string;
  readTime: number;
  tabCount: number;
  sections: string[];
  accentColor: string;
  updatedAt: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  popular: 'Popular',
  body: 'Your body',
  baby: 'Baby',
  nutrition: 'Nutrition',
  mind: 'Mind & mood',
  birth: 'Birth',
};

/** Searchable, filterable list of Insights articles. Every saved article
 *  is live in the app (there is no draft state), so each row shows when it
 *  was last updated instead of a publish status. */
export function InsightsList({ articles, sections }: { articles: InsightListItem[]; sections: readonly string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (section !== 'all' && !a.sections.includes(section)) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.heroTag.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q)
      );
    });
  }, [articles, query, section]);

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No articles yet"
        description="Create the first Insights article. It appears in the mobile app as soon as it is published."
      />
    );
  }

  const filters = ['all', ...sections];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search articles"
            placeholder="Search by title, tag or summary…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-full pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by app section">
          {filters.map((s) => {
            const active = section === s;
            const count = s === 'all' ? articles.length : articles.filter((a) => a.sections.includes(s)).length;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => setSection(s)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--action-ring)] ${
                  active
                    ? 'border-[var(--action)] bg-[var(--action-soft)] text-[var(--action-soft-foreground)]'
                    : 'border-input text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'All' : SECTION_LABELS[s] ?? s}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching articles"
          description="Try a different search, or clear the section filter."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
          {filtered.map((a) => (
            <li key={a.id}>
              <div
                className="group flex cursor-pointer items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5"
                onClick={() => router.push(`/admin/insights/${a.id}`)}
              >
                <span
                  className="mt-1.5 h-9 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.accentColor }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/admin/insights/${a.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 break-words font-semibold leading-snug outline-none hover:underline focus-visible:underline"
                    >
                      {a.title}
                    </Link>
                    {a.heroTag && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{a.heroTag}</span>
                    )}
                  </div>
                  {a.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{a.readTime} min read</span>
                    <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{a.tabCount} {a.tabCount === 1 ? 'section' : 'sections'}</span>
                    {a.updatedAt && <span>Updated {formatRelativeTime(a.updatedAt)}</span>}
                    {a.sections.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {a.sections.map((s) => (
                          <span key={s} className="rounded-full border px-2 py-0.5">{SECTION_LABELS[s] ?? s}</span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-8 gap-1.5 sm:inline-flex"
                    nativeButton={false}
                    render={<Link href={`/admin/insights/${a.id}`} onClick={(e) => e.stopPropagation()} />}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:hidden" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

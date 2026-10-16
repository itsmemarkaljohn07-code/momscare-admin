import Link from 'next/link';
import { Plus, Newspaper, Clock3, Layers } from 'lucide-react';
import { getInsights } from '@/lib/get-insights';
import { INSIGHT_SECTIONS } from '@/lib/insight-icons';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { InsightsList, type InsightListItem } from '@/components/insights-list';

export default async function InsightsListPage() {
  const articles = await getInsights();

  const avgReadTime = articles.length
    ? Math.round(articles.reduce((sum, a) => sum + (a.readTime ?? 0), 0) / articles.length)
    : 0;

  const sectionsCovered = new Set(articles.flatMap((a) => a.sections ?? [])).size;

  // Plain, serialisable rows for the client list (Timestamps can't cross).
  const items: InsightListItem[] = articles.map((a) => ({
    id: a.id,
    title: a.title ?? '(untitled)',
    excerpt: a.excerpt,
    heroTag: a.heroTag ?? '',
    readTime: a.readTime ?? 0,
    tabCount: a.tabs.length,
    sections: a.sections,
    accentColor: a.accentColor,
    updatedAt: a.updatedAt?.toDate().toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description={`${articles.length} ${articles.length === 1 ? 'article' : 'articles'} live in the MomCare app`}
        action={
          <Button className="h-10 gap-1.5 px-4" nativeButton={false} render={<Link href="/admin/insights/new" />}>
            <Plus className="h-4 w-4" />
            New article
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Articles" value={articles.length} icon={Newspaper} color="pink" />
        <StatCard label="Avg. Read Time" value={`${avgReadTime} min`} icon={Clock3} color="purple" />
        <StatCard label="Sections Covered" value={`${sectionsCovered}/${INSIGHT_SECTIONS.length}`} icon={Layers} color="mint" />
      </div>

      <InsightsList articles={items} sections={INSIGHT_SECTIONS} />
    </div>
  );
}

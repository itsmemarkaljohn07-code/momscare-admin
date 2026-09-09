import Link from 'next/link';
import { getInsights } from '@/lib/get-insights';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Newspaper, Clock3, Layers } from 'lucide-react';

export default async function InsightsListPage() {
  const articles = await getInsights();

  const avgReadTime = articles.length
    ? Math.round(articles.reduce((sum, a) => sum + (a.readTime ?? 0), 0) / articles.length)
    : 0;

  const sectionsCovered = new Set(articles.flatMap((a) => a.sections ?? [])).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights Articles"
        description={`${articles.length} articles — synced from Firestore`}
        action={
          <Button nativeButton={false} render={<Link href="/admin/insights/new" />}>
            + New Article
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Articles" value={articles.length} icon={Newspaper} color="pink" />
        <StatCard label="Avg. Read Time" value={`${avgReadTime} min`} icon={Clock3} color="purple" />
        <StatCard label="Sections Covered" value={`${sectionsCovered}/6`} icon={Layers} color="mint" />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Read Time</TableHead>
              <TableHead>Tabs</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: article.accentColor }}
                    />
                    {article.title}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {article.heroTag}
                  </span>
                </TableCell>
                <TableCell>{article.readTime} min</TableCell>
                <TableCell>{article.tabs.length}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {article.sections.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/insights/${article.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
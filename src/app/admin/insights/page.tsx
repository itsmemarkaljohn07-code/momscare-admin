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

export default async function InsightsListPage() {
  const articles = await getInsights();

  return (
    <div className="space-y-4">
            <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insights Articles</h1>
          <p className="text-sm text-muted-foreground">
            {articles.length} articles — synced from Firestore
          </p>
        </div>
                <Button render={<Link href="/admin/insights/new" />}>
          + New Article
        </Button>
      </div>

      <div className="rounded-md border">
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
                <TableCell className="font-medium">{article.title}</TableCell>
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
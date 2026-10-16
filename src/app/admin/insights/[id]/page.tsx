import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { adminDb } from '@/lib/firebase-admin';
import { InsightEditForm } from '@/components/insight-edit-form';
import { PageHeader } from '@/components/page-header';
import { getInsightTags } from '@/lib/get-insights';

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, tagSuggestions] = await Promise.all([
    adminDb.collection('insights').doc(id).get(),
    getInsightTags().catch(() => []),
  ]);

  if (!doc.exists) {
    notFound();
  }

  const data = doc.data()!;

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href="/admin/insights"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Insights
      </Link>
      <PageHeader title={data.title} description={`Editing article · insights/${id}`} />
      <InsightEditForm
        mode="edit"
        id={id}
        tagSuggestions={tagSuggestions}
        initialData={{
          title: data.title,
          heroTag: data.heroTag,
          readTime: data.readTime,
          youTubeUrl: data.youTubeUrl ?? '',
          citation: data.citation ?? { source: '', author: '', year: '', url: '' },
          tabs: data.tabs ?? [],
          panels: data.panels ?? {},
        }}
      />
    </div>
  );
}

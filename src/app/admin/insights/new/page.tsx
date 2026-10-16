import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { InsightEditForm } from '@/components/insight-edit-form';
import { PageHeader } from '@/components/page-header';
import { getInsightTags } from '@/lib/get-insights';

export default async function NewInsightPage() {
  const tagSuggestions = await getInsightTags().catch(() => []);

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href="/admin/insights"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Insights
      </Link>
      <PageHeader
        title="New article"
        description="Fill in the three steps below. The article goes live in the app when you publish."
      />
      <InsightEditForm
        mode="create"
        tagSuggestions={tagSuggestions}
        initialData={{
          title: '',
          heroTag: '',
          readTime: 3,
          youTubeUrl: '',
          citation: { source: '', author: '', year: '', url: '' },
          tabs: [],
          panels: {},
          accentColor: '#e07eb8',
          excerpt: '',
          sections: [],
        }}
      />
    </div>
  );
}

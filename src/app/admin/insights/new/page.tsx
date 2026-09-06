import { InsightEditForm } from '@/components/insight-edit-form';

export default function NewInsightPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New Article</h1>
        <p className="text-sm text-muted-foreground">Create a new Insights article</p>
      </div>
      <InsightEditForm
        mode="create"
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
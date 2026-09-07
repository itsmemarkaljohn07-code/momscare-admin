import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { InsightEditForm } from '@/components/insight-edit-form';
import { PageHeader } from '@/components/page-header';

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await adminDb.collection('insights').doc(id).get();

  if (!doc.exists) {
    notFound();
  }

  const data = doc.data()!;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={data.title} description={`Editing article: ${id}`} />
      <InsightEditForm
        mode="edit"
        id={id}
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
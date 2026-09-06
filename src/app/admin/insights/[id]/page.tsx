import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { InsightEditForm } from '@/components/insight-edit-form';

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
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <p className="text-sm text-muted-foreground">Editing article: {id}</p>
      </div>
      <InsightEditForm
        id={id}
        initialData={{
          title: data.title,
          heroTag: data.heroTag,
          readTime: data.readTime,
          youTubeUrl: data.youTubeUrl ?? '',
          citation: data.citation ?? { source: '', author: '', year: '', url: '' },
        }}
      />
    </div>
  );
}
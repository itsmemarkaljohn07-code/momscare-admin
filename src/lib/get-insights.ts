import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import type { Timestamp } from 'firebase-admin/firestore';

export interface InsightArticle {
  id: string;
  title: string;
  heroTag: string;
  readTime: number;
  sections: string[];
  tabs: { id: number; label: string }[];
  youTubeUrl: string;
  updatedAt?: Timestamp;
  accentColor: string;
}

export async function getInsights(): Promise<InsightArticle[]> {
  const snapshot = await withRetry(() => adminDb.collection('insights').orderBy('title').get());

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      heroTag: data.heroTag,
      readTime: data.readTime,
      sections: data.sections ?? [],
      tabs: data.tabs ?? [],
      youTubeUrl: data.youTubeUrl,
      updatedAt: data.updatedAt,
      accentColor: data.accentColor ?? '#e07eb8',
    };
  });
}
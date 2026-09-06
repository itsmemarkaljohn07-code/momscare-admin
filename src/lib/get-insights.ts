import { adminDb } from '@/lib/firebase-admin';

export interface InsightArticle {
  id: string;
  title: string;
  heroTag: string;
  readTime: number;
  sections: string[];
  tabs: { id: number; label: string }[];
  youTubeUrl: string;
  updatedAt?: any;
}

export async function getInsights(): Promise<InsightArticle[]> {
  const snapshot = await adminDb.collection('insights').orderBy('title').get();

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
    };
  });
}
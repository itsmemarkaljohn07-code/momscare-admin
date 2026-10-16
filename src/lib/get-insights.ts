import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import type { Timestamp } from 'firebase-admin/firestore';

export interface InsightArticle {
  id: string;
  title: string;
  excerpt: string;
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
      excerpt: data.excerpt ?? '',
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

/** The distinct tags already used by articles, for the editor's tag
 *  suggestions. Reads only the heroTag field. */
export async function getInsightTags(): Promise<string[]> {
  const snapshot = await withRetry(() => adminDb.collection('insights').select('heroTag').get());
  const tags = new Set<string>();
  for (const doc of snapshot.docs) {
    const tag = doc.data().heroTag;
    if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
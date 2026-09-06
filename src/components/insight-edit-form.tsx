'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InsightFormData {
  title: string;
  heroTag: string;
  readTime: number;
  youTubeUrl: string;
  citation: { source: string; author: string; year: string; url: string };
}

export function InsightEditForm({
  id,
  initialData,
}: {
  id: string;
  initialData: InsightFormData;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const res = await fetch(`/api/insights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Failed to save changes.');
        setIsSaving(false);
        return;
      }

      setMessage('Saved successfully.');
      router.refresh();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Article Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tag</label>
              <Input
                value={form.heroTag}
                onChange={(e) => setForm({ ...form, heroTag: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Read Time (min)</label>
              <Input
                type="number"
                value={form.readTime}
                onChange={(e) => setForm({ ...form, readTime: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">YouTube URL</label>
            <Input
              value={form.youTubeUrl}
              onChange={(e) => setForm({ ...form, youTubeUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Citation</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Source"
                value={form.citation.source}
                onChange={(e) =>
                  setForm({ ...form, citation: { ...form.citation, source: e.target.value } })
                }
              />
              <Input
                placeholder="Author"
                value={form.citation.author}
                onChange={(e) =>
                  setForm({ ...form, citation: { ...form.citation, author: e.target.value } })
                }
              />
              <Input
                placeholder="Year"
                value={form.citation.year}
                onChange={(e) =>
                  setForm({ ...form, citation: { ...form.citation, year: e.target.value } })
                }
              />
              <Input
                placeholder="URL"
                value={form.citation.url}
                onChange={(e) =>
                  setForm({ ...form, citation: { ...form.citation, url: e.target.value } })
                }
              />
            </div>
          </div>

          {message && <p className="text-sm">{message}</p>}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
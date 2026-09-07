'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INSIGHT_ICON_KEYS, INSIGHT_SECTIONS, deriveArticleColors } from '@/lib/insight-icons';

interface ArticleItem {
  label: string;
  desc: string;
  iconBg: string;
  svgKey: string;
}

interface ArticlePanel {
  tag: string;
  title: string;
  intro: string;
  highlight: { label: string; text: string };
  items: ArticleItem[];
  tip: { text: string; source: string };
}

interface TabDef {
  id: number;
  label: string;
}

interface InsightFormData {
  title: string;
  heroTag: string;
  readTime: number;
  youTubeUrl: string;
  citation: { source: string; author: string; year: string; url: string };
  tabs: TabDef[];
  panels: Record<string, ArticlePanel>;
  accentColor?: string;
  excerpt?: string;
  sections?: string[];
  heroImage?: string | null;
}

const BLANK_ITEM: ArticleItem = { label: '', desc: '', iconBg: '', svgKey: 'star' };
const BLANK_PANEL: ArticlePanel = {
  tag: '', title: '', intro: '',
  highlight: { label: '', text: '' },
  items: [],
  tip: { text: '', source: '' },
};

export function InsightEditForm({
  mode,
  id: initialId,
  initialData,
}: {
  mode: 'create' | 'edit';
  id?: string;
  initialData: InsightFormData;
}) {

  const router = useRouter();
  const [articleId, setArticleId] = useState(initialId ?? '');
   const [form, setForm] = useState<InsightFormData>({
    accentColor: '#e07eb8',
    excerpt: '',
    sections: [],
    heroImage: null,
    ...initialData,
  });
 
  const [activeTabId, setActiveTabId] = useState(form.tabs[0]?.id ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const activePanelKey = String(activeTabId);
  const activePanel = form.panels[activePanelKey];

  function updatePanel(patch: Partial<ArticlePanel>) {
    setForm({
      ...form,
      panels: { ...form.panels, [activePanelKey]: { ...activePanel, ...patch } },
    });
  }

  function updateItem(index: number, patch: Partial<ArticleItem>) {
    const items = activePanel.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    updatePanel({ items });
  }

  function addItem() {
    updatePanel({ items: [...activePanel.items, { ...BLANK_ITEM }] });
  }

  function removeItem(index: number) {
    updatePanel({ items: activePanel.items.filter((_, i) => i !== index) });
  }

  function addTab() {
    const nextId = form.tabs.length > 0 ? Math.max(...form.tabs.map((t) => t.id)) + 1 : 1;
    setForm({
      ...form,
      tabs: [...form.tabs, { id: nextId, label: `Tab ${nextId}` }],
      panels: { ...form.panels, [String(nextId)]: { ...BLANK_PANEL } },
    });
    setActiveTabId(nextId);
  }

  function removeTab(tabId: number) {
    const remainingPanels = { ...form.panels };
    delete remainingPanels[String(tabId)];
    const remainingTabs = form.tabs.filter((t) => t.id !== tabId);
    setForm({ ...form, tabs: remainingTabs, panels: remainingPanels });
    if (activeTabId === tabId) {
      setActiveTabId(remainingTabs[0]?.id ?? 0);
    }
  }

  function renameActiveTab(label: string) {
    setForm({
      ...form,
      tabs: form.tabs.map((t) => (t.id === activeTabId ? { ...t, label } : t)),
    });
  }

  function toggleSection(section: string, checked: boolean) {
    const current = form.sections ?? [];
    setForm({
      ...form,
      sections: checked ? [...current, section] : current.filter((s) => s !== section),
    });
  }

  function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

    async function handleDelete() {
    if (!initialId) return;
    if (
      !window.confirm(
        `Delete "${form.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const res = await fetch(`/api/insights/${initialId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Failed to delete article.');
        setIsSaving(false);
        return;
      }
      router.push('/admin/insights');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete article.');
      setIsSaving(false);
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      if (mode === 'create') {
        const cleanId = slugify(articleId);
        if (!cleanId) {
          setMessage('Please enter a valid article ID (letters and numbers only).');
          setIsSaving(false);
          return;
        }
        const colors = deriveArticleColors(form.accentColor ?? '#e07eb8');

        const res = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: cleanId,
            ...form,
            ...colors,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage(data.error || 'Failed to create article.');
          setIsSaving(false);
          return;
        }

        router.push(`/admin/insights/${cleanId}`);
        return;
      }

      const res = await fetch(`/api/insights/${initialId}`, {
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
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Article Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'create' && (
            
            <div className="space-y-1">
              <label className="text-sm font-medium">Article ID (URL-safe slug)</label>
              <Input
                value={articleId}
                onChange={(e) => setArticleId(e.target.value)}
                placeholder="e.g. newarticle"
                required
              />
              <p className="text-xs text-muted-foreground">
                Letters and numbers only, no spaces — this becomes the article&apos;s permanent key.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {mode === 'create' && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Excerpt (shown on card previews)</label>
                <Textarea
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                />
              </div>

                            <div className="space-y-1">
                <label className="text-sm font-medium">Hero Image Path</label>
                <Input
                  value={form.heroImage ?? ''}
                  onChange={(e) => setForm({ ...form, heroImage: e.target.value || null })}
                  placeholder="assets/icon/yourimage.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Must match a file already bundled in the mobile app under{' '}
                  <code>src/assets/icon/</code> — the app rebuilds and republishes before this
                  image will actually display.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Accent Color</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-9 w-14 p-1"
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                  />
                  <Input
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    placeholder="#e07eb8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The gradient and highlight tints are generated automatically from this color.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sections</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {INSIGHT_SECTIONS.map((section) => (
                    <label key={section} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.sections?.includes(section)}
                        onCheckedChange={(checked) => toggleSection(section, checked === true)}
                      />
                      {section}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                placeholder="Source"
                value={form.citation.source}
                onChange={(e) => setForm({ ...form, citation: { ...form.citation, source: e.target.value } })}
              />
              <Input
                placeholder="Author"
                value={form.citation.author}
                onChange={(e) => setForm({ ...form, citation: { ...form.citation, author: e.target.value } })}
              />
              <Input
                placeholder="Year"
                value={form.citation.year}
                onChange={(e) => setForm({ ...form, citation: { ...form.citation, year: e.target.value } })}
              />
              <Input
                placeholder="URL"
                value={form.citation.url}
                onChange={(e) => setForm({ ...form, citation: { ...form.citation, url: e.target.value } })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Panel Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {form.tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={tab.id === activeTabId ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addTab}>
              + Add Tab
            </Button>
          </div>

          {activePanel && (
            <>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex-1 space-y-1">
                  <label className="text-sm font-medium">Tab Label</label>
                  <Input
                    value={form.tabs.find((t) => t.id === activeTabId)?.label ?? ''}
                    onChange={(e) => renameActiveTab(e.target.value)}
                  />
                </div>
                {form.tabs.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-3"
                    onClick={() => removeTab(activeTabId)}
                  >
                    Remove Tab
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Panel Tag</label>
                  <Input value={activePanel.tag} onChange={(e) => updatePanel({ tag: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Panel Title</label>
                  <Input value={activePanel.title} onChange={(e) => updatePanel({ title: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Intro</label>
                <Textarea rows={3} value={activePanel.intro} onChange={(e) => updatePanel({ intro: e.target.value })} />
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Highlight</p>
                <Input
                  placeholder="Label (e.g. 'Did you know?')"
                  value={activePanel.highlight.label}
                  onChange={(e) => updatePanel({ highlight: { ...activePanel.highlight, label: e.target.value } })}
                />
                <Textarea
                  rows={2}
                  placeholder="Highlight text"
                  value={activePanel.highlight.text}
                  onChange={(e) => updatePanel({ highlight: { ...activePanel.highlight, text: e.target.value } })}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Items ({activePanel.items.length})</p>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    + Add Item
                  </Button>
                </div>

                {activePanel.items.map((item, index) => (
                  <div key={index} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                        Remove
                      </Button>
                    </div>
                    <Input
                      placeholder="Label"
                      value={item.label}
                      onChange={(e) => updateItem(index, { label: e.target.value })}
                    />
                    <Textarea
                      rows={2}
                      placeholder="Description"
                      value={item.desc}
                      onChange={(e) => updateItem(index, { desc: e.target.value })}
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Select value={item.svgKey} onValueChange={(value) => updateItem(index, { svgKey: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Icon" />
                        </SelectTrigger>
                        <SelectContent>
                          {INSIGHT_ICON_KEYS.map((key) => (
                            <SelectItem key={key} value={key}>
                              {key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="iconBg (e.g. rgba(224,126,184,0.12))"
                        value={item.iconBg}
                        onChange={(e) => updateItem(index, { iconBg: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Tip</p>
                <Textarea
                  rows={2}
                  placeholder="Tip text"
                  value={activePanel.tip.text}
                  onChange={(e) => updatePanel({ tip: { ...activePanel.tip, text: e.target.value } })}
                />
                <Input
                  placeholder="Source (e.g. MomsCare Health · Nutrition)"
                  value={activePanel.tip.source}
                  onChange={(e) => updatePanel({ tip: { ...activePanel.tip, source: e.target.value } })}
                />
              </div>
            </>
          )}

          {form.tabs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tabs yet — click &quot;+ Add Tab&quot; to create the article&apos;s first section.
            </p>
          )}
        </CardContent>
      </Card>

           {message && <p className="text-sm">{message}</p>}

      <div className="flex items-center justify-between">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : mode === 'create' ? 'Create Article' : 'Save Changes'}
        </Button>

        {mode === 'edit' && (
          <Button
            type="button"
            variant="destructive"
            disabled={isSaving}
            onClick={handleDelete}
          >
            Delete Article
          </Button>
        )}
      </div>
        </form>
  );
}
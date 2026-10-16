'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BookOpen, Check, ChevronDown, FileText, ImageIcon, Plus, Sparkles, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

type FieldKey =
  | 'articleId' | 'title' | 'heroTag' | 'readTime' | 'youTubeUrl' | 'citationUrl' | 'tabs';
type Errors = Partial<Record<FieldKey, string>>;

const TITLE_MAX = 90;
const EXCERPT_MAX = 200;
const READ_MIN = 1;
const READ_MAX = 60;
const WORDS_PER_MINUTE = 200;
const DEFAULT_ACCENT = '#e07eb8';

/** Readable names for the app sections an article can appear in. The
 *  stored values stay the existing keys. */
const SECTION_LABELS: Record<string, string> = {
  popular: 'Popular',
  body: 'Your body',
  baby: 'Baby',
  nutrition: 'Nutrition',
  mind: 'Mind & mood',
  birth: 'Birth',
};

/** Ready-made icon backgrounds, stored in the same rgba() format the
 *  articles already use. */
const ICON_BG_PRESETS = [
  { name: 'Rose', value: 'rgba(224,126,184,0.12)' },
  { name: 'Lavender', value: 'rgba(181,127,212,0.12)' },
  { name: 'Mint', value: 'rgba(79,168,148,0.12)' },
  { name: 'Amber', value: 'rgba(217,154,58,0.12)' },
  { name: 'Sky', value: 'rgba(91,141,239,0.12)' },
];

/** Field ids, in on-screen order, so the first error can be focused. */
const FIELD_ORDER: FieldKey[] = ['title', 'articleId', 'heroTag', 'readTime', 'tabs', 'youTubeUrl', 'citationUrl'];

const BLANK_ITEM: ArticleItem = { label: '', desc: '', iconBg: '', svgKey: 'star' };
const BLANK_PANEL: ArticlePanel = {
  tag: '', title: '', intro: '',
  highlight: { label: '', text: '' },
  items: [],
  tip: { text: '', source: '' },
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Rough reading time from every text field in the article's sections. */
function estimateReadTime(form: InsightFormData): number {
  let words = 0;
  for (const panel of Object.values(form.panels)) {
    words += countWords(panel.title) + countWords(panel.intro);
    words += countWords(panel.highlight.text) + countWords(panel.tip.text);
    for (const item of panel.items) words += countWords(item.label) + countWords(item.desc);
  }
  return Math.min(READ_MAX, Math.max(READ_MIN, Math.round(words / WORDS_PER_MINUTE)));
}

function validate(form: InsightFormData, articleId: string, mode: 'create' | 'edit'): Errors {
  const errors: Errors = {};
  if (!form.title.trim()) errors.title = 'Enter a title for the article.';
  if (mode === 'create' && !slugify(articleId)) {
    errors.articleId = 'Enter an article ID using letters and numbers.';
  }
  if (!form.heroTag.trim()) errors.heroTag = 'Enter a tag, for example "Body Changes".';
  if (!Number.isInteger(form.readTime) || form.readTime < READ_MIN || form.readTime > READ_MAX) {
    errors.readTime = `Read time must be a whole number from ${READ_MIN} to ${READ_MAX} minutes.`;
  }
  if (form.tabs.length === 0) errors.tabs = 'Add at least one section so the article has content.';
  const yt = form.youTubeUrl.trim();
  if (yt && !/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(yt)) {
    errors.youTubeUrl = 'Use a YouTube link (youtube.com or youtu.be).';
  }
  const citationUrl = form.citation.url.trim();
  if (citationUrl && !/^https?:\/\//i.test(citationUrl)) {
    errors.citationUrl = 'Start the link with https://';
  }
  return errors;
}

// -- small layout pieces ---------------------------------------------------

function FormSection({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card shadow-soft" aria-labelledby={`section-${step}`}>
      <header className="flex items-start gap-3 border-b px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--action-soft)] text-sm font-semibold text-[var(--action-soft-foreground)]">
          {step}
        </span>
        <div className="min-w-0">
          <h2 id={`section-${step}`} className="flex items-center gap-2 text-base font-semibold">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  counter?: { value: number; max: number };
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden>*</span>
          ) : (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </label>
        {counter && (
          <span
            className={`text-xs tabular-nums ${counter.value > counter.max ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Collapsible group for optional details; starts open when it already
 *  has content so nothing saved is hidden. */
function Disclosure({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group/disc rounded-xl border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-[var(--action-ring)] [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {summary && <span className="ml-2 font-normal text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/disc:rotate-180" />
      </summary>
      <div className="space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}

// -- the form --------------------------------------------------------------

export function InsightEditForm({
  mode,
  id: initialId,
  initialData,
  tagSuggestions = [],
}: {
  mode: 'create' | 'edit';
  id?: string;
  initialData: InsightFormData;
  tagSuggestions?: string[];
}) {
  const router = useRouter();
  const uid = useId();
  const fid = (key: string) => `${uid}-${key}`;

  const [articleId, setArticleId] = useState(initialId ?? '');
  const [idEdited, setIdEdited] = useState(false);
  const [form, setForm] = useState<InsightFormData>(() => ({
    accentColor: DEFAULT_ACCENT,
    excerpt: '',
    sections: [],
    heroImage: null,
    ...initialData,
  }));
  const [baseline, setBaseline] = useState(() => JSON.stringify({ form, articleId }));
  const [errors, setErrors] = useState<Errors>({});
  const [activeTabId, setActiveTabId] = useState(form.tabs[0]?.id ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customBgIndex, setCustomBgIndex] = useState<number | null>(null);

  const isDirty = JSON.stringify({ form, articleId }) !== baseline;
  const busy = isSaving || isDeleting;

  const activePanelKey = String(activeTabId);
  const activePanel = form.panels[activePanelKey];
  const activeTab = form.tabs.find((t) => t.id === activeTabId);
  const previewColors = deriveArticleColors(form.accentColor ?? DEFAULT_ACCENT);
  const accentTint = previewColors.accentBg;
  const estimatedRead = estimateReadTime(form);

  // Warn before closing or reloading the tab with unsaved edits.
  useEffect(() => {
    if (!isDirty || busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, busy]);

  function clearError(key: FieldKey) {
    if (!errors[key]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function update<K extends keyof InsightFormData>(key: K, value: InsightFormData[K], errorKey?: FieldKey) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errorKey) clearError(errorKey);
  }

  function onTitleChange(title: string) {
    update('title', title, 'title');
    // The ID follows the title until someone edits it by hand.
    if (mode === 'create' && !idEdited) {
      setArticleId(slugify(title));
      clearError('articleId');
    }
  }

  function updatePanel(patch: Partial<ArticlePanel>) {
    setForm((prev) => ({
      ...prev,
      panels: { ...prev.panels, [activePanelKey]: { ...prev.panels[activePanelKey], ...patch } },
    }));
  }

  function updateItem(index: number, patch: Partial<ArticleItem>) {
    updatePanel({ items: activePanel.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function addItem() {
    updatePanel({ items: [...activePanel.items, { ...BLANK_ITEM, iconBg: accentTint }] });
  }

  function removeItem(index: number) {
    updatePanel({ items: activePanel.items.filter((_, i) => i !== index) });
    setCustomBgIndex(null);
  }

  function addTab() {
    const nextId = form.tabs.length > 0 ? Math.max(...form.tabs.map((t) => t.id)) + 1 : 1;
    setForm((prev) => ({
      ...prev,
      tabs: [...prev.tabs, { id: nextId, label: `Section ${prev.tabs.length + 1}` }],
      panels: { ...prev.panels, [String(nextId)]: { ...BLANK_PANEL } },
    }));
    setActiveTabId(nextId);
    setCustomBgIndex(null);
    clearError('tabs');
  }

  function removeTab(tabId: number) {
    const remainingTabs = form.tabs.filter((t) => t.id !== tabId);
    setForm((prev) => {
      const panels = { ...prev.panels };
      delete panels[String(tabId)];
      return { ...prev, tabs: prev.tabs.filter((t) => t.id !== tabId), panels };
    });
    if (activeTabId === tabId) setActiveTabId(remainingTabs[0]?.id ?? 0);
  }

  function renameActiveTab(label: string) {
    setForm((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.id === activeTabId ? { ...t, label } : t)) }));
  }

  function toggleSection(section: string) {
    const current = form.sections ?? [];
    update('sections', current.includes(section) ? current.filter((s) => s !== section) : [...current, section]);
  }

  function focusFirstError(found: Errors) {
    const first = FIELD_ORDER.find((key) => found[key]);
    if (!first) return;
    const el = document.getElementById(fid(first));
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }

  function leave() {
    if (isDirty) setConfirmDiscard(true);
    else router.push('/admin/insights');
  }

  async function handleDelete() {
    if (!initialId) return;
    setConfirmDelete(false);
    setIsDeleting(true);
    setServerError('');
    try {
      const res = await fetch(`/api/insights/${initialId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete article.');
        setIsDeleting(false);
        return;
      }
      setBaseline(JSON.stringify({ form, articleId }));
      toast.success('Article deleted.');
      router.push('/admin/insights');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete article.');
      setIsDeleting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setServerError('');

    const found = validate(form, articleId, mode);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Please fix the highlighted fields.');
      focusFirstError(found);
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'create') {
        const cleanId = slugify(articleId);
        const res = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cleanId, ...form, ...deriveArticleColors(form.accentColor ?? DEFAULT_ACCENT) }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data.error || 'Failed to create the article.';
          if (res.status === 409) {
            setErrors({ articleId: msg });
            focusFirstError({ articleId: msg });
          } else {
            setServerError(msg);
          }
          setIsSaving(false);
          return;
        }
        setBaseline(JSON.stringify({ form, articleId }));
        toast.success('Article created. It is now live in the app.');
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
        setServerError(data.error || 'Failed to save changes.');
        setIsSaving(false);
        return;
      }
      setBaseline(JSON.stringify({ form, articleId }));
      toast.success('Changes saved.');
      router.refresh();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Your edits are still here.');
    } finally {
      setIsSaving(false);
    }
  }

  const invalid = (key: FieldKey) => (errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${fid(key)}-error` } : {});

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 pb-2">
      {/* 1. Article information */}
      <FormSection
        step={1}
        icon={FileText}
        title="Article information"
        description="What the article is called and how it is labelled in the app."
      >
        <Field
          id={fid('title')}
          label="Title"
          required
          error={errors.title}
          counter={{ value: form.title.length, max: TITLE_MAX }}
        >
          <Input
            id={fid('title')}
            value={form.title}
            maxLength={TITLE_MAX}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Your changing body: up to 42 weeks"
            className="h-10 rounded-xl"
            {...invalid('title')}
          />
        </Field>

        {mode === 'create' && (
          <Field
            id={fid('articleId')}
            label="Article ID"
            required
            error={errors.articleId}
            hint="Filled in from the title. Letters and numbers only. It is the article's permanent key and can't be changed later."
          >
            <div className="flex items-center overflow-hidden rounded-xl border bg-muted/30 focus-within:ring-3 focus-within:ring-[var(--action-ring)]">
              <span className="select-none border-r px-3 text-sm text-muted-foreground">insights/</span>
              <Input
                id={fid('articleId')}
                value={articleId}
                onChange={(e) => {
                  setArticleId(e.target.value);
                  setIdEdited(true);
                  clearError('articleId');
                }}
                onBlur={() => setArticleId((v) => slugify(v))}
                placeholder="yourchangingbody"
                className="h-10 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                {...invalid('articleId')}
              />
            </div>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_180px]">
          <Field
            id={fid('heroTag')}
            label="Tag"
            required
            error={errors.heroTag}
            hint="Short label shown on the article, like a category. Pick an existing one or type a new one."
          >
            <Input
              id={fid('heroTag')}
              list={`${fid('heroTag')}-list`}
              value={form.heroTag}
              onChange={(e) => update('heroTag', e.target.value, 'heroTag')}
              placeholder="e.g. Body Changes"
              className="h-10 rounded-xl"
              {...invalid('heroTag')}
            />
            <datalist id={`${fid('heroTag')}-list`}>
              {tagSuggestions.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
          </Field>

          <Field
            id={fid('readTime')}
            label="Read time"
            required
            error={errors.readTime}
            hint={
              estimatedRead !== form.readTime ? (
                <button
                  type="button"
                  className="font-medium text-[var(--action)] hover:underline"
                  onClick={() => update('readTime', estimatedRead, 'readTime')}
                >
                  Use estimate: {estimatedRead} min
                </button>
              ) : (
                'Matches the content length.'
              )
            }
          >
            <div className="relative">
              <Input
                id={fid('readTime')}
                type="number"
                inputMode="numeric"
                min={READ_MIN}
                max={READ_MAX}
                step={1}
                value={Number.isNaN(form.readTime) ? '' : form.readTime}
                onChange={(e) => update('readTime', e.target.value === '' ? NaN : Number(e.target.value), 'readTime')}
                className="h-10 rounded-xl pr-12"
                {...invalid('readTime')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                min
              </span>
            </div>
          </Field>
        </div>

        {mode === 'create' ? (
          <>
            <Field
              id={fid('excerpt')}
              label="Short summary"
              hint="One or two sentences shown on the article card in the app."
              counter={{ value: (form.excerpt ?? '').length, max: EXCERPT_MAX }}
            >
              <Textarea
                id={fid('excerpt')}
                rows={2}
                maxLength={EXCERPT_MAX}
                value={form.excerpt}
                onChange={(e) => update('excerpt', e.target.value)}
                placeholder="What will mothers learn from this article?"
                className="rounded-xl"
              />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Where it appears
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
              </legend>
              <p className="text-xs text-muted-foreground">Choose the app sections that should list this article.</p>
              <div className="flex flex-wrap gap-2">
                {INSIGHT_SECTIONS.map((section) => {
                  const checked = form.sections?.includes(section) ?? false;
                  return (
                    <button
                      key={section}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleSection(section)}
                      className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--action-ring)] ${
                        checked
                          ? 'border-[var(--action)] bg-[var(--action-soft)] text-[var(--action-soft-foreground)]'
                          : 'border-input text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                      {SECTION_LABELS[section] ?? section}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        ) : (
          <p className="rounded-xl bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
            The summary, app sections, color and cover image are set when an article is created and can&apos;t be
            changed here.
          </p>
        )}
      </FormSection>

      {/* 2. Content */}
      <FormSection
        step={2}
        icon={BookOpen}
        title="Content"
        description="The article is split into sections, each shown as a tab in the app."
      >
        <div className="space-y-2">
          <div
            role="tablist"
            aria-label="Article sections"
            className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-1.5"
          >
            {form.tabs.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === activeTabId}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setCustomBgIndex(null);
                }}
                className={`h-8 max-w-[14rem] truncate rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--action-ring)] ${
                  tab.id === activeTabId
                    ? 'bg-background text-foreground shadow-soft'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                }`}
              >
                {tab.label || `Section ${i + 1}`}
              </button>
            ))}
            <Button
              id={fid('tabs')}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground"
              onClick={addTab}
            >
              <Plus className="h-3.5 w-3.5" />
              Add section
            </Button>
          </div>
          {errors.tabs && (
            <p className="text-xs font-medium text-destructive" role="alert">{errors.tabs}</p>
          )}
        </div>

        {form.tabs.length === 0 && !errors.tabs && (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">No sections yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a section such as &quot;Weeks 1–13&quot; to start writing.
            </p>
          </div>
        )}

        {activePanel && activeTab && (
          <div key={activeTabId} role="tabpanel" className="space-y-5 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field id={fid('tabLabel')} label="Section name" required hint="Shown on the tab in the app.">
                <Input
                  id={fid('tabLabel')}
                  value={activeTab.label}
                  onChange={(e) => renameActiveTab(e.target.value)}
                  placeholder="e.g. Weeks 1–13"
                  className="h-10 rounded-xl"
                />
              </Field>
              {form.tabs.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 gap-1.5 text-muted-foreground hover:text-destructive sm:mb-[22px]"
                  onClick={() => removeTab(activeTabId)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove section
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field id={fid('panelTitle')} label="Heading" hint="The large heading at the top of this section.">
                <Input
                  id={fid('panelTitle')}
                  value={activePanel.title}
                  onChange={(e) => updatePanel({ title: e.target.value })}
                  placeholder="e.g. The first wave of changes"
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field id={fid('panelTag')} label="Label above heading" hint="A small label, e.g. the trimester.">
                <Input
                  id={fid('panelTag')}
                  value={activePanel.tag}
                  onChange={(e) => updatePanel({ tag: e.target.value })}
                  placeholder="e.g. 1st Trimester"
                  className="h-10 rounded-xl"
                />
              </Field>
            </div>

            <Field id={fid('intro')} label="Introduction" hint="The opening paragraph of this section.">
              <Textarea
                id={fid('intro')}
                rows={4}
                value={activePanel.intro}
                onChange={(e) => updatePanel({ intro: e.target.value })}
                placeholder="Introduce what this section covers…"
                className="min-h-28 rounded-xl"
              />
            </Field>

            {/* Key points */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    Key points <span className="font-normal text-muted-foreground">({activePanel.items.length})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Short points shown as a list with an icon.</p>
                </div>
                <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Add point
                </Button>
              </div>

              {activePanel.items.length === 0 && (
                <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
                  No key points yet.
                </p>
              )}

              {activePanel.items.map((item, index) => {
                const isPreset = ICON_BG_PRESETS.some((p) => p.value === item.iconBg) || item.iconBg === accentTint;
                const showCustom = customBgIndex === index || (!!item.iconBg && !isPreset);
                return (
                  <div key={index} className="space-y-3 rounded-xl border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-36 shrink-0">
                        <Select
                          value={item.svgKey}
                          onValueChange={(value) => value && updateItem(index, { svgKey: value })}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl" aria-label={`Icon for point ${index + 1}`}>
                            <SelectValue placeholder="Icon" />
                          </SelectTrigger>
                          <SelectContent>
                            {INSIGHT_ICON_KEYS.map((key) => (
                              <SelectItem key={key} value={key}>{key}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        aria-label={`Point ${index + 1} title`}
                        value={item.label}
                        onChange={(e) => updateItem(index, { label: e.target.value })}
                        placeholder="Point title"
                        className="h-10 min-w-0 flex-1 rounded-xl"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove point ${index + 1}`}
                        onClick={() => removeItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      aria-label={`Point ${index + 1} description`}
                      rows={2}
                      value={item.desc}
                      onChange={(e) => updateItem(index, { desc: e.target.value })}
                      placeholder="A sentence or two explaining this point."
                      className="rounded-xl"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Icon background</span>
                      {[{ name: 'Article color', value: accentTint }, ...ICON_BG_PRESETS].map((preset) => {
                        const selected = item.iconBg === preset.value;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            title={preset.name}
                            aria-label={`${preset.name} background`}
                            aria-pressed={selected}
                            onClick={() => {
                              updateItem(index, { iconBg: preset.value });
                              setCustomBgIndex(null);
                            }}
                            className={`h-7 w-7 rounded-full border outline-none transition focus-visible:ring-3 focus-visible:ring-[var(--action-ring)] ${
                              selected ? 'ring-2 ring-[var(--action)] ring-offset-2 ring-offset-background' : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: preset.value }}
                          />
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCustomBgIndex(showCustom ? null : index)}
                        className="text-xs font-medium text-[var(--action)] hover:underline"
                      >
                        {showCustom ? 'Hide custom' : 'Custom…'}
                      </button>
                    </div>
                    {showCustom && (
                      <Input
                        aria-label={`Point ${index + 1} custom icon background`}
                        value={item.iconBg}
                        onChange={(e) => updateItem(index, { iconBg: e.target.value })}
                        placeholder="rgba(224,126,184,0.12)"
                        className="h-9 rounded-xl font-mono text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <Disclosure
              title="Highlight box"
              summary={activePanel.highlight.label || activePanel.highlight.text ? '' : 'optional'}
              defaultOpen={!!(activePanel.highlight.label || activePanel.highlight.text)}
            >
              <Field id={fid('hlLabel')} label="Label" hint='e.g. "Did you know?"'>
                <Input
                  id={fid('hlLabel')}
                  value={activePanel.highlight.label}
                  onChange={(e) => updatePanel({ highlight: { ...activePanel.highlight, label: e.target.value } })}
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field id={fid('hlText')} label="Text">
                <Textarea
                  id={fid('hlText')}
                  rows={2}
                  value={activePanel.highlight.text}
                  onChange={(e) => updatePanel({ highlight: { ...activePanel.highlight, text: e.target.value } })}
                  className="rounded-xl"
                />
              </Field>
            </Disclosure>

            <Disclosure
              title="Tip"
              summary={activePanel.tip.text || activePanel.tip.source ? '' : 'optional'}
              defaultOpen={!!(activePanel.tip.text || activePanel.tip.source)}
            >
              <Field id={fid('tipText')} label="Tip">
                <Textarea
                  id={fid('tipText')}
                  rows={2}
                  value={activePanel.tip.text}
                  onChange={(e) => updatePanel({ tip: { ...activePanel.tip, text: e.target.value } })}
                  className="rounded-xl"
                />
              </Field>
              <Field id={fid('tipSource')} label="Tip source" hint="e.g. MomCare Health · Nutrition">
                <Input
                  id={fid('tipSource')}
                  value={activePanel.tip.source}
                  onChange={(e) => updatePanel({ tip: { ...activePanel.tip, source: e.target.value } })}
                  className="h-10 rounded-xl"
                />
              </Field>
            </Disclosure>
          </div>
        )}
      </FormSection>

      {/* 3. Media & sources */}
      <FormSection
        step={3}
        icon={ImageIcon}
        title="Media & sources"
        description="Optional video, look and references."
      >
        <Field
          id={fid('youTubeUrl')}
          label="YouTube video"
          error={errors.youTubeUrl}
          hint="A related video shown with the article."
        >
          <Input
            id={fid('youTubeUrl')}
            type="url"
            inputMode="url"
            value={form.youTubeUrl}
            onChange={(e) => update('youTubeUrl', e.target.value, 'youTubeUrl')}
            placeholder="https://www.youtube.com/watch?v=…"
            className="h-10 rounded-xl"
            {...invalid('youTubeUrl')}
          />
        </Field>

        {mode === 'create' && (
          <Field id={fid('accent')} label="Article color" hint="Tints and highlights in the app are generated from this color.">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border p-1.5 pr-3">
                <input
                  id={fid('accent')}
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => update('accentColor', e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  aria-label="Pick article color"
                />
                <Input
                  aria-label="Article color hex value"
                  value={form.accentColor}
                  onChange={(e) => update('accentColor', e.target.value)}
                  className="h-8 w-24 border-0 px-1 font-mono text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              <div
                className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-4 text-sm font-medium"
                style={{ background: previewColors.heroBg }}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="truncate">{form.title || 'Article header preview'}</span>
              </div>
            </div>
          </Field>
        )}

        {mode === 'create' && (
          <Disclosure title="Cover image" summary={form.heroImage ? '' : 'optional, advanced'} defaultOpen={!!form.heroImage}>
            <Field
              id={fid('heroImage')}
              label="Image path in the app"
              hint={
                <>
                  Must match an image already bundled in the mobile app under{' '}
                  <code className="rounded bg-muted px-1 py-0.5">src/assets/icon/</code>. It shows after the app is
                  rebuilt and republished.
                </>
              }
            >
              <Input
                id={fid('heroImage')}
                value={form.heroImage ?? ''}
                onChange={(e) => update('heroImage', e.target.value || null)}
                placeholder="assets/icon/yourimage.jpg"
                className="h-10 rounded-xl font-mono text-sm"
              />
            </Field>
          </Disclosure>
        )}

        <Disclosure
          title="Source & citation"
          summary={form.citation.source || form.citation.author ? form.citation.source || form.citation.author : 'optional'}
          defaultOpen={!!errors.citationUrl || !!(form.citation.source || form.citation.author || form.citation.url)}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={fid('citeSource')} label="Source" hint="Organisation or publication">
              <Input
                id={fid('citeSource')}
                value={form.citation.source}
                onChange={(e) => update('citation', { ...form.citation, source: e.target.value })}
                placeholder="e.g. World Health Organization"
                className="h-10 rounded-xl"
              />
            </Field>
            <Field id={fid('citeAuthor')} label="Author">
              <Input
                id={fid('citeAuthor')}
                value={form.citation.author}
                onChange={(e) => update('citation', { ...form.citation, author: e.target.value })}
                className="h-10 rounded-xl"
              />
            </Field>
            <Field id={fid('citeYear')} label="Year">
              <Input
                id={fid('citeYear')}
                inputMode="numeric"
                maxLength={4}
                value={form.citation.year}
                onChange={(e) => update('citation', { ...form.citation, year: e.target.value.replace(/\D/g, '') })}
                placeholder="2024"
                className="h-10 rounded-xl"
              />
            </Field>
            <Field id={fid('citationUrl')} label="Link" error={errors.citationUrl}>
              <Input
                id={fid('citationUrl')}
                type="url"
                inputMode="url"
                value={form.citation.url}
                onChange={(e) => {
                  update('citation', { ...form.citation, url: e.target.value });
                  clearError('citationUrl');
                }}
                placeholder="https://…"
                className="h-10 rounded-xl"
                {...invalid('citationUrl')}
              />
            </Field>
          </div>
        </Disclosure>
      </FormSection>

      {serverError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}

      {/* Action bar: stays in reach while scrolling a long article. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:rounded-2xl sm:border sm:shadow-card">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            {mode === 'edit' && (
              <Button
                type="button"
                variant="destructive"
                className="h-10 gap-1.5"
                disabled={busy}
                loading={isDeleting}
                onClick={() => setConfirmDelete(true)}
              >
                {!isDeleting && <Trash2 className="h-4 w-4" />}
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {isDirty ? 'Unsaved changes' : mode === 'edit' ? 'All changes saved' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" disabled={busy} onClick={leave}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 flex-1 sm:min-w-[170px] sm:flex-none"
              disabled={busy || (mode === 'edit' && !isDirty)}
              loading={isSaving}
            >
              {isSaving
                ? mode === 'create' ? 'Publishing…' : 'Saving…'
                : mode === 'create' ? 'Publish article' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have edits that haven&apos;t been saved. Leaving now will lose them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={() => {
                setBaseline(JSON.stringify({ form, articleId }));
                router.push('/admin/insights');
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{form.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. The article will be permanently removed and will disappear from the
              mobile app immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" onClick={handleDelete}>
              Delete article
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

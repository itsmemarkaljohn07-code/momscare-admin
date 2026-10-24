'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Info, Loader2, Pencil, Plus, Trash2, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { showApiError } from '@/lib/error-messages';
import { toManilaInput, type Stay, type StayField } from '@/lib/stays';

type Row = Stay & { id: string };
type Form = Record<StayField, string>;
type Errors = Partial<Record<StayField, string>>;

const EMPTY: Form = {
  admittedAt: '', deliveredAt: '', outcome: '', babySex: '', birthWeightG: '', birthLengthCm: '', dischargedAt: '', transferredAt: '',
};

/** Fields in form order, for focusing the first error. */
const FIELD_ORDER: StayField[] = ['admittedAt', 'deliveredAt', 'outcome', 'babySex', 'birthWeightG', 'birthLengthCm', 'dischargedAt', 'transferredAt'];

const shown = (ms: number | null) =>
  ms === null
    ? null
    : new Date(ms).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function toForm(s: Row): Form {
  return {
    admittedAt: toManilaInput(s.admittedAt),
    deliveredAt: toManilaInput(s.deliveredAt),
    outcome: s.outcome ?? '',
    babySex: s.babySex ?? '',
    birthWeightG: s.birthWeightG === null ? '' : String(s.birthWeightG),
    birthLengthCm: s.birthLengthCm === null ? '' : String(s.birthLengthCm),
    dischargedAt: toManilaInput(s.dischargedAt),
    transferredAt: toManilaInput(s.transferredAt),
  };
}

function summary(s: Row): string {
  if (s.deliveredAt === null) return 'No delivery recorded';
  if (s.outcome === 'stillbirth') return 'Stillbirth';
  return `Live birth, ${s.babySex ?? 'sex not recorded'}`;
}

/** The request body, same fields and string formats as before. Hidden
 *  fields are sent empty: no delivery clears every delivery field; a
 *  stillbirth clears the baby's sex, weight and length. */
function payload(form: Form, delivered: boolean): Form {
  if (!delivered) return { ...form, deliveredAt: '', outcome: '', babySex: '', birthWeightG: '', birthLengthCm: '' };
  if (form.outcome !== 'live') return { ...form, babySex: '', birthWeightG: '', birthLengthCm: '' };
  return form;
}

/** Order hints shown before saving; they never block, the server decides. */
function orderHints(f: Form, delivered: boolean): Errors {
  const hints: Errors = {};
  if (delivered && f.admittedAt && f.deliveredAt && f.deliveredAt < f.admittedAt) hints.deliveredAt = 'This is before the admission.';
  const lastBefore = delivered && f.deliveredAt ? f.deliveredAt : f.admittedAt;
  if (f.dischargedAt && lastBefore && f.dischargedAt < lastBefore) {
    hints.dischargedAt = delivered && f.deliveredAt ? 'This is before the delivery.' : 'This is before the admission.';
  }
  if (f.transferredAt && f.admittedAt && f.transferredAt < f.admittedAt) hints.transferredAt = 'This is before the admission.';
  return hints;
}

/** A labelled date-time field (Philippine time) with "Now" and optional "Clear". */
function DateTimeField({
  name, label, hint, value, onChange, error, warning, clearable = false,
}: {
  name: StayField; label: string; hint?: string; value: string; onChange: (v: string) => void;
  error?: string; warning?: string; clearable?: boolean;
}) {
  const id = `stay-${name}`;
  const note = error ? `${id}-error` : warning ? `${id}-warning` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {/* Phones: the field takes the row, Now / Clear wrap below it. */}
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <Input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={note}
          className="h-11 min-w-0 basis-full sm:basis-auto sm:flex-1 md:h-9"
        />
        <Button type="button" variant="outline" className="h-11 shrink-0 gap-1.5 px-3 md:h-9" onClick={() => onChange(toManilaInput(Date.now()))} aria-label={`${label}: now`}>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Now
        </Button>
        {clearable && value && (
          <Button type="button" variant="ghost" className="h-11 shrink-0 gap-1 px-2.5 md:h-9" onClick={() => onChange('')} aria-label={`Clear ${label.toLowerCase()}`}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : warning ? (
        <p id={`${id}-warning`} className="text-xs" style={{ color: 'var(--status-pending)' }}>{warning}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Native radio inputs styled as segments: arrow keys move between them. */
function Segmented({
  name, label, value, options, onChange, error,
}: {
  name: StayField; label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void; error?: string;
}) {
  const labelId = `stay-${name}-label`;
  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-sm font-medium">{label}</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `stay-${name}-error` : undefined}
        className="inline-flex w-full rounded-lg border bg-muted/40 p-1 sm:w-auto"
      >
        {options.map((o, i) => (
          <label
            key={o.value}
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring sm:flex-none md:min-h-8 ${
              value === o.value ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <input
              type="radio"
              name={`stay-${name}`}
              id={i === 0 ? `stay-${name}` : undefined}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p id={`stay-${name}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** A number with its unit inside the field and the allowed range as the hint. */
function UnitField({
  name, label, unit, range, value, onChange, error, decimal = false,
}: {
  name: StayField; label: string; unit: string; range: string; value: string; onChange: (v: string) => void; error?: string; decimal?: boolean;
}) {
  const id = `stay-${name}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label} <span className="font-normal text-muted-foreground">(optional)</span></label>
      <div className="relative">
        <Input
          id={id}
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          className="h-11 pr-10 md:h-9"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground" aria-hidden="true">{unit}</span>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{range}</p>
      )}
    </div>
  );
}

function Section({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>
      {children}
    </section>
  );
}

/** A status chip; muted when the event isn't recorded. */
function Chip({ on, children, tone }: { on: boolean; children: React.ReactNode; tone?: 'pending' }) {
  const style = tone === 'pending' ? { color: 'var(--status-pending)', backgroundColor: 'var(--status-pending-bg)' } : undefined;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${on ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground line-through decoration-muted-foreground/40'}`}
      style={style}
    >
      {children}
    </span>
  );
}

/** Admin-only birth stays for one patient: list, add, edit and delete.
 *  Saved through the server, which validates again. */
export function PatientStaysCard({ uid, patientName }: { uid: string; patientName: string }) {
  const [stays, setStays] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delivered, setDelivered] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  // Set synchronously, so a double click sends one request (state updates
  // only after the render, too late for the second click).
  const sending = useRef(false);
  // The button that opened a dialog gets focus back when it closes.
  const returnFocus = useRef<HTMLElement | null>(null);
  const deliveryId = useId();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}/stays`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error);
      setStays(json.stays);
      setLoadError('');
    } catch {
      setLoadError('Could not load the stays.');
    }
  }, [uid]);

  useEffect(() => {
    // Initial load; load() sets state after the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openForm(target: Row | 'new', opener: HTMLElement) {
    returnFocus.current = opener;
    setEditing(target);
    setForm(target === 'new' ? EMPTY : toForm(target));
    setDelivered(target !== 'new' && target.deliveredAt !== null);
    setFieldErrors({});
  }

  const set = (field: StayField) => (v: string) => {
    setForm((f) => ({ ...f, [field]: v }));
    setFieldErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  /** Scrolls to and focuses the first field with a server error. */
  function focusFirstError(errors: Errors) {
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`stay-${first}`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
  }

  async function save() {
    if (sending.current || !editing) return;
    sending.current = true;
    setBusy(true);
    setFieldErrors({});
    try {
      const url = editing === 'new' ? `/api/users/${encodeURIComponent(uid)}/stays` : `/api/users/${encodeURIComponent(uid)}/stays/${editing.id}`;
      const res = await fetch(url, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(form, delivered)),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 400 && json?.fields) {
        setFieldErrors(json.fields);
        focusFirstError(json.fields);
        return;
      }
      if (!res.ok) {
        showApiError(res, json, undefined, 'save stay');
        return;
      }
      toast.success(editing === 'new' ? 'Stay added.' : 'Stay saved.');
      setEditing(null);
      await load();
    } catch (err) {
      showApiError(null, null, err, 'save stay');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (sending.current || !deleting) return;
    sending.current = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}/stays/${deleting.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(res, json, undefined, 'delete stay');
        return;
      }
      toast.success('Stay deleted.');
      setDeleting(null);
      await load();
    } catch (err) {
      showApiError(null, null, err, 'delete stay');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const hints = orderHints(form, delivered);
  const live = form.outcome === 'live';
  const addButton = (
    <Button type="button" size="sm" className="min-h-11 shrink-0 gap-1.5 md:min-h-8" onClick={(e) => openForm('new', e.currentTarget)}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add stay
    </Button>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Birth stays</CardTitle>
          <CardDescription>Admissions, deliveries, discharges and transfers at the clinic, for the monthly report.</CardDescription>
        </div>
        {stays !== null && stays.length > 0 && addButton}
      </CardHeader>
      <CardContent className="space-y-2">
        {loadError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {stays === null && !loadError && <p className="text-sm text-muted-foreground">Loading…</p>}
        {stays?.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">No stays recorded yet. Add one when the mother is admitted.</p>
            {addButton}
          </div>
        )}
        <ul className="space-y-2">
          {stays?.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium">{summary(s)}</p>
                <div className="flex flex-wrap gap-1">
                  <Chip on>Admitted</Chip>
                  <Chip on={s.deliveredAt !== null}>Delivered</Chip>
                  {s.dischargedAt !== null ? <Chip on>Discharged</Chip> : <Chip on tone="pending">No discharge yet</Chip>}
                  {s.transferredAt !== null && <Chip on>Transferred to CDH</Chip>}
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-xs text-muted-foreground">
                  <dt>Admitted</dt><dd>{shown(s.admittedAt)}</dd>
                  {s.deliveredAt !== null && (<><dt>Delivered</dt><dd>{shown(s.deliveredAt)}</dd></>)}
                  {s.dischargedAt !== null && (<><dt>Discharged</dt><dd>{shown(s.dischargedAt)}</dd></>)}
                  {s.transferredAt !== null && (<><dt>Transferred</dt><dd>{shown(s.transferredAt)}</dd></>)}
                </dl>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon-sm" className="size-11 md:size-8" aria-label="Edit stay" onClick={(e) => openForm(s, e.currentTarget)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-11 text-destructive md:size-8"
                  aria-label="Delete stay"
                  onClick={(e) => { returnFocus.current = e.currentTarget; setDeleting(s); }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && !busy && setEditing(null)}>
        <DialogContent
          finalFocus={returnFocus}
          className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none flex-col gap-0 p-0 sm:max-h-[90vh] sm:max-w-[560px]"
        >
          <DialogHeader className="border-b px-4 pb-3 pt-4 pr-12">
            <DialogTitle>{editing === 'new' ? 'Add birth stay' : 'Edit birth stay'}</DialogTitle>
            <DialogDescription>
              {patientName}
              <span className="block text-xs">Philippine time</span>
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <Section title="Admission" helper="When the mother was admitted to the clinic.">
              <DateTimeField name="admittedAt" label="Admitted" value={form.admittedAt} onChange={set('admittedAt')} error={fieldErrors.admittedAt} />
            </Section>

            <Section title="Delivery" helper="Only if she delivered during this stay.">
              <label htmlFor={deliveryId} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 md:min-h-9">
                <span className="text-sm font-medium">A delivery happened during this stay</span>
                <input
                  id={deliveryId}
                  type="checkbox"
                  role="switch"
                  checked={delivered}
                  onChange={(e) => setDelivered(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${delivered ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${delivered ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </span>
              </label>

              {delivered && (
                <div className="space-y-3">
                  <DateTimeField name="deliveredAt" label="Delivered" value={form.deliveredAt} onChange={set('deliveredAt')} error={fieldErrors.deliveredAt} warning={hints.deliveredAt} />
                  <Segmented
                    name="outcome"
                    label="Outcome"
                    value={form.outcome}
                    onChange={set('outcome')}
                    error={fieldErrors.outcome}
                    options={[{ value: 'live', label: 'Live birth' }, { value: 'stillbirth', label: 'Stillbirth' }]}
                  />
                  {live && (
                    <>
                      <Segmented
                        name="babySex"
                        label="Baby"
                        value={form.babySex}
                        onChange={set('babySex')}
                        error={fieldErrors.babySex}
                        options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <UnitField name="birthWeightG" label="Birth weight" unit="g" range="300-7000 g" value={form.birthWeightG} onChange={set('birthWeightG')} error={fieldErrors.birthWeightG} />
                        <UnitField name="birthLengthCm" label="Birth length" unit="cm" range="20-70 cm" value={form.birthLengthCm} onChange={set('birthLengthCm')} error={fieldErrors.birthLengthCm} decimal />
                      </div>
                    </>
                  )}
                  <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Twins: add one stay per newborn with the same admission and delivery time. They count as one delivery with two newborns.
                  </p>
                </div>
              )}
            </Section>

            <Section title="Discharge and transfer" helper="Leave empty until it happens.">
              <DateTimeField name="dischargedAt" label="Discharged (optional)" value={form.dischargedAt} onChange={set('dischargedAt')} error={fieldErrors.dischargedAt} warning={hints.dischargedAt} clearable />
              <DateTimeField name="transferredAt" label="Transferred to CDH (optional)" value={form.transferredAt} onChange={set('transferredAt')} error={fieldErrors.transferredAt} warning={hints.transferredAt} clearable />
            </Section>
            {Object.keys(hints).length > 0 && (
              <p className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--status-pending)' }}>
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Check the highlighted times; the server will tell you if they can&apos;t be saved.
              </p>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-xl px-4 py-3">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="button" className="min-h-11 gap-2 md:min-h-9" disabled={busy} aria-busy={busy} onClick={save}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
        <DialogContent finalFocus={returnFocus} className="flex w-[calc(100%-1rem)] max-w-none flex-col gap-0 p-0 sm:max-w-sm">
          <DialogHeader className="border-b px-4 pb-3 pt-4 pr-12">
            <DialogTitle>Delete this stay?</DialogTitle>
            <DialogDescription>{patientName}. It will no longer count in the monthly report. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl px-4 py-3">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button type="button" variant="destructive-solid" className="min-h-11 gap-2 md:min-h-9" disabled={busy} aria-busy={busy} onClick={remove}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

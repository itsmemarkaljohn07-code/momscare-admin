'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Loader2, Pencil, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { showApiError } from '@/lib/error-messages';
import { manilaKey } from '@/lib/report-aggregations';
import { formatDateKey } from '@/lib/pregnancy-display';
import {
  DIA_MAX, DIA_MIN, FHR_MAX, FHR_MIN, FUNDAL_MAX, FUNDAL_MIN, NOTE_MAX, PULSE_MAX, PULSE_MIN, SYS_MAX, SYS_MIN, TEMP_MAX, TEMP_MIN,
  WEIGHT_MAX, WEIGHT_MIN, formatBp, validateReading, type ClinicReading, type ReadingField,
} from '@/lib/clinic-readings';

type Row = ClinicReading & { id: string };
type FormField = Exclude<ReadingField, 'form'>;
type Form = Record<FormField, string>;
type Errors = Partial<Record<ReadingField, string>>;

/** The latest weight and blood pressure the patient logged with a Snapshot. */
export interface PatientReported {
  weightKg: number | null;
  bpSys: number | null;
  bpDia: number | null;
  /** ISO time of that Snapshot. */
  at: string | null;
}

const FIELD_ORDER: FormField[] = ['measuredOn', 'weightKg', 'bpSys', 'bpDia', 'pulse', 'temperatureC', 'fundalHeightCm', 'fetalHeartRate', 'note'];
const today = () => manilaKey(new Date());
const emptyForm = (): Form => ({
  measuredOn: today(), weightKg: '', bpSys: '', bpDia: '', fundalHeightCm: '', fetalHeartRate: '', pulse: '', temperatureC: '', note: '',
});
const text = (n: number | null) => (n === null ? '' : String(n));
const longDate = (day: string) => formatDateKey(day, { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = (day: string) => formatDateKey(day, { month: 'short', day: 'numeric' });

/**
 * The six measures, in the order shown everywhere (strip, "Will save",
 * reading cards). Values are shown as typed or stored, never judged.
 */
const MEASURES: { key: string; label: string; value: (r: Pick<Row, FormField | 'bpSys' | 'bpDia'> | Record<string, unknown>) => string | null }[] = [
  { key: 'weightKg', label: 'Weight', value: (r) => (r.weightKg !== null && r.weightKg !== '' ? `${r.weightKg} kg` : null) },
  {
    key: 'bp', label: 'Blood pressure',
    value: (r) => (r.bpSys !== null && r.bpSys !== '' && r.bpDia !== null && r.bpDia !== '' ? `${r.bpSys}/${r.bpDia} mmHg` : null),
  },
  { key: 'fundalHeightCm', label: 'Fundal height', value: (r) => (r.fundalHeightCm !== null && r.fundalHeightCm !== '' ? `${r.fundalHeightCm} cm` : null) },
  { key: 'fetalHeartRate', label: 'Fetal heart rate', value: (r) => (r.fetalHeartRate !== null && r.fetalHeartRate !== '' ? `${r.fetalHeartRate} bpm` : null) },
  { key: 'pulse', label: 'Pulse', value: (r) => (r.pulse !== null && r.pulse !== '' ? `${r.pulse} bpm` : null) },
  { key: 'temperatureC', label: 'Temperature', value: (r) => (r.temperatureC !== null && r.temperatureC !== '' ? `${r.temperatureC} °C` : null) },
];

/** What the form would store, as "weight 62.4 kg, pulse 84 bpm" (taken
 *  measures only); '' while the form would be refused. */
function willSave(form: Form): string {
  const checked = validateReading(form, today());
  if (!checked.ok) return '';
  return MEASURES.map((m) => {
    const v = m.value(checked.value);
    return v ? `${m.label.toLowerCase()} ${v}` : null;
  }).filter(Boolean).join(', ');
}

/** "Systolic: ..." unless the message already names the value. */
const bpMessage = (name: string, message: string) => (message.toLowerCase().includes(name.toLowerCase()) ? message : `${name}: ${message}`);

function toForm(r: Row): Form {
  return {
    measuredOn: r.measuredOn,
    weightKg: text(r.weightKg),
    bpSys: text(r.bpSys),
    bpDia: text(r.bpDia),
    fundalHeightCm: text(r.fundalHeightCm),
    fetalHeartRate: text(r.fetalHeartRate),
    pulse: text(r.pulse),
    temperatureC: text(r.temperatureC),
    note: r.note,
  };
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) return <p id={`${id}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  return hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null;
}

/** A number input with its unit inside the field. */
function UnitInput({
  id, unit, value, onChange, error, describedBy, decimal = false, label,
}: {
  id: string; unit: string; value: string; onChange: (v: string) => void; error?: string; describedBy?: string; decimal?: boolean; label?: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Input
        id={id}
        inputMode={decimal ? 'decimal' : 'numeric'}
        enterKeyHint="next"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-11 pr-14 tabular-nums md:h-9"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground" aria-hidden="true">{unit}</span>
    </div>
  );
}

/** A labelled number field: label, input with unit, hint or error under it. */
function NumberField({
  id, label, unit, hint, value, onChange, error, decimal = false,
}: {
  id: string; label: string; unit: string; hint: string; value: string; onChange: (v: string) => void; error?: string; decimal?: boolean;
}) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <UnitInput id={id} unit={unit} value={value} onChange={onChange} error={error} decimal={decimal} describedBy={error ? `${id}-error` : `${id}-hint`} />
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

/** Systolic / diastolic on one line, each error under the pair. */
function BloodPressureField({ prefix, form, errors, set }: { prefix: string; form: Form; errors: Errors; set: (f: FormField) => (v: string) => void }) {
  const sys = `${prefix}-bpSys`;
  const dia = `${prefix}-bpDia`;
  const hintId = `${prefix}-bp-hint`;
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <span id={`${prefix}-bp-label`} className="text-sm font-medium">Blood pressure</span>
      <div className="flex items-center gap-2" role="group" aria-labelledby={`${prefix}-bp-label`}>
        <UnitInput
          id={sys} unit="sys" label="Systolic (mmHg)" value={form.bpSys} onChange={set('bpSys')} error={errors.bpSys}
          describedBy={[errors.bpSys ? `${sys}-error` : '', hintId].filter(Boolean).join(' ')}
        />
        <span className="text-lg text-muted-foreground" aria-hidden="true">/</span>
        <UnitInput
          id={dia} unit="dia" label="Diastolic (mmHg)" value={form.bpDia} onChange={set('bpDia')} error={errors.bpDia}
          describedBy={[errors.bpDia ? `${dia}-error` : '', hintId].filter(Boolean).join(' ')}
        />
      </div>
      {errors.bpSys && <p id={`${sys}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">{bpMessage('Systolic', errors.bpSys)}</p>}
      {errors.bpDia && <p id={`${dia}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">{bpMessage('Diastolic', errors.bpDia)}</p>}
      <p id={hintId} className="text-xs text-muted-foreground">Accepted: systolic {SYS_MIN}-{SYS_MAX}, diastolic {DIA_MIN}-{DIA_MAX} mmHg</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border p-3 sm:p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** The reading form, used inline to add and in the edit dialog. The ranges
 *  in the hints are typing guards, not clinical limits. */
function ReadingFields({ prefix, form, errors, set }: { prefix: string; form: Form; errors: Errors; set: (f: FormField) => (v: string) => void }) {
  const id = (f: FormField) => `${prefix}-${f}`;
  const summary = willSave(form);
  return (
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <label htmlFor={id('measuredOn')} className="text-sm font-medium">Date measured</label>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Input
            id={id('measuredOn')}
            type="date"
            max={today()}
            value={form.measuredOn}
            onChange={(e) => set('measuredOn')(e.target.value)}
            aria-invalid={errors.measuredOn ? true : undefined}
            aria-describedby={errors.measuredOn ? `${id('measuredOn')}-error` : undefined}
            className="h-11 min-w-0 basis-full sm:max-w-xs sm:basis-auto sm:flex-1 md:h-9"
          />
          <Button type="button" variant="outline" className="h-11 shrink-0 gap-1.5 px-3 md:h-9" onClick={() => set('measuredOn')(today())} aria-label="Date measured: today">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Today
          </Button>
        </div>
        <FieldMessage id={id('measuredOn')} error={errors.measuredOn} />
      </div>

      <Group title="Vitals">
        <NumberField id={id('weightKg')} label="Weight" unit="kg" hint={`Accepted: ${WEIGHT_MIN}-${WEIGHT_MAX} kg, one decimal`} value={form.weightKg} onChange={set('weightKg')} error={errors.weightKg} decimal />
        <BloodPressureField prefix={prefix} form={form} errors={errors} set={set} />
        <NumberField id={id('pulse')} label="Pulse" unit="bpm" hint={`Accepted: ${PULSE_MIN}-${PULSE_MAX} bpm`} value={form.pulse} onChange={set('pulse')} error={errors.pulse} />
        <NumberField id={id('temperatureC')} label="Temperature" unit="°C" hint={`Accepted: ${TEMP_MIN.toFixed(1)}-${TEMP_MAX.toFixed(1)} °C, one decimal`} value={form.temperatureC} onChange={set('temperatureC')} error={errors.temperatureC} decimal />
      </Group>

      <Group title="Pregnancy">
        <NumberField id={id('fundalHeightCm')} label="Fundal height" unit="cm" hint={`Accepted: ${FUNDAL_MIN}-${FUNDAL_MAX} cm, one decimal`} value={form.fundalHeightCm} onChange={set('fundalHeightCm')} error={errors.fundalHeightCm} decimal />
        <NumberField id={id('fetalHeartRate')} label="Fetal heart rate" unit="bpm" hint={`Accepted: ${FHR_MIN}-${FHR_MAX} bpm`} value={form.fetalHeartRate} onChange={set('fetalHeartRate')} error={errors.fetalHeartRate} />
      </Group>

      <div className="grid gap-1.5">
        <label htmlFor={id('note')} className="text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span></label>
        <Textarea
          id={id('note')}
          rows={2}
          maxLength={NOTE_MAX + 50}
          value={form.note}
          onChange={(e) => set('note')(e.target.value)}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? `${id('note')}-error` : `${id('note')}-hint`}
        />
        <FieldMessage id={id('note')} error={errors.note} hint={`${form.note.trim().length}/${NOTE_MAX}`} />
      </div>

      <div aria-live="polite">
        {summary && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="font-medium">Will save:</span> {summary}</p>}
      </div>
      {errors.form && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>}
    </div>
  );
}

/** Newest value of each measure across the clinic readings (rows come newest first). */
function LatestStrip({ rows }: { rows: Row[] }) {
  return (
    <section aria-labelledby="latest-values-title" className="space-y-2">
      <h3 id="latest-values-title" className="text-sm font-semibold">Latest values</h3>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {MEASURES.map((m) => {
          const row = rows.find((r) => m.value(r) !== null);
          return (
            <div key={m.key} className="min-w-0 rounded-xl border bg-muted/30 px-3 py-2">
              <dt className="truncate text-xs text-muted-foreground">{m.label}</dt>
              {row ? (
                <dd>
                  <span className="block truncate text-base font-semibold tabular-nums">{m.value(row)}</span>
                  <span className="text-xs text-muted-foreground">{shortDate(row.measuredOn)}</span>
                </dd>
              ) : (
                <dd className="py-1 text-sm text-muted-foreground">Not taken yet</dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Health readings taken at the clinic by the assigned doctor: add, list,
 *  edit and delete (own readings). The server checks everything again. */
export function ClinicReadingsCard({ patientUid, patientName, reported }: { patientUid: string; patientName: string; reported: PatientReported | null }) {
  const base = `/api/doctors/clinic-readings/${encodeURIComponent(patientUid)}`;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [viewerUid, setViewerUid] = useState('');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<Form>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Form>(emptyForm);
  const [editErrors, setEditErrors] = useState<Errors>({});
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState<'add' | 'edit' | 'delete' | null>(null);
  // Set synchronously, so a double click sends one request.
  const sending = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error);
      setRows(json.readings);
      setViewerUid(json.viewerUid);
      setLoadError('');
    } catch {
      setLoadError('Could not load the readings.');
    }
  }, [base]);

  useEffect(() => {
    // Initial load; load() sets state after the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setter = (update: typeof setForm, clear: typeof setErrors) => (field: FormField) => (v: string) => {
    update((f) => ({ ...f, [field]: v }));
    clear((e) => (e[field] || e.form ? { ...e, [field]: undefined, form: undefined } : e));
  };

  function focusFirst(prefix: string, errs: Errors) {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) requestAnimationFrame(() => document.getElementById(`${prefix}-${first}`)?.focus());
  }

  /** Validates here first (same rules as the server), then sends. */
  async function send(kind: 'add' | 'edit', values: Form, setErrs: typeof setErrors, prefix: string): Promise<boolean> {
    if (sending.current) return false;
    const local = validateReading(values, today());
    if (!local.ok) {
      setErrs(local.errors);
      focusFirst(prefix, local.errors);
      return false;
    }
    sending.current = true;
    setBusy(kind);
    try {
      const res = await fetch(kind === 'add' ? base : `${base}/${editing!.id}`, {
        method: kind === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 400 && json?.fields) {
        setErrs(json.fields);
        focusFirst(prefix, json.fields);
        return false;
      }
      if (!res.ok) {
        showApiError(res, json, undefined, 'save reading');
        return false;
      }
      await load();
      return true;
    } catch (err) {
      showApiError(null, null, err, 'save reading');
      return false;
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  async function add() {
    if (await send('add', form, setErrors, 'add')) {
      toast.success('Reading added.');
      setForm(emptyForm());
      setErrors({});
    }
  }

  async function saveEdit() {
    if (await send('edit', editForm, setEditErrors, 'edit')) {
      toast.success('Reading saved.');
      setEditing(null);
    }
  }

  async function remove() {
    if (sending.current || !deleting) return;
    sending.current = true;
    setBusy('delete');
    try {
      const res = await fetch(`${base}/${deleting.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(res, json, undefined, 'delete reading');
        return;
      }
      toast.success('Reading deleted.');
      setDeleting(null);
      await load();
    } catch (err) {
      showApiError(null, null, err, 'delete reading');
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  const spinner = <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  const reportedBp = reported ? formatBp(reported) : '';
  const hasReported = reported && (reported.weightKg !== null || reportedBp);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Health readings</CardTitle>
        <CardDescription>Measured at the clinic.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows !== null && <LatestStrip rows={rows} />}

        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Patient-reported (latest):</span>{' '}
            {hasReported ? (
              <>
                {[reported!.weightKg !== null ? `${reported!.weightKg} kg` : '', reportedBp ? `BP ${reportedBp}` : ''].filter(Boolean).join(', ')}
                {reported!.at && <> · logged by the patient with a Snapshot on {new Date(reported!.at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</>}
              </>
            ) : (
              'nothing logged by the patient yet.'
            )}
          </span>
        </p>

        <section aria-labelledby="add-reading-title" className="space-y-3 border-t pt-4">
          <h3 id="add-reading-title" className="text-sm font-semibold">Add a reading</h3>
          <ReadingFields prefix="add" form={form} errors={errors} set={setter(setForm, setErrors)} />
          <div className="flex justify-end">
            <Button type="button" className="min-h-11 w-full gap-2 sm:w-auto md:min-h-9" disabled={busy !== null} aria-busy={busy === 'add'} onClick={add}>
              {busy === 'add' && spinner}
              Save reading
            </Button>
          </div>
        </section>

        <section aria-labelledby="readings-list-title" className="space-y-2 border-t pt-4">
          <h3 id="readings-list-title" className="text-sm font-semibold">Clinic readings</h3>
          {loadError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
          {rows === null && !loadError && <p className="text-sm text-muted-foreground">Loading…</p>}
          {rows?.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No clinic readings yet. Add the first one above.</p>
          )}
          <ul className="space-y-2">
            {rows?.map((r) => {
              const mine = r.enteredByUid === viewerUid;
              const taken = MEASURES.map((m) => ({ m, v: m.value(r) })).filter((x) => x.v !== null);
              return (
                <li key={r.id} className="rounded-xl border p-3 text-sm sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold">{longDate(r.measuredOn)}</h4>
                      <p className="text-xs text-muted-foreground">Entered by {r.enteredByName || 'a doctor'}</p>
                    </div>
                    {mine && (
                      <div className="-mr-1 -mt-1 flex shrink-0 gap-1">
                        <Button
                          type="button" variant="ghost" size="icon-sm" className="size-11 md:size-8" aria-label={`Edit the reading of ${longDate(r.measuredOn)}`}
                          onClick={(e) => { returnFocus.current = e.currentTarget; setEditing(r); setEditForm(toForm(r)); setEditErrors({}); }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button" variant="ghost" size="icon-sm" className="size-11 text-destructive md:size-8" aria-label={`Delete the reading of ${longDate(r.measuredOn)}`}
                          onClick={(e) => { returnFocus.current = e.currentTarget; setDeleting(r); }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    {taken.map(({ m, v }) => (
                      <div key={m.key} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{m.label}</dt>
                        <dd className="font-medium tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.note && <p className="mt-2 break-words border-t pt-2 text-sm text-muted-foreground">{r.note}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && busy === null && setEditing(null)}>
        <DialogContent finalFocus={returnFocus} className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none flex-col gap-0 p-0 sm:max-h-[90vh] sm:max-w-[640px]">
          <DialogHeader className="border-b px-4 pb-3 pt-4 pr-12">
            <DialogTitle>Edit reading</DialogTitle>
            <DialogDescription>{patientName}. A field left blank is cleared.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <ReadingFields prefix="edit" form={editForm} errors={editErrors} set={setter(setEditForm, setEditErrors)} />
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl px-4 py-3">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" disabled={busy !== null} onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="button" className="min-h-11 gap-2 md:min-h-9" disabled={busy !== null} aria-busy={busy === 'edit'} onClick={saveEdit}>
              {busy === 'edit' && spinner}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && busy === null && setDeleting(null)}>
        <DialogContent finalFocus={returnFocus} className="flex w-[calc(100%-1rem)] max-w-none flex-col gap-0 p-0 sm:max-w-sm">
          <DialogHeader className="border-b px-4 pb-3 pt-4 pr-12">
            <DialogTitle>Delete this reading?</DialogTitle>
            <DialogDescription>
              {patientName}, {deleting ? longDate(deleting.measuredOn) : ''}. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl px-4 py-3">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" disabled={busy !== null} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button type="button" variant="destructive-solid" className="min-h-11 gap-2 md:min-h-9" disabled={busy !== null} aria-busy={busy === 'delete'} onClick={remove}>
              {busy === 'delete' && spinner}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

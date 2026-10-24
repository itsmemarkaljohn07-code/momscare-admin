'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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

const EMPTY: Form = {
  admittedAt: '', deliveredAt: '', outcome: '', babySex: '', birthWeightG: '', birthLengthCm: '', dischargedAt: '', transferredAt: '',
};

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

/** Admin-only birth stays for one patient: list, add, edit and delete.
 *  Saved through the server, which validates again. */
export function PatientStaysCard({ uid, patientName }: { uid: string; patientName: string }) {
  const [stays, setStays] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<StayField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  // Set synchronously, so a double click sends one request (state updates
  // only after the render, too late for the second click).
  const sending = useRef(false);

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

  function openForm(target: Row | 'new') {
    setEditing(target);
    setForm(target === 'new' ? EMPTY : toForm(target));
    setFieldErrors({});
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
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 400 && json?.fields) {
        setFieldErrors(json.fields);
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

  const set = (field: StayField) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));
  const field = (name: StayField, label: string, input: React.ReactNode) => (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {input}
      {fieldErrors[name] && <span id={`stay-${name}-error`} role="alert" className="text-xs font-normal text-red-600 dark:text-red-400">{fieldErrors[name]}</span>}
    </label>
  );
  const inputProps = (name: StayField) => ({
    value: form[name],
    onChange: set(name),
    'aria-invalid': fieldErrors[name] ? true : undefined,
    'aria-describedby': fieldErrors[name] ? `stay-${name}-error` : undefined,
    className: 'h-11 md:h-9',
  });
  const selectClass = 'h-11 rounded-md border bg-background px-3 text-sm md:h-9';

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Birth stays</CardTitle>
          <CardDescription>Admissions, deliveries, discharges and transfers at the clinic, for the monthly report.</CardDescription>
        </div>
        <Button type="button" size="sm" className="min-h-11 shrink-0 gap-1.5 md:min-h-8" onClick={() => openForm('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add stay
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loadError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {stays === null && !loadError && <p className="text-sm text-muted-foreground">Loading…</p>}
        {stays?.length === 0 && <p className="text-sm text-muted-foreground">No stays recorded.</p>}
        <ul className="divide-y">
          {stays?.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">{summary(s)}</p>
                <p className="text-xs text-muted-foreground">Admitted {shown(s.admittedAt)}</p>
                {s.deliveredAt !== null && <p className="text-xs text-muted-foreground">Delivered {shown(s.deliveredAt)}</p>}
                <p className="text-xs text-muted-foreground">
                  {s.dischargedAt !== null ? `Discharged ${shown(s.dischargedAt)}` : 'No discharge recorded'}
                  {s.transferredAt !== null && ` · Transferred to CDH ${shown(s.transferredAt)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon-sm" className="size-11 md:size-8" aria-label="Edit stay" onClick={() => openForm(s)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" className="size-11 text-destructive md:size-8" aria-label="Delete stay" onClick={() => setDeleting(s)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && !busy && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add birth stay' : 'Edit birth stay'}</DialogTitle>
            <DialogDescription>
              {patientName}. Philippine date and time. Twins: add one stay per newborn with the same admission and delivery time; they count as one delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('admittedAt', 'Admitted', <Input type="datetime-local" {...inputProps('admittedAt')} />)}
            {field('deliveredAt', 'Delivered (optional)', <Input type="datetime-local" {...inputProps('deliveredAt')} />)}
            {field('outcome', 'Outcome', (
              <select {...inputProps('outcome')} className={selectClass}>
                <option value="">Not delivered</option>
                <option value="live">Live birth</option>
                <option value="stillbirth">Stillbirth</option>
              </select>
            ))}
            {field('babySex', 'Baby (live birth)', (
              <select {...inputProps('babySex')} className={selectClass}>
                <option value="">-</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            ))}
            {field('birthWeightG', 'Birth weight, g (optional)', <Input inputMode="numeric" {...inputProps('birthWeightG')} />)}
            {field('birthLengthCm', 'Birth length, cm (optional)', <Input inputMode="decimal" {...inputProps('birthLengthCm')} />)}
            {field('dischargedAt', 'Discharged (optional)', <Input type="datetime-local" {...inputProps('dischargedAt')} />)}
            {field('transferredAt', 'Transferred to CDH (optional)', <Input type="datetime-local" {...inputProps('transferredAt')} />)}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="button" className="min-h-11 gap-2 md:min-h-9" disabled={busy} aria-busy={busy} onClick={save}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this stay?</DialogTitle>
            <DialogDescription>It will no longer count in the monthly report. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
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

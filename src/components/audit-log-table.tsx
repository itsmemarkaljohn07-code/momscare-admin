'use client';

import { useRef, useState } from 'react';
import { Download, ScrollText, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { LoadMoreButton } from '@/components/load-more';
import { exportToCsv } from '@/lib/export-csv';
import { formatRelativeTime } from '@/lib/format-relative-time';
import type { AuditLogPage, AuditLogView } from '@/lib/get-audit-logs';

const ACTION_LABELS: Record<string, string> = {
  'appointment.approve': 'Approved appointment',
  'appointment.decline': 'Declined appointment',
  'appointment.status_change': 'Changed appointment status',
  'appointment.edit': 'Edited appointment',
  'appointment.delete': 'Deleted appointment',
  'appointment.cancel_approve': 'Approved cancellation request',
  'appointment.cancel_decline': 'Declined cancellation request',
  'appointment.cancel_request': 'Requested cancellation (patient)',
  'appointment.cancel_withdraw': 'Withdrew cancellation request (patient)',
  'appointment_request.create': 'Sent appointment request (patient)',
  'appointment_request.withdraw': 'Withdrew appointment request (patient)',
  'appointment_request.schedule': 'Scheduled appointment request',
  'appointment_request.decline': 'Declined appointment request',
  'clinical_note.create': 'Added clinical note',
  'clinical_note.delete': 'Deleted clinical note',
  'doctor.create': 'Added doctor',
  'doctor.create_account': 'Created doctor account',
  'doctor.setup_login': 'Set up doctor login',
  'doctor.reset_login': 'Reset doctor login',
  'doctor.update': 'Updated doctor',
  'doctor.delete': 'Removed doctor',
  'user.suspend': 'Suspended patient account',
  'user.reactivate': 'Reactivated patient account',
  'user.delete': 'Permanently deleted patient account',
  'user.delete_incomplete': 'Partly deleted patient account (retry needed)',
  'admin.remove_access': 'Removed admin access',
  'report.patient_export': 'Exported patient report (PDF)',
};

interface Group {
  label: string;
  /** Restrained tint: light background, readable text, in both themes. */
  badge: string;
}

const GROUPS: Record<string, Group> = {
  appointment: { label: 'Appointment', badge: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900' },
  appointment_request: { label: 'Request', badge: 'bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900' },
  clinical_note: { label: 'Clinical note', badge: 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900' },
  doctor: { label: 'Doctor', badge: 'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900' },
  user: { label: 'Patient', badge: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900' },
  admin: { label: 'Admin', badge: 'bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700' },
  report: { label: 'Report', badge: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900' },
};
const OTHER: Group = { label: 'Other', badge: 'bg-muted text-muted-foreground ring-border' };

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function groupOf(action: string): Group {
  return GROUPS[action.split('.')[0]] ?? OTHER;
}

/** "Oct 18, 2026, 9:05 AM" in Manila time. */
function manilaTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function GroupBadge({ action }: { action: string }) {
  const g = groupOf(action);
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${g.badge}`}>
      {g.label}
    </span>
  );
}

interface Filters {
  q: string;
  action: string;
  role: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { q: '', action: 'all', role: 'all', from: '', to: '' };
const SEARCH_DEBOUNCE_MS = 350;

const ACTION_GROUPS = Object.keys(GROUPS).map((key) => ({
  key,
  label: GROUPS[key].label,
  actions: Object.keys(ACTION_LABELS).filter((a) => a.split('.')[0] === key),
}));

function toQuery(f: Filters, cursor: string | null): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.action !== 'all') p.set('action', f.action);
  if (f.role !== 'all') p.set('role', f.role);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (cursor) p.set('cursor', cursor);
  return p.toString();
}

export function AuditLogTable({ initial }: { initial: AuditLogPage }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [entries, setEntries] = useState<AuditLogView[]>(initial.entries);
  const [cursor, setCursor] = useState<string | null>(initial.cursor);
  const [loading, setLoading] = useState<'reload' | 'more' | null>(null);
  const [error, setError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the newest request may update the list (filters can change
  // while an older request is still in flight).
  const requestSeq = useRef(0);

  async function load(f: Filters, from: string | null, mode: 'reload' | 'more') {
    const seq = ++requestSeq.current;
    setLoading(mode);
    setError('');
    try {
      const res = await fetch(`/api/admin/audit-log?${toQuery(f, from)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as AuditLogPage;
      if (seq !== requestSeq.current) return;
      setEntries((prev) => (mode === 'more' ? [...prev, ...page.entries] : page.entries));
      setCursor(page.cursor);
    } catch {
      if (seq === requestSeq.current) setError('Couldn’t load the audit log. Please try again.');
    } finally {
      if (seq === requestSeq.current) setLoading(null);
    }
  }

  function update(patch: Partial<Filters>, debounce = false) {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (debounce) {
      searchTimer.current = setTimeout(() => void load(next, null, 'reload'), SEARCH_DEBOUNCE_MS);
    } else {
      void load(next, null, 'reload');
    }
  }

  const filtered =
    filters.q.trim() !== '' || filters.action !== 'all' || filters.role !== 'all' || filters.from !== '' || filters.to !== '';

  function handleExport() {
    exportToCsv(
      `audit-log-${new Date().toISOString().slice(0, 10)}`,
      ['When (Manila)', 'Actor', 'Role', 'Action', 'Target', 'Details'],
      entries.map((l) => [manilaTime(l.createdAt), l.actorEmail, l.actorRole, actionLabel(l.action), l.targetLabel, l.details ?? ''])
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border p-3 sm:p-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search by actor or target"
            placeholder="Search actor or target…"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value }, true)}
            className="rounded-full pl-10"
          />
        </div>

        <Select value={filters.action} onValueChange={(v) => update({ action: v ?? 'all' })}>
          <SelectTrigger className="w-full" aria-label="Filter by action">
            <SelectValue>{filters.action === 'all' ? 'All actions' : actionLabel(filters.action)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_GROUPS.map((g) => (
              <SelectGroup key={g.key}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.actions.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.role} onValueChange={(v) => update({ role: v ?? 'all' })}>
          <SelectTrigger className="w-full" aria-label="Filter by role">
            <SelectValue>{filters.role === 'all' ? 'All roles' : filters.role === 'admin' ? 'Admin' : filters.role === 'doctor' ? 'Doctor' : 'Patient'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="doctor">Doctor</SelectItem>
            <SelectItem value="patient">Patient</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={handleExport}
          disabled={entries.length === 0}
          title="Exports the entries currently loaded"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </Button>

        <div className="flex flex-wrap items-end gap-3 lg:col-span-4">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            From
            <Input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => update({ from: e.target.value })}
              className="w-40"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            To
            <Input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => update({ to: e.target.value })}
              className="w-40"
            />
          </label>
          {filtered && (
            <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => update(EMPTY)}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </Button>
          )}
          <p className="ml-auto text-xs text-muted-foreground">Times are Manila time. Entries can&apos;t be edited or deleted.</p>
        </div>
      </div>

      <div aria-live="polite">
        {error && (
          <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>
        )}
      </div>

      <div className={loading === 'reload' ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading === 'reload'}>
        {entries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <ScrollText className="h-8 w-8" aria-hidden="true" />
              <p className="text-sm">
                {loading === 'reload' ? 'Loading…' : filtered ? 'No entries match these filters.' : 'No audit entries yet.'}
              </p>
              {filtered && cursor && !loading && (
                <p className="text-xs">Older entries haven&apos;t been searched yet. Use Load more to keep looking.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 640px and up */}
            <div className="hidden overflow-x-auto rounded-2xl border shadow-soft sm:block">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">When</TableHead>
                    <TableHead className="w-52 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actor</TableHead>
                    <TableHead className="w-64 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target &amp; details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((l) => (
                    <TableRow key={l.id} className="align-top">
                      <TableCell className="whitespace-normal text-sm" title={formatRelativeTime(l.createdAt)}>
                        {manilaTime(l.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <p className="break-all text-sm font-medium">{l.actorEmail}</p>
                        <p className="text-xs capitalize text-muted-foreground">{l.actorRole || '—'}</p>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col items-start gap-1">
                          <GroupBadge action={l.action} />
                          <span className="text-sm">{actionLabel(l.action)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <p className="break-words text-sm">{l.targetLabel}</p>
                        {l.details && <p className="mt-0.5 break-words text-xs text-muted-foreground">{l.details}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Under 640px */}
            <ul className="space-y-3 sm:hidden">
              {entries.map((l) => (
                <li key={l.id}>
                  <Card className="rounded-2xl shadow-soft">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <GroupBadge action={l.action} />
                        <span className="text-right text-xs text-muted-foreground">{manilaTime(l.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium">{actionLabel(l.action)}</p>
                      <p className="break-words text-sm">{l.targetLabel}</p>
                      {l.details && <p className="break-words text-xs text-muted-foreground">{l.details}</p>}
                      <p className="break-all text-xs text-muted-foreground">
                        {l.actorEmail} · <span className="capitalize">{l.actorRole || '—'}</span>
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <LoadMoreButton
        hasMore={cursor !== null}
        loading={loading === 'more'}
        onClick={() => void load(filters, cursor, 'more')}
      />
    </div>
  );
}

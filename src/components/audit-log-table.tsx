'use client';

import { useMemo, useState } from 'react';
import { Download, ScrollText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { exportToCsv } from '@/lib/export-csv';
import { formatRelativeTime } from '@/lib/format-relative-time';
import type { AuditLogView } from '@/lib/get-audit-logs';

const ACTION_LABELS: Record<string, string> = {
  'doctor.create_account': 'Created doctor account',
  'doctor.setup_login': 'Set up doctor login',
  'doctor.reset_login': 'Reset doctor login',
  'appointment.approve': 'Approved appointment',
  'appointment.decline': 'Declined appointment',
  'clinical_note.create': 'Added clinical note',
  'clinical_note.delete': 'Deleted clinical note',
  'doctor.create': 'Added doctor',
  'doctor.update': 'Updated doctor',
  'doctor.delete': 'Removed doctor',
  'admin.remove_access': 'Removed admin access',
  'appointment.status_change': 'Changed appointment status',
  'appointment.edit': 'Edited appointment',
  'appointment.delete': 'Deleted appointment',
  'user.suspend': 'Suspended patient account',
  'user.reactivate': 'Reactivated patient account',
  'user.delete': 'Permanently deleted patient account',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function AuditLogTable({ logs }: { logs: AuditLogView[] }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (roleFilter !== 'all' && l.actorRole !== roleFilter) return false;
      if (!q) return true;
      return (
        l.actorEmail.toLowerCase().includes(q) ||
        l.targetLabel.toLowerCase().includes(q) ||
        actionLabel(l.action).toLowerCase().includes(q) ||
        (l.details ?? '').toLowerCase().includes(q)
      );
    });
  }, [logs, query, roleFilter]);

  function handleExport() {
    exportToCsv(
      `audit-log-${new Date().toISOString().slice(0, 10)}`,
      ['When', 'Actor', 'Role', 'Action', 'Target', 'Details'],
      filtered.map((l) => [
        l.createdAt ? new Date(l.createdAt).toLocaleString() : '',
        l.actorEmail,
        l.actorRole,
        actionLabel(l.action),
        l.targetLabel,
        l.details ?? '',
      ])
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by actor, action, or target..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm rounded-full"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? 'all')}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="doctor">Doctor</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ScrollText className="h-8 w-8" />
            <p className="text-sm">No audit entries match.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto rounded-2xl border shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actor</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatRelativeTime(l.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{l.actorEmail}</p>
                      <p className="text-xs capitalize text-muted-foreground">{l.actorRole}</p>
                    </TableCell>
                    <TableCell className="text-sm">{actionLabel(l.action)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm" title={l.targetLabel}>
                      {l.targetLabel}
                    </TableCell>
                    <TableCell
                      className="max-w-[240px] whitespace-normal break-words text-xs text-muted-foreground"
                      title={l.details ?? undefined}
                    >
                      {l.details ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((l) => (
              <Card key={l.id} className="rounded-2xl shadow-soft">
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{actionLabel(l.action)}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(l.createdAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.actorEmail} · <span className="capitalize">{l.actorRole}</span>
                  </p>
                  <p className="truncate text-sm">{l.targetLabel}</p>
                  {l.details && (
                    <p className="whitespace-normal break-words text-xs text-muted-foreground">
                      {l.details}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
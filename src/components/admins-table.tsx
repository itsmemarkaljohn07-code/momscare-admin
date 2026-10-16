'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldOff, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddAdminDialog } from '@/components/add-admin-dialog';
import type { AdminView } from '@/lib/get-admins';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { showApiError } from '@/lib/error-messages';
import { formatRelativeTime } from '@/lib/format-relative-time';

export function AdminsTable({
  admins,
  currentUid,
}: {
  admins: AdminView[];
  currentUid: string;
}) {
  const router = useRouter();
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [confirmUid, setConfirmUid] = useState<string | null>(null);

  async function handleRemove(uid: string) {
    setConfirmUid(null);
    setPendingUid(uid);
    try {
      const res = await fetch(`/api/admin/${uid}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'remove admin access');
        return;
      }
      toast.success('Admin access removed.');
      router.refresh();
    } catch (err) {
      showApiError(null, null, err, 'remove admin access');
    } finally {
      setPendingUid(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddAdminDialog />
      </div>

      {admins.length === 0 ? (
        <EmptyState icon={ShieldOff} title="No admins found" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.uid} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarStyle(a.uid).bg} ${getAvatarStyle(a.uid).text}`}
                        >
                          {getInitials(a.email ?? '?')}
                        </span>
                        {a.email}
                        {a.uid === currentUid && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Admin</Badge>
                    </TableCell>
                    <TableCell>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(a.lastSignInTime)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/admins/${a.uid}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                        {/* Destructive action revealed on hovering the
                            chevron, same as the Patients table. */}
                        {a.uid !== currentUid && (
                          <div className="group/expand flex items-center gap-1">
                            <ChevronRight className="h-4 w-4 shrink-0 cursor-default text-muted-foreground transition-transform duration-200 group-hover/expand:translate-x-0.5" />
                            <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover/expand:max-w-[140px] group-hover/expand:opacity-100">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={pendingUid === a.uid}
                                onClick={() => setConfirmUid(a.uid)}
                              >
                                Remove Access
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked cards */}
          <div className="grid gap-3 md:hidden">
            {admins.map((a) => (
              <Card key={a.uid} className="rounded-2xl shadow-soft transition-shadow hover:shadow-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarStyle(a.uid).bg} ${getAvatarStyle(a.uid).text}`}
                    >
                      {getInitials(a.email ?? '?')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">
                        {a.email}{' '}
                        {a.uid === currentUid && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge variant="secondary" className="shrink-0 text-[10px]">Admin</Badge>
                        <p className="truncate text-xs text-muted-foreground">
                          Added {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last active: {formatRelativeTime(a.lastSignInTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                    <Link
                      href={`/admin/admins/${a.uid}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View
                    </Link>
                    {a.uid !== currentUid && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingUid === a.uid}
                        onClick={() => setConfirmUid(a.uid)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!confirmUid} onOpenChange={(open) => !open && setConfirmUid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove admin access?</AlertDialogTitle>
            <AlertDialogDescription>
              Their login account itself will not be deleted — only their dashboard access is revoked.
              This can be undone by adding them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" onClick={() => confirmUid && handleRemove(confirmUid)}>
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
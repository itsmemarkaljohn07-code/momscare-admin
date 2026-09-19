'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UserX, AlertTriangle, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { EmptyState } from '@/components/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminUserView } from '@/lib/get-users';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

export function UsersTable({ users }: { users: AdminUserView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<AdminUserView | null>(null);

  // ── Permanent delete flow (separate, two-step, typed confirmation) ──
  const [deleteStep, setDeleteStep] = useState<1 | 2 | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserView | null>(null);
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q)
    );
  });

  async function toggleDisabled(uid: string, currentlyDisabled: boolean) {
    setConfirmUser(null);
    setPendingUid(uid);
    try {
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !currentlyDisabled }),
      });
      if (res.ok) {
        toast.success(currentlyDisabled ? 'Account reactivated.' : 'Account suspended.');
        router.refresh();
      } else {
        toast.error('Failed to update account status.');
      }
    } finally {
      setPendingUid(null);
    }
  }

  function startDelete(user: AdminUserView) {
    setDeleteTarget(user);
    setTypedName('');
    setDeleteStep(1);
  }

  function closeDeleteFlow() {
    setDeleteStep(null);
    setDeleteTarget(null);
    setTypedName('');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.uid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: typedName }),
      });
      if (res.ok) {
        toast.success('Account permanently deleted.');
        closeDeleteFlow();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete account.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserX}
          title="No users found"
          description={query ? 'Try a different search term.' : 'No registered accounts yet.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.uid} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarStyle(u.uid).bg} ${getAvatarStyle(u.uid).text}`}
                        >
                          {getInitials(u.fullName)}
                        </span>
                        {u.fullName}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.username ? (
                        <span className="font-mono text-sm">{u.username}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Patient</Badge>
                    </TableCell>
                    <TableCell>{u.dueDate ?? '—'}</TableCell>
                    <TableCell>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.disabled ? 'destructive' : 'secondary'}>
                        {u.disabled ? 'Suspended' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${u.uid}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pendingUid === u.uid}
                          onClick={() => setConfirmUser(u)}
                        >
                          {u.disabled ? 'Reactivate' : 'Suspend'}
                        </Button>

                        {/* Delete only reveals when hovering THIS control
                            (the chevron/expand affordance), not the row —
                            a separate named group scoped to just this pair. */}
                        <div className="group/expand flex items-center gap-1">
                          <ChevronRight className="h-4 w-4 shrink-0 cursor-default text-muted-foreground transition-transform duration-200 group-hover/expand:translate-x-0.5" />
                          <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover/expand:max-w-[80px] group-hover/expand:opacity-100">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => startDelete(u)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked cards — Delete is already an explicit,
              always-visible button here, so no hover interaction to fix. */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((u) => (
              <Card key={u.uid} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarStyle(u.uid).bg} ${getAvatarStyle(u.uid).text}`}
                      >
                        {getInitials(u.fullName)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{u.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                          <Badge variant="secondary" className="shrink-0 text-[10px]">Patient</Badge>
                          {u.username ? (
                            <span className="truncate font-mono text-muted-foreground">@{u.username}</span>
                          ) : (
                            <span className="truncate text-muted-foreground">Username not set</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant={u.disabled ? 'destructive' : 'secondary'} className="shrink-0">
                      {u.disabled ? 'Suspended' : 'Active'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">Due: {u.dueDate ?? '—'}</span>
                    <span className="shrink-0">
                      Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <Link
                      href={`/admin/users/${u.uid}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View Profile
                    </Link>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingUid === u.uid}
                        onClick={() => setConfirmUser(u)}
                      >
                        {u.disabled ? 'Reactivate' : 'Suspend'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                        onClick={() => startDelete(u)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Suspend / Reactivate confirmation — unchanged */}
      <AlertDialog open={!!confirmUser} onOpenChange={(open) => !open && setConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmUser?.disabled ? 'Reactivate this account?' : 'Suspend this account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser?.disabled
                ? `${confirmUser?.fullName} will regain access to the MomsCare app.`
                : `${confirmUser?.fullName} will be unable to sign in until reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmUser && toggleDisabled(confirmUser.uid, confirmUser.disabled)}
            >
              {confirmUser?.disabled ? 'Reactivate' : 'Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete — Step 1: what will be removed */}
      <Dialog open={deleteStep === 1} onOpenChange={(open) => !open && closeDeleteFlow()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently and irreversibly delete <strong>{deleteTarget?.fullName}</strong>&apos;s
              entire account, including:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Their login account (they will no longer be able to sign in)</li>
            <li>Profile and pregnancy information</li>
            <li>Health Tracker records and history</li>
            <li>Snapshot photos and their metadata</li>
            <li>All comments and replies on their photos</li>
            <li>All appointment records</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            This cannot be undone. Consider Suspend instead if you just need to block their access.
          </p>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setDeleteStep(2)}
          >
            I understand, continue
          </Button>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete — Step 2: typed-name confirmation */}
      <Dialog open={deleteStep === 2} onOpenChange={(open) => !open && closeDeleteFlow()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Final Confirmation</DialogTitle>
            <DialogDescription>
              Type <strong>{deleteTarget?.fullName}</strong> exactly to confirm permanent deletion.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={deleteTarget?.fullName}
            autoFocus
          />
          <Button
            variant="destructive"
            className="w-full"
            disabled={isDeleting || typedName.trim() !== deleteTarget?.fullName.trim()}
            onClick={confirmDelete}
          >
            {isDeleting ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
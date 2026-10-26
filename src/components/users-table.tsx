'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UserX, AlertTriangle, Download, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { EmptyState } from '@/components/empty-state';
import { LoadMoreButton } from '@/components/load-more';
import { useLoadMore } from '@/hooks/use-load-more';
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
import { showApiError } from '@/lib/error-messages';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { exportToCsv } from '@/lib/export-csv';
import { matchesName } from '@/lib/patient-name';
import type { DeletionPreview, DeletionResult, StepName, StepStatus } from '@/lib/patient-deletion';

const COLLECTION_LABELS: Record<string, string> = {
  appointments: 'Appointments',
  snapshots: 'Snapshot records',
  health: 'Health tracker records',
  healthLogs: 'Health log entries',
  checklist: 'Checklist items',
  notifications: 'Notifications',
  clinicalNotes: 'Clinical notes',
  stays: 'Birth stays',
};

const STEP_LABELS: Record<StepName, string> = {
  disable_login: 'Disable sign-in and revoke sessions',
  read_data: 'Read username and photo IDs',
  cloudinary_images: 'Delete photos on Cloudinary',
  firestore_data: 'Delete profile and all records',
  username: 'Release username',
  audit_history: 'Anonymise past audit entries',
  login_account: 'Delete login account',
  audit_entry: 'Record audit entry',
};

const STATUS_LABELS: Record<StepStatus, string> = {
  done: 'Done',
  already_gone: 'Already gone',
  skipped: 'Skipped',
  failed: 'Failed',
};

export function UsersTable({ users }: { users: AdminUserView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<AdminUserView | null>(null);

  // ── Permanent delete flow: 1 preview → 2 typed confirmation → 3 result ──
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3 | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserView | null>(null);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [typedConfirm, setTypedConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeletionResult | null>(null);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      matchesName({ first: u.firstName, middle: u.middleName, last: u.lastName, full: u.fullName }, query) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q)
    );
  });
  // 20 rows at a time; a new search starts from the first 20.
  const page = useLoadMore(filtered, 20, query.trim().toLowerCase());

  /** This patient is being suspended/reactivated or deleted right now. */
  const busyUid = (uid: string) => pendingUid === uid || (isDeleting && deleteTarget?.uid === uid);

  async function toggleDisabled(uid: string, currentlyDisabled: boolean) {
    setConfirmUser(null);
    setPendingUid(uid);
    try {
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !currentlyDisabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'suspend/reactivate account');
        return;
      }
      toast.success(currentlyDisabled ? 'Account reactivated.' : 'Account suspended.');
      router.refresh();
    } catch (err) {
      showApiError(null, null, err, 'suspend/reactivate account');
    } finally {
      setPendingUid(null);
    }
  }

  async function loadPreview(uid: string): Promise<DeletionPreview | null> {
    setPreview(null);
    setPreviewError(null);
    try {
      const res = await fetch(`/api/users/${uid}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPreviewError(data?.error ?? 'Could not load what will be deleted.');
        return null;
      }
      setPreview(data as DeletionPreview);
      return data as DeletionPreview;
    } catch {
      setPreviewError('Could not load what will be deleted. Check your connection and try again.');
      return null;
    }
  }

  function startDelete(user: AdminUserView) {
    setDeleteTarget(user);
    setTypedConfirm('');
    setDeleteResult(null);
    setDeleteStep(1);
    void loadPreview(user.uid);
  }

  function closeDeleteFlow() {
    // Anything may have changed if a deletion ran, even partly.
    if (deleteResult) router.refresh();
    setDeleteStep(null);
    setDeleteTarget(null);
    setPreview(null);
    setPreviewError(null);
    setTypedConfirm('');
    setDeleteResult(null);
  }

  const confirmMatches =
    !!preview?.confirmValue &&
    typedConfirm.trim().toLowerCase() === preview.confirmValue.trim().toLowerCase();

  async function runDelete(uid: string, confirmValue: string) {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${uid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmValue }),
      });
      const data = await res.json().catch(() => null);

      if (data && Array.isArray(data.steps)) {
        setDeleteResult(data as DeletionResult);
        setDeleteStep(3);
        if (data.ok) toast.success('Patient account deleted.');
        else toast.error('Deletion did not finish. See which steps failed and retry.');
        return;
      }
      if (res.status === 404) {
        toast.success('Nothing left to delete for this account.');
        closeDeleteFlow();
        router.refresh();
        return;
      }
      showApiError(res, data, undefined, 'delete account');
    } catch (err) {
      showApiError(null, null, err, 'delete account');
    } finally {
      setIsDeleting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !confirmMatches) return;
    await runDelete(deleteTarget.uid, typedConfirm);
  }

  /** Retry after a partial failure. A previous run may have removed the
   *  username, so re-read what the patient is now confirmed by; if the
   *  value typed earlier no longer applies, ask again. */
  async function retryDelete() {
    if (!deleteTarget) return;
    const fresh = await loadPreview(deleteTarget.uid);
    if (!fresh) {
      setDeleteStep(1);
      return;
    }
    if (!fresh.confirmValue) {
      toast.success('Nothing left to delete for this account.');
      closeDeleteFlow();
      router.refresh();
      return;
    }
    if (typedConfirm.trim().toLowerCase() === fresh.confirmValue.trim().toLowerCase()) {
      await runDelete(deleteTarget.uid, typedConfirm);
    } else {
      setTypedConfirm('');
      setDeleteStep(2);
    }
  }

  async function copyPublicIds(ids: string[]) {
    try {
      await navigator.clipboard.writeText(ids.join('\n'));
      toast.success('Public IDs copied.');
    } catch {
      toast.error('Could not copy. Select the list and copy it manually.');
    }
  }

  function handleExport() {
    exportToCsv(
      `patients-${new Date().toISOString().slice(0, 10)}`,
      ['Full Name', 'Username', 'Email', 'Due Date', 'Signed Up', 'Last Active', 'Status'],
      filtered.map((u) => [
        u.fullName,
        u.username ?? '',
        u.email ?? '',
        u.dueDate ?? '',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
        formatRelativeTime(u.lastSignInTime),
        u.disabled ? 'Suspended' : 'Active',
      ])
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm rounded-full"
        />
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserX}
          title="No users found"
          description={query ? 'Try a different search term.' : 'No registered accounts yet.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signed Up</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Active</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.visible.map((u) => (
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
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(u.lastSignInTime)}
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

                        {/* Always visible, its own hit area. (It used to sit
                            in a zero-width, transparent box that only opened
                            while hovering a small arrow, so a click on the
                            arrow did nothing and the keyboard could reach an
                            invisible button.) */}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busyUid(u.uid)}
                          onClick={() => startDelete(u)}
                          aria-label={`Delete ${u.fullName}`}
                        >
                          Delete
                        </Button>
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
            {page.visible.map((u) => (
              <Card key={u.uid} className="rounded-2xl shadow-soft transition-shadow hover:shadow-card">
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
                  <p className="text-xs text-muted-foreground">
                    Last active: {formatRelativeTime(u.lastSignInTime)}
                  </p>

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
                        variant="destructive"
                        size="sm"
                        disabled={busyUid(u.uid)}
                        onClick={() => startDelete(u)}
                        aria-label={`Delete ${u.fullName}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <LoadMoreButton hasMore={page.hasMore} onClick={page.loadMore} shown={page.shown} total={page.total} />
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
                ? `${confirmUser?.fullName} will regain access to the MomCare app.`
                : `${confirmUser?.fullName} will be unable to sign in until reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmUser?.disabled ? 'default' : 'destructive-solid'}
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
              entire account. The following will be removed:
            </DialogDescription>
          </DialogHeader>

          {previewError ? (
            <div className="space-y-2">
              <p className="text-sm text-red-600">{previewError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteTarget && loadPreview(deleteTarget.uid)}
              >
                Try again
              </Button>
            </div>
          ) : !preview ? (
            <p className="text-sm text-muted-foreground">Counting records…</p>
          ) : (
            <>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Login account:{' '}
                  {preview.authExists ? 'sign-in disabled, then deleted' : 'already deleted'}
                </li>
                <li>
                  Profile and pregnancy information:{' '}
                  {preview.profileExists ? '1 document' : 'already deleted'}
                </li>
                {preview.collections.map((c) => (
                  <li key={c.name}>
                    {COLLECTION_LABELS[c.name] ?? c.name}: {c.count}
                  </li>
                ))}
                <li>Comments on photos: {preview.comments}</li>
                <li>
                  Photos on Cloudinary: {preview.photos}
                  {preview.photos > 0 &&
                    (preview.cloudinaryConfigured
                      ? ' (deleted and purged from the CDN)'
                      : ' (must be deleted manually; their IDs are listed afterwards)')}
                </li>
                <li>Username record: {preview.usernames.length > 0 ? preview.usernames.join(', ') : 'none'}</li>
                <li>Past audit entries naming this patient: {preview.auditEntries} (name removed, entry kept)</li>
              </ul>
              {!preview.confirmBy && (
                <p className="text-sm text-muted-foreground">Nothing identifying is left for this account.</p>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground">
            This cannot be undone. Consider Suspend instead if you just need to block their access.
          </p>
          <Button
            variant="destructive"
            className="w-full"
            disabled={!preview?.confirmBy}
            onClick={() => setDeleteStep(2)}
          >
            I understand, continue
          </Button>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete — Step 2: typed username (or email) confirmation */}
      <Dialog open={deleteStep === 2} onOpenChange={(open) => !open && closeDeleteFlow()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Final Confirmation</DialogTitle>
            <DialogDescription>
              {preview?.confirmBy === 'email'
                ? 'This patient has no username. Type their email address '
                : "Type the patient's username "}
              <strong className="break-all">{preview?.confirmValue}</strong> to confirm permanent deletion.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={typedConfirm}
            onChange={(e) => setTypedConfirm(e.target.value)}
            placeholder={preview?.confirmBy === 'email' ? 'Email address' : 'Username'}
            autoComplete="off"
            autoFocus
          />
          <Button
            variant="destructive-solid"
            className="w-full"
            disabled={isDeleting || !confirmMatches}
            onClick={confirmDelete}
          >
            {isDeleting ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete — Step 3: per-step result, retry, manual Cloudinary IDs */}
      <Dialog open={deleteStep === 3} onOpenChange={(open) => !open && closeDeleteFlow()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={deleteResult?.ok ? undefined : 'text-red-600'}>
              {deleteResult?.ok ? 'Deletion finished' : 'Deletion did not finish'}
            </DialogTitle>
            <DialogDescription>
              {deleteResult?.ok
                ? 'Every step completed or was already done.'
                : 'Steps that finished are kept. Retry to complete the rest.'}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {deleteResult?.steps.map((s) => (
              <li key={s.step} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p>{STEP_LABELS[s.step] ?? s.step}</p>
                  {s.detail && <p className="break-words text-xs text-muted-foreground">{s.detail}</p>}
                </div>
                <Badge
                  variant={s.status === 'failed' ? 'destructive' : 'secondary'}
                  className="shrink-0"
                >
                  {STATUS_LABELS[s.status]}
                </Badge>
              </li>
            ))}
          </ul>

          {deleteResult?.manualCloudinaryPublicIds && deleteResult.manualCloudinaryPublicIds.length > 0 && (
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Delete these {deleteResult.manualCloudinaryPublicIds.length} image(s) in the Cloudinary Media Library
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => copyPublicIds(deleteResult.manualCloudinaryPublicIds ?? [])}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <ul className="max-h-40 overflow-y-auto font-mono text-xs text-muted-foreground">
                {deleteResult.manualCloudinaryPublicIds.map((id) => (
                  <li key={id} className="break-all">{id}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Save this list: once the patient&apos;s records are deleted, these IDs can&apos;t be looked up again.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {!deleteResult?.ok && (
              <Button variant="destructive" className="flex-1" disabled={isDeleting} onClick={retryDelete}>
                {isDeleting ? 'Retrying...' : 'Retry'}
              </Button>
            )}
            <Button variant="outline" className="flex-1" disabled={isDeleting} onClick={closeDeleteFlow}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
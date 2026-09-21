'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { AdminView } from '@/lib/get-admins';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { getApiErrorMessage, showApiError } from '@/lib/error-messages';
import { formatRelativeTime } from '@/lib/format-relative-time';

export function AdminsTable({
  admins,
  currentUid,
}: {
  admins: AdminView[];
  currentUid: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [confirmUid, setConfirmUid] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(getApiErrorMessage(res, data, undefined, 'create admin').description);
        setIsSaving(false);
        return;
      }

      toast.success('Admin created.');
      setOpen(false);
      setEmail('');
      setPassword('');
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(null, null, err, 'create admin').description);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(uid: string) {
    setConfirmUid(null);
    setPendingUid(uid);
    try {
      const res = await fetch(`/api/admins/${uid}`, { method: 'DELETE' });
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>+ Add Admin</Button>} />
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Temporary Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  At least 6 characters. Share this with them securely — they can change it
                  after signing in.
                </p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create Admin'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {admins.length === 0 ? (
        <EmptyState icon={ShieldOff} title="No admins found" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Last Active</TableHead>
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
                        {a.uid !== currentUid && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pendingUid === a.uid}
                            onClick={() => setConfirmUid(a.uid)}
                          >
                            Remove Access
                          </Button>
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
              <Card key={a.uid} className="transition-shadow hover:shadow-md">
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
            <AlertDialogAction onClick={() => confirmUid && handleRemove(confirmUid)}>
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
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

export function UsersTable({ users }: { users: AdminUserView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<AdminUserView | null>(null);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
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

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Signed Up</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.uid}>
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
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.dueDate ?? '—'}</TableCell>
                <TableCell>
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={u.disabled ? 'destructive' : 'secondary'}>
                    {u.disabled ? 'Suspended' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-2">
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
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  );
}
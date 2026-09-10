'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UserX } from 'lucide-react';
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
                  <TableHead>Email</TableHead>
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
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((u) => (
              <Card key={u.uid} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarStyle(u.uid).bg} ${getAvatarStyle(u.uid).text}`}
                      >
                        {getInitials(u.fullName)}
                      </span>
                      <div>
                        <p className="font-medium leading-tight">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <Badge variant={u.disabled ? 'destructive' : 'secondary'}>
                      {u.disabled ? 'Suspended' : 'Active'}
                    </Badge>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Due: {u.dueDate ?? '—'}</span>
                    <span>
                      Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                    <Link
                      href={`/admin/users/${u.uid}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View Profile
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

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
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminUserView } from '@/lib/get-users';

export function UsersTable({ users }: { users: AdminUserView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
  });

  async function toggleDisabled(uid: string, currentlyDisabled: boolean) {
    const action = currentlyDisabled ? 'reactivate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} this account?`)) return;

    setPendingUid(uid);
    try {
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !currentlyDisabled }),
      });
      if (res.ok) {
        router.refresh();
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
                <TableCell className="font-medium">{u.fullName}</TableCell>
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
                    onClick={() => toggleDisabled(u.uid, u.disabled)}
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
    </div>
  );
}
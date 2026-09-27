'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { Mail, CalendarDays, Radio } from 'lucide-react';
import type { AdminView } from '@/lib/get-admins';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { showFriendlyError } from '@/lib/error-messages';

export function AdminViewLive({ initial }: { initial: AdminView }) {
  const [createdAt, setCreatedAt] = useState(initial.createdAt);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, `admins/${initial.uid}`),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (data.createdAt) setCreatedAt(data.createdAt);
      },
      (error) => showFriendlyError(error, 'live admin profile sync')
    );
    return () => unsub();
  }, [initial.uid]);

  const avatarStyle = getAvatarStyle(initial.uid);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {getInitials(initial.email ?? '?')}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{initial.email}</h1>
            <p className="text-sm text-muted-foreground">Admin account</p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit shrink-0">Admin</Badge>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Account Details</CardTitle>
          <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse" style={{ color: 'var(--status-approved)' }} />
            Live
          </span>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              Email
            </span>
            <span className="font-medium">{initial.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Added
            </span>
            <span className="font-medium">
              {createdAt ? new Date(createdAt).toLocaleDateString() : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Radio className="h-4 w-4" />
              Last Active
            </span>
            <span className="font-medium">{formatRelativeTime(initial.lastSignInTime)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        Admin accounts only store an email and creation date — everything else (login itself)
        is managed through Firebase Authentication. Email refreshes when you navigate back here.
      </div>
    </>
  );
}
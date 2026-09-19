'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { CalendarDays, Baby, Heart, Building2, UserPlus, Radio, AtSign, Shield } from 'lucide-react';
import type { AdminUserView } from '@/lib/get-users';

function computeWeek(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const TOTAL_DAYS = 280;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.round((new Date(dueDate).getTime() - Date.now()) / msPerDay);
  const daysElapsed = Math.max(0, Math.min(TOTAL_DAYS, TOTAL_DAYS - daysUntilDue));
  return Math.min(40, Math.floor(daysElapsed / 7));
}

export function PatientViewLive({ initial }: { initial: AdminUserView }) {
  // Firestore profile fields (fullName, dueDate, weeksPregnant,
  // firstTimeMom, clinicName) are live. email and disabled status
  // live in Firebase Auth, which has no client onSnapshot equivalent
  // — those stay as the server-fetched initial values and refresh on
  // navigation, same as the rest of the admin dashboard already does.
  const [profile, setProfile] = useState({
    fullName: initial.fullName,
    username: initial.username,
    dueDate: initial.dueDate,
    weeksPregnant: initial.weeksPregnant,
    firstTimeMom: initial.firstTimeMom,
    clinicName: initial.clinicName,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${initial.uid}`), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      setProfile({
        fullName: data.fullName ?? '(no profile)',
        username: data.username || null,
        dueDate: data.dueDate ?? null,
        weeksPregnant: data.weeksPregnant ?? null,
        firstTimeMom: data.firstTimeMom ?? null,
        clinicName: data.clinicName ?? null,
      });
    });
    return () => unsub();
  }, [initial.uid]);

  const week = computeWeek(profile.dueDate);
  const avatarStyle = getAvatarStyle(initial.uid);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {getInitials(profile.fullName)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{profile.fullName}</h1>
            <p className="truncate text-sm text-muted-foreground">{initial.email}</p>
          </div>
        </div>
        <Badge variant={initial.disabled ? 'destructive' : 'secondary'} className="w-fit shrink-0">
          {initial.disabled ? 'Suspended' : 'Active'}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Profile</CardTitle>
          <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse" style={{ color: 'var(--status-approved)' }} />
            Live
          </span>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <AtSign className="h-4 w-4" />
              Username
            </span>
            <span className="font-medium">
              {profile.username ? profile.username : <span className="text-muted-foreground">Not set</span>}
            </span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4" />
              Role
            </span>
            <span className="font-medium">Patient</span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Due Date
            </span>
            <span className="font-medium">{profile.dueDate ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Baby className="h-4 w-4" />
              Current Week
            </span>
            <span className="font-medium">{week !== null ? `Week ${week}` : '—'}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <UserPlus className="h-4 w-4" />
              First-time Mom
            </span>
            <span className="font-medium">
              {profile.firstTimeMom === null ? '—' : profile.firstTimeMom ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Clinic
            </span>
            <span className="font-medium">{profile.clinicName || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Heart className="h-4 w-4" />
              Signed Up
            </span>
            <span className="font-medium">
              {initial.createdAt ? new Date(initial.createdAt).toLocaleDateString() : '—'}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        Health, mood, and checklist data are not shown here — this view is limited to account
        and profile information only. Profile fields update live; email and account status
        refresh when you navigate back to this page.
      </div>
    </>
  );
}
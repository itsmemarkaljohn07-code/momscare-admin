'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { CalendarDays, Baby, Heart, Building2, UserPlus, Radio, AtSign, Shield, Mail } from 'lucide-react';
import { formatClinicDate, formatDateKey } from '@/lib/pregnancy-display';
import type { AdminUserView } from '@/lib/get-users';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { showFriendlyError } from '@/lib/error-messages';
import { computePregnancyWeek } from '@/lib/compute-pregnancy-week';
import { dobKey } from '@/lib/date-of-birth';
import { PatientDobRow } from '@/components/patient-dob-editor';

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
    dob: initial.dob,
    weeksPregnant: initial.weeksPregnant,
    firstTimeMom: initial.firstTimeMom,
    clinicName: initial.clinicName,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, `users/${initial.uid}`),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        setProfile({
          fullName: data.fullName ?? '(no profile)',
          username: data.username || null,
          dueDate: data.dueDate ?? null,
          dob: dobKey(data.dob),
          weeksPregnant: data.weeksPregnant ?? null,
          firstTimeMom: data.firstTimeMom ?? null,
          clinicName: data.clinicName ?? null,
        });
      },
      (error) => showFriendlyError(error, 'live patient profile sync')
    );
    return () => unsub();
  }, [initial.uid]);

  const week = computePregnancyWeek(profile.dueDate);
  const avatarStyle = getAvatarStyle(initial.uid);
  const dueLabel = profile.dueDate
    ? formatDateKey(profile.dueDate, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {getInitials(profile.fullName)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight" title={profile.fullName}>
              {profile.fullName}
            </h1>
            <p className="truncate text-sm text-muted-foreground" title={initial.email ?? undefined}>
              {initial.email ?? 'No email on file'}
            </p>
          </div>
        </div>
        <Badge variant={initial.disabled ? 'destructive' : 'secondary'} className="w-fit shrink-0">
          {initial.disabled ? 'Suspended' : 'Active'}
        </Badge>
      </div>

      <Section title="Profile" live>
        <Row icon={AtSign} label="Username" value={profile.username} />
        <Row icon={Shield} label="Role" value="Patient" />
        <PatientDobRow uid={initial.uid} patientName={profile.fullName} dob={profile.dob} />
        <Row
          icon={Heart}
          label="Signed up"
          value={initial.createdAt ? formatClinicDate(initial.createdAt, { month: 'short', day: 'numeric', year: 'numeric' }) : null}
        />
        <Row icon={Radio} label="Last active" value={initial.lastSignInTime ? formatRelativeTime(initial.lastSignInTime) : null} />
      </Section>

      <Section title="Pregnancy">
        <Row icon={Baby} label="Current week" value={week !== null ? `Week ${week}` : null} />
        <Row
          icon={UserPlus}
          label="First-time mom"
          value={profile.firstTimeMom === null ? null : profile.firstTimeMom ? 'Yes' : 'No'}
        />
      </Section>

      <Section title="Due date">
        <Row icon={CalendarDays} label="Due date" value={dueLabel} />
      </Section>

      <Section title="Contact">
        <Row icon={Mail} label="Email" value={initial.email} />
        <Row icon={Building2} label="Clinic" value={profile.clinicName} />
      </Section>

      <p className="rounded-md border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        Health, mood and checklist data aren&apos;t shown here. Profile fields update live; email and account
        status refresh when you come back to this page.
      </p>
    </div>
  );
}

/** One titled card of read-only rows. */
function Section({ title, live = false, children }: { title: string; live?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {live && (
          <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse" style={{ color: 'var(--status-approved)' }} aria-hidden="true" />
            Live
          </span>
        )}
      </CardHeader>
      <CardContent>
        <dl>{children}</dl>
      </CardContent>
    </Card>
  );
}

/** A label and its value; an empty value reads "Not set". */
function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate text-right ${value ? 'font-medium' : 'italic text-muted-foreground'}`}
        title={value ?? undefined}
      >
        {value || 'Not set'}
      </dd>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import {
  Stethoscope, Clock, Timer, Mail, AtSign, CalendarDays, Radio, BadgeCheck, KeyRound, CalendarPlus, Image as ImageIcon, User,
} from 'lucide-react';
import type { DoctorRecord } from '@/lib/get-doctors';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { showFriendlyError } from '@/lib/error-messages';
import { DoctorFormDialog } from '@/components/doctor-form-dialog';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NOT_SET = 'Not set';

function to12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(', ');
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return NOT_SET;
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
}

/** One read-only row; an empty value shows "Not set". */
function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="flex flex-col gap-0.5 border-b py-2.5 text-sm last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className={`min-w-0 break-words sm:text-right ${empty ? 'italic text-muted-foreground' : 'font-medium'}`}>
        {empty ? NOT_SET : value}
      </dd>
    </div>
  );
}

export function DoctorViewLive({ initial }: { initial: DoctorRecord }) {
  const [doctor, setDoctor] = useState(initial);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, `doctors/${initial.id}`),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        setDoctor((prev) => ({
          id: docSnap.id,
          name: data.name,
          specialty: data.specialty,
          workingDays: data.workingDays ?? [],
          startTime: data.startTime,
          endTime: data.endTime,
          slotMinutes: data.slotMinutes,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
          authUid: data.authUid ?? null,
          loginEmail: data.loginEmail ?? null,
          username: data.username ?? null,
          photoUrl: data.photoUrl ?? null,
          title: data.title ?? null,
          lastSignInTime: prev.lastSignInTime,
        }));
      },
      (error) => showFriendlyError(error, 'live doctor profile sync')
    );
    return () => unsub();
  }, [initial.id]);

  const avatarStyle = getAvatarStyle(doctor.id);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {doctor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doctor.photoUrl} alt={doctor.name} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
            >
              {getInitials(doctor.name ?? '')}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight">{doctor.name || NOT_SET}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {[doctor.title, doctor.specialty].filter(Boolean).join(' · ') || 'Specialty not set'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={doctor.authUid ? 'secondary' : 'outline'} className="w-fit">
            {doctor.authUid ? 'Login Enabled' : 'No Login Yet'}
          </Badge>
          <DoctorFormDialog editing={doctor} trigger={<Button variant="outline" size="sm">Edit</Button>} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Profile &amp; Schedule</CardTitle>
          <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse" style={{ color: 'var(--status-approved)' }} />
            Live
          </span>
        </CardHeader>
        <CardContent>
          <dl>
            <Row icon={User} label="Full Name" value={doctor.name} />
            <Row icon={BadgeCheck} label="Title" value={doctor.title} />
            <Row icon={Stethoscope} label="Specialty" value={doctor.specialty} />
            <Row icon={CalendarDays} label="Working Days" value={formatDays(doctor.workingDays ?? [])} />
            <Row
              icon={Clock}
              label="Hours"
              value={doctor.startTime && doctor.endTime ? `${to12Hour(doctor.startTime)} – ${to12Hour(doctor.endTime)}` : null}
            />
            <Row icon={Timer} label="Slot Length" value={doctor.slotMinutes ? `${doctor.slotMinutes} min` : null} />
            <Row icon={ImageIcon} label="Profile Photo" value={doctor.photoUrl ? 'Uploaded' : null} />
            <Row icon={CalendarPlus} label="Added" value={doctor.createdAt ? formatDate(doctor.createdAt) : null} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Login Access</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Row icon={KeyRound} label="Login Account" value={doctor.authUid ? 'Enabled' : null} />
            <Row icon={AtSign} label="Username" value={doctor.username} />
            <Row icon={Mail} label="Login Email" value={doctor.loginEmail} />
            <Row
              icon={Radio}
              label="Last Active"
              value={doctor.authUid && doctor.lastSignInTime ? formatRelativeTime(doctor.lastSignInTime) : null}
            />
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

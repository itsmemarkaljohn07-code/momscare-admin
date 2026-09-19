'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { Stethoscope, Clock, Timer, Mail, AtSign, CalendarDays, Radio } from 'lucide-react';
import type { DoctorRecord } from '@/lib/get-doctors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function to12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(', ');
}

export function DoctorViewLive({ initial }: { initial: DoctorRecord }) {
  const [doctor, setDoctor] = useState(initial);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `doctors/${initial.id}`), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      setDoctor({
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
      });
    });
    return () => unsub();
  }, [initial.id]);

  const avatarStyle = getAvatarStyle(doctor.id);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {doctor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doctor.photoUrl}
              alt={doctor.name}
              className="h-14 w-14 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
            >
              {getInitials(doctor.name)}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{doctor.name}</h1>
            <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
          </div>
        </div>
        <Badge variant={doctor.authUid ? 'secondary' : 'outline'} className="w-fit">
          {doctor.authUid ? 'Login Enabled' : 'No Login Yet'}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Schedule</CardTitle>
          <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse" style={{ color: 'var(--status-approved)' }} />
            Live
          </span>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Stethoscope className="h-4 w-4" />
              Specialty
            </span>
            <span className="font-medium">{doctor.specialty}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Working Days
            </span>
            <span className="font-medium">{formatDays(doctor.workingDays) || '—'}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Hours
            </span>
            <span className="font-medium">
              {doctor.startTime && doctor.endTime
                ? `${to12Hour(doctor.startTime)} – ${to12Hour(doctor.endTime)}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Timer className="h-4 w-4" />
              Slot Length
            </span>
            <span className="font-medium">{doctor.slotMinutes ? `${doctor.slotMinutes} min` : '—'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Login Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <AtSign className="h-4 w-4" />
              Username
            </span>
            <span className="font-medium">{doctor.username ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              Recovery Email
            </span>
            <span className="font-medium">{doctor.loginEmail ?? '—'}</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
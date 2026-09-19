'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { CalendarClock, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppointmentsTable } from '@/components/appointments-table';
import { AppointmentHistoryTable } from '@/components/appointment-history-table';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { AdminUserView } from '@/lib/get-users';
import type { DoctorRecord } from '@/lib/get-doctors';

type Tab = 'active' | 'history';

export function AdminAppointmentsLive({
  users,
  doctors,
  initial,
}: {
  users: AdminUserView[];
  doctors: DoctorRecord[];
  initial: AdminAppointment[];
}) {
  const [appointments, setAppointments] = useState<Record<string, AdminAppointment>>(
    Object.fromEntries(initial.map((a) => [`${a.patientUid}/${a.id}`, a]))
  );
  const namesRef = useRef(new Map(users.map((u) => [u.uid, u.fullName])));
  const [tab, setTab] = useState<Tab>('active');

  useEffect(() => {
    // Individual per-document listeners, same reasoning as the doctor
    // dashboard's live view — a live collectionGroup QUERY can't be
    // reliably rule-verified the way individual document reads can.
    // isAdmin() already grants full access, so this is purely about
    // matching that same reliable pattern.
    const unsubs = initial.map((a) => {
      const key = `${a.patientUid}/${a.id}`;
      return onSnapshot(doc(db, `users/${a.patientUid}/appointments/${a.id}`), (docSnap) => {
        if (!docSnap.exists()) {
          setAppointments((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          return;
        }
        const data = docSnap.data();
        setAppointments((prev) => ({
          ...prev,
          [key]: {
            id: docSnap.id,
            patientUid: a.patientUid,
            patientName: namesRef.current.get(a.patientUid) ?? '(unknown patient)',
            label: data.label,
            type: data.type,
            doctor: data.doctor,
            date: data.date,
            time: data.time,
            location: data.location ?? '',
            notes: data.notes ?? '',
            icon: data.icon,
            accentColor: data.accentColor,
            status: data.status,
            doctorApproval: data.doctorApproval ?? 'pending',
            rejectionReason: data.rejectionReason,
            createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
          },
        }));
      });
    });
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = Object.values(appointments).sort((a, b) => a.date.localeCompare(b.date));

  const activeList = useMemo(() => list.filter((a) => a.status === 'upcoming'), [list]);
  const historyList = useMemo(
    () => list.filter((a) => a.status === 'completed' || a.status === 'cancelled'),
    [list]
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        <Button
          type="button"
          variant={tab === 'active' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5"
          onClick={() => setTab('active')}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Active
          <span className="ml-0.5 rounded-full bg-background/60 px-1.5 text-xs font-normal">
            {activeList.length}
          </span>
        </Button>
        <Button
          type="button"
          variant={tab === 'history' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5"
          onClick={() => setTab('history')}
        >
          <History className="h-3.5 w-3.5" />
          History
          <span className="ml-0.5 rounded-full bg-background/60 px-1.5 text-xs font-normal">
            {historyList.length}
          </span>
        </Button>
      </div>

      {tab === 'active' ? (
        <AppointmentsTable appointments={activeList} users={users} doctors={doctors} />
      ) : (
        <AppointmentHistoryTable appointments={historyList} doctors={doctors} />
      )}
    </div>
  );
}
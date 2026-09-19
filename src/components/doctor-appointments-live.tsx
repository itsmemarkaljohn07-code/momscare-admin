'use client';

import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { DoctorAppointmentsTable } from '@/components/doctor-appointments-table';
import type { DoctorAppointmentView } from '@/lib/get-doctor-appointments';

export function DoctorAppointmentsLive({
  doctorName,
  initial,
}: {
  doctorName: string;
  initial: DoctorAppointmentView[];
}) {
  const [appointments, setAppointments] = useState<Record<string, DoctorAppointmentView>>(
    Object.fromEntries(initial.map((a) => [`${a.patientUid}/${a.id}`, a]))
  );
  const namesRef = useRef(new Map(initial.map((a) => [a.patientUid, a.patientName])));

  useEffect(() => {
    // No client-side discovery query at all — `initial` already came
    // from the server (Admin SDK, bypasses rules, already correctly
    // filtered), so we just attach one live listener per already-known
    // document. This avoids Firestore's "list queries can't verify
    // custom-claim rules" limitation entirely, since every listener
    // here is an individual document read, not a query.
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
            date: data.date,
            time: data.time,
            location: data.location,
            notes: data.notes,
            status: data.status,
            doctorApproval: data.doctorApproval ?? 'pending',
            rejectionReason: data.rejectionReason,
          },
        }));
      });
    });
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = Object.values(appointments).sort((a, b) => a.date.localeCompare(b.date));
  return <DoctorAppointmentsTable appointments={list} />;
}
'use client';

import { useEffect, useRef, useState } from 'react';
import { isMissedAppointment } from '@/lib/appointment-status';

const CHECK_EVERY_MS = 60_000;

type Row = { id: string; patientUid: string; date: string; time: string; status: string };

/**
 * Keeps a list of appointments honest about the time: returns "now",
 * refreshed every minute so time-based badges and tabs move on their own,
 * and asks the server to store "missed" (and notify the patient) for any
 * appointment still upcoming 3 hours (MISSED_AFTER_MS) after it started.
 *
 * There is no scheduled server job (that would need a paid plan), so this
 * only runs while an admin or doctor has a dashboard page open; the
 * appointment is then marked the next time one is. Each appointment is
 * requested once per page; a server error is retried a minute later. The
 * server checks the time and status again, so a request can't mark or
 * notify twice.
 */
export function useMarkMissed(list: Row[]): Date {
  const [now, setNow] = useState(() => new Date());
  const requested = useRef(new Set<string>());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    for (const a of list) {
      if (a.status !== 'upcoming' || !isMissedAppointment(a, now)) continue;
      const key = `${a.patientUid}/${a.id}`;
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      fetch(`/api/appointments/${encodeURIComponent(a.patientUid)}/${encodeURIComponent(a.id)}/missed`, {
        method: 'POST',
      })
        .then((res) => {
          if (res.status >= 500) requested.current.delete(key);
        })
        .catch(() => requested.current.delete(key));
    }
  }, [list, now]);

  return now;
}

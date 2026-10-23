'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import { auth, db } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';
import { mapCancellation } from '@/lib/appointment-cancellation';
import type { DoctorAppointmentView } from '@/lib/get-doctor-appointments';

// One live list of the signed-in doctor's appointments for every doctor
// page (Overview, My Appointments, the sidebar badge). It lives in the
// doctor layout, so moving between doctor pages keeps the same listeners.
//
// The rules let a doctor's browser GET one appointment of an assigned
// patient, never list or query them. So the server list is the starting
// point and each known document gets one listener; new appointments are
// found by asking the server again (router.refresh) when the bell sees a
// new entry (the admin's "new appointment" and "on your behalf" notices
// land there), every 60 s while the tab is visible, and on returning to
// the tab.

/** The bell saw a new entry: re-read the list from the server. */
export const DOCTOR_BELL_CHANGED = 'momcare:doctor-bell-changed';
/** An appointment changed live: the bell should check for news now. */
export const DOCTOR_APPOINTMENT_CHANGED = 'momcare:doctor-appointment-changed';

const FALLBACK_REFRESH_MS = 60_000;
const VISIBILITY_REFRESH_MS = 30_000;
const EVENT_REFRESH_GAP_MS = 3_000;

type Row = DoctorAppointmentView;

const keyOf = (a: Pick<Row, 'patientUid' | 'id'>) => `${a.patientUid}/${a.id}`;
const sameDoctor = (a: unknown, b: string) => String(a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

function toDoctorView(base: Row, data: DocumentData): Row {
  return {
    id: base.id,
    patientUid: base.patientUid,
    patientName: base.patientName,
    label: data.label,
    type: data.type,
    date: data.date,
    time: data.time,
    location: data.location,
    notes: data.notes,
    status: data.status,
    doctorApproval: data.doctorApproval ?? 'pending',
    rejectionReason: data.rejectionReason,
    decidedBy: data.decidedBy?.role === 'admin' ? 'admin' : null,
    doctor: data.doctor,
    cancellation: mapCancellation(data.cancellation),
  };
}

/** Rows already live keep their newer listener data; new server rows come
 *  in; rows the server no longer lists are dropped. */
function reconcile(prev: Record<string, Row>, initial: Row[]): Record<string, Row> {
  const next: Record<string, Row> = {};
  for (const a of initial) next[keyOf(a)] = prev[keyOf(a)] ?? a;
  return next;
}

interface DoctorLive {
  appointments: Row[];
  /** A listener failed or the browser isn't signed in to Firebase: the
   *  list shown is the last one the server sent. */
  paused: boolean;
  refresh: () => void;
}

const DoctorLiveContext = createContext<DoctorLive | null>(null);

export function DoctorLiveAppointmentsProvider({
  doctorName,
  initial,
  children,
}: {
  doctorName: string;
  initial: Row[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(initial.map((a) => [keyOf(a), a])));
  const [seenInitial, setSeenInitial] = useState(initial);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by a manual Refresh, so failed listeners are tried again.
  const [attempt, setAttempt] = useState(0);
  const subsRef = useRef(new Map<string, () => void>());
  // Time of the last server re-read (0 until the first one this page asks for).
  const lastRefresh = useRef(0);
  // Latest rows for the listener callbacks (to tell what changed).
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Adjust state when the server list changes (during render, not in an effect).
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setRows((prev) => reconcile(prev, initial));
  }

  const refreshFromServer = useCallback(() => {
    lastRefresh.current = Date.now();
    router.refresh();
  }, [router]);

  // Listeners started before the browser's Firebase sign-in is restored
  // are refused by the rules and never retried, so wait for it.
  useEffect(() => {
    let cancelled = false;
    auth.authStateReady().then(() => {
      if (cancelled) return;
      if (!auth.currentUser) console.warn('[doctor live] live updates off: not signed in to Firebase in this browser');
      setSignedIn(!!auth.currentUser);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Unsubscribe everything on unmount only (the diffing effect below
  // re-subscribes after a dev-mode remount, since this clears the map).
  useEffect(() => {
    const subs = subsRef.current;
    return () => {
      subs.forEach((unsub) => unsub());
      subs.clear();
      if (process.env.NODE_ENV !== 'production') (window as unknown as Record<string, unknown>).__doctorLiveListeners = 0;
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const subs = subsRef.current;
    const wanted = new Map(initial.map((a) => [keyOf(a), a]));

    for (const [key, unsub] of subs) {
      if (!wanted.has(key)) {
        unsub();
        subs.delete(key);
      }
    }

    for (const [key, a] of wanted) {
      if (subs.has(key)) continue;
      const unsub = onSnapshot(
        doc(db, `users/${a.patientUid}/appointments/${a.id}`),
        (snap) => {
          const data = snap.exists() ? snap.data() : null;
          // Deleted, or moved to another doctor: no longer hers.
          const gone = !data || !sameDoctor(data.doctor, doctorName);
          const before = rowsRef.current[key];
          if (gone) {
            setRows((prev) => {
              if (!(key in prev)) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
            return;
          }
          if (before && (before.doctorApproval !== data.doctorApproval || before.status !== data.status)) {
            window.dispatchEvent(new Event(DOCTOR_APPOINTMENT_CHANGED));
          }
          setRows((prev) => ({ ...prev, [key]: toDoctorView(prev[key] ?? a, data) }));
        },
        (error) => {
          // Calm: keep the last list, offer a Refresh, no toast per row.
          console.warn('[doctor live] listener stopped:', error.code);
          subs.get(key)?.();
          subs.delete(key);
          setFailed(true);
        }
      );
      subs.set(key, unsub);
    }
    if (process.env.NODE_ENV !== 'production') (window as unknown as Record<string, unknown>).__doctorLiveListeners = subs.size;
  }, [initial, signedIn, doctorName, attempt]);

  // New appointments: when the bell sees a new entry, every 60 s while
  // the tab is visible, and on returning to the tab after 30 s or more.
  useEffect(() => {
    function onBell() {
      if (Date.now() - lastRefresh.current < EVENT_REFRESH_GAP_MS) return;
      refreshFromServer();
    }
    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefresh.current >= VISIBILITY_REFRESH_MS) refreshFromServer();
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshFromServer();
    }, FALLBACK_REFRESH_MS);
    window.addEventListener(DOCTOR_BELL_CHANGED, onBell);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(DOCTOR_BELL_CHANGED, onBell);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshFromServer]);

  const value = useMemo<DoctorLive>(
    () => ({
      appointments: Object.values(rows).sort((a, b) => a.date.localeCompare(b.date)),
      paused: signedIn === false || failed,
      refresh: () => {
        setFailed(false);
        setAttempt((n) => n + 1);
        refreshFromServer();
      },
    }),
    [rows, signedIn, failed, refreshFromServer]
  );

  return <DoctorLiveContext.Provider value={value}>{children}</DoctorLiveContext.Provider>;
}

/** The doctor's live appointments; null outside the doctor layout. */
export function useDoctorLiveAppointments(): DoctorLive | null {
  return useContext(DoctorLiveContext);
}

/** A quiet line when live updates stopped: the list still shows the last
 *  server data, and Refresh asks again. */
export function DoctorLiveNotice() {
  const live = useDoctorLiveAppointments();
  if (!live?.paused) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <span>Live updates are paused. The list may be out of date.</span>
      <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-8" onClick={live.refresh}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Refresh
      </Button>
    </div>
  );
}

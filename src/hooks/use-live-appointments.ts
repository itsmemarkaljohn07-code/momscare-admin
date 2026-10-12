'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { showFriendlyError } from '@/lib/error-messages';

const VISIBILITY_REFRESH_MS = 30_000;

type Keyed = { id: string; patientUid: string; date: string };

function keyOf(a: Keyed): string {
  return `${a.patientUid}/${a.id}`;
}

/** Keeps the server-provided rows in sync with what's actually listed. Rows
 *  that are already live keep their newer listener data; new rows come in
 *  from the server and rows no longer listed are dropped. */
function reconcile<T extends Keyed>(prev: Record<string, T>, initial: T[]): Record<string, T> {
  const next: Record<string, T> = {};
  for (const a of initial) {
    const key = keyOf(a);
    next[key] = prev[key] ?? a;
  }
  return next;
}

/**
 * Live view over a server-fetched list of appointments.
 *
 * `initial` comes from the server (Admin SDK, already filtered), and one
 * listener is attached per known document. There's no client-side
 * discovery query: a live collectionGroup query can't be rule-verified
 * the way individual document reads can. New appointments therefore
 * arrive through `initial` when the server components re-render
 * (router.refresh() after a mutation, or when the tab becomes visible).
 */
export function useLiveAppointments<T extends Keyed>(
  initial: T[],
  toView: (base: T, data: DocumentData) => T
): T[] {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Record<string, T>>(() =>
    Object.fromEntries(initial.map((a) => [keyOf(a), a]))
  );
  const [seenInitial, setSeenInitial] = useState(initial);
  const subsRef = useRef(new Map<string, () => void>());
  const toViewRef = useRef(toView);

  // Adjust state when the prop changes (during render, not in an effect).
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setAppointments((prev) => reconcile(prev, initial));
  }

  useEffect(() => {
    toViewRef.current = toView;
  }, [toView]);

  // Unsubscribe everything on unmount only. The diffing effect below
  // re-subscribes after a dev-mode remount, since this clears the map.
  useEffect(() => {
    const subs = subsRef.current;
    return () => {
      subs.forEach((unsub) => unsub());
      subs.clear();
    };
  }, []);

  useEffect(() => {
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
        (docSnap) => {
          if (!docSnap.exists()) {
            setAppointments((prev) => {
              if (!(key in prev)) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
            return;
          }
          const data = docSnap.data();
          setAppointments((prev) => ({
            ...prev,
            [key]: toViewRef.current(prev[key] ?? a, data),
          }));
        },
        (error) => showFriendlyError(error, 'live appointment sync')
      );
      subs.set(key, unsub);
    }
  }, [initial]);

  // Pick up appointments created elsewhere when the admin/doctor comes
  // back to the tab. Throttled, and no polling while the tab is open.
  useEffect(() => {
    let lastRefresh = Date.now();
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefresh < VISIBILITY_REFRESH_MS) return;
      lastRefresh = now;
      router.refresh();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [router]);

  return useMemo(
    () => Object.values(appointments).sort((a, b) => a.date.localeCompare(b.date)),
    [appointments]
  );
}

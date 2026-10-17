'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collectionGroup, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { showFriendlyError } from '@/lib/error-messages';
import { toRequestView, type AppointmentRequestView } from '@/lib/appointment-requests';

/**
 * Every patient's appointment requests, newest first, kept live. Admins may
 * read the whole collection group (firestore.rules); the query has no
 * filter or order, so it needs no index, and is sorted here instead. It
 * starts once the signed-in admin is known, so it never runs signed out.
 */
export function useLiveAppointmentRequests(): { requests: AppointmentRequestView[]; loaded: boolean } {
  const [requests, setRequests] = useState<AppointmentRequestView[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let unsubSnap: Unsubscribe | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubSnap?.();
      unsubSnap = null;
      if (!user) return;
      unsubSnap = onSnapshot(
        collectionGroup(db, 'appointmentRequests'),
        (snap) => {
          const rows = snap.docs
            .map((d) => toRequestView(d.id, d.ref.parent.parent?.id ?? '', d.data()))
            .sort((a, b) => b.createdAt - a.createdAt);
          setRequests(rows);
          setLoaded(true);
        },
        (error) => showFriendlyError(error, 'live appointment requests')
      );
    });
    return () => {
      unsubAuth();
      unsubSnap?.();
    };
  }, []);

  return { requests, loaded };
}

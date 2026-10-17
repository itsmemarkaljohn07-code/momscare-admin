'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { NotificationBellPanel } from '@/components/notification-bell-panel';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import type { DoctorNotificationView, WatchedThread } from '@/lib/doctor-notifications';

type NotificationList = { notifications: DoctorNotificationView[]; unreadCount: number };

/** How far back the live listeners start. Patient comments carry the
 *  phone's own clock, so a small window absorbs clock differences;
 *  comments already there when listening starts are ignored. */
const LISTEN_WINDOW_MS = 60 * 60 * 1000;

/** At most one list refresh per this long when the tab becomes visible. */
const VISIBLE_REFRESH_MS = 30_000;

/** Doctor-dashboard bell: patient replies to the doctor's Snapshot
 *  comments. Loading it runs the full server-side check; while the page
 *  is open, new patient comments on the doctor's threads are picked up
 *  live and checked on the server straight away. */
export function DoctorNotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DoctorNotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [watch, setWatch] = useState<WatchedThread[]>([]);
  const sound = useNotificationSound(items, !loading && !failed);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/doctors/notifications')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data: NotificationList & { watch: WatchedThread[] } = await res.json();
        if (cancelled) return;
        setItems(data.notifications);
        setUnread(data.unreadCount);
        setWatch(data.watch ?? []);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // New entries that aren't replies (e.g. a new appointment to review)
  // have no live listener: re-read the list when the doctor comes back
  // to the tab, at most every 30 seconds. No timer runs in between.
  useEffect(() => {
    let last = Date.now();
    function onVisible() {
      if (document.visibilityState !== 'visible' || Date.now() - last < VISIBLE_REFRESH_MS) return;
      last = Date.now();
      fetch('/api/doctors/notifications?refresh=1')
        .then(async (res) => {
          if (!res.ok) return;
          const data: NotificationList = await res.json();
          setItems(data.notifications);
          setUnread(data.unreadCount);
        })
        .catch(() => {
          // Keep the current list; the next visit or page load tries again.
        });
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // One listener per watched thread, for comments from the last hour
  // onward (single-field query; the rules already let an assigned doctor
  // read these comments). Only a patient reply added after listening
  // started triggers a server check of that one thread.
  useEffect(() => {
    if (watch.length === 0) return;
    const since = Timestamp.fromMillis(Date.now() - LISTEN_WINDOW_MS);
    const inFlight = new Set<string>();
    let unsubs: (() => void)[] = [];
    let cancelled = false;

    async function checkThread(thread: WatchedThread) {
      const key = `${thread.patientUid}/${thread.photoId}`;
      if (inFlight.has(key)) return;
      inFlight.add(key);
      try {
        const res = await fetch('/api/doctors/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(thread),
        });
        if (!res.ok) return;
        const data: NotificationList = await res.json();
        setItems(data.notifications);
        setUnread(data.unreadCount);
      } catch {
        // The next dashboard load runs the full check anyway.
      } finally {
        inFlight.delete(key);
      }
    }

    // Wait for the browser's Firebase sign-in to be restored first: a
    // listener started before that is refused by the rules and Firestore
    // never retries it.
    auth.authStateReady().then(() => {
      if (cancelled) return;
      if (!auth.currentUser) {
        console.warn('[notifications] live updates off: not signed in to Firebase in this browser');
        return;
      }
      unsubs = watch.map((thread) => {
        let initial = true;
        return onSnapshot(
          query(
            collection(db, `users/${thread.patientUid}/snapshots/${thread.photoId}/comments`),
            where('createdAt', '>=', since)
          ),
          (snap) => {
            if (initial) {
              initial = false;
              return;
            }
            const newPatientReply = snap
              .docChanges()
              .some((c) => c.type === 'added' && c.doc.data().authorRole === 'user' && !!c.doc.data().parentCommentId);
            if (newPatientReply) void checkThread(thread);
          },
          (error) => {
            // The next dashboard load still catches the reply, so no toast;
            // just leave a trace for debugging (error code only).
            console.warn('[notifications] live listener stopped:', error.code);
          }
        );
      });
    });
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [watch]);

  async function markRead(body: { ids: string[] } | { all: true }) {
    const res = await fetch('/api/doctors/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  function markOne(item: DoctorNotificationView) {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    void markRead({ ids: [item.id] });
  }

  function openItem(item: DoctorNotificationView) {
    setOpen(false);
    markOne(item);
    router.push(item.link);
  }

  async function markAllRead() {
    const before = { items, unread };
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    if (!(await markRead({ all: true }))) {
      setItems(before.items);
      setUnread(before.unread);
    }
  }

  return (
    <NotificationBellPanel
      open={open}
      onOpenChange={setOpen}
      items={items}
      unread={unread}
      loading={loading}
      failed={failed}
      onOpenItem={openItem}
      onMarkOne={markOne}
      onMarkAll={markAllRead}
      sound={sound}
    />
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collectionGroup, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { NotificationBellPanel } from '@/components/notification-bell-panel';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import type { AdminNotificationView } from '@/lib/admin-notifications';

type NotificationList = { notifications: AdminNotificationView[]; unreadCount: number };

/** "Anything new?" check: one document read on the server. */
const HEAD_POLL_MS = 10_000;
/** Full check (also finds cancellation requests); the server runs the
 *  underlying scan at most once a minute anyway. */
const FULL_POLL_MS = 60_000;

const API = '/api/admin/notifications';

async function fetchList(): Promise<NotificationList | null> {
  try {
    const res = await fetch(API, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as NotificationList) : null;
  } catch {
    return null;
  }
}

async function fetchLatestId(): Promise<string | null | undefined> {
  try {
    const res = await fetch(`${API}?head=1`, { cache: 'no-store' });
    if (!res.ok) return undefined;
    return ((await res.json()) as { latestId: string | null }).latestId;
  } catch {
    return undefined;
  }
}

/** Admin-dashboard bell: one shared list for every admin (patient
 *  appointment requests, doctor approvals/declines, cancellation
 *  requests), with read state per admin.
 *
 *  How fast entries arrive while a dashboard tab is open:
 *  - appointment requests: about a second (live Firestore listener);
 *  - doctor approve/decline: within 10 s (cheap "anything new?" check);
 *  - cancellation requests: within about a minute (full check). */
export function AdminNotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const sound = useNotificationSound(items, !loading && !failed);
  // Newest id the bell is showing, read by the polling timers.
  const newestId = useRef<string | null>(null);

  const apply = useCallback((data: NotificationList | null) => {
    if (!data) return;
    newestId.current = data.notifications[0]?.id ?? null;
    setItems(data.notifications);
    setUnread(data.unreadCount);
    setFailed(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchList().then((data) => {
      if (cancelled) return;
      if (data) apply(data);
      else setFailed(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  // While the tab is visible: a cheap check every 10 s (re-read the list
  // only when the newest id changed) and a full check every minute.
  // Returning to the tab runs a full check straight away. Nothing runs
  // while the tab is hidden.
  useEffect(() => {
    let lastFull = Date.now();
    let busy = false;
    async function tick(forceFull: boolean) {
      if (document.visibilityState !== 'visible' || busy) return;
      busy = true;
      try {
        if (forceFull || Date.now() - lastFull >= FULL_POLL_MS - 1_000) {
          lastFull = Date.now();
          apply(await fetchList());
          return;
        }
        const latest = await fetchLatestId();
        if (latest !== undefined && latest !== newestId.current) apply(await fetchList());
      } finally {
        busy = false;
      }
    }
    const id = window.setInterval(() => void tick(false), HEAD_POLL_MS);
    const onVisible = () => void tick(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [apply]);

  // New appointment requests, live: the rules already let an admin read
  // every patient's appointmentRequests (the Requests page does the
  // same). Requests already there when listening starts are ignored;
  // each new one asks the server to record it, then shows the list.
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    auth.authStateReady().then(() => {
      if (cancelled || !auth.currentUser) return;
      let initial = true;
      unsub = onSnapshot(
        collectionGroup(db, 'appointmentRequests'),
        (snap) => {
          if (initial) {
            initial = false;
            return;
          }
          for (const change of snap.docChanges()) {
            if (change.type !== 'added') continue;
            const patientUid = change.doc.ref.parent.parent?.id;
            if (!patientUid) continue;
            void fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ patientUid, requestId: change.doc.id }),
            })
              .then(async (res) => (res.ok ? apply((await res.json()) as NotificationList) : undefined))
              .catch(() => {
                // The regular checks pick it up anyway.
              });
          }
        },
        (error) => {
          // The regular checks still catch requests; no toast.
          console.warn('[notifications] live request listener stopped:', error.code);
        }
      );
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [apply]);

  async function markRead(body: { ids: string[] } | { all: true }) {
    const res = await fetch(API, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    return !!res?.ok;
  }

  function markOne(item: AdminNotificationView) {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    void markRead({ ids: [item.id] });
  }

  function openItem(item: AdminNotificationView) {
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

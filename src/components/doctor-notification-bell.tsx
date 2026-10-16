'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { Bell } from 'lucide-react';
import { auth, db } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatRelativeTime } from '@/lib/format-relative-time';
import type { DoctorNotificationView, WatchedThread } from '@/lib/doctor-notifications';

type NotificationList = { notifications: DoctorNotificationView[]; unreadCount: number };

/** How far back the live listeners start. Patient comments carry the
 *  phone's own clock, so a small window absorbs clock differences;
 *  comments already there when listening starts are ignored. */
const LISTEN_WINDOW_MS = 60 * 60 * 1000;

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

  async function openItem(item: DoctorNotificationView) {
    setOpen(false);
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      void markRead({ ids: [item.id] });
    }
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          />
        }
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
            style={{ backgroundColor: 'var(--status-pending)', color: '#ffffff' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0 shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className="text-xs font-medium text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : failed ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load notifications.</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${n.read ? '' : 'bg-primary/5'}`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-primary'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
                      <span className="block text-xs text-muted-foreground">{n.message}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

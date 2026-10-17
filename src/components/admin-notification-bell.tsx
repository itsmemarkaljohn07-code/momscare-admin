'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationBellPanel } from '@/components/notification-bell-panel';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import type { AdminNotificationView } from '@/lib/admin-notifications';

type NotificationList = { notifications: AdminNotificationView[]; unreadCount: number };

/** How often an open, visible dashboard asks for new entries. The server
 *  runs the actual event check at most once a minute anyway. */
const POLL_MS = 60_000;

async function fetchList(): Promise<NotificationList | null> {
  try {
    const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
    return res.ok ? ((await res.json()) as NotificationList) : null;
  } catch {
    return null;
  }
}

/** Admin-dashboard bell: one shared list for every admin (patient
 *  appointment requests, doctor approvals/declines, cancellation
 *  requests), with read state per admin. */
export function AdminNotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const sound = useNotificationSound(items, !loading && !failed);

  const apply = useCallback((data: NotificationList | null) => {
    if (!data) return;
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

  // While the tab is visible: check every minute, and as soon as the admin
  // comes back to the tab. Nothing runs while the tab is hidden.
  useEffect(() => {
    let last = Date.now();
    function tick() {
      if (document.visibilityState !== 'visible' || Date.now() - last < POLL_MS - 1_000) return;
      last = Date.now();
      void fetchList().then(apply);
    }
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [apply]);

  async function markRead(body: { ids: string[] } | { all: true }) {
    const res = await fetch('/api/admin/notifications', {
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

'use client';

import { Bell, Check, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatRelativeTime } from '@/lib/format-relative-time';

export interface BellItem {
  id: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BellItem[];
  unread: number;
  loading: boolean;
  failed: boolean;
  onOpenItem: (item: BellItem) => void;
  onMarkOne: (item: BellItem) => void;
  onMarkAll: () => void;
  sound: { enabled: boolean; blocked: boolean; toggle: () => void; allow: () => void };
}

/** The bell button and its panel, shared by the admin and doctor bells.
 *  Each bell keeps its own data and server calls. */
export function NotificationBellPanel({
  open,
  onOpenChange,
  items,
  unread,
  loading,
  failed,
  onOpenItem,
  onMarkOne,
  onMarkAll,
  sound,
}: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 rounded-2xl p-0 shadow-card"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={sound.toggle}
              aria-pressed={sound.enabled}
              aria-label={sound.enabled ? 'Turn notification sound off' : 'Turn notification sound on'}
              title={sound.enabled ? 'Sound on' : 'Sound off'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {sound.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {sound.enabled && sound.blocked && (
          <button
            type="button"
            onClick={sound.allow}
            className="border-b bg-muted/50 px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            Your browser blocked the notification sound. Click here to allow it.
          </button>
        )}

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : failed ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load notifications.</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Bell className="h-6 w-6 text-muted-foreground/60" aria-hidden />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`flex items-start ${n.read ? '' : 'bg-primary/5'}`}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(n)}
                    className="flex min-w-0 flex-1 gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-primary'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`}>
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="block break-words text-xs text-muted-foreground">{n.message}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
                    </span>
                  </button>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => onMarkOne(n)}
                      aria-label={`Mark "${n.title}" as read`}
                      title="Mark as read"
                      className="mr-2 mt-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

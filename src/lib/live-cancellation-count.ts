'use client';

import { useSyncExternalStore } from 'react';

// Pending cancellation requests, counted live in the browser by the admin
// bell's appointments listener and shown by the sidebar badge. null until
// the listener has its first snapshot (or when it isn't allowed), so the
// sidebar falls back to the count the server rendered.

let count: number | null = null;
const listeners = new Set<() => void>();

export function setLiveCancellationCount(next: number | null): void {
  if (next === count) return;
  count = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLiveCancellationCount(): number | null {
  return useSyncExternalStore(subscribe, () => count, () => null);
}

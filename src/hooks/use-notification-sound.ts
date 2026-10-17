'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SOUND_URL = '/sounds/notify.wav';
const STORAGE_KEY = 'momcare:notification-sound';
const MIN_GAP_MS = 3_000;

function readEnabled(): boolean {
  try {
    return typeof window === 'undefined' || window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Notification sound for a bell, shared by the admin and doctor bells.
 * Plays only for unread entries that appear after the list first loaded,
 * once per id, at most once every 3 seconds. The on/off choice is kept in
 * this browser's localStorage. If the browser blocks audio until the user
 * interacts, `blocked` turns on so the bell can offer a click to allow it.
 * A missing or unplayable file means no sound and no error.
 */
export function useNotificationSound(items: { id: string; read: boolean }[], loaded: boolean) {
  const [enabled, setEnabled] = useState(readEnabled);
  const [blocked, setBlocked] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const lastPlayed = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const unavailable = useRef(false);

  const play = useCallback(async (): Promise<void> => {
    if (unavailable.current || typeof Audio === 'undefined') return;
    if (!audio.current) {
      audio.current = new Audio(SOUND_URL);
      audio.current.addEventListener('error', () => {
        unavailable.current = true;
      });
    }
    try {
      audio.current.currentTime = 0;
      await audio.current.play();
      setBlocked(false);
    } catch (err) {
      // NotAllowedError: autoplay blocked until the user clicks the page.
      // Anything else (missing or unsupported file) stays silent.
      if ((err as { name?: string })?.name === 'NotAllowedError') setBlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null) {
      // Entries already there when the page loaded never make a sound.
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    const fresh = items.filter((n) => !n.read && !seen.current?.has(n.id));
    items.forEach((n) => seen.current?.add(n.id));
    if (fresh.length === 0 || !enabled) return;
    if (Date.now() - lastPlayed.current < MIN_GAP_MS) return;
    lastPlayed.current = Date.now();
    void play();
  }, [items, loaded, enabled, play]);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        // Private mode or blocked storage: the choice lasts for this page only.
      }
      if (!next) setBlocked(false);
      return next;
    });
  }, []);

  /** Called from a click, which lets the browser allow audio. */
  const allow = useCallback(() => {
    void play();
  }, [play]);

  return { enabled, blocked, toggle, allow };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

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
 * this browser's localStorage.
 *
 * Browsers refuse to play sound on a page the user hasn't clicked or typed
 * on since it loaded. So the first click or key press anywhere unlocks the
 * sound silently, and if a sound is still refused the user is told once
 * (toast) that a click turns it on. A missing or unplayable file means no
 * sound and no error.
 */
export function useNotificationSound(items: { id: string; read: boolean }[], loaded: boolean) {
  const [enabled, setEnabled] = useState(readEnabled);
  const [blocked, setBlocked] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const lastPlayed = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const unavailable = useRef(false);
  const warned = useRef(false);

  const getAudio = useCallback((): HTMLAudioElement | null => {
    if (unavailable.current || typeof Audio === 'undefined') return null;
    if (!audio.current) {
      audio.current = new Audio(SOUND_URL);
      audio.current.preload = 'auto';
      audio.current.addEventListener('error', () => {
        unavailable.current = true;
      });
    }
    return audio.current;
  }, []);

  const play = useCallback(async (): Promise<void> => {
    const el = getAudio();
    if (!el) return;
    try {
      el.muted = false;
      el.currentTime = 0;
      await el.play();
      setBlocked(false);
    } catch (err) {
      // NotAllowedError: the page hasn't been clicked yet. Anything else
      // (missing or unsupported file) stays silent.
      if ((err as { name?: string })?.name !== 'NotAllowedError') return;
      setBlocked(true);
      if (!warned.current) {
        warned.current = true;
        console.warn('[notifications] sound blocked by the browser until the page is clicked');
        toast.info('New notification', {
          description: 'Your browser blocked the notification sound. Click anywhere on the page to turn it on.',
        });
      }
    }
  }, [getAudio]);

  // The first click or key press unlocks audio for this page: a silent,
  // muted play right inside the user's gesture.
  useEffect(() => {
    function unlock() {
      const el = getAudio();
      if (!el) return;
      el.muted = true;
      el.play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
          setBlocked(false);
          remove();
        })
        .catch(() => {
          el.muted = false;
          // Still refused: keep listening for the next gesture.
        });
    }
    function remove() {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    }
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return remove;
  }, [getAudio]);

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

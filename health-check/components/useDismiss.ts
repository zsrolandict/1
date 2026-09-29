'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Bezárás Escape-re (ablakok, legördülők) – egy helyen, hogy minden
 * felugró elem ugyanúgy viselkedjen.
 */
export function useEscape(onClose: () => void, active = true): void {
  const cb = useRef(onClose);
  useEffect(() => {
    cb.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}

/** Bezárás a elemen kívüli kattintásra és Escape-re (legördülő menük). */
export function useOutside(ref: RefObject<HTMLElement | null>, onClose: () => void, active: boolean): void {
  useEscape(onClose, active);
  const cb = useRef(onClose);
  useEffect(() => {
    cb.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, active]);
}

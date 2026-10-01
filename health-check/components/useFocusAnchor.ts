'use client';

import { useEffect } from 'react';
import { clearFocus, FOCUS_EVENT, peekFocus } from '@/lib/focus';

/**
 * A céloldal oldala: ha van függő ugrási kérés, megkeresi az elemet
 * (a fülváltás után néhány tized másodpercig próbálkozik), odagörget és
 * kiemeli. `onRequest` előtte lefuthat (pl. szűrők törlése, sor lenyitása).
 */
export function useFocusAnchor(ready = true, onRequest?: (anchor: string) => void) {
  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    const tryFocus = (anchor: string, left: number) => {
      const el = document.getElementById(anchor);
      if (!el) {
        if (left > 0) timer = window.setTimeout(() => tryFocus(anchor, left - 1), 120);
        return;
      }
      clearFocus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('ict-focus-flash');
      void el.offsetWidth; // az animáció újraindításához
      el.classList.add('ict-focus-flash');
      window.setTimeout(() => el.classList.remove('ict-focus-flash'), 2600);
    };
    const handle = () => {
      const anchor = peekFocus();
      if (!anchor) return;
      onRequest?.(anchor);
      window.clearTimeout(timer);
      tryFocus(anchor, 15);
    };
    handle();
    window.addEventListener(FOCUS_EVENT, handle);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(FOCUS_EVENT, handle);
    };
    // onRequest szándékosan nincs a függőségek között: a legfrissebb állapotot a hívó zárja be.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}

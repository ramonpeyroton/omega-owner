import { useEffect, useRef } from 'react';

/**
 * Intercepts the browser / device back button so it never drops the
 * user out of the SPA. Instead of locking them in place, it runs
 * `onBack(depth)` — the caller decides where to go (usually: back one
 * step, or to the role's home screen).
 *
 * Strategy:
 *   - On mount we push a sentinel state so there is always something
 *     for the browser to pop back to.
 *   - Every popstate → push the sentinel again and call onBack(depth).
 *     The `depth` increments each time the user keeps pressing back,
 *     so the caller can detect "pressed back while already at home"
 *     and show a toast like "Press again to sign out".
 *
 * @param {boolean}   active    — enable the guard (usually only when logged in)
 * @param {(depth:number)=>void} [onBack] — fires on every intercepted back tap
 */
export function useBackButtonGuard(active, onBack) {
  const depthRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    // Reset depth whenever the guard is re-activated (e.g. after a login).
    depthRef.current = 0;

    // Push an initial sentinel so there's always something to pop to.
    try { window.history.pushState({ __omega: true }, ''); } catch { /* ignore */ }

    function onPop() {
      // Immediately replace with a fresh sentinel so a second back still
      // fires a popstate event (browsers coalesce repeated pops otherwise).
      try { window.history.pushState({ __omega: true }, ''); } catch { /* ignore */ }
      depthRef.current += 1;
      if (typeof onBack === 'function') {
        try { onBack(depthRef.current); } catch { /* ignore */ }
      }
    }

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active, onBack]);
}

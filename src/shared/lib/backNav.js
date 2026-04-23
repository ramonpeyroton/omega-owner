import { useEffect, useRef } from 'react';

// Lightweight bus that lets role apps register a "go home" handler
// without wiring a global context or redux. The App.jsx root owns
// the browser back button guard; each role app calls
// `useBackNavHome(() => setScreen('dashboard'))` to plug into it.
//
// If no handler is registered, the root default does nothing (stays
// on the current screen but does not exit the SPA — the guard still
// pushes a sentinel state).

const EVENT = 'omega:back-nav';
let currentHandler = null;

/** Role apps call this inside a useEffect to register their handler. */
export function useBackNavHome(handler) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });

  useEffect(() => {
    function listener(e) {
      const depth = e?.detail?.depth || 1;
      try { ref.current?.(depth); } catch { /* ignore */ }
    }
    currentHandler = listener;
    window.addEventListener(EVENT, listener);
    return () => {
      window.removeEventListener(EVENT, listener);
      if (currentHandler === listener) currentHandler = null;
    };
  }, []);
}

/** Root app calls this from inside the back button guard. */
export function dispatchBackNav(depth) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { depth } }));
}

/** Returns true if a role app has registered a handler right now. */
export function hasBackHandler() {
  return !!currentHandler;
}

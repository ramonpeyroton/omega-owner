// FiltersMenu — small popover that lets the user toggle which event
// categories are visible on the calendar. The CalendarScreen owns the
// state (a Set of visible kinds) and passes it in.
//
// Click the bullet+label to toggle one. "Reset" clears the filter
// (everything visible again).

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EVENT_KIND_META } from '../../lib/calendar';

const ALL_KINDS = Object.keys(EVENT_KIND_META);

export default function FiltersMenu({ visibleKinds, onChange, onClose }) {
  const ref = useRef(null);

  // Close on outside click + Esc.
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function toggle(kind) {
    const next = new Set(visibleKinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    // Don't allow zero categories — the screen would be empty and
    // the user would think it's broken. Reset to all if they tried.
    if (next.size === 0) {
      onChange(new Set(ALL_KINDS));
    } else {
      onChange(next);
    }
  }

  function reset() {
    onChange(new Set(ALL_KINDS));
  }

  const allOn = visibleKinds.size === ALL_KINDS.length;

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-card-hover border border-black/[0.06] z-30 overflow-hidden"
      role="dialog"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-omega-charcoal">Filter events</p>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-omega-stone hover:bg-omega-cloud hover:text-omega-charcoal"
          aria-label="Close filters"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="py-1.5">
        {ALL_KINDS.map((k) => {
          const meta = EVENT_KIND_META[k];
          const active = visibleKinds.has(k);
          return (
            <li key={k}>
              <button
                onClick={() => toggle(k)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-omega-cloud transition text-left"
              >
                <span
                  className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition ${
                    active ? 'border-omega-charcoal bg-omega-charcoal' : 'border-gray-300 bg-white'
                  }`}
                >
                  {active && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: meta.color }}
                />
                <span className="text-sm text-omega-charcoal flex-1">{meta.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] text-omega-stone">
          {allOn ? 'Showing all' : `${visibleKinds.size} of ${ALL_KINDS.length}`}
        </span>
        <button
          onClick={reset}
          disabled={allOn}
          className="text-xs font-semibold text-omega-orange hover:text-omega-dark disabled:text-omega-fog disabled:cursor-not-allowed transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

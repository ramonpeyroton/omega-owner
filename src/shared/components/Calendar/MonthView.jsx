import { useMemo } from 'react';
import {
  buildMonthGrid, formatMonthCT, EVENT_KIND_META,
} from '../../lib/calendar';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Full month grid. Each cell shows up to 3 event dots + "+N more" badge.
 * Click a day → `onDayClick(iso)`. The cell for today gets a subtle
 * orange ring so it's easy to spot.
 */
export default function MonthView({
  year, monthIndex, events, onDayClick, onPrevMonth, onNextMonth, onToday,
}) {
  const cells = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);

  // Bucket events by their CT date string.
  const byDay = useMemo(() => {
    const map = {};
    for (const e of events || []) {
      const d = new Date(e.starts_at);
      const iso = isoCT(d);
      (map[iso] = map[iso] || []).push(e);
    }
    return map;
  }, [events]);

  const title = formatMonthCT(new Date(Date.UTC(year, monthIndex, 15)));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-omega-charcoal">{title}</h2>
        <div className="flex items-center gap-1">
          <button onClick={onToday} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold hover:border-omega-orange">
            Today
          </button>
          <button onClick={onPrevMonth} aria-label="Previous month" className="p-2 rounded-lg hover:bg-gray-100 text-omega-charcoal">
            <Chevron dir="left" />
          </button>
          <button onClick={onNextMonth} aria-label="Next month" className="p-2 rounded-lg hover:bg-gray-100 text-omega-charcoal">
            <Chevron dir="right" />
          </button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-[10px] uppercase tracking-widest font-bold text-omega-stone text-center py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const dayEvents = byDay[c.iso] || [];
          const visible = dayEvents.slice(0, 3);
          const extra = Math.max(0, dayEvents.length - visible.length);
          return (
            <button
              key={c.iso}
              onClick={() => onDayClick?.(c.iso, dayEvents)}
              className={`group relative min-h-[70px] sm:min-h-[90px] p-1.5 rounded-lg border text-left transition-all ${
                c.isCurrentMonth ? 'bg-white' : 'bg-gray-50/60'
              } ${
                c.isToday
                  ? 'border-omega-orange ring-2 ring-omega-orange/40'
                  : 'border-gray-200 hover:border-omega-orange/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold tabular-nums ${
                  c.isToday ? 'text-omega-orange' :
                  c.isCurrentMonth ? 'text-omega-charcoal' : 'text-omega-stone/70'
                }`}>
                  {c.day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] font-bold text-omega-stone tabular-nums">{dayEvents.length}</span>
                )}
              </div>

              <div className="mt-1 space-y-0.5">
                {visible.map((e) => {
                  const meta = EVENT_KIND_META[e.kind] || { color: '#6B7280' };
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-1 text-[10px] leading-tight truncate"
                      title={e.title}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                      <span className="text-omega-charcoal truncate">{e.title}</span>
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div className="text-[9px] font-bold text-omega-orange">+{extra} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chevron({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      {dir === 'left'
        ? <path d="M12.7 5.3L7 11l5.7 5.7L14 15.4 9.8 11 14 6.6 12.7 5.3z" />
        : <path d="M7.3 5.3L6 6.6 10.2 11 6 15.4l1.3 1.3L13 11 7.3 5.3z" />
      }
    </svg>
  );
}

// Small local wrapper around `isoDateCT` so MonthView stays self-contained
// if someone imports it in isolation. Avoids a second import path.
function isoCT(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d).filter((p) => p.type !== 'literal').map((p) => p.value).join('-');
}

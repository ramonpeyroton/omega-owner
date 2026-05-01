// UpcomingEvents — right-rail widget showing the next N events after today.
// Mirrors the layout in the redesign mockup: short MAY-1 / MAY-4 stack on
// the left, colored bullet + title + time on the right. Click → fires
// `onPick(event)` so CalendarScreen can navigate the month grid or open
// the day drawer.

import { useMemo } from 'react';
import { isoDateCT, formatTimeCT, EVENT_KIND_META, eventDisplayMeta } from '../../lib/calendar';
import Card from '../ui/Card';

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function UpcomingEvents({ events = [], limit = 5, onPick, onViewAll }) {
  const upcoming = useMemo(() => {
    const todayIso = isoDateCT(new Date());
    return (events || [])
      .filter((e) => isoDateCT(new Date(e.starts_at)) > todayIso)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
      .slice(0, limit);
  }, [events, limit]);

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-omega-charcoal">Upcoming Events</p>
        {onViewAll && upcoming.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-omega-orange hover:text-omega-dark transition"
          >
            View all
          </button>
        )}
      </div>

      {upcoming.length === 0 ? (
        <p className="text-xs text-omega-stone py-2">Nothing else scheduled.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {upcoming.map((e) => {
            const d = new Date(e.starts_at);
            // Same precedence as MonthView: visit_status colors win for
            // sales_visit; everything else falls back to its kind color.
            const meta = eventDisplayMeta(e);
            const monthLbl = MONTH_SHORT[d.getMonth()];
            const dayLbl = d.getDate();
            return (
              <li key={e.id}>
                <button
                  onClick={() => onPick?.(e)}
                  className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-omega-cloud rounded-lg px-1 transition"
                >
                  <div className="flex-shrink-0 text-center w-9">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-omega-stone leading-none">{monthLbl}</p>
                    <p className="text-base font-bold text-omega-charcoal tabular-nums leading-tight">{dayLbl}</p>
                  </div>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: meta.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-omega-charcoal truncate">{e.title}</p>
                    <p className="text-[11px] text-omega-stone mt-0.5">
                      {e.all_day ? 'All day' : formatTimeCT(d)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

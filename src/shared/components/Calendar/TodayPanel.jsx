// TodayPanel — right-rail widget that shows what's scheduled for the
// current day. Used by the redesigned CalendarScreen. Self-contained:
// pulls today's events out of the same `events` array CalendarScreen
// already loaded (no extra fetches).
//
// Empty state shows a soft Lucide icon + "No events scheduled" copy.

import { CalendarCheck, Plus } from 'lucide-react';
import Card from '../ui/Card';
import IconChip from '../ui/IconChip';
import { formatDateLongCT, formatTimeCT, isoDateCT, EVENT_KIND_META } from '../../lib/calendar';

export default function TodayPanel({ events = [], onCreate }) {
  const todayDate = new Date();
  const todayIso = isoDateCT(todayDate);
  const todays = (events || [])
    .filter((e) => isoDateCT(new Date(e.starts_at)) === todayIso)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <IconChip icon={CalendarCheck} color="orange" size="sm" />
          <p className="text-sm font-semibold text-omega-charcoal">
            {formatDateLongCT(todayDate)}
          </p>
        </div>
      </div>

      {todays.length === 0 ? (
        <div className="flex flex-col items-center text-center py-6 px-2">
          <div className="w-16 h-16 rounded-2xl bg-omega-pale flex items-center justify-center mb-3">
            <CalendarCheck className="w-8 h-8 text-omega-orange" />
          </div>
          <p className="text-sm font-semibold text-omega-charcoal">No events scheduled</p>
          <p className="text-xs text-omega-stone mt-0.5">Enjoy your day!</p>
          {onCreate && (
            <button
              onClick={() => onCreate(todayIso)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-omega-charcoal text-white text-xs font-semibold hover:bg-black transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Event
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {todays.map((e) => {
            const meta = EVENT_KIND_META[e.kind] || { color: '#6B7280', label: e.kind };
            return (
              <li
                key={e.id}
                className="flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-omega-cloud transition"
              >
                <span
                  className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: meta.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-omega-charcoal truncate">{e.title}</p>
                  <p className="text-[11px] text-omega-stone uppercase tracking-wide font-semibold mt-0.5">
                    {e.all_day ? 'All day' : formatTimeCT(new Date(e.starts_at))}
                    {' · '}
                    {meta.label}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

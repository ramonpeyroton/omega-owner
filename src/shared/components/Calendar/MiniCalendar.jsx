// MiniCalendar — compact month grid for the right-rail. Shows the
// currently-viewed month, highlights today and the selected day, and
// dispatches `onPickDay(iso)` when a cell is clicked so the main
// MonthView can jump to that day's events.
//
// Stays in sync with the main calendar: receives `year` / `monthIndex`
// from the parent. Doesn't navigate by itself — that's the parent's job.

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, formatMonthCT, isoDateCT } from '../../lib/calendar';
import Card from '../ui/Card';

const DOW_MINI = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function MiniCalendar({
  year,
  monthIndex,
  onPickDay,
  onPrevMonth,
  onNextMonth,
}) {
  const cells = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);
  const title = formatMonthCT(new Date(Date.UTC(year, monthIndex, 15)));
  const todayIso = isoDateCT(new Date());

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="p-1 rounded-lg hover:bg-omega-cloud text-omega-stone hover:text-omega-charcoal transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-omega-charcoal">{title}</p>
        <button
          onClick={onNextMonth}
          aria-label="Next month"
          className="p-1 rounded-lg hover:bg-omega-cloud text-omega-stone hover:text-omega-charcoal transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DOW_MINI.map((d, i) => (
          <div
            key={i}
            className="text-[10px] font-bold uppercase text-omega-stone text-center py-1"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c) => {
          const isToday = c.iso === todayIso;
          return (
            <button
              key={c.iso}
              onClick={() => onPickDay?.(c.iso)}
              className={`aspect-square flex items-center justify-center text-xs font-semibold rounded-md tabular-nums transition ${
                isToday
                  ? 'bg-omega-orange text-white'
                  : c.isCurrentMonth
                    ? 'text-omega-charcoal hover:bg-omega-cloud'
                    : 'text-omega-fog hover:bg-omega-cloud'
              }`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

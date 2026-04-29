// CalendarScreen — full calendar surface used by every role.
//
// Layout: header card (title + Filters + New Event) on top, then a
// two-column grid below — month grid on the left, a right rail with
// Today / Upcoming / Mini-calendar widgets. The right rail collapses
// under the grid on screens narrower than 1280px (lg breakpoint).
//
// Logic kept from the previous version:
//   • realtime subscription on calendar_events
//   • month-by-month fetch via loadEventsForMonth
//   • DayDrawer + EventForm modals (untouched)
//   • initialJobForVisit + onVisitScheduled handshake for receptionist
//
// Added:
//   • visibleKinds Set — drives the filter popover and the rendered events
//   • right-rail widgets (TodayPanel / UpcomingEvents / MiniCalendar)
//   • category legend at the bottom uses CategoryBadge from the design system

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  loadEventsForMonth,
  EVENT_KIND_META,
  canCreateAnyEvent,
  isoDateCT,
} from '../../lib/calendar';
import MonthView from './MonthView';
import DayDrawer from './DayDrawer';
import EventForm from './EventForm';
import TodayPanel from './TodayPanel';
import UpcomingEvents from './UpcomingEvents';
import MiniCalendar from './MiniCalendar';
import FiltersMenu from './FiltersMenu';
import CategoryBadge from '../ui/CategoryBadge';
import { CATEGORY_ORDER } from '../../lib/eventCategories';

const ALL_KINDS = Object.keys(EVENT_KIND_META);

export default function CalendarScreen({
  user,
  initialJobForVisit = null,
  onVisitScheduled = null,
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [drawerIso, setDrawerIso] = useState(null);
  const [formState, setFormState] = useState(null); // { iso, prefillJob, event }

  // Set of visible kinds for the filter popover. Default: all on.
  const [visibleKinds, setVisibleKinds] = useState(() => new Set(ALL_KINDS));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const canCreate = canCreateAnyEvent(user?.role);

  // Auto-open EventForm when arriving from "Schedule Visit" on New Lead.
  useEffect(() => {
    if (initialJobForVisit) {
      setFormState({ iso: null, prefillJob: initialJobForVisit, event: null });
    }
  }, [initialJobForVisit]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await loadEventsForMonth(year, monthIndex);
    setEvents(rows);
    setLoading(false);
  }, [year, monthIndex]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: any change to calendar_events triggers a refresh.
  useEffect(() => {
    const chan = supabase
      .channel('calendar-screen')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [refresh]);

  // Apply the kind filter once at the screen level so MonthView,
  // TodayPanel, UpcomingEvents and MiniCalendar all see the same set.
  const filteredEvents = useMemo(
    () => events.filter((e) => visibleKinds.has(e.kind)),
    [events, visibleKinds],
  );

  function gotoToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  }
  function prevMonth() {
    if (monthIndex === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(monthIndex - 1);
  }
  function nextMonth() {
    if (monthIndex === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(monthIndex + 1);
  }

  function openNewEvent(iso = null) {
    setFormState({ iso, prefillJob: null, event: null });
  }

  const allKindsOn = visibleKinds.size === ALL_KINDS.length;

  return (
    <div className="flex-1 overflow-y-auto bg-omega-cloud">
      {/* Top header — sticky so it stays visible while scrolling the grid. */}
      <header className="px-4 sm:px-6 lg:px-8 py-5 bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-omega-charcoal">Calendar</h1>
            <p className="text-xs sm:text-sm text-omega-stone mt-0.5">
              All company events — visits, job starts, inspections, meetings.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button
                // stopPropagation on mousedown so FiltersMenu's outside-click
                // handler (which fires on mousedown) doesn't close the popover
                // milliseconds before our toggle re-opens it.
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                  allKindsOn
                    ? 'bg-omega-charcoal text-white hover:bg-black'
                    : 'bg-omega-orange text-white hover:bg-omega-dark'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {!allKindsOn && (
                  <span className="ml-0.5 px-1.5 py-px text-[10px] font-bold rounded-full bg-white/20">
                    {visibleKinds.size}
                  </span>
                )}
              </button>
              {filtersOpen && (
                <FiltersMenu
                  visibleKinds={visibleKinds}
                  onChange={setVisibleKinds}
                  onClose={() => setFiltersOpen(false)}
                />
              )}
            </div>

            {canCreate && (
              <button
                onClick={() => openNewEvent(null)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-omega-orange text-white text-sm font-semibold hover:bg-omega-dark transition"
              >
                <Plus className="w-4 h-4" />
                New Event
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body: grid + right rail. Rail collapses under grid below 1280px. */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          {/* Left column: month grid + legend */}
          <div className="space-y-4 min-w-0">
            <MonthView
              year={year}
              monthIndex={monthIndex}
              events={filteredEvents}
              onDayClick={(iso) => setDrawerIso(iso)}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onToday={gotoToday}
            />

            {/* Legend — uses the design-system CategoryBadge so colors stay synced. */}
            <div className="flex items-center gap-2 flex-wrap px-1">
              {CATEGORY_ORDER.map((k) => (
                <CategoryBadge key={k} category={k} size="sm" />
              ))}
              {loading && (
                <span className="ml-auto text-[11px] text-omega-stone">Loading…</span>
              )}
            </div>
          </div>

          {/* Right rail */}
          <aside className="space-y-4 min-w-0">
            <TodayPanel
              events={filteredEvents}
              onCreate={canCreate ? openNewEvent : null}
            />
            <UpcomingEvents
              events={filteredEvents}
              limit={5}
              // Resolve to the CT-local date (not UTC slice) so a 11pm-CT
              // event doesn't open the wrong day's drawer.
              onPick={(e) => setDrawerIso(isoDateCT(new Date(e.starts_at)))}
            />
            <MiniCalendar
              year={year}
              monthIndex={monthIndex}
              onPickDay={(iso) => setDrawerIso(iso)}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
            />
          </aside>
        </div>
      </div>

      {drawerIso && (
        <DayDrawer
          iso={drawerIso}
          user={user}
          onClose={() => setDrawerIso(null)}
          onCreate={(iso) => {
            setDrawerIso(null);
            setFormState({ iso, prefillJob: null, event: null });
          }}
          onEdit={(event) => {
            setDrawerIso(null);
            setFormState({ iso: null, prefillJob: null, event });
          }}
          onChanged={refresh}
        />
      )}

      {formState && (
        <EventForm
          user={user}
          initialIso={formState.iso}
          initialEvent={formState.event}
          prefillJob={formState.prefillJob}
          onClose={() => setFormState(null)}
          onSaved={(saved) => {
            setFormState(null);
            refresh();
            onVisitScheduled?.(saved);
          }}
        />
      )}
    </div>
  );
}

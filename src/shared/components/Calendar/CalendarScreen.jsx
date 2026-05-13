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
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { Filter, Plus, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  loadEventsForMonth,
  EVENT_KIND_META,
  canCreateAnyEvent,
  canEditKind,
  updateEvent,
  isoDateCT,
  eventDisplayMeta,
  formatTimeCT,
} from '../../lib/calendar';
import { logAudit } from '../../lib/audit';
import MonthView from './MonthView';
import DayDrawer from './DayDrawer';
import EventForm from './EventForm';
import TodayPanel from './TodayPanel';
import UpcomingEvents from './UpcomingEvents';
import MiniCalendar from './MiniCalendar';
import FiltersMenu from './FiltersMenu';
import EventTypesDonut from './EventTypesDonut';
import CategoryBadge from '../ui/CategoryBadge';
import { CATEGORY_ORDER } from '../../lib/eventCategories';

const ALL_KINDS = Object.keys(EVENT_KIND_META);

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Mobile Agenda View ────────────────────────────────────────────
// Groups events by date and renders them as a readable list — much
// better than a 7-column month grid on a 390px screen.
function MobileAgendaView({
  year, monthIndex, filteredEvents, loading,
  prevMonth, nextMonth, gotoToday,
  onDayClick, onNewEvent, canCreate,
}) {
  // Build list of events in the current month + 15 days ahead,
  // sorted by starts_at. Group by YYYY-MM-DD.
  const grouped = useMemo(() => {
    const startOfMonth = new Date(year, monthIndex, 1);
    const endWindow    = new Date(year, monthIndex + 2, 15); // ~6 weeks
    const inRange = (filteredEvents || [])
      .filter((e) => {
        const d = new Date(e.starts_at);
        return d >= startOfMonth && d <= endWindow;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

    const groups = [];
    const seen = new Map();
    inRange.forEach((e) => {
      const iso = isoDateCT(new Date(e.starts_at));
      if (!seen.has(iso)) { seen.set(iso, []); groups.push(iso); }
      seen.get(iso).push(e);
    });
    return groups.map((iso) => ({ iso, events: seen.get(iso) }));
  }, [filteredEvents, year, monthIndex]);

  const todayIso = isoDateCT(new Date());

  return (
    <div className="flex-1 overflow-y-auto bg-omega-cloud">
      {/* Month navigation header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-xl border border-gray-200 text-omega-stone">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-base font-bold text-omega-charcoal">
            {MONTH_NAMES[monthIndex]} {year}
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl border border-gray-200 text-omega-stone">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={gotoToday}
          className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-omega-stone">
          Today
        </button>
      </div>

      {loading && (
        <p className="text-xs text-omega-stone text-center py-6">Loading…</p>
      )}

      {!loading && grouped.length === 0 && (
        <div className="px-4 py-12 text-center">
          <CalendarDays className="w-10 h-10 text-omega-fog mx-auto mb-3" />
          <p className="text-sm font-semibold text-omega-charcoal">No events this month</p>
          {canCreate && (
            <button onClick={() => onNewEvent(null)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-omega-orange text-white text-sm font-semibold">
              <Plus className="w-4 h-4" /> New Event
            </button>
          )}
        </div>
      )}

      <div className="px-4 py-4 space-y-4 pb-24">
        {grouped.map(({ iso, events }) => {
          const d = new Date(iso + 'T12:00:00');
          const isToday = iso === todayIso;
          return (
            <div key={iso}>
              {/* Date header */}
              <div className={`flex items-center gap-2 mb-2 ${isToday ? 'text-omega-orange' : 'text-omega-charcoal'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isToday ? 'bg-omega-orange text-white' : 'bg-white border border-gray-200 text-omega-charcoal'
                }`}>
                  {d.getDate()}
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-omega-orange' : 'text-omega-stone'}`}>
                    {DAY_SHORT[d.getDay()]} · {MONTH_NAMES[d.getMonth()].slice(0,3)}
                    {isToday && ' · Today'}
                  </p>
                </div>
                <button
                  onClick={() => onDayClick(iso)}
                  className="ml-auto text-[10px] font-semibold text-omega-orange"
                >
                  View day
                </button>
              </div>

              {/* Events for this day */}
              <div className="space-y-2">
                {events.map((e) => {
                  const meta = eventDisplayMeta(e);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onDayClick(iso)}
                      className="w-full text-left rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-start gap-3 active:bg-omega-cloud transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: meta.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-omega-charcoal truncate">{e.title}</p>
                        <p className="text-xs text-omega-stone mt-0.5">
                          {e.all_day ? 'All day' : formatTimeCT(new Date(e.starts_at))}
                          {e.location && ` · ${e.location}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB — New Event */}
      {canCreate && (
        <button
          onClick={() => onNewEvent(null)}
          className="fixed bottom-20 right-4 z-20 w-14 h-14 rounded-full bg-omega-orange hover:bg-omega-dark text-white shadow-lg flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const [drawerIso, setDrawerIso] = useState(null);
  const [formState, setFormState] = useState(null); // { iso, prefillJob, event }

  // Set of visible kinds for the filter popover. Default: all on.
  const [visibleKinds, setVisibleKinds] = useState(() => new Set(ALL_KINDS));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const canCreate = canCreateAnyEvent(user?.role);

  // Drag-and-drop sensors. PointerSensor handles desktop; TouchSensor
  // with a 200ms hold + 8px tolerance is the same configuration the
  // PipelineKanban uses — quick taps still register as cell clicks
  // (delay isn't met) but a hold-and-drag moves the event to a new day.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function handleDragEnd(dragEvent) {
    const e = dragEvent.active?.data?.current?.event;
    const targetIso = dragEvent.over?.data?.current?.iso;
    if (!e || !targetIso) return;

    // Permission gate — drag is also gated client-side by the canDrag
    // prop, but checking here too prevents a stale state race.
    if (!canEditKind(user?.role, e.kind)) return;

    const sourceIso = isoDateCT(new Date(e.starts_at));
    if (sourceIso === targetIso) return; // no-op

    // Convert YYYY-MM-DD strings to noon-CT Date objects so we can
    // compare day-by-day without timezone surprises.
    const [sy, sm, sd] = sourceIso.split('-').map(Number);
    const [ty, tm, td] = targetIso.split('-').map(Number);
    const sourceDay = new Date(Date.UTC(sy, sm - 1, sd));
    const targetDay = new Date(Date.UTC(ty, tm - 1, td));
    const diffMs = targetDay.getTime() - sourceDay.getTime();

    const oldStart = new Date(e.starts_at);
    const oldEnd   = e.ends_at ? new Date(e.ends_at) : null;
    const newStart = new Date(oldStart.getTime() + diffMs).toISOString();
    const newEnd   = oldEnd
      ? new Date(oldEnd.getTime() + diffMs).toISOString()
      : null;

    // Optimistic update so the pill snaps to the target day immediately.
    setEvents((prev) =>
      prev.map((row) =>
        row.id === e.id
          ? { ...row, starts_at: newStart, ends_at: newEnd ?? row.ends_at }
          : row,
      ),
    );

    // Persist + audit.
    (async () => {
      try {
        const patch = newEnd
          ? { starts_at: newStart, ends_at: newEnd }
          : { starts_at: newStart };
        await updateEvent(e.id, patch);
        logAudit({
          user,
          action: 'event.move',
          entityType: 'calendar_event',
          entityId: e.id,
          details: { from: sourceIso, to: targetIso, kind: e.kind, title: e.title },
        });
      } catch (err) {
        console.error('[calendar] move failed:', err);
        // Roll back on failure so the pill returns to its original day.
        setEvents((prev) =>
          prev.map((row) =>
            row.id === e.id
              ? { ...row, starts_at: oldStart.toISOString(), ends_at: oldEnd?.toISOString() ?? row.ends_at }
              : row,
          ),
        );
      }
    })();
  }

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

  // ─── Mobile: show agenda list instead of month grid ───────────────
  if (isMobile) {
    return (
      <>
        <MobileAgendaView
          year={year}
          monthIndex={monthIndex}
          filteredEvents={filteredEvents}
          loading={loading}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          gotoToday={gotoToday}
          onDayClick={setDrawerIso}
          onNewEvent={openNewEvent}
          canCreate={canCreate}
        />
        {drawerIso && (
          <DayDrawer
            iso={drawerIso}
            user={user}
            onClose={() => setDrawerIso(null)}
            onCreate={(iso) => { setDrawerIso(null); setFormState({ iso, prefillJob: null, event: null }); }}
            onEdit={(event) => { setDrawerIso(null); setFormState({ iso: null, prefillJob: null, event }); }}
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
            onSaved={(saved) => { setFormState(null); refresh(); onVisitScheduled?.(saved); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-omega-cloud">
      {/* Top header — sticky so it stays visible while scrolling the grid.
          Per Ramon's redesign: orange-tinted icon tile to the left of
          the title, Filters as a soft-grey pill with a contador
          (badge) of how many kinds are HIDDEN, New Event in solid
          orange. */}
      <header className="px-4 sm:px-6 lg:px-8 py-5 bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-omega-pale flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-omega-orange" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-omega-charcoal">Calendar</h1>
              <p className="text-xs sm:text-sm text-omega-stone mt-0.5">
                All company events — visits, job starts, inspections, meetings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button
                // stopPropagation on mousedown so FiltersMenu's outside-click
                // handler (which fires on mousedown) doesn't close the popover
                // milliseconds before our toggle re-opens it.
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 hover:border-omega-orange text-omega-charcoal transition"
              >
                <Filter className="w-4 h-4" />
                Filters
                {!allKindsOn && (
                  // Badge shows how many kinds the user currently has
                  // HIDDEN — small orange pill. When everything is on
                  // (no filtering active) the badge is omitted entirely.
                  <span className="ml-0.5 w-5 h-5 inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-omega-orange text-white">
                    {ALL_KINDS.length - visibleKinds.size}
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <MonthView
                year={year}
                monthIndex={monthIndex}
                events={filteredEvents}
                onDayClick={(iso) => setDrawerIso(iso)}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onToday={gotoToday}
                canDragEvent={(e) => canEditKind(user?.role, e.kind)}
              />
            </DndContext>

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
            {/* Event Types breakdown — donut chart per kind for the
                selected range. Reads the same already-loaded events
                array, so changing the dropdown is instant. */}
            <EventTypesDonut events={filteredEvents} referenceDate={new Date(year, monthIndex, 1)} />
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

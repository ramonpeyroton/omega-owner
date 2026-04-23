// Calendar data + helpers.
// Everything is stored in UTC (timestamptz) and displayed in
// America/New_York — the Omega office sits in Fairfield County CT,
// so we don't need user-selectable timezones.

import { supabase } from './supabase';

export const TZ = 'America/New_York';

// One color per event kind. Pipeline-style palette so the calendar
// feels part of the rest of the app.
export const EVENT_KIND_META = {
  sales_visit: { label: 'Sales Visit',  color: '#E8732A' }, // omega orange
  job_start:   { label: 'Job Start',    color: '#22C55E' }, // green
  service_day: { label: 'Service Day',  color: '#3B82F6' }, // blue
  inspection:  { label: 'Inspection',   color: '#EAB308' }, // amber
  meeting:     { label: 'Meeting',      color: '#8B5CF6' }, // violet
};

export const EVENT_KIND_OPTIONS = Object.entries(EVENT_KIND_META).map(
  ([value, meta]) => ({ value, label: meta.label, color: meta.color })
);

// ─── Date helpers (all respect CT timezone) ─────────────────────────

/** Return the local YYYY-MM-DD string for a Date in CT. */
export function isoDateCT(d) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${day}`;
}

export function formatTimeCT(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
}

export function formatDateLongCT(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(d);
}

export function formatMonthCT(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, month: 'long', year: 'numeric',
  }).format(d);
}

/** Build a 42-cell month grid (6 weeks × 7 days, Sun-first). */
export function buildMonthGrid(year, monthIndex /* 0-11 */) {
  // First/last day of the target month in UTC terms — we just need
  // ordinal dates, not timezone math here.
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const firstDow = firstOfMonth.getUTCDay(); // 0 = Sun
  const daysIn = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const cells = [];
  const startOffset = firstDow; // how many "previous month" cells to prepend
  for (let i = 0; i < 42; i++) {
    const dayOffset = i - startOffset;
    const d = new Date(Date.UTC(year, monthIndex, 1 + dayOffset));
    cells.push({
      date: d,
      iso: isoDateCT(d),
      day: d.getUTCDate(),
      isCurrentMonth: d.getUTCMonth() === monthIndex && d.getUTCFullYear() === year,
      isToday: isoDateCT(d) === isoDateCT(new Date()),
    });
  }
  return cells;
}

/** Convert a YYYY-MM-DD date + HH:mm time (CT) into a UTC ISO string. */
export function composeCTDateTime(isoDate, hhmm) {
  // Pull the month/day/year as local CT, then synthesize a Date whose
  // toLocaleString('en-US', {timeZone:'America/New_York'}) matches the
  // requested wall time.
  const [yy, mm, dd] = isoDate.split('-').map(Number);
  const [h, m] = (hhmm || '00:00').split(':').map(Number);

  // Start with a UTC guess then adjust by the TZ offset of CT on that day.
  const utcGuess = new Date(Date.UTC(yy, (mm - 1), dd, h, m));
  const offsetMs = ctOffsetMs(utcGuess);
  return new Date(utcGuess.getTime() - offsetMs).toISOString();
}

/** Offset of America/New_York relative to UTC for a given instant, in ms.
 *  Returns negative numbers (e.g. -5h in EST, -4h in EDT). */
export function ctOffsetMs(date = new Date()) {
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: TZ }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return tzDate.getTime() - utcDate.getTime();
}

// ─── Supabase queries ──────────────────────────────────────────────

export async function loadEventsForRange(startISO, endISO) {
  try {
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('starts_at', startISO)
      .lt('starts_at', endISO)
      .order('starts_at', { ascending: true });
    return data || [];
  } catch { return []; }
}

export async function loadEventsForMonth(year, monthIndex) {
  // Pull a bit wider than the month itself because the grid shows
  // leading/trailing days from prev/next month.
  const start = new Date(Date.UTC(year, monthIndex - 0, 1));
  start.setUTCDate(start.getUTCDate() - 7);
  const end   = new Date(Date.UTC(year, monthIndex + 1, 1));
  end.setUTCDate(end.getUTCDate() + 7);
  return loadEventsForRange(start.toISOString(), end.toISOString());
}

/**
 * Conflict detection for sales_visit. Returns the blocking event if
 * the proposed window collides with an existing event for the same
 * assignee, or null when free.
 */
export async function findConflict({ startsAt, endsAt, assignedToName, ignoreId }) {
  if (!assignedToName) return null;
  try {
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('assigned_to_name', assignedToName)
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt);
    const rows = (data || []).filter((r) => r.id !== ignoreId);
    return rows[0] || null;
  } catch { return null; }
}

export async function createEvent(event) {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert([event])
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id, patch) {
  const { data, error } = await supabase
    .from('calendar_events')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ─── Role permissions ──────────────────────────────────────────────
// Who can do what on the calendar. View is open to all logged-in roles;
// editing is scoped to the kinds that role naturally owns.

const EDIT_ALL = new Set(['owner', 'operations', 'admin']);

export function canEditKind(role, kind) {
  if (EDIT_ALL.has(role)) return true;
  if (role === 'receptionist') return kind === 'sales_visit';
  if (role === 'sales')        return kind === 'sales_visit';
  if (role === 'manager')      return ['job_start', 'service_day', 'inspection', 'meeting'].includes(kind);
  return false;
}

export function canCreateAnyEvent(role) {
  return EDIT_ALL.has(role) || ['receptionist', 'sales', 'manager'].includes(role);
}

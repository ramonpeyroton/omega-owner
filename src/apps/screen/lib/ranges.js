// Date range helpers used by the Screen dashboard.
// All ranges are inclusive of start and exclusive of end, expressed as
// ISO strings so Supabase comparisons are simple and timezone-stable
// (Supabase stores timestamptz, JS Date.toISOString() is UTC).

function atStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-start week. Returns {start, end} as ISO strings. */
export function weekRange(now = new Date()) {
  const d = atStartOfDay(now);
  const dow = d.getDay();                // 0 = Sun, 1 = Mon, ...
  const delta = (dow + 6) % 7;           // days since Monday
  const start = new Date(d);
  start.setDate(start.getDate() - delta);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Previous week (Mon-Sun). */
export function prevWeekRange(now = new Date()) {
  const { start, end } = weekRange(now);
  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);
  return { start: prevStart.toISOString(), end: prevEnd.toISOString() };
}

export function monthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function prevMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Year-to-date (Jan 1 of `now` year → now). */
export function ytdRange(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: start.toISOString(), end: new Date().toISOString() };
}

/** Friendly date heading for the TV (e.g. "Monday · April 20"). */
export function formatHeaderDate(now = new Date()) {
  return now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function formatClockTime(now = new Date()) {
  return now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

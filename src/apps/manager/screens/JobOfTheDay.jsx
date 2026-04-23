import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Calendar, ChevronRight, Store, Check, HardHat } from 'lucide-react';
import { supabase } from '../lib/supabase';
import QuickTasksList from '../../../shared/components/QuickTasksList';
import { logAudit } from '../../../shared/lib/audit';

/**
 * Gabriel's home screen — the three things that drive his day:
 *   1. My Punch List — tasks he writes down (from Inácio + subs)
 *   2. Materials Run — inline shopping list grouped by store, with
 *      tap-to-buy checkboxes right here (no need to open a separate
 *      screen unless he wants filters)
 *   3. Today's Schedule — calendar events for today + work-in-progress
 *      jobs as implicit "working on…" markers
 *
 * Active Jobs list lives on the Jobs tab — kept off this screen so
 * the three actionable blocks above get room to breathe.
 */
const EXCLUDED_PIPELINE = ['completed', 'estimate_rejected'];

export default function JobOfTheDay({ user, onNavigate, onSelectJob }) {
  const [todayEvents, setTodayEvents] = useState([]);
  const [activeJobs, setActiveJobs]   = useState([]);  // still fetched — shown in schedule
  const [materials, setMaterials]     = useState([]);  // [{ ...mat, jobs: {...} }]
  const [loading, setLoading]         = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true);
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(now); dayEnd.setHours(23, 59, 59, 999);

    try {
      const [evRes, jobsRes, matsRes, jobsAllRes] = await Promise.all([
        supabase
          .from('calendar_events')
          .select('*, jobs:job_id ( id, client_name, address, city, client_phone, service, phase_data )')
          .gte('starts_at', dayStart.toISOString())
          .lte('starts_at', dayEnd.toISOString())
          .order('starts_at', { ascending: true }),
        supabase
          .from('jobs')
          .select('id, client_name, address, city, client_phone, service, phase_data, updated_at, pipeline_status')
          .eq('pipeline_status', 'in_progress')
          .order('updated_at', { ascending: false }),
        supabase
          .from('job_materials')
          .select('*')
          .eq('status', 'needed')
          .order('added_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('id, client_name, city, service, pipeline_status'),
      ]);

      setTodayEvents(evRes.data || []);
      setActiveJobs(jobsRes.data || []);

      // Join materials ↔ jobs client-side and drop any tied to closed jobs.
      const jobById = new Map((jobsAllRes.data || []).map((j) => [j.id, j]));
      const live = (matsRes.data || [])
        .map((m) => ({ ...m, jobs: jobById.get(m.job_id) || null }))
        .filter((m) => m.jobs && !EXCLUDED_PIPELINE.includes(m.jobs.pipeline_status));
      setMaterials(live);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function markBought(item) {
    try {
      await supabase.from('job_materials').update({
        status: 'bought',
        bought_at: new Date().toISOString(),
        bought_by: user?.name || null,
      }).eq('id', item.id);
      setMaterials((prev) => prev.filter((m) => m.id !== item.id));
      logAudit({ user, action: 'material.bought', entityType: 'job_material', entityId: item.id });
    } catch { /* ignore */ }
  }

  const nowLabel = useMemo(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }), []);

  // Group materials by store for the shopping list.
  const byStore = useMemo(() => {
    const map = {};
    for (const m of materials) {
      const k = m.store || 'Unspecified';
      (map[k] = map[k] || []).push(m);
    }
    // Stable sort: named stores A→Z, Unspecified last.
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'Unspecified') return 1;
      if (b === 'Unspecified') return -1;
      return a.localeCompare(b);
    });
  }, [materials]);

  return (
    <div className="flex-1 overflow-y-auto bg-omega-cloud">
      <header className="px-6 md:px-8 py-5 bg-white border-b border-gray-200 sticky top-0 z-10">
        <p className="text-[11px] uppercase tracking-[0.2em] text-omega-stone font-bold">Today</p>
        <h1 className="text-xl font-bold text-omega-charcoal">{nowLabel}</h1>
      </header>

      <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

        {/* ─── 1) Personal punch list ───────────────────────────── */}
        <QuickTasksList user={user} />

        {/* ─── 2) Materials Run — inline, grouped by store ─────── */}
        <MaterialsInline
          byStore={byStore}
          totalCount={materials.length}
          loading={loading}
          onMark={markBought}
          onOpenFull={() => onNavigate?.('materials-run')}
        />

        {/* ─── 3) Today's schedule ─────────────────────────────── */}
        <TodaySchedule
          events={todayEvents}
          inProgress={activeJobs}
          loading={loading}
          onOpenCalendar={() => onNavigate?.('calendar')}
          onOpenJob={onSelectJob}
        />
      </div>
    </div>
  );
}

// ─── Materials Run inline ──────────────────────────────────────
// Soft orange tint in the header so Gabriel can spot this block at
// a glance. Body stays white for readability over long lists.
function MaterialsInline({ byStore, totalCount, loading, onMark, onOpenFull }) {
  return (
    <section className="bg-white rounded-2xl border border-omega-orange/20 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-omega-orange/15 bg-omega-pale/50 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-omega-orange" />
          <h2 className="text-sm font-bold text-omega-charcoal tracking-tight">Materials Run</h2>
          <span className="text-[10px] font-bold text-omega-orange bg-white/70 px-2 py-0.5 rounded-full">
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <button
          onClick={onOpenFull}
          className="text-[11px] text-omega-orange font-bold inline-flex items-center gap-1 hover:underline"
        >
          Open full <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading && <p className="px-4 py-3 text-xs text-omega-stone">Loading…</p>}

      {!loading && totalCount === 0 && (
        <p className="px-4 py-6 text-xs text-omega-stone italic text-center">
          Nothing to buy right now. Materials added inside a job show up here.
        </p>
      )}

      {!loading && byStore.map(([store, items]) => (
        <div key={store} className="border-t border-gray-100 first-of-type:border-t-0">
          <div className="px-4 py-2 bg-omega-pale/30 flex items-center gap-1.5">
            <Store className="w-3 h-3 text-omega-orange" />
            <p className="text-[11px] uppercase tracking-wider font-bold text-omega-slate">{store}</p>
            <span className="text-[10px] font-bold text-omega-stone ml-auto">{items.length}</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {items.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                <button
                  onClick={() => onMark(m)}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 hover:border-omega-orange hover:bg-omega-pale flex-shrink-0 flex items-center justify-center transition-colors"
                  title="Mark bought"
                  aria-label="Mark bought"
                >
                  <Check className="w-3 h-3 text-omega-orange opacity-0 hover:opacity-100" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-omega-charcoal">{m.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-omega-stone mt-0.5">
                    {m.quantity && <span className="font-semibold">{m.quantity}</span>}
                    {m.jobs?.client_name && <span>· {m.jobs.client_name}</span>}
                    {m.jobs?.city && <span>· {m.jobs.city}</span>}
                    {m.notes && <span className="italic">· {m.notes}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

// ─── Today's schedule ──────────────────────────────────────────
// Formal calendar events + an implicit "working on" row for every
// in-progress job. The whole card is clickable to open the month view.
function TodaySchedule({ events, inProgress, loading, onOpenCalendar, onOpenJob }) {
  const hasEvents  = events.length > 0;
  const hasJobs    = inProgress.length > 0;
  const empty      = !loading && !hasEvents && !hasJobs;

  return (
    <section className="bg-white rounded-2xl border border-violet-200 overflow-hidden shadow-sm">
      <button
        onClick={onOpenCalendar}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-violet-100 bg-violet-50/60 hover:bg-violet-50 text-left transition-colors"
      >
        <div className="inline-flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-600" />
          <h2 className="text-sm font-bold text-omega-charcoal tracking-tight">Today's Schedule</h2>
          <span className="text-[10px] font-bold text-violet-700 bg-white/70 px-2 py-0.5 rounded-full">
            {events.length + inProgress.length}
          </span>
        </div>
        <span className="text-[11px] text-violet-600 font-bold inline-flex items-center gap-1">
          Open calendar <ChevronRight className="w-3 h-3" />
        </span>
      </button>

      {loading && <p className="px-4 py-3 text-xs text-omega-stone">Loading…</p>}

      {empty && (
        <p className="px-4 py-6 text-xs text-omega-stone italic text-center">
          Nothing scheduled today.
        </p>
      )}

      {hasEvents && (
        <ul className="divide-y divide-gray-100">
          {events.map((ev) => (
            <li key={ev.id} className="px-4 py-2.5 flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold text-[11px] tabular-nums flex-shrink-0">
                {new Date(ev.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
              <span className="text-sm text-omega-charcoal truncate flex-1">{ev.title}</span>
            </li>
          ))}
        </ul>
      )}

      {hasJobs && (
        <div className={hasEvents ? 'border-t border-gray-100' : ''}>
          <p className="px-4 pt-2 text-[10px] uppercase tracking-wider text-omega-stone font-bold">
            Jobs in progress
          </p>
          <ul className="divide-y divide-gray-100">
            {inProgress.map((j) => (
              <li key={j.id} className="px-4 py-2 flex items-center gap-3">
                <HardHat className="w-3.5 h-3.5 text-omega-orange flex-shrink-0" />
                <button
                  onClick={() => onOpenJob?.(j)}
                  className="text-sm text-omega-charcoal truncate flex-1 text-left hover:text-omega-orange"
                >
                  {j.client_name || 'Untitled'}
                  {j.service && <span className="text-omega-stone font-normal"> · {j.service}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

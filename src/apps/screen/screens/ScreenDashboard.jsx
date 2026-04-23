import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import logoImg from '../../../assets/logo.png';
import { supabase } from '../../../shared/lib/supabase';
import { getSettingNumber } from '../../../shared/lib/settings';
import { PIPELINE_COLORS, PIPELINE_STEP_LABEL, PIPELINE_ORDER } from '../../../shared/config/phaseBreakdown';
import { formatHeaderDate, formatClockTime } from '../lib/ranges';
import {
  loadWeekKpi, loadMonthKpi, loadActiveProjects, loadSalesRankingMonth, loadYtdRevenue,
  loadDailySeries, loadPipelineDistribution, loadMonthlyRevenue, loadServiceMix,
} from '../lib/metrics';
import { unlockAudio, isUnlocked } from '../lib/bells';
import Celebration from '../components/Celebration';
import { Sparkline, Donut, BarChart, HBars } from '../components/Charts';

const DATA_REFRESH_MS = 60_000;
const CLOCK_TICK_MS  = 1_000;

// ─── Formatting ─────────────────────────────────────────────────────
function moneyShort(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  if (v > 0)          return `$${Math.round(v).toLocaleString()}`;
  return '—';
}
function fmtInt(n) { return (Number(n) || 0).toLocaleString(); }

function delta(curr, prev) {
  const c = Number(curr) || 0; const p = Number(prev) || 0;
  if (p === 0 && c === 0) return { label: '—', trend: 'flat' };
  if (p === 0)            return { label: 'NEW', trend: 'up' };
  const d = c - p;
  if (d === 0) return { label: '±0', trend: 'flat' };
  return { label: `${d > 0 ? '+' : ''}${Math.round((d / p) * 100)}%`, trend: d > 0 ? 'up' : 'down' };
}
function deltaAbs(curr, prev) {
  const d = (Number(curr) || 0) - (Number(prev) || 0);
  if (d === 0) return { label: '±0', trend: 'flat' };
  return { label: `${d > 0 ? '+' : ''}${d}`, trend: d > 0 ? 'up' : 'down' };
}

// Accent colors for each KPI — gives the dashboard variety without
// being noisy. Mapped per row so the same KPI keeps its hue.
const ACCENTS = {
  leads:     '#22D3EE', // cyan
  visits:    '#A78BFA', // violet
  estimates: '#F97316', // omega orange
  contracts: '#34D399', // emerald
};

export default function ScreenDashboard({ onLogout }) {
  const [now, setNow]           = useState(() => new Date());
  const [week, setWeek]         = useState(null);
  const [month, setMonth]       = useState(null);
  const [ytd, setYtd]           = useState(0);
  const [goal, setGoal]         = useState(6_000_000);
  const [active, setActive]     = useState({ shown: [], total: 0 });
  const [ranking, setRanking]   = useState([]);
  const [series, setSeries]     = useState({ leads: [], visits: [], estimates: [], contracts: [] });
  const [pipeline, setPipeline] = useState([]);
  const [monthly, setMonthly]   = useState([]);
  const [mix, setMix]           = useState([]);
  const [celebrations, setCelebrations] = useState([]);

  const seenEventIds = useRef(new Set());
  const [soundReady, setSoundReady] = useState(false);

  // ─── Initial + periodic data load ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [w, m, y, g, act, rank, s, p, mo, sm] = await Promise.all([
        loadWeekKpi(),
        loadMonthKpi(),
        loadYtdRevenue(),
        getSettingNumber('annual_goal_2026', 6_000_000),
        loadActiveProjects(3),
        loadSalesRankingMonth(),
        loadDailySeries(14),
        loadPipelineDistribution(),
        loadMonthlyRevenue(6),
        loadServiceMix(),
      ]);
      if (cancelled) return;
      setWeek(w); setMonth(m); setYtd(y); setGoal(g);
      setActive(act); setRanking(rank);
      setSeries(s); setPipeline(p); setMonthly(mo); setMix(sm);
    }
    load();
    const iv = setInterval(load, DATA_REFRESH_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onLogout?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLogout]);

  // Unlock Web Audio on first user gesture. Browsers block AudioContext
  // until they see a real click / keydown. The PIN-typing on login already
  // counts, but a fresh reload needs one more interaction — show a hint
  // until the context is running.
  useEffect(() => {
    function unlock() {
      if (unlockAudio()) setSoundReady(true);
    }
    // Try now (might already be unlocked from login)
    if (isUnlocked()) setSoundReady(true);
    else {
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown',     unlock, { once: true });
    }
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown',     unlock);
    };
  }, []);

  // ─── Realtime celebrations (3 triggers, deduped) ─────────────────
  useEffect(() => {
    const chan = supabase
      .channel('screen-celebrations')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs' },
        (payload) => {
          const row = payload?.new;
          if (!row?.id || seenEventIds.current.has(`lead:${row.id}`)) return;
          seenEventIds.current.add(`lead:${row.id}`);
          setCelebrations((c) => [...c, {
            id: `lead:${row.id}:${Date.now()}`,
            kind: 'lead',
            subtitle: [row.client_name, row.city || row.service].filter(Boolean).join(' · '),
          }]);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contracts' },
        (payload) => {
          const n = payload?.new; const o = payload?.old;
          if (!n?.id || !n.signed_at || o?.signed_at) return;
          const dedup = `ctr:${n.job_id || n.id}`;
          if (seenEventIds.current.has(dedup)) return;
          seenEventIds.current.add(dedup);
          setCelebrations((c) => [...c, {
            id: `${dedup}:${Date.now()}`, kind: 'contract',
            subtitle: n.total_amount ? `$${Number(n.total_amount).toLocaleString()}` : undefined,
          }]);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs' },
        (payload) => {
          const n = payload?.new; const o = payload?.old;
          if (!n?.id || n.pipeline_status !== 'contract_signed' || o?.pipeline_status === 'contract_signed') return;
          const dedup = `ctr:${n.id}`;
          if (seenEventIds.current.has(dedup)) return;
          seenEventIds.current.add(dedup);
          setCelebrations((c) => [...c, {
            id: `${dedup}:${Date.now()}`, kind: 'contract',
            subtitle: [n.client_name, n.service].filter(Boolean).join(' · '),
          }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, []);

  function dismissCelebration(id) {
    setCelebrations((c) => c.filter((x) => x.id !== id));
  }

  const goalPct = useMemo(() => {
    if (!goal) return 0;
    return Math.max(0, Math.min(100, Math.round((ytd / goal) * 10000) / 100));
  }, [ytd, goal]);

  // Pipeline slices ordered by canonical pipeline order + colors from config.
  const pipelineSlices = useMemo(() => {
    const map = Object.fromEntries(pipeline.map((p) => [p.status, p.count]));
    return PIPELINE_ORDER
      .map((status) => ({
        status,
        label: PIPELINE_STEP_LABEL[status] || status,
        value: map[status] || 0,
        color: PIPELINE_COLORS[status]?.hex || '#6B7280',
      }))
      .filter((s) => s.value > 0);
  }, [pipeline]);
  const pipelineTotal = pipelineSlices.reduce((a, s) => a + s.value, 0);

  return (
    <div className="h-screen w-screen bg-[#0a0e18] text-white select-none overflow-hidden font-sans flex flex-col">
      {/* Subtle radial gradient — adds depth without clutter */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(52,211,153,0.08),transparent_50%)]" />

      {/* ═══ Top strip ═════════════════════════════════════════════ */}
      <header className="relative z-10 flex items-center gap-4 px-5 pt-3 pb-2 border-b border-white/[0.06]">
        <img src={logoImg} alt="Omega" className="h-8 w-auto opacity-95 flex-shrink-0" />
        <div className="flex items-baseline gap-3 min-w-0">
          <p className="text-white/45 text-[9px] uppercase tracking-[0.3em] font-semibold">Omega Pulse</p>
          <p className="text-white font-bold text-sm truncate">{formatHeaderDate(now)}</p>
          <p className="text-white/50 text-xs font-mono tabular-nums">{formatClockTime(now)}</p>
        </div>

        <div className="ml-auto flex items-center gap-2 min-w-[320px]">
          <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/50">2026 Goal</p>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-omega-orange to-amber-400 transition-all duration-700 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <p className="text-white/60 text-[11px] font-semibold tabular-nums whitespace-nowrap">
            <span className="text-white font-black">{moneyShort(ytd)}</span>
            <span className="mx-0.5 text-white/30">/</span>
            {moneyShort(goal)}
          </p>
          <p className="text-omega-orange font-black text-xs tabular-nums w-[42px] text-right">{goalPct}%</p>
        </div>

        <button onClick={onLogout} className="text-white/25 hover:text-white/70 text-[9px] uppercase tracking-widest inline-flex items-center gap-1">
          <LogOut className="w-3 h-3" /> Esc
        </button>
      </header>

      {/* Sound-unlock hint — only visible until audio is ready. */}
      {!soundReady && (
        <div className="relative z-20 flex justify-center pt-1">
          <span className="text-[10px] uppercase tracking-widest text-white/45 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1 animate-pulse">
            🔔 Click anywhere to enable celebration sounds
          </span>
        </div>
      )}

      {/* ═══ KPI grid — with sparklines ═══════════════════════════ */}
      <section className="relative z-10 px-5 pt-2.5 pb-1.5 grid grid-cols-[auto_repeat(4,_1fr)] gap-2 items-stretch">
        <RowLabel>This<br/>Week</RowLabel>
        <KpiCard label="Leads"     value={fmtInt(week?.leads)}     delta={deltaAbs(week?.leads,     week?.prev?.leads)}     accent={ACCENTS.leads}     spark={series.leads.slice(-7)} />
        <KpiCard label="Visits"    value={fmtInt(week?.visits)}    delta={deltaAbs(week?.visits,    week?.prev?.visits)}    accent={ACCENTS.visits}    spark={series.visits.slice(-7)} />
        <KpiCard label="Est. Sent" value={fmtInt(week?.estimates)} delta={deltaAbs(week?.estimates, week?.prev?.estimates)} accent={ACCENTS.estimates} spark={series.estimates.slice(-7)} />
        <KpiCard label="Contracts" value={fmtInt(week?.contracts)} delta={deltaAbs(week?.contracts, week?.prev?.contracts)} accent={ACCENTS.contracts} spark={series.contracts.slice(-7)} sub={moneyShort(week?.revenue)} />

        <RowLabel>This<br/>Month</RowLabel>
        <KpiCard label="Leads"     value={fmtInt(month?.leads)}     delta={delta(month?.leads,     month?.prev?.leads)}     accent={ACCENTS.leads}     spark={series.leads} />
        <KpiCard label="Visits"    value={fmtInt(month?.visits)}    delta={delta(month?.visits,    month?.prev?.visits)}    accent={ACCENTS.visits}    spark={series.visits} />
        <KpiCard label="Est. Sent" value={fmtInt(month?.estimates)} delta={delta(month?.estimates, month?.prev?.estimates)} accent={ACCENTS.estimates} spark={series.estimates} />
        <KpiCard label="Contracts" value={fmtInt(month?.contracts)} delta={delta(month?.contracts, month?.prev?.contracts)} accent={ACCENTS.contracts} spark={series.contracts} sub={moneyShort(month?.revenue)} />
      </section>

      {/* ═══ Visual row — pipeline donut + revenue bars + service mix ═ */}
      <section className="relative z-10 px-5 pb-2 grid grid-cols-[1.1fr_1.4fr_1fr] gap-2">
        {/* Pipeline donut */}
        <Panel title="Pipeline" subtitle={`${pipelineTotal} jobs`}>
          <div className="flex items-center justify-center gap-3 py-0.5">
            <Donut
              slices={pipelineSlices}
              size={110}
              thickness={14}
              centerLabel="Total"
              centerValue={pipelineTotal}
            />
            <div className="flex-1 space-y-0.5 min-w-0">
              {pipelineSlices.slice(0, 5).map((s) => (
                <LegendRow key={s.status} color={s.color} label={s.label} value={s.value} />
              ))}
              {pipelineSlices.length === 0 && (
                <p className="text-white/40 text-[10px] italic">No jobs yet.</p>
              )}
            </div>
          </div>
        </Panel>

        {/* Monthly revenue bars */}
        <Panel title="Revenue · Last 6 Months">
          <BarChart bars={monthly} height={110} color="#F97316" />
        </Panel>

        {/* Service mix */}
        <Panel title="Service Mix · YTD">
          {mix.length > 0
            ? <HBars rows={mix.slice(0, 5)} color="#34D399" />
            : <p className="text-white/40 text-[10px] italic px-1">No jobs yet this year.</p>}
        </Panel>
      </section>

      {/* ═══ Bottom — ranking + active projects ════════════════════
          Natural height (no flex-1) so it only takes the space it needs.
          The extra room at the bottom of the screen absorbs any TV
          overscan that would otherwise clip this row. */}
      <section className="relative z-10 px-5 pb-3 grid grid-cols-[1fr_1.4fr] gap-2">
        <Panel
          title={<><Trophy className="inline w-3 h-3 mr-1 text-amber-300 -translate-y-[1px]" /> Top Salesperson · Month</>}
        >
          <div className="space-y-1">
            {ranking.slice(0, 3).map((r, i) => <RankRow key={r.name} row={r} rank={i + 1} />)}
            {ranking.length === 0 && (
              <p className="text-white/40 text-[10px] italic">No contracts signed yet this month.</p>
            )}
          </div>
        </Panel>

        <Panel title={<>Active Projects <span className="text-white/40 ml-1 font-black">{active.total}</span></>}>
          <div className="grid grid-cols-3 gap-1.5">
            {active.shown.map((p) => <ProjectCard key={p.id} project={p} />)}
            {active.total === 0 && <p className="text-white/40 text-[10px] italic px-1">No active projects.</p>}
          </div>
          {active.total > active.shown.length && (
            <p className="text-white/40 text-[9px] font-bold mt-1">+ {active.total - active.shown.length} more</p>
          )}
        </Panel>
      </section>

      <Celebration items={celebrations} onDone={dismissCelebration} />
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────
function Panel({ title, subtitle, children }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 flex flex-col min-h-0 backdrop-blur-sm">
      <div className="flex items-baseline justify-between mb-1.5">
        <h2 className="text-white/55 text-[9px] uppercase tracking-[0.3em] font-bold">{title}</h2>
        {subtitle && <p className="text-white/35 text-[9px] font-semibold">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function RowLabel({ children }) {
  return (
    <div className="flex items-center justify-end pr-1">
      <span className="text-white/70 text-sm font-black tracking-tight uppercase leading-[1.05] text-right">
        {children}
      </span>
    </div>
  );
}

function KpiCard({ label, value, sub, delta, accent, spark }) {
  return (
    <div
      className="rounded-xl bg-white/[0.04] border border-white/5 px-3 py-2 flex flex-col justify-between relative overflow-hidden"
      style={{ boxShadow: `inset 0 1px 0 ${hexAlpha(accent, 0.1)}` }}
    >
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between gap-1 relative">
        <p className="text-[8px] uppercase tracking-[0.3em] text-white/45 font-bold truncate">{label}</p>
        {delta && <DeltaChip delta={delta} />}
      </div>
      <div className="flex items-end justify-between gap-2 mt-0.5 relative">
        <div className="min-w-0">
          <p className="text-2xl font-black leading-none tabular-nums" style={{ color: accent }}>{value}</p>
          {sub && <p className="text-white/70 text-[10px] font-bold tabular-nums mt-0.5">{sub}</p>}
        </div>
        {spark && spark.length > 1 && (
          <div className="flex-shrink-0">
            <Sparkline values={spark} color={accent} height={24} width={70} />
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaChip({ delta }) {
  const color =
    delta.trend === 'up'   ? 'text-emerald-400' :
    delta.trend === 'down' ? 'text-red-400'     :
                             'text-white/35';
  const Icon =
    delta.trend === 'up'   ? TrendingUp :
    delta.trend === 'down' ? TrendingDown : Minus;
  return (
    <p className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${color}`}>
      <Icon className="w-3 h-3" /> {delta.label}
    </p>
  );
}

function LegendRow({ color, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
      <span className="text-[11px] text-white/80 font-semibold truncate flex-1">{label}</span>
      <span className="text-[11px] text-white font-black tabular-nums">{value}</span>
    </div>
  );
}

function RankRow({ row, rank }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/5 px-2.5 py-1.5 flex items-center gap-2">
      <span className="text-lg leading-none">{medal}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold truncate leading-tight">{row.name}</p>
        <p className="text-white/45 text-[9px] font-semibold">{row.count} contract{row.count === 1 ? '' : 's'}</p>
      </div>
      <p className="text-emerald-400 font-black text-xs tabular-nums whitespace-nowrap">
        {moneyShort(row.revenue)}
      </p>
    </div>
  );
}

function ProjectCard({ project }) {
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/5 p-2 min-w-0">
      <div className="flex items-baseline justify-between gap-1.5">
        <p className="text-[11px] font-bold truncate">{project.client || 'Untitled'}</p>
        <p className="text-omega-orange text-sm font-black tabular-nums">{project.progress}%</p>
      </div>
      <p className="text-white/40 text-[9px] font-semibold truncate">
        {[project.service, project.location].filter(Boolean).join(' · ') || '—'}
      </p>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1">
        <div
          className="h-full bg-gradient-to-r from-omega-orange to-amber-400 transition-all duration-700"
          style={{ width: `${project.progress || 0}%` }}
        />
      </div>
      {project.phase && (
        <p className="text-white/40 text-[9px] font-semibold mt-0.5 truncate">← {project.phase}</p>
      )}
    </div>
  );
}

// Utility — tiny helper used inline in this file
function hexAlpha(hex, alpha) {
  const s = String(hex || '').replace('#', '');
  if (s.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

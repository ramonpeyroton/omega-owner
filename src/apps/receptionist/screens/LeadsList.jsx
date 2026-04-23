import { useEffect, useState, useMemo } from 'react';
import { MapPin, Clock, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Toast from '../components/Toast';
import {
  PIPELINE_STEP_LABEL,
  PIPELINE_COLORS,
} from '../../../shared/config/phaseBreakdown';

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This Week' },
  { id: 'all',   label: 'All' },
];

function startOf(scope) {
  const d = new Date();
  if (scope === 'today') {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (scope === 'week') {
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return null; // all
}

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function LeadsList({ onBack }) {
  const [filter, setFilter] = useState('today');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from('jobs')
        .select('id, client_name, service, city, pipeline_status, preferred_visit_date, preferred_visit_time, availability_window, created_at, created_by')
        .eq('created_by', 'receptionist')
        .order('created_at', { ascending: false })
        .limit(200);

      const gt = startOf(filter);
      if (gt) q = q.gte('created_at', gt);

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to load leads' });
    } finally {
      setLoading(false);
    }
  }

  const empty = !loading && rows.length === 0;

  return (
    <div className="flex-1 flex flex-col bg-omega-cloud overflow-y-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-white border-b border-gray-200 px-6 md:px-8 py-5 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-omega-charcoal">My Leads</h1>
        <p className="text-xs text-omega-stone mt-0.5">Leads you created — filter by period below.</p>
      </header>

      {/* Filter tabs */}
      <div className="bg-white border-b border-gray-200 px-6 md:px-8 py-2 flex gap-2 sticky top-[68px] z-10">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
              filter === f.id
                ? 'bg-omega-orange text-white'
                : 'bg-omega-cloud text-omega-slate hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-omega-stone">{rows.length} lead{rows.length === 1 ? '' : 's'}</span>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full space-y-2">
        {loading && <p className="text-sm text-omega-stone text-center py-10">Loading…</p>}
        {empty && (
          <div className="text-center py-12">
            <p className="text-sm text-omega-stone">No leads yet.</p>
            <button
              onClick={onBack}
              className="mt-4 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-omega-orange hover:bg-omega-dark text-white text-sm font-semibold"
            >
              Create a lead
            </button>
          </div>
        )}

        {!loading && rows.map((r) => <LeadCard key={r.id} row={r} />)}
      </main>
    </div>
  );
}

function LeadCard({ row }) {
  const pipelineKey = row.pipeline_status || 'new_lead';
  const badgeBg = PIPELINE_COLORS[pipelineKey]?.tailwindBg || 'bg-gray-400';
  const stepLabel = PIPELINE_STEP_LABEL[pipelineKey] || pipelineKey;

  const timeBits = [];
  if (row.preferred_visit_date) timeBits.push(row.preferred_visit_date);
  if (row.preferred_visit_time) timeBits.push(row.preferred_visit_time);
  if (row.availability_window)  timeBits.push(row.availability_window);
  const timeLine = timeBits.join(' · ');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="font-bold text-omega-charcoal text-base truncate">{row.client_name || 'Untitled'}</p>
        <span className="text-[11px] text-omega-stone flex-shrink-0">{timeAgo(row.created_at)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {row.service && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-omega-pale text-omega-orange font-semibold text-[10px] uppercase tracking-wider">
            {row.service}
          </span>
        )}
        {row.city && (
          <span className="inline-flex items-center gap-1 text-xs text-omega-stone">
            <MapPin className="w-3 h-3" /> {row.city}
          </span>
        )}
      </div>

      {timeLine && (
        <p className="text-xs text-omega-stone inline-flex items-center gap-1 mb-2">
          <Clock className="w-3 h-3" /> {timeLine}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md text-white ${badgeBg}`}>
          {stepLabel}
        </span>
      </div>
    </div>
  );
}

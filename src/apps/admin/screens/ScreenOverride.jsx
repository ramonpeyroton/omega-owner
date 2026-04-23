import { useEffect, useState } from 'react';
import { Monitor, Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { loadScreenOverrides, saveScreenOverrides } from '../../../shared/lib/screenOverrides';
import { logAudit } from '../../../shared/lib/audit';

const EMPTY_CONTRACT = () => ({ client: '', service: '', amount: '', signed_at: '' });
const EMPTY_SERVICE  = () => ({ service: '', count: '', revenue: '' });

// Admin-only page for manually populating the Screen (TV) dashboard's
// headline numbers. Anything left blank falls back to live data from
// jobs/contracts — so Ramon can bootstrap the dashboard with real-world
// numbers before the actual data pipeline is filled.
export default function ScreenOverride({ user }) {
  const [form, setForm]     = useState({
    pipeline_value:   '',
    contracts_signed: '',
    new_leads:        '',
    avg_job_value:    '',
    note:             '',
    recent_contracts: [],
    top_services:     [],
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);

  useEffect(() => { (async () => {
    const row = await loadScreenOverrides();
    setForm({
      pipeline_value:   row.pipeline_value   ?? '',
      contracts_signed: row.contracts_signed ?? '',
      new_leads:        row.new_leads        ?? '',
      avg_job_value:    row.avg_job_value    ?? '',
      note:             row.note             ?? '',
      recent_contracts: Array.isArray(row.recent_contracts) ? row.recent_contracts : [],
      top_services:     Array.isArray(row.top_services) ? row.top_services : [],
    });
    setLoaded(true);
  })(); }, []);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function updateListItem(key, index, field, value) {
    setForm((f) => {
      const next = [...f[key]];
      next[index] = { ...next[index], [field]: value };
      return { ...f, [key]: next };
    });
  }

  function addListItem(key, empty) {
    setForm((f) => ({ ...f, [key]: [...f[key], empty()] }));
  }

  function removeListItem(key, index) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));
  }

  function numOrNull(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function save() {
    setSaving(true);
    try {
      const recent = form.recent_contracts
        .filter((c) => c.client?.trim() || c.amount)
        .map((c) => ({
          client:    c.client?.trim() || '',
          service:   c.service?.trim() || '',
          amount:    numOrNull(c.amount),
          signed_at: c.signed_at || null,
        }));
      const services = form.top_services
        .filter((s) => s.service?.trim() || s.count || s.revenue)
        .map((s) => ({
          service: s.service?.trim() || '',
          count:   numOrNull(s.count),
          revenue: numOrNull(s.revenue),
        }));
      await saveScreenOverrides({
        pipeline_value:   numOrNull(form.pipeline_value),
        contracts_signed: numOrNull(form.contracts_signed),
        new_leads:        numOrNull(form.new_leads),
        avg_job_value:    numOrNull(form.avg_job_value),
        note:             form.note?.trim() || null,
        recent_contracts: recent.length ? recent : null,
        top_services:     services.length ? services : null,
      }, user?.name);
      logAudit({ user, action: 'screen.override.save', entityType: 'screen_overrides', entityId: '1' });
      setToast({ type: 'success', message: 'Screen dashboard updated.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function clearAll() {
    if (!window.confirm('Clear ALL manual overrides? The dashboard will revert to live data.')) return;
    setSaving(true);
    try {
      await saveScreenOverrides({
        pipeline_value: null, contracts_signed: null, new_leads: null, avg_job_value: null,
        note: null, recent_contracts: null, top_services: null,
      }, user?.name);
      setForm({ pipeline_value: '', contracts_signed: '', new_leads: '', avg_job_value: '', note: '', recent_contracts: [], top_services: [] });
      setToast({ type: 'success', message: 'Overrides cleared.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to clear' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (!loaded) return <div className="p-8 text-sm text-omega-stone">Loading…</div>;

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-omega-orange focus:ring-1 focus:ring-omega-orange outline-none';
  const numInputCls = `${inputCls} tabular-nums`;

  return (
    <div className="flex-1 overflow-y-auto bg-omega-cloud">
      <header className="bg-white border-b border-gray-200 px-6 md:px-8 py-5 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-omega-charcoal inline-flex items-center gap-2">
          <Monitor className="w-5 h-5 text-omega-orange" /> Screen Dashboard — Overrides
        </h1>
        <p className="text-xs text-omega-stone mt-0.5">
          Numbers typed here show on the TV immediately (auto-refreshes every 60s). Leave a field blank to fall back to live data from jobs/contracts.
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* KPI row */}
        <Section title="Headline KPIs — This Month">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabeledInput
              label="Pipeline Value"
              prefix="$"
              value={form.pipeline_value}
              onChange={(v) => set('pipeline_value', v)}
              placeholder="e.g. 1250000"
              hint="Total $ value of everything currently in the pipeline."
            />
            <LabeledInput
              label="Contracts Signed"
              value={form.contracts_signed}
              onChange={(v) => set('contracts_signed', v)}
              placeholder="e.g. 7"
              hint="# of contracts signed this month."
            />
            <LabeledInput
              label="New Leads"
              value={form.new_leads}
              onChange={(v) => set('new_leads', v)}
              placeholder="e.g. 42"
              hint="# of new leads this month."
            />
            <LabeledInput
              label="Avg Job Value"
              prefix="$"
              value={form.avg_job_value}
              onChange={(v) => set('avg_job_value', v)}
              placeholder="e.g. 38500"
              hint="Average $ value of signed jobs."
            />
          </div>
          <div className="mt-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-omega-stone mb-1.5">
              Dashboard note <span className="text-omega-stone font-normal normal-case">(optional — shows as a caption)</span>
            </label>
            <input className={inputCls} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. Q2 goal: $2M" />
          </div>
        </Section>

        {/* Recent contracts list */}
        <Section
          title="Recent Contracts Signed"
          action={
            <button onClick={() => addListItem('recent_contracts', EMPTY_CONTRACT)} className="inline-flex items-center gap-1 text-xs font-bold text-omega-orange hover:text-omega-dark">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          }
          hint="Up to 5 rows show on the dashboard, most recent first."
        >
          {form.recent_contracts.length === 0 && (
            <p className="text-xs text-omega-stone italic">None — falls back to live `contracts` table.</p>
          )}
          <div className="space-y-2">
            {form.recent_contracts.map((row, i) => (
              <div key={i} className="grid grid-cols-[1.3fr_1fr_110px_130px_auto] gap-2 items-center">
                <input className={inputCls} value={row.client} onChange={(e) => updateListItem('recent_contracts', i, 'client', e.target.value)} placeholder="Client" />
                <input className={inputCls} value={row.service} onChange={(e) => updateListItem('recent_contracts', i, 'service', e.target.value)} placeholder="Service" />
                <input type="number" className={numInputCls} value={row.amount} onChange={(e) => updateListItem('recent_contracts', i, 'amount', e.target.value)} placeholder="Amount" />
                <input type="date" className={inputCls} value={row.signed_at ? String(row.signed_at).slice(0, 10) : ''} onChange={(e) => updateListItem('recent_contracts', i, 'signed_at', e.target.value)} />
                <button onClick={() => removeListItem('recent_contracts', i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Remove row">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* Top services list */}
        <Section
          title="Top Services"
          action={
            <button onClick={() => addListItem('top_services', EMPTY_SERVICE)} className="inline-flex items-center gap-1 text-xs font-bold text-omega-orange hover:text-omega-dark">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          }
          hint="Shows as horizontal bars on the dashboard, largest revenue first."
        >
          {form.top_services.length === 0 && (
            <p className="text-xs text-omega-stone italic">None — falls back to live data.</p>
          )}
          <div className="space-y-2">
            {form.top_services.map((row, i) => (
              <div key={i} className="grid grid-cols-[1.5fr_110px_140px_auto] gap-2 items-center">
                <input className={inputCls} value={row.service} onChange={(e) => updateListItem('top_services', i, 'service', e.target.value)} placeholder="Service (e.g. Bathroom)" />
                <input type="number" className={numInputCls} value={row.count} onChange={(e) => updateListItem('top_services', i, 'count', e.target.value)} placeholder="# Jobs" />
                <input type="number" className={numInputCls} value={row.revenue} onChange={(e) => updateListItem('top_services', i, 'revenue', e.target.value)} placeholder="Revenue $" />
                <button onClick={() => removeListItem('top_services', i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Remove row">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 pb-8 sticky bottom-0 bg-omega-cloud/95 backdrop-blur-sm">
          <button onClick={clearAll} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-omega-slate hover:bg-gray-50 disabled:opacity-60">
            <RotateCcw className="w-4 h-4" /> Clear all overrides
          </button>
          <div className="flex-1" />
          {toast && (
            <span className={`text-xs font-bold ${toast.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {toast.message}
            </span>
          )}
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-omega-orange hover:bg-omega-dark text-white text-sm font-bold disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </main>
    </div>
  );
}

function Section({ title, hint, action, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-omega-charcoal uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {hint && <p className="text-[11px] text-omega-stone mb-3">{hint}</p>}
      {children}
    </section>
  );
}

function LabeledInput({ label, prefix, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-omega-stone mb-1.5">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-omega-stone text-sm font-semibold pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${prefix ? 'pl-7' : 'pl-3'} pr-3 py-2 rounded-lg border border-gray-300 text-sm tabular-nums focus:border-omega-orange focus:ring-1 focus:ring-omega-orange outline-none`}
        />
      </div>
      {hint && <p className="text-[11px] text-omega-stone mt-1">{hint}</p>}
    </div>
  );
}

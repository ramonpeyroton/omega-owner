import { useEffect, useState } from 'react';
import {
  FileText, Plus, Trash2, ChevronUp, ChevronDown, Save, Mail, Loader2,
  AlertCircle, CheckCircle2, Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';

// Defaults reused whenever a brand-new estimate is opened. Mirrors the
// structure of the ServiceFusion template the owner provided.
const DEFAULT_PAYMENT = `Payment Schedule:
Deposit - 30%
Upon Start 30%
After Painting Completion 30%
Upon Completion 10%`;

function emptyItem()    { return { description: '', scope: '', price: 0 }; }
function emptySection() { return { title: 'Section 1', items: [emptyItem()] }; }

export default function EstimateBuilder({ job, user, onJobUpdated }) {
  const [estimate, setEstimate] = useState(null); // existing db row (if any)
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [sending, setSending]   = useState(false);
  const [toast, setToast]       = useState(null);

  // Form state
  const [headerDescription, setHeaderDescription] = useState('');
  const [sections, setSections] = useState([emptySection()]);
  const [customerMessage, setCustomerMessage] = useState(DEFAULT_PAYMENT);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [job?.id]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('estimates').select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (data) {
        setEstimate(data);
        setHeaderDescription(data.header_description || '');
        setSections(Array.isArray(data.sections) && data.sections.length ? data.sections : [emptySection()]);
        setCustomerMessage(data.customer_message || DEFAULT_PAYMENT);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  // ─── Section / item helpers ───────────────────────────────────────
  function updateSection(idx, patch) {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }
  function addSection() {
    setSections((prev) => [...prev, { title: `Section ${prev.length + 1}`, items: [emptyItem()] }]);
  }
  function removeSection(idx) {
    if (sections.length === 1) { setSections([emptySection()]); return; }
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }
  function moveSection(idx, dir) {
    setSections((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }
  function updateItem(sIdx, iIdx, patch) {
    setSections((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s;
      return { ...s, items: s.items.map((it, j) => j === iIdx ? { ...it, ...patch } : it) };
    }));
  }
  function addItem(sIdx) {
    setSections((prev) => prev.map((s, i) => i === sIdx ? { ...s, items: [...s.items, emptyItem()] } : s));
  }
  function removeItem(sIdx, iIdx) {
    setSections((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const items = s.items.filter((_, j) => j !== iIdx);
      return { ...s, items: items.length ? items : [emptyItem()] };
    }));
  }

  // ─── Totals ───────────────────────────────────────────────────────
  const total = sections.reduce((acc, sec) =>
    acc + (sec.items || []).reduce((a, it) => a + (Number(it.price) || 0), 0), 0);

  // ─── Persistence ──────────────────────────────────────────────────
  async function persist(extra = {}) {
    const base = {
      job_id: job.id,
      header_description: headerDescription,
      sections,
      customer_message: customerMessage,
      total_amount: total,
      status: 'draft',
      ...extra,
    };
    if (estimate?.id) {
      const { data, error } = await supabase
        .from('estimates').update(base).eq('id', estimate.id)
        .select().single();
      if (error) throw error;
      return data;
    } else {
      // First-save gets a human-readable estimate number from the sequence.
      const { data: seqData } = await supabase.rpc('next_estimate_number').select();
      // The RPC may not exist — fall back to null and the server will backfill.
      const number = (Array.isArray(seqData) && seqData[0]) || null;
      const { data, error } = await supabase
        .from('estimates')
        .insert([{ ...base, estimate_number: number }])
        .select().single();
      if (error) throw error;
      return data;
    }
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const saved = await persist();
      setEstimate(saved);
      // Promote the job to estimate_draft on first save (if still new_lead).
      if (!job.pipeline_status || job.pipeline_status === 'new_lead') {
        const { data: j } = await supabase
          .from('jobs').update({ pipeline_status: 'estimate_draft' })
          .eq('id', job.id).select().single();
        if (j) onJobUpdated?.(j);
      }
      logAudit({ user, action: 'estimate.save', entityType: 'estimate', entityId: saved.id, details: { total } });
      setToast({ type: 'success', message: 'Estimate saved' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to save' });
    }
    setSaving(false);
  }

  async function handleSend() {
    if (!job.client_email) {
      setToast({ type: 'error', message: "Client has no email on file. Add it under Details first." });
      return;
    }
    setSending(true);
    setToast(null);
    try {
      // Always save first so the email sends the latest data.
      const saved = await persist();
      setEstimate(saved);

      const res = await fetch('/api/send-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-omega-role': user?.role || '',
          'x-omega-user': user?.name || '',
        },
        body: JSON.stringify({ estimateId: saved.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      // Promote to estimate_sent on successful send.
      const { data: j } = await supabase
        .from('jobs').update({ pipeline_status: 'estimate_sent' })
        .eq('id', job.id).select().single();
      if (j) onJobUpdated?.(j);

      // Refresh the estimate so status + pdf_url reflect server updates.
      const { data: updated } = await supabase
        .from('estimates').select('*').eq('id', saved.id).maybeSingle();
      if (updated) setEstimate(updated);

      logAudit({ user, action: 'estimate.send', entityType: 'estimate', entityId: saved.id, details: { to: job.client_email, total } });
      setToast({ type: 'success', message: `Sent to ${job.client_email}` });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to send' });
    }
    setSending(false);
  }

  if (loading) {
    return <p className="text-sm text-omega-stone py-10 text-center">Loading estimate…</p>;
  }

  return (
    <div className="space-y-5">

      {/* Header block */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-omega-charcoal inline-flex items-center gap-2">
              <FileText className="w-4 h-4 text-omega-orange" /> Estimate
              {estimate?.estimate_number && (
                <span className="text-omega-stone text-sm font-bold tabular-nums">#{estimate.estimate_number}</span>
              )}
            </h2>
            <p className="text-xs text-omega-stone mt-0.5">
              {estimate?.created_at
                ? `Last saved ${new Date(estimate.updated_at || estimate.created_at).toLocaleString()}`
                : 'Draft — not saved yet.'}
            </p>
          </div>
          {estimate?.pdf_url && (
            <a
              href={estimate.pdf_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-omega-charcoal hover:border-omega-orange"
            >
              <Download className="w-3.5 h-3.5" /> Last PDF
            </a>
          )}
        </div>

        <label className="block mt-4">
          <span className="text-[10px] font-semibold text-omega-stone uppercase tracking-wider">Description (top of estimate)</span>
          <textarea
            rows={3}
            value={headerDescription}
            onChange={(e) => setHeaderDescription(e.target.value)}
            placeholder='e.g. "Construction of a ___ sq. ft. deck using pressure-treated wood…"'
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none"
          />
        </label>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((sec, sIdx) => (
          <SectionCard
            key={sIdx}
            section={sec}
            onTitle={(v) => updateSection(sIdx, { title: v })}
            onMoveUp={() => moveSection(sIdx, -1)}
            onMoveDown={() => moveSection(sIdx, +1)}
            onRemove={() => removeSection(sIdx)}
            onUpdateItem={(iIdx, patch) => updateItem(sIdx, iIdx, patch)}
            onAddItem={() => addItem(sIdx)}
            onRemoveItem={(iIdx) => removeItem(sIdx, iIdx)}
            disableUp={sIdx === 0}
            disableDown={sIdx === sections.length - 1}
          />
        ))}

        <button
          onClick={addSection}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-omega-stone hover:border-omega-orange hover:text-omega-orange text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> Add Section
        </button>
      </div>

      {/* Footer */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
        <label className="block">
          <span className="text-[10px] font-semibold text-omega-stone uppercase tracking-wider">Customer Message / Payment Schedule</span>
          <textarea
            rows={6}
            value={customerMessage}
            onChange={(e) => setCustomerMessage(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none font-mono"
          />
        </label>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm font-semibold text-omega-charcoal uppercase tracking-wider">Estimate Total</span>
          <span className="text-3xl font-black text-omega-orange tabular-nums">
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {toast && (
          <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            }
            <p className="font-semibold">{toast.message}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving || sending}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-omega-orange text-omega-orange hover:bg-omega-pale disabled:opacity-60 text-sm font-bold"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Draft</>}
          </button>
          <button
            onClick={handleSend}
            disabled={saving || sending || total <= 0}
            title={total <= 0 ? 'Add at least one priced item before sending' : ''}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-omega-orange hover:bg-omega-dark disabled:opacity-60 text-white text-sm font-bold"
          >
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Save &amp; Send to Client</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ section, onTitle, onMoveUp, onMoveDown, onRemove, onUpdateItem, onAddItem, onRemoveItem, disableUp, disableDown }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-omega-pale/40 border-b border-omega-orange/20 flex items-center gap-2">
        <input
          value={section.title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Section title"
          className="flex-1 bg-transparent text-sm font-bold text-omega-charcoal focus:outline-none"
        />
        <button onClick={onMoveUp} disabled={disableUp}   className="p-1 rounded text-omega-stone hover:text-omega-charcoal disabled:opacity-30" title="Move up"><ChevronUp className="w-4 h-4" /></button>
        <button onClick={onMoveDown} disabled={disableDown} className="p-1 rounded text-omega-stone hover:text-omega-charcoal disabled:opacity-30" title="Move down"><ChevronDown className="w-4 h-4" /></button>
        <button onClick={onRemove} className="p-1 rounded text-red-500 hover:bg-red-50" title="Remove section"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="divide-y divide-gray-100">
        {section.items.map((it, iIdx) => (
          <ItemRow
            key={iIdx}
            item={it}
            index={iIdx + 1}
            onChange={(patch) => onUpdateItem(iIdx, patch)}
            onRemove={() => onRemoveItem(iIdx)}
          />
        ))}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 bg-white">
        <button
          onClick={onAddItem}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-omega-orange hover:bg-omega-pale"
        >
          <Plus className="w-3 h-3" /> Add Item
        </button>
      </div>
    </div>
  );
}

function ItemRow({ item, index, onChange, onRemove }) {
  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-[1fr_1.5fr_140px_auto] gap-3">
      <div>
        <label className="text-[10px] font-semibold text-omega-stone uppercase tracking-wider">#{index} — Description</label>
        <input
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="e.g. Gutter & Downspout Installation"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-omega-stone uppercase tracking-wider">Scope of Work</label>
        <textarea
          rows={3}
          value={item.scope}
          onChange={(e) => onChange({ scope: e.target.value })}
          placeholder={"- Remove existing gutters from home.\n- Reconfigure one gutter downspout.\n- Install leaf guards…"}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none font-mono leading-relaxed"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-omega-stone uppercase tracking-wider">Price</label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-omega-stone font-bold">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={item.price === 0 ? '' : item.price}
            onChange={(e) => onChange({ price: Number(e.target.value) || 0 })}
            placeholder="0.00"
            className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm tabular-nums focus:border-omega-orange focus:outline-none text-right font-semibold"
          />
        </div>
      </div>
      <div className="flex items-end">
        <button
          onClick={onRemove}
          className="p-2 rounded-lg text-red-500 hover:bg-red-50"
          title="Remove item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  ShoppingCart, Plus, Check, Trash2, Store, DollarSign, Loader2, Undo2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';

const STORES = ['Home Depot', 'Lowes', "Ring's End", 'Ferguson', 'Other'];

/**
 * Per-job materials list. Gabriel adds what he needs, marks items
 * "bought" as he buys them. The aggregated shopping list (across all
 * active jobs) lives in MaterialsRun which reads the same rows.
 */
export default function MaterialsSection({ job, user }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [form, setForm]         = useState({ name: '', quantity: '', store: '', notes: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [job?.id]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('job_materials')
        .select('*')
        .eq('job_id', job.id)
        .order('status', { ascending: true })   // needed first, then bought
        .order('added_at', { ascending: false });
      setItems(data || []);
    } catch { setItems([]); }
    setLoading(false);
  }

  async function addItem() {
    const name = form.name.trim();
    if (!name) { setError('Name is required'); return; }
    setError('');
    setSaving(true);
    try {
      const { data, error: e } = await supabase.from('job_materials').insert([{
        job_id:   job.id,
        name,
        quantity: form.quantity.trim() || null,
        store:    form.store || null,
        notes:    form.notes.trim() || null,
        added_by: user?.name || null,
      }]).select().single();
      if (e) throw e;
      setItems((prev) => [data, ...prev]);
      setForm({ name: '', quantity: '', store: '', notes: '' });
      setAdding(false);
      logAudit({ user, action: 'material.add', entityType: 'job_material', entityId: data.id, details: { name, job_id: job.id } });
    } catch (e) {
      setError(e.message || 'Failed to add');
    }
    setSaving(false);
  }

  async function toggleBought(item) {
    const nowBought = item.status !== 'bought';
    try {
      const patch = nowBought
        ? { status: 'bought', bought_at: new Date().toISOString(), bought_by: user?.name || null }
        : { status: 'needed', bought_at: null, bought_by: null };
      const { data } = await supabase.from('job_materials')
        .update(patch).eq('id', item.id).select().single();
      if (data) setItems((prev) => prev.map((it) => it.id === data.id ? data : it));
      logAudit({ user, action: nowBought ? 'material.bought' : 'material.reopen', entityType: 'job_material', entityId: item.id });
    } catch { /* ignore */ }
  }

  async function removeItem(item) {
    if (!confirm(`Remove "${item.name}"?`)) return;
    try {
      await supabase.from('job_materials').delete().eq('id', item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch { /* ignore */ }
  }

  const needed = items.filter((i) => i.status === 'needed');
  const bought = items.filter((i) => i.status === 'bought');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-omega-charcoal inline-flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-omega-orange" /> Materials
          <span className="text-[11px] font-bold text-omega-stone bg-gray-100 px-2 py-0.5 rounded-full">
            {needed.length} to buy
          </span>
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-omega-orange hover:bg-omega-pale"
          >
            <Plus className="w-3.5 h-3.5" /> Add Material
          </button>
        )}
      </div>
      <p className="text-xs text-omega-stone mb-3">
        Track what to buy per job — shows up automatically on the Materials Run shopping list.
      </p>

      {adding && (
        <div className="rounded-xl bg-omega-pale/40 border border-omega-orange/30 p-3 mb-3 space-y-2">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Quartz countertop slab 3cm, Calacatta"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none bg-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="Quantity (e.g. 2 slabs)"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none bg-white"
            />
            <select
              value={form.store}
              onChange={(e) => setForm({ ...form, store: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none bg-white"
            >
              <option value="">Store…</option>
              {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-omega-orange focus:outline-none bg-white"
          />
          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setError(''); }} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-white">
              Cancel
            </button>
            <button
              onClick={addItem}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-omega-orange hover:bg-omega-dark disabled:opacity-60 text-white text-xs font-bold"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Plus className="w-3.5 h-3.5" /> Add</>}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-omega-stone">Loading…</p>}

      {!loading && items.length === 0 && !adding && (
        <p className="text-sm text-omega-stone italic text-center py-6">No materials tracked yet.</p>
      )}

      <div className="space-y-2">
        {needed.map((it) => (
          <Row key={it.id} item={it} onToggle={toggleBought} onRemove={removeItem} />
        ))}
        {bought.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-widest text-omega-stone font-bold mt-4 mb-1">Bought</p>
            {bought.map((it) => (
              <Row key={it.id} item={it} onToggle={toggleBought} onRemove={removeItem} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ item, onToggle, onRemove }) {
  const bought = item.status === 'bought';
  return (
    <div className={`group flex items-start gap-3 p-2.5 rounded-xl border ${
      bought ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-omega-orange/40'
    }`}>
      <button
        onClick={() => onToggle(item)}
        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
          bought
            ? 'bg-omega-success border-omega-success'
            : 'border-gray-300 hover:border-omega-orange'
        }`}
        title={bought ? 'Mark as needed' : 'Mark as bought'}
      >
        {bought && <Check className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${bought ? 'text-omega-stone line-through' : 'text-omega-charcoal'}`}>
          {item.name}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-omega-stone mt-0.5">
          {item.quantity && <span>{item.quantity}</span>}
          {item.store && (
            <span className="inline-flex items-center gap-0.5">
              <Store className="w-3 h-3" /> {item.store}
            </span>
          )}
          {bought && item.price != null && (
            <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
              <DollarSign className="w-3 h-3" /> {Number(item.price).toLocaleString()}
            </span>
          )}
          {bought && item.bought_by && <span>· by {item.bought_by}</span>}
          {item.notes && <span className="italic">· {item.notes}</span>}
        </div>
      </div>
      <button
        onClick={() => onRemove(item)}
        className="p-1 rounded text-omega-stone hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

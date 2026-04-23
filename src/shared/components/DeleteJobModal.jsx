import { useState } from 'react';
import { Eye, EyeOff, Trash2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';

// Owner PIN is the only PIN that authorizes a job deletion. Both Owner
// and Operations see the delete button, but the modal always requires
// this PIN — the audit log records which role/user *typed* it so the
// Admin knows who actually pressed the button.
const OWNER_PIN = '3333';

export default function DeleteJobModal({ job, user, onClose, onDeleted }) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    if (pin !== OWNER_PIN) {
      setError('Incorrect PIN. Try again.');
      logAudit({
        user, action: 'job.delete.pin_failed', entityType: 'job', entityId: job?.id,
        details: { client: job?.client_name, attempted_pin_prefix: (pin || '').slice(0, 1) + '***' },
      });
      return;
    }
    setDeleting(true);
    try {
      const { error: e } = await supabase.from('jobs').delete().eq('id', job.id);
      if (e) throw e;
      logAudit({
        user, action: 'job.delete', entityType: 'job', entityId: job.id,
        details: {
          client: job.client_name,
          service: job.service,
          pipeline_status: job.pipeline_status,
          pin_used: OWNER_PIN,
          authorized_by: user?.name || null,
          authorized_by_role: user?.role || null,
        },
      });
      onDeleted?.(job);
    } catch (err) {
      setError(err.message || 'Failed to delete');
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={() => !deleting && onClose?.()}
    >
      <div className="bg-white rounded-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-red-600" />
            <p className="font-bold text-red-700 text-lg">Delete Job</p>
          </div>
          <p className="text-sm text-omega-stone">This action cannot be undone. Owner PIN required.</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-omega-stone uppercase">Owner PIN</label>
            <div className="relative mt-1">
              <input
                autoFocus
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                className="w-full px-3 py-2.5 pr-10 rounded-lg border-2 border-gray-200 focus:border-red-400 focus:outline-none text-base font-mono tracking-[0.3em]"
                placeholder="••••"
              />
              <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-2 top-1/2 -translate-y-1/2 text-omega-stone">
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 font-semibold mt-1.5">{error}</p>}
          </div>
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-800 font-semibold">{job?.client_name || 'Untitled'}</p>
            <p className="text-[11px] text-red-700 mt-0.5">{job?.address || ''}</p>
          </div>
          <p className="text-[11px] text-omega-stone">
            Authorized deletions are logged in the audit trail with the name and role of the person who entered the PIN.
          </p>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} disabled={deleting} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting || !pin} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60">
            <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

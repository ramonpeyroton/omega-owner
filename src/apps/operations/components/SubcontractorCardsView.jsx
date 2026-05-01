import { useMemo, useState } from 'react';
import { Plus, HardHat, Phone, Mail, MapPin, CheckCircle2, Clock, DollarSign, Edit3, Search, X } from 'lucide-react';
import COIBadge, { getCoiState } from './COIBadge';
import { subDisplayNames } from '../../../shared/lib/subcontractor';

// Agreement status palette mirrors the chip style used elsewhere.
const AGR_STATUS_META = {
  draft:     { label: 'DRAFT',     cls: 'bg-gray-200 text-gray-700' },
  sent:      { label: 'SENT',      cls: 'bg-blue-100 text-blue-700' },
  accepted:  { label: 'ACCEPTED',  cls: 'bg-green-100 text-green-700' },
  rejected:  { label: 'REJECTED',  cls: 'bg-red-100 text-red-700' },
  signed:    { label: 'SIGNED',    cls: 'bg-emerald-600 text-white' },
  completed: { label: 'DONE',      cls: 'bg-emerald-700 text-white' },
};

function paymentLabel(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return 'TBD';
  if (plan.length === 1) return '100% on completion';
  if (plan.length === 2 && Number(plan[0]?.percent) === 50) return '50 / 50';
  return plan.map((p) => `${p.percent}%`).join(' / ');
}

function money(n) {
  const v = Number(n) || 0;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// One big card per sub, listing every agreement (job assignment)
// underneath. Brenda asked for this layout so she can see at a glance
// what each sub has done, what is pending, and how each one is being
// paid:
//   Ramon Glass
//     • 484 Bridgeport Ave: Install shower glass — DONE — multiple — $4,200
//     • 902 Black Rock: Install window glass — TODO — 50/50 — $1,800
export default function SubcontractorCardsView({ subs, agreements, jobs, onAddSub, onAddAgreement, onEditSub }) {
  // Free-text filter — matches against contact name, company name,
  // phone, email and trade so Brenda can find a sub by anything she
  // remembers about them.
  const [searchText, setSearchText] = useState('');

  const jobsById = useMemo(() => {
    const map = new Map();
    (jobs || []).forEach((j) => map.set(j.id, j));
    return map;
  }, [jobs]);

  // Group agreements by sub_id so each card shows only its own jobs.
  const agreementsBySub = useMemo(() => {
    const map = new Map();
    (agreements || []).forEach((a) => {
      const list = map.get(a.subcontractor_id) || [];
      list.push(a);
      map.set(a.subcontractor_id, list);
    });
    // Newest job at the top of each card.
    for (const [k, list] of map) {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      map.set(k, list);
    }
    return map;
  }, [agreements]);

  // Sort alphabetically by the primary display name (contact, then
  // company), then apply the search filter. Sorting first keeps the
  // visible list ordered no matter what the user types.
  const visibleSubs = useMemo(() => {
    const sorted = [...(subs || [])].sort((a, b) => {
      const an = subDisplayNames(a).primary.toLowerCase();
      const bn = subDisplayNames(b).primary.toLowerCase();
      return an.localeCompare(bn);
    });
    const q = searchText.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((s) => {
      const { primary, secondary } = subDisplayNames(s);
      const hay = [
        primary,
        secondary || '',
        s.phone || '',
        s.email || '',
        s.trade || '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [subs, searchText]);

  if (!subs || subs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <HardHat className="w-10 h-10 text-omega-fog mx-auto mb-3" />
        <p className="text-omega-charcoal font-bold">No subcontractors yet</p>
        <p className="text-sm text-omega-stone mt-1 mb-5">
          Add your first sub from the Roster tab to start assigning them to jobs.
        </p>
        <button
          onClick={onAddSub}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-omega-orange hover:bg-omega-dark text-white text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> Add Subcontractor
        </button>
      </div>
    );
  }

  const totalAssignments = (agreements || []).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-omega-stone">
          {visibleSubs.length} of {subs.length} {subs.length === 1 ? 'subcontractor' : 'subcontractors'}
          {' · '}
          {totalAssignments} total {totalAssignments === 1 ? 'assignment' : 'assignments'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddAgreement}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:border-omega-orange text-omega-charcoal text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> New Assignment
          </button>
          <button
            onClick={onAddSub}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-omega-orange hover:bg-omega-dark text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> Add Subcontractor
          </button>
        </div>
      </div>

      {/* Search — client-side, matches contact/company/phone/email/trade.
          Cleared via the X button on the right. */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-omega-stone pointer-events-none" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name, company, phone, email or trade…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-omega-orange focus:outline-none transition"
        />
        {searchText && (
          <button
            onClick={() => setSearchText('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-omega-stone hover:text-omega-charcoal"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {visibleSubs.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-omega-stone">
          No subcontractors match "{searchText}".
        </div>
      )}

      {visibleSubs.map((sub) => {
        const subAgreements = agreementsBySub.get(sub.id) || [];
        const totalValue = subAgreements.reduce((sum, a) => sum + (Number(a.their_estimate) || 0), 0);
        const completedCount = subAgreements.filter((a) => a.status === 'completed' || a.status === 'signed').length;
        // Per Ramon: contact name is what the field crew recognizes day
        // to day, so it leads the card. Company name (if any) drops to
        // a secondary line below in muted text.
        const { primary, secondary } = subDisplayNames(sub);

        return (
          <div key={sub.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Compact single-row header. Each card now occupies one
                line so Brenda can scan many subs at once; details for
                a sub are reachable through "Edit Sub". When the sub
                has agreements, a thin list appears below — capped to
                ~4 rows so a busy sub doesn't grow the card forever. */}
            <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-omega-charcoal truncate">{primary}</h3>
                {sub.trade && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-omega-stone bg-omega-cloud border border-gray-200 px-1.5 py-0.5 rounded">
                    {sub.trade}
                  </span>
                )}
                <COIBadge expiryDate={sub.coi_expiry_date} />
                {secondary && (
                  <span className="text-xs text-omega-stone truncate">{secondary}</span>
                )}
                {sub.phone && (
                  <span className="text-xs text-omega-stone inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {sub.phone}
                  </span>
                )}
                {sub.email && (
                  <span className="text-xs text-omega-stone inline-flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3" /> {sub.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="text-sm font-black text-omega-charcoal tabular-nums leading-tight">{money(totalValue)}</div>
                  <div className="text-[10px] text-omega-stone leading-tight">
                    {completedCount}/{subAgreements.length} {subAgreements.length === 1 ? 'job' : 'jobs'}
                  </div>
                </div>
                <button
                  onClick={() => onEditSub(sub)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-omega-orange text-xs font-bold text-omega-charcoal"
                >
                  <Edit3 className="w-3 h-3" /> Edit Sub
                </button>
              </div>
            </div>

            {/* Thin agreement rows — one line each. Capped so the card
                doesn't drift back to the old "very tall" feel for a
                busy sub. Click "Edit Sub" to see everything. */}
            {subAgreements.length > 0 && (
              <ul className="border-t border-gray-100">
                {subAgreements.slice(0, 4).map((agr) => {
                  const job = jobsById.get(agr.job_id);
                  const meta = AGR_STATUS_META[agr.status] || { label: (agr.status || 'DRAFT').toUpperCase(), cls: 'bg-gray-200 text-gray-700' };
                  const isDone = agr.status === 'completed' || agr.status === 'signed';
                  const address = job?.address || 'Unknown address';
                  const clientName = job?.client_name || '';
                  return (
                    <li key={agr.id} className="px-4 py-1.5 flex items-center gap-2 text-xs border-t border-gray-50 hover:bg-omega-pale/20">
                      {isDone
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        : <Clock className="w-3.5 h-3.5 text-omega-stone flex-shrink-0" />}
                      <span className="truncate text-omega-charcoal flex-1 min-w-0">
                        <MapPin className="inline w-3 h-3 text-omega-stone mr-1 -mt-0.5" />
                        {address}
                        {clientName && <span className="text-omega-stone"> — {clientName}</span>}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {agr.their_estimate > 0 && (
                        <span className="font-bold text-omega-charcoal tabular-nums flex-shrink-0">
                          {money(agr.their_estimate)}
                        </span>
                      )}
                    </li>
                  );
                })}
                {subAgreements.length > 4 && (
                  <li className="px-4 py-1.5 text-[11px] text-omega-stone text-center border-t border-gray-50">
                    +{subAgreements.length - 4} more — open Edit Sub to see all
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Clock, ClipboardEdit, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MarkdownReport from './MarkdownReport';
import { generateReport } from '../../apps/sales/lib/anthropic';
import { logAudit } from '../lib/audit';

// Roles allowed to trigger (re)generation from the shared job view.
// Sales generates during the flow anyway; Owner/Operations/Admin can
// refresh from the card for old clients or after questionnaire edits.
const CAN_REGEN = new Set(['owner', 'operations', 'admin', 'sales']);

/**
 * AI project report viewer. Reads from `job_reports` (versioned) and
 * now also offers a Regenerate button to (re)build the report right
 * from the job card — useful for old clients or after questionnaire
 * updates. Generation is an explicit click to keep AI costs in check.
 */
export default function ProjectReportSection({ job, user, onOpenQuestionnaire, onJobUpdated }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);

  const canRegen = CAN_REGEN.has(user?.role);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [job?.id]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('job_reports')
        .select('*')
        .eq('job_id', job.id)
        .order('version', { ascending: false })
        .limit(10);
      const rows = data || [];
      if (rows.length === 0 && (job.latest_report || job.report_raw)) {
        rows.push({
          id: 'current',
          version: 1,
          report_content: job.latest_report || job.report_raw,
          generated_at: job.report_generated_at || job.updated_at || job.created_at,
        });
      }
      setVersions(rows);
      setSelectedIdx(0);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    if (!canRegen) return;
    setGenerating(true);
    setToast(null);
    try {
      const raw = await generateReport(job, job.answers || {}, '', null);
      const nowIso = new Date().toISOString();

      // Update the job with the new "latest" text + reset the modified flag
      const patch = {
        latest_report:         raw,
        report_generated_at:   nowIso,
        questionnaire_modified: false,
        _report_ts:            Date.now(),
      };
      const { data: updatedJob, error: updErr } = await supabase
        .from('jobs').update(patch).eq('id', job.id).select().single();
      if (updErr) throw updErr;
      if (updatedJob) onJobUpdated?.(updatedJob);

      // Append to versioned history (best-effort)
      try {
        const { data: prev } = await supabase
          .from('job_reports')
          .select('version')
          .eq('job_id', job.id)
          .order('version', { ascending: false })
          .limit(1).maybeSingle();
        const nextVersion = (prev?.version || 0) + 1;
        await supabase.from('job_reports').insert([{
          job_id: job.id,
          report_content: raw,
          questionnaire_snapshot: job.answers || {},
          version: nextVersion,
          generated_at: nowIso,
        }]);
      } catch { /* table may be older — non-fatal */ }

      logAudit({ user, action: 'report.regenerate', entityType: 'job', entityId: job.id });
      await load();
      setToast({ type: 'success', message: 'Report regenerated' });
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'Failed to regenerate' });
    } finally {
      setGenerating(false);
    }
  }

  const current = versions[selectedIdx];
  const outdated =
    job.questionnaire_modified ||
    (job.questionnaire_modified_at && current?.generated_at &&
      new Date(job.questionnaire_modified_at) > new Date(current.generated_at));

  if (loading) {
    return <p className="text-sm text-omega-stone py-3">Loading report…</p>;
  }

  if (versions.length === 0) {
    const hasAnswers = !!(job?.answers && Object.keys(job.answers).length > 0);
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <Sparkles className="w-8 h-8 text-omega-orange mx-auto mb-3" />
        <p className="font-bold text-omega-charcoal">Report not generated yet</p>
        <p className="text-xs text-omega-stone mt-1 max-w-sm mx-auto">
          {hasAnswers
            ? 'This client has questionnaire answers but no AI report yet. You can generate one now.'
            : 'The AI report is generated from questionnaire answers. Open the questionnaire first.'}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          {onOpenQuestionnaire && (
            <button
              onClick={onOpenQuestionnaire}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:border-omega-orange text-omega-charcoal text-sm font-semibold"
            >
              <ClipboardEdit className="w-4 h-4" /> Open Questionnaire
            </button>
          )}
          {canRegen && hasAnswers && (
            <button
              onClick={regenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-omega-orange hover:bg-omega-dark disabled:opacity-60 text-white text-sm font-semibold"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> Generate Report</>
              }
            </button>
          )}
        </div>
        {toast && (
          <p className={`mt-3 text-xs font-semibold ${toast.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {toast.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Outdated warning — now with an active Regenerate button for
          roles that can trigger the AI. */}
      {outdated && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <RefreshCw className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-red-800 font-semibold">
              The questionnaire was modified after this report was generated.
            </p>
            {canRegen ? (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={regenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {generating
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating…</>
                    : <><RefreshCw className="w-3 h-3" /> Regenerate now</>
                  }
                </button>
                <span className="text-[11px] text-red-700">to reflect the latest answers.</span>
              </div>
            ) : (
              <p className="text-[11px] text-red-700 mt-0.5">Ask Sales or Operations to regenerate.</p>
            )}
          </div>
        </div>
      )}

      {/* Meta + version picker + (always-on) Regenerate for allowed roles */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] text-omega-stone">
        <div className="inline-flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Saved {current.generated_at ? new Date(current.generated_at).toLocaleString() : '—'}
          {current.version && <span className="ml-1 px-1.5 py-0.5 rounded bg-omega-pale text-omega-orange font-semibold">v{current.version}</span>}
        </div>
        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="mr-1">Version:</span>
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedIdx(i)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    i === selectedIdx ? 'bg-omega-orange text-white' : 'bg-gray-100 text-omega-slate hover:bg-gray-200'
                  }`}
                >
                  v{v.version}
                </button>
              ))}
            </div>
          )}
          {canRegen && !outdated && (
            <button
              onClick={regenerate}
              disabled={generating}
              title="Generate a fresh AI report from current questionnaire answers"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 hover:border-omega-orange text-omega-charcoal disabled:opacity-60 font-semibold"
            >
              {generating
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating…</>
                : <><RefreshCw className="w-3 h-3" /> Regenerate</>
              }
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
          toast.type === 'error'
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-green-50 text-green-800 border border-green-200'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle className="w-3.5 h-3.5" />
            : <CheckCircle2 className="w-3.5 h-3.5" />
          }
          {toast.message}
        </div>
      )}

      {/* Rendered report */}
      <MarkdownReport raw={current.report_content} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PhaseBreakdown from '../../../shared/components/PhaseBreakdown';

// Manager's phase view — uses the SHARED PhaseBreakdown so the Manager
// sees the same detailed phase templates (`jobs.phase_data`) that the
// Owner/Ops see in JobFullView. The old `PhaseBoard.jsx` (legacy,
// reads from `job_phases`) is still in the codebase for reference but no
// longer wired.
export default function PhaseView({ job: initialJob, user, onNavigate }) {
  const [job, setJob] = useState(initialJob);

  // Re-fetch on mount so `phase_data` is always fresh (sync across roles).
  useEffect(() => {
    if (!initialJob?.id) return;
    (async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', initialJob.id)
        .maybeSingle();
      if (data) setJob(data);
    })();
  }, [initialJob?.id]);

  if (!job) return null;

  return (
    <div className="min-h-screen bg-omega-cloud pb-10">
      <header className="bg-omega-charcoal text-white px-4 sm:px-6 pt-5 pb-4">
        <button
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-1 text-sm text-omega-fog hover:text-white mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-[10px] uppercase tracking-widest text-omega-fog font-semibold">Job</p>
        <h1 className="text-xl font-bold leading-tight">{job.client_name || job.name || 'Untitled'}</h1>
        {job.address && (
          <p className="text-xs text-omega-fog mt-1 inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {job.address}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {job.service && (
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-omega-orange text-white">
              {job.service}
            </span>
          )}
          {job.pipeline_status && (
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-green-500 text-white">
              {String(job.pipeline_status).replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <PhaseBreakdown
          job={job}
          user={user}
          onJobUpdated={(updated) => setJob(updated)}
        />
      </div>
    </div>
  );
}

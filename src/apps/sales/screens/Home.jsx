import { useState, useEffect } from 'react';
import { PlusCircle, ClipboardList, Bell, LogOut, CheckCircle, GitBranch, Calendar, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home({ user, onNavigate, onLogout }) {
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('seen', false);
        setNotifCount(count || 0);
      } catch { /* badge stays at 0 */ }
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-omega-cloud pb-8">
      {/* Header */}
      <div className="bg-omega-charcoal px-5 pt-12 pb-6">
        <div className="flex items-start justify-between mb-6">
          <Logo size="sm" dark />
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('notifications')}
              className="relative p-2 rounded-xl bg-white/10 text-omega-fog hover:bg-white/20 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full bg-omega-orange text-white">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-white/10 text-omega-fog hover:bg-white/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div>
          <p className="text-omega-fog text-sm font-medium mb-0.5">{getGreeting()},</p>
          <h1 className="text-white text-2xl font-bold">{user.name}</h1>
        </div>
      </div>

      <div className="px-5 mt-5">
        {/* Main Actions */}
        <div className="space-y-3">
          <button
            onClick={() => onNavigate('new-job')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-omega-orange hover:bg-omega-dark active:scale-[0.98] transition-all duration-200 shadow-lg shadow-omega-orange/25"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <PlusCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-base">New Job</p>
              <p className="text-white/75 text-sm">Start a new client consultation</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('pipeline')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 border border-gray-200 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-omega-pale flex items-center justify-center flex-shrink-0">
              <GitBranch className="w-6 h-6 text-omega-orange" />
            </div>
            <div className="text-left">
              <p className="text-omega-charcoal font-bold text-base">Pipeline</p>
              <p className="text-omega-stone text-sm">Drag your jobs between phases</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('estimates')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 border border-gray-200 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-omega-pale flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-omega-orange" />
            </div>
            <div className="text-left">
              <p className="text-omega-charcoal font-bold text-base">Estimates</p>
              <p className="text-omega-stone text-sm">Track drafts, sent, won and lost</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('calendar')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 border border-gray-200 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-omega-pale flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-omega-orange" />
            </div>
            <div className="text-left">
              <p className="text-omega-charcoal font-bold text-base">Calendar</p>
              <p className="text-omega-stone text-sm">Your visits and company events</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('previous-jobs')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 border border-gray-200 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-omega-pale flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-omega-orange" />
            </div>
            <div className="text-left">
              <p className="text-omega-charcoal font-bold text-base">Previous Jobs</p>
              <p className="text-omega-stone text-sm">View, search, and export</p>
            </div>
          </button>
        </div>

        {/* Tips */}
        <div className="mt-5 p-4 rounded-xl bg-omega-info/10 border border-omega-info/20">
          <div className="flex gap-3">
            <CheckCircle className="w-5 h-5 text-omega-info flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-omega-info mb-1">Pro Tip</p>
              <p className="text-xs text-omega-slate">Complete the questionnaire thoroughly — a detailed report leads to a higher close rate.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Calendar, UserPlus, List, LogOut } from 'lucide-react';
import Logo from './Logo';
import UserProfileModal from '../../../shared/components/UserProfileModal';

const NAV = [
  { id: 'calendar',  label: 'Calendar',  icon: Calendar  },
  { id: 'new-lead',  label: 'New Lead',  icon: UserPlus  },
  { id: 'leads',     label: 'My Leads',  icon: List      },
];

/**
 * Sidebar for the Receptionist role — same visual language as Owner /
 * Operations / Admin / Manager but scoped to Rafaela's three workflows.
 * Calendar is intentionally on top: that's the default screen she lands
 * on after login so she can see the day before taking the next call.
 */
export default function Sidebar({ screen, onNavigate, onLogout, userName, user }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <aside className="w-56 flex-shrink-0 bg-omega-charcoal flex flex-col min-h-screen">
      <div className="px-5 py-6 border-b border-white/10">
        <Logo size="sm" />
      </div>

      <button
        onClick={() => setProfileOpen(true)}
        className="px-5 py-4 border-b border-white/10 text-left hover:bg-white/5 transition cursor-pointer"
        title="Open my profile"
      >
        <p className="text-xs text-omega-stone uppercase tracking-widest font-semibold mb-1">Reception</p>
        <p className="text-sm font-semibold text-white truncate">{userName || '—'}</p>
      </button>

      <UserProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
      />


      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              screen === id
                ? 'bg-omega-orange text-white'
                : 'text-omega-fog hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-omega-fog hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

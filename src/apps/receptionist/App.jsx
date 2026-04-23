import { useState } from 'react';
import NewLead from './screens/NewLead';
import LeadsList from './screens/LeadsList';
import Sidebar from './components/Sidebar';
import CalendarScreen from '../../shared/components/Calendar/CalendarScreen';
import { useBackNavHome } from '../../shared/lib/backNav';

// Receptionist app — three screens: Calendar (default), New Lead, My Leads.
// Same sidebar layout as the other roles so the UI feels consistent.
// After a lead is saved, the success screen offers a "Schedule Visit"
// button that jumps to Calendar with the EventForm pre-filled.
export default function ReceptionistApp({ user, onLogout }) {
  const [screen, setScreen] = useState('calendar');
  const [scheduleJob, setScheduleJob] = useState(null);

  function navigate(target) {
    // Leaving calendar or going back to new-lead clears any pending
    // "schedule this lead" hand-off so we don't accidentally re-open
    // the event form next time.
    if (target !== 'calendar') setScheduleJob(null);
    setScreen(target);
  }

  // Calendar is Rafaela's default landing. Back button returns there.
  useBackNavHome(() => {
    if (screen !== 'calendar') { setScheduleJob(null); setScreen('calendar'); }
  });

  function scheduleVisitFor(job) {
    setScheduleJob(job);
    setScreen('calendar');
  }

  const renderScreen = () => {
    if (screen === 'calendar') {
      return <CalendarScreen user={user} initialJobForVisit={scheduleJob} />;
    }
    if (screen === 'new-lead') {
      return (
        <NewLead
          user={user}
          onLogout={onLogout}
          onViewLeads={() => navigate('leads')}
          onScheduleVisit={scheduleVisitFor}
        />
      );
    }
    if (screen === 'leads') {
      return (
        <LeadsList
          onBack={() => navigate('new-lead')}
          onLogout={onLogout}
        />
      );
    }
    return <CalendarScreen user={user} />;
  };

  return (
    <div className="flex h-screen bg-omega-cloud overflow-hidden">
      <Sidebar
        screen={screen}
        onNavigate={navigate}
        onLogout={onLogout}
        userName={user?.name}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderScreen()}
      </main>
    </div>
  );
}

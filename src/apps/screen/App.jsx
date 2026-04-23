import ScreenDashboard from './screens/ScreenDashboard';

// Screen role — full-screen, non-interactive TV dashboard. No sidebar,
// no Jarvis, no clickable affordances. The only UX is Esc-to-logout,
// handled inside ScreenDashboard.
export default function ScreenApp({ user, onLogout }) {
  return <ScreenDashboard user={user} onLogout={onLogout} />;
}

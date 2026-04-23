import { useEffect, useState } from 'react';
import { PartyPopper, Sparkles } from 'lucide-react';
import { playBells } from '../lib/bells';

// Celebration toast — anchors to the right edge of the Screen dashboard.
// Duration tuned to be celebratory without blocking the dashboard if a
// second one fires soon after: 45 seconds with a gentle fade.
// Contract celebrations also trigger a synthesized bell chime.

const DURATION_MS = 45 * 1000;

export default function Celebration({ items, onDone }) {
  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-40 flex flex-col-reverse gap-3 items-end">
      {items.map((it) => (
        <CelebrationCard key={it.id} item={it} onDone={onDone} />
      ))}
    </div>
  );
}

function CelebrationCard({ item, onDone }) {
  // Two-phase animation: fade-in → hold → fade-out in the last 1s.
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    // Contract celebrations ring the bells. Lead celebrations stay silent
    // — they fire too often to make sound a good fit.
    if (item.kind === 'contract') {
      try { playBells(); } catch { /* audio may be locked */ }
    }
    const t1 = setTimeout(() => setPhase('live'), 40);
    const t2 = setTimeout(() => setPhase('leave'), DURATION_MS - 900);
    const t3 = setTimeout(() => onDone?.(item.id), DURATION_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [item.id, item.kind, onDone]);

  const opacityClass =
    phase === 'enter' ? 'opacity-0 translate-y-2' :
    phase === 'leave' ? 'opacity-0 translate-y-2' :
                        'opacity-100 translate-y-0';

  if (item.kind === 'contract') {
    return (
      <div className={`transition-all duration-700 ease-out ${opacityClass}`}>
        <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-white/10 bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 px-8 py-6 min-w-[420px] max-w-[520px]">
          {/* Confetti emojis that float up — purely decorative */}
          <ConfettiLayer />
          <div className="relative z-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/90">
              🎉 Celebration
            </p>
            <p className="text-4xl font-black text-white leading-tight mt-2">
              CONTRACT ASSIGNED
            </p>
            <div className="flex items-center gap-2 mt-2 text-white/90 text-lg font-bold">
              <span>🎊</span><span>🎉</span><span>🥳</span><span>🎊</span><span>🎉</span>
            </div>
            {item.subtitle && (
              <p className="mt-3 text-white/95 text-lg font-semibold truncate">{item.subtitle}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // kind === 'lead'
  return (
    <div className={`transition-all duration-700 ease-out ${opacityClass}`}>
      <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-white/10 bg-gradient-to-br from-omega-orange via-orange-500 to-orange-600 px-8 py-6 min-w-[380px] max-w-[480px]">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/90">
              Breaking
            </p>
            <p className="text-3xl font-black text-white leading-tight">
              GET NEW LEAD
            </p>
            {item.subtitle && (
              <p className="mt-1 text-white/90 text-base font-semibold truncate">{item.subtitle}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Lightweight confetti rendered with emoji. No external library — keeps
// the Screen bundle small and avoids dependencies for a decorative touch.
function ConfettiLayer() {
  const pieces = ['🎉', '🎊', '✨', '🎊', '🎉', '✨', '🎊', '🎉'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute text-2xl animate-[floatUp_3s_ease-out_infinite]"
          style={{
            left: `${8 + i * 11}%`,
            bottom: '-10%',
            animationDelay: `${(i * 300) % 2400}ms`,
          }}
        >
          {p}
        </span>
      ))}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(-240px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

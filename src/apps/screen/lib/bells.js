// Synthesizes a ~6-second joyful bell chime using the Web Audio API.
// Layered tones with harmonics + light reverb — no external audio file.
//
// Usage:
//   import { playBells, unlockAudio } from './bells';
//   unlockAudio();   // ← call this on first user interaction
//   playBells();     // ← fire when the celebration appears
//
// Autoplay policy:
//   Modern browsers block AudioContext.start() until the user interacts
//   with the page. `unlockAudio()` resumes the context if suspended —
//   safe to call from any click/keydown handler.

let ctx = null;
let unlocked = false;

function getContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function unlockAudio() {
  const c = getContext();
  if (!c) return false;
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
  unlocked = true;
  return true;
}

export function isUnlocked() {
  const c = getContext();
  return !!c && c.state === 'running' && unlocked;
}

// Play a single bell strike at `startAt` seconds from now, centered at
// `freq` Hz. Bells sound like metal: fast attack, two octaves of decay,
// a slightly detuned harmonic for shimmer, and a short decay envelope.
function playBell(c, startAt, freq, gain = 0.4) {
  const now = c.currentTime + startAt;
  const master = c.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(gain, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
  master.connect(c.destination);

  // Fundamental
  const o1 = c.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(freq, now);
  o1.connect(master);

  // Octave (shimmer)
  const o2 = c.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(freq * 2, now);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.3, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  o2.connect(g2);
  g2.connect(master);

  // Detuned fifth for a brighter bell character
  const o3 = c.createOscillator();
  o3.type = 'sine';
  o3.frequency.setValueAtTime(freq * 1.5 + 1.2, now);
  const g3 = c.createGain();
  g3.gain.setValueAtTime(0.18, now);
  g3.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  o3.connect(g3);
  g3.connect(master);

  o1.start(now); o1.stop(now + 2.5);
  o2.start(now); o2.stop(now + 2.0);
  o3.start(now); o3.stop(now + 1.5);
}

// A joyful 3-note arpeggio + a ringing final chord. ~6 seconds total.
// Notes (C6 major triad) were chosen to feel celebratory without being
// kitschy — evocative of a cathedral bell peal.
export function playBells() {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') {
    // Try to resume — if it fails (no user gesture) we silently no-op.
    c.resume().catch(() => {});
  }

  // Ascending arpeggio: C6 → E6 → G6
  playBell(c, 0.00, 1046.50, 0.45);
  playBell(c, 0.35, 1318.51, 0.42);
  playBell(c, 0.70, 1567.98, 0.40);

  // Ringing chord strike at 1.2s
  playBell(c, 1.20, 1046.50, 0.32);
  playBell(c, 1.20, 1318.51, 0.28);
  playBell(c, 1.20, 1567.98, 0.24);

  // Second, softer chord to fade out
  playBell(c, 2.60, 1046.50, 0.20);
  playBell(c, 2.60, 1567.98, 0.18);

  // Final sparkle up high
  playBell(c, 3.80, 2093.00, 0.22); // C7
  playBell(c, 4.20, 2637.02, 0.18); // E7
}

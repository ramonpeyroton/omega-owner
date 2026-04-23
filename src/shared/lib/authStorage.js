// Session persistence with optional "Remember me" (30-day) support.
//
// If the user checks "Remember me" on login, the session is written to
// localStorage with a 30-day expiry timestamp. Otherwise, it falls back to
// sessionStorage (cleared when the tab closes) — the historical behavior.
//
// Used by both the public Login and the hidden AdminLogin, each with its own
// bucket key so they never clobber each other.

const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Bucket keys (v2 — older sessionStorage keys are kept around for backward
// compat reads so already-logged-in users don't get kicked out after deploy).
export const PUBLIC_BUCKET = 'omega_unified_user_v2';
export const ADMIN_BUCKET  = 'omega_unified_admin_v2';

// Legacy keys — read once on boot so existing sessions keep working.
const LEGACY_PUBLIC = 'omega_unified_user';
const LEGACY_ADMIN  = 'omega_unified_admin';

function legacyKeyFor(bucket) {
  if (bucket === PUBLIC_BUCKET) return LEGACY_PUBLIC;
  if (bucket === ADMIN_BUCKET)  return LEGACY_ADMIN;
  return null;
}

function safeGet(store, key) {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store, key, value) {
  try { store.setItem(key, value); } catch { /* quota / private mode */ }
}
function safeDel(store, key) {
  try { store.removeItem(key); } catch { /* ignore */ }
}

/**
 * Persist a session.
 * @param {string} bucket   PUBLIC_BUCKET or ADMIN_BUCKET
 * @param {object} user     the user object to store
 * @param {boolean} remember  true → localStorage w/ 30d expiry, false → sessionStorage
 */
export function saveSession(bucket, user, remember = false) {
  const payload = JSON.stringify({
    user,
    savedAt: Date.now(),
    expiresAt: remember ? Date.now() + REMEMBER_MS : null,
    remember: !!remember,
  });

  if (remember) {
    safeSet(localStorage, bucket, payload);
    // Clear any short-lived copy in sessionStorage to avoid confusion on reads.
    safeDel(sessionStorage, bucket);
  } else {
    safeSet(sessionStorage, bucket, payload);
    safeDel(localStorage, bucket);
  }
}

/**
 * Load a session. Returns the stored user object or null if none / expired.
 * Automatically clears expired or malformed entries.
 */
export function loadSession(bucket) {
  // v2 — localStorage first (remember me), then sessionStorage (tab session).
  for (const store of [localStorage, sessionStorage]) {
    const raw = safeGet(store, bucket);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.expiresAt && Date.now() > parsed.expiresAt) {
        safeDel(store, bucket);
        continue;
      }
      if (parsed?.user) return parsed.user;
    } catch {
      safeDel(store, bucket);
    }
  }

  // Legacy fallback — older plain-JSON sessionStorage entries.
  const legacy = legacyKeyFor(bucket);
  if (legacy) {
    const raw = safeGet(sessionStorage, legacy);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.role) {
          // Migrate: rewrite under new key, tab-scoped.
          saveSession(bucket, parsed, false);
          safeDel(sessionStorage, legacy);
          return parsed;
        }
      } catch { /* ignore */ }
    }
  }
  return null;
}

/** Wipe a session from both storages (used on logout). */
export function clearSession(bucket) {
  safeDel(localStorage, bucket);
  safeDel(sessionStorage, bucket);
  const legacy = legacyKeyFor(bucket);
  if (legacy) safeDel(sessionStorage, legacy);
}

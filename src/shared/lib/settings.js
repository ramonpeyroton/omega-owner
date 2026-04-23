// Read/write helpers for the `app_settings` key-value table.
// All values are stored as text; helpers coerce where useful.

import { supabase } from './supabase';

export async function getSetting(key, fallback = null) {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return data?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getSettingNumber(key, fallback = 0) {
  const raw = await getSetting(key, null);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function setSetting(key, value, user) {
  const payload = {
    key,
    value: value == null ? null : String(value),
    updated_at: new Date().toISOString(),
    updated_by: user?.name || null,
  };
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'key' });
    return !error;
  } catch {
    return false;
  }
}

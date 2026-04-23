// Read/write helpers for the single-row `screen_overrides` table.
// Used by both the Screen dashboard (read) and the Admin override
// editor (read+write).

import { supabase } from './supabase';

const ROW_ID = 1;

/** Fetch the current overrides row. Returns an empty object on error. */
export async function loadScreenOverrides() {
  try {
    const { data, error } = await supabase
      .from('screen_overrides')
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error) throw error;
    return data || {};
  } catch {
    return {};
  }
}

/** Merge `patch` into the overrides row. */
export async function saveScreenOverrides(patch, userName) {
  const row = {
    ...patch,
    id:         ROW_ID,
    updated_at: new Date().toISOString(),
    updated_by: userName || null,
  };
  const { error } = await supabase
    .from('screen_overrides')
    .upsert(row, { onConflict: 'id' });
  if (error) throw error;
  return true;
}

/**
 * Given a number returned by a live-data loader and a possibly-null
 * manual override, return the value the dashboard should show. Override
 * wins when it's a valid (non-null) number.
 */
export function pickKpi(live, override) {
  if (override == null || override === '') return live;
  const n = Number(override);
  return Number.isFinite(n) ? n : live;
}

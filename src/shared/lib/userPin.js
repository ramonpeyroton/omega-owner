// Helpers for re-confirming user identity via PIN. Used by destructive
// / terminal actions:
//   * `validateUserPin(user, pin)`  — does this PIN belong to the
//     user that's currently logged in? Used by the kanban PIN gate
//     and the JobFullView phase picker.
//   * `validateOwnerPin(pin)`       — is this the OWNER's PIN? Used
//     by the Reset Job + Delete Job confirmations, which historically
//     hard-coded "3333" but should now look up the owner row in the
//     users table dynamically.
//
// Both functions hit the `users` table only — the legacy hardcoded
// PIN_TO_ROLE fallback was removed once every team member was
// registered through Admin → Users.
//
// Always returns a boolean; never throws.

import { supabase } from './supabase';

export async function validateUserPin(user, pin) {
  const cleaned = String(pin || '').trim();
  if (!cleaned || !user?.role) return false;

  try {
    const handle = (user.name || '').trim();
    if (!handle) return false;

    const { data } = await supabase
      .from('users')
      .select('id, name, username, role, pin')
      .eq('pin', cleaned)
      .or(`name.ilike.${handle},username.eq.${handle.toLowerCase()}`)
      .limit(1);
    return Array.isArray(data) && !!data[0] && data[0].role === user.role;
  } catch {
    // Schema drift or query failure — fail closed.
    return false;
  }
}

export async function validateOwnerPin(pin) {
  const cleaned = String(pin || '').trim();
  if (!cleaned) return false;

  try {
    const { data } = await supabase
      .from('users')
      .select('id, role, pin')
      .eq('role', 'owner')
      .eq('pin', cleaned)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

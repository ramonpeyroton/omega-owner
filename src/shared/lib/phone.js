// Phone formatting helpers.
// The UI shows a US-friendly mask "(203) 555-1234" while the database
// persists the E.164 form "+12035551234" — that's what Twilio expects.
//
// Non-US numbers with a leading "+" are preserved as-is.

/**
 * Turn whatever the user typed into the pretty mask for the input.
 * - "2035551234"         → "(203) 555-1234"
 * - "(203) 555-1234"     → "(203) 555-1234"
 * - "+12035551234"       → "+1 (203) 555-1234"
 * - "+5511987654321"     → "+55 11 98765-4321" (best-effort)
 */
export function formatPhoneInput(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';

  // International (starts with +) — keep as-is but group loosely
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    // US country code 1 → pretty format
    if (digits.startsWith('1') && digits.length <= 11) {
      const rest = digits.slice(1);
      return formatUsMask(rest, '+1 ');
    }
    // Brazil (+55) — crude "+55 AA NNNNN-NNNN"
    if (digits.startsWith('55') && digits.length >= 12) {
      const area = digits.slice(2, 4);
      const first = digits.slice(4, digits.length - 4);
      const last  = digits.slice(-4);
      return `+55 ${area} ${first}-${last}`;
    }
    // Anything else: just group in 3s for readability
    return '+' + digits.replace(/(.{3})/g, '$1 ').trim();
  }

  // No + → treat as US (strip all non-digits, cap at 10)
  const digits = s.replace(/\D/g, '').slice(0, 11);
  // User may have typed leading 1 by accident
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return formatUsMask(ten, '');
}

function formatUsMask(ten, prefix) {
  const d = ten.slice(0, 10);
  if (d.length === 0) return prefix;
  if (d.length <= 3)  return `${prefix}(${d}`;
  if (d.length <= 6)  return `${prefix}(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `${prefix}(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Strip formatting and return the E.164 form for the database / Twilio.
 * Returns null if the input doesn't look like a valid phone number.
 */
export function toE164(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Already starts with + → just strip non-digits
  if (s.startsWith('+')) {
    const d = s.replace(/[^\d]/g, '');
    return d.length >= 8 ? `+${d}` : null;
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // Too short to be usable
  if (digits.length < 10) return null;
  // Long but no country code — guess US
  return `+1${digits.slice(-10)}`;
}

/**
 * True when the input has enough digits to constitute a valid number.
 */
export function isValidPhone(raw) {
  return !!toE164(raw);
}

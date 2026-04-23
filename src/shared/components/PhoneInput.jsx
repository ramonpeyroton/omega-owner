import { Phone } from 'lucide-react';
import { formatPhoneInput, toE164 } from '../lib/phone';

/**
 * Controlled phone input that formats as the user types and reports
 * the normalized E.164 value through `onChange` (alongside the raw
 * display string for preview if callers want it).
 *
 * Usage:
 *   <PhoneInput value={phone} onChange={setPhone} placeholder="203-555-1234" />
 *
 * `value` is the raw string shown in the input. Store it as-is in
 * component state; call `toE164(value)` when persisting to the DB.
 */
export default function PhoneInput({
  value,
  onChange,
  onBlur,
  placeholder = '(203) 555-1234',
  className = '',
  withIcon = true,
  autoFocus = false,
  required = false,
  disabled = false,
}) {
  function handleChange(e) {
    const next = formatPhoneInput(e.target.value);
    onChange?.(next);
  }

  const input = (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value || ''}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      autoFocus={autoFocus}
      required={required}
      disabled={disabled}
      className={
        withIcon
          ? `${className} pl-10`
          : className
      }
    />
  );

  if (!withIcon) return input;

  return (
    <div className="relative">
      <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-omega-stone pointer-events-none" />
      {input}
    </div>
  );
}

// Re-export helpers so callers only import one module
export { formatPhoneInput, toE164 };

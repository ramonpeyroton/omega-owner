// Pre-written message templates for quick client outreach.
// Each template has a canonical text with {placeholders} that get filled
// in from the current job (client name, service, address, etc.).
// Values are resolved by fillTemplate() below.
//
// The UI presents these as chips/pills — one click opens the Contact
// modal with the filled message pre-loaded. The user can edit before
// sending via SMS / WhatsApp.

export const TEMPLATES = [
  {
    id: 'visit_confirm',
    title: 'Confirm Visit',
    emoji: '📅',
    text: `Hi {CLIENT}, just confirming our visit tomorrow at {TIME} at {ADDRESS}. Let me know if anything changes. Thanks! — Omega Development`,
  },
  {
    id: 'estimate_sent',
    title: 'Estimate Sent',
    emoji: '📄',
    text: `Hi {CLIENT}, I just emailed you the estimate for your {SERVICE} project. Any questions, just call or text. — Omega Development`,
  },
  {
    id: 'estimate_followup',
    title: 'Estimate Follow-up',
    emoji: '🔔',
    text: `Hi {CLIENT}, hope you're doing well! Just checking in to see if you had a chance to review the estimate we sent. Any questions? — Omega Development`,
  },
  {
    id: 'contract_signed',
    title: 'Contract Signed',
    emoji: '✅',
    text: `Thank you for choosing Omega, {CLIENT}! We received your signed contract. We'll start the work on {START_DATE}. — Omega Development`,
  },
  {
    id: 'start_tomorrow',
    title: 'Starting Tomorrow',
    emoji: '🔨',
    text: `Hi {CLIENT}, just letting you know our team will arrive tomorrow at {TIME} to start the {SERVICE}. See you then! — Omega Development`,
  },
  {
    id: 'weather_delay',
    title: 'Weather Delay',
    emoji: '🌧️',
    text: `Hi {CLIENT}, sorry for the inconvenience — due to the weather today we won't be able to come out. We'll reschedule for {NEW_DATE}. Thanks for your patience!`,
  },
  {
    id: 'generic_delay',
    title: 'Reschedule / Delay',
    emoji: '⏱️',
    text: `Hi {CLIENT}, we need to reschedule {OLD_DATE} to {NEW_DATE}. Sorry for the inconvenience. Can you confirm the new date works? — Omega Development`,
  },
  {
    id: 'payment_reminder',
    title: 'Payment Reminder',
    emoji: '💰',
    text: `Hi {CLIENT}, friendly reminder that the next payment ({INSTALLMENT}) is due on {DUE_DATE}. Any questions just let me know. — Omega Development`,
  },
  {
    id: 'progress_update',
    title: 'Progress Update',
    emoji: '📸',
    text: `Hi {CLIENT}, quick update on your {SERVICE} — we finished {PHASE} today and will move into {NEXT_PHASE} next. Everything on track!`,
  },
  {
    id: 'job_complete',
    title: 'Job Complete',
    emoji: '🎉',
    text: `Hi {CLIENT}, we wrapped up the work today! Let me know if anything needs a final adjustment. Thanks for trusting Omega with your project!`,
  },
  {
    id: 'review_request',
    title: 'Review Request',
    emoji: '⭐',
    text: `Hi {CLIENT}, hope everything's going great with your new {SERVICE}! If you have a minute, a Google review would mean a lot — it really helps us. Thanks! — Omega Development`,
  },
];

/**
 * Fill {placeholders} from a template using a job object.
 * Anything we can't resolve stays as the placeholder so the user can see
 * what needs editing before sending.
 */
export function fillTemplate(templateText, job) {
  const map = {
    CLIENT:   (job?.client_name || '').split(' ')[0] || job?.client_name || 'there',
    SERVICE:  job?.service || 'project',
    ADDRESS:  job?.address || '',
    TIME:     '{TIME}',
    START_DATE: '{START_DATE}',
    NEW_DATE:   '{NEW_DATE}',
    OLD_DATE:   '{OLD_DATE}',
    DUE_DATE:   '{DUE_DATE}',
    INSTALLMENT: '{INSTALLMENT}',
    PHASE:       '{PHASE}',
    NEXT_PHASE:  '{NEXT_PHASE}',
  };
  return String(templateText).replace(/\{(\w+)\}/g, (_, key) => {
    const v = map[key];
    return v != null ? v : `{${key}}`;
  });
}

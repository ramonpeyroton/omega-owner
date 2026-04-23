import { useState, useEffect } from 'react';
import { X, MessageSquare, MessageCircle, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendMessage, smsDeepLink, waDeepLink, normalizePhone } from '../lib/twilio';
import { logAudit } from '../lib/audit';

/**
 * Small modal that previews / edits a message and sends it via Twilio
 * (SMS or WhatsApp). If Twilio isn't configured, the user can fall back
 * to the native `sms:` URL or the `wa.me` deep link.
 *
 * props:
 *   open                    boolean
 *   onClose                 () => void
 *   toName                  string  display name of recipient
 *   toPhone                 string  recipient phone
 *   initialBody             string  starting message text
 *   channel                 'sms' | 'whatsapp'
 *   setChannel              setter (allows toggling inside the modal)
 *   user                    { name, role }  for audit + headers
 *   meta                    { jobId?, phaseId?, subId?, kind? }
 *   auditAction             e.g. 'sub.contact.sms' — optional
 */
export default function ContactMessageModal({
  open, onClose,
  toName, toPhone,
  initialBody = '',
  channel = 'sms',
  setChannel,
  user, meta,
  auditAction,
}) {
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, error?, sid? }

  useEffect(() => {
    if (open) {
      setBody(initialBody);
      setResult(null);
      setSending(false);
    }
  }, [open, initialBody]);

  if (!open) return null;

  const normalized = normalizePhone(toPhone);
  const canDeepLink = !!normalized;
  const deepLink = channel === 'whatsapp'
    ? waDeepLink(toPhone, body)
    : smsDeepLink(toPhone, body);

  async function handleSend() {
    if (!normalized) {
      setResult({ ok: false, error: 'No valid phone number for this contact.' });
      return;
    }
    setSending(true);
    setResult(null);
    const r = await sendMessage({
      to: normalized,
      body,
      channel,
      meta,
      user,
    });
    setSending(false);
    setResult(r);
    if (r.ok && auditAction) {
      logAudit({
        user,
        action: auditAction,
        entityType: meta?.subId ? 'subcontractor' : 'job',
        entityId: meta?.subId || meta?.jobId || null,
        details: { channel, to: normalized, preview: body.slice(0, 120), sid: r.sid },
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onClick={() => !sending && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-omega-stone font-semibold">
              Send {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
            </p>
            <p className="font-bold text-omega-charcoal text-base mt-0.5 truncate">
              {toName || 'Contact'}
            </p>
            <p className="text-xs text-omega-stone">{normalized || toPhone || '—'}</p>
          </div>
          <button onClick={onClose} disabled={sending} className="p-1.5 rounded-lg hover:bg-gray-100 text-omega-stone">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channel toggle */}
        {setChannel && (
          <div className="px-5 pt-4 flex gap-2">
            <button
              onClick={() => setChannel('sms')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                channel === 'sms'
                  ? 'bg-omega-orange text-white'
                  : 'bg-gray-100 text-omega-charcoal hover:bg-gray-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> SMS
            </button>
            <button
              onClick={() => setChannel('whatsapp')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                channel === 'whatsapp'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-omega-charcoal hover:bg-gray-200'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
          </div>
        )}

        <div className="p-5 space-y-3">
          <label className="block text-[10px] font-semibold text-omega-stone uppercase tracking-wider">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-omega-orange focus:outline-none resize-none leading-relaxed"
          />
          <p className="text-[11px] text-omega-stone">{body.length}/1600 characters</p>

          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
              result.ok
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {result.ok
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              }
              <div className="min-w-0">
                <p className="font-semibold text-xs">
                  {result.ok ? 'Message queued' : 'Send failed'}
                </p>
                <p className="text-xs mt-0.5 break-words">
                  {result.ok ? `Twilio SID: ${result.sid || '—'}` : result.error}
                </p>
                {!result.ok && canDeepLink && (
                  <a
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-bold underline"
                  >
                    Open in phone app instead <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex items-center justify-between gap-2 flex-wrap">
          {canDeepLink && (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-omega-charcoal hover:bg-gray-50"
              title="Open in the native phone app (no Twilio)"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in phone app
            </a>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !body.trim() || !normalized}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60 ${
                channel === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : 'bg-omega-orange hover:bg-omega-dark'
              }`}
            >
              {sending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <>{channel === 'whatsapp' ? <MessageCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />} Send</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

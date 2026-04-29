import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { subDisplayNames, subInlineLabel } from '../../shared/lib/subcontractor';

// Public, auth-less page the subcontractor lands on after Inácio
// assigns him to a job. URL: /sub-offer/:offerId
//
// Shows the offer details (scope, location, value, payment terms,
// start date) translated to the sub's preferred language (PT/EN/ES,
// stored on subcontractors.preferred_language). Two big buttons:
// Accept and Reject. Reject opens a small text box for an optional
// reason. Updates land directly via the Supabase JS client (RLS is
// permissive in v1 — same pattern as /estimate-view).
//
// On Accept: marks offer as accepted, creates a `subcontractor_
// agreements` row with the same snapshot, and notifies the owner.
// On Reject: marks the offer rejected and notifies the owner so they
// can pick a different sub.

const ORANGE = '#E8732A';

// ─── Translations ────────────────────────────────────────────────────
const I18N = {
  en: {
    locale:        'en-US',
    loading:       'Loading offer…',
    notFound:      'This offer is not available or has expired.',
    expired:       'This offer was already responded to.',
    greeting:      (name) => `Hi ${name},`,
    intro:         'Omega Development would like to assign you to the following project. Please review and respond below.',
    project:       'Project',
    location:      'Location',
    scope:         'Scope of Work',
    amount:        'Total Amount',
    payment:       'Payment Schedule',
    startDate:     'Start Date',
    endDate:       'End Date',
    accept:        'Accept Job',
    reject:        'Reject',
    rejectReason:  'Reason (optional)',
    rejectReasonPlaceholder: 'Why are you rejecting? (optional, helps Omega pick the right alternate)',
    confirmReject: 'Confirm Rejection',
    cancel:        'Cancel',
    accepted:      '✅ You accepted this job!',
    acceptedSub:   'Omega has been notified. Inácio or Brenda will be in touch with next steps.',
    rejected:      '✋ You rejected this job.',
    rejectedSub:   'Omega has been notified and will reach out to a different subcontractor.',
    error:         'Something went wrong. Please try again or call Omega.',
    questions:     (phone) => `Questions? Call ${phone || 'Omega'}.`,
    poweredBy:     'Powered by Omega Development',
  },
  pt: {
    locale:        'pt-BR',
    loading:       'Carregando proposta…',
    notFound:      'Esta proposta não está disponível ou já expirou.',
    expired:       'Esta proposta já foi respondida.',
    greeting:      (name) => `Olá ${name},`,
    intro:         'A Omega Development gostaria de te designar para o trabalho abaixo. Por favor, revise os detalhes e responda.',
    project:       'Projeto',
    location:      'Endereço',
    scope:         'Escopo do Trabalho',
    amount:        'Valor Total',
    payment:       'Forma de Pagamento',
    startDate:     'Data de Início',
    endDate:       'Data de Término',
    accept:        'Aceitar Trabalho',
    reject:        'Recusar',
    rejectReason:  'Motivo (opcional)',
    rejectReasonPlaceholder: 'Por que está recusando? (opcional, ajuda a Omega encontrar outro sub)',
    confirmReject: 'Confirmar Recusa',
    cancel:        'Cancelar',
    accepted:      '✅ Você aceitou este trabalho!',
    acceptedSub:   'A Omega foi avisada. Inácio ou Brenda vai entrar em contato com os próximos passos.',
    rejected:      '✋ Você recusou este trabalho.',
    rejectedSub:   'A Omega foi avisada e vai contatar outro subcontratado.',
    error:         'Algo deu errado. Tente novamente ou ligue para a Omega.',
    questions:     (phone) => `Dúvidas? Ligue para ${phone || 'a Omega'}.`,
    poweredBy:     'Powered by Omega Development',
  },
  es: {
    locale:        'es-ES',
    loading:       'Cargando propuesta…',
    notFound:      'Esta propuesta no está disponible o expiró.',
    expired:       'Esta propuesta ya fue respondida.',
    greeting:      (name) => `Hola ${name},`,
    intro:         'Omega Development quisiera asignarte al siguiente trabajo. Revisa los detalles y responde abajo.',
    project:       'Proyecto',
    location:      'Ubicación',
    scope:         'Alcance del Trabajo',
    amount:        'Monto Total',
    payment:       'Forma de Pago',
    startDate:     'Fecha de Inicio',
    endDate:       'Fecha de Fin',
    accept:        'Aceptar Trabajo',
    reject:        'Rechazar',
    rejectReason:  'Motivo (opcional)',
    rejectReasonPlaceholder: '¿Por qué lo rechazas? (opcional, ayuda a Omega a encontrar otro)',
    confirmReject: 'Confirmar Rechazo',
    cancel:        'Cancelar',
    accepted:      '✅ ¡Aceptaste este trabajo!',
    acceptedSub:   'Omega ha sido notificada. Inácio o Brenda se pondrá en contacto.',
    rejected:      '✋ Rechazaste este trabajo.',
    rejectedSub:   'Omega ha sido notificada y contactará a otro subcontratista.',
    error:         'Algo salió mal. Intenta de nuevo o llama a Omega.',
    questions:     (phone) => `¿Dudas? Llama a ${phone || 'Omega'}.`,
    poweredBy:     'Powered by Omega Development',
  },
};

function money(n, locale) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}

function paymentLabel(plan, t) {
  if (!Array.isArray(plan) || plan.length === 0) return 'TBD';
  return plan.map((p) => `${p.percent}% — ${p.label || ''}`).filter(Boolean).join(' · ');
}

export default function SubOfferView() {
  const [loading, setLoading]     = useState(true);
  const [offer, setOffer]         = useState(null);
  const [sub, setSub]             = useState(null);
  const [job, setJob]             = useState(null);
  const [company, setCompany]     = useState(null);
  const [err, setErr]             = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [resultState, setResultState] = useState(null); // 'accepted' | 'rejected'

  useEffect(() => {
    const offerId = window.location.pathname.split('/').pop();
    if (!offerId) { setErr('Missing offer id'); setLoading(false); return; }
    (async () => {
      try {
        const { data: o } = await supabase
          .from('subcontractor_offers').select('*').eq('id', offerId).maybeSingle();
        if (!o) throw new Error('Offer not found');
        setOffer(o);

        // If the offer was already responded to, surface the right
        // confirmation immediately instead of letting the sub click
        // again.
        if (o.status === 'accepted') setResultState('accepted');
        else if (o.status === 'rejected') setResultState('rejected');

        const [{ data: s }, { data: j }, { data: c }] = await Promise.all([
          supabase.from('subcontractors').select('*').eq('id', o.subcontractor_id).maybeSingle(),
          supabase.from('jobs').select('*').eq('id', o.job_id).maybeSingle(),
          supabase.from('company_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        setSub(s || null);
        setJob(j || null);
        setCompany(c || null);
      } catch (e) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lang = (sub?.preferred_language || 'en').toLowerCase();
  const t = I18N[lang] || I18N.en;

  if (loading) {
    return <p style={{ padding: 40, fontFamily: 'sans-serif' }}>{t.loading}</p>;
  }
  if (err || !offer) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', textAlign: 'center' }}>
        <p style={{ color: '#b00', fontSize: 16, fontWeight: 700 }}>{t.notFound}</p>
        {err && <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>{err}</p>}
      </div>
    );
  }

  // ─── Accept ────────────────────────────────────────────────────────
  async function handleAccept() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();

      // 1) Create the agreement row from the offer snapshot
      const { data: agr, error: agrErr } = await supabase
        .from('subcontractor_agreements')
        .insert([{
          job_id:           offer.job_id,
          subcontractor_id: offer.subcontractor_id,
          scope_of_work:    offer.scope_of_work,
          their_estimate:   offer.their_estimate,
          payment_plan:     offer.payment_plan,
          start_date:       offer.start_date,
          end_date:         offer.end_date,
          status:           'accepted',
          signed_at:        now,
        }])
        .select('id')
        .single();
      if (agrErr) throw agrErr;

      // 2) Mark the offer accepted and link it back to the agreement
      const { error: offErr } = await supabase
        .from('subcontractor_offers')
        .update({
          status:       'accepted',
          accepted_at:  now,
          agreement_id: agr.id,
          updated_at:   now,
        })
        .eq('id', offer.id);
      if (offErr) throw offErr;

      // 3) Notify the owner
      try {
        await supabase.from('notifications').insert([{
          recipient_role: 'owner',
          type:           'sub_offer_accepted',
          job_id:         offer.job_id,
          title:          `${sub ? subInlineLabel(sub) : 'Subcontractor'} accepted ${job?.client_name || 'the job'}`,
          message:        `Scope: ${offer.scope_of_work || '(no scope)'}. The agreement was created automatically.`,

          read:           false,
          seen:           false,
        }]);
        // Also let Operations (Brenda) know — she handles follow-up.
        await supabase.from('notifications').insert([{
          recipient_role: 'operations',
          type:           'sub_offer_accepted',
          job_id:         offer.job_id,
          title:          `${sub ? subInlineLabel(sub) : 'Subcontractor'} accepted ${job?.client_name || 'the job'}`,
          message:        `Agreement auto-generated. Verify and prepare materials.`,
          read:           false,
          seen:           false,
        }]);
      } catch { /* non-fatal */ }

      setResultState('accepted');
    } catch {
      alert(t.error);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Reject ────────────────────────────────────────────────────────
  async function handleReject() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      await supabase
        .from('subcontractor_offers')
        .update({
          status:        'rejected',
          rejected_at:   now,
          reject_reason: rejectReason.trim() || null,
          updated_at:    now,
        })
        .eq('id', offer.id);

      try {
        await supabase.from('notifications').insert([{
          recipient_role: 'owner',
          type:           'sub_offer_rejected',
          job_id:         offer.job_id,
          title:          `${sub ? subInlineLabel(sub) : 'Subcontractor'} rejected ${job?.client_name || 'the job'}`,
          message:        rejectReason.trim()
            ? `Reason: ${rejectReason.trim()}. Pick a different sub.`
            : `No reason given. Pick a different sub.`,
          read:           false,
          seen:           false,
        }]);
      } catch { /* non-fatal */ }

      setResultState('rejected');
    } catch {
      alert(t.error);
    } finally {
      setSubmitting(false);
      setShowReject(false);
    }
  }

  // ─── Locked receipt (already responded) ───────────────────────────
  if (resultState === 'accepted' || resultState === 'rejected') {
    const accepted = resultState === 'accepted';
    return (
      <Frame company={company} t={t}>
        <div style={{
          background: accepted ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${accepted ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 8, padding: 24, textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: accepted ? '#15803d' : '#991b1b', margin: '0 0 8px' }}>
            {accepted ? t.accepted : t.rejected}
          </h2>
          <p style={{ fontSize: 14, color: accepted ? '#166534' : '#7f1d1d', margin: 0 }}>
            {accepted ? t.acceptedSub : t.rejectedSub}
          </p>
          <p style={{ fontSize: 11, color: '#888', marginTop: 16 }}>
            {t.questions(company?.phone)}
          </p>
        </div>
      </Frame>
    );
  }

  // ─── Active offer view ────────────────────────────────────────────
  return (
    <Frame company={company} t={t}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>
        {/* Personal greeting — use the contact's first name when set,
            falls back to the company name. The page is the sub
            personally reading their offer, so seeing "Hi, Pedro!"
            beats "Hi, ABC Plumbing LLC!". */}
        {t.greeting(subDisplayNames(sub).primary || '')}
      </h1>
      <p style={{ fontSize: 14, color: '#444', lineHeight: 1.55, margin: '8px 0 24px' }}>
        {t.intro}
      </p>

      <DetailRow label={t.project} value={job?.client_name || '—'} />
      <DetailRow label={t.location} value={offer.location || job?.address || '—'} />
      <DetailRow label={t.scope} value={offer.scope_of_work || '—'} multiline />
      <DetailRow label={t.amount} value={offer.their_estimate ? money(offer.their_estimate, t.locale) : '—'} highlight />
      <DetailRow label={t.payment} value={paymentLabel(offer.payment_plan, t)} />
      {offer.start_date && (
        <DetailRow label={t.startDate} value={new Date(offer.start_date + 'T00:00:00').toLocaleDateString(t.locale)} />
      )}
      {offer.end_date && (
        <DetailRow label={t.endDate} value={new Date(offer.end_date + 'T00:00:00').toLocaleDateString(t.locale)} />
      )}

      {!showReject && (
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button
            onClick={handleAccept}
            disabled={submitting}
            style={{
              flex: 1, minWidth: 160, padding: '14px 20px',
              background: ORANGE, color: 'white', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 900, cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '…' : t.accept}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={submitting}
            style={{
              flex: 1, minWidth: 160, padding: '14px 20px',
              background: 'white', color: '#b00', border: '2px solid #fecaca', borderRadius: 8,
              fontSize: 15, fontWeight: 900, cursor: 'pointer',
            }}
          >
            {t.reject}
          </button>
        </div>
      )}

      {showReject && (
        <div style={{ marginTop: 24, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
            {t.rejectReason}
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t.rejectReasonPlaceholder}
            rows={3}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid #fecaca', borderRadius: 6,
              fontSize: 14, fontFamily: 'inherit',
              boxSizing: 'border-box', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setShowReject(false)}
              disabled={submitting}
              style={{
                flex: 1, padding: '10px 16px',
                background: 'white', color: '#444', border: '1px solid #ddd', borderRadius: 6,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={handleReject}
              disabled={submitting}
              style={{
                flex: 1, padding: '10px 16px',
                background: '#b00', color: 'white', border: 'none', borderRadius: 6,
                fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '…' : t.confirmReject}
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#888', marginTop: 24, textAlign: 'center' }}>
        {t.questions(company?.phone)}
      </p>
    </Frame>
  );
}

// ─── Layout shell ────────────────────────────────────────────────────
function Frame({ company, t, children }) {
  return (
    <div style={{
      padding: '32px 16px', background: '#f5f5f3', minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif',
      color: '#2C2C2A',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ background: 'white', padding: 32, borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <img src="/logo.png" alt="Omega" width={56} height={56} style={{ display: 'block' }} />
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#2C2C2A', letterSpacing: '-0.02em' }}>
                OMEGA<span style={{ color: ORANGE }}>DEVELOPMENT</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#6b6b6b', letterSpacing: '.18em', marginTop: 4 }}>
                RENOVATIONS &amp; CONSTRUCTION
              </div>
            </div>
          </div>
          {children}
        </div>
        <p style={{ fontSize: 10, color: '#999', marginTop: 12, textAlign: 'center' }}>
          {t.poweredBy}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight, multiline }) {
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? 22 : 14,
        fontWeight: highlight ? 900 : 500,
        color: highlight ? ORANGE : '#2C2C2A',
        whiteSpace: multiline ? 'pre-line' : 'normal',
        lineHeight: multiline ? 1.6 : 1.4,
        fontVariantNumeric: highlight ? 'tabular-nums' : 'normal',
      }}>
        {value}
      </div>
    </div>
  );
}

// Vercel Function: render an estimate as HTML + email it via Resend.
//
// POST JSON: { estimateId: "<uuid>" }
// Requires server env vars:
//   RESEND_API_KEY                 re_xxx
//   RESEND_FROM                    default "Omega Development <office@omeganyct.com>"
//   SUPABASE_URL                   https://...
//   SUPABASE_SERVICE_ROLE_KEY      service_role key (bypasses RLS)
//   PUBLIC_APP_URL                 e.g. https://omega-unified.vercel.app (used in emails)
//
// The email includes the estimate laid out as styled HTML and a link
// that opens a printable version (`/estimate-view/:id`). The client can
// "Save as PDF" from the browser print dialog — avoids bundling a
// PDF engine in the function.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.SUPABASE_URL || '';
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY    = process.env.RESEND_API_KEY || '';
const RESEND_FROM       = process.env.RESEND_FROM || 'Omega Development <office@omeganyct.com>';
const PUBLIC_APP_URL    = process.env.PUBLIC_APP_URL || 'https://omega-unified.vercel.app';

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function money(n) {
  return `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeMultiline(s) {
  return escape(s).replace(/\n/g, '<br>');
}

function renderEstimateHTML({ estimate, job, company }) {
  const sections = Array.isArray(estimate.sections) ? estimate.sections : [];
  const total = estimate.total_amount ?? sections.reduce((acc, s) =>
    acc + (s.items || []).reduce((a, it) => a + (Number(it.price) || 0), 0), 0);

  const addressBlock = [company?.address, `${company?.city || ''}${company?.city && company?.state ? ', ' : ''}${company?.state || ''} ${company?.zip || ''}`.trim(), company?.phone, company?.email]
    .filter(Boolean).map((l) => `<div>${escape(l)}</div>`).join('');

  const customerBlock = [job.client_name, job.address, job.client_phone, job.client_email]
    .filter(Boolean).map((l) => `<div>${escape(l)}</div>`).join('');

  const sectionsHTML = sections.map((sec) => `
    <div style="margin-top:24px;">
      <div style="background:#2C2C2A;color:white;padding:10px 16px;font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;text-align:center;">
        ${escape(sec.title || '')}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:1px solid #e5e5e5;background:#fafafa;">
            <th style="text-align:left;padding:8px 12px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b6b;">Description</th>
            <th style="text-align:right;padding:8px 12px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b6b;width:120px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(sec.items || []).map((it) => `
            <tr style="border-bottom:1px solid #f1f1f1;vertical-align:top;">
              <td style="padding:12px;">
                <div style="font-weight:700;color:#2C2C2A;margin-bottom:4px;">${escape(it.description || '')}</div>
                <div style="color:#555;font-size:12px;white-space:pre-line;line-height:1.6;">${escapeMultiline(it.scope || '')}</div>
              </td>
              <td style="padding:12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#2C2C2A;">${money(it.price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  const customerMsgHTML = estimate.customer_message
    ? `<div style="flex:1;background:#fafafa;border:1px solid #eee;padding:16px;border-radius:6px;">
         <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b6b;margin-bottom:8px;font-weight:700;">Customer Message</div>
         <div style="font-size:13px;color:#333;white-space:pre-line;line-height:1.6;">${escape(estimate.customer_message)}</div>
       </div>`
    : '<div style="flex:1;"></div>';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Estimate #${estimate.estimate_number || ''}</title></head>
<body style="margin:0;padding:32px;background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2A;">
  <div style="max-width:780px;margin:0 auto;background:white;padding:32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.05);">

    <!-- Header -->
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:22px;font-weight:900;color:#E8732A;letter-spacing:-0.02em;">${escape(company?.company_name || 'Omega Development')}</div>
          <div style="font-size:12px;color:#555;line-height:1.6;margin-top:8px;">${addressBlock}</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="font-size:32px;font-weight:900;color:#2C2C2A;">Estimate</div>
          <table style="border-collapse:collapse;margin-top:8px;margin-left:auto;font-size:12px;">
            <tr><td style="padding:3px 8px;color:#6b6b6b;text-transform:uppercase;letter-spacing:.08em;font-weight:700;">Estimate #</td><td style="padding:3px 8px;font-weight:700;">${escape(estimate.estimate_number || '—')}</td></tr>
            <tr><td style="padding:3px 8px;color:#6b6b6b;text-transform:uppercase;letter-spacing:.08em;font-weight:700;">Date</td><td style="padding:3px 8px;">${new Date(estimate.created_at || Date.now()).toLocaleDateString()}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Customer + Service Location -->
    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      <tr>
        <td style="width:50%;padding-right:12px;vertical-align:top;">
          <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px;">
            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b6b;font-weight:700;margin-bottom:8px;">Customer</div>
            <div style="font-size:13px;line-height:1.6;">${customerBlock || '—'}</div>
          </div>
        </td>
        <td style="width:50%;padding-left:12px;vertical-align:top;">
          <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px;">
            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b6b;font-weight:700;margin-bottom:8px;">Service Location</div>
            <div style="font-size:13px;line-height:1.6;">${customerBlock || '—'}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Description -->
    ${estimate.header_description ? `
    <div style="margin-top:20px;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b6b;font-weight:700;margin-bottom:8px;">Description</div>
      <div style="font-size:13px;color:#333;white-space:pre-line;line-height:1.6;">${escape(estimate.header_description)}</div>
    </div>` : ''}

    <!-- Sections -->
    ${sectionsHTML}

    <!-- Footer: customer message + total -->
    <table style="width:100%;border-collapse:collapse;margin-top:28px;">
      <tr>
        <td style="vertical-align:top;width:60%;padding-right:12px;">
          ${customerMsgHTML}
        </td>
        <td style="vertical-align:top;width:40%;padding-left:12px;text-align:right;">
          <div style="font-size:12px;color:#6b6b6b;letter-spacing:.08em;text-transform:uppercase;font-weight:700;">Estimate Total</div>
          <div style="font-size:34px;color:#E8732A;font-weight:900;margin-top:4px;font-variant-numeric:tabular-nums;">${money(total)}</div>
        </td>
      </tr>
    </table>

    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center;">
      Questions? Reply to this email or call ${escape(company?.phone || '')}.
    </div>

  </div>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  if (!supabase)        return json(res, 500, { ok: false, error: 'Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).' });
  if (!RESEND_API_KEY)  return json(res, 500, { ok: false, error: 'Resend not configured (RESEND_API_KEY missing).' });

  let body;
  try { body = await readJson(req); }
  catch { return json(res, 400, { ok: false, error: 'Invalid JSON' }); }

  const estimateId = body?.estimateId;
  if (!estimateId) return json(res, 400, { ok: false, error: 'Missing estimateId' });

  // Load estimate + job + company settings in parallel.
  const { data: estimate, error: eErr } = await supabase
    .from('estimates').select('*').eq('id', estimateId).maybeSingle();
  if (eErr || !estimate) return json(res, 404, { ok: false, error: 'Estimate not found' });

  const { data: job } = await supabase
    .from('jobs').select('*').eq('id', estimate.job_id).maybeSingle();
  if (!job) return json(res, 404, { ok: false, error: 'Job not found' });

  if (!job.client_email) return json(res, 400, { ok: false, error: 'Client has no email on file' });

  const { data: company } = await supabase
    .from('company_settings').select('*')
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();

  const html = renderEstimateHTML({ estimate, job, company });
  const subject = `Estimate #${estimate.estimate_number || ''} — ${company?.company_name || 'Omega Development'}`.trim();
  const requester = {
    role: (req.headers['x-omega-role'] || '').toString(),
    name: (req.headers['x-omega-user'] || '').toString(),
  };

  // Send via Resend REST API (no extra dependency).
  let providerId = null;
  let errorMsg  = null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     RESEND_FROM,
        to:       [job.client_email],
        reply_to: company?.email || undefined,
        subject,
        html,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { errorMsg = data?.message || `Resend HTTP ${r.status}`; }
    else       { providerId = data?.id || null; }
  } catch (err) {
    errorMsg = err?.message || String(err);
  }

  // Write audit row regardless of success.
  try {
    await supabase.from('estimate_emails').insert({
      estimate_id: estimateId,
      job_id: estimate.job_id,
      to_email: job.client_email,
      subject,
      status: providerId ? 'sent' : 'failed',
      provider: 'resend',
      provider_id: providerId,
      error: errorMsg,
      sent_by_name: requester.name || null,
      sent_by_role: requester.role || null,
    });
  } catch { /* ignore */ }

  if (!providerId) return json(res, 500, { ok: false, error: errorMsg || 'Send failed' });

  // On success, stamp estimate.status = 'sent' + sent_at + pdf_url (to
  // a printable view of this estimate the client can print).
  try {
    await supabase.from('estimates').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: requester.name || null,
      pdf_url: `${PUBLIC_APP_URL.replace(/\/$/, '')}/estimate-view/${estimateId}`,
    }).eq('id', estimateId);
  } catch { /* ignore */ }

  return json(res, 200, { ok: true, providerId });
}

import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase';

// Public, auth-less page that renders a single estimate.
// URL: /estimate-view/:id  — ID is pulled from the path.
// The client receives this URL in the email and can use browser "Print"
// → "Save as PDF" to get a polished file.

function money(n) {
  return `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EstimateView() {
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState(null);
  const [job, setJob] = useState(null);
  const [company, setCompany] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const id = window.location.pathname.split('/').pop();
    if (!id) { setErr('Missing estimate id'); setLoading(false); return; }
    (async () => {
      try {
        const [{ data: e }, { data: c }] = await Promise.all([
          supabase.from('estimates').select('*').eq('id', id).maybeSingle(),
          supabase.from('company_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (!e) throw new Error('Estimate not found');
        const { data: j } = await supabase.from('jobs').select('*').eq('id', e.job_id).maybeSingle();
        setEstimate(e); setJob(j || null); setCompany(c || null);
      } catch (er) {
        setErr(er?.message || String(er));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading estimate…</p>;
  if (err)     return <p style={{ padding: 40, fontFamily: 'sans-serif', color: '#b00' }}>{err}</p>;
  if (!estimate) return null;

  const sections = Array.isArray(estimate.sections) ? estimate.sections : [];
  const total = estimate.total_amount ?? sections.reduce((acc, s) =>
    acc + (s.items || []).reduce((a, it) => a + (Number(it.price) || 0), 0), 0);

  const companyLines = [company?.address, company?.phone, company?.email].filter(Boolean);
  const customerLines = [job?.client_name, job?.address, job?.client_phone, job?.client_email].filter(Boolean);

  return (
    <div style={{ padding: '32px 16px', background: '#f5f5f3', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif', color: '#2C2C2A' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* Print button hidden on print */}
        <div className="no-print" style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#E8732A', color: 'white', fontWeight: 700, cursor: 'pointer' }}
          >
            Print / Save as PDF
          </button>
        </div>

        <div style={{ background: 'white', padding: 32, borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'top' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E8732A', letterSpacing: '-0.02em' }}>
                    {company?.company_name || 'Omega Development'}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginTop: 8 }}>
                    {companyLines.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                </td>
                <td style={{ verticalAlign: 'top', textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 900 }}>Estimate</div>
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <div><strong style={{ color: '#6b6b6b', letterSpacing: '.08em', textTransform: 'uppercase' }}>Estimate #</strong> &nbsp; {estimate.estimate_number || '—'}</div>
                    <div><strong style={{ color: '#6b6b6b', letterSpacing: '.08em', textTransform: 'uppercase' }}>Date</strong> &nbsp; {new Date(estimate.created_at || Date.now()).toLocaleDateString()}</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', paddingRight: 12, verticalAlign: 'top' }}>
                  <Block title="Customer" lines={customerLines} />
                </td>
                <td style={{ width: '50%', paddingLeft: 12, verticalAlign: 'top' }}>
                  <Block title="Service Location" lines={customerLines} />
                </td>
              </tr>
            </tbody>
          </table>

          {estimate.header_description && (
            <div style={{ marginTop: 20, background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: 14 }}>
              <Kicker>Description</Kicker>
              <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-line', lineHeight: 1.6, marginTop: 8 }}>
                {estimate.header_description}
              </div>
            </div>
          )}

          {sections.map((sec, i) => (
            <div key={i} style={{ marginTop: 24 }}>
              <div style={{ background: '#2C2C2A', color: 'white', padding: '10px 16px', fontSize: 14, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', textAlign: 'center' }}>
                {sec.title}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e5e5', background: '#fafafa' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b6b' }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b6b', width: 120 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sec.items || []).map((it, j) => (
                    <tr key={j} style={{ borderBottom: '1px solid #f1f1f1', verticalAlign: 'top' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{it.description}</div>
                        <div style={{ color: '#555', fontSize: 12, whiteSpace: 'pre-line', lineHeight: 1.6 }}>{it.scope}</div>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money(it.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 28 }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'top', width: '60%', paddingRight: 12 }}>
                  {estimate.customer_message && (
                    <div style={{ background: '#fafafa', border: '1px solid #eee', padding: 16, borderRadius: 6 }}>
                      <Kicker>Customer Message</Kicker>
                      <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-line', lineHeight: 1.6, marginTop: 8 }}>
                        {estimate.customer_message}
                      </div>
                    </div>
                  )}
                </td>
                <td style={{ verticalAlign: 'top', width: '40%', paddingLeft: 12, textAlign: 'right' }}>
                  <Kicker>Estimate Total</Kicker>
                  <div style={{ fontSize: 34, color: '#E8732A', fontWeight: 900, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {money(total)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #eee', fontSize: 11, color: '#888', textAlign: 'center' }}>
            Questions? Reply to this email or call {company?.phone || ''}.
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Kicker({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b6b', fontWeight: 700 }}>{children}</div>;
}

function Block({ title, lines }) {
  return (
    <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: 14 }}>
      <Kicker>{title}</Kicker>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
        {lines && lines.length
          ? lines.map((l, i) => <div key={i}>{l}</div>)
          : '—'}
      </div>
    </div>
  );
}

// Lightweight inline-SVG chart primitives. No external libs — keeps the
// Screen bundle small and lets us match the TV color palette exactly.
// All components are purely presentational: data in → SVG out.

// ─── Sparkline ─────────────────────────────────────────────────────
// Single smooth line over time with a subtle gradient fill below it.
// `values` is an array of numbers, oldest → newest.
export function Sparkline({ values, color = '#F97316', height = 32, width = 140 }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 4) - 2; // 2px padding top/bottom
    return [x, y];
  });

  const pathLine = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const pathFill = `${pathLine} L${width} ${height} L0 ${height} Z`;

  const id = `sg-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathFill} fill={`url(#${id})`} />
      <path d={pathLine} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────
// `slices` = [{ label, value, color }]
// Renders a ring with a big total in the center.
export function Donut({ slices, size = 180, thickness = 22, centerLabel, centerValue }) {
  const total = slices.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;

  let acc = 0;
  const segs = slices.map((s) => {
    const frac = total > 0 ? (Number(s.value) || 0) / total : 0;
    const seg = {
      ...s,
      length: frac * C,
      offset: acc * C,
    };
    acc += frac;
    return seg;
  });

  return (
    <svg width={size} height={size}>
      {/* Empty-state background ring so 0 data looks intentional */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness}
      />
      {segs.map((s, i) => (
        <circle
          key={i}
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={thickness}
          strokeDasharray={`${s.length.toFixed(2)} ${(C - s.length).toFixed(2)}`}
          strokeDashoffset={`${(-s.offset).toFixed(2)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="butt"
        />
      ))}

      {/* Center text */}
      {(centerLabel || centerValue) && (
        <g>
          {centerValue != null && (
            <text
              x={size / 2} y={size / 2 - 2}
              textAnchor="middle" dominantBaseline="middle"
              fill="#fff"
              style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em' }}
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={size / 2} y={size / 2 + 20}
              textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.5)"
              style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}
            >
              {centerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

// ─── Vertical bar chart (revenue per month) ───────────────────────
// `bars` = [{ label, value }]. Highlights the current (last) bar.
export function BarChart({ bars, height = 140, barGap = 8, color = '#F97316' }) {
  const max = Math.max(1, ...bars.map((b) => Number(b.value) || 0));
  const labelRowH = 18;
  const chartH = height - labelRowH;

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end gap-2 w-full" style={{ height: chartH, gap: barGap }}>
        {bars.map((b, i) => {
          const h = max > 0 ? Math.max(2, (Number(b.value) || 0) / max * (chartH - 6)) : 2;
          const isLast = i === bars.length - 1;
          return (
            <div key={b.label + i} className="flex-1 flex flex-col items-center justify-end">
              <span className={`text-[9px] font-bold tabular-nums mb-1 ${isLast ? 'text-white' : 'text-white/40'}`}>
                {formatShort(b.value)}
              </span>
              <div
                className="w-full rounded-t-md transition-all duration-700"
                style={{
                  height: `${h}px`,
                  background: isLast
                    ? `linear-gradient(180deg, ${color} 0%, ${hexAlpha(color, 0.7)} 100%)`
                    : 'rgba(255,255,255,0.08)',
                  boxShadow: isLast ? `0 0 12px ${hexAlpha(color, 0.4)}` : 'none',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 w-full mt-1" style={{ gap: barGap }}>
        {bars.map((b, i) => (
          <span
            key={'lbl' + i}
            className={`flex-1 text-center text-[10px] font-bold uppercase tracking-widest ${
              i === bars.length - 1 ? 'text-omega-orange' : 'text-white/40'
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal category bars (service mix) ───────────────────────
export function HBars({ rows, color = '#10B981' }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = max > 0 ? (r.count / max) * 100 : 0;
        return (
          <div key={r.service} className="flex items-center gap-2">
            <span className="w-24 text-[11px] font-bold text-white/70 uppercase truncate">{r.service}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}, ${hexAlpha(color, 0.55)})`,
                }}
              />
            </div>
            <span className="w-6 text-[10px] font-bold text-white tabular-nums text-right">{r.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────
function formatShort(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  if (n > 0)          return `${Math.round(n)}`;
  return '—';
}

// #RRGGBB + alpha → `rgba(r,g,b,a)`. Accepts full hex only (we control callers).
function hexAlpha(hex, alpha) {
  const s = hex.replace('#', '');
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

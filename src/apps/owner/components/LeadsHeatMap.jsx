import { useState, useEffect, useMemo } from 'react';
import { MapPin, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── CT County SVG polygons ─────────────────────────────────────────
// Simplified 8-county layout, viewBox 0 0 555 385
// Proportions approximate real CT geography (N tier ≈ 53%, S tier ≈ 47%).
// lx/ly = centroid for label/count text placement.
const CT_COUNTIES = [
  // North tier (MA border at top, y 0 → 193)
  { id: 'litchfield', name: 'Litchfield', pts: '0,5 190,0 192,193 0,193',         lx: 95,  ly: 84  },
  { id: 'hartford',   name: 'Hartford',   pts: '190,0 375,0 378,193 192,193',      lx: 283, ly: 84  },
  { id: 'tolland',    name: 'Tolland',    pts: '375,0 455,0 455,193 378,193',      lx: 416, ly: 84  },
  { id: 'windham',    name: 'Windham',    pts: '455,0 555,0 555,193 455,193',      lx: 505, ly: 84  },
  // South tier (coast at bottom, y 193 → 355)
  { id: 'fairfield',  name: 'Fairfield',  pts: '0,193 200,193 198,355 0,355',      lx: 99,  ly: 263 },
  { id: 'new_haven',  name: 'New Haven',  pts: '200,193 375,193 370,355 198,355',  lx: 285, ly: 263 },
  { id: 'middlesex',  name: 'Middlesex',  pts: '375,193 432,193 428,355 370,355',  lx: 400, ly: 263 },
  { id: 'new_london', name: 'New London', pts: '432,193 555,193 555,355 428,355',  lx: 492, ly: 263 },
];

// ─── City → County lookup ───────────────────────────────────────────
// Covers the main CT cities/towns. Lower-cased for comparison.
const CITY_TO_COUNTY = {
  // Fairfield County
  'greenwich': 'fairfield', 'cos cob': 'fairfield', 'old greenwich': 'fairfield',
  'byram': 'fairfield', 'riverside': 'fairfield', 'glenville': 'fairfield',
  'stamford': 'fairfield', 'springdale': 'fairfield',
  'darien': 'fairfield', 'noroton': 'fairfield', 'noroton heights': 'fairfield',
  'new canaan': 'fairfield',
  'norwalk': 'fairfield', 'east norwalk': 'fairfield', 'south norwalk': 'fairfield',
  'wilton': 'fairfield',
  'westport': 'fairfield', 'saugatuck': 'fairfield',
  'weston': 'fairfield',
  'fairfield': 'fairfield', 'southport': 'fairfield',
  'bridgeport': 'fairfield', 'black rock': 'fairfield',
  'trumbull': 'fairfield', 'monroe': 'fairfield',
  'shelton': 'fairfield', 'stratford': 'fairfield',
  'milford': 'fairfield', 'devon': 'fairfield',
  'orange': 'fairfield', 'derby': 'fairfield',
  'ansonia': 'fairfield', 'seymour': 'fairfield',
  'bethel': 'fairfield', 'brookfield': 'fairfield',
  'newtown': 'fairfield', 'redding': 'fairfield',
  'easton': 'fairfield', 'new fairfield': 'fairfield',
  'sherman': 'fairfield', 'ridgefield': 'fairfield',
  'danbury': 'fairfield', 'brookfield center': 'fairfield',

  // New Haven County
  'new haven': 'new_haven', 'east haven': 'new_haven', 'west haven': 'new_haven',
  'hamden': 'new_haven', 'north haven': 'new_haven',
  'waterbury': 'new_haven', 'naugatuck': 'new_haven',
  'meriden': 'new_haven', 'wallingford': 'new_haven',
  'cheshire': 'new_haven', 'southbury': 'new_haven',
  'oxford': 'new_haven', 'beacon falls': 'new_haven',
  'woodbridge': 'new_haven', 'bethany': 'new_haven',
  'madison': 'new_haven', 'guilford': 'new_haven', 'branford': 'new_haven',
  'north branford': 'new_haven', 'wolcott': 'new_haven',
  'prospect': 'new_haven', 'ansonia ct': 'new_haven',

  // Hartford County
  'hartford': 'hartford', 'west hartford': 'hartford', 'east hartford': 'hartford',
  'new britain': 'hartford', 'bristol': 'hartford',
  'southington': 'hartford', 'newington': 'hartford',
  'glastonbury': 'hartford', 'enfield': 'hartford',
  'bloomfield': 'hartford', 'manchester': 'hartford',
  'plainville': 'hartford', 'canton': 'hartford',
  'simsbury': 'hartford', 'avon': 'hartford', 'farmington': 'hartford',
  'burlington': 'hartford', 'granby': 'hartford', 'east granby': 'hartford',
  'suffield': 'hartford', 'windsor': 'hartford', 'windsor locks': 'hartford',
  'east windsor': 'hartford', 'south windsor': 'hartford',
  'wethersfield': 'hartford', 'rocky hill': 'hartford', 'berlin': 'hartford',

  // Middlesex County
  'middletown': 'middlesex', 'middlefield': 'middlesex',
  'old saybrook': 'middlesex', 'clinton': 'middlesex', 'westbrook': 'middlesex',
  'essex': 'middlesex', 'ivoryton': 'middlesex', 'centerbrook': 'middlesex',
  'deep river': 'middlesex', 'chester': 'middlesex',
  'cromwell': 'middlesex', 'portland': 'middlesex',
  'east haddam': 'middlesex', 'haddam': 'middlesex', 'durham': 'middlesex',

  // New London County
  'new london': 'new_london', 'norwich': 'new_london',
  'groton': 'new_london', 'mystic': 'new_london',
  'waterford': 'new_london', 'montville': 'new_london',
  'colchester': 'new_london', 'east lyme': 'new_london',
  'old lyme': 'new_london', 'lyme': 'new_london',
  'ledyard': 'new_london', 'stonington': 'new_london',
  'niantic': 'new_london', 'bozrah': 'new_london',
  'griswold': 'new_london', 'voluntown': 'new_london',

  // Litchfield County
  'torrington': 'litchfield', 'new milford': 'litchfield',
  'litchfield': 'litchfield', 'winsted': 'litchfield',
  'thomaston': 'litchfield', 'harwinton': 'litchfield',
  'cornwall': 'litchfield', 'kent': 'litchfield',
  'salisbury': 'litchfield', 'sharon': 'litchfield', 'canaan': 'litchfield',
  'roxbury': 'litchfield', 'washington': 'litchfield',
  'woodbury': 'litchfield', 'watertown': 'litchfield',
  'morris': 'litchfield', 'colebrook': 'litchfield',
  'barkhamsted': 'litchfield',

  // Tolland County
  'stafford': 'tolland', 'stafford springs': 'tolland',
  'coventry': 'tolland', 'tolland': 'tolland',
  'ellington': 'tolland', 'somers': 'tolland',
  'andover': 'tolland', 'bolton': 'tolland',
  'columbia': 'tolland', 'hebron': 'tolland',
  'mansfield': 'tolland', 'storrs': 'tolland',
  'willington': 'tolland', 'union': 'tolland',
  'vernon': 'tolland', 'rockville': 'tolland',

  // Windham County
  'willimantic': 'windham', 'putnam': 'windham',
  'windham': 'windham', 'plainfield': 'windham',
  'killingly': 'windham', 'brooklyn': 'windham',
  'pomfret': 'windham', 'thompson': 'windham',
  'woodstock': 'windham', 'ashford': 'windham',
  'eastford': 'windham', 'chaplin': 'windham',
  'hampton': 'windham', 'sterling': 'windham',
};

// ─── Helpers ────────────────────────────────────────────────────────

/** Extract the city from common CT address formats. */
function parseCity(address) {
  if (!address) return null;
  const raw = address.trim();

  // Pattern: "... City, CT ..." or "... City CT ..."
  const commaCtMatch = raw.match(/,\s*([^,]+?)\s*,\s*CT\b/i);
  if (commaCtMatch) return commaCtMatch[1].trim().toLowerCase();

  // Pattern: "City, CT" at the end
  const endCtMatch = raw.match(/([^,]+?)\s*,\s*CT\b/i);
  if (endCtMatch) return endCtMatch[1].trim().toLowerCase();

  // Pattern: city name followed by "CT" (no comma, e.g., "Westport CT 06880")
  const spaceCtMatch = raw.match(/,\s*(.+?)\s+CT\b/i);
  if (spaceCtMatch) return spaceCtMatch[1].trim().toLowerCase();

  // Fallback: second-to-last comma-separated part
  const parts = raw.split(',').map(s => s.trim());
  if (parts.length >= 2) return parts[parts.length - 2].toLowerCase();

  return null;
}

/** Orange heat gradient: slate-100 (empty) → orange-100 → orange-600. */
function heatColor(count, maxCount) {
  if (!count || !maxCount) return '#F8FAFC';
  const t = Math.min(count / maxCount, 1);
  // orange-100 #FFEDD5 → orange-600 #EA580C
  const r = Math.round(255 + t * (234 - 255));
  const g = Math.round(237 + t * (88  - 237));
  const b = Math.round(213 + t * (12  - 213));
  return `rgb(${r},${g},${b})`;
}

/** Text color — white on dark, charcoal on light. */
function labelColor(count, maxCount) {
  if (!maxCount) return '#6B7280';
  const t = count / maxCount;
  return t > 0.55 ? '#7C2D12' : '#374151';
}

const PERIODS = [
  { id: 'all',   label: 'All Time' },
  { id: 'year',  label: 'This Year' },
  { id: 'month', label: 'This Month' },
];

// ─── Component ──────────────────────────────────────────────────────
export default function LeadsHeatMap() {
  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [period, setPeriod]           = useState('all');
  const [hoveredId, setHoveredId]     = useState(null);

  useEffect(() => {
    supabase
      .from('jobs')
      .select('id, address, created_at, client_name')
      .then(({ data }) => { setJobs(data || []); setLoading(false); });
  }, []);

  // ── Filter by period ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (period === 'all') return jobs;
    const now = new Date();
    const cutoff = period === 'year'
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    return jobs.filter(j => new Date(j.created_at) >= cutoff);
  }, [jobs, period]);

  // ── Aggregate by county + city ────────────────────────────────────
  const { byCty, allCities } = useMemo(() => {
    const byCty    = {};
    const allCities = {};
    CT_COUNTIES.forEach(c => { byCty[c.id] = { count: 0, cities: {} }; });

    filtered.forEach(j => {
      const city = parseCity(j.address);
      if (!city) return;
      const cty = CITY_TO_COUNTY[city];
      if (!cty) return;
      byCty[cty].count++;
      byCty[cty].cities[city] = (byCty[cty].cities[city] || 0) + 1;
      allCities[city] = (allCities[city] || 0) + 1;
    });

    return { byCty, allCities };
  }, [filtered]);

  const maxCount    = Math.max(...CT_COUNTIES.map(c => byCty[c.id]?.count || 0), 1);
  const totalMapped = CT_COUNTIES.reduce((s, c) => s + (byCty[c.id]?.count || 0), 0);
  const totalJobs   = filtered.length;

  const topCities = Object.entries(allCities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Hovered county detail
  const hoveredData = hoveredId
    ? {
        county: CT_COUNTIES.find(c => c.id === hoveredId),
        count: byCty[hoveredId]?.count || 0,
        topCities: Object.entries(byCty[hoveredId]?.cities || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
      }
    : null;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-omega-pale flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-omega-orange" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-omega-charcoal leading-none">Lead Origins — Connecticut</h3>
            <p className="text-[11px] text-omega-stone mt-0.5">
              {loading ? 'Loading…' : `${totalMapped} of ${totalJobs} leads mapped to county`}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                period === p.id
                  ? 'bg-omega-orange text-white shadow-sm'
                  : 'bg-gray-100 text-omega-stone hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-52 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-omega-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-5 items-start">

          {/* ── SVG Map ── */}
          <div className="flex-1 min-w-0">
            <svg
              viewBox="0 0 555 385"
              className="w-full"
              style={{ maxHeight: '230px', display: 'block' }}
            >
              {/* MA label */}
              <text x="277" y="13" textAnchor="middle" fontSize="7.5" fill="#94A3B8"
                fontWeight="600" style={{ letterSpacing: '0.12em' }}>
                MASSACHUSETTS
              </text>

              {/* County polygons */}
              {CT_COUNTIES.map(county => {
                const count     = byCty[county.id]?.count || 0;
                const isHovered = hoveredId === county.id;
                const fill      = heatColor(count, maxCount);
                const txtColor  = labelColor(count, maxCount);
                // Narrow counties get smaller label font
                const narrow    = county.id === 'tolland' || county.id === 'middlesex';

                return (
                  <g
                    key={county.id}
                    onMouseEnter={() => setHoveredId(county.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <polygon
                      points={county.pts}
                      fill={fill}
                      stroke="white"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      style={{
                        filter: isHovered ? 'brightness(0.88)' : 'none',
                        transition: 'filter 0.12s',
                      }}
                    />
                    {/* County name */}
                    <text
                      x={county.lx}
                      y={county.ly - 4}
                      textAnchor="middle"
                      fontSize={narrow ? 7 : 7.5}
                      fontWeight="700"
                      fill={txtColor}
                      style={{ letterSpacing: '0.06em', userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {county.name.toUpperCase()}
                    </text>
                    {/* Lead count */}
                    {count > 0 && (
                      <text
                        x={county.lx}
                        y={county.ly + 11}
                        textAnchor="middle"
                        fontSize={narrow ? 12 : 14}
                        fontWeight="800"
                        fill={txtColor}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                      >
                        {count}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Long Island Sound water strip */}
              <rect x="0" y="355" width="555" height="28" fill="#DBEAFE" />
              <text x="277" y="372" textAnchor="middle" fontSize="8" fill="#93C5FD"
                fontWeight="600" style={{ letterSpacing: '0.1em' }}>
                LONG ISLAND SOUND
              </text>

              {/* NY label */}
              <text x="10" y="100" fontSize="7.5" fill="#94A3B8"
                fontWeight="600" style={{ letterSpacing: '0.1em' }}
                transform="rotate(-90, 10, 100)">
                NY
              </text>
              {/* RI label */}
              <text x="548" y="100" fontSize="7.5" fill="#94A3B8"
                fontWeight="600" textAnchor="middle">
                RI
              </text>
            </svg>

            {/* Color legend */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-omega-stone">0</span>
              <div
                className="flex-1 h-2 rounded-full"
                style={{ background: 'linear-gradient(to right, #F8FAFC, #FFEDD5, #FB923C, #EA580C)' }}
              />
              <span className="text-[10px] text-omega-stone">{maxCount === 1 ? '1' : maxCount}+</span>
            </div>
            <p className="text-[10px] text-omega-stone text-center mt-0.5">leads per county · hover for detail</p>
          </div>

          {/* ── Right panel ── */}
          <div className="w-48 flex-shrink-0 min-h-[200px]">
            {hoveredData ? (
              /* County hover detail */
              <div className="bg-omega-cloud rounded-xl p-3.5 h-full">
                <p className="text-xs font-bold text-omega-charcoal leading-none">
                  {hoveredData.county?.name} County
                </p>
                <p className="text-3xl font-black text-omega-charcoal tabular-nums leading-none mt-2">
                  {hoveredData.count}
                </p>
                <p className="text-[11px] text-omega-stone mt-0.5">
                  lead{hoveredData.count !== 1 ? 's' : ''} · {Math.round((hoveredData.count / (totalMapped || 1)) * 100)}% of total
                </p>

                {hoveredData.topCities.length > 0 && (
                  <>
                    <div className="border-t border-gray-200 mt-3 pt-3">
                      <p className="text-[10px] font-bold text-omega-stone uppercase tracking-wider mb-2">
                        Top Cities
                      </p>
                      <div className="space-y-1.5">
                        {hoveredData.topCities.map(([city, n]) => (
                          <div key={city} className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-omega-charcoal capitalize truncate">{city}</p>
                            <span className="text-[11px] font-bold text-omega-charcoal tabular-nums flex-shrink-0">{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Top cities bar chart */
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-omega-orange" />
                  <p className="text-[11px] font-bold text-omega-stone uppercase tracking-wider">
                    Top Cities
                  </p>
                </div>
                {topCities.length === 0 ? (
                  <p className="text-xs text-omega-stone italic">No address data yet</p>
                ) : (
                  <div className="space-y-2.5">
                    {topCities.map(([city, n]) => (
                      <div key={city} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-omega-charcoal capitalize truncate">{city}</p>
                          <div className="mt-0.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-omega-orange rounded-full transition-all"
                              style={{ width: `${Math.round((n / topCities[0][1]) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-omega-charcoal tabular-nums flex-shrink-0">{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {!loading && totalJobs > 0 && totalMapped === 0 && (
        <p className="text-xs text-omega-stone italic text-center mt-3">
          No Connecticut addresses parsed yet — check that addresses include city and "CT".
        </p>
      )}
    </section>
  );
}

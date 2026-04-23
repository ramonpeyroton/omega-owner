// Cabinet catalog — FGM and Fabuwood brands, series, lines, and colors.
// Structure:
//   Brand  →  Series/Collection  →  Line (Fabuwood only)  →  Color
//
// FGM skips the "line" level (series goes straight to colors).
// Fabuwood has the full 4-level hierarchy.
//
// The questionnaire imports the helpers at the bottom of this file as the
// dynamic `options` resolvers for the cabinet questions.

// ─── FGM ───────────────────────────────────────────────────────────
const FGM = {
  label: 'FGM',
  series: {
    mercury: { label: 'Mercury Series', colors: ['Mercury Grey', 'Mercury White', 'Mercury Harvest'] },
    venus:   { label: 'Venus Series',   colors: ['Venus Ivory'] },
    jupiter: { label: 'Jupiter Series', colors: ['Jupiter Ice', 'Jupiter Gani'] },
    neptune: { label: 'Neptune Series', colors: ['Neptune Triton'] },
  },
};

// ─── Fabuwood ──────────────────────────────────────────────────────
const FB_COLORS = {
  galaxy: ['Frost','Dove','Linen','Nickel','Indigo','Pitch Black','Pistachio Green','Timber','Horizon','Desert Oak','Mocha','Cobblestone','Truffle','Stone','Oyster','Denim Blue','Sage Green','Hunter Green','Forest Green','Graphite Black','Cloud White','Macadamia Beige','Mint Green','Cabernet Red','Orchid Purple','Izel Blue','Custom finish'],
  fusion: ['Frost','Dove','Linen','Nickel','Indigo','Pitch Black','Timber','Mocha','Desert Oak','Cobblestone','Stone','Oyster','Denim Blue','Sage Green','Hunter Green','Graphite Black','Cloud White','Custom finish'],
  luna:   ['Frost','Dove','Linen','Nickel','Timber','Mocha','Desert Oak','Stone','Oyster','Cloud White','Sage Green','Denim Blue','Custom finish'],
  nexus:  ['Frost','Dove','Linen','Nickel','Indigo','Pitch Black','Timber','Desert Oak','Stone','Oyster','Graphite Black','Denim Blue','Custom finish'],
  imperio:['Frost','Dove','Linen','Nickel','Timber','Mocha','Desert Oak','Stone','Oyster','Sage Green','Cloud White','Custom finish'],
  catalina:['Frost','Dove','Nickel','Indigo','Pitch Black','Timber','Desert Oak','Stone','Graphite Black','Denim Blue','Custom finish'],
  lume:   ['Frost','Dove','Nickel','Timber','Desert Oak','Stone','Cloud White','Custom finish'],
  essence:['Frost','Dove','Linen','Nickel','Timber','Mocha','Desert Oak','Stone','Oyster','Custom finish'],
  valencia:['Frost','Dove','Linen','Timber','Mocha','Kona','Espresso','Stone','Oyster','Custom finish'],
  hallmark:['Frost','Dove','Linen','Timber','Kona','Espresso'],
  discovery:['Frost','Dove','Nickel','Timber'],
  metro:  ['Frost','Dove','Nickel','Timber','Kona','Espresso','Stone','Custom finish'],
  onyx:   ['Frost','Dove','Nickel','Indigo','Pitch Black','Timber','Stone','Custom finish'],
};

const FABUWOOD = {
  label: 'Fabuwood',
  collections: {
    allure: {
      label: 'Allure',
      lines: {
        galaxy:  { label: 'Galaxy',  colors: FB_COLORS.galaxy },
        fusion:  { label: 'Fusion',  colors: FB_COLORS.fusion },
        luna:    { label: 'Luna',    colors: FB_COLORS.luna },
        nexus:   { label: 'Nexus',   colors: FB_COLORS.nexus },
        imperio: { label: 'Imperio', colors: FB_COLORS.imperio },
      },
    },
    illume: {
      label: 'Illume',
      lines: {
        catalina: { label: 'Catalina', colors: FB_COLORS.catalina },
        lume:     { label: 'Lume',     colors: FB_COLORS.lume },
      },
    },
    ovela: {
      label: 'Ovela',
      lines: {
        essence: { label: 'Essence', colors: FB_COLORS.essence },
      },
    },
    valencia: {
      label: 'Valencia',
      lines: {
        valencia: { label: 'Valencia', colors: FB_COLORS.valencia },
      },
    },
    value_premium: {
      label: 'Value Premium',
      lines: {
        hallmark:  { label: 'Hallmark',  colors: FB_COLORS.hallmark },
        discovery: { label: 'Discovery', colors: FB_COLORS.discovery },
      },
    },
    quest: {
      label: 'Quest',
      lines: {
        metro: { label: 'Metro', colors: FB_COLORS.metro },
        onyx:  { label: 'Onyx',  colors: FB_COLORS.onyx },
      },
    },
  },
};

const BRANDS = { fgm: FGM, fabuwood: FABUWOOD };

// ─── Helpers ───────────────────────────────────────────────────────
// Each helper returns `[{ value, label }]` arrays — the shape the
// questionnaire renderer expects for single/select options.

const toOption = (value, label) => ({ value, label: label || value });

/** Top-level brand options. */
export const brandOptions = [
  toOption('fgm',      'FGM'),
  toOption('fabuwood', 'Fabuwood'),
  toOption('custom',   'Custom / Other'),
];

/** Series/collection options for a given brand. */
export function seriesOptionsFor(brand) {
  if (brand === 'fgm') {
    return Object.entries(FGM.series).map(([k, v]) => toOption(k, v.label));
  }
  if (brand === 'fabuwood') {
    return Object.entries(FABUWOOD.collections).map(([k, v]) => toOption(k, v.label));
  }
  return [];
}

/**
 * Line options — only meaningful for Fabuwood (FGM skips this level).
 * Returns `[]` for FGM or anything else, which means the dependent
 * question should be hidden by its `showIf`.
 */
export function lineOptionsFor(brand, series) {
  if (brand !== 'fabuwood' || !series) return [];
  const collection = FABUWOOD.collections[series];
  if (!collection) return [];
  return Object.entries(collection.lines).map(([k, v]) => toOption(k, v.label));
}

/** Color options for (brand, series[, line]). */
export function colorOptionsFor(brand, series, line) {
  if (brand === 'fgm') {
    const s = FGM.series[series];
    if (!s) return [];
    return s.colors.map((c) => toOption(c, c));
  }
  if (brand === 'fabuwood') {
    const collection = FABUWOOD.collections[series];
    if (!collection) return [];
    const ln = collection.lines[line];
    if (!ln) return [];
    return ln.colors.map((c) => toOption(c, c));
  }
  return [];
}

/**
 * Only show the "line" question when the brand is Fabuwood and a
 * series has been picked (i.e. Fabuwood has sub-lines under the
 * collection).
 */
export function needsLineQuestion(answers) {
  return answers?.kitchen_cabinet_brand === 'fabuwood' && !!answers?.kitchen_cabinet_series;
}

export { BRANDS };

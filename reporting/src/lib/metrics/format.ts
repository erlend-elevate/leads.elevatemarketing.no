/**
 * nb-NO-formatering (brief 7.5). Egen testdekket modul — en rapport med
 * «12,345.67» til norsk kunde er en feil (felle nr. 13).
 *
 * Tusenskille = hardt mellomrom (U+00A0), desimalkomma. Ulike ICU-versjoner
 * bruker U+202F (smalt hardt mellomrom) — vi normaliserer alltid til U+00A0
 * så output er deterministisk på tvers av Node-versjoner.
 */

const NBSP = ' ';

function normalizeSpaces(s: string): string {
  return s.replace(/[\u202F\u2009\u00A0]/g, NBSP);
}

const intFmt = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

export function formatInt(n: number): string {
  return normalizeSpaces(intFmt.format(n));
}

export function formatDecimal(n: number, decimals = 1): string {
  return normalizeSpaces(
    new Intl.NumberFormat('nb-NO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n),
  );
}

/** Valuta i KPI-kort: 0 desimaler, «12 345 kr» for NOK */
export function formatCurrency(n: number, currency = 'NOK'): string {
  if (currency === 'NOK') return `${formatInt(n)}${NBSP}kr`;
  return normalizeSpaces(
    new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n),
  );
}

/** Prosent med 1 desimal fra brøk (0.034 → «3,4 %») */
export function formatPercentFromFraction(fraction: number): string {
  return `${formatDecimal(fraction * 100, 1)}${NBSP}%`;
}

/** Prosent med 1 desimal fra prosentverdi (3.4 → «3,4 %») */
export function formatPercent(pct: number): string {
  return `${formatDecimal(pct, 1)}${NBSP}%`;
}

/** GSC-posisjon: 1 desimal */
export function formatPosition(position: number): string {
  return formatDecimal(position, 1);
}

/** Delta som prosent med fortegn: «+12,4 %» / «−8,0 %» (norsk minustegn) */
export function formatDeltaPct(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${formatDecimal(Math.abs(value), 1)}${NBSP}%`;
}

/**
 * Kortform for store tall i GRAFER (aldri i KPI-kort):
 * 1 234 → «1,2 k», 1 234 567 → «1,2 mill.»
 */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${formatDecimal(n / 1_000_000, 1)}${NBSP}mill.`;
  if (abs >= 10_000) return `${formatDecimal(n / 1_000, 1)}${NBSP}k`;
  return formatInt(n);
}

/* ------------------------------------------------------------------ */
/* Periodeetiketter                                                    */
/* ------------------------------------------------------------------ */

const MONTHS_NB = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
];

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** «juli 2026» for en månedsperiode */
export function monthLabel(periodStart: string): string {
  const { y, m } = parts(periodStart);
  return `${MONTHS_NB[m - 1]} ${y}`;
}

/** «uke 28, 2026» — tar ISO-ukeinfo som argument (beregnes i periods.ts) */
export function weekLabel(week: number, year: number): string {
  return `uke ${week}, ${year}`;
}

/** «1.–31. juli 2026», «28. juli–3. august 2026», «30. desember 2025–5. januar 2026» */
export function dateRangeLabel(startIso: string, endIso: string): string {
  const a = parts(startIso);
  const b = parts(endIso);
  const end = `${b.d}. ${MONTHS_NB[b.m - 1]} ${b.y}`;
  if (a.y !== b.y) return `${a.d}. ${MONTHS_NB[a.m - 1]} ${a.y}–${end}`;
  if (a.m !== b.m) return `${a.d}. ${MONTHS_NB[a.m - 1]}–${end}`;
  return `${a.d}.–${end}`;
}

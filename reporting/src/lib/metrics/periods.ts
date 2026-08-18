/**
 * Periodelogikk (brief 7.3). All logikk er basert på kalenderdatoer i
 * Europe/Oslo. Internt regnes det på UTC-midnatt-datoer med ren dags-
 * aritmetikk, slik at resultatet ALDRI avhenger av serverens tidssone —
 * eneste tidssoneavhengige steg er `todayInOslo()`.
 */

import { formatInTimeZone } from 'date-fns-tz';

export const OSLO_TZ = 'Europe/Oslo';

/**
 * Månedsrapporter forfaller på N-te VIRKEDAG i måneden (man–fre).
 * Default 3 — valgt pga. GSC-etterslep (~2 dager) og Meta-attribusjon.
 * Bekreftet av Erlend 15.07.2026. Norske helligdager telles ikke som
 * fridager her (bevisst forenkling, dokumentert i README).
 */
export const MONTHLY_SEND_BUSINESS_DAY = 3;

/** GSC-data regnes som komplette først etter ~2 dager; vi kutter på dag 3. */
export const GSC_LAG_DAYS = 3;

export type IsoDate = string; // YYYY-MM-DD

export interface Period {
  /** YYYY-MM-DD, inklusiv */
  start: IsoDate;
  /** YYYY-MM-DD, inklusiv */
  end: IsoDate;
}

export type Frequency = 'weekly' | 'monthly';
export type ComparisonMode = 'previous_period' | 'yoy';

/* ------------------------------------------------------------------ */
/* Interne dato-hjelpere (UTC-midnatt, ren dagsaritmetikk)             */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

function toDate(iso: IsoDate): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Ugyldig dato: ${iso}`);
  return d;
}

function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** ISO-ukedag: mandag=1 … søndag=7 */
export function isoWeekday(iso: IsoDate): number {
  return ((toDate(iso).getUTCDay() + 6) % 7) + 1;
}

/** Mandagen i uka datoen tilhører */
export function startOfIsoWeek(iso: IsoDate): IsoDate {
  return addDays(iso, -(isoWeekday(iso) - 1));
}

/** ISO-ukenummer og ISO-ukeår (torsdagsregelen) */
export function isoWeekInfo(iso: IsoDate): { week: number; year: number } {
  const thursday = addDays(startOfIsoWeek(iso), 3);
  const year = toDate(thursday).getUTCFullYear();
  const jan4 = `${year}-01-04`;
  const week1Monday = startOfIsoWeek(jan4);
  const week =
    Math.floor(
      (toDate(thursday).getTime() - toDate(week1Monday).getTime()) /
        (7 * DAY_MS),
    ) + 1;
  return { week, year };
}

/** Antall ISO-uker i et ISO-ukeår (52 eller 53) */
export function isoWeeksInYear(year: number): number {
  return isoWeekInfo(`${year}-12-28`).week;
}

/** Mandagen i gitt ISO-uke/ISO-ukeår */
export function mondayOfIsoWeek(year: number, week: number): IsoDate {
  const week1Monday = startOfIsoWeek(`${year}-01-04`);
  return addDays(week1Monday, (week - 1) * 7);
}

/* ------------------------------------------------------------------ */
/* «I dag» i Oslo                                                      */
/* ------------------------------------------------------------------ */

/** Kalenderdato i Europe/Oslo for et gitt tidspunkt */
export function todayInOslo(now: Date = new Date()): IsoDate {
  return formatInTimeZone(now, OSLO_TZ, 'yyyy-MM-dd');
}

/* ------------------------------------------------------------------ */
/* Rapportperioder                                                     */
/* ------------------------------------------------------------------ */

/** Forrige ISO-uke (man–søn) relativt til gitt Oslo-dato */
export function previousIsoWeek(todayOslo: IsoDate): Period {
  const thisMonday = startOfIsoWeek(todayOslo);
  const start = addDays(thisMonday, -7);
  return { start, end: addDays(start, 6) };
}

/** Forrige kalendermåned relativt til gitt Oslo-dato */
export function previousMonth(todayOslo: IsoDate): Period {
  const [y, m] = todayOslo.split('-').map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const start = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  return { start, end: `${prevY}-${String(prevM).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}` };
}

/** Rapportperioden en config forfaller for på gitt dato */
export function reportPeriodFor(frequency: Frequency, todayOslo: IsoDate): Period {
  return frequency === 'weekly'
    ? previousIsoWeek(todayOslo)
    : previousMonth(todayOslo);
}

/**
 * Sammenligningsperiode (brief 7.2):
 *  - previous_period: uke → forrige ISO-uke; måned → forrige kalendermåned
 *  - yoy: måned → samme måned i fjor; uke → samme ISO-ukenummer i fjor
 *    (uke 53 finnes ikke alle år — klemmes til siste uke i fjoråret)
 */
export function comparisonPeriod(
  period: Period,
  frequency: Frequency,
  mode: ComparisonMode,
): Period {
  if (mode === 'previous_period') {
    if (frequency === 'weekly') {
      const start = addDays(period.start, -7);
      return { start, end: addDays(start, 6) };
    }
    return previousMonth(period.start);
  }
  // yoy
  if (frequency === 'weekly') {
    const { week, year } = isoWeekInfo(period.start);
    const lastYear = year - 1;
    const clampedWeek = Math.min(week, isoWeeksInYear(lastYear));
    const start = mondayOfIsoWeek(lastYear, clampedWeek);
    return { start, end: addDays(start, 6) };
  }
  const [y, m] = period.start.split('-').map(Number);
  const start = `${y - 1}-${String(m).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return { start, end: `${y - 1}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}` };
}

/* ------------------------------------------------------------------ */
/* Forfallslogikk (cron-tick)                                          */
/* ------------------------------------------------------------------ */

/** true hvis datoen er man–fre */
export function isBusinessDay(iso: IsoDate): boolean {
  return isoWeekday(iso) <= 5;
}

/** N-te virkedag (man–fre) i månedens dato tilhører */
export function nthBusinessDayOfMonth(iso: IsoDate, n: number): IsoDate {
  const [y, m] = iso.split('-').map(Number);
  let d = `${y}-${String(m).padStart(2, '0')}-01`;
  let count = 0;
  for (let i = 0; i < 31; i++) {
    if (isBusinessDay(d)) {
      count++;
      if (count === n) return d;
    }
    d = addDays(d, 1);
  }
  throw new Error(`Fant ikke ${n}. virkedag i måneden for ${iso}`);
}

/** Forfaller en config med gitt frekvens på denne Oslo-datoen? */
export function isDue(frequency: Frequency, todayOslo: IsoDate): boolean {
  if (frequency === 'weekly') return isoWeekday(todayOslo) === 1; // mandag
  return todayOslo === nthBusinessDayOfMonth(todayOslo, MONTHLY_SEND_BUSINESS_DAY);
}

/* ------------------------------------------------------------------ */
/* GSC-etterslep                                                       */
/* ------------------------------------------------------------------ */

export type GscClampResult =
  | { period: Period; truncated: false; empty: false }
  /** truncated → rapporten viser «Data t.o.m. {end}» på GSC-seksjonen */
  | { period: Period; truncated: true; empty: false }
  /** empty → ingen komplette dager i perioden; GSC-seksjonen viser tom-tilstand */
  | { period: null; truncated: true; empty: true };

/**
 * GSC har ~2 dagers dataetterslep (empirisk bekreftet 15.07.2026).
 * Er period.end nyere enn (i dag − GSC_LAG_DAYS), kuttes perioden til siste
 * komplette dato og seksjonen flagges.
 */
export function clampGscPeriod(period: Period, todayOslo: IsoDate): GscClampResult {
  const lastComplete = addDays(todayOslo, -GSC_LAG_DAYS);
  if (period.end <= lastComplete) return { period, truncated: false, empty: false };
  if (period.start > lastComplete) {
    // Hele perioden ligger i etterslep-vinduet — ingen komplette dager
    return { period: null, truncated: true, empty: true };
  }
  return {
    period: { start: period.start, end: lastComplete },
    truncated: true,
    empty: false,
  };
}

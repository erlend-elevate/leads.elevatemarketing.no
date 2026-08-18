import { describe, expect, it } from 'vitest';
import {
  clampGscPeriod,
  comparisonPeriod,
  isDue,
  isoWeekInfo,
  isoWeeksInYear,
  mondayOfIsoWeek,
  nthBusinessDayOfMonth,
  previousIsoWeek,
  previousMonth,
  reportPeriodFor,
  todayInOslo,
} from '../src/lib/metrics/periods';

// Fasit: 15.07.2026 er en onsdag; 01.07.2026 er en onsdag; 01.08.2026 er en lørdag.

describe('previousIsoWeek', () => {
  it('gir forrige ISO-uke man–søn', () => {
    expect(previousIsoWeek('2026-07-15')).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
  });

  it('fungerer når i dag er mandag', () => {
    expect(previousIsoWeek('2026-07-13')).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
  });

  it('fungerer over årsskiftet', () => {
    // 2026-01-01 er torsdag → forrige uke er man 22.12–søn 28.12.2025
    expect(previousIsoWeek('2026-01-01')).toEqual({
      start: '2025-12-22',
      end: '2025-12-28',
    });
  });
});

describe('previousMonth', () => {
  it('gir forrige kalendermåned', () => {
    expect(previousMonth('2026-07-15')).toEqual({
      start: '2026-06-01',
      end: '2026-06-30',
    });
  });

  it('håndterer januar → desember i fjor', () => {
    expect(previousMonth('2026-01-10')).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });

  it('håndterer skuddår (mars → februar)', () => {
    expect(previousMonth('2028-03-05')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });
});

describe('isoWeekInfo', () => {
  it('gir riktig ukenummer', () => {
    expect(isoWeekInfo('2026-07-06')).toEqual({ week: 28, year: 2026 });
  });

  it('legger første dager i januar i fjorårets siste uke når det stemmer', () => {
    // 1.1.2027 er en fredag → tilhører uke 53 av 2026
    expect(isoWeekInfo('2027-01-01')).toEqual({ week: 53, year: 2026 });
  });

  it('kjenner antall uker i året', () => {
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2025)).toBe(52);
  });
});

describe('comparisonPeriod', () => {
  const june: { start: string; end: string } = {
    start: '2026-06-01',
    end: '2026-06-30',
  };

  it('previous_period for måned gir forrige kalendermåned', () => {
    expect(comparisonPeriod(june, 'monthly', 'previous_period')).toEqual({
      start: '2026-05-01',
      end: '2026-05-31',
    });
  });

  it('previous_period for uke gir uka før', () => {
    expect(
      comparisonPeriod({ start: '2026-07-06', end: '2026-07-12' }, 'weekly', 'previous_period'),
    ).toEqual({ start: '2026-06-29', end: '2026-07-05' });
  });

  it('yoy for måned gir samme måned i fjor', () => {
    expect(comparisonPeriod(june, 'monthly', 'yoy')).toEqual({
      start: '2025-06-01',
      end: '2025-06-30',
    });
  });

  it('yoy for uke gir samme ISO-ukenummer i fjor', () => {
    // uke 28 2026 → uke 28 2025
    expect(
      comparisonPeriod({ start: '2026-07-06', end: '2026-07-12' }, 'weekly', 'yoy'),
    ).toEqual({ start: '2025-07-07', end: '2025-07-13' });
  });

  it('yoy for uke 53 klemmes til siste uke i fjoråret', () => {
    const w53Monday = mondayOfIsoWeek(2026, 53);
    expect(w53Monday).toBe('2026-12-28');
    const cmp = comparisonPeriod(
      { start: w53Monday, end: '2027-01-03' },
      'weekly',
      'yoy',
    );
    // 2025 har bare 52 uker
    expect(cmp).toEqual({ start: '2025-12-22', end: '2025-12-28' });
  });
});

describe('forfallslogikk', () => {
  it('ukentlig forfaller kun på mandag', () => {
    expect(isDue('weekly', '2026-07-13')).toBe(true); // mandag
    expect(isDue('weekly', '2026-07-14')).toBe(false); // tirsdag
    expect(isDue('weekly', '2026-07-12')).toBe(false); // søndag
  });

  it('månedlig forfaller på 3. virkedag', () => {
    // juli 2026: 1. = onsdag → 3. virkedag = fredag 3.7.
    expect(nthBusinessDayOfMonth('2026-07-15', 3)).toBe('2026-07-03');
    expect(isDue('monthly', '2026-07-03')).toBe(true);
    expect(isDue('monthly', '2026-07-02')).toBe(false);
    expect(isDue('monthly', '2026-07-06')).toBe(false);
  });

  it('månedlig hopper over helg når måneden starter på lørdag', () => {
    // august 2026: 1. = lørdag → virkedager 3., 4., 5. → 3. virkedag = 5.8.
    expect(nthBusinessDayOfMonth('2026-08-20', 3)).toBe('2026-08-05');
    expect(isDue('monthly', '2026-08-05')).toBe(true);
    expect(isDue('monthly', '2026-08-03')).toBe(false);
  });
});

describe('reportPeriodFor', () => {
  it('månedlig på 3. virkedag gir forrige måned', () => {
    expect(reportPeriodFor('monthly', '2026-07-03')).toEqual({
      start: '2026-06-01',
      end: '2026-06-30',
    });
  });
});

describe('clampGscPeriod (GSC-etterslep)', () => {
  it('rører ikke perioder som er gamle nok', () => {
    const r = clampGscPeriod({ start: '2026-06-01', end: '2026-06-30' }, '2026-07-03');
    expect(r).toEqual({
      period: { start: '2026-06-01', end: '2026-06-30' },
      truncated: false,
      empty: false,
    });
  });

  it('kutter og flagger når period_end er innenfor etterslep-vinduet', () => {
    const r = clampGscPeriod({ start: '2026-06-01', end: '2026-06-30' }, '2026-07-01');
    expect(r).toEqual({
      period: { start: '2026-06-01', end: '2026-06-28' },
      truncated: true,
      empty: false,
    });
  });

  it('ukesrapport sendt mandag mister helgen', () => {
    const r = clampGscPeriod({ start: '2026-07-06', end: '2026-07-12' }, '2026-07-13');
    expect(r).toEqual({
      period: { start: '2026-07-06', end: '2026-07-10' },
      truncated: true,
      empty: false,
    });
  });

  it('gir empty når hele perioden er i etterslep-vinduet', () => {
    const r = clampGscPeriod({ start: '2026-07-14', end: '2026-07-15' }, '2026-07-15');
    expect(r.empty).toBe(true);
    expect(r.truncated).toBe(true);
  });
});

describe('todayInOslo', () => {
  it('bruker Oslo-kalenderdag, ikke UTC', () => {
    // 23:30 UTC 14. juli = 01:30 CEST 15. juli i Oslo (sommertid)
    expect(todayInOslo(new Date('2026-07-14T23:30:00Z'))).toBe('2026-07-15');
    // vintertid: 23:30 UTC 14. januar = 00:30 CET 15. januar
    expect(todayInOslo(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
    expect(todayInOslo(new Date('2026-01-14T22:30:00Z'))).toBe('2026-01-14');
  });
});

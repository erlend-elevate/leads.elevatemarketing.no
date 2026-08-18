import { describe, expect, it } from 'vitest';
import {
  dateRangeLabel,
  formatCompact,
  formatCurrency,
  formatDeltaPct,
  formatInt,
  formatPercent,
  formatPercentFromFraction,
  formatPosition,
  monthLabel,
  weekLabel,
} from '../src/lib/metrics/format';

const NBSP = ' ';

describe('nb-NO tallformatering (brief 7.5 / felle 13)', () => {
  it('tusenskille er hardt mellomrom, aldri komma', () => {
    expect(formatInt(12345)).toBe(`12${NBSP}345`);
    expect(formatInt(1234567)).toBe(`1${NBSP}234${NBSP}567`);
  });

  it('valuta: «12 345 kr» med 0 desimaler', () => {
    expect(formatCurrency(12345.6)).toBe(`12${NBSP}346${NBSP}kr`);
    expect(formatCurrency(0)).toBe(`0${NBSP}kr`);
  });

  it('prosent med 1 desimal og desimalkomma', () => {
    expect(formatPercentFromFraction(0.034)).toBe(`3,4${NBSP}%`);
    expect(formatPercent(72.39)).toBe(`72,4${NBSP}%`);
  });

  it('posisjon med 1 desimal', () => {
    expect(formatPosition(8.25)).toBe('8,3');
  });

  it('delta med fortegn og norsk minus', () => {
    expect(formatDeltaPct(12.44)).toBe(`+12,4${NBSP}%`);
    expect(formatDeltaPct(-8)).toBe(`−8,0${NBSP}%`);
  });

  it('kortform kun for store tall (grafer)', () => {
    expect(formatCompact(1234567)).toBe(`1,2${NBSP}mill.`);
    expect(formatCompact(12345)).toBe(`12,3${NBSP}k`);
    expect(formatCompact(999)).toBe('999');
  });
});

describe('periodeetiketter', () => {
  it('månedsetikett', () => {
    expect(monthLabel('2026-07-01')).toBe('juli 2026');
  });

  it('ukesetikett', () => {
    expect(weekLabel(28, 2026)).toBe('uke 28, 2026');
  });

  it('datointervall i samme måned', () => {
    expect(dateRangeLabel('2026-07-01', '2026-07-31')).toBe('1.–31. juli 2026');
  });

  it('datointervall over månedsskifte', () => {
    expect(dateRangeLabel('2026-07-28', '2026-08-03')).toBe('28. juli–3. august 2026');
  });

  it('datointervall over årsskifte', () => {
    expect(dateRangeLabel('2025-12-30', '2026-01-05')).toBe('30. desember 2025–5. januar 2026');
  });
});

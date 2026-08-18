import { describe, expect, it } from 'vitest';
import {
  computeDelta,
  deltaArrow,
  deltaSentiment,
} from '../src/lib/metrics/deltas';

describe('computeDelta (null-tilfeller, brief 7.2 / felle 8)', () => {
  it('forrige = 0 og nå > 0 → «ny», aldri Infinity', () => {
    expect(computeDelta(42, 0)).toEqual({ kind: 'new' });
  });

  it('begge 0 → «–»', () => {
    expect(computeDelta(0, 0)).toEqual({ kind: 'none' });
  });

  it('vanlig prosent med fortegn', () => {
    expect(computeDelta(110, 100)).toEqual({ kind: 'pct', value: 10 });
    expect(computeDelta(90, 100)).toEqual({ kind: 'pct', value: -10 });
  });

  it('nå = 0 fra noe → −100 %', () => {
    expect(computeDelta(0, 50)).toEqual({ kind: 'pct', value: -100 });
  });
});

describe('deltaSentiment (invertert semantikk, felle 7)', () => {
  it('opp er godt for vanlige metrikker', () => {
    expect(deltaSentiment('clicks', { kind: 'pct', value: 12 })).toBe('good');
    expect(deltaSentiment('clicks', { kind: 'pct', value: -12 })).toBe('bad');
  });

  it('NED er godt for cpa, cpc og position', () => {
    for (const metric of ['cpa', 'cpc', 'position']) {
      expect(deltaSentiment(metric, { kind: 'pct', value: -8 })).toBe('good');
      expect(deltaSentiment(metric, { kind: 'pct', value: 8 })).toBe('bad');
    }
  });

  it('«ny» er godt for vanlige, nøytralt for inverterte', () => {
    expect(deltaSentiment('conversions', { kind: 'new' })).toBe('good');
    expect(deltaSentiment('cpa', { kind: 'new' })).toBe('neutral');
  });

  it('«–» og 0 % er nøytralt', () => {
    expect(deltaSentiment('clicks', { kind: 'none' })).toBe('neutral');
    expect(deltaSentiment('cpa', { kind: 'pct', value: 0 })).toBe('neutral');
  });
});

describe('deltaArrow', () => {
  it('viser alltid faktisk retning (aldri invertert)', () => {
    expect(deltaArrow({ kind: 'pct', value: -8 })).toBe('down');
    expect(deltaArrow({ kind: 'pct', value: 8 })).toBe('up');
    expect(deltaArrow({ kind: 'new' })).toBe('flat');
    expect(deltaArrow({ kind: 'none' })).toBe('flat');
  });
});

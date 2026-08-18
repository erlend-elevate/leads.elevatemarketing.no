import { describe, expect, it } from 'vitest';
import {
  aggregateAds,
  aggregateGa4,
  aggregateGsc,
  weightedPosition,
} from '../src/lib/metrics/aggregate';

describe('weightedPosition (brief 7.1 / felle 5)', () => {
  it('vekter med visninger — ALDRI flatt snitt', () => {
    const rows = [
      { position: 4, impressions: 50 },
      { position: 8, impressions: 150 },
    ];
    // flatt snitt ville vært 6
    expect(weightedPosition(rows)).toBe(7);
  });

  it('dager uten visninger påvirker ikke', () => {
    expect(
      weightedPosition([
        { position: 2, impressions: 100 },
        { position: 99, impressions: 0 },
      ]),
    ).toBe(2);
  });

  it('null når det ikke finnes visninger', () => {
    expect(weightedPosition([])).toBeNull();
    expect(weightedPosition([{ position: 5, impressions: 0 }])).toBeNull();
  });
});

describe('aggregateAds', () => {
  const rows = [
    { date: '2026-06-01', spend: 100, impressions: 1000, clicks: 20, conversions: 2, conversionValue: 800 },
    { date: '2026-06-02', spend: 200, impressions: 3000, clicks: 40, conversions: 0, conversionValue: 0 },
  ];

  it('summer og avledede fra totaler', () => {
    const a = aggregateAds(rows);
    expect(a.spend).toBe(300);
    expect(a.ctr).toBeCloseTo(60 / 4000);
    expect(a.cpc).toBeCloseTo(5);
    expect(a.cpa).toBeCloseTo(150);
    expect(a.roas).toBeCloseTo(800 / 300);
  });

  it('null (ikke NaN/Infinity) ved 0 i nevner', () => {
    const a = aggregateAds([
      { date: '2026-06-01', spend: 0, impressions: 0, clicks: 0, conversions: 0 },
    ]);
    expect(a.ctr).toBeNull();
    expect(a.cpc).toBeNull();
    expect(a.cpa).toBeNull();
    expect(a.conversionValue).toBeNull();
    expect(a.roas).toBeNull();
  });
});

describe('aggregateGsc', () => {
  it('bruker visningsvektet posisjon', () => {
    const a = aggregateGsc([
      { date: '2026-06-01', clicks: 10, impressions: 50, position: 4 },
      { date: '2026-06-02', clicks: 30, impressions: 150, position: 8 },
    ]);
    expect(a.position).toBe(7);
    expect(a.clicks).toBe(40);
    expect(a.ctr).toBeCloseTo(40 / 200);
  });
});

describe('aggregateGa4', () => {
  it('vekter engasjementsrate med økter og beholder brøkskalaen', () => {
    const a = aggregateGa4([
      { date: '2026-06-01', sessions: 100, totalUsers: 80, newUsers: 40, conversions: 5, engagementRate: 0.5 },
      { date: '2026-06-02', sessions: 300, totalUsers: 240, newUsers: 100, conversions: 15, engagementRate: 0.7 },
    ]);
    expect(a.engagementRate).toBeCloseTo(0.65);
    expect(a.sessions).toBe(400);
    expect(a.totalRevenue).toBeNull();
  });

  it('null engasjementsrate uten økter', () => {
    const a = aggregateGa4([]);
    expect(a.engagementRate).toBeNull();
  });
});

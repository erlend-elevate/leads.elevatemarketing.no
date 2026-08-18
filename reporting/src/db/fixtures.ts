/**
 * Syntetiske snapshot-fixtures (brief del 16): deterministisk genererte
 * dagsrader og topp-lister for alle 4 kanaler, slik at rapport-UI og
 * PDF-generering kan utvikles og testes helt uten nettverk.
 *
 * Deterministisk PRNG (mulberry32) → samme fixtures hver gang.
 */

import type {
  AdsDailyRow,
  BreakdownRow,
  Ga4DailyRow,
  GscDailyRow,
} from '../lib/adapters/types';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function datesInRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let d = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86_400_000);
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function fixtureAdsDaily(
  startIso: string,
  endIso: string,
  seed = 1,
): AdsDailyRow[] {
  const rnd = mulberry32(seed);
  return datesInRange(startIso, endIso).map((date, i) => {
    const weekendDip = [5, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay() % 7) ? 0.7 : 1;
    const spend = round2((900 + 300 * Math.sin(i / 4) + 200 * rnd()) * weekendDip);
    const impressions = Math.round(spend * (28 + 6 * rnd()));
    const clicks = Math.round(impressions * (0.02 + 0.01 * rnd()));
    const conversions = round2(clicks * (0.04 + 0.03 * rnd()));
    return {
      date,
      spend,
      impressions,
      clicks,
      conversions,
      conversionValue: round2(conversions * (450 + 250 * rnd())),
      reach: Math.round(impressions * 0.6),
      frequency: round2(1.3 + 0.6 * rnd()),
    };
  });
}

export function fixtureGscDaily(
  startIso: string,
  endIso: string,
  seed = 2,
): GscDailyRow[] {
  const rnd = mulberry32(seed);
  return datesInRange(startIso, endIso).map((date, i) => {
    const impressions = Math.round(2500 + 700 * Math.sin(i / 5) + 500 * rnd());
    return {
      date,
      impressions,
      clicks: Math.round(impressions * (0.03 + 0.015 * rnd())),
      position: round2(8 + 4 * rnd()),
    };
  });
}

export function fixtureGa4Daily(
  startIso: string,
  endIso: string,
  seed = 3,
): Ga4DailyRow[] {
  const rnd = mulberry32(seed);
  return datesInRange(startIso, endIso).map((date, i) => {
    const sessions = Math.round(320 + 90 * Math.sin(i / 3) + 80 * rnd());
    return {
      date,
      sessions,
      totalUsers: Math.round(sessions * 0.8),
      newUsers: Math.round(sessions * 0.45),
      conversions: Math.round(sessions * (0.05 + 0.02 * rnd())),
      engagementRate: round2(0.55 + 0.15 * rnd()), // brøk 0–1, som Windsor leverer
      totalRevenue: round2(sessions * (14 + 10 * rnd())),
    };
  });
}

export function fixtureCampaignBreakdown(seed = 4): BreakdownRow[] {
  const rnd = mulberry32(seed);
  const names = [
    'P-MAX | Alle varer',
    'SEARCH | Brand',
    'SEARCH | Non-brand',
    'Shopping | Bestselgere',
    'Display | Remarketing',
    'Video | Awareness',
  ];
  return names.map((key) => {
    const spend = round2(2000 + 9000 * rnd());
    const impressions = Math.round(spend * 30);
    const clicks = Math.round(impressions * 0.025);
    const conversions = round2(clicks * 0.05);
    return {
      key,
      metrics: {
        spend,
        impressions,
        clicks,
        conversions,
        conversionValue: round2(conversions * 500),
      },
    };
  });
}

export function fixtureQueryBreakdown(seed = 5): BreakdownRow[] {
  const rnd = mulberry32(seed);
  const queries = [
    'hundeseng stor hund', 'slowfeeder hund', 'hundeleker valp',
    'kong leke hund', 'hundebur bil', 'fôrautomat katt',
    'kloklipper hund', 'hundejakke vinter', 'valpefôr test', 'kattetre stort',
    'hundesele anti trekk', 'aktivitetsleker hund',
  ];
  return queries.map((key) => {
    const impressions = Math.round(500 + 6000 * rnd());
    return {
      key,
      metrics: {
        impressions,
        clicks: Math.round(impressions * (0.02 + 0.06 * rnd())),
        position: round2(2 + 12 * rnd()),
      },
    };
  });
}

export function fixturePageBreakdown(seed = 6): BreakdownRow[] {
  const rnd = mulberry32(seed);
  const pages = [
    '/', '/hundesenger', '/slowfeeder', '/leker', '/salg',
    '/blogg/valp-forste-uke', '/hundebur', '/katteutstyr', '/om-oss',
    '/blogg/aktivisering', '/hundejakker', '/klor-og-pels',
  ];
  return pages.map((key) => {
    const impressions = Math.round(400 + 5000 * rnd());
    return {
      key,
      metrics: {
        impressions,
        clicks: Math.round(impressions * (0.03 + 0.05 * rnd())),
        position: round2(3 + 10 * rnd()),
      },
    };
  });
}

export function fixtureChannelGroupBreakdown(seed = 7): BreakdownRow[] {
  const rnd = mulberry32(seed);
  const groups = [
    'Organic Search', 'Paid Search', 'Direct', 'Paid Social',
    'Organic Social', 'Email', 'Referral',
  ];
  return groups.map((key) => {
    const sessions = Math.round(300 + 4000 * rnd());
    return {
      key,
      metrics: { sessions, conversions: Math.round(sessions * 0.05) },
    };
  });
}

export interface FixtureSnapshot {
  channel: 'meta_ads' | 'google_ads' | 'gsc' | 'ga4';
  kind: string;
  payload: unknown;
}

/** Komplett snapshot-sett for én periode (alle kanaler + breakdowns) */
export function buildFixtureSnapshotsFor(
  startIso: string,
  endIso: string,
  seedOffset = 0,
): FixtureSnapshot[] {
  return [
    { channel: 'meta_ads', kind: 'daily', payload: fixtureAdsDaily(startIso, endIso, 11 + seedOffset) },
    { channel: 'meta_ads', kind: 'breakdown:campaign', payload: fixtureCampaignBreakdown(12 + seedOffset) },
    { channel: 'google_ads', kind: 'daily', payload: fixtureAdsDaily(startIso, endIso, 21 + seedOffset) },
    { channel: 'google_ads', kind: 'breakdown:campaign', payload: fixtureCampaignBreakdown(22 + seedOffset) },
    { channel: 'gsc', kind: 'daily', payload: fixtureGscDaily(startIso, endIso, 31 + seedOffset) },
    { channel: 'gsc', kind: 'breakdown:query', payload: fixtureQueryBreakdown(32 + seedOffset) },
    { channel: 'gsc', kind: 'breakdown:page', payload: fixturePageBreakdown(33 + seedOffset) },
    { channel: 'ga4', kind: 'daily', payload: fixtureGa4Daily(startIso, endIso, 41 + seedOffset) },
    { channel: 'ga4', kind: 'breakdown:channel_group', payload: fixtureChannelGroupBreakdown(42 + seedOffset) },
  ];
}

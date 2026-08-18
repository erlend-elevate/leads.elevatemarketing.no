/**
 * Aggregering av DailyRow-er til periodetotaler (brief 7.1).
 * Avledede metrikker (ctr/cpc/cpa/roas) beregnes ALLTID fra periodens
 * totaler — aldri som snitt av dagsverdier.
 */

import type { AdsDailyRow, Ga4DailyRow, GscDailyRow } from '../adapters/types';

export interface AdsAggregate {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number | null;
  ctr: number | null; // brøk 0–1
  cpc: number | null;
  cpa: number | null;
  /** Kun ecommerce — null når conversionValue mangler eller spend = 0 */
  roas: number | null;
}

export function aggregateAds(rows: AdsDailyRow[]): AdsAggregate {
  const spend = sum(rows, (r) => r.spend);
  const impressions = sum(rows, (r) => r.impressions);
  const clicks = sum(rows, (r) => r.clicks);
  const conversions = sum(rows, (r) => r.conversions);
  const hasValue = rows.some((r) => r.conversionValue !== undefined);
  const conversionValue = hasValue
    ? sum(rows, (r) => r.conversionValue ?? 0)
    : null;
  return {
    spend,
    impressions,
    clicks,
    conversions,
    conversionValue,
    ctr: ratio(clicks, impressions),
    cpc: ratio(spend, clicks),
    cpa: ratio(spend, conversions),
    roas: conversionValue === null ? null : ratio(conversionValue, spend),
  };
}

export interface GscAggregate {
  clicks: number;
  impressions: number;
  ctr: number | null; // brøk 0–1
  /** Visningsvektet snittposisjon: Σ(pos_i × impr_i) / Σ(impr_i). ALDRI flatt snitt. */
  position: number | null;
}

export function aggregateGsc(rows: GscDailyRow[]): GscAggregate {
  const clicks = sum(rows, (r) => r.clicks);
  const impressions = sum(rows, (r) => r.impressions);
  return {
    clicks,
    impressions,
    ctr: ratio(clicks, impressions),
    position: weightedPosition(rows),
  };
}

/** Visningsvektet snittposisjon (brief 7.1 / felle nr. 5) */
export function weightedPosition(
  rows: { position: number; impressions: number }[],
): number | null {
  const totalImpressions = sum(rows, (r) => r.impressions);
  if (totalImpressions === 0) return null;
  const weighted = sum(rows, (r) => r.position * r.impressions);
  return weighted / totalImpressions;
}

export interface Ga4Aggregate {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  conversions: number;
  /** Øktvektet engasjementsrate, brøk 0–1 (normaliseres til % ved visning) */
  engagementRate: number | null;
  totalRevenue: number | null;
}

export function aggregateGa4(rows: Ga4DailyRow[]): Ga4Aggregate {
  const sessions = sum(rows, (r) => r.sessions);
  const hasRevenue = rows.some((r) => r.totalRevenue !== undefined);
  return {
    sessions,
    totalUsers: sum(rows, (r) => r.totalUsers),
    newUsers: sum(rows, (r) => r.newUsers),
    conversions: sum(rows, (r) => r.conversions),
    engagementRate:
      sessions === 0
        ? null
        : sum(rows, (r) => r.engagementRate * r.sessions) / sessions,
    totalRevenue: hasRevenue ? sum(rows, (r) => r.totalRevenue ?? 0) : null,
  };
}

function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

/** a/b, men null når b = 0 (aldri Infinity/NaN inn i visningslaget) */
function ratio(a: number, b: number): number | null {
  return b === 0 ? null : a / b;
}

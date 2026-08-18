/**
 * Adapter-kontrakten (P2 i briefen): alt datauttrekk går gjennom dette
 * interfacet. MVP har én implementasjon (WindsorAdapter). Resten av systemet
 * skal ikke vite noe om Windsor — dette er exit-veien for fremtidige
 * direkte-integrasjoner (MetaDirectAdapter, GoogleAdsDirectAdapter, …).
 */

export type Channel = 'meta_ads' | 'google_ads' | 'gsc' | 'ga4';

export interface FetchParams {
  channel: Channel;
  /** Windsor-connector-slug fra client_channels (f.eks. "google_ads") */
  windsorConnector: string;
  /** Konto-ID fra client_channels. Uttrekk er ALLTID avgrenset til én konto. */
  accountId: string;
  /** YYYY-MM-DD, allerede lag-justert (GSC-kutting skjer FØR kallet) */
  from: string;
  to: string;
}

/** Døgnoppløst rad for annonsekanaler (meta_ads, google_ads) */
export interface AdsDailyRow {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue?: number;
  /** Kun meta_ads */
  reach?: number;
  /** Kun meta_ads */
  frequency?: number;
}

/** Døgnoppløst rad for Google Search Console */
export interface GscDailyRow {
  date: string;
  clicks: number;
  impressions: number;
  /** Snittposisjon for dagen (vektes med visninger ved aggregering, se metrics/aggregate) */
  position: number;
}

/** Døgnoppløst rad for Google Analytics 4 */
export interface Ga4DailyRow {
  date: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  /** GA4 "key events" */
  conversions: number;
  /** Brøk 0–1 slik Windsor leverer den — normaliseres til prosent ved visning */
  engagementRate: number;
  totalRevenue?: number;
}

export type DailyRow = AdsDailyRow | GscDailyRow | Ga4DailyRow;

/** Dimensjonsoppløst rad (topp-lister): kampanje, søkeord, side, kanalgruppe … */
export interface BreakdownRow {
  /** Dimensjonsverdien (kampanjenavn, søkeord, side, kanalgruppe) */
  key: string;
  /** Metrikker for raden, navngitt som i DailyRow-typene (spend, clicks, sessions, …) */
  metrics: Record<string, number>;
}

/** Gyldige breakdown-dimensjoner per kanal */
export const BREAKDOWN_DIMENSIONS = {
  meta_ads: ['campaign'],
  google_ads: ['campaign'],
  gsc: ['query', 'page'],
  ga4: ['channel_group'],
} as const satisfies Record<Channel, readonly string[]>;

export type BreakdownDimension =
  (typeof BREAKDOWN_DIMENSIONS)[Channel][number];

export interface ChannelAdapter {
  /** Døgnoppløste rader for perioden, normalisert til kanalens DailyRow-type */
  fetchDaily(p: FetchParams): Promise<DailyRow[]>;
  /** Dimensjonsoppløste rader (topp-lister), sortert synkende på kanalens primærmetrikk */
  fetchBreakdown(
    p: FetchParams & { dimension: BreakdownDimension; limit: number },
  ): Promise<BreakdownRow[]>;
}

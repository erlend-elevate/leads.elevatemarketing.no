/**
 * Kjente kunder og Windsor-konto-ID-er per 15.07.2026 (brief del 1, verifisert
 * mot Windsor-kontoen samme dag). Ren data — brukes av db/seed.ts og av
 * scripts/reconcile.ts (som fallback når DATABASE_URL ikke er satt).
 *
 * KUN pilotkunden (Pawesomeday) er aktiv. Øvrige kunder ligger inne med
 * kjente kontoer, men active: false — Erlend aktiverer og kompletterer
 * (business_type, goals_note, mottakere) i admin når de skal på.
 *
 * Meta Ads mangler for alle: kobles i Windsor i Fase 0
 * (https://onboard.windsor.ai?datasource=facebook).
 */

import type { Channel } from '../lib/adapters/types';

export interface SeedChannel {
  channel: Channel;
  windsorConnector: string;
  accountId: string;
}

export interface SeedClient {
  name: string;
  slug: string;
  businessType: 'ecommerce' | 'leadgen';
  active: boolean;
  goalsNote?: string;
  channels: SeedChannel[];
}

export const PILOT_SLUG = 'pawesomeday';

export const SEED_CLIENTS: SeedClient[] = [
  {
    name: 'Pawesomeday',
    slug: PILOT_SLUG,
    businessType: 'ecommerce', // bekreftet: conversions_value i NOK i Google Ads
    active: true,
    goalsNote:
      'FYLLES INN AV ERLEND: kundens hovedmål (f.eks. lønnsom vekst i nettbutikken, ROAS-mål).',
    channels: [
      { channel: 'google_ads', windsorConnector: 'google_ads', accountId: '658-166-3129' },
      { channel: 'ga4', windsorConnector: 'googleanalytics4', accountId: '334051631' },
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'sc-domain:pawesomeday.no' },
      // meta_ads legges til når Meta er koblet i Windsor og feltmanifestet er verifisert
    ],
  },
  {
    name: 'CMedical',
    slug: 'cmedical',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'google_ads', windsorConnector: 'google_ads', accountId: '692-047-3801' },
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'sc-domain:cmedical.no' },
      // GA4 mangler i Windsor — ettermonteres (brief del 19, pkt. 3)
    ],
  },
  {
    name: 'Strikkia.no',
    slug: 'strikkia',
    businessType: 'ecommerce',
    active: false,
    channels: [
      { channel: 'google_ads', windsorConnector: 'google_ads', accountId: '627-352-3360' },
    ],
  },
  {
    name: 'Iben Official',
    slug: 'iben-official',
    businessType: 'ecommerce',
    active: false,
    channels: [
      { channel: 'google_ads', windsorConnector: 'google_ads', accountId: '838-618-0000' },
    ],
  },
  {
    name: 'Småungene AS',
    slug: 'smaungene',
    businessType: 'ecommerce',
    active: false,
    channels: [
      { channel: 'google_ads', windsorConnector: 'google_ads', accountId: '545-309-5758' },
    ],
  },
  {
    name: 'Maya.no',
    slug: 'maya',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'ga4', windsorConnector: 'googleanalytics4', accountId: '399778207' },
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'https://www.maya.no/' },
    ],
  },
  {
    name: 'De Bergenske',
    slug: 'de-bergenske',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'ga4', windsorConnector: 'googleanalytics4', accountId: '524123453' },
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'https://www.debergenske.no/' },
    ],
  },
  {
    name: 'Gastroplanner (De Bergenske)',
    slug: 'gastroplanner',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'ga4', windsorConnector: 'googleanalytics4', accountId: '526047641' },
    ],
  },
  {
    name: 'Nermo Hotell',
    slug: 'nermohotell',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'ga4', windsorConnector: 'googleanalytics4', accountId: '295145471' },
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'https://www.nermohotell.no/' },
    ],
  },
  {
    name: 'Skabu Fjellhotell',
    slug: 'skabufjellhotell',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'https://www.skabufjellhotell.no/' },
    ],
  },
  {
    name: 'RSM Norge',
    slug: 'rsm-norge',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'https://www.rsm.global/norway/nb/' },
    ],
  },
  {
    name: 'Campbell & Co',
    slug: 'campbellco',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'sc-domain:campbellco.no' },
    ],
  },
  {
    name: 'Judicia',
    slug: 'judicia',
    businessType: 'leadgen',
    active: false,
    channels: [
      { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'https://judicia.no/' },
    ],
  },
];

/** Syntetisk fixture-klient: rapport-UI og PDF utvikles 100 % uten nettverk */
export const FIXTURE_CLIENT: SeedClient = {
  name: 'Fixture Demo AS',
  slug: 'fixture-demo',
  businessType: 'ecommerce',
  active: false, // skal aldri plukkes opp av cron eller sendes til noen
  goalsNote: 'Syntetisk testkunde: øke netthandel lønnsomt, ROAS over 4.',
  channels: [
    { channel: 'meta_ads', windsorConnector: 'facebook', accountId: 'fixture-meta' },
    { channel: 'google_ads', windsorConnector: 'google_ads', accountId: 'fixture-gads' },
    { channel: 'gsc', windsorConnector: 'searchconsole', accountId: 'sc-domain:fixture.example' },
    { channel: 'ga4', windsorConnector: 'googleanalytics4', accountId: 'fixture-ga4' },
  ],
};

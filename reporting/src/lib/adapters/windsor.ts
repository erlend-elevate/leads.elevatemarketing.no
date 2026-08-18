/**
 * WindsorAdapter — eneste implementasjon av ChannelAdapter i MVP.
 *
 * API-kontrakt: se docs/windsor-contract.md. Nøkkelpunkter:
 *  - Auth: query-param `api_key` (ingen header-auth)
 *  - Svarform: `{"data": [...]}` iflg. docs, `{"result": [...]}` observert via
 *    MCP-laget — vi godtar begge og logger hvilken vi fikk (VERIFISER I FASE 0
 *    med ekte REST-kall når WINDSOR_API_KEY foreligger).
 *  - Kontofiltrering: `select_accounts` (docs) — VERIFISERES i integrasjonstest.
 *    Uttrekk skal ALLTID være avgrenset til én konto.
 *  - Tall kan komme som strenger — alle numeriske felter coerces defensivt.
 *  - 429/5xx: 3 forsøk med eksponentiell backoff + jitter.
 */

import { z } from 'zod';
import type {
  AdsDailyRow,
  BreakdownDimension,
  BreakdownRow,
  Channel,
  ChannelAdapter,
  DailyRow,
  FetchParams,
  Ga4DailyRow,
  GscDailyRow,
} from './types';
import { FIELD_MANIFESTS } from './field-manifest';

const BASE_URL = 'https://connectors.windsor.ai';

/**
 * Parameternavn for kontofiltrering i REST-API-et.
 * `select_accounts` er navnet i Windsor-docs; MCP-laget bruker `accounts`.
 * Status: IKKE REST-verifisert ennå (krever WINDSOR_API_KEY) — integrasjons-
 * testen i tests/integration/windsor.test.ts verifiserer og docs/windsor-contract.md
 * oppdateres når den har kjørt.
 */
export const ACCOUNT_PARAM = 'select_accounts';

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;

/** Svar kan være {data: [...]} (docs) eller {result: [...]} (observert via MCP) */
const rawRow = z.record(z.string(), z.unknown());
const responseSchema = z
  .union([
    z.object({ data: z.array(rawRow) }),
    z.object({ result: z.array(rawRow) }),
  ])
  .transform((r) => ('data' in r ? r.data : r.result));

/** Defensiv tallparsing: Windsor kan returnere strenger for numeriske felter */
const num = z.coerce.number();
const optNum = z.coerce.number().optional();

const adsDailySchema = z.object({
  date: z.string(),
  spend: num,
  impressions: num,
  clicks: num,
  conversions: num.catch(0),
  conversions_value: optNum,
  reach: optNum,
  frequency: optNum,
});

const gscDailySchema = z.object({
  date: z.string(),
  clicks: num,
  impressions: num,
  position: num,
});

const ga4DailySchema = z.object({
  date: z.string(),
  sessions: num,
  totalusers: num,
  newusers: num,
  conversions: num,
  engagement_rate: num,
  totalrevenue: optNum,
});

export interface WindsorAdapterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** For test: hopp over reelle ventetider */
  sleep?: (ms: number) => Promise<void>;
  logger?: (msg: string, ctx?: Record<string, unknown>) => void;
}

export class WindsorError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'WindsorError';
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class WindsorAdapter implements ChannelAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: (msg: string, ctx?: Record<string, unknown>) => void;

  constructor(opts: WindsorAdapterOptions) {
    if (!opts.apiKey) throw new Error('WINDSOR_API_KEY mangler');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? defaultSleep;
    this.log =
      opts.logger ??
      ((msg, ctx) =>
        console.log(JSON.stringify({ src: 'windsor', msg, ...ctx })));
  }

  async fetchDaily(p: FetchParams): Promise<DailyRow[]> {
    const manifest = this.manifestFor(p);
    const rows = await this.request(manifest.connector, {
      fields: manifest.dailyFields,
      accountId: p.accountId,
      from: p.from,
      to: p.to,
    });
    switch (p.channel) {
      case 'google_ads':
      case 'meta_ads':
        return mergeAdsByDate(rows.map((r) => normalizeAdsRow(r)));
      case 'gsc':
        return mergeGscByDate(rows.map((r) => gscDailySchema.parse(r)));
      case 'ga4':
        return mergeGa4ByDate(rows.map((r) => normalizeGa4Row(r)));
    }
  }

  async fetchBreakdown(
    p: FetchParams & { dimension: BreakdownDimension; limit: number },
  ): Promise<BreakdownRow[]> {
    const manifest = this.manifestFor(p);
    const breakdown = manifest.breakdowns[p.dimension];
    if (!breakdown) {
      throw new Error(
        `Ugyldig breakdown-dimensjon "${p.dimension}" for kanal ${p.channel}`,
      );
    }
    const rows = await this.request(manifest.connector, {
      fields: [breakdown.dimensionField, ...breakdown.metricFields],
      accountId: p.accountId,
      from: p.from,
      to: p.to,
      // Grovt tak mot enorme svar (GSC kan ha titusener av søkeord).
      // Endelig topp-N sorteres og kuttes i kode under.
      maxRows: 10_000,
    });

    const merged = new Map<string, Record<string, number>>();
    for (const raw of rows) {
      const key = String(raw[breakdown.dimensionField] ?? '(ukjent)');
      const metrics: Record<string, number> = {};
      for (const f of breakdown.metricFields) {
        metrics[normalizeMetricName(f)] = num.catch(0).parse(raw[f] ?? 0);
      }
      const existing = merged.get(key);
      merged.set(key, existing ? sumMetrics(existing, metrics) : metrics);
    }

    const primary = primaryMetric(p.channel);
    return [...merged.entries()]
      .map(([key, metrics]) => ({ key, metrics }))
      .sort((a, b) => (b.metrics[primary] ?? 0) - (a.metrics[primary] ?? 0))
      .slice(0, p.limit);
  }

  private manifestFor(p: FetchParams) {
    const manifest = FIELD_MANIFESTS[p.channel];
    if (!manifest.verified) {
      throw new WindsorError(
        `Feltmanifestet for ${p.channel} (${manifest.connector}) er ikke verifisert — datauttrekk nektes (se docs/windsor-contract.md)`,
      );
    }
    if (manifest.connector !== p.windsorConnector) {
      throw new WindsorError(
        `client_channels har connector "${p.windsorConnector}" for kanal ${p.channel}, forventet "${manifest.connector}"`,
      );
    }
    return manifest;
  }

  /** Henter feltkatalogen — brukes av manifest-valideringen ved oppstart/CI */
  async fetchFieldCatalog(connector: string): Promise<{ id: string }[]> {
    const url = new URL(`${BASE_URL}/${connector}/fields`);
    url.searchParams.set('api_key', this.apiKey);
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) {
      throw new WindsorError(
        `Feltkatalog for ${connector} feilet: HTTP ${res.status}`,
        res.status,
      );
    }
    const body: unknown = await res.json();
    // Godta både naken array og {data|result: [...]}-innpakking
    const arr = Array.isArray(body)
      ? body
      : responseSchema.parse(body);
    return z.array(z.object({ id: z.string() }).loose()).parse(arr);
  }

  private async request(
    connector: string,
    q: {
      fields: string[];
      accountId: string;
      from: string;
      to: string;
      maxRows?: number;
    },
  ): Promise<Record<string, unknown>[]> {
    const url = new URL(`${BASE_URL}/${connector}`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('fields', q.fields.join(','));
    url.searchParams.set('date_from', q.from);
    url.searchParams.set('date_to', q.to);
    url.searchParams.set(ACCOUNT_PARAM, q.accountId);
    if (q.maxRows) url.searchParams.set('_max_rows', String(q.maxRows));

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await this.fetchImpl(url.toString());
        this.logRateLimit(connector, res);

        if (res.status === 429 || res.status >= 500) {
          lastError = new WindsorError(
            `Windsor ${connector}: HTTP ${res.status}`,
            res.status,
          );
        } else if (!res.ok) {
          // 4xx utenom 429 er permanente — ikke retry
          const text = await res.text().catch(() => '');
          throw new WindsorError(
            `Windsor ${connector}: HTTP ${res.status} ${text.slice(0, 300)}`,
            res.status,
          );
        } else {
          const body: unknown = await res.json();
          return responseSchema.parse(body);
        }
      } catch (err) {
        if (err instanceof WindsorError && err.status && err.status < 500 && err.status !== 429) {
          throw err;
        }
        lastError = err;
      }
      if (attempt < MAX_ATTEMPTS) {
        const backoff =
          BASE_BACKOFF_MS * 2 ** (attempt - 1) * (1 + Math.random() * 0.25);
        this.log('retry', { connector, attempt, backoffMs: Math.round(backoff) });
        await this.sleep(backoff);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new WindsorError(`Windsor ${connector}: ukjent feil etter ${MAX_ATTEMPTS} forsøk`);
  }

  private logRateLimit(connector: string, res: Response) {
    // Windsor: 600 req/min, 10 000 req/dag. Logg når <10 % gjenstår.
    for (const [limitHeader, remainingHeader] of [
      ['x-ratelimit-limit', 'x-ratelimit-remaining'],
      ['x-ratelimit-limit-day', 'x-ratelimit-remaining-day'],
    ]) {
      const limit = Number(res.headers.get(limitHeader));
      const remaining = Number(res.headers.get(remainingHeader));
      if (limit > 0 && remaining >= 0 && remaining / limit < 0.1) {
        this.log('rate-limit-low', { connector, limitHeader, limit, remaining });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Normalisering                                                       */
/* ------------------------------------------------------------------ */

function normalizeAdsRow(raw: Record<string, unknown>): AdsDailyRow {
  const r = adsDailySchema.parse(raw);
  return {
    date: r.date,
    spend: r.spend,
    impressions: r.impressions,
    clicks: r.clicks,
    conversions: r.conversions,
    conversionValue: r.conversions_value,
    reach: r.reach,
    frequency: r.frequency,
  };
}

function normalizeGa4Row(raw: Record<string, unknown>): Ga4DailyRow {
  const r = ga4DailySchema.parse(raw);
  return {
    date: r.date,
    sessions: r.sessions,
    totalUsers: r.totalusers,
    newUsers: r.newusers,
    conversions: r.conversions,
    engagementRate: r.engagement_rate,
    totalRevenue: r.totalrevenue,
  };
}

/** Windsor grupperer på valgte dimensjoner, men vi slår sammen defensivt
 *  i tilfelle flere rader per dato. */
function mergeAdsByDate(rows: AdsDailyRow[]): AdsDailyRow[] {
  const byDate = new Map<string, AdsDailyRow>();
  for (const row of rows) {
    const prev = byDate.get(row.date);
    if (!prev) {
      byDate.set(row.date, { ...row });
      continue;
    }
    prev.spend += row.spend;
    prev.impressions += row.impressions;
    prev.clicks += row.clicks;
    prev.conversions += row.conversions;
    if (row.conversionValue !== undefined) {
      prev.conversionValue = (prev.conversionValue ?? 0) + row.conversionValue;
    }
    // reach/frequency kan ikke summeres meningsfullt — behold første verdi
  }
  return sortByDate([...byDate.values()]);
}

function mergeGscByDate(rows: GscDailyRow[]): GscDailyRow[] {
  const byDate = new Map<string, GscDailyRow>();
  for (const row of rows) {
    const prev = byDate.get(row.date);
    if (!prev) {
      byDate.set(row.date, { ...row });
      continue;
    }
    // Posisjon vektes med visninger også ved merging (brief 7.1)
    const totalImpr = prev.impressions + row.impressions;
    prev.position =
      totalImpr > 0
        ? (prev.position * prev.impressions + row.position * row.impressions) /
          totalImpr
        : prev.position;
    prev.clicks += row.clicks;
    prev.impressions = totalImpr;
  }
  return sortByDate([...byDate.values()]);
}

function mergeGa4ByDate(rows: Ga4DailyRow[]): Ga4DailyRow[] {
  const byDate = new Map<string, Ga4DailyRow>();
  for (const row of rows) {
    const prev = byDate.get(row.date);
    if (!prev) {
      byDate.set(row.date, { ...row });
      continue;
    }
    // Engasjementsrate vektes med økter
    const totalSessions = prev.sessions + row.sessions;
    prev.engagementRate =
      totalSessions > 0
        ? (prev.engagementRate * prev.sessions +
            row.engagementRate * row.sessions) /
          totalSessions
        : prev.engagementRate;
    prev.sessions = totalSessions;
    prev.totalUsers += row.totalUsers;
    prev.newUsers += row.newUsers;
    prev.conversions += row.conversions;
    if (row.totalRevenue !== undefined) {
      prev.totalRevenue = (prev.totalRevenue ?? 0) + row.totalRevenue;
    }
  }
  return sortByDate([...byDate.values()]);
}

function sortByDate<T extends { date: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function sumMetrics(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Windsor-feltnavn → normalisert metrikknavn i BreakdownRow */
function normalizeMetricName(field: string): string {
  const map: Record<string, string> = {
    conversions_value: 'conversionValue',
    totalusers: 'totalUsers',
    newusers: 'newUsers',
    engagement_rate: 'engagementRate',
    totalrevenue: 'totalRevenue',
  };
  return map[field] ?? field;
}

/** Metrikken topp-lister sorteres etter, per kanal (brief 7.1) */
function primaryMetric(channel: Channel): string {
  switch (channel) {
    case 'meta_ads':
    case 'google_ads':
      return 'spend'; // topp 5 kampanjer etter forbruk
    case 'gsc':
      return 'clicks'; // topp 10 søkeord/sider etter klikk
    case 'ga4':
      return 'sessions';
  }
}

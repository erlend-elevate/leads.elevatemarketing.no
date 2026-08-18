import { describe, expect, it } from 'vitest';
import { ACCOUNT_PARAM, WindsorAdapter } from '../src/lib/adapters/windsor';

type FetchCall = { url: URL };

/** Fake fetch som returnerer en kø av svar og logger kallene */
function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: FetchCall[] = [];
  let i = 0;
  const impl = (async (input: string | URL | Request) => {
    calls.push({ url: new URL(String(input)) });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { impl, calls };
}

const noSleep = async () => {};
const silent = () => {};

function adapter(fetchImpl: typeof fetch) {
  return new WindsorAdapter({
    apiKey: 'test-key',
    fetchImpl,
    sleep: noSleep,
    logger: silent,
  });
}

const gadsParams = {
  channel: 'google_ads' as const,
  windsorConnector: 'google_ads',
  accountId: '658-166-3129',
  from: '2026-06-01',
  to: '2026-06-30',
};

describe('WindsorAdapter — svarform (felle 2)', () => {
  const row = {
    date: '2026-06-01',
    clicks: 10,
    impressions: 100,
    spend: 50,
    conversions: 1,
    conversions_value: 400,
  };

  it('godtar {"data": [...]} (docs)', async () => {
    const { impl } = fakeFetch([{ status: 200, body: { data: [row] } }]);
    const rows = await adapter(impl).fetchDaily(gadsParams);
    expect(rows).toHaveLength(1);
  });

  it('godtar {"result": [...]} (observert via MCP)', async () => {
    const { impl } = fakeFetch([{ status: 200, body: { result: [row] } }]);
    const rows = await adapter(impl).fetchDaily(gadsParams);
    expect(rows).toHaveLength(1);
  });
});

describe('WindsorAdapter — normalisering', () => {
  it('parser tall levert som strenger defensivt', async () => {
    const { impl } = fakeFetch([
      {
        status: 200,
        body: {
          data: [
            {
              date: '2026-06-01',
              clicks: '10',
              impressions: '100',
              spend: '50.5',
              conversions: '1.5',
              conversions_value: '400.25',
            },
          ],
        },
      },
    ]);
    const rows = await adapter(impl).fetchDaily(gadsParams);
    expect(rows[0]).toMatchObject({
      spend: 50.5,
      clicks: 10,
      conversions: 1.5,
      conversionValue: 400.25,
    });
  });

  it('slår sammen flere rader per dato (sum)', async () => {
    const mk = (spend: number) => ({
      date: '2026-06-01',
      clicks: 1,
      impressions: 10,
      spend,
      conversions: 0,
    });
    const { impl } = fakeFetch([
      { status: 200, body: { data: [mk(10), mk(20)] } },
    ]);
    const rows = await adapter(impl).fetchDaily(gadsParams);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { spend: number }).spend).toBe(30);
  });
});

describe('WindsorAdapter — URL-bygging', () => {
  it('avgrenser ALLTID til én konto og auth via api_key (felle 12)', async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: { data: [] } }]);
    await adapter(impl).fetchDaily(gadsParams);
    const url = calls[0].url;
    expect(url.searchParams.get(ACCOUNT_PARAM)).toBe('658-166-3129');
    expect(url.searchParams.get('api_key')).toBe('test-key');
    expect(url.searchParams.get('date_from')).toBe('2026-06-01');
    expect(url.searchParams.get('date_to')).toBe('2026-06-30');
    expect(url.pathname).toBe('/google_ads');
  });
});

describe('WindsorAdapter — retry', () => {
  it('prøver på nytt ved 429 og lykkes', async () => {
    const { impl, calls } = fakeFetch([
      { status: 429, body: {} },
      { status: 200, body: { data: [] } },
    ]);
    const rows = await adapter(impl).fetchDaily(gadsParams);
    expect(rows).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('gir opp etter 3 forsøk på 5xx', async () => {
    const { impl, calls } = fakeFetch([{ status: 500, body: {} }]);
    await expect(adapter(impl).fetchDaily(gadsParams)).rejects.toThrow('500');
    expect(calls).toHaveLength(3);
  });

  it('retryer IKKE permanente 4xx-feil', async () => {
    const { impl, calls } = fakeFetch([
      { status: 401, body: { error: 'authentication_error' } },
    ]);
    await expect(adapter(impl).fetchDaily(gadsParams)).rejects.toThrow('401');
    expect(calls).toHaveLength(1);
  });
});

describe('WindsorAdapter — breakdown', () => {
  it('sorterer på primærmetrikk og kutter til limit', async () => {
    const mk = (campaign: string, spend: number) => ({
      campaign,
      clicks: 1,
      impressions: 10,
      spend,
      conversions: 0,
      conversions_value: 0,
    });
    const { impl } = fakeFetch([
      { status: 200, body: { data: [mk('lav', 10), mk('høy', 100), mk('midt', 50)] } },
    ]);
    const rows = await adapter(impl).fetchBreakdown({
      ...gadsParams,
      dimension: 'campaign',
      limit: 2,
    });
    expect(rows.map((r) => r.key)).toEqual(['høy', 'midt']);
  });

  it('avviser ugyldig dimensjon for kanalen', async () => {
    const { impl } = fakeFetch([{ status: 200, body: { data: [] } }]);
    await expect(
      adapter(impl).fetchBreakdown({ ...gadsParams, dimension: 'query', limit: 5 }),
    ).rejects.toThrow('Ugyldig breakdown-dimensjon');
  });
});

describe('WindsorAdapter — uverifisert manifest (felle 1)', () => {
  it('nekter å hente meta_ads før feltmanifestet er verifisert', async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: { data: [] } }]);
    await expect(
      adapter(impl).fetchDaily({
        channel: 'meta_ads',
        windsorConnector: 'facebook',
        accountId: 'act_123',
        from: '2026-06-01',
        to: '2026-06-30',
      }),
    ).rejects.toThrow('ikke verifisert');
    expect(calls).toHaveLength(0);
  });
});

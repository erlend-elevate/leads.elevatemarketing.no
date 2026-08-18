/**
 * Integrasjonstest mot Windsor REST-API (brief del 16).
 * Kjøres KUN når WINDSOR_API_KEY er satt — skippes ellers.
 *
 * Verifiserer de gjenstående Fase 0-punktene fra docs/windsor-contract.md:
 *  1. Svar-nøkkel i REST (`data` vs `result`)
 *  2. At kontofiltrering (ACCOUNT_PARAM) faktisk avgrenser uttrekket
 *  3. Feltmanifestene mot /fields-endepunktet
 *
 * NB: Oppdater docs/windsor-contract.md når denne har kjørt grønt første gang.
 */

import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { WindsorAdapter } from '../../src/lib/adapters/windsor';
import { FIELD_MANIFESTS, validateManifest } from '../../src/lib/adapters/field-manifest';
import { PILOT_SLUG, SEED_CLIENTS } from '../../src/db/seed-data';

const apiKey = process.env.WINDSOR_API_KEY;
const d = apiKey ? describe : describe.skip;

d('Windsor REST (live, pilotkunde)', () => {
  // Lazy slik at fila kan importeres (og skippes) uten nøkkel
  let _adapter: WindsorAdapter | undefined;
  const adapter = () =>
    (_adapter ??= new WindsorAdapter({ apiKey: apiKey! }));
  const pilot = SEED_CLIENTS.find((c) => c.slug === PILOT_SLUG)!;

  it('feltmanifestene er gyldige mot /fields', async () => {
    for (const channel of ['google_ads', 'ga4', 'gsc'] as const) {
      await validateManifest(FIELD_MANIFESTS[channel], (c) =>
        adapter().fetchFieldCatalog(c),
      );
    }
  }, 60_000);

  for (const ch of pilot.channels) {
    it(`1-dags uttrekk for ${ch.channel} validerer mot skjema`, async () => {
      const rows = await adapter().fetchDaily({
        ...ch,
        // 10 dager tilbake: godt utenfor GSC-etterslepet
        from: daysAgo(10),
        to: daysAgo(10),
      });
      expect(Array.isArray(rows)).toBe(true);
      for (const row of rows) {
        expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }, 60_000);
  }

  it('kontofiltrering avgrenser uttrekket (felle 12)', async () => {
    // GSC: to kontoer finnes — samme spørring mot to ulike kontoer skal gi
    // ulike svar, og et kall uten treff (ugyldig konto) skal ikke lekke data.
    const base = {
      channel: 'gsc' as const,
      windsorConnector: 'searchconsole',
      from: daysAgo(10),
      to: daysAgo(10),
    };
    const pilotRows = await adapter().fetchDaily({
      ...base,
      accountId: 'sc-domain:pawesomeday.no',
    });
    const otherRows = await adapter().fetchDaily({
      ...base,
      accountId: 'sc-domain:cmedical.no',
    });
    // Identiske totaler for to ulike nettsteder ville tydet på at
    // filter-parameteren ignoreres stille.
    const sum = (rows: unknown[]) =>
      rows.reduce(
        (a: number, r) => a + ((r as { clicks?: number }).clicks ?? 0),
        0,
      );
    expect(sum(pilotRows)).not.toBe(sum(otherRows));
  }, 60_000);
});

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Avstemmingsscript (brief del 16 / Fase 0-akseptanse).
 *
 * Henter kanaltotaler for en klient og periode via WindsorAdapter og printer
 * dem som terminal-tabell, slik at Erlend kan sammenligne mot plattform-UI
 * (akseptkrav: ±5 %).
 *
 * Bruk:
 *   pnpm reconcile                            # pilot, forrige måned
 *   pnpm reconcile --client cmedical          # annen klient
 *   pnpm reconcile --month 2026-06            # bestemt måned
 *   pnpm reconcile --from 2026-06-01 --to 2026-06-30
 *
 * Krever WINDSOR_API_KEY. Kanaloppsett leses fra databasen hvis DATABASE_URL
 * er satt, ellers fra src/db/seed-data.ts (samme innhold før første seed).
 */

import 'dotenv/config';
import { WindsorAdapter } from '../src/lib/adapters/windsor';
import type { Channel } from '../src/lib/adapters/types';
import {
  aggregateAds,
  aggregateGa4,
  aggregateGsc,
} from '../src/lib/metrics/aggregate';
import {
  clampGscPeriod,
  previousMonth,
  todayInOslo,
  type Period,
} from '../src/lib/metrics/periods';
import {
  formatCurrency,
  formatDecimal,
  formatInt,
  formatPercentFromFraction,
  formatPosition,
} from '../src/lib/metrics/format';
import { PILOT_SLUG, SEED_CLIENTS, FIXTURE_CLIENT } from '../src/db/seed-data';

interface ChannelSetup {
  channel: Channel;
  windsorConnector: string;
  accountId: string;
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  }
  return out;
}

async function resolveChannels(slug: string): Promise<{ name: string; channels: ChannelSetup[] }> {
  if (process.env.DATABASE_URL) {
    const { getDb } = await import('../src/db/client');
    const { clients } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const db = getDb();
    const client = await db.query.clients.findFirst({ where: eq(clients.slug, slug) });
    if (client) {
      const rows = await db.query.clientChannels.findMany();
      const channels = rows
        .filter((r) => r.clientId === client.id && r.active)
        .map((r) => ({
          channel: r.channel,
          windsorConnector: r.windsorConnector,
          accountId: r.accountId,
        }));
      return { name: client.name, channels };
    }
    console.log(`(fant ikke "${slug}" i databasen — bruker seed-data)`);
  }
  const seed = [...SEED_CLIENTS, FIXTURE_CLIENT].find((c) => c.slug === slug);
  if (!seed) throw new Error(`Ukjent klient-slug: ${slug}`);
  return { name: seed.name, channels: seed.channels };
}

function monthPeriod(yyyyMm: string): Period {
  const [y, m] = yyyyMm.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(days).padStart(2, '0')}` };
}

function printTable(title: string, rows: [string, string][]) {
  const width = Math.max(...rows.map(([k]) => k.length)) + 2;
  console.log(`\n  ${title}`);
  console.log('  ' + '─'.repeat(46));
  for (const [k, v] of rows) {
    console.log(`  ${k.padEnd(width)}${v}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    console.error('WINDSOR_API_KEY mangler — sett den i .env');
    process.exit(1);
  }

  const slug = args.client ?? PILOT_SLUG;
  const today = todayInOslo();
  let period: Period;
  if (args.from && args.to) period = { start: args.from, end: args.to };
  else if (args.month) period = monthPeriod(args.month);
  else period = previousMonth(today);

  const { name, channels } = await resolveChannels(slug);
  console.log(`\nAvstemming: ${name} (${slug})`);
  console.log(`Periode: ${period.start} – ${period.end}`);
  console.log('Sammenlign mot plattform-UI. Akseptkrav: ±5 %.');

  const adapter = new WindsorAdapter({ apiKey });

  for (const ch of channels) {
    try {
      switch (ch.channel) {
        case 'google_ads':
        case 'meta_ads': {
          const rows = await adapter.fetchDaily({ ...ch, from: period.start, to: period.end });
          const a = aggregateAds(rows as Parameters<typeof aggregateAds>[0]);
          printTable(
            ch.channel === 'google_ads' ? 'Google Ads' : 'Meta Ads',
            [
              ['Forbruk', formatCurrency(a.spend)],
              ['Visninger', formatInt(a.impressions)],
              ['Klikk', formatInt(a.clicks)],
              ['CTR', a.ctr === null ? '–' : formatPercentFromFraction(a.ctr)],
              ['CPC', a.cpc === null ? '–' : formatCurrency(a.cpc)],
              ['Konverteringer', formatDecimal(a.conversions, 1)],
              ['Konv.verdi', a.conversionValue === null ? '–' : formatCurrency(a.conversionValue)],
              ['ROAS', a.roas === null ? '–' : formatDecimal(a.roas, 2)],
              ['CPA', a.cpa === null ? '–' : formatCurrency(a.cpa)],
            ],
          );
          break;
        }
        case 'gsc': {
          const clamp = clampGscPeriod(period, today);
          if (clamp.empty) {
            printTable('SEO (Search Console)', [['Merk', 'ingen komplette dager i perioden ennå']]);
            break;
          }
          const rows = await adapter.fetchDaily({ ...ch, from: clamp.period.start, to: clamp.period.end });
          const a = aggregateGsc(rows as Parameters<typeof aggregateGsc>[0]);
          const table: [string, string][] = [
            ['Klikk', formatInt(a.clicks)],
            ['Visninger', formatInt(a.impressions)],
            ['CTR', a.ctr === null ? '–' : formatPercentFromFraction(a.ctr)],
            ['Snittposisjon', a.position === null ? '–' : formatPosition(a.position)],
          ];
          if (clamp.truncated) table.push(['Merk', `data t.o.m. ${clamp.period.end} (GSC-etterslep)`]);
          printTable('SEO (Search Console)', table);
          break;
        }
        case 'ga4': {
          const rows = await adapter.fetchDaily({ ...ch, from: period.start, to: period.end });
          const a = aggregateGa4(rows as Parameters<typeof aggregateGa4>[0]);
          printTable('Trafikk (GA4)', [
            ['Økter', formatInt(a.sessions)],
            ['Brukere', formatInt(a.totalUsers)],
            ['Nye brukere', formatInt(a.newUsers)],
            ['Key events', formatInt(a.conversions)],
            ['Engasjementsrate', a.engagementRate === null ? '–' : formatPercentFromFraction(a.engagementRate)],
            ['Omsetning', a.totalRevenue === null ? '–' : formatCurrency(a.totalRevenue)],
          ]);
          break;
        }
      }
    } catch (err) {
      printTable(ch.channel, [['FEIL', err instanceof Error ? err.message : String(err)]]);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

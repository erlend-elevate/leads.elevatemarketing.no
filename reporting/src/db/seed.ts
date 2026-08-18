/**
 * Seed (brief del 6): settings, alle kjente kunder med Windsor-konto-ID-er,
 * pilotkunden (Pawesomeday) med rapportconfig, og en syntetisk fixture-klient
 * med ferdige snapshots for to perioder (forrige måned + måneden før), slik
 * at rapport-UI kan utvikles uten live-data.
 *
 * Kjøres med: pnpm db:seed  (krever DATABASE_URL)
 * Idempotent: eksisterende rader (på slug/unik nøkkel) røres ikke.
 */

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import {
  clientChannels,
  clients,
  reportConfigs,
  reportSnapshots,
  settings,
} from './schema';
import { FIXTURE_CLIENT, PILOT_SLUG, SEED_CLIENTS, type SeedClient } from './seed-data';
import { buildFixtureSnapshotsFor } from './fixtures';
import { previousMonth, todayInOslo } from '../lib/metrics/periods';

function newPortalToken(): string {
  return randomBytes(32).toString('base64url');
}

async function seedClient(db: ReturnType<typeof getDb>, c: SeedClient) {
  const existing = await db.query.clients.findFirst({
    where: eq(clients.slug, c.slug),
  });
  if (existing) {
    console.log(`  ~ ${c.slug} finnes allerede, hopper over`);
    return existing;
  }
  const [row] = await db
    .insert(clients)
    .values({
      name: c.name,
      slug: c.slug,
      businessType: c.businessType,
      active: c.active,
      goalsNote: c.goalsNote,
      portalToken: newPortalToken(),
    })
    .returning();
  for (const ch of c.channels) {
    await db.insert(clientChannels).values({
      clientId: row.id,
      channel: ch.channel,
      windsorConnector: ch.windsorConnector,
      accountId: ch.accountId,
      // Meta-kanalen aktiveres først når feltmanifestet er verifisert
      active: ch.channel !== 'meta_ads',
    });
  }
  console.log(`  + ${c.slug} (${c.channels.length} kanaler)`);
  return row;
}

async function main() {
  const db = getDb();

  console.log('Seeder settings …');
  await db
    .insert(settings)
    .values({
      id: 'default',
      agencyName: 'Elevate Marketing',
      senderName: 'Elevate Marketing',
      replyTo: 'erlend@elevatemarketing.no',
      footerText: 'Utarbeidet av Elevate Marketing – elevatemarketing.no',
    })
    .onConflictDoNothing();

  console.log('Seeder kunder …');
  for (const c of SEED_CLIENTS) {
    const row = await seedClient(db, c);
    if (c.slug === PILOT_SLUG) {
      const existingConfig = await db.query.reportConfigs.findFirst({
        where: eq(reportConfigs.clientId, row.id),
      });
      if (!existingConfig) {
        await db.insert(reportConfigs).values({
          clientId: row.id,
          frequency: 'monthly',
          // FYLLES INN AV ERLEND (brief del 19, pkt. 4). Intern adresse som
          // trygg placeholder — ingen kunde får e-post ved et uhell.
          recipients: ['erlend@elevatemarketing.no'],
          ccInternal: true,
          sections: { google_ads: true, ga4: true, gsc: true, meta_ads: false },
          comparison: 'previous_period',
          aiSummaryEnabled: true,
          active: true,
        });
        console.log('  + rapportconfig for pilot (månedlig)');
      }
    }
  }

  console.log('Seeder fixture-klient med snapshots …');
  const fixtureRow = await seedClient(db, FIXTURE_CLIENT);
  const today = todayInOslo();
  const period = previousMonth(today);
  const comparison = previousMonth(period.start);
  for (const [p, seedOffset] of [
    [period, 0],
    [comparison, 100],
  ] as const) {
    for (const snap of buildFixtureSnapshotsFor(p.start, p.end, seedOffset)) {
      await db
        .insert(reportSnapshots)
        .values({
          clientId: fixtureRow.id,
          channel: snap.channel,
          periodStart: p.start,
          periodEnd: p.end,
          kind: snap.kind,
          payload: snap.payload,
        })
        .onConflictDoNothing();
    }
  }
  console.log(
    `  + fixture-snapshots for ${period.start}–${period.end} og ${comparison.start}–${comparison.end}`,
  );

  console.log('Ferdig.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

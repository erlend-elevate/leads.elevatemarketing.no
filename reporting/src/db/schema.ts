/**
 * Datamodell (brief del 6). Postgres på Neon (EU) via Drizzle.
 *
 * Portal-token-modell (brief del 12, valgt variant): ETT stabilt token per
 * KLIENT (`clients.portal_token`) + rapport-id i path:
 *   /r/[token]            → nyeste rapport + arkiv
 *   /r/[token]/[reportId] → konkret rapport
 * Tokenet kan roteres per kunde fra admin (gamle lenker dør), og deaktivert
 * kunde gir 404. 32 tilfeldige bytes base64url → praktisk ugjettelig.
 */

import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const channelEnum = pgEnum('channel', [
  'meta_ads',
  'google_ads',
  'gsc',
  'ga4',
]);

export const businessTypeEnum = pgEnum('business_type', [
  'ecommerce',
  'leadgen',
]);

export const frequencyEnum = pgEnum('frequency', ['weekly', 'monthly']);

export const comparisonEnum = pgEnum('comparison', [
  'previous_period',
  'yoy',
  'both',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'generating',
  'ready',
  'sent',
  'failed',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  brandColor: text('brand_color'),
  timezone: text('timezone').notNull().default('Europe/Oslo'),
  currency: text('currency').notNull().default('NOK'),
  /** Kundens mål i fritekst — mates til AI-sammendraget */
  goalsNote: text('goals_note'),
  /** Styrer ROAS (ecommerce) vs. CPA (leadgen) i rapporten */
  businessType: businessTypeEnum('business_type').notNull().default('leadgen'),
  /** Stabilt portal-token, roteres fra admin. 32 bytes base64url. */
  portalToken: text('portal_token').notNull().unique(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const clientChannels = pgTable(
  'client_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    windsorConnector: text('windsor_connector').notNull(),
    accountId: text('account_id').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('client_channels_client_channel_uq').on(t.clientId, t.channel)],
);

export const reportConfigs = pgTable('report_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  frequency: frequencyEnum('frequency').notNull().default('monthly'),
  recipients: text('recipients').array().notNull().default([]),
  ccInternal: boolean('cc_internal').notNull().default(true),
  language: text('language').notNull().default('nb-NO'),
  /** Hvilke kanaler/seksjoner er på, f.eks. {"google_ads": true, "gsc": true} */
  sections: jsonb('sections').notNull().default({}),
  comparison: comparisonEnum('comparison').notNull().default('previous_period'),
  aiSummaryEnabled: boolean('ai_summary_enabled').notNull().default(true),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const reportSnapshots = pgTable(
  'report_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    periodStart: text('period_start').notNull(), // YYYY-MM-DD
    periodEnd: text('period_end').notNull(),
    /** 'daily' | 'breakdown:<dimensjon>' (f.eks. 'breakdown:query') */
    kind: text('kind').notNull(),
    /** Normaliserte rader (DailyRow[] eller BreakdownRow[]) */
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('report_snapshots_lookup_idx').on(t.clientId, t.channel, t.periodStart),
    // Én snapshot per (klient, kanal, periode, kind) — regenerering upserter
    uniqueIndex('report_snapshots_uq').on(
      t.clientId,
      t.channel,
      t.periodStart,
      t.periodEnd,
      t.kind,
    ),
  ],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    configId: uuid('config_id')
      .notNull()
      .references(() => reportConfigs.id, { onDelete: 'cascade' }),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    comparisonStart: text('comparison_start'),
    comparisonEnd: text('comparison_end'),
    status: reportStatusEnum('status').notNull().default('pending'),
    /** Peker til objektlager (Vercel Blob) — aldri binærdata i Postgres */
    pdfPath: text('pdf_path'),
    /** { summary: string, recommendations: string[] } — null hvis AI feilet/av */
    aiSummary: jsonb('ai_summary'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Idempotens-nøkkelen: cron-ticken kan trygt kjøres flere ganger
    uniqueIndex('reports_config_period_uq').on(t.configId, t.periodStart),
  ],
);

export const sendLog = pgTable('send_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => reports.id, { onDelete: 'cascade' }),
  recipient: text('recipient').notNull(),
  resendMessageId: text('resend_message_id'),
  status: text('status').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Én rad: byråets white-label + driftsstatus (dead man's switch) */
export const settings = pgTable('settings', {
  id: text('id').primaryKey().default('default'),
  agencyName: text('agency_name').notNull().default('Elevate Marketing'),
  agencyLogoUrl: text('agency_logo_url'),
  primaryColor: text('primary_color').notNull().default('#111111'),
  senderName: text('sender_name').notNull().default('Elevate Marketing'),
  replyTo: text('reply_to'),
  footerText: text('footer_text'),
  /** Dead man's switch: settes av cron-ticken; admin varsler ved >26 t */
  lastTickAt: timestamp('last_tick_at', { withTimezone: true }),
  ...timestamps,
});

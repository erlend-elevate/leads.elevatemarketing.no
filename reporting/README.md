# Elevate Reporting

Automatisert kunderapportering for Elevate Marketing — erstatter Swydo.
Henter markedsføringsdata via Windsor.ai, genererer norskspråklige rapporter
(HTML + PDF), sender dem på e-post etter plan, og gir hver kunde en
portal-lenke til rapportarkivet sitt.

> **Status: Fase 0** — Windsor-kontrakt, datamodell, adapter, periodelogikk og
> avstemmingsscript. Rapport-UI, PDF, e-post og admin kommer i Fase 1–2
> (se faseplanen i briefen).

## Arkitektur (kortversjon)

- **Én renderingsvei:** rapporten er én HTML-route; PDF er headless print av
  samme route (Fase 1)
- **Adapter-mønster:** alt datauttrekk går gjennom `ChannelAdapter`
  (`src/lib/adapters/`). Windsor er eneste implementasjon i MVP og kan byttes
  ut kanal for kanal
- **Snapshots, ikke live-spørringer:** rapporter genereres alltid fra
  JSONB-snapshots i Postgres — reproduserbart, raskt, og Windsor-nedetid
  stopper aldri visning av gamle rapporter

## Stack

Next.js (App Router, TypeScript strict) · pnpm · Postgres på Neon (EU) med
Drizzle · Tailwind · Recharts (Fase 1) · Playwright + @sparticuz/chromium for
PDF (Fase 1) · Resend (Fase 1) · Anthropic API (Fase 1) · Vercel `arn1`
(Stockholm) · date-fns + date-fns-tz (all periodelogikk i Europe/Oslo)

## Kom i gang

```bash
cd reporting
pnpm install
cp .env.example .env          # fyll inn verdier (se kommentarene i filen)
pnpm db:migrate               # kjør migrasjoner mot DATABASE_URL
pnpm db:seed                  # settings + kunder + pilot + fixture-klient
pnpm test                     # enhetstester (kjører uten nettverk)
pnpm typecheck
```

### Avstemming mot plattform-UI (Fase 0-akseptanse)

```bash
pnpm reconcile                          # pilotkunden (Pawesomeday), forrige måned
pnpm reconcile --client cmedical --month 2026-06
```

Printer kanaltotaler i terminalen. Sammenlign mot Google Ads / GA4 / Search
Console-UI — akseptkrav **±5 %**. Krever `WINDSOR_API_KEY` (fungerer uten
database; kanaloppsett leses da fra `src/db/seed-data.ts`).

### Integrasjonstest mot Windsor

```bash
pnpm test tests/integration   # skippes automatisk uten WINDSOR_API_KEY
```

Verifiserer de siste åpne punktene i `docs/windsor-contract.md`
(REST-svarform, kontofiltrering, feltmanifester).

## Viktige beslutninger og feller (les `docs/windsor-contract.md`)

- Windsor-felt-ID-er gjettes ALDRI — feltmanifest + validering ved oppstart/CI
- `session_default_channel_group` finnes i GA4-connectoren → ingen
  source/medium-fallback nødvendig
- GSC har ~2 dagers etterslep → perioden kuttes (`GSC_LAG_DAYS`) og seksjonen
  flagges «Data t.o.m. {dato}»
- GSC-posisjon aggregeres visningsvektet, aldri flatt snitt
- GA4 `engagement_rate` er brøk 0–1, normaliseres ved visning
- CPA/CPC/posisjon har invertert delta-semantikk (ned = grønt)
- Delta med 0 i nevner → «ny»/«–», aldri Infinity/NaN
- Meta restater attribusjon 28 dager tilbake → rullerende re-fetch (Fase 2)
- Uttrekk alltid per konto-ID — aldri på tvers av kunder i ett kall
- Windsor aggregerer per plattformkontos egen tidssone; datoer sendes som
  YYYY-MM-DD. Kjent kilde til ±1-dags kanteffekter i randene av perioder —
  akseptert avvik
- Månedsrapporter forfaller på 3. VIRKEDAG (man–fre; norske helligdager telles
  ikke — bevisst forenkling). Konstant: `MONTHLY_SEND_BUSINESS_DAY`

## Drift (fylles ut i Fase 2)

- Cron: Vercel Cron → `POST /api/cron/tick` daglig 05:00 UTC, idempotent på
  (`config_id`, `period_start`)
- Dead man's switch: `settings.last_tick_at`; admin varsler ved >26 t.
  Valgfritt tillegg: ekstern uptime-ping (f.eks. UptimeRobot) mot en
  status-route
- Feilede rapporter sendes ALDRI til kunde — intern varsling til
  `INTERNAL_ALERT_EMAIL`

## DNS (gjøres av Erlend, Fase 1–2)

- `rapport.elevatemarketing.no` → Vercel (CNAME, legges til i
  Vercel-prosjektet → Domains)
- Resend-verifisering av subdomenet: SPF/DKIM/DMARC-records — de nøyaktige
  verdiene genereres i Resend-dashbordet når domenet legges til, og
  dokumenteres her da

## GDPR / databehandlere

Systemet lagrer kun aggregerte kampanje-/trafikktall + kontaktpersoners
e-postadresser for utsendelse. All hosting/lagring i EU (Vercel `arn1`, Neon
EU). Databehandlere å føre i behandlingsprotokollen og akseptere DPA for:

| Leverandør | Rolle |
|---|---|
| Windsor.ai | datainnhenting fra annonseplattformer |
| Vercel | hosting (EU-region `arn1`) |
| Neon | database (EU-region) |
| Resend | e-postutsendelse (velg EU-region hvis tilgjengelig) |
| Anthropic | AI-sammendrag (mottar kun aggregater + kundens målsetning) |

## Struktur

```
reporting/
├── src/
│   ├── app/                  # Next.js-routes (portal, admin, API — Fase 1–2)
│   ├── lib/
│   │   ├── adapters/         # ChannelAdapter + WindsorAdapter + feltmanifest
│   │   └── metrics/          # perioder, deltaer, aggregering, nb-NO-format
│   └── db/                   # Drizzle-schema, seed, fixtures
├── drizzle/                  # genererte SQL-migrasjoner
├── scripts/reconcile.ts      # avstemming mot plattform-UI
├── tests/                    # vitest (enhet) + tests/integration (live)
└── docs/windsor-contract.md  # verifisert API-kontrakt — LES DENNE
```

# Windsor.ai API-kontrakt

> Status per **15.07.2026**. Verifisert programmatisk mot Windsor-kontoen
> `erlendelevatemarketingno` (erlend@elevatemarketing.no) via Windsors
> autentiserte MCP-grensesnitt. Punkter merket ⏳ krever `WINDSOR_API_KEY`
> (REST) og verifiseres av integrasjonstesten
> `tests/integration/windsor-live.test.ts` — oppdater denne filen når den har
> kjørt grønt første gang.

## Endepunkter

| Formål | Endepunkt |
|---|---|
| Data | `GET https://connectors.windsor.ai/{connector}` |
| Feltkatalog | `GET https://connectors.windsor.ai/{connector}/fields` |
| Kontoliste | `GET https://connectors.windsor.ai/list_connectors` |

- Auth: query-param `api_key` (ingen header-auth)
- Sentrale parametre: `fields` (kommaseparert), `date_from`/`date_to`
  (YYYY-MM-DD) eller `date_preset`, `filter` (JSON), `_max_rows`
- Rate limits: 600 req/min, 10 000 req/dag. Adapteren logger når <10 % gjenstår
  og retryer 429/5xx (3 forsøk, eksponentiell backoff + jitter)
- Feilsemantikk: 400 `invalid_request`, 401 `authentication_error`,
  403 `permission_denied`, 404 `not_found`, 429 `rate_limit_exceeded`,
  500 `server_error`

## Svarform ⏳

- Dokumentasjonen viser `{"data": [...]}`; MCP-laget returnerer `{"result": [...]}`
  (observert i alle kall 15.07.2026).
- **Beslutning:** `WindsorAdapter` godtar begge via zod-union — koden er
  robust uansett hva REST-endepunktet svarer. Integrasjonstesten avgjør
  endelig fasit.

## Kontofiltrering ⏳

- MCP-laget bruker `accounts`-parameter (verifisert: filtrerer korrekt).
- REST-docs bruker `select_accounts` — adapteren bruker denne
  (konstant `ACCOUNT_PARAM` i `src/lib/adapters/windsor.ts`, ett sted å endre).
- Integrasjonstesten verifiserer at to ulike kontoer gir ulike svar
  (stille ignorert filter = kritisk feil — kunders tall må aldri blandes).
- Regel (ufravikelig): uttrekk gjøres ALLTID per konto-ID. Aldri hent alle
  kunders data i ett kall og splitt etterpå.

## Talltyper

- Via MCP-laget kommer numeriske felter som **JSON-tall** (verifisert
  15.07.2026: `spend: 167.2123`, `clicks: 20` osv.).
- Adapteren coercer likevel defensivt (`z.coerce.number()`) i tilfelle REST
  leverer strenger. ⏳ Bekreftes av integrasjonstesten.

## Kritisk regel: felt-ID-er gjettes ALDRI

`/{connector}/fields` med kandidatliste returnerer kun de som finnes —
ugyldige ID-er utelates **stille** (empirisk bekreftet). Feltmanifestene i
`src/lib/adapters/field-manifest.ts` er eneste kilde til felt-ID-er, og
`validateManifest()` sjekker dem mot feltkatalogen ved oppstart/CI og feiler
høyt hvis et felt forsvinner.

## Feltmanifest per connector

### `google_ads` — VERIFISERT 15.07.2026 ✅

| Felt | Type | Merknad |
|---|---|---|
| `date` | DATE | YYYY-MM-DD |
| `campaign` | TEXT | kampanjenavn (breakdown-dimensjon) |
| `clicks` | NUMERIC | |
| `impressions` | NUMERIC | |
| `spend` | NUMERIC | i kontoens valuta |
| `conversions` | NUMERIC | kan være desimaltall (databasert attribusjon) |
| `conversions_value` | NUMERIC | **avklart Fase 0-kandidat** — finnes og returnerer data |
| `account_currency_code` | TEXT | **avklart Fase 0-kandidat** — finnes (`NOK` bekreftet). `currency` og `conversion_value`/`all_conversions_value` finnes også; vi bruker `conversions_value` (matcher `conversions`-definisjonen) |

Verifisert med ekte data (Pawesomeday 658-166-3129, 10.–12.07.2026):
tall kommer som JSON-tall, `conversions` som desimal (3.9541).

### `googleanalytics4` — VERIFISERT 15.07.2026 ✅

| Felt | Type | Merknad |
|---|---|---|
| `date` | DATE | |
| `sessions` | NUMERIC | |
| `totalusers` | NUMERIC | uten understrek! |
| `newusers` | NUMERIC | uten understrek! |
| `conversions` | NUMERIC | = GA4 «key events» |
| `engagement_rate` | PERCENT | **brøk 0–1** (0.7239 = 72,39 %) — normaliseres ved visning |
| `totalrevenue` | NUMERIC | kun ecommerce-seksjoner |
| `session_default_channel_group` | TEXT | se under |
| `source` / `medium` / `campaign` / `country` / `devicecategory` | TEXT | tilgjengelig ved behov |

**GA4-kanalfelt-beslutning (Fase 0 avklart):** feltet
`session_default_channel_group` **FINNES** (tabell «Traffic Source») og
returnerer GA4s standard kanalgrupper. Verifisert med ekte data
(De Bergenske 524123453, 01.–07.07.2026): `Direct`/`Organic Search`/`Referral`
med korrekte økter og key events. Source/medium-fallbacken fra brief 7.4 er
derfor **ikke nødvendig** — enum-verdiene oversettes til norsk i
`src/lib/metrics/channel-labels.ts` (ukjente verdier → «Annet», krasjer aldri).
Beslektede felter som også finnes: `default_channel_group` (Attribution),
`first_user_default_channel_group` (Traffic Source) — vi bruker
`session_default_channel_group` (økt-scopet, riktig for kanalfordeling av økter).

Bekreftet at disse IKKE finnes under antatte navn (fra brief):
`sessiondefaultchannelgroup(ing)`, `channelgrouping`, `channelgroup`,
`screenpageviews`, `pageviews`, `engagementrate`, `sessionsource`,
`sessionmedium`, `landingpage`, `eventcount`.

### `searchconsole` — VERIFISERT 15.07.2026 ✅

| Felt | Type | Merknad |
|---|---|---|
| `date` | DATE | |
| `clicks` | NUMERIC | |
| `impressions` | NUMERIC | |
| `ctr` | PERCENT | beregnes uansett selv fra totaler |
| `position` | NUMERIC | dagens snitt — aggregeres ALLTID visningsvektet |
| `query` | TEXT | breakdown-dimensjon (topp 10) |
| `page` | TEXT | breakdown-dimensjon (topp 10) |

- **~2 dagers dataetterslep** (empirisk: 15.07 var nyeste data 13.07).
  Periodelogikken kutter GSC-perioden på dag 3 (`GSC_LAG_DAYS`) og flagger
  seksjonen med «Data t.o.m. {dato}».
- Full feltkatalog hentet: også `branded_vs_nonbranded`, `device`, `country`
  m.fl. finnes (ikke i MVP).

### `facebook` (Meta Ads) — IKKE VERIFISERT ⛔

- Bekreftet 15.07.2026 (på nytt): «No facebook account for user
  erlendelevatemarketingno was found» — kontoen er ikke koblet.
- Manifestet i `field-manifest.ts` står som `verified: false`, og adapteren
  **nekter å hente meta_ads-data** til det er verifisert (testdekket).
- Fase 0-prosedyre når Erlend har koblet Meta
  (https://onboard.windsor.ai?datasource=facebook):
  1. Hent full feltkatalog fra `/facebook/fields`
  2. Velg og dokumentér felter for: dato, kampanje, forbruk, visninger,
     rekkevidde, klikk/lenkeklikk, frekvens, konverteringer/kjøp/leads og
     verdi. **Actions-feltene har Meta-spesifikk struktur — inspiser faktiske
     svar** før manifestet settes `verified: true`
  3. Oppdater manifestet + denne filen, aktiver `meta_ads`-kanalen i
    `client_channels`

## Kontoer i Windsor per 15.07.2026 (verifisert mot list_connectors)

| Connector | Kontoer |
|---|---|
| `google_ads` | `692-047-3801` CMedical (EM) · `627-352-3360` Strikkia.no · `658-166-3129` Pawesomeday · `838-618-0000` Iben Official · `545-309-5758` Småungene AS |
| `googleanalytics4` | `334051631` pawsomeday · `399778207` www.maya.no · `524123453` De Bergenske · `526047641` Gastroplanner - DB · `295145471` nermohotell.no |
| `searchconsole` | `sc-domain:cmedical.no` · `sc-domain:pawesomeday.no` · `https://www.skabufjellhotell.no/` · `https://www.debergenske.no/` · `https://www.maya.no/` · `https://www.nermohotell.no/` · `https://www.rsm.global/norway/nb/` · `sc-domain:campbellco.no` · `https://judicia.no/` |
| `facebook` | (ingen — kobles i Fase 0) |

## ⚠️ Windsor-plan

Kontoen viste `is_paid: false` per 15.07.2026. REST-API-nøkkelen forutsetter
betalt plan (Basic $23/mnd: 3 kildetyper / Standard $118/mnd: 7 kildetyper —
med Meta Ads blir det 4 kildetyper, sjekk hva Basic faktisk tillater).
Uten nøkkel kan ikke integrasjonstesten eller `scripts/reconcile.ts` kjøre.

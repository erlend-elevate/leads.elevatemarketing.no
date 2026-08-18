# GEO-audit landingsside — servicebedrifter

Landingsside for Elevate Marketing (EngeCo AS) sin kampanje: gratis **GEO-audit**
for norske servicebedrifter. Front-end er auditen, back-end er GEO-retainer.

Ren statisk side — **HTML/CSS/JS, ingen rammeverk, ingen page builder**. Bygget fra
designet i Claude Design (`geo-servicebedrifter/GEO Audit Landingsside.html`), i tråd
med Elevate-designsystemet og `landingsside-brief.md`.

> **Status:** klar for preview. Domenet er ikke koblet på ennå — siden kjøres på et
> Netlify preview-domene inntil videre. Funnel-koblingene (Typeform, Calendly, Meta
> Pixel) er stubbet med tydelige TODO-er, se [Åpne punkter](#åpne-punkter-før-lansering).

> **NB:** mappen [`reporting/`](reporting/README.md) er et separat prosjekt —
> **Elevate Reporting** (automatisert kunderapportering, Next.js, deployes til
> Vercel). Den hører ikke til landingssiden og er blokkert fra Netlify-publisering
> i `netlify.toml`.

---

## Struktur

```
.
├── index.html            # Hovedsiden (11 seksjoner, A1–A5-animasjoner)
├── takk.html             # Kvalifisert sti  → /takk  (Calendly + Lead-event her)
├── ikke-aktuell.html     # Ikke-kvalifisert → /ikke-aktuell  (INGEN event)
├── css/
│   └── site.css          # Ett samlet stilark: @font-face + tokens + base + side + anim
├── js/
│   └── geo-sb.js         # Animasjonslag (vanilla JS, IntersectionObserver)
├── fonts/                # Self-hostede webfonter (woff2)
│   ├── montserrat.woff2  # variabel, wght 100–900
│   └── poppins-{300,400,500,600}.woff2
├── favicon.svg
├── robots.txt            # Indekserbar side; AI-crawlere velkommen; funnel disallow
├── netlify.toml          # publish=., rene URL-er, sikkerhets- og cache-headere
└── scripts/
    └── fetch-fonts.py    # Regenererer font-filene fra Google Fonts (latin-subsett)
```

## Lokal kjøring

Ren statisk side — åpne `index.html` direkte, eller server mappa:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Siden er **komplett og lesbar uten JavaScript**; `geo-sb.js` er kun et animasjonslag oppå.

## Deploy til Netlify

Det er ingen build — `netlify.toml` setter `publish = "."`.

1. I Netlify: **Add new site → Import an existing project → GitHub**, og velg dette repoet.
2. Build command: tomt. Publish directory: `.` (leses fra `netlify.toml`).
3. Deploy. Siden får et preview-domene (`<navn>.netlify.app`).
4. Når domenet er klart: legg det til under **Domain settings**, og sett absolutt
   `og:url`/`og:image` i `index.html` + `Sitemap`-linje i `robots.txt`.

Rene URL-er `/takk` og `/ikke-aktuell` er satt opp som rewrites i `netlify.toml`.

## Animasjoner (A1–A5)

Ren CSS + vanilla JS (IntersectionObserver), kun `transform`/`opacity` (GPU-vennlig).
Hver sekvens spilles **én gang** per sidevisning (unntak: AI-mockupen, som looper rolig
med pause). `prefers-reduced-motion` respekteres — da vises statisk sluttbilde direkte.

- **A1** AI-mockup: spørsmål skrives → AI-svar bygges → «Ikke nevnt.» lander. Roterer
  rolig mellom rørlegger / elektriker / renhold. Diskret «Spill av igjen».
- **A2** Skiftet: AI-kortet legger seg over søkeresultatene og skyver lenkene ned.
- **A3** Mekanismen: tre paneler aktiveres sekvensielt, signal-linjer flyter inn.
- **A4** Audit-sjekklisten: de fem punktene hukes av i sekvens.
- **A5** Slik fungerer det: de tre stegene tones inn.

## Fonter / ytelse

- **Self-hostede** woff2 (latin-subsett dekker æ ø å), `font-display: swap`, de to
  LCP-kritiske filene `preload`-es. Montserrat er variabel (én fil, wght 100–900).
- Ett render-blokkerende stilark, ingen `@import`-kjeder, JS er `defer`. Mål: LCP < ~1,5 s
  på mobil. LCP-elementet (hero-H1) animeres ikke inn med forsinkelse.
- Regenerer fontene ved behov: `python3 scripts/fetch-fonts.py` (skriver til `fonts/` og
  printer `@font-face`-blokken).

---

## Åpne punkter før lansering

Disse er bevisst stubbet (TODO i koden) fordi de avhenger av beslutninger/lenker utenfor selve siden:

| Punkt | Hvor | Hva som mangler |
|---|---|---|
| **Typeform** ✅ | `index.html` CTA-er | Wiret: CTA-ene åpner skjema `nzIBCOAn` som popup (`embed.js`) med UTM-gjennomstrømming (`utm_source`, `utm_campaign`, `utm_content`, `angle`). Gjenstår: opprett disse som **hidden fields** i Typeform, og sett endings til å redirecte kvalifisert → `https://leads.elevatemarketing.no/takk` og ikke-kvalifisert → `https://leads.elevatemarketing.no/ikke-aktuell` |
| **Calendly** ✅ | `takk.html` | Wiret: inline-embed (`geo-gjennomgang-for-servicebedrifter`) med mørkt tema + mint via URL-parametre |
| **Meta Pixel** ✅ | `takk.html`, `index.html` | Wiret: pixel `2054301445970035`. Forsiden: kun base `PageView` (retargeting). `/takk`: `PageView` + `GEOAuditKvalifisert` på load + `GEOAuditMoteBooket` på Calendly-bekreftelse. `/ikke-aktuell`: ingen pixel. Gjenstår: **verifiser i Events Manager (Test Events)** før annonsene skrus på |
| **Personvern** | footer, alle sider | `href="#"` → faktisk personvern-URL |
| **Domene + OG** | `index.html`, `robots.txt` | Absolutt `og:url`/`og:image`, `Sitemap`-linje |

### Pixel og events (KRITISK)

- `GEOAuditKvalifisert` fyres **kun** på page-load av `/takk` — aldri på form-submit,
  aldri på `/ikke-aktuell`. Lag en custom conversion av den og optimaliser mot den.
- `GEOAuditMoteBooket` fyres på Calendly-bekreftelse (`calendly.event_scheduled`).
- **Verifiser begge stier i Events Manager (Test Events) FØR lansering.** Forrige funnel
  gikk live uten Lead-event; det skal ikke gjentas. Pixel `2054301445970035` er nå aktiv
  på `/takk` — kjør Test Events på `/takk` (skal fyre `GEOAuditKvalifisert`) og bekreft at
  `/ikke-aktuell` ikke fyrer noe, før annonsene skrus på.

## Avvik fra designfila (verdt å merke seg)

- **Mockup-bransje:** designets AI-mockup roterte rørlegger / elektriker / **flyttebyrå**.
  Byttet til rørlegger / elektriker / **renhold** for å matche annonse-settet (flyttebyrå
  ble tatt ut der pga. en eksisterende kunde i bransjen) — annonse og side skal dele motiv.
  Enkel å justere i `js/geo-sb.js` (`INDUSTRIES`) hvis dere vil ha den tilbake.
- **Design-tids-«tweaks»** (H1-varianter, mint-dosering, anim av/på, React/Babel-panelet)
  er fjernet, slik designet la opp til. Valgt standard er låst: H1 «Kundene spør AI.
  Nevnes dere?», normal mint-dosering, animasjoner på.
- **Logo:** siden bruker tekst-ordmerket «Elevate.» (med mint punktum), ikke en logofil.
  Designsystemets `elevate-mark.svg` er flagget som placeholder; ingen offisiell logo brukt.

---

*Kilde: Elevate Marketing-designsystemet (Claude Design handoff) + `landingsside-brief.md`.
All copy, tall og kilder er fra designet/briefen; verifiser tall og påstander før lansering.*

/**
 * Felt-manifest per Windsor-connector.
 *
 * KRITISK REGEL (brief 5.2): felt-ID-er skal ALDRI gjettes. Windsor utelater
 * ugyldige ID-er STILLE fra både /fields-svar og datasvar. Alle ID-er her er
 * verifisert mot Windsors feltkatalog 15.07.2026 — se docs/windsor-contract.md.
 *
 * `validateManifests()` sjekker manifestet mot /{connector}/fields ved
 * oppstart/CI og feiler høyt hvis et felt forsvinner.
 */

import type { Channel } from './types';

export interface ConnectorManifest {
  /** Windsor-connector-slug */
  connector: string;
  /** Felter for døgnoppløst uttrekk (fetchDaily) */
  dailyFields: string[];
  /** Felter per breakdown-dimensjon (fetchBreakdown) */
  breakdowns: Record<string, { dimensionField: string; metricFields: string[] }>;
  /**
   * false = feltene er IKKE verifisert mot /fields ennå (Meta kobles i Fase 0).
   * Adapteren nekter å hente data for uverifiserte manifester.
   */
  verified: boolean;
}

export const FIELD_MANIFESTS: Record<Channel, ConnectorManifest> = {
  google_ads: {
    connector: 'google_ads',
    // Verifisert 15.07.2026: alle finnes i /google_ads/fields
    dailyFields: [
      'date',
      'clicks',
      'impressions',
      'spend',
      'conversions',
      'conversions_value',
    ],
    breakdowns: {
      campaign: {
        dimensionField: 'campaign',
        metricFields: [
          'clicks',
          'impressions',
          'spend',
          'conversions',
          'conversions_value',
        ],
      },
    },
    verified: true,
  },

  ga4: {
    connector: 'googleanalytics4',
    // Verifisert 15.07.2026. NB: navngivingen er inkonsistent hos Windsor:
    // `engagement_rate` har understrek, `totalusers`/`newusers`/`totalrevenue` har ikke.
    // `engagement_rate` er PERCENT levert som brøk 0–1.
    dailyFields: [
      'date',
      'sessions',
      'totalusers',
      'newusers',
      'conversions',
      'engagement_rate',
      'totalrevenue',
    ],
    breakdowns: {
      // Verifisert 15.07.2026: `session_default_channel_group` FINNES (med
      // understreker) og returnerer data — source/medium-fallbacken fra brief
      // 7.4 er derfor ikke nødvendig. Enum-verdiene ("Organic Search", …)
      // oversettes til norsk i metrics/channel-labels.ts.
      channel_group: {
        dimensionField: 'session_default_channel_group',
        metricFields: ['sessions', 'conversions'],
      },
    },
    verified: true,
  },

  gsc: {
    connector: 'searchconsole',
    // Verifisert 15.07.2026. `position` er dagens snittposisjon — aggregeres
    // ALLTID visningsvektet (brief 7.1). ~2 dagers dataetterslep (brief 7.3).
    dailyFields: ['date', 'clicks', 'impressions', 'position'],
    breakdowns: {
      query: {
        dimensionField: 'query',
        metricFields: ['clicks', 'impressions', 'position'],
      },
      page: {
        dimensionField: 'page',
        metricFields: ['clicks', 'impressions', 'position'],
      },
    },
    verified: true,
  },

  meta_ads: {
    connector: 'facebook',
    // KAN IKKE VERIFISERES ennå — Meta-kontoen er ikke koblet i Windsor
    // (bekreftet 15.07.2026: «No facebook account for user … was found»).
    // Kandidatliste basert på Windsors feltreferanse; SKAL verifiseres mot
    // /facebook/fields når Erlend har koblet kontoen, og actions-feltene
    // (konverteringer/kjøp/verdi) skal inspiseres i faktiske svar før
    // manifestet settes til verified: true.
    dailyFields: [
      'date',
      'spend',
      'impressions',
      'reach',
      'clicks',
      'frequency',
    ],
    breakdowns: {
      campaign: {
        dimensionField: 'campaign',
        metricFields: ['spend', 'impressions', 'clicks'],
      },
    },
    verified: false,
  },
};

/** Feltkatalog-oppføring fra /{connector}/fields */
interface CatalogField {
  id: string;
}

/**
 * Validerer at alle felt-ID-er i manifestet fortsatt finnes i Windsors
 * feltkatalog. Kjøres ved oppstart av jobb-pipelinen og i CI (integrasjonstest).
 * Feiler høyt med liste over manglende felter.
 */
export async function validateManifest(
  manifest: ConnectorManifest,
  fetchCatalog: (connector: string) => Promise<CatalogField[]>,
): Promise<void> {
  if (!manifest.verified) {
    throw new Error(
      `Feltmanifestet for ${manifest.connector} er ikke verifisert ennå — se docs/windsor-contract.md`,
    );
  }
  const catalog = await fetchCatalog(manifest.connector);
  const known = new Set(catalog.map((f) => f.id));
  const wanted = new Set([
    ...manifest.dailyFields,
    ...Object.values(manifest.breakdowns).flatMap((b) => [
      b.dimensionField,
      ...b.metricFields,
    ]),
  ]);
  const missing = [...wanted].filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Windsor-feltkatalogen for ${manifest.connector} mangler felter fra manifestet: ${missing.join(', ')}. ` +
        'Windsor utelater ugyldige ID-er stille — rapportgenerering er stoppet for å unngå hull i data.',
    );
  }
}

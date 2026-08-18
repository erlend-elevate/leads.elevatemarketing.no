/**
 * Delta-beregning (brief 7.2).
 *
 * Divisjon på null: forrige = 0 og nå > 0 → «ny» (aldri Infinity);
 * begge 0 → «–». For cpa/cpc/position er NED godt — fargelogikk og
 * piler inverteres for disse.
 */

export type Delta =
  | { kind: 'pct'; value: number } // prosent med fortegn, f.eks. -12.4
  | { kind: 'new' } // forrige = 0, nå > 0 → vis «ny»
  | { kind: 'none' }; // begge 0 (eller nå 0 fra 0) → vis «–»

export function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    return current > 0 ? { kind: 'new' } : { kind: 'none' };
  }
  return { kind: 'pct', value: ((current - previous) / previous) * 100 };
}

/**
 * Metrikker der LAVERE verdi er bedre. For disse skal en negativ delta
 * fremstilles som positiv utvikling (grønt) og motsatt.
 */
export const INVERTED_METRICS = new Set(['cpa', 'cpc', 'position']);

export type Sentiment = 'good' | 'bad' | 'neutral';

/**
 * Hvilken valør har deltaet for gitt metrikk?
 *  - Vanlige metrikker: opp = good, ned = bad
 *  - Inverterte (cpa/cpc/position): ned = good, opp = bad
 *  - «ny» på en invertert metrikk (f.eks. CPA fra 0) er nøytral — det finnes
 *    ikke noe sammenligningsgrunnlag å felle dom over
 */
export function deltaSentiment(metric: string, delta: Delta): Sentiment {
  const inverted = INVERTED_METRICS.has(metric);
  switch (delta.kind) {
    case 'none':
      return 'neutral';
    case 'new':
      return inverted ? 'neutral' : 'good';
    case 'pct': {
      if (delta.value === 0) return 'neutral';
      const up = delta.value > 0;
      if (inverted) return up ? 'bad' : 'good';
      return up ? 'good' : 'bad';
    }
  }
}

/** Pilretning for visning (alltid faktisk retning, aldri invertert) */
export function deltaArrow(delta: Delta): 'up' | 'down' | 'flat' {
  if (delta.kind !== 'pct' || delta.value === 0) return 'flat';
  return delta.value > 0 ? 'up' : 'down';
}

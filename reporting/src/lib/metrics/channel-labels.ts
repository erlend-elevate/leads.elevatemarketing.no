/**
 * GA4-kanalgrupper → norske etiketter.
 *
 * Fase 0-beslutning (verifisert 15.07.2026): Windsor-feltet
 * `session_default_channel_group` FINNES og returnerer GA4s standard
 * kanalgrupper på engelsk. Source/medium-fallbacken fra brief 7.4 er derfor
 * ikke nødvendig — vi oversetter bare enum-verdiene. Ukjente verdier skal
 * aldri krasje → bucket «Annet».
 */

const LABELS: Record<string, string> = {
  Direct: 'Direkte',
  'Organic Search': 'Organisk søk',
  'Paid Search': 'Betalt søk',
  'Organic Social': 'Organisk sosialt',
  'Paid Social': 'Betalt sosialt',
  Email: 'E-post',
  Affiliates: 'Affiliate',
  Referral: 'Henvisning',
  Video: 'Video',
  Display: 'Display',
  'Paid Shopping': 'Betalt shopping',
  'Organic Shopping': 'Organisk shopping',
  'Paid Video': 'Betalt video',
  'Organic Video': 'Organisk video',
  'Cross-network': 'Kryssnettverk',
  Audio: 'Lyd',
  SMS: 'SMS',
  'Mobile Push Notifications': 'Push-varsler',
  Unassigned: 'Annet',
};

export function channelGroupLabel(group: string): string {
  return LABELS[group.trim()] ?? 'Annet';
}

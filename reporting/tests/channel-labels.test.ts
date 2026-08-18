import { describe, expect, it } from 'vitest';
import { channelGroupLabel } from '../src/lib/metrics/channel-labels';

describe('channelGroupLabel (GA4-kanalgrupper → norsk)', () => {
  it('oversetter standardgruppene', () => {
    expect(channelGroupLabel('Organic Search')).toBe('Organisk søk');
    expect(channelGroupLabel('Paid Search')).toBe('Betalt søk');
    expect(channelGroupLabel('Direct')).toBe('Direkte');
    expect(channelGroupLabel('Paid Social')).toBe('Betalt sosialt');
    expect(channelGroupLabel('Organic Social')).toBe('Organisk sosialt');
    expect(channelGroupLabel('Email')).toBe('E-post');
    expect(channelGroupLabel('Referral')).toBe('Henvisning');
  });

  it('ukjente verdier krasjer aldri — bucket «Annet»', () => {
    expect(channelGroupLabel('Some Future Group')).toBe('Annet');
    expect(channelGroupLabel('')).toBe('Annet');
    expect(channelGroupLabel('Unassigned')).toBe('Annet');
  });

  it('tåler whitespace', () => {
    expect(channelGroupLabel(' Organic Search ')).toBe('Organisk søk');
  });
});

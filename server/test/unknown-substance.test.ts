import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createIcsTemplate, fillIcsPdf } from '../src/ics-pdf.js';
import {
  UNKNOWN_SUBSTANCE_ID, matchesUnknownSubstanceQuery, unknownSubstanceProfile, unknownSubstanceSearchResult,
} from '../../src/lib/hazard-id/unknownSubstanceProtocol.js';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';

describe('unknown substance / white powder protocol', () => {
  it('matches unknown-material searches only', () => {
    for (const query of ['white powder', 'Suspicious letter', 'unknown', 'ERG 111', 'envelope']) expect(matchesUnknownSubstanceQuery(query)).toBe(true);
    for (const query of ['Sarin', 'Anthrax', 'Chlorine']) expect(matchesUnknownSubstanceQuery(query)).toBe(false);
    expect(unknownSubstanceSearchResult().id).toBe(UNKNOWN_SUBSTANCE_ID);
  });

  it('carries ERG Guide 111 isolation and cites a government source on every fact', () => {
    const profile = unknownSubstanceProfile();
    expect(profile.identifiers.ergGuide).toBe('111');
    expect(profile.isolationStandoffFacts[0].value).toBe('Isolate spill or leak area for at least 100 meters (330 feet) in all directions.');
    expect(profile.sourceFacts.length).toBeGreaterThan(20);
    for (const fact of profile.sourceFacts) {
      expect(fact.sourceUrl).toMatch(/^https:\/\/(www\.phmsa\.dot\.gov|stacks\.cdc\.gov|www\.osha\.gov)\//);
      expect(String(fact.sourcePage || '')).not.toBe('');
    }
  });

  it('does not select a PPE level and states that limitation', () => {
    const profile = unknownSubstanceProfile();
    expect(profile.ppeFacts.map((fact) => fact.value).join(' ')).not.toMatch(/Level [AB] (?:is )?required/i);
    expect(profile.limitations?.[0]).toMatch(/does not select a PPE level/);
  });

  it('includes the FBI-DHS-CDC notification, field screening and chain-of-custody steps', () => {
    const text = unknownSubstanceProfile().sourceFacts.map((fact) => fact.value).join(' ');
    expect(text).toMatch(/FBI WMD coordinator\/JTTF/);
    expect(text).toMatch(/rule out explosives, radiation, flammability, corrosives, and volatile organic compounds/);
    expect(text).toMatch(/Maintain chain of custody/);
  });
});

describe('ICS 201 map/sketch fallback', () => {
  it('embeds the attached pre-plan site image when no plume map exists', async () => {
    const original = readFileSync(new URL('../assets/ics-forms/ics-201.pdf', import.meta.url));
    const base = { incidentName: 'Pre-plan sketch test' };
    const plain = await fillIcsPdf(await createIcsTemplate('201', 'ICS 201', original), '201', base, () => '');
    const withSketch = await fillIcsPdf(await createIcsTemplate('201', 'ICS 201', original), '201', { ...base, preplanSiteImage: TINY_PNG }, () => '');
    expect(withSketch.byteLength).toBeGreaterThan(plain.byteLength);
  });
});

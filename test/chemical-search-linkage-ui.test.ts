import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const compare = readFileSync(new URL('../server/public/chem-compare.js', import.meta.url), 'utf8');

describe('shared chemical search transport rendering', () => {
  it('renders unresolved transport matches in a closed, guidance-blocked disclosure', () => {
    expect(script).toContain('Additional transport matches');
    expect(script).toContain('Transport identification only. These entries cannot drive chemical-specific guidance.');
    expect(script).toContain('appendAdditionalTransportMatches(chemicalSearchSuggestions');
    expect(script).toContain('appendAdditionalTransportMatches(incidentProductSuggestions');
    expect(script).toContain('appendAdditionalTransportMatches(plumeChemicalSuggestions');
  });

  it('keeps master suggestions ahead of transport-only matches in shared consumers', () => {
    expect(script).toContain('const masterChemicals = chemicals.filter((chemical) => !isUnreviewedTransportationRecord(chemical));');
    expect(compare).toContain('appendAdditionalTransportMatches(suggestions, transportMatches');
  });
});

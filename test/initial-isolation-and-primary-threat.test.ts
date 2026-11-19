import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';
import { cbrnePrimaryThreat } from '../src/lib/cbrne/cbrnePrimaryThreat';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });
function declaration(name: string) {
  const node = program.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}
function run<T>(expression: string): T {
  return runInNewContext(`
    function profileArray(value) { return Array.isArray(value) ? value : value ? [value] : []; }
    ${declaration('parseDistanceToMeters')}
    ${declaration('formatIsolationDistance')}
    ${declaration('initialIsolationRingsFromProfile')}
    ${expression}
  `, {}) as T;
}

describe('initial isolation rings (ERG 2024)', () => {
  it('parses ERG distance strings in any published unit', () => {
    expect(run<number>("parseDistanceToMeters('100 meters (330 feet)')")).toBe(100);
    expect(run<number>("parseDistanceToMeters('0.5 km')")).toBe(500);
    expect(run<number>("parseDistanceToMeters('1,000 ft')")).toBeCloseTo(304.8, 3);
    expect(run<number>("parseDistanceToMeters('1 mile')")).toBeCloseTo(1609.344, 3);
    expect(run<number | null>("parseDistanceToMeters('Refer to Table 3')")).toBeNull();
  });

  it('uses the ERG CWA table distance for CBRNE agents and never invents one', () => {
    const rings = run<Array<{ id: string; radiusM: number }>>(
      "initialIsolationRingsFromProfile({ identifiers: { ergInitialIsolationM: 400, ergGuide: '153' } })",
    );
    expect(rings).toHaveLength(1);
    expect(rings[0]).toMatchObject({ id: 'agent', radiusM: 400 });
    expect(run<unknown[]>('initialIsolationRingsFromProfile({ identifiers: {} })')).toEqual([]);
  });

  it('labels Table 1 rings in published feet and sends Table 3 gases to the largest container', () => {
    const rings = run<Array<{ id: string; radiusM: number; label: string }>>(`initialIsolationRingsFromProfile({
      isolationErg: {
        ergGuide: '124',
        ergTable1: [{ smallInitialDayFt: 200, largeInitialDayFt: 1500 }],
        ergTable3: [{ container: 'Rail tank car', initialIsolationFt: 3000 }, { container: 'Small cylinders', initialIsolationFt: 100 }],
      },
      response: { evacuation: ['Fire: If tank is involved in a fire, isolate for 800 meters (1/2 mile) in all directions'] },
    })`);
    expect(rings.map((ring) => ring.id)).toEqual(['small', 'fire', 'large']);
    expect(rings[0].label).toContain('200 ft (61 m)');
    expect(rings[2].label).toContain('3,000 ft');
    expect(rings[2].label).toContain('rail tank car');
  });
});

describe('CBRNE primary threat statement', () => {
  it('leads with the agent class in capitals and keeps the source fact verbatim', () => {
    const fact = {
      id: 'f1', fieldGroup: 'HAZARDS', fieldName: 'Primary responder hazard',
      value: 'Nerve-agent exposure can rapidly disrupt nervous-system function and may become fatal within minutes.',
      sourceName: 'NIOSH ERSH-DB', verificationStatus: 'Requires SME Review',
    };
    const threat = cbrnePrimaryThreat('NERVE_AGENT', [fact as never]);
    expect(threat?.classLabel).toBe('NERVE AGENT');
    expect(threat?.statement).toMatch(/^Exposure leads to nervous-system disruption and may become fatal within minutes/);
    expect(threat?.agentSourceFact?.value).toBe(fact.value);
  });
});

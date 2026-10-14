import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });

function declaration(name: string) {
  const node = program.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}

describe('Command facility inventory selection', () => {
  it('shows reported identifiers as unavailable rather than filling in missing values', () => {
    const result = runInNewContext(`
      ${declaration('reportedIdentifierValue')}
      ${declaration('chemicalSearchResultBadges')}
      chemicalSearchResultBadges({ cas: '["7782-50-5"]', un: null, ergGuide: '' });
    `);
    expect(result).toEqual([
      { type: 'CAS', label: 'CAS 7782-50-5' },
      { type: 'UN', label: 'UN Unavailable' },
      { type: 'ERG', label: 'ERG Unavailable' },
    ]);
  });

  it('searches facility names and addresses while preserving locations to distinguish matches', () => {
    const results = runInNewContext(`
      ${declaration('filterCommandFacilities')}
      filterCommandFacilities([
        { name: 'North Plant', address: '1 River Road, Albany' },
        { name: 'North Plant', address: '9 Harbor Road, Boston' },
        { name: 'South Plant', address: '1 River Road, Albany' },
      ], 'north plant');
    `);
    expect(results).toEqual([
      { name: 'North Plant', address: '1 River Road, Albany' },
      { name: 'North Plant', address: '9 Harbor Road, Boston' },
    ]);
  });

  it('summarizes associated chemical hazards for facility suggestions', () => {
    const result = runInNewContext(`
      ${declaration('reportedIdentifierValue')}
      ${declaration('facilityChemicalSummary')}
      facilityChemicalSummary({ chemicals: [
        { chemicalName: 'Chlorine', hazardClass: '["2.3","8"]' },
        { chemicalName: 'Ammonia, anhydrous', hazardClass: '["2.3","2.2"]' },
      ] });
    `);
    expect(result).toEqual([
      'Chlorine (Class 2.3)',
      'Ammonia, anhydrous (Class 2.3)',
    ]);
  });

  it('adds multiple linked inventory rows once without changing the selected facility or plume chemical', () => {
    let incidents: Array<Record<string, unknown>> = [{
      incidentId: 'incident-1',
      selectedChemicalId: 55,
      chemicalName: 'Chlorine',
      facilityId: 'facility-1',
      selectedFacility: { id: 'facility-1', name: 'North Plant' },
      involvedChemicals: [{ chemicalId: 'already-involved', chemicalName: 'Already involved' }],
    }];
    let activeIncident = incidents[0];
    let savedCount = 0;
    const statusMessages: string[] = [];
    const context = {
      console,
      activeFacilityInventory: {
        id: 'facility-1',
        name: 'North Plant',
        address: '1 River Road, Albany',
        source: 'Tier II',
        chemicals: [
          { id: 1, chemicalId: 'already-involved', chemicalName: 'Already involved', maxDailyAmountValue: '4', maxDailyAmountUnit: 'lb' },
          { id: 2, chemicalId: 'new-one', chemicalName: 'New one', cas: '["111-11-1"]', maxDailyAmountValue: '7', maxDailyAmountUnit: 'kg' },
          { id: 3, chemicalId: 'new-two', chemicalName: 'New two', un: '["1005"]', maxDailyAmountValue: '12', maxDailyAmountUnit: 'lb' },
        ],
      },
      facilityInventorySelection: new Set(['1', '2', '3']),
      facilityInventoryStatus: { textContent: '' },
      getActiveIncident: () => activeIncident,
      readIncidents: () => incidents,
      writeIncidents(records: Array<Record<string, unknown>>) {
        incidents = records;
        activeIncident = records[0];
        savedCount += 1;
      },
      renderIncidentLists() {},
      renderIncidentInvolvedChemicals() {},
      renderIncidentCommandSnapshot() {},
      window: { dispatchEvent() {} },
      CustomEvent: class { constructor(public type: string) {} },
      setIncidentStatus: (message: string) => statusMessages.push(message),
      closeFacilityInventoryDialog() {},
    };
    runInNewContext(`
      ${declaration('reportedIdentifierValue')}
      ${declaration('facilityChemicalIdentity')}
      ${declaration('isAlreadyIncidentChemical')}
      ${declaration('facilityInventoryItemIdentifier')}
      ${declaration('addSelectedFacilityChemicalsToIncident')}
      addSelectedFacilityChemicalsToIncident();
      addSelectedFacilityChemicalsToIncident();
    `, context);

    expect(incidents[0]).toMatchObject({
      selectedChemicalId: 55,
      chemicalName: 'Chlorine',
      facilityId: 'facility-1',
      selectedFacility: { id: 'facility-1', name: 'North Plant' },
    });
    const involvedChemicals = incidents[0].involvedChemicals as Array<Record<string, unknown>>;
    expect(involvedChemicals).toHaveLength(3);
    expect(involvedChemicals).toEqual(expect.arrayContaining([
      expect.objectContaining({ chemicalId: 'new-one', cas: '111-11-1', reportedQuantity: '7', reportedUnit: 'kg' }),
      expect.objectContaining({ chemicalId: 'new-two', un: '1005', reportedQuantity: '12', reportedUnit: 'lb' }),
    ]));
    expect(savedCount).toBe(2);
    expect(statusMessages).toEqual([
      '2 chemicals added to the incident from North Plant inventory.',
    ]);
    expect(context.facilityInventoryStatus.textContent).toContain('already identified');
  });
});

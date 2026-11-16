import { describe, expect, it } from 'vitest';
import { recordedIcsValue } from '../server/src/ics-prefill.js';

describe('ICS spill-control equipment prefill', () => {
  it('maps a section-parented position-only assignment into the shared ICS 201, 203, and 214 fields', () => {
    const incident = {
      guidedResponseAssignments: [{ assignmentId: 'ops-1', role: 'Air Monitoring Team', personnel: 'Monitor One', locationLabel: 'ICP', status: 'Planned', organizationSection: 'operations', parentRoleId: 'operations-chief' }],
    };
    expect(recordedIcsValue('201', 'ResourceRow1', incident)).toBe('Air Monitoring Team - Monitor One');
    expect(recordedIcsValue('203', 'NameRow1', incident)).toBe('Monitor One | Air Monitoring Team');
    expect(recordedIcsValue('214', 'NameRow1', incident)).toBe('Monitor One');
    expect(recordedIcsValue('214', 'IcsPositionRow1', incident)).toBe('Air Monitoring Team');
  });

  it('carries the shared inventory and recorded quantities into assignment documentation', () => {
    const value = recordedIcsValue('204', '6 Work Assignments', {
      operationalActionPlan: { strategy: 'Defensive', phases: [{ number: 4, title: 'Select and Execute a Strategy', status: 'Not Started', goal: 'Hold and monitor.', objectives: ['Verify conditions'] }] },
      guidedResponseAssignments: [{ assignmentId: 'a1', role: 'Entry Team', personnel: 'Team One', unit: 'HM-1', responsibility: 'Contain', status: 'Planned', locationStatus: 'Hot Zone' }],
      equipmentInventory: [
        { categoryLabel: 'Acid/base chemical spill-control pad', manufacturer: '3M', productName: 'P-110 chemical sorbent pad', productType: 'absorbent', form: 'pad', availableQuantity: '', assignedQuantity: '2', compatibilityStatus: 'Verified with concentration and temperature limits; product/application check required' },
      ],
    });
    expect(value).toContain('Spill-control equipment inventory:');
    expect(value).toContain('available: Not recorded; assigned: 2');
    expect(value).toContain('P-110 chemical sorbent pad');
    expect(value).toContain('Planned tasks:');
    const resourceValue = recordedIcsValue('215', 'Work Assignment 1', {
      operationalActionPlan: { phases: [{ phaseId: 'mitigation-strategy', objectives: ['Verify conditions'] }] },
      guidedResponseAssignments: [{ assignmentId: 'a1', phaseId: 'mitigation-strategy', role: 'Entry Team', responsibility: 'Contain', status: 'Planned' }],
      equipmentInventory: [{ productName: 'P-110 chemical sorbent pad', productType: 'absorbent', form: 'pad', availableQuantity: '', assignedQuantity: '2', compatibilityStatus: 'Verified with limits' }],
    });
    expect(resourceValue).toContain('P-110 chemical sorbent pad');
    expect(resourceValue).toContain('Planned: Verify conditions');
  });
});

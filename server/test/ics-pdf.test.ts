import { describe, expect, it } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import { createIcsTemplate, fillIcsPdf } from '../src/ics-pdf.js';
import { recordedIcsValue, incidentActivity } from '../src/ics-prefill.js';

const ids = ['201','202','203','204','205','205A','206','208','208HM','209','214','215','215A'];
const sample = {
  incidentName: 'TRAINING - Warehouse Response', incidentNumber: 'DRILL-42', status: 'Active', startDate: '10/29/2026', startTime: '13:30',
  address: 'Training Site', objectives: 'Identify the release. Establish zones. Verify control.', commanderName: 'Training Commander',
  operationalMode: 'Defensive', medicalPlan: 'Medic 1 assigned to Rehab.', communications: 'Command on TAC 2.',
  guidedResponseAssignments: [
    { assignmentId: 'a', role: 'Entry Team', personnel: 'Team Alpha', unit: 'HazMat 1', responsibility: 'Recon', status: 'Assigned', crewSize: 3 },
    { assignmentId: 'b', role: 'Medical / Rehab', personnel: 'Medic Crew', unit: 'Medic 1', locationStatus: 'Cold zone', status: 'Confirmed' },
  ],
  incidentTimeline: [{ type: 'incident-created', changedAt: '2026-10-29T13:30:00Z', changedBy: 'Training Commander' }, { type: 'objective-updated', label: 'Zones established', changedAt: '2026-10-29T13:40:00Z' }],
};
function value(id: string, name: string, incident: Record<string, unknown>) {
  const recorded = recordedIcsValue(id, name, incident);
  if (recorded !== undefined) return recorded;
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^(1)?incidentname\d*$/.test(n)) return String(incident.incidentName || '');
  if (/^(2)?incidentnumber\d*$/.test(n)) return String(incident.incidentNumber || '');
  if (n.includes('objectives')) return String(incident.objectives || '');
  if (n === 'datefrom') return String(incident.startDate || '');
  if (n === 'timefrom') return String(incident.startTime || '');
  if (n === 'medicalplan') return String(incident.medicalPlan || '');
  if (n === 'communicationsplan') return String(incident.communications || '');
  return '';
}

describe('Editable incident ICS worksheets', () => {
  for (const id of ids) it(`exports ${id} with original FEMA pages and a canonical field tree`, async () => {
    const original = readFileSync(new URL(`../assets/ics-forms/ics-${id.toLowerCase()}.pdf`, import.meta.url));
    const pdf = await createIcsTemplate(id, `ICS ${id} Incident Worksheet`, original);
    const bytes = await fillIcsPdf(pdf, id, sample, (name) => value(id, name, sample));
    const reopened = await PDFDocument.load(bytes);
    expect(reopened.getPageCount()).toBe((await PDFDocument.load(original)).getPageCount());
    expect(reopened.getForm().getFields().map((field) => field.getName())).toEqual((await PDFDocument.load(original)).getForm().getFields().map((field) => field.getName()));
    const fields = reopened.getForm().getFields();
    const name = fields.find((f) => /^(?:1 )?Incident Name(?:_\d+)?$/i.test(f.getName())) as PDFTextField;
    expect(name.getText()).toBe(sample.incidentName);
    expect(name.acroField.getWidgets()[0].getNormalAppearance()).toBeDefined();
    expect(fields.filter((f) => f instanceof PDFTextField && f.getName().toLowerCase().includes('signature')).every((f) => !(f as PDFTextField).getText())).toBe(true);
    if (process.env.ICS_PREVIEW_DIR) { mkdirSync(process.env.ICS_PREVIEW_DIR, { recursive: true }); writeFileSync(`${process.env.ICS_PREVIEW_DIR}/ics-${id}.pdf`, bytes); }
  });
  it('recomputes drafts from new incident facts and preserves manual corrections, including intentional blanks', async () => {
    const original = readFileSync(new URL('../assets/ics-forms/ics-201.pdf', import.meta.url));
    const incident = { ...sample, incidentName: 'Updated response', icsForms: { '201': { fields: { 'Incident Name': 'Manual name', '7 Current and Planned Objectives': '' } } } };
    const pdf = await createIcsTemplate('201', 'ICS 201', original);
    const reopened = await PDFDocument.load(await fillIcsPdf(pdf, '201', incident, (name) => value('201', name, incident)));
    expect(reopened.getForm().getTextField('Incident Name').getText()).toBe('Manual name');
    expect(reopened.getForm().getTextField('7 Current and Planned Objectives').getText() || '').toBe('');
    expect(reopened.getForm().getTextField('Incident Number').getText()).toBe(sample.incidentNumber);
  });
  it('uses multiple assigned teams without inventing crew sizes or operational completions', () => {
    expect(recordedIcsValue('203', 'AgencyOrganizationRow2', sample)).toBe('Medic 1');
    expect(recordedIcsValue('204', 'Number of Persons, Row 1', sample)).toBe('3');
    expect(recordedIcsValue('204', 'Number of Persons, Row 2', sample)).toBe('');
    expect(recordedIcsValue('214', 'NameRow1_3', sample)).toBe('Team Alpha');
    expect(recordedIcsValue('206', 'NameRow1', sample)).toBe('Medic 1');
    expect(recordedIcsValue('214', 'Notable ActivitiesRow2', sample)).toContain('Zones established');
    expect(incidentActivity(sample).map((event) => event.detail).join(' ')).not.toContain('Recon completed');
  });
  it('records actual completion in the log without marking active incidents complete', () => {
    const completed = { ...sample, status: 'Completed', completedAt: '2026-10-29T14:30:00Z' };
    expect(incidentActivity(completed).at(-1)?.detail).toContain('Incident closed');
    expect(incidentActivity(sample).some((event) => event.detail.includes('Incident closed'))).toBe(false);
  });
  it('places Command assignments into ICS 201 resource and assignment fields', () => {
    expect(recordedIcsValue('201', 'ResourceRow1', sample)).toBe('Entry Team - Team Alpha');
    expect(recordedIcsValue('201', 'Resource IdentifierRow2', sample)).toBe('Medic 1');
    expect(recordedIcsValue('201', 'Notes locationassignmentstatus', sample)).toContain('Recon');
    expect(recordedIcsValue('201', 'Notes locationassignmentstatus_2', sample)).toContain('Cold zone');
    expect(recordedIcsValue('201', '6 Prepared by Name', { ...sample, preparedBy: 'Report Writer' })).toBe('Report Writer');
    expect(recordedIcsValue('201', '6 Prepared by Name', { commanderName: 'Other Person' })).toBe('');
  });
  it('retains recorded assignment events and leaves unknown facts blank', () => {
    const incident = { guidedResponseAssignmentHistory: [{ action: 'assigned', changedAt: '2026-10-29T13:30:00Z', assignment: { personnel: 'Entry Team 2', unit: 'Unit 4' } }] };
    expect(incidentActivity(incident)[0].detail).toContain('Entry Team 2');
    expect(recordedIcsValue('214', 'Notable ActivitiesRow1', incident)).toContain('Entry Team 2');
    expect(recordedIcsValue('201', 'Signature', incident)).toBe('');
  });
});

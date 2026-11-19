import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { commandNotesText, formatNoteTimestamp, COMMAND_NOTES_FIELD } from '../src/command-notes.js';
import { createIcsTemplate, fillIcsPdf } from '../src/ics-pdf.js';

const incident = {
  incidentName: 'Test Chlorine Release', clientTimeZone: 'America/Chicago', notes: 'Odor reported at rail spur.',
  incidentNotes: [
    { text: 'Entry team withdrawn; readings rising at east fence.', createdAt: '2026-11-19T20:45:00.000Z' },
    { text: 'Wind shifted to 250 deg at 8 mph.', createdAt: '2026-11-19T20:30:00.000Z', source: 'Weather Intelligence' },
    { text: '   ', createdAt: '2026-11-19T20:50:00.000Z' },
  ],
};

describe('Command Notes autofill', () => {
  it('formats recorded notes oldest-first, one time-stamped paragraph each, in local time', () => {
    expect(formatNoteTimestamp('2026-11-19T20:30:00.000Z', 'America/Chicago')).toBe('11/19/2026 1430 CST');
    expect(commandNotesText(incident)).toBe([
      'INITIAL SCENE NOTES - Odor reported at rail spur.',
      '11/19/2026 1430 CST (Weather Intelligence) - Wind shifted to 250 deg at 8 mph.',
      '11/19/2026 1445 CST - Entry team withdrawn; readings rising at east fence.',
    ].join('\n\n'));
  });

  it('fills the Command Notes PDF with uniform 10 pt Helvetica and fits long logs', async () => {
    const original = readFileSync(new URL('../assets/ics-forms/command-notes.pdf', import.meta.url));
    const run = async (record: Record<string, unknown>) => {
      const pdf = await createIcsTemplate('NOTES', 'Command Notes', original);
      const bytes = await fillIcsPdf(pdf, 'NOTES', record, (name) => (name === COMMAND_NOTES_FIELD ? commandNotesText(record) : name === '1 Incident Name' ? String(record.incidentName) : ''));
      return { bytes, doc: await PDFDocument.load(bytes) };
    };
    const { doc, bytes } = await run(incident);
    const field = doc.getForm().getTextField(COMMAND_NOTES_FIELD);
    expect(field.getText()).toContain('Entry team withdrawn');
    expect(String(field.acroField.getDefaultAppearance())).toMatch(/10 Tf/);
    expect(String(doc.getForm().getTextField('1 Incident Name').acroField.getDefaultAppearance())).toMatch(/10 Tf/);
    if (process.env.ICS_PREVIEW_DIR) writeFileSync(`${process.env.ICS_PREVIEW_DIR}/command-notes-filled.pdf`, bytes);
    const many = { ...incident, incidentNotes: Array.from({ length: 120 }, (_, i) => ({ text: `Progress report ${i + 1}: crews rotating, monitoring continues at the perimeter.`, createdAt: new Date(Date.UTC(2026, 10, 19, 12, i)).toISOString() })) };
    const long = (await run(many)).doc.getForm().getTextField(COMMAND_NOTES_FIELD);
    expect(String(long.acroField.getDefaultAppearance())).toMatch(/ 8 Tf/);
    expect(long.getText()).toContain('Additional notes continue');
  });
});

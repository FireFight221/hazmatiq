// Builds assets/ics-forms/command-notes.pdf: a plain fillable Command Notes
// sheet (incident information block + one large multiline notes box).
// Field names follow the ICS form naming used by automatic prefill.
// Run: node scripts/build-command-notes-pdf.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/ics-forms/command-notes.pdf');
const pdf = await PDFDocument.create();
pdf.setTitle('Command Notes');
pdf.setSubject('Command Notes — fillable incident notes sheet');
pdf.setCreator('EMERGENZ');
const page = pdf.addPage([612, 792]);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const form = pdf.getForm();
const black = rgb(0, 0, 0);
const margin = 36;
const width = 612 - margin * 2;

page.drawText('COMMAND NOTES', { x: margin, y: 744, size: 18, font: bold, color: black });
page.drawText('Incident Command working notes', { x: margin, y: 728, size: 9, font: regular, color: rgb(0.25, 0.25, 0.25) });

function box(x, y, w, h) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: black, borderWidth: 0.8 });
}
function labeledField(name, label, x, y, w, h = 30) {
  box(x, y, w, h);
  page.drawText(label, { x: x + 4, y: y + h - 10, size: 7.5, font: bold, color: black });
  const field = form.createTextField(name);
  field.addToPage(page, { x: x + 3, y: y + 2, width: w - 6, height: h - 13, borderWidth: 0, font: regular });
  field.setFontSize(10);
  return field;
}

// Incident information block (three rows).
const top = 680;
const rowH = 30;
const half = width / 2;
const third = width / 3;
labeledField('1 Incident Name', '1. Incident Name:', margin, top, half);
labeledField('2 Incident Number', '2. Incident Number:', margin + half, top, half / 2);
labeledField('3 Date Time Prepared', '3. Date/Time Prepared:', margin + half * 1.5, top, half / 2);
labeledField('4 Incident Location', '4. Incident Location:', margin, top - rowH, width);
labeledField('5 Primary Materials or Hazards', '5. Primary Material(s) / Hazard(s):', margin, top - rowH * 2, third * 2);
labeledField('6 Operational Period', '6. Operational Period:', margin + third * 2, top - rowH * 2, third);
labeledField('7 Incident Commander', '7. Incident Commander:', margin, top - rowH * 3, half);
labeledField('8 Prepared by NamePosition', '8. Prepared by (Name/Position):', margin + half, top - rowH * 3, half);

// Large notes box.
const notesTop = top - rowH * 3 - 14;
const notesBottom = 56;
box(margin, notesBottom, width, notesTop - notesBottom);
page.drawText('9. Command Notes:', { x: margin + 4, y: notesTop - 11, size: 8, font: bold, color: black });
const notes = form.createTextField('9 Command Notes');
notes.enableMultiline();
notes.addToPage(page, { x: margin + 3, y: notesBottom + 3, width: width - 6, height: notesTop - notesBottom - 18, borderWidth: 0, font: regular });
notes.setFontSize(10);

page.drawText('Command Notes', { x: margin, y: 38, size: 8, font: bold, color: black });
page.drawText('Page ____ of ____', { x: 612 - margin - 72, y: 38, size: 8, font: regular, color: black });

await writeFile(out, await pdf.save());
console.log('wrote', out);

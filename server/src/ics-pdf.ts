import { PDFDocument, PDFTextField } from 'pdf-lib';

type Incident = Record<string, unknown>;
/** Preserve the government-issued PDF, including its original pages,
 * graphics, instructions and AcroForm fields. Only field values are filled. */
export async function createIcsTemplate(_id: string, _title: string, original: Uint8Array) {
  return PDFDocument.load(original);
}

export async function fillIcsPdf(pdf: PDFDocument, id: string, incident: Incident, automatic: (name: string) => string) {
  const saved = (incident.icsForms as Record<string, { fields?: Record<string, unknown> }> | undefined)?.[id]?.fields || {};
  for (const field of pdf.getForm().getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const raw = Object.prototype.hasOwnProperty.call(saved, field.getName()) ? saved[field.getName()] : automatic(field.getName());
    const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
    // Standard FEMA fonts cannot encode arbitrary imported Unicode. Normalize
    // punctuation in the PDF only; the complete original record stays attached.
    if (value) field.setFontSize(0); // Fit values inside the original FEMA field boundaries.
    field.setText(value.replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2192/g, ' -> ').replace(/[^\t\n\r\x20-\x7e\xa0-\xff]/g, '?'));
  }
  if (id === '201' && typeof incident.plumeMapImage === 'string' && incident.plumeMapImage.length < 8_000_000) {
    const map = pdf.getForm().getFields().find((field) => field instanceof PDFTextField && field.getName().startsWith('4 MapSketch')) as PDFTextField | undefined;
    if (map && !Object.prototype.hasOwnProperty.call(saved, map.getName()) && /^data:image\/(png|jpeg);base64,/.test(incident.plumeMapImage)) {
      try {
        const image = incident.plumeMapImage.startsWith('data:image/png') ? await pdf.embedPng(incident.plumeMapImage) : await pdf.embedJpg(incident.plumeMapImage);
        map.setImage(image);
      } catch {
        console.warn('ICS 201 snapshot could not be embedded; recorded fields are retained.');
      }
    }
  }
  await pdf.attach(new TextEncoder().encode(JSON.stringify(incident, null, 2)), 'incident-record.json', {
    mimeType: 'application/json', description: 'Complete recorded incident data, including activity beyond the worksheet rows. Guidance does not establish completed actions.',
  });
  pdf.setSubject('Original FEMA ICS fillable form populated with recorded incident data');
  return pdf.save();
}

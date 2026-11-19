/**
 * Command Notes sheet (EMERGENZ local form "NOTES").
 * Formats the incident's recorded notes ("Add Incident Note" on the Command
 * page, Weather Intelligence briefs, and the initial scene notes) into one
 * consistently styled block for the "9 Command Notes" field: one paragraph
 * per entry, oldest first, each led by a 24-hour timestamp, separated by a
 * blank line.
 */
import { PDFDocument, PDFTextField, StandardFonts, type PDFFont } from 'pdf-lib';

type Incident = Record<string, unknown>;
type NoteRecord = { text?: unknown; createdAt?: unknown; source?: unknown };

export const COMMAND_NOTES_FIELD = '9 Command Notes';
export const COMMAND_NOTES_FONT_SIZE = 10;
const MIN_NOTES_FONT_SIZE = 8;
const LINE_HEIGHT = 1.2;
const OVERFLOW_NOTICE = '[Additional notes continue in the attached incident-record.json and the EMERGENZ incident record.]';

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim() : '';
}

export function formatNoteTimestamp(value: unknown, timeZone?: unknown) {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const zone = typeof timeZone === 'string' && timeZone ? timeZone : 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}${get('minute')} ${get('timeZoneName')}`.trim();
  } catch {
    return formatNoteTimestamp(value, 'UTC');
  }
}

/** Plain-text Command Notes block built only from recorded incident notes. */
export function commandNotesText(incident: Incident) {
  const zone = incident.clientTimeZone || incident.timeZone;
  const paragraphs: string[] = [];
  const sceneNotes = clean(incident.notes);
  if (sceneNotes) paragraphs.push(`INITIAL SCENE NOTES - ${sceneNotes}`);
  const notes = (Array.isArray(incident.incidentNotes) ? incident.incidentNotes : []) as NoteRecord[];
  notes
    .map((note, index) => ({ note, index, time: Date.parse(String(note?.createdAt || '')) }))
    .filter(({ note }) => clean(note?.text))
    .sort((a, b) => (Number.isNaN(a.time) || Number.isNaN(b.time) ? a.index - b.index : a.time - b.time || a.index - b.index))
    .forEach(({ note }) => {
      const stamp = formatNoteTimestamp(note.createdAt, zone);
      const source = clean(note.source);
      const lead = [stamp, source && `(${source})`].filter(Boolean).join(' ');
      paragraphs.push(lead ? `${lead} - ${clean(note.text)}` : clean(note.text));
    });
  return paragraphs.join('\n\n');
}

function wrappedLineCount(text: string, font: PDFFont, size: number, width: number) {
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { lines += 1; continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
      else { lines += 1; line = word; }
    }
    lines += 1;
  }
  return lines;
}

/** Apply a uniform Helvetica style to the Command Notes sheet. Header fields
 * use 10 pt; the notes box uses 10 pt and only steps down (9, then 8 pt) to
 * keep every recorded entry on the page. */
export async function styleCommandNotesPdf(pdf: PDFDocument) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField) || field.getName() === COMMAND_NOTES_FIELD) continue;
    field.setFontSize(COMMAND_NOTES_FONT_SIZE);
  }
  const notes = form.getFields().find((field) => field.getName() === COMMAND_NOTES_FIELD);
  if (!(notes instanceof PDFTextField)) { form.updateFieldAppearances(font); return; }
  const rect = notes.acroField.getWidgets()[0].getRectangle();
  const width = rect.width - 8;
  const capacity = (size: number) => Math.floor((rect.height - 6) / (size * LINE_HEIGHT));
  let text = notes.getText() || '';
  let size = COMMAND_NOTES_FONT_SIZE;
  while (size > MIN_NOTES_FONT_SIZE && wrappedLineCount(text, font, size, width) > capacity(size)) size -= 1;
  if (wrappedLineCount(text, font, size, width) > capacity(size)) {
    const paragraphs = text.split('\n\n');
    while (paragraphs.length > 1 && wrappedLineCount(`${paragraphs.join('\n\n')}\n\n${OVERFLOW_NOTICE}`, font, size, width) > capacity(size)) paragraphs.pop();
    text = `${paragraphs.join('\n\n')}\n\n${OVERFLOW_NOTICE}`;
    notes.setText(text);
  }
  notes.setFontSize(size);
  form.updateFieldAppearances(font);
}

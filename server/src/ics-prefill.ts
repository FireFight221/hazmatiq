/** Map recorded incident facts to FEMA's actual AcroForm field names.
 * Undefined delegates to the existing chemical-reference mapper. Empty text
 * deliberately leaves unknown facts/signatures blank rather than inventing them.
 */
type RecordValue = Record<string, unknown>;
const text = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const normalize = (value: unknown) => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export function incidentAssignments(incident: RecordValue): RecordValue[] {
  const raw = Array.isArray(incident.guidedResponseAssignments) ? incident.guidedResponseAssignments
    : Object.values((incident.guidedResponsePhaseState || {}) as RecordValue).flatMap((phase) => Array.isArray((phase as RecordValue)?.assignments) ? (phase as RecordValue).assignments as unknown[] : []);
  const seen = new Set<string>();
  return raw.filter((item): item is RecordValue => Boolean(item && typeof item === 'object'))
    .filter((item) => {
      if (item.status === 'Suggested') return false;
      const key = text(item.assignmentId) || JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
}
export function incidentActivity(incident: RecordValue): Array<{ time: string; detail: string }> {
  const timeline = Array.isArray(incident.incidentTimeline) ? [...incident.incidentTimeline] : [];
  const history = Array.isArray(incident.guidedResponseAssignmentHistory) ? incident.guidedResponseAssignmentHistory : [];
  for (const item of history) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as RecordValue;
    const assignment = (entry.assignment || {}) as RecordValue;
    const label = [entry.action, assignment.personnel, assignment.unit, assignment.role].map(text).filter(Boolean).join(' | ');
    if (!timeline.some((event) => event && typeof event === 'object' && (event as RecordValue).changedAt === entry.changedAt && text((event as RecordValue).label).includes(text(assignment.personnel)))) {
      timeline.push({ ...entry, label });
    }
  }
  if (incident.status === 'Completed' && incident.completedAt && !timeline.some((item) => item && typeof item === 'object' && (item as RecordValue).type === 'incident-completed')) {
    timeline.push({ type: 'incident-completed', changedAt: incident.completedAt, label: 'Incident closed', changedBy: incident.completedBy });
  }
  timeline.sort((a, b) => text((a as RecordValue)?.changedAt).localeCompare(text((b as RecordValue)?.changedAt)));
  return timeline.filter((item): item is RecordValue => Boolean(item && typeof item === 'object')).map((item) => ({
    time: text(item.changedAt || item.createdAt || item.timestamp),
    detail: [item.type, item.label || item.message || item.action, item.from && `from ${text(item.from)}`, item.to && `to ${text(item.to)}`, item.evidence, item.changedBy].map(text).filter(Boolean).join(' | '),
  }));
}
export function recordedIcsValue(formId: string, fieldName: string, incident: RecordValue): string | undefined {
  const n = normalize(fieldName);
  const assignments = incidentAssignments(incident);
  const role = (pattern: RegExp) => assignments.filter((a) => pattern.test(text(a.role))).map((a) => text(a.personnel)).filter(Boolean).join(' / ');
  const row = /row[\s,]*(\d+)/i.exec(fieldName);
  const index = row ? Number(row[1]) - 1 : /_(\d+)$/.test(fieldName) ? Number(/_(\d+)$/.exec(fieldName)![1]) - 1 : 0;
  const a = assignments[index];
  const summary = assignments.map((a) => [a.role, a.personnel, a.unit, a.responsibility, a.locationStatus, a.status].map(text).filter(Boolean).join(' | ')).join('\n');
  if (formId === '209') {
    if (n.startsWith('4incidentcommanders')) return [incident.commanderName, incident.agencyName].map(text).filter(Boolean).join(' | ');
    if (n === '16state') return text(incident.state);
    if (n === '17countyparishborough') return text(incident.county);
    if (n === '18city') return text(incident.city);
    if (n === '22longitude') return text(incident.longitude);
    if (n === '22latitude') return text(incident.latitude);
    if (n.startsWith('25shortlocation')) return [incident.facilityName, incident.address, incident.city, incident.state].map(text).filter(Boolean).join(', ');
    if (n.startsWith('28significantevents')) return incidentActivity(incident).map((event) => `${event.time} | ${event.detail}`).join('\n');
    if (n === 'fromdatetime') return [incident.startDate, incident.startTime].map(text).filter(Boolean).join(' ');
    if (n === 'todatetime') return [incident.completedDate, incident.completedTime].map(text).filter(Boolean).join(' ');
    if (n.startsWith('29primarymaterials')) return [incident.chemicalName, incident.casNumber, incident.unNumber, incident.quantity, incident.containerType].map(text).filter(Boolean).join(' | ');
  }
  if (formId === '206' && /^namerow/.test(n)) {
    const medical = assignments.filter((a) => /medical|rehab|ems/i.test(text(a.role)))[index];
    return text(medical?.unit || medical?.personnel);
  }
  if (formId === '206' && /^locationrow\d+$/.test(n)) return text(assignments.filter((a) => /medical|rehab|ems/i.test(text(a.role)))[index]?.locationStatus);
  if (formId === '206' && /^contactnumbersfrequencyrow\d+$/.test(n)) return text(assignments.filter((a) => /medical|rehab|ems/i.test(text(a.role)))[index]?.contact);
  if (formId === '206' && n === 'specialmedicalemergencyprocedures' && incident.medicalPlan) return text(incident.medicalPlan);
  if (formId === '205') {
    if (/^channelnametrunkedradiosystemtalkgrouprow/.test(n)) return text(a?.radioChannel);
    if (/^assignmentrow/.test(n)) return text(a?.unit);
    if (/^functionrow/.test(n)) return text(a?.role);
    if (/^remarksrow/.test(n) && index === 0) return text(incident.communications);
  }
  if (formId === '215' && /^workassignment\d+$/.test(n)) return [a?.role, a?.responsibility].map(text).filter(Boolean).join(' | ');
  if (formId === '215' && /^reportinglocation\d+$/.test(n)) return text(a?.locationStatus);
  if (formId === '215' && /^6resources\d+$/.test(n)) return summary;
  if (/signature/.test(n)) return ''; // No automatic signatures or approvals.
  if (/^(?:\d+)?preparedbyname\d*$/.test(n) || (formId === '214' && n === '3name')) return text(incident.preparedBy || incident.commanderName);
  if (/^positiontitle\d*$/.test(n) || (formId === '214' && n === '4icsposition')) return text(incident.preparedByPosition);
  if (formId === '214' && n === '5homeagencyandunit') return text(incident.agencyName);
  if (/^(?:\d+)?dateprepared$/.test(n) || n === 'date') return text(incident.startDate);
  if (n === 'time') return text(incident.startTime);
  if (/^datetime\d*$/.test(n) || n === '2datetimeprepared') return [incident.startDate, incident.startTime].map(text).filter(Boolean).join(' ');
  if (formId === '201' && n === '7currentandplannedobjectives') return text(incident.objectives);
  if (formId === '202' && n === '4operationalperiodcommandemphasis') return text(incident.operationalMode);
  if (/^incidentcommanders$|^icucs$|^5incidentcommander$/.test(n)) return text(incident.commanderName) || role(/^(incident commander|ic|unified command)$/i);
  if (/safetyofficer/.test(n)) return role(/safety/i);
  if (/liaisonofficer/.test(n)) return role(/liaison/i);
  if (/publicinfo(?:rmation)?officer/.test(n)) return role(/public information|pio/i);
  if (/^(?:planning|operations|logistics|financeadministration|financeadminsitration)sectionchief\d*$/.test(n)) {
    const section = n.replace(/^financeadminsitration/, 'finance').replace(/sectionchief\d*$/, '');
    return role(new RegExp(section === 'financeadministration' ? 'finance' : section, 'i'));
  }
  if (n === '6hmgroupsupervisor') return role(/hazmat.*(?:group|supervisor)|hm group/i);
  if (n === '9entryleader') return role(/entry/i);
  if (n === '12decontaminationleader') return role(/decon/i);
  if (formId === '203' && n.startsWith('agencyorganizationrow')) return text(a?.unit);
  if (formId === '203' && n.startsWith('namerow')) return [a?.personnel, a?.role].map(text).filter(Boolean).join(' | ');
  if (formId === '201' && /^resourcerow/.test(n)) return text(a?.role);
  if (/^resourceidentifierrow/.test(n)) return text(a?.unit);
  if (/^leaderrow/.test(n)) return text(a?.personnel);
  if (/^numberofpersonsrow/.test(n)) return text(a?.crewSize || a?.personnelCount); // A team is not automatically one person.
  if (/^contactegphonepager/.test(n)) return text(a?.contact || a?.radioChannel);
  if (/^reportinglocationspecialequipment|^noteslocationassignmentstatus/.test(n)) return [a?.responsibility, a?.locationStatus, a?.status].map(text).filter(Boolean).join(' | ');
  if (formId === '214' && /^namerow/.test(n)) return text(a?.personnel);
  if (formId === '214' && /^icspositionrow/.test(n)) return text(a?.role);
  if (formId === '214' && /^homeagencyandunitrow/.test(n)) return text(a?.unit);
  if (formId === '205A' && /^incidentassignedpositionrow/.test(n)) return text(a?.role);
  if (formId === '205A' && /^namealphabetizedrow/.test(n)) return text(a?.personnel);
  if (formId === '205A' && /^methodsofcontact/.test(n)) return text(a?.contact || a?.radioChannel);
  if ((formId === '201' && /^(?:time|actions)row/.test(n)) || (formId === '214' && /^(?:datetime|notableactivities)row/.test(n))) {
    // FEMA ICS 214 page 2 repeats Row 1..24 with a _2 suffix.
    const offset = formId === '214' && /_2$/.test(fieldName) ? 24 : 0;
    const activity = incidentActivity(incident)[index + offset];
    if (/^(?:datetime|time)row/.test(n)) {
      const timestamp = activity?.time || '';
      const parsed = new Date(timestamp);
      // Short UTC timestamp fits FEMA's narrow log column; full ISO time stays
      // in the attached incident record.
      return Number.isNaN(parsed.getTime()) ? timestamp : `${parsed.toISOString().slice(5, 10).replace('-', '/')} ${parsed.toISOString().slice(11, 16)}Z`;
    }
    return activity?.detail || '';
  }
  return undefined;
}

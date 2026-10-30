/* Concise report facts. This module never infers a completed tactic from guidance. */
(() => {
  const text = (value) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  const known = (value) => {
    const result = text(value);
    return /^(?:unknown(?:\s*\/.*)?|no current data exists|not (?:specified|available)|location not set|n\/a)$/i.test(result) ? '' : result;
  };
  const join = (values, separator = ', ') => [...new Set(values.map(known).filter(Boolean))].join(separator);
  const manual = (incident, field, fallback) => Object.prototype.hasOwnProperty.call(incident, field) ? text(incident[field]) : fallback;
  function buildIncidentReportModel(incident, currentPlume) {
    const location = join([incident.facilityName, incident.address, incident.city, incident.state, incident.zip]);
    const started = join([incident.startDate, incident.startTime], ' ');
    const ended = join([incident.completedDate, incident.completedTime], ' ');
    const chemical = known(incident.chemicalName);
    const brief = chemical ? `The reported incident involved ${chemical}${known(incident.quantity) ? `; recorded quantity / rate: ${known(incident.quantity)}` : ''}.` : '';
    const tasks = incident.operationalChecklist?.tasks || [];
    const confirmed = tasks.filter((item) => item.status === 'Complete').map((item) => known(item.label || item.evidence)).filter(Boolean);
    const response = confirmed.length ? `Recorded completed actions: ${join(confirmed, '; ')}.` : '';
    const outcome = incident.status === 'Completed' ? `The incident was closed${ended ? ` on ${ended}` : ''}.` : 'The incident remains open.';
    const plume = currentPlume?.plumeResult || currentPlume;
    const output = plume?.output || currentPlume?.plumeOutput || {};
    const zones = (output.threatZones || []).map((zone) => zone.properties || zone).filter(Boolean).map((zone) => ({
      name: known(zone.label || zone.zoneLabel || zone.name) || (zone.threatRank ? `AEGL-${zone.threatRank}` : 'Threat zone'),
      distance: Number.isFinite(Number(zone.maxDownwindM)) && zone.maxDownwindM != null ? `${Math.round(Number(zone.maxDownwindM))} m${zone.rangeTruncated ? ' (at least)' : ''}` : '',
      threshold: zone.threshold != null || plume?.endpoint?.value?.[`aegl${zone.thresholdLevel || zone.threatRank}`] != null ? join([zone.threshold ?? plume?.endpoint?.value?.[`aegl${zone.thresholdLevel || zone.threatRank}`], zone.units || plume?.endpoint?.units], ' ') : '',
    }));
    return {
      title: known(incident.incidentName) || 'Incident Report', status: text(incident.status), location, started, ended,
      incidentNumber: known(incident.incidentNumber), chemical,
      identifiers: join([incident.casNumber && `CAS ${incident.casNumber}`, incident.unNumber && `UN ${incident.unNumber}`], ' · '),
      brief: manual(incident, 'reportNarrative', brief), response: manual(incident, 'reportResponse', response),
      outcome: manual(incident, 'reportOutcome', outcome), notes: manual(incident, 'reportAdditionalNotes', known(incident.notes)),
      threatNotes: text(incident.reportThreatZoneNotes), weather: known(incident.weather),
      plumeSummary: currentPlume ? known(output.resultSummary || plume?.textSummary || incident.plumeSummary?.summary) : '',
      plumeTime: currentPlume ? text(plume?.generatedAt || currentPlume?.createdAt || incident.plumeUpdatedAt) : '',
      zones, preparedBy: known(incident.preparedBy), updatedAt: text(incident.reportUpdatedAt || incident.updatedAt),
    };
  }
  window.HazMatIQ ||= {};
  window.HazMatIQ.buildIncidentReportModel = buildIncidentReportModel;
})();

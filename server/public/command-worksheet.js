/* Incident-owned tactical worksheet. No second incident or assignment store. */
(() => {
  const root = document.getElementById('command-tactical-worksheet');
  if (!root) return;
  const api = () => window.HazMatIQ?.incidentCommandLegacy;
  const context = () => api()?.getWorksheetContext?.() || {};
  const roleNames = ['Incident Commander', 'Safety Officer', 'Liaison Officer', 'Public Information Officer', 'Operations Section Chief', 'Planning Section Chief', 'Logistics Section Chief', 'Finance Section Chief', 'HazMat Group Supervisor', 'Entry Team Leader', 'Decon Group Supervisor', 'Medical / Rehab'];
  const roleKey = (role) => {
    const key = String(role || '').toLowerCase().replace(/section chief|officer|group supervisor|team leader/g, '').replace(/[^a-z]/g, '');
    return ({ ic: 'incidentcommander', unifiedcommand: 'incidentcommander', hazmatgroup: 'hazmat', entryteam: 'entry', deconteam: 'decon', decongroup: 'decon', medical: 'medicalrehab', rehab: 'medicalrehab', financeadministration: 'finance' })[key] || key;
  };
  const findRole = (assignments, role) => (assignments || []).find((item) => roleKey(item.role) === roleKey(role));
  const validCoordinate = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  let activeTab = 'overview';
  let incidentId = '';
  let map = null;
  let mapIncidentId = '';
  let mapKey = '';
  let mapMarkers = [];
  let frame = 0;
  const fields = new Map();
  const roles = new Map();
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const feedback = node('p', 'worksheet-save-status', 'Entries save to this incident.');
  feedback.setAttribute('role', 'status');
  function saved(ok, message = 'Saved to this incident · Command, Guidance, and ICS drafts updated.') {
    feedback.textContent = ok ? message : 'Could not save. Keep this entry and retry.';
    feedback.dataset.state = ok ? 'saved' : 'error';
  }
  function card(title, width = 'wide', source = '') {
    const section = node('section', `worksheet-card worksheet-${width}`);
    const header = node('header'); header.append(node('h2', '', title));
    if (source) header.append(node('small', 'worksheet-source', source));
    section.append(header); return section;
  }
  function autosave(input, callback) {
    let timer = 0;
    let editingIncident = '';
    const flush = () => {
      window.clearTimeout(timer);
      if (editingIncident && editingIncident !== context().incident?.incidentId) return;
      callback();
      delete input.dataset.dirty;
    };
    input.addEventListener('input', () => {
      input.dataset.dirty = 'true';
      editingIncident = context().incident?.incidentId || '';
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 400);
    });
    input.addEventListener('change', flush);
  }
  function field(container, labelText, key, { readonly = false, type = 'text', multiline = false } = {}) {
    const label = node('label', 'worksheet-field', labelText);
    const input = node(multiline ? 'textarea' : 'input');
    input.id = `worksheet-${key}`;
    if (multiline) input.rows = 3; else input.type = type;
    input.readOnly = readonly;
    if (type === 'number') { input.min = '0'; input.step = '1'; }
    input.placeholder = readonly ? 'Not recorded' : 'Enter when known';
    autosave(input, () => {
      if (!input.checkValidity()) { input.reportValidity(); return; }
      saved(Boolean(window.HazMatIQ.updateIncidentField?.(key, input.value.trim())));
    });
    label.append(input); container.append(label); fields.set(key, input); return input;
  }
  function navigate(page) { api()?.showView?.(page, { sourcePage: 'incident', incidentId: context().incident?.incidentId }); }
  function action(text, callback) {
    const button = node('button', 'worksheet-action', text); button.type = 'button'; button.addEventListener('click', callback); return button;
  }
  const title = node('header', 'worksheet-heading');
  const copy = node('div'); copy.append(node('p', 'worksheet-kicker', 'COMMAND WORKSHEET'), node('h2', '', 'HazMat Tactical Worksheet'));
  const links = node('div', 'worksheet-actions');
  links.append(action('Response Guide', () => document.querySelector('#incident [data-command-view="guided-response"]')?.click()), action('ICS Forms / IAP', () => navigate('report')));
  title.append(copy, links); root.append(title, feedback);
  const grid = node('div', 'worksheet-grid'); root.append(grid);
  const info = card('Incident Information', 'full', 'Incident Brief');
  const infoFields = node('div', 'worksheet-fields');
  [['Incident Name', 'incidentName'], ['Run / Incident #', 'incidentNumber'], ['Address / Area', 'address'], ['Date / Opened', 'startedAt'], ['Command', 'commanderName'], ['Strategy', 'operationalMode'], ['Operational Period Start', 'operationalPeriodStart'], ['Operational Period End', 'operationalPeriodEnd'], ['Prepared By / Report Author', 'preparedBy'], ['ICS Position / Title', 'preparedByPosition']].forEach(([label, key]) => field(infoFields, label, key, { readonly: ['startedAt', 'commanderName', 'operationalMode'].includes(key), type: key.startsWith('operationalPeriod') ? 'datetime-local' : 'text' }));
  info.append(infoFields); grid.append(info);
  const chemical = card('Chemical / Release', 'wide', 'Hazard ID + Incident');
  const chemFields = node('div', 'worksheet-fields');
  [['Chemical', 'chemicalName'], ['UN / NA', 'unNumber'], ['Container Type', 'containerType'], ['Container Size', 'containerSize'], ['Amount Released', 'amountReleased'], ['Amount Remaining', 'amountRemaining'], ['Quantity Units', 'releaseQuantityUnit'], ['Patients', 'patientCount'], ['Responsible Party', 'responsibleParty']].forEach(([label, key], index) => field(chemFields, label, key, { readonly: index < 4, type: key === 'patientCount' ? 'number' : 'text' }));
  chemical.append(chemFields); grid.append(chemical);
  const weather = card('Weather Log', 'narrow', 'Timestamped Incident Observations');
  const weatherBody = node('div', 'worksheet-weather'); weather.append(weatherBody); grid.append(weather);
  const notes = card('Command Notes', 'full', 'Shared Incident Notes'); field(notes, 'Notes / Observations', 'notes', { multiline: true }); grid.append(notes);
  const resources = card('Resources & Assignments', 'wide', 'Shared with Command, Guidance, Live Map, and ICS');
  const editor = node('div', 'worksheet-assignment-editor'); editor.id = 'worksheet-assignment-editor';
  resources.append(action('+ Add Worksheet Resource', () => {
    const current = context().incident;
    if (current) api().renderIncidentAssignmentEditor({ ...current, __editingAssignment: { status: 'Planned', phaseId: 'zones-resources' } }, editor);
  }), editor); grid.append(resources);
  const staging = card('Staging / Available / Rehab', 'narrow', 'Recorded Resource Locations & Status');
  const stagingBody = node('div'); staging.append(stagingBody); grid.append(staging);
  const progress = card('Tactical Checklist', 'wide', 'Shared Response Guide Progress');
  const checksBody = node('div', 'worksheet-check-list');
  const phaseDetails = node('details', 'worksheet-response-progress'); phaseDetails.append(node('summary', '', 'Response Guide Phase Progress'));
  const phaseBody = node('div', 'worksheet-phase-list'); phaseDetails.append(phaseBody); progress.append(checksBody, phaseDetails); grid.append(progress);
  const objectives = card('Incident Objectives', 'narrow', 'ICS 201 / 202'); field(objectives, 'Command Objectives', 'objectives', { multiline: true }); grid.append(objectives);
  const org = card('Command Organization', 'full', 'Names Save Directly to Shared Assignments & ICS 201 / 203 / 214');
  const chart = node('div', 'worksheet-org-chart');
  roleNames.forEach((role, index) => {
    const label = node('label', `worksheet-role worksheet-role-tier-${index === 0 ? 0 : index < 4 ? 1 : index < 8 ? 2 : 3}`);
    label.append(node('strong', '', role));
    const input = node('input'); input.id = `worksheet-role-${index}`; input.type = 'text'; input.placeholder = 'Unassigned'; input.setAttribute('aria-label', `${role} name`);
    autosave(input, () => {
      const { incident, assignments } = context();
      if (!incident) return saved(false);
      const existing = findRole(assignments, role);
      const personnel = input.value.trim();
      if (!personnel) {
        const result = existing ? api().removeIncidentAssignment(existing.assignmentId, existing.phaseId) : role === 'Incident Commander' ? window.HazMatIQ.updateIncidentField('commanderName', '') : { ok: true };
        saved(Boolean(result?.ok || result?.incidentId)); return;
      }
      const result = api().persistIncidentAssignment({
        ...existing, assignmentId: existing?.assignmentId || `command-role-${incident.incidentId}-${roleKey(role)}`,
        kind: 'command-role', role, personnel, unit: existing?.unit || '',
        responsibility: existing?.responsibility || role,
        phaseId: existing?.phaseId || 'identify-isolate-notify', status: 'Confirmed',
      }, existing?.phaseId);
      saved(Boolean(result?.ok));
    });
    label.append(input); chart.append(label); roles.set(role, input);
  });
  org.append(chart, action('Open ICS 203 Organization Assignment List', () => { const incident = context().incident; if (!incident) return; navigate('report'); void api().openIncidentIcsForm(incident.incidentId, '203'); })); grid.append(org);
  const live = card('Live Map', 'wide', 'Same Incident Location, Placed Resources, and Saved Plume');
  const mapElement = node('div', 'worksheet-map'); mapElement.id = 'worksheet-live-map'; mapElement.setAttribute('aria-label', 'Incident Live Map preview');
  const mapStatus = node('p', 'worksheet-map-status');
  live.append(mapElement, mapStatus, action('Open Live Map', () => navigate('map'))); grid.append(live);
  const comms = card('Communications', 'narrow', 'ICS 204 / 205 / 205A');
  [['Command Channel', 'commandChannel'], ['Tactical Channel', 'tacticalChannel'], ['Medical / Decon Channel', 'medicalChannel']].forEach(([label, key]) => field(comms, label, key));
  field(comms, 'Communications Plan', 'communications', { multiline: true });
  field(comms, 'Medical / Rehab Plan', 'medicalPlan', { multiline: true }); grid.append(comms);
  function table(container, headers, rows, empty) {
    container.replaceChildren();
    if (!rows.length) { container.append(node('p', '', empty)); return; }
    const table = node('table'); const head = node('thead'); const tr = node('tr');
    headers.forEach((label) => tr.append(node('th', '', label))); head.append(tr); table.append(head);
    const body = node('tbody'); rows.forEach((row) => { const tr = node('tr'); row.forEach((value) => tr.append(node('td', '', value ?? '—'))); body.append(tr); }); table.append(body); container.append(table);
  }
  function destroyMap() {
    mapMarkers.forEach((marker) => marker.remove()); mapMarkers = [];
    map?.remove(); map = null; mapIncidentId = ''; mapKey = '';
  }
  function renderMap(ctx) {
    if (activeTab !== 'worksheet') return;
    const incident = ctx.incident;
    const points = (ctx.assignments || []).filter((a) => validCoordinate(a.latitude) && validCoordinate(a.longitude)).map((a) => ({ name: a.personnel, lat: a.latitude, lng: a.longitude, color: '#55cf8b' }));
    (ctx.map?.markers || []).filter((m) => ctx.map.activeLayers?.[m.layer] !== false && validCoordinate(m.lat) && validCoordinate(m.lng)).forEach((m) => points.push({ ...m, color: m.layer === 'icp' ? '#ffd143' : '#8acbff' }));
    if (validCoordinate(incident.latitude) && validCoordinate(incident.longitude)) points.unshift({ name: incident.incidentName, lat: incident.latitude, lng: incident.longitude, color: '#ff5361' });
    if (mapIncidentId && mapIncidentId !== incident.incidentId) destroyMap();
    if (!window.maplibregl || !points.length) { if (map) destroyMap(); mapStatus.textContent = 'Set an incident location or place a resource on Live Map to show this incident.'; return; }
    if (!map) {
      try {
        map = new window.maplibregl.Map({ container: mapElement, style: window.HazMatIQ.mapInfrastructure.streetStyle, center: [Number(points[0].lng), Number(points[0].lat)], zoom: 14, attributionControl: true });
        mapIncidentId = incident.incidentId;
        map.on('load', () => { mapKey = ''; renderMap(context()); });
        map.on('error', () => { mapStatus.textContent = 'Map imagery is unavailable. Incident data is saved; Open Live Map to retry.'; });
      } catch { mapStatus.textContent = 'Map unavailable in this browser. Open Live Map to view the incident.'; return; }
    }
    map.resize();
    if (!map.isStyleLoaded()) return;
    const geometry = ctx.plume?.output?.geoJson || ctx.plume?.output?.geometry || ctx.plume?.plumeOutput?.geometry;
    const key = JSON.stringify([points, geometry]); if (key === mapKey) return; mapKey = key;
    mapMarkers.forEach((marker) => marker.remove());
    mapMarkers = points.map((point) => {
      const element = node('div', 'worksheet-map-marker'); element.style.background = point.color; element.title = point.name || 'Resource';
      return new window.maplibregl.Marker({ element }).setLngLat([Number(point.lng), Number(point.lat)]).addTo(map);
    });
    if (geometry?.type === 'FeatureCollection') {
      const source = map.getSource('worksheet-plume');
      if (source) source.setData(geometry);
      else { map.addSource('worksheet-plume', { type: 'geojson', data: geometry }); map.addLayer({ id: 'worksheet-plume', type: 'fill', source: 'worksheet-plume', paint: { 'fill-color': ['match', ['to-number', ['coalesce', ['get', 'threatRank'], ['get', 'thresholdLevel'], ['get', 'zoneRank'], 1]], 3, '#f43f5e', 2, '#fb923c', '#facc15'], 'fill-opacity': .25 } }); }
    } else if (map.getSource('worksheet-plume')) map.getSource('worksheet-plume').setData({ type: 'FeatureCollection', features: [] });
    const bounds = new window.maplibregl.LngLatBounds(); points.forEach((point) => bounds.extend([Number(point.lng), Number(point.lat)]));
    if (points.length > 1) map.fitBounds(bounds, { padding: 45, maxZoom: 15, duration: 0 });
    mapStatus.textContent = `${points.length} located incident / resource markers · Open Live Map for all incident layers.`;
  }
  function render() {
    frame = 0; const ctx = context(); const incident = ctx.incident;
    if (!incident) { destroyMap(); incidentId = ''; fields.forEach((input) => { input.value = ''; }); roles.forEach((input) => { input.value = ''; }); return; }
    const changedIncident = incidentId !== incident.incidentId; incidentId = incident.incidentId;
    if (changedIncident) feedback.textContent = 'Entries save to this incident.';
    fields.forEach((input, key) => { if (changedIncident || (!input.dataset.dirty && document.activeElement !== input)) input.value = key === 'startedAt' ? (incident.startedAt ? new Date(incident.startedAt).toLocaleString() : '') : incident[key] ?? ''; });
    roles.forEach((input, role) => { if (changedIncident || (!input.dataset.dirty && document.activeElement !== input)) input.value = findRole(ctx.assignments, role)?.personnel || (role === 'Incident Commander' ? incident.commanderName || '' : ''); });
    api().renderIncidentAssignmentEditor(incident, editor, changedIncident);
    table(weatherBody, ['Time', 'Temp °F', 'From °', 'MPH', 'Precip'], (incident.weatherObservations?.length ? incident.weatherObservations : (incident.weatherSnapshot ? [incident.weatherSnapshot] : [])).map((weather) => [weather.observedAt ? new Date(weather.observedAt).toLocaleTimeString() : 'Not recorded', weather.temperatureF, weather.windDirDeg, weather.windSpeedMph, weather.precipitationIn]), 'No incident weather observation recorded.');
    table(stagingBody, ['Resource', 'Assignment / Location', 'Status'], (ctx.assignments || []).filter((a) => /staging|available|rehab/i.test([a.role, a.locationStatus, a.status, a.responsibility].join(' '))).map((a) => [a.personnel, a.locationStatus || 'Location not set', a.status]), 'No staging, available, or rehab assignments recorded.');
    checksBody.replaceChildren();
    (ctx.checks || []).forEach((check) => {
      const label = node('label', 'worksheet-check'); const input = node('input'); input.type = 'checkbox'; input.checked = check.confirmed;
      input.addEventListener('change', () => saved(Boolean(api().persistGuidedActionCheck(check.id, input.checked))));
      label.append(input, node('span', '', check.label)); checksBody.append(label);
    });
    phaseBody.replaceChildren();
    (ctx.phases || []).forEach((phase) => {
      const label = node('label', 'worksheet-phase', `${phase.number}. ${phase.title}`); const select = node('select'); select.setAttribute('aria-label', `Worksheet phase ${phase.number} status`);
      ['Not Started', 'In Progress', 'Accomplished', 'Needs Reassessment'].forEach((value) => { const option = node('option', '', value); option.value = value; select.append(option); });
      select.value = phase.status; select.addEventListener('change', () => { api().persistGuidedResponsePhaseState(phase.id, { status: select.value }); saved(true); }); label.append(select); phaseBody.append(label);
    });
    renderMap(ctx);
  }
  function schedule() { if (!frame) frame = window.requestAnimationFrame(render); }
  function switchTab(tab) {
    activeTab = tab;
    document.getElementById('command-overview-panel').hidden = tab !== 'overview';
    document.getElementById('command-worksheet-panel').hidden = tab !== 'worksheet';
    document.querySelectorAll('[data-command-workspace]').forEach((button) => { const selected = button.dataset.commandWorkspace === tab; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
    if (tab === 'overview') destroyMap();
    render();
  }
  const tabs = [...document.querySelectorAll('[data-command-workspace]')];
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => switchTab(button.dataset.commandWorkspace));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); switchTab(tabs[next].dataset.commandWorkspace);
    });
  });
  ['hazmatiq:incident-record-saved', 'hazmatiq:incident-command-updated', 'hazmatiq:guided-phase-updated', 'hazmatiq:incident-assignment-updated', 'hazmatiq:live-map-updated'].forEach((event) => window.addEventListener(event, schedule));
  window.addEventListener('resize', () => { if (activeTab === 'worksheet') map?.resize(); });
  window.HazMatIQ.commandWorksheet = { render, roleKey, findRole, switchTab };
  render();
})();

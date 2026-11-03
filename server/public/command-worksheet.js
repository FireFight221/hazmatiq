/* Incident-owned tactical worksheet. No second incident or assignment store. */
(() => {
  const root = document.getElementById('command-tactical-worksheet');
  if (!root) return;
  const api = () => window.HazMatIQ?.incidentCommandLegacy;
  const context = () => api()?.getWorksheetContext?.() || {};
  const organizationRoleDefinitions = [
    { roleId: 'incident-command', role: 'Incident Commander', section: 'incident-command', parentRoleId: '', accent: 'gold', level: 0 },
    { roleId: 'safety-officer', role: 'Safety Officer', section: 'command-staff', parentRoleId: 'incident-command', accent: 'gold', level: 1 },
    { roleId: 'liaison-officer', role: 'Liaison Officer', section: 'command-staff', parentRoleId: 'incident-command', accent: 'gold', level: 1 },
    { roleId: 'public-information-officer', role: 'Public Information Officer', section: 'command-staff', parentRoleId: 'incident-command', accent: 'gold', level: 1 },
    { roleId: 'operations-chief', role: 'Operations Section Chief', section: 'operations', parentRoleId: 'incident-command', accent: 'red', level: 1 },
    { roleId: 'planning-chief', role: 'Planning Section Chief', section: 'planning', parentRoleId: 'incident-command', accent: 'blue', level: 1 },
    { roleId: 'logistics-chief', role: 'Logistics Section Chief', section: 'logistics', parentRoleId: 'incident-command', accent: 'white', level: 1 },
    { roleId: 'finance-chief', role: 'Finance Section Chief', section: 'finance', parentRoleId: 'incident-command', accent: 'green', level: 1 },
    { roleId: 'hazmat-group', role: 'HazMat Group Supervisor', section: 'operations', parentRoleId: 'operations-chief', accent: 'red', level: 2 },
    { roleId: 'entry-team', role: 'Entry Team Leader', section: 'operations', parentRoleId: 'operations-chief', accent: 'red', level: 2 },
    { roleId: 'decon-group', role: 'Decon Group Supervisor', section: 'operations', parentRoleId: 'operations-chief', accent: 'red', level: 2 },
    { roleId: 'fire-ems', role: 'Fire / EMS Operations', section: 'operations', parentRoleId: 'operations-chief', accent: 'red', level: 2 },
    { roleId: 'responder-medical-rehab', role: 'Medical / Rehab', section: 'logistics', parentRoleId: 'logistics-chief', accent: 'white', level: 2 },
    { roleId: 'staging', role: 'Staging', section: 'logistics', parentRoleId: 'logistics-chief', accent: 'white', level: 2, staging: true },
  ];
  const roleNames = organizationRoleDefinitions.map((definition) => definition.role);
  const roleKey = (role) => {
    const key = String(role || '').toLowerCase().replace(/section chief|officer|group supervisor|team leader/g, '').replace(/[^a-z]/g, '');
    return ({ ic: 'incidentcommander', incidentcommand: 'incidentcommander', unifiedcommand: 'incidentcommander', hazmatgroup: 'hazmat', entryteam: 'entry', deconteam: 'decon', decongroup: 'decon', medical: 'medicalrehab', medicalrehab: 'medicalrehab', respondermedicalrehab: 'medicalrehab', rehab: 'medicalrehab', fireemsoperations: 'fireems', fireems: 'fireems', stagingmanager: 'staging', financeadministration: 'finance' })[key] || key;
  };
  const findRole = (assignments, role) => (assignments || []).find((item) => roleKey(item.role) === roleKey(role));
  const organizationDefinition = (roleId) => organizationRoleDefinitions.find((definition) => definition.roleId === roleId);
  const organizationMetadata = (assignment) => {
    const explicitId = String(assignment?.organizationRoleId || assignment?.roleId || '').trim();
    const explicit = organizationDefinition(explicitId);
    if (explicit) return explicit;
    const key = roleKey(assignment?.role);
    const direct = organizationRoleDefinitions.find((definition) => roleKey(definition.role) === key);
    if (direct) return direct;
    const explicitSection = String(assignment?.organizationSection || assignment?.section || '').toLowerCase();
    const explicitParent = String(assignment?.parentRoleId || '').trim();
    if (explicitParent === 'operations-chief' || explicitSection === 'operations') return { roleId: explicitId || 'operations-assignment', role: assignment?.role || 'Operations assignment', section: 'operations', parentRoleId: 'operations-chief', accent: 'red', level: 2 };
    if (explicitParent === 'planning-chief' || explicitSection === 'planning') return { roleId: explicitId || 'planning-assignment', role: assignment?.role || 'Planning assignment', section: 'planning', parentRoleId: 'planning-chief', accent: 'blue', level: 2 };
    if (explicitParent === 'logistics-chief' || explicitSection === 'logistics') return { roleId: explicitId || 'logistics-assignment', role: assignment?.role || 'Logistics assignment', section: 'logistics', parentRoleId: 'logistics-chief', accent: 'white', level: 2 };
    if (explicitParent === 'finance-chief' || explicitSection === 'finance') return { roleId: explicitId || 'finance-assignment', role: assignment?.role || 'Finance assignment', section: 'finance', parentRoleId: 'finance-chief', accent: 'green', level: 2 };
    const text = String(assignment?.role || '').toLowerCase();
    if (/responder.*medical|medical.*rehab|rehab/.test(text)) return organizationDefinition('responder-medical-rehab');
    if (/patient|fire\s*\/?\s*ems|\bems\b/.test(text)) return { roleId: 'patient-care-ems', role: assignment?.role || 'Patient Care / EMS', section: 'operations', parentRoleId: 'operations-chief', accent: 'red', level: 2 };
    if (/hazmat/.test(text)) return organizationDefinition('hazmat-group');
    if (/entry/.test(text)) return organizationDefinition('entry-team');
    if (/decon|decontamination/.test(text)) return organizationDefinition('decon-group');
    if (/staging/.test(text)) return organizationDefinition('staging');
    return null;
  };
  const findOrganizationAssignment = (assignments, definition) => (assignments || []).find((assignment) => organizationMetadata(assignment)?.roleId === definition.roleId);
  const validCoordinate = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  let activeTab = 'overview';
  let incidentId = '';
  let map = null;
  let mapIncidentId = '';
  let mapKey = '';
  let mapMarkers = [];
  let frame = 0;
  let mapResizeObserver = null;
  let organizationResizeObserver = null;
  let organizationRenderKey = '';
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
  function card(title, width = 'wide', source = '', area = '') {
    const section = node('section', `worksheet-card worksheet-${width}`);
    if (area) section.classList.add(`worksheet-${area}`);
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
    const period = key === 'operationalPeriodStart' || key === 'operationalPeriodEnd';
    const label = node(period ? 'div' : 'label', 'worksheet-field', period ? undefined : labelText);
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
    if (period) {
      const caption = node('label', 'worksheet-date-label', labelText); caption.htmlFor = input.id;
      const controls = node('div', 'worksheet-date-control');
      const button = action(key === 'operationalPeriodStart' ? 'Current' : '', () => {
        if (!context().incident?.incidentId) { saved(false); return; }
        if (key === 'operationalPeriodStart') {
          const now = new Date();
          const pad = (value) => String(value).padStart(2, '0');
          input.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          input.focus();
          try { input.showPicker?.(); } catch { /* Native field remains editable if the browser blocks its picker. */ }
        }
      });
      button.classList.add('worksheet-date-button');
      button.setAttribute('aria-label', key === 'operationalPeriodStart' ? 'Set operational period start to current date and time' : 'Choose operational period end date and time');
      if (key === 'operationalPeriodEnd') {
        button.title = 'Choose end date and time';
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        outline.setAttribute('d', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM7 2v5M17 2v5M3 10h18M7 14h2M12 14h2M7 17h2');
        icon.append(outline); button.append(icon);
      }
      controls.append(input, button); label.append(caption, controls);
    } else label.append(input);
    container.append(label); fields.set(key, input); return input;
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
  const info = card('Incident Information', 'full', 'Incident Brief', 'incident-information');
  const infoFields = node('div', 'worksheet-fields');
  const periodFields = node('div', 'worksheet-period-fields');
  [['Incident Name', 'incidentName'], ['Run / Incident #', 'incidentNumber'], ['Address / Area', 'address'], ['Date / Opened', 'startedAt'], ['Command', 'commanderName'], ['Strategy', 'operationalMode'], ['Operational Period Start', 'operationalPeriodStart'], ['Operational Period End', 'operationalPeriodEnd'], ['Prepared By / Report Author', 'preparedBy'], ['ICS Position / Title', 'preparedByPosition']].forEach(([label, key]) => {
    field(key.startsWith('operationalPeriod') ? periodFields : infoFields, label, key, { readonly: ['startedAt', 'commanderName', 'operationalMode'].includes(key), type: key.startsWith('operationalPeriod') ? 'datetime-local' : 'text' });
    if (key === 'operationalPeriodEnd') infoFields.append(periodFields);
  });
  info.append(infoFields); grid.append(info);
  const chemical = card('Chemical / Release', 'wide', 'Hazard ID + Incident', 'chemical-release');
  const chemFields = node('div', 'worksheet-fields');
  [['Chemical', 'chemicalName'], ['UN / NA', 'unNumber'], ['Container Type', 'containerType'], ['Container Size', 'containerSize'], ['Amount Released', 'amountReleased'], ['Amount Remaining', 'amountRemaining'], ['Quantity Units', 'releaseQuantityUnit'], ['Patients', 'patientCount'], ['Responsible Party', 'responsibleParty']].forEach(([label, key], index) => field(chemFields, label, key, { readonly: index < 4, type: key === 'patientCount' ? 'number' : 'text' }));
  chemical.append(chemFields); grid.append(chemical);
  const weather = card('Weather Log', 'narrow', 'Timestamped Incident Observations', 'weather-log');
  const weatherBody = node('div', 'worksheet-weather'); weather.append(weatherBody); grid.append(weather);
  const notes = card('Command Notes', 'full', 'Shared Incident Notes', 'command-notes'); field(notes, 'Notes / Observations', 'notes', { multiline: true }); grid.append(notes);
  const resources = card('Resources & Assignments', 'wide', 'Shared with Command, Guidance, Live Map, and ICS', 'resources-assignments');
  const editor = node('div', 'worksheet-assignment-editor'); editor.id = 'worksheet-assignment-editor';
  resources.append(action('Add Assignment', () => {
    const current = context().incident;
    if (current) api().renderIncidentAssignmentEditor({ ...current, __editingAssignment: { status: 'Planned', phaseId: 'zones-resources' } }, editor);
  }), editor); grid.append(resources);
  const staging = card('Staging / Available / Rehab', 'narrow', 'Recorded Resource Locations & Status', 'staging');
  const stagingBody = node('div'); staging.append(stagingBody); grid.append(staging);
  const progress = card('Tactical Checklist', 'wide', 'Shared Response Guide Progress', 'tactical-checklist');
  const checksBody = node('div', 'worksheet-check-list');
  const phaseDetails = node('details', 'worksheet-response-progress'); phaseDetails.append(node('summary', '', 'Response Guide Phase Progress'));
  const phaseBody = node('div', 'worksheet-phase-list'); phaseDetails.append(phaseBody); progress.append(checksBody, phaseDetails); grid.append(progress);
  const objectives = card('Incident Objectives', 'narrow', 'ICS 201 / 202', 'incident-objectives'); field(objectives, 'Command Objectives', 'objectives', { multiline: true }); grid.append(objectives);
  const org = card('Command Organization', 'full', 'Names Save Directly to Shared Assignments & ICS 201 / 203 / 214', 'command-organization');
  const chart = node('div', 'worksheet-org-chart');
  const connectorLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connectorLayer.classList.add('worksheet-org-connectors');
  connectorLayer.setAttribute('aria-hidden', 'true');
  chart.append(connectorLayer);
  function drawOrganizationConnectors() {
    const width = chart.clientWidth;
    const height = chart.clientHeight;
    if (!width || !height) return;
    connectorLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    connectorLayer.setAttribute('width', String(width)); connectorLayer.setAttribute('height', String(height));
    connectorLayer.replaceChildren();
    const chartRect = chart.getBoundingClientRect();
    const cards = [...chart.querySelectorAll('.worksheet-role')];
    cards.forEach((child) => {
      const parentId = child.dataset.parentRoleId;
      if (!parentId) return;
      const parent = cards.find((candidate) => candidate.dataset.cardId === parentId || candidate.dataset.roleId === parentId);
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const childRect = child.getBoundingClientRect();
      const startX = parentRect.left + parentRect.width / 2 - chartRect.left;
      const startY = parentRect.bottom - chartRect.top;
      const endX = childRect.left + childRect.width / 2 - chartRect.left;
      const endY = childRect.top - chartRect.top;
      const middleY = startY + Math.max(8, (endY - startY) / 2);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`);
      path.setAttribute('class', 'worksheet-org-connector');
      connectorLayer.append(path);
    });
  }
  function renderOrganization(ctx) {
    const assignments = Array.isArray(ctx.assignments) ? ctx.assignments : [];
    const renderKey = JSON.stringify([ctx.incident?.incidentId || '', assignments]);
    if (renderKey === organizationRenderKey) { window.requestAnimationFrame(drawOrganizationConnectors); return; }
    organizationRenderKey = renderKey;
    roles.clear(); chart.replaceChildren(connectorLayer);
    const usedAssignmentIds = new Set();
    const cards = organizationRoleDefinitions.map((definition) => {
      const assignment = findOrganizationAssignment(assignments, definition);
      if (assignment?.assignmentId) usedAssignmentIds.add(assignment.assignmentId);
      return { ...definition, assignment, cardId: definition.roleId, editable: true };
    });
    assignments.forEach((assignment) => {
      const definition = organizationMetadata(assignment);
      if (!definition || usedAssignmentIds.has(assignment.assignmentId)) return;
      cards.push({ ...definition, role: assignment.role || definition.role, assignment, cardId: assignment.assignmentId || `${definition.roleId}-assignment`, editable: false, parentRoleId: assignment.parentRoleId || definition.parentRoleId });
      if (assignment.assignmentId) usedAssignmentIds.add(assignment.assignmentId);
    });
    cards.forEach((definition) => {
      const editable = definition.editable;
      const cardElement = node(editable ? 'label' : 'article', `worksheet-role worksheet-role-level-${definition.level} worksheet-role-accent-${definition.accent}`);
      cardElement.dataset.cardId = definition.cardId;
      cardElement.dataset.roleId = definition.roleId;
      cardElement.dataset.section = definition.section;
      cardElement.dataset.parentRoleId = definition.parentRoleId || '';
      cardElement.dataset.assignmentId = definition.assignment?.assignmentId || '';
      const heading = node('strong', '', definition.role);
      cardElement.append(heading);
      if (!editable) {
        const assignment = definition.assignment || {};
        const value = node('span', 'worksheet-role-assignment', [assignment.personnel, assignment.unit, assignment.locationStatus].filter(Boolean).join(' · ') || 'Not assigned');
        cardElement.append(value);
        return chart.append(cardElement);
      }
      const roleFields = node('span', 'worksheet-role-fields');
      const inputControls = {};
      const addRoleField = (labelText, key, placeholder) => {
        const fieldLabel = node('span', 'worksheet-role-field');
        fieldLabel.append(node('span', 'worksheet-role-field-label', labelText));
        const input = node('input'); input.type = 'text'; input.placeholder = placeholder; input.setAttribute('aria-label', `${definition.role} ${labelText}`);
        input.value = definition.assignment?.[key] || '';
        inputControls[key] = input; roles.set(`${definition.roleId}:${key}`, input);
        fieldLabel.append(input); roleFields.append(fieldLabel);
      };
      if (definition.staging) {
        addRoleField('Staging Manager', 'personnel', 'Not assigned');
        addRoleField('Unit / team', 'unit', 'Not recorded');
        addRoleField('Staging location', 'locationStatus', 'Not recorded');
      } else addRoleField('Assigned name', 'personnel', 'Unassigned');
      const saveOrganizationAssignment = () => {
        const { incident, assignments: currentAssignments } = context();
        if (!incident) return saved(false);
        const allCurrentAssignments = [...(Array.isArray(currentAssignments) ? currentAssignments : []), ...(Array.isArray(incident.guidedResponseAssignments) ? incident.guidedResponseAssignments : [])]
          .filter((assignment, index, list) => assignment && (!assignment.assignmentId || list.findIndex((candidate) => candidate?.assignmentId === assignment.assignmentId) === index));
        const existing = findOrganizationAssignment(allCurrentAssignments, definition);
        const values = Object.fromEntries(Object.entries(inputControls).map(([key, input]) => [key, input.value.trim()]));
        const blank = Object.values(values).every((value) => !value);
        if (blank) {
          const result = existing ? api().removeIncidentAssignment(existing.assignmentId, existing.phaseId) : definition.roleId === 'incident-command' ? window.HazMatIQ.updateIncidentField('commanderName', '') : { ok: true };
          saved(Boolean(result?.ok || result?.incidentId)); return;
        }
        const result = api().persistIncidentAssignment({
          ...existing, ...values, assignmentId: existing?.assignmentId || `command-role-${incident.incidentId}-${definition.roleId}`,
          kind: 'command-role', role: existing?.role || definition.role, responsibility: existing?.responsibility || (definition.staging ? 'Staging Manager' : definition.role),
          phaseId: existing?.phaseId || 'identify-isolate-notify', status: 'Confirmed',
          organizationRoleId: definition.roleId, organizationSection: definition.section, parentRoleId: definition.parentRoleId,
        }, existing?.phaseId);
        saved(Boolean(result?.ok));
      };
      Object.values(inputControls).forEach((input) => autosave(input, saveOrganizationAssignment));
      cardElement.append(roleFields); chart.append(cardElement);
    });
    window.requestAnimationFrame(drawOrganizationConnectors);
  }
  renderOrganization(context());
  org.append(chart, action('Open ICS 203 Organization Assignment List', () => { const incident = context().incident; if (!incident) return; navigate('report'); void api().openIncidentIcsForm(incident.incidentId, '203'); })); grid.append(org);
  const live = card('Live Map', 'wide', 'Same Incident Location, Placed Resources, and Saved Plume', 'live-map-card');
  const mapElement = node('div', 'worksheet-map'); mapElement.id = 'worksheet-live-map'; mapElement.setAttribute('aria-label', 'Incident Live Map preview');
  const mapStatus = node('p', 'worksheet-map-status');
  live.append(mapElement, mapStatus, action('Open Live Map', () => navigate('map'))); grid.append(live);
  const comms = card('Communications', 'narrow', 'ICS 204 / 205 / 205A', 'communications');
  [['Command Channel', 'commandChannel'], ['Tactical Channel', 'tacticalChannel'], ['Medical / Decon Channel', 'medicalChannel']].forEach(([label, key]) => field(comms, label, key));
  field(comms, 'Communications Plan', 'communications', { multiline: true });
  field(comms, 'Medical / Rehab Plan', 'medicalPlan', { multiline: true }); grid.append(comms);
  grid.append(info, chemical, org, weather, notes, comms, resources, staging, objectives, progress, live);
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
    (ctx.map?.markers || []).filter((m) => ctx.map.activeLayers?.[m.layer] !== false && validCoordinate(m.lat) && validCoordinate(m.lng)).forEach((m) => points.push({ ...m, color: m.layer === 'icp' ? 'var(--gold)' : '#8acbff' }));
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
    const plumeGeometries = [
      ctx.plume?.output?.geoJson || ctx.plume?.output?.geometry || ctx.plume?.plumeOutput?.geometry,
      ctx.plume?.output?.isolationGeometry || ctx.plume?.output?.isolationOverlay?.geometry,
    ].filter((value) => value?.type === 'FeatureCollection');
    const geometry = plumeGeometries.length
      ? { type: 'FeatureCollection', features: plumeGeometries.flatMap((value) => value.features || []) }
      : null;
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
    if (!incident) { destroyMap(); incidentId = ''; fields.forEach((input) => { input.value = ''; }); renderOrganization(ctx); return; }
    const changedIncident = incidentId !== incident.incidentId; incidentId = incident.incidentId;
    if (changedIncident) { feedback.textContent = 'Entries save to this incident.'; fields.forEach((input) => delete input.dataset.dirty); roles.forEach((input) => delete input.dataset.dirty); }
    fields.forEach((input, key) => { if (changedIncident || (!input.dataset.dirty && document.activeElement !== input)) input.value = key === 'containerSize' ? [incident.containerSize, incident.containerSizeUnit].filter(Boolean).join(' ') : key === 'operationalMode' ? (/offensive|defensive|non.intervention/i.test(incident.operationalMode || '') ? incident.operationalMode : 'Assessment / Not Selected') : key === 'startedAt' ? (incident.startedAt ? new Date(incident.startedAt).toLocaleString() : '') : incident[key] ?? ''; });
    renderOrganization(ctx);
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
    window.requestAnimationFrame(() => map?.resize());
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
  const resizeMap = () => { if (activeTab === 'worksheet') map?.resize(); };
  if (typeof window.ResizeObserver === 'function') {
    mapResizeObserver = new window.ResizeObserver(resizeMap);
    mapResizeObserver.observe(mapElement);
    organizationResizeObserver = new window.ResizeObserver(drawOrganizationConnectors);
    organizationResizeObserver.observe(chart);
  }
  window.addEventListener('resize', () => { resizeMap(); drawOrganizationConnectors(); });
  window.HazMatIQ.commandWorksheet = { render, roleKey, findRole, switchTab };
  render();
})();

const buttons = document.querySelectorAll('.module-btn');
const views = document.querySelectorAll('.view');

const tacticalAlertMessage = document.getElementById('tactical-alert-message');
const notificationWeather = document.getElementById('notification-weather');
const notificationMonitoring = document.getElementById('notification-monitoring');
const notificationUpdated = document.getElementById('notification-updated');

function updateNotificationCenter(update = {}) {
  if (Object.prototype.hasOwnProperty.call(update, 'tactical') && tacticalAlertMessage) {
    tacticalAlertMessage.textContent = update.tactical;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'weather') && notificationWeather) {
    notificationWeather.textContent = update.weather;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'monitoring') && notificationMonitoring) {
    notificationMonitoring.textContent = update.monitoring;
  }

  if (notificationUpdated) {
    const updatedAt = update.timestamp ? new Date(update.timestamp) : new Date();
    const safeUpdatedAt = Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt;
    notificationUpdated.dateTime = safeUpdatedAt.toISOString();
    notificationUpdated.textContent = `Updated ${safeUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

window.HazMatIQ = window.HazMatIQ || {};
window.HazMatIQ.updateNotifications = updateNotificationCenter;

document.addEventListener('hazmatiq:telemetry', (event) => {
  updateNotificationCenter(event.detail || {});
});

const monitorReadingElements = document.querySelectorAll('[data-monitor-reading]');

function syncMonitorNotification() {
  const readingSummary = Array.from(monitorReadingElements)
    .map((element) => `${element.dataset.monitorReading} ${element.textContent.trim()}`)
    .join(' · ');

  if (readingSummary) updateNotificationCenter({ monitoring: readingSummary });
}

if (monitorReadingElements.length) {
  const monitorObserver = new MutationObserver(syncMonitorNotification);
  monitorReadingElements.forEach((element) => {
    monitorObserver.observe(element, { childList: true, characterData: true, subtree: true });
  });
  syncMonitorNotification();
}

const incidentIntakeForm = document.getElementById('incident-intake-form');
const cancelNewIncidentButton = document.getElementById('cancel-new-incident');
const editIncidentButton = document.getElementById('edit-incident-btn');
const incidentFormStatus = document.getElementById('incident-form-status');
const incidentAddressInput = document.getElementById('new-incident-address');
const incidentLatitudeInput = document.getElementById('new-incident-latitude');
const incidentLongitudeInput = document.getElementById('new-incident-longitude');
const incidentAddressSourceInput = document.getElementById('new-incident-address-source');
const incidentAddressSuggestions = document.getElementById('incident-address-suggestions');
const incidentAddressStatus = document.getElementById('incident-address-status');
let activeIncident = null;

const SHELBY_ADDRESS_SERVICE = 'https://maps.shelbyal.com/gisserver/rest/services/LegacyServices/ShelbyALDynamic_EXT/MapServer/10/query';
const addressSuggestionCache = new Map();
let addressSearchTimer;
let addressSearchController;
let addressSuggestions = [];
let activeAddressSuggestion = -1;

function setAddressLookupStatus(message) {
  if (incidentAddressStatus) incidentAddressStatus.textContent = message;
}

function closeAddressSuggestions() {
  if (!incidentAddressSuggestions || !incidentAddressInput) return;
  incidentAddressSuggestions.hidden = true;
  incidentAddressInput.setAttribute('aria-expanded', 'false');
  incidentAddressInput.removeAttribute('aria-activedescendant');
  activeAddressSuggestion = -1;
}

function setActiveAddressSuggestion(index) {
  if (!incidentAddressSuggestions || !incidentAddressInput || !addressSuggestions.length) return;
  activeAddressSuggestion = (index + addressSuggestions.length) % addressSuggestions.length;
  const options = incidentAddressSuggestions.querySelectorAll('.address-suggestion');
  options.forEach((option, optionIndex) => {
    const isActive = optionIndex === activeAddressSuggestion;
    option.classList.toggle('active', isActive);
    option.setAttribute('aria-selected', String(isActive));
    if (isActive) {
      incidentAddressInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });
}

function selectAddressSuggestion(suggestion) {
  if (!incidentAddressInput) return;
  incidentAddressInput.value = suggestion.address;
  if (incidentLatitudeInput) incidentLatitudeInput.value = suggestion.latitude ?? '';
  if (incidentLongitudeInput) incidentLongitudeInput.value = suggestion.longitude ?? '';
  if (incidentAddressSourceInput) incidentAddressSourceInput.value = 'Shelby County GIS';
  closeAddressSuggestions();
  setAddressLookupStatus('Verified address selected from Shelby County GIS.');
  syncIncidentDraft();
}

function renderAddressSuggestions(suggestions) {
  if (!incidentAddressSuggestions || !incidentAddressInput) return;
  addressSuggestions = suggestions;
  incidentAddressSuggestions.innerHTML = '';

  if (!suggestions.length) {
    closeAddressSuggestions();
    setAddressLookupStatus('No matching local addresses found. You can continue entering the address manually.');
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'address-suggestion';
    option.id = `incident-address-option-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    const copy = document.createElement('span');
    const address = document.createElement('strong');
    address.textContent = suggestion.address;
    copy.appendChild(address);
    if (suggestion.context) {
      const context = document.createElement('span');
      context.textContent = suggestion.context;
      copy.appendChild(context);
    }
    option.appendChild(copy);
    option.addEventListener('pointerdown', (event) => event.preventDefault());
    option.addEventListener('click', () => selectAddressSuggestion(suggestion));
    incidentAddressSuggestions.appendChild(option);
  });

  incidentAddressSuggestions.hidden = false;
  incidentAddressInput.setAttribute('aria-expanded', 'true');
  setAddressLookupStatus(`${suggestions.length} address option${suggestions.length === 1 ? '' : 's'} available.`);
}

async function fetchAddressSuggestions(query) {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const cacheKey = normalizedQuery.toLowerCase();
  if (addressSuggestionCache.has(cacheKey)) return addressSuggestionCache.get(cacheKey);

  if (addressSearchController) addressSearchController.abort();
  addressSearchController = new AbortController();
  const escapedQuery = normalizedQuery.replace(/'/g, "''").toUpperCase();
  const matchPattern = /^\d/.test(escapedQuery) ? `${escapedQuery}%` : `%${escapedQuery}%`;
  const parameters = new URLSearchParams({
    where: `UPPER(Full_Address) LIKE '${matchPattern}'`,
    outFields: 'Full_Address,Municipality,USPS_Place,State,Zip5,CommonPlace',
    returnGeometry: 'true',
    outSR: '4326',
    orderByFields: 'Full_Address ASC',
    resultRecordCount: '6',
    f: 'json',
  });

  const response = await fetch(`${SHELBY_ADDRESS_SERVICE}?${parameters}`, {
    signal: addressSearchController.signal,
  });
  if (!response.ok) throw new Error(`Address service returned ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(result.error.message || 'Address lookup failed');

  const uniqueAddresses = new Set();
  const suggestions = (result.features || []).flatMap((feature) => {
    const attributes = feature.attributes || {};
    const address = String(attributes.Full_Address || '').trim();
    if (!address || uniqueAddresses.has(address)) return [];
    uniqueAddresses.add(address);
    const place = attributes.Municipality || attributes.USPS_Place || '';
    const region = [place, attributes.State, attributes.Zip5].filter(Boolean).join(', ');
    return [{
      address,
      context: attributes.CommonPlace || region,
      latitude: feature.geometry?.y,
      longitude: feature.geometry?.x,
    }];
  });

  addressSuggestionCache.set(cacheKey, suggestions);
  return suggestions;
}

async function runAddressSearch(query) {
  setAddressLookupStatus('Searching current local address records…');
  try {
    const suggestions = await fetchAddressSuggestions(query);
    renderAddressSuggestions(suggestions);
  } catch (error) {
    if (error.name === 'AbortError') return;
    closeAddressSuggestions();
    setAddressLookupStatus('Address suggestions are temporarily unavailable. Continue entering the address manually.');
    console.warn('Address autocomplete failed.', error);
  }
}

if (incidentAddressInput) {
  incidentAddressInput.addEventListener('input', () => {
    if (incidentLatitudeInput) incidentLatitudeInput.value = '';
    if (incidentLongitudeInput) incidentLongitudeInput.value = '';
    if (incidentAddressSourceInput) incidentAddressSourceInput.value = '';
    window.clearTimeout(addressSearchTimer);
    const query = incidentAddressInput.value.trim();
    if (query.length < 3) {
      closeAddressSuggestions();
      setAddressLookupStatus('Type at least 3 characters for address suggestions.');
      return;
    }
    addressSearchTimer = window.setTimeout(() => runAddressSearch(query), 350);
  });

  incidentAddressInput.addEventListener('keydown', (event) => {
    if (incidentAddressSuggestions?.hidden || !addressSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveAddressSuggestion(activeAddressSuggestion + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveAddressSuggestion(activeAddressSuggestion - 1);
    } else if (event.key === 'Enter' && activeAddressSuggestion >= 0) {
      event.preventDefault();
      selectAddressSuggestion(addressSuggestions[activeAddressSuggestion]);
    } else if (event.key === 'Escape') {
      closeAddressSuggestions();
    }
  });

  incidentAddressInput.addEventListener('blur', () => {
    window.setTimeout(closeAddressSuggestions, 150);
  });
}

function formatCadTime(dateValue, timeValue, legacyValue) {
  if (legacyValue && !dateValue && !timeValue) {
    const legacyDate = new Date(legacyValue);
    return Number.isNaN(legacyDate.getTime())
      ? legacyValue
      : legacyDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  if (!dateValue && !timeValue) return null;
  if (!dateValue) return timeValue;

  const date = new Date(`${dateValue}T${timeValue || '00:00'}`);
  if (Number.isNaN(date.getTime())) return [dateValue, timeValue].filter(Boolean).join(' ');
  const options = timeValue
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' };
  return date.toLocaleString([], options);
}

function renderIncidentRecord(incident) {
  const title = document.getElementById('incident-record-title');
  const status = document.getElementById('incident-record-status');
  const address = document.getElementById('incident-record-address');
  const facility = document.getElementById('incident-record-facility');
  const chemical = document.getElementById('incident-record-chemical');
  const resources = document.getElementById('incident-record-resources');
  const cad = document.getElementById('incident-record-cad');

  if (!incident) return;

  const cadTimes = [
    (incident.cadReceivedDate || incident.cadReceivedTime || incident.cadReceived)
      && `Received ${formatCadTime(incident.cadReceivedDate, incident.cadReceivedTime, incident.cadReceived)}`,
    (incident.cadDispatchedDate || incident.cadDispatchedTime || incident.cadDispatched)
      && `Dispatched ${formatCadTime(incident.cadDispatchedDate, incident.cadDispatchedTime, incident.cadDispatched)}`,
    (incident.cadArrivalDate || incident.cadArrivalTime || incident.cadArrival)
      && `On scene ${formatCadTime(incident.cadArrivalDate, incident.cadArrivalTime, incident.cadArrival)}`,
  ].filter(Boolean).join(' · ');

  if (title) title.textContent = incident.facilityName || incident.incidentAddress || 'Active incident';
  if (status) status.textContent = 'Incident active';
  if (address) address.textContent = incident.incidentAddress || 'Not entered';
  if (facility) facility.textContent = incident.facilityName || 'Not entered';
  if (chemical) chemical.textContent = incident.chemicalInvolved || 'Unknown / not entered';
  if (resources) resources.textContent = incident.unitsResources || 'Not entered';
  if (cad) cad.textContent = cadTimes || 'Not entered';
}

function populateIncidentForm(incident) {
  if (!incidentIntakeForm || !incident) return;
  Object.entries(incident).forEach(([name, value]) => {
    const field = incidentIntakeForm.elements.namedItem(name);
    if (field && typeof value === 'string') field.value = value;
  });
}

function persistIncident(incident) {
  activeIncident = { ...incident };
  try {
    sessionStorage.setItem('hazmatiq.activeIncident', JSON.stringify(activeIncident));
  } catch (error) {
    console.warn('Incident data could not be stored for this browser session.', error);
  }
  renderIncidentRecord(activeIncident);
}

function restoreIncident() {
  try {
    const savedIncident = sessionStorage.getItem('hazmatiq.activeIncident');
    if (!savedIncident) return;
    activeIncident = JSON.parse(savedIncident);
    populateIncidentForm(activeIncident);
    renderIncidentRecord(activeIncident);
  } catch (error) {
    console.warn('Saved incident data could not be restored.', error);
  }
}

function applyIncidentToModules(incident) {
  const plumeLocation = document.getElementById('incident-location');
  const plumeGps = document.getElementById('gps-location');
  const plumeChemical = document.getElementById('chemical-name-input');
  const chemicalSearch = document.getElementById('chemical-search');

  if (plumeLocation && incident.incidentAddress) plumeLocation.value = incident.incidentAddress;
  if (plumeGps && incident.incidentLatitude && incident.incidentLongitude) {
    plumeGps.value = `${incident.incidentLatitude}, ${incident.incidentLongitude}`;
  }
  if (plumeChemical && incident.chemicalInvolved) plumeChemical.value = incident.chemicalInvolved;
  if (chemicalSearch && incident.chemicalInvolved) chemicalSearch.value = incident.chemicalInvolved;
}

function readIncidentForm() {
  if (!incidentIntakeForm) return {};
  return Object.fromEntries(new FormData(incidentIntakeForm).entries());
}

function syncIncidentDraft() {
  const incident = readIncidentForm();
  incident.createdAt = activeIncident?.createdAt || new Date().toISOString();
  incident.updatedAt = new Date().toISOString();
  persistIncident(incident);
  applyIncidentToModules(incident);
  if (incidentFormStatus) incidentFormStatus.textContent = 'Draft synced to the Incident Dashboard.';
  return incident;
}

if (incidentIntakeForm) {
  let draftSyncTimer;

  incidentIntakeForm.addEventListener('input', () => {
    window.clearTimeout(draftSyncTimer);
    draftSyncTimer = window.setTimeout(syncIncidentDraft, 250);
  });

  incidentIntakeForm.addEventListener('change', () => {
    window.clearTimeout(draftSyncTimer);
    syncIncidentDraft();
  });

  incidentIntakeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!incidentIntakeForm.reportValidity()) return;

    const incident = syncIncidentDraft();
    updateNotificationCenter({
      tactical: `Active incident: ${incident.facilityName || incident.incidentAddress}${incident.chemicalInvolved ? ` · ${incident.chemicalInvolved}` : ''}`,
    });

    if (incidentFormStatus) incidentFormStatus.textContent = 'Incident saved. Opening the Incident Commander dashboard…';
    showView('incident');
  });

  incidentIntakeForm.addEventListener('reset', () => {
    if (incidentFormStatus) incidentFormStatus.textContent = 'Form cleared.';
  });
}

if (cancelNewIncidentButton) {
  cancelNewIncidentButton.addEventListener('click', () => showView('home'));
}

if (editIncidentButton) {
  editIncidentButton.addEventListener('click', () => showView('new-incident'));
}

window.HazMatIQ.getActiveIncident = () => (activeIncident ? { ...activeIncident } : null);
window.HazMatIQ.updateIncident = (incidentUpdate = {}) => {
  const nextIncident = { ...(activeIncident || {}), ...incidentUpdate, updatedAt: new Date().toISOString() };
  persistIncident(nextIncident);
  populateIncidentForm(nextIncident);
  applyIncidentToModules(nextIncident);
  return { ...nextIncident };
};

function splitCadTimestamp(value) {
  if (!value) return {};
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return {};
  const localDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const localTime = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
  return { date: localDate, time: localTime };
}

window.HazMatIQ.applySpillmanCadUpdate = (cadUpdate = {}) => {
  const received = splitCadTimestamp(cadUpdate.receivedAt || cadUpdate.received);
  const dispatched = splitCadTimestamp(cadUpdate.dispatchedAt || cadUpdate.dispatched);
  const arrival = splitCadTimestamp(cadUpdate.arrivalAt || cadUpdate.onSceneAt || cadUpdate.arrival);
  const incidentUpdate = {
    ...(received.date && { cadReceivedDate: received.date, cadReceivedTime: received.time }),
    ...(dispatched.date && { cadDispatchedDate: dispatched.date, cadDispatchedTime: dispatched.time }),
    ...(arrival.date && { cadArrivalDate: arrival.date, cadArrivalTime: arrival.time }),
    ...((cadUpdate.unitsResources || cadUpdate.resources) && {
      unitsResources: cadUpdate.unitsResources || cadUpdate.resources,
    }),
    spillmanLastSync: new Date().toISOString(),
  };

  return window.HazMatIQ.updateIncident(incidentUpdate);
};

restoreIncident();

function showView(targetId) {
  buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === targetId));
  views.forEach((view) => view.classList.toggle('active', view.id === targetId));
}

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.view) {
      showView(button.dataset.view);
    }
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      button.click();
    }
  });
});

const incidentTaskButtons = document.querySelectorAll('.incident-task-btn');
const incidentFocusLabel = document.getElementById('incident-focus-label');
const incidentFocusDetail = document.getElementById('incident-focus-detail');

const incidentTaskDetails = {
  identify: {
    label: 'Identify the product and confirm the verified source before action.',
    detail: '<strong>Active workflow:</strong> Chemical identification and reference review.'
  },
  erg: {
    label: 'Pull the ERG guidance and confirm immediate isolation and hazard information.',
    detail: '<strong>Active workflow:</strong> Emergency Response Guidebook reference and hazard summary.'
  },
  plume: {
    label: 'Run the plume model and review the predictive hazard footprint.',
    detail: '<strong>Active workflow:</strong> Plume modeling and downwind hazard planning.'
  },
  zones: {
    label: 'Define hot zone, warm zone, and public protection boundaries.',
    detail: '<strong>Active workflow:</strong> Zone management and scene control.'
  },
  entry: {
    label: 'Prepare the entry plan and verify access, accountability, and monitoring needs.',
    detail: '<strong>Active workflow:</strong> Entry operations and access control.'
  },
  decon: {
    label: 'Set the decontamination corridor and isolate contaminated runoff.',
    detail: '<strong>Active workflow:</strong> Decon setup and contamination control.'
  },
  monitoring: {
    label: 'Check environmental monitoring and detector information before entry.',
    detail: '<strong>Active workflow:</strong> Air monitoring and atmospheric assessment.'
  },
  evacuation: {
    label: 'Review protective actions for the public and notify exposed populations.',
    detail: '<strong>Active workflow:</strong> Evacuation and sheltering coordination.'
  },
  ics: {
    label: 'Open the ICS report package and documentation workflow.',
    detail: '<strong>Active workflow:</strong> Incident documentation and command reporting.'
  }
};

function setIncidentTask(taskName) {
  incidentTaskButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.task === taskName);
  });

  const task = incidentTaskDetails[taskName] || incidentTaskDetails.identify;
  if (incidentFocusLabel) incidentFocusLabel.textContent = task.label;
  if (incidentFocusDetail) incidentFocusDetail.innerHTML = task.detail;
}

incidentTaskButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const taskName = button.dataset.task || 'identify';
    setIncidentTask(taskName);
    if (button.dataset.view) {
      showView(button.dataset.view);
    }
  });
});

setIncidentTask('identify');

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.view) {
      showView(button.dataset.view);
    }
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      button.click();
    }
  });
});

const chemicalDatabase = {
  ammonia: {
    name: 'ANHYDROUS AMMONIA',
    aliases: ['ammonia', 'anhydrous ammonia', 'nh3', '1005', 'un1005', 'un 1005'],
    summary: 'Colorless, pungent, highly toxic gas with a severe inhalation and corrosive hazard that requires rapid isolation and respiratory protection.',
    primaryHazard: 'Toxic inhalation / corrosive gas',
    immediateActions: 'Approach uphill/upwind · SCBA required · Isolate area · Monitor downwind · Consider evacuation or shelter-in-place · Avoid low-lying/confined spaces · Establish decon',
    ergGuide: '125',
    dotClass: '2.3 / corrosive',
    physicalState: 'Gas',
    idlh: '300 ppm',
    aeGL: 'AEGL-2 / AEGL-3 values vary by duration',
    erpg: 'ERPG-2 / ERPG-3 guidance',
    pac: 'PAC-2 / PAC-3 guidance',
    majorConcern: 'Respiratory injury and airway burn risk',
    recommendedMode: 'HazMat Technician Operations',
    actions: [
      'Approach uphill / upwind',
      'SCBA required',
      'Isolate area',
      'Monitor downwind',
      'Consider evacuation or shelter-in-place',
      'Avoid low-lying / confined spaces',
      'Establish decon'
    ],
    advanced: [
      ['CAS', '7664-41-7'],
      ['UN', '1005'],
      ['Molecular Weight', '17.03 g/mol'],
      ['Vapor Density', '0.6 (air = 1)'],
      ['Boiling Point', '-33.3 °C'],
      ['Flash Point', 'Not applicable (gas)'],
      ['LEL / UEL', '15% / 28%'],
      ['IDLH', '300 ppm'],
      ['AEGL', 'AEGL-2 / AEGL-3 values vary by exposure duration'],
      ['ERPG', 'ERPG-2 / ERPG-3 guidance'],
      ['PAC', 'PAC-2 / PAC-3 guidance'],
      ['Reactivity', 'Reacts with acids, oxidizers, and moisture'],
      ['Incompatibilities', 'Chlorine, copper, mercury, strong oxidizers'],
      ['PPE References', 'SCBA, chemical-resistant gloves, splash protection'],
      ['Decon References', 'Water rinse and controlled runoff management']
    ],
    sources: [
      'CAMEO Chemicals: toxicology, physical hazards, and hazard isolation guidance',
      'NIOSH Pocket Guide: IDLH 300 ppm and respiratory protection considerations',
      'SDS: corrosive inhalation hazard, reactivity, and exposure controls',
      'E-Plan: facility inventory and emergency-contact context for stored ammonia'
    ]
  },
  chlorine: {
    name: 'CHLORINE',
    aliases: ['chlorine', 'cl2', '1017', 'un1017', 'un 1017'],
    summary: 'Highly toxic, corrosive gas that can rapidly produce severe respiratory injury and dense vapor exposure.',
    primaryHazard: 'Toxic inhalation / corrosive gas',
    immediateActions: 'Protect from vapors · Avoid low areas · Establish isolation · Monitor downwind · Shelter or evacuate based on release',
    ergGuide: '124',
    dotClass: '2.3 / corrosive',
    physicalState: 'Gas',
    idlh: '10 ppm',
    aeGL: 'AEGL values vary by duration',
    erpg: 'ERPG-2 / ERPG-3 guidance',
    pac: 'PAC-2 / PAC-3 guidance',
    majorConcern: 'Respiratory injury and airway compromise',
    recommendedMode: 'HazMat Technician Operations',
    actions: [
      'Approach uphill / upwind',
      'SCBA required',
      'Isolate area immediately',
      'Monitor downwind',
      'Consider shelter-in-place or evacuation',
      'Protect low-lying areas',
      'Establish decon'
    ],
    advanced: [
      ['CAS', '7782-50-5'],
      ['UN', '1017'],
      ['Molecular Weight', '70.91 g/mol'],
      ['Vapor Density', '2.47 (air = 1)'],
      ['Boiling Point', '-34.6 °C'],
      ['Flash Point', 'Not applicable (gas)'],
      ['LEL / UEL', 'Not applicable (gas)'],
      ['IDLH', '10 ppm'],
      ['AEGL', 'AEGL values vary by duration'],
      ['ERPG', 'ERPG-2 / ERPG-3'],
      ['PAC', 'PAC-2 / PAC-3'],
      ['Reactivity', 'Reacts with many metals, ammonia, and organics'],
      ['Incompatibilities', 'Ammonia, metals, organics, strong reducers'],
      ['PPE References', 'SCBA, chemical-resistant clothing, eye protection'],
      ['Decon References', 'Controlled washdown and runoff isolation']
    ],
    sources: [
      'CAMEO Chemicals: toxicology, physical hazards, and acute inhalation guidance',
      'NIOSH Pocket Guide: IDLH 10 ppm and respiratory protection guidance',
      'SDS: storage, compatibility, and emergency response controls',
      'E-Plan: Tier II inventory and emergency-contact records for chlorine storage'
    ]
  },
  'sulfur-dioxide': {
    name: 'SULFUR DIOXIDE',
    aliases: ['sulfur dioxide', 'sulfur-dioxide', 'so2', '1079', 'un1079', 'un 1079'],
    summary: 'Irritating and toxic gas that can cause severe respiratory effects and acid-mist concerns during a release.',
    primaryHazard: 'Toxic inhalation / respiratory hazard',
    immediateActions: 'Protect airway exposure · Isolate area · Evaluate downwind impacts · Use SCBA for entry · Consider shelter or evacuation',
    ergGuide: '125',
    dotClass: '2.3',
    physicalState: 'Gas',
    idlh: '100 ppm',
    aeGL: 'AEGL values vary by duration',
    erpg: 'ERPG-2 / ERPG-3 guidance',
    pac: 'PAC-2 / PAC-3 guidance',
    majorConcern: 'Respiratory irritation and bronchospasm',
    recommendedMode: 'HazMat Technician Operations',
    actions: [
      'Approach uphill / upwind',
      'SCBA required',
      'Isolate area',
      'Monitor downwind',
      'Consider shelter-in-place or evacuation',
      'Avoid enclosed spaces',
      'Establish decon'
    ],
    advanced: [
      ['CAS', '7446-09-5'],
      ['UN', '1079'],
      ['Molecular Weight', '64.07 g/mol'],
      ['Vapor Density', '2.21 (air = 1)'],
      ['Boiling Point', '-10 °C'],
      ['Flash Point', 'Not applicable (gas)'],
      ['LEL / UEL', 'Not applicable (gas)'],
      ['IDLH', '100 ppm'],
      ['AEGL', 'AEGL values vary by duration'],
      ['ERPG', 'ERPG-2 / ERPG-3'],
      ['PAC', 'PAC-2 / PAC-3'],
      ['Reactivity', 'Forms sulfuric acid in moisture'],
      ['Incompatibilities', 'Oxidizers, strong bases, metals'],
      ['PPE References', 'SCBA, acid-resistant gloves, eye protection'],
      ['Decon References', 'Wash contamination and isolate runoff']
    ],
    sources: [
      'CAMEO Chemicals: acute inhalation and physical hazard response data',
      'NIOSH Pocket Guide: respiratory symptoms and exposure limits',
      'SDS: PPE, first aid, and release-response data',
      'E-Plan: facility inventory and emergency-response planning context'
    ]
  }
};

function normalizeChemicalQuery(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function findChemicalRecord(value) {
  const query = normalizeChemicalQuery(value);
  if (!query) return chemicalDatabase.ammonia;

  const exactMatch = Object.entries(chemicalDatabase).find(([key, record]) => {
    return key === query || record.aliases.some((alias) => normalizeChemicalQuery(alias) === query);
  });

  if (exactMatch) return exactMatch[1];

  const partialMatch = Object.entries(chemicalDatabase).find(([key, record]) => {
    return key.includes(query) || record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').includes(query) || record.aliases.some((alias) => normalizeChemicalQuery(alias).includes(query));
  });

  return partialMatch ? partialMatch[1] : chemicalDatabase.ammonia;
}

function updateChemicalCard(chemicalKey) {
  const record = chemicalDatabase[chemicalKey] || findChemicalRecord(chemicalKey);
  if (!record) return;

  document.getElementById('chemical-name').textContent = record.name;
  document.getElementById('chemical-summary').textContent = record.summary;
  document.getElementById('chemical-primary-hazard').textContent = record.primaryHazard;
  document.getElementById('chemical-immediate-actions').textContent = record.immediateActions;
  document.getElementById('chemical-erg-guide').textContent = record.ergGuide;
  document.getElementById('chemical-major-concern').textContent = record.majorConcern;
  document.getElementById('chemical-recommended-mode').textContent = record.recommendedMode;

  const actionsList = document.getElementById('chemical-actions-list');
  actionsList.innerHTML = record.actions.map((item) => `<li>${item}</li>`).join('');

  const advancedList = document.getElementById('chemical-advanced-list');
  advancedList.innerHTML = record.advanced.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join('');

  const sourceList = document.getElementById('chemical-source-list');
  sourceList.innerHTML = record.sources.map((item) => `<li>${item}</li>`).join('');

  const lookupSource = document.getElementById('lookup-verified-source');
  const lookupUn = document.getElementById('lookup-un');
  const lookupErg = document.getElementById('lookup-erg-guide');
  const lookupDot = document.getElementById('lookup-dot-class');
  const lookupPhysical = document.getElementById('lookup-physical-state');
  const lookupIdlh = document.getElementById('lookup-idlh');
  const lookupPpe = document.getElementById('lookup-ppe-decon');

  if (lookupSource) lookupSource.textContent = 'ERG · NIOSH · SDS · E-Plan';
  if (lookupUn) lookupUn.textContent = record.advanced.find(([label]) => label === 'UN')?.[1] || 'N/A';
  if (lookupErg) lookupErg.textContent = record.ergGuide;
  if (lookupDot) lookupDot.textContent = record.dotClass;
  if (lookupPhysical) lookupPhysical.textContent = record.physicalState;
  if (lookupIdlh) lookupIdlh.textContent = `${record.idlh} · ${record.aeGL} · ${record.pac}`;
  if (lookupPpe) lookupPpe.textContent = `${record.actions[1]} · decon corridor · EMS coordination`;
}

function lookupChemical() {
  const searchInput = document.getElementById('chemical-search');
  const record = findChemicalRecord(searchInput?.value || '');
  const selectedKey = Object.keys(chemicalDatabase).find((key) => chemicalDatabase[key] === record) || 'ammonia';
  updateChemicalCard(selectedKey);
  showView('card');
}

const lookupButton = document.getElementById('chemical-lookup-btn');
if (lookupButton) {
  lookupButton.addEventListener('click', lookupChemical);
}

let currentPlumeMode = 'street';
let currentScenario = 'quick';

function parseGpsCoordinate(value) {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)\s*[,/ ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return { lat: 36.1445, lon: -86.8043 };
  }

  return {
    lat: Number(match[1]),
    lon: Number(match[2]),
  };
}

function getScenarioProfile(scenarioName = currentScenario) {
  const profiles = {
    quick: {
      label: 'Quick model',
      distance: 750,
      zone: 'Initial hot zone and isolation perimeter',
      decon: 'Crosswind/upwind side of the release',
      concern: 'Rapid screening for immediate protective actions',
      side: 'upwind/crosswind',
    },
    advanced: {
      label: 'Advanced model',
      distance: 1200,
      zone: 'Extended isolation and downwind receptor review',
      decon: 'Crosswind/upwind side with a clear access corridor',
      concern: 'More detailed receptor and terrain evaluation',
      side: 'Bravo/Charlie side',
    },
    alohac: {
      label: 'ALOHA-compatible output',
      distance: 1100,
      zone: 'ALOHA-style footprint with hazard buffer',
      decon: 'Crosswind/upwind side with public-protection review',
      concern: 'Compatible with ALOHA-style modeling assumptions',
      side: 'upwind/crosswind',
    },
    toxic: {
      label: 'Toxic plume',
      distance: 1300,
      zone: 'Toxic inhalation exposure envelope',
      decon: 'Crosswind/upwind side and respiratory-protection corridor',
      concern: 'Focused on toxic exposure and sheltering thresholds',
      side: 'Bravo/Charlie side',
    },
    flammable: {
      label: 'Flammable plume',
      distance: 1500,
      zone: 'Flammable vapor cloud buffer',
      decon: 'Crosswind/upwind side with ignition-source control',
      concern: 'Accounts for vapor cloud ignition potential',
      side: 'upwind/crosswind',
    },
    fire: {
      label: 'Fire model',
      distance: 1700,
      zone: 'Thermal exposure and fire spread perimeter',
      decon: 'Crosswind/upwind side with remote staging',
      concern: 'Includes fire growth and thermal effects',
      side: 'upwind/crosswind',
    },
    bleve: {
      label: 'BLEVE model',
      distance: 2200,
      zone: 'Fragment and thermal blast consideration',
      decon: 'Crosswind/upwind side with evacuation buffer',
      concern: 'Addresses BLEVE-related overpressure and fragment hazards',
      side: 'Bravo/Charlie side',
    },
    vce: {
      label: 'Vapor cloud explosion model',
      distance: 2400,
      zone: 'Blast overpressure perimeter',
      decon: 'Crosswind/upwind side with remote operations',
      concern: 'Focused on vapor cloud explosion consequences',
      side: 'upwind/crosswind',
    },
    'wind-shift': {
      label: 'Wind shift forecast',
      distance: 1400,
      zone: 'Shift-aware hot and warm zone planning',
      decon: 'Crosswind/upwind side and avoid projected wind-shift corridors',
      concern: 'Accounts for a forecast wind change and alternate plume path',
      side: 'upwind/crosswind',
    },
    realtime: {
      label: 'Real-time sensor update',
      distance: 1050,
      zone: 'Dynamic hazard envelope with frequent reassessment',
      decon: 'Crosswind/upwind side and alternate route review',
      concern: 'Continuously updated with the latest weather and observations',
      side: 'upwind/crosswind',
    },
    export: {
      label: 'Export to KML / GeoJSON / PDF',
      distance: 1000,
      zone: 'Export-ready plume and mapping package',
      decon: 'Crosswind/upwind side with package-ready route notes',
      concern: 'Prepared for KML, GeoJSON, and PDF export',
      side: 'upwind/crosswind',
    },
  };

  return profiles[scenarioName] || profiles.quick;
}

function updatePlumeOutputs() {
  const gpsInput = document.getElementById('gps-location');
  const titleInput = document.getElementById('incident-location');
  const titleEl = document.getElementById('plume-map-title');
  const subtitleEl = document.getElementById('plume-map-subtitle');
  const statusEl = document.getElementById('plume-map-status');
  const gpsSummaryEl = document.getElementById('plume-gps-summary');
  const weatherStatus = document.getElementById('weather-status');
  const stationSelect = document.getElementById('weather-station');
  const windInput = document.getElementById('wind');
  const stabilityInput = document.getElementById('stability');
  const weatherSummaryEl = document.getElementById('scenario-weather-summary');
  const scenarioNameEl = document.getElementById('scenario-name');
  const scenarioBadgeEl = document.getElementById('scenario-badge');
  const zoneDistanceEl = document.getElementById('zone-distance');
  const zoneSummaryEl = document.getElementById('zone-summary');
  const deconSummaryEl = document.getElementById('decon-summary');
  const receptorSummaryEl = document.getElementById('receptor-summary');
  const recommendationEl = document.getElementById('plume-recommendation');

  const { lat, lon } = parseGpsCoordinate(gpsInput?.value || '36.1445, -86.8043');
  const incidentLabel = titleInput?.value || 'Incident location';
  const mapModeLabel = currentPlumeMode === 'satellite' ? 'Satellite' : 'Street';
  const safeLat = Number.isFinite(lat) ? lat : 36.1445;
  const safeLon = Number.isFinite(lon) ? lon : -86.8043;
  const profile = getScenarioProfile(currentScenario);
  const windValue = windInput?.value || '8 mph SW';
  const stabilityValue = stabilityInput?.value || 'Neutral / inversion possible';
  const stationValue = stationSelect?.value || 'North Gate Station';
  const windMatch = String(windValue).match(/(\d+)\s*mph\s*([NSEW]{1,2})/i);
  const speed = windMatch ? Number(windMatch[1]) : 8;
  const distanceFt = profile.distance + (speed * 18);
  const weatherText = `${stationValue} · ${windValue} · ${stabilityValue}`;

  updateNotificationCenter({ weather: weatherText });

  if (titleEl) titleEl.textContent = incidentLabel;
  if (subtitleEl) subtitleEl.textContent = `GPS ${safeLat.toFixed(4)}, ${safeLon.toFixed(4)} · Google Maps base showing homes, businesses, and nearby structures`;
  if (gpsSummaryEl) gpsSummaryEl.textContent = `${safeLat.toFixed(4)}, ${safeLon.toFixed(4)}`;
  if (statusEl) statusEl.textContent = `Basemap: ${mapModeLabel}`;
  if (weatherSummaryEl) weatherSummaryEl.textContent = weatherText;
  if (scenarioNameEl) scenarioNameEl.textContent = profile.label;
  if (scenarioBadgeEl) scenarioBadgeEl.textContent = profile.label;
  if (zoneDistanceEl) zoneDistanceEl.textContent = `Establish the hot zone from the release point to ${distanceFt} feet downwind.`;
  if (zoneSummaryEl) zoneSummaryEl.textContent = `${profile.zone} with zonal buffers based on the current weather and surface conditions.`;
  if (deconSummaryEl) deconSummaryEl.textContent = `Position decon ${profile.decon} and keep the ${profile.side} side clear for access.`;
  if (receptorSummaryEl) receptorSummaryEl.textContent = `Nearby homes, businesses, and infrastructure should be reviewed in the Google map view for receptor impact.`;
  if (weatherStatus) weatherStatus.textContent = `Live weather: ${stationValue} · latest update 2 min ago`;
  if (recommendationEl) {
    recommendationEl.innerHTML = `<strong>Recommendation</strong><p>Based on current inputs, establish the hot zone from the release point to ${distanceFt} feet downwind. Position decon ${profile.decon} and keep the ${profile.side} side clear for access. Avoid staging in the projected wind-shift area. Reassess every 10 minutes or with any wind change. Use AI and verified sources from NIOSH, Emergency Response Plans, SDS datasheets, and HazMat Specialists and Technician best practices to determine the best tactical operations.</p>`;
  }

  const mapFrame = document.getElementById('plume-gis-map');
  if (mapFrame) {
    const mapType = currentPlumeMode === 'satellite' ? 'k' : 'm';
    mapFrame.src = `https://www.google.com/maps?q=${safeLat},${safeLon}&t=${mapType}&z=16&output=embed`;
  }
}

function updatePlumeMap(mode = currentPlumeMode) {
  currentPlumeMode = mode;
  updatePlumeOutputs();
}

const plumeButton = document.getElementById('open-plume-btn');
if (plumeButton) {
  plumeButton.addEventListener('click', () => {
    showView('plume');
    updatePlumeMap(currentPlumeMode);
  });
}

document.querySelectorAll('.plume-mode-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.plume-mode-btn').forEach((item) => item.classList.toggle('active', item === button));
    updatePlumeMap(button.dataset.mapMode || 'street');
  });
});

document.querySelectorAll('.scenario-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.scenario-btn').forEach((item) => item.classList.toggle('active', item === button));
    currentScenario = button.dataset.scenario || 'quick';
    updatePlumeOutputs();
  });
});

document.querySelectorAll('.tool-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach((item) => item.classList.toggle('active', item === button));
  });
});

['gps-location', 'incident-location', 'map-pin', 'terrain', 'chemical-name-input', 'release-rate', 'container', 'release-details', 'wind', 'stability', 'weather-station', 'weather-notes'].forEach((id) => {
  const element = document.getElementById(id);
  if (!element) return;

  element.addEventListener('input', () => updatePlumeMap(currentPlumeMode));
  element.addEventListener('change', () => updatePlumeMap(currentPlumeMode));
});

updatePlumeMap(currentPlumeMode);

const chemicalSearchInput = document.getElementById('chemical-search');
if (chemicalSearchInput) {
  chemicalSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      lookupChemical();
    }
  });
}

const tier2Facilities = [
  {
    name: 'Northside Chemical Supply',
    city: 'Nashville',
    state: 'TN',
    address: '1200 West End Ave',
    chemicals: ['Ammonia', 'Chlorine', 'Acids'],
    eplanUrl: 'https://www.eplan.gov/?facility=Northside%20Chemical%20Supply',
    reporting: 'Tier II hazardous chemical inventory on file with local emergency planning committee',
    lat: 36.1532,
    lon: -86.8125,
    position: { left: '22%', top: '28%' },
  },
  {
    name: 'Metro Water Services East Plant',
    city: 'Nashville',
    state: 'TN',
    address: '2500 Gallatin Pike',
    chemicals: ['Chlorine', 'Sodium Hypochlorite'],
    eplanUrl: 'https://www.eplan.gov/?facility=Metro%20Water%20Services%20East%20Plant',
    reporting: 'Water treatment chemicals and emergency contact information on file',
    lat: 36.1747,
    lon: -86.7050,
    position: { left: '69%', top: '38%' },
  },
  {
    name: 'Global Fuel & Bulk Terminal',
    city: 'Nashville',
    state: 'TN',
    address: '500 Murfreesboro Pike',
    chemicals: ['Diesel', 'Propane', 'Sulfuric Acid'],
    eplanUrl: 'https://www.eplan.gov/?facility=Global%20Fuel%20and%20Bulk%20Terminal',
    reporting: 'Bulk hazardous materials storage and response plan on file',
    lat: 36.1258,
    lon: -86.7432,
    position: { left: '35%', top: '70%' },
  },
  {
    name: 'Midtown Industrial Services',
    city: 'Franklin',
    state: 'TN',
    address: '1800 Broadway',
    chemicals: ['Anhydrous Ammonia', 'Solvents'],
    eplanUrl: 'https://www.eplan.gov/?facility=Midtown%20Industrial%20Services',
    reporting: 'Industrial chemical inventory and site-specific emergency plan available',
    lat: 36.1489,
    lon: -86.7992,
    position: { left: '58%', top: '22%' },
  },
  {
    name: 'Riverfront Logistics Hub',
    city: 'Louisville',
    state: 'KY',
    address: '1001 Cumberland Ave',
    chemicals: ['Hydrogen Peroxide', 'Caustic Soda'],
    eplanUrl: 'https://www.eplan.gov/?facility=Riverfront%20Logistics%20Hub',
    reporting: 'Hazardous materials reporting package and emergency contact details on file',
    lat: 36.1606,
    lon: -86.7747,
    position: { left: '78%', top: '64%' },
  },
];

function renderTier2Results(query = '') {
  const resultsContainer = document.getElementById('tier2-results');
  const detailContainer = document.getElementById('tier2-detail');
  if (!resultsContainer || !detailContainer) return;

  const normalized = query.toLowerCase().trim();
  const filtered = tier2Facilities.filter((facility) => {
    if (!normalized) return true;
    return [facility.name, facility.city, facility.state, facility.address, facility.chemicals.join(' ')].some((value) => value.toLowerCase().includes(normalized));
  });

  resultsContainer.innerHTML = '';
  detailContainer.innerHTML = '';

  if (!filtered.length) {
    resultsContainer.innerHTML = '<p class="muted">No facilities matched that term.</p>';
    return;
  }

  filtered.forEach((facility) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tier2-result-btn';
    button.innerHTML = `<strong>${facility.name}</strong>${facility.address}, ${facility.city}, ${facility.state}`;
    button.addEventListener('click', () => {
      detailContainer.innerHTML = `
        <strong>${facility.name}</strong>
        <p>${facility.address}, ${facility.city}, ${facility.state}</p>
        <p><strong>Tier II chemicals:</strong> ${facility.chemicals.join(', ')}</p>
        <p>${facility.reporting}</p>
        <a href="${facility.eplanUrl}" target="_blank" rel="noreferrer">Open EPlan facility report</a>
      `;
      window.open(facility.eplanUrl, '_blank', 'noopener,noreferrer');
    });
    resultsContainer.appendChild(button);
  });
}

const tier2SearchButton = document.getElementById('tier2-search-btn');
const tier2SearchInput = document.getElementById('tier2-search');
if (tier2SearchButton && tier2SearchInput) {
  tier2SearchButton.addEventListener('click', () => renderTier2Results(tier2SearchInput.value));
  tier2SearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renderTier2Results(tier2SearchInput.value);
    }
  });
}

renderTier2Results();
updateChemicalCard('ammonia');

const homeButtons = document.querySelectorAll('#home .primary-btn');
homeButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    const viewNames = ['incident', 'lookup', 'plume', 'map'];
    const target = viewNames[index];
    document.querySelector(`[data-view="${target}"]`).click();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('module-btn')) {
    event.preventDefault();
    document.activeElement.click();
  }
});

function renderTier2Facilities() {
  const container = document.getElementById('tier2-facility-layer');
  const card = document.getElementById('tier2-facility-card');
  if (!container || !card) return;

  container.innerHTML = '';
  tier2Facilities.forEach((facility) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tier2-facility-pin';
    button.textContent = facility.name;
    button.style.left = facility.position.left;
    button.style.top = facility.position.top;
    button.addEventListener('click', () => {
      card.innerHTML = `
        <h4>${facility.name}</h4>
        <p>${facility.address}</p>
        <p>Tier II chemicals: ${facility.chemicals.join(', ')}</p>
        <a href="${facility.eplanUrl}" target="_blank" rel="noreferrer">Open EPlan Tier II data sheet</a>
      `;
      card.hidden = false;
      window.open(facility.eplanUrl, '_blank', 'noopener,noreferrer');
    });
    container.appendChild(button);
  });
}

const draggableMarkers = document.querySelectorAll('.map-placeholder .map-marker.command, .map-placeholder .map-marker.staging');
let activeDrag = null;

draggableMarkers.forEach((marker) => {
  marker.addEventListener('pointerdown', (event) => {
    const rect = marker.getBoundingClientRect();
    activeDrag = {
      marker,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    marker.classList.add('dragging');
    marker.setPointerCapture(event.pointerId);
  });

  marker.addEventListener('pointerup', (event) => {
    if (activeDrag && activeDrag.marker === marker) {
      activeDrag = null;
    }
    marker.classList.remove('dragging');
    marker.releasePointerCapture(event.pointerId);
  });
});

document.addEventListener('pointermove', (event) => {
  if (!activeDrag) return;

  const container = activeDrag.marker.parentElement;
  const rect = container.getBoundingClientRect();
  const left = Math.min(Math.max(event.clientX - rect.left - activeDrag.offsetX, 8), rect.width - activeDrag.marker.offsetWidth - 8);
  const top = Math.min(Math.max(event.clientY - rect.top - activeDrag.offsetY, 8), rect.height - activeDrag.marker.offsetHeight - 8);

  activeDrag.marker.style.left = `${left}px`;
  activeDrag.marker.style.top = `${top}px`;
});

document.addEventListener('pointerup', () => {
  if (activeDrag) {
    activeDrag.marker.classList.remove('dragging');
    activeDrag = null;
  }
});

renderTier2Facilities();

/* Device preferences only. Never stores incident records, credentials, or feed URLs. */
(() => {
  'use strict';
  const key = 'emergenz.preferences.v1';
  const defaults = Object.freeze({ locationEnabled: true, autoLocation: true, highAccuracy: true,
    weatherRefresh: '5', mapView: 'remember', monitorGps: true, monitorReport: true,
    printMap: true, printAuthor: false, pdfAction: 'view' });
  const choices = { weatherRefresh: ['manual', '5', '15'], mapView: ['remember', 'satellite', 'street'], pdfAction: ['view', 'download'] };
  function normalize(input) {
    const output = { ...defaults };
    if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
    for (const name of Object.keys(defaults)) {
      if (choices[name]?.includes(input[name]) || typeof defaults[name] === 'boolean' && typeof input[name] === 'boolean') output[name] = input[name];
    }
    return output;
  }
  function read() { try { return normalize(JSON.parse(localStorage.getItem(key))); } catch { return { ...defaults }; } }
  let values = read();
  function apply() {
    document.documentElement.dataset.printMap = String(values.printMap);
    document.documentElement.dataset.printAuthor = String(values.printAuthor);
  }
  function save(input) {
    const next = normalize(input);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { return false; }
    const previous = values; values = next; apply();
    window.dispatchEvent(new CustomEvent('emergenz:preferences-changed', { detail: { values: { ...values }, previous } }));
    return true;
  }
  window.HazMatIQ ||= {};
  window.HazMatIQ.preferences = { get: (name) => values[name], all: () => ({ ...values }), defaults: () => ({ ...defaults }), save, normalize };
  window.addEventListener('storage', (event) => {
    if (event.key !== key && event.key !== null) return;
    const previous = values; values = read(); apply();
    window.dispatchEvent(new CustomEvent('emergenz:preferences-changed', { detail: { values: { ...values }, previous } }));
  });
  apply();
})();

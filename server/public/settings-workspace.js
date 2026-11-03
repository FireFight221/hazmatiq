/* Settings workspace ownership: application-wide theme selection and source
   registry disclosure live here instead of inside the responsive nav drawer. */
(() => {
  let initialized = false;

  const preferences = () => window.HazMatIQ.preferences;
  function status(message, error = false) {
    const element = document.getElementById('settings-save-status');
    if (element) { element.textContent = message; element.dataset.error = String(error); }
  }
  function renderPreferences() {
    document.querySelectorAll('[data-preference]').forEach((control) => {
      const value = preferences().get(control.dataset.preference);
      if (control.type === 'checkbox') control.checked = value;
      else control.value = value;
    });
  }
  function savePreferences(values) {
    const saved = preferences().save(values);
    status(saved ? 'Saved on this device.' : 'Could not save. Browser storage is unavailable or full; previous preferences remain active.', !saved);
    renderPreferences();
    return saved;
  }
  async function showGpsPermission() {
    const element = document.getElementById('settings-gps-status');
    if (!element) return;
    if (!preferences().get('locationEnabled')) { element.textContent = 'Device GPS disabled in EMERGENZ. Manual locations remain available.'; return; }
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      const show = () => { element.textContent = `Browser location permission: ${permission.state}. Change permission in your browser’s site settings.`; };
      permission.onchange = show; show();
    } catch { element.textContent = 'Use Check Current GPS to request browser permission. HTTPS is required.'; }
  }
  function bindPreferences() {
    document.querySelectorAll('[data-preference]').forEach((control) => control.addEventListener('change', () => {
      savePreferences({ ...preferences().all(), [control.dataset.preference]: control.type === 'checkbox' ? control.checked : control.value });
      if (control.dataset.preference === 'locationEnabled') void showGpsPermission();
    }));
    document.getElementById('settings-test-gps').addEventListener('click', async (event) => {
      const button = event.currentTarget, element = document.getElementById('settings-gps-status');
      button.disabled = true; element.textContent = 'Requesting device location…';
      try {
        const point = await window.HazMatIQ.locationTools.getCurrentGps();
        element.textContent = `Device GPS: ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)} · accuracy ±${Math.round(point.accuracy)} m. Incident location was not changed.`;
      } catch (error) { element.textContent = error.message || 'GPS unavailable. Enter a manual location.'; }
      finally { button.disabled = false; }
    });
    document.getElementById('settings-weather-import').addEventListener('click', () => {
      window.HazMatIQ.showView('plume', { skipPlumeInitialization: true, sourcePage: 'settings' });
      const source = document.getElementById('plume-weather-source'); source.value = 'columbia-csv'; source.dispatchEvent(new Event('change'));
      document.getElementById('plume-weather-data-panel').open = true;
      document.getElementById('plume-columbia-csv').focus();
      document.getElementById('plume-weather-data-panel').scrollIntoView({ block: 'start' });
    });
    document.getElementById('settings-reset').addEventListener('click', () => {
      if (window.confirm('Restore device preferences to defaults? Incident records, saved maps, monitor assignments, and appearance will be retained.')) savePreferences(preferences().defaults());
    });
    document.getElementById('settings-export').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'emergenz-device-preferences', version: 1, preferences: preferences().all() }, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'emergenz-device-preferences.json'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status('Preferences exported. This file contains no incident data or credentials.');
    });
    const fileInput = document.getElementById('settings-import-file');
    document.getElementById('settings-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]; if (!file) return;
      try {
        if (file.size > 16384) throw new Error('Preferences file is too large.');
        const data = JSON.parse(await file.text());
        if (data.format !== 'emergenz-device-preferences' || data.version !== 1 || !data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) throw new Error('Choose an EMERGENZ device preferences export.');
        if (window.confirm('Replace this device’s preferences with the imported settings? Incident records will be retained.')) savePreferences(preferences().normalize(data.preferences));
      } catch (error) { status(error.message || 'Unable to import preferences.', true); }
      finally { fileInput.value = ''; }
    });
    window.addEventListener('emergenz:preferences-changed', renderPreferences);
  }

  function initializeSettingsPage() {
    if (!initialized) {
      document.querySelectorAll('[data-theme-choice]').forEach((button) => {
        button.addEventListener('click', () => window.HazMatIQ.applyApplicationTheme?.(button.dataset.themeChoice));
      });
      document.getElementById('settings-sources-toggle')?.addEventListener('click', (event) => {
        const button = event.currentTarget;
        const panel = document.getElementById('settings-sources-panel');
        if (!panel) return;
        const open = panel.hidden;
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        button.textContent = open ? 'Close Sources' : 'Open Sources';
      });
      bindPreferences();
      initialized = true;
    }
    renderPreferences();
    void showGpsPermission();
    const theme = document.documentElement.dataset.theme || 'dark';
    window.HazMatIQ.applyApplicationTheme?.(theme, { persist: false });
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.initializeSettingsPage = initializeSettingsPage;
})();

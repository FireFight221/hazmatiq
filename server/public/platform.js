(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  let account = null, required = null, installPrompt = null, releaseAccess;
  let syncText = 'Checking connection…', conflicts = [], resolver = null;
  let serverConnected = null, verifiedAt = null, installCacheError = '';
  const accessReady = new Promise((resolve) => { releaseAccess = resolve; });
  const domReady = document.readyState === 'loading' ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
  let bar, status, connectionDot, connectionLabel, warning, signButton, installButton, updateButton, conflictButton, login;
  let connectionDetail, accountDetail, installDetail;
  function connectionState() {
    const state = !navigator.onLine || serverConnected === false ? 'disconnected' : serverConnected === true ? 'connected' : 'checking';
    return { state, label: !navigator.onLine ? 'Offline' : state === 'connected' ? 'Connected' : state === 'checking' ? 'Checking Connection' : 'Not Connected' };
  }
  function draw() {
    if (!bar) return;
    const connection = connectionState();
    status.dataset.connection = connection.state;
    connectionLabel.textContent = connection.label;
    const pending = window.EMERGENZPendingIncidentCount?.() || 0;
    const localFailure = /local save failed/i.test(syncText);
    warning.hidden = !pending && !localFailure && !conflicts.length;
    warning.textContent = localFailure ? 'Local save failed — keep this tab open' : pending ? `${pending} unsynced change${pending === 1 ? '' : 's'}` : 'Sync conflict needs review';
    warning.dataset.state = localFailure ? 'error' : 'pending';
    conflictButton.hidden = !conflicts.length;
    conflictButton.textContent = `Review ${conflicts.length} sync conflict${conflicts.length === 1 ? '' : 's'}`;
    signButton.hidden = !required;
    signButton.textContent = account ? 'Sign Out' : 'Sign In';
    const installed = Boolean(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone);
    installButton.hidden = installed;
    if (connectionDetail) connectionDetail.textContent = `${connection.label} · ${syncText.replace(/^Connected · /, '')}${verifiedAt ? ` · Last server response: ${new Date(verifiedAt).toLocaleTimeString()}` : ''}`;
    if (accountDetail) accountDetail.textContent = account ? `Signed in as ${account.displayName}` : required === null ? 'Account status unavailable. Reconnect to verify access.' : required ? 'Agency sign-in required.' : 'Pilot access: sign-in not enabled. This preview does not require an account.';
    if (installDetail) installDetail.textContent = installed ? 'Running as an installed app.' : installCacheError || 'Install on this device using Install App, or your browser’s Add to Home Screen option.';
  }
  function mountSettingsControls() {
    const grid = document.querySelector('#settings .settings-workspace-grid');
    if (!grid || !bar || connectionDetail) return;
    const card = document.createElement('section'); card.className = 'settings-card em-platform-settings';
    card.setAttribute('aria-labelledby', 'platform-settings-title');
    const header = document.createElement('header'), title = document.createElement('h2');
    title.id = 'platform-settings-title'; title.textContent = 'Connection, Account & App'; header.append(title); card.append(header);
    connectionDetail = document.createElement('p'); connectionDetail.id = 'platform-connection-detail'; connectionDetail.setAttribute('role', 'status');
    accountDetail = document.createElement('p'); accountDetail.id = 'platform-account-detail';
    installDetail = document.createElement('p'); installDetail.id = 'platform-install-detail';
    const actions = document.createElement('div'); actions.className = 'settings-actions'; actions.append(signButton, installButton, updateButton);
    card.append(connectionDetail, accountDetail, installDetail, actions); grid.append(card); draw();
  }
  async function signIn() {
    await domReady;
    if (!login) {
      login = document.createElement('dialog'); login.className = 'em-platform-dialog';
      login.innerHTML = '<form><h2>Sign In to EMERGENZ</h2><p>Use your agency-issued account.</p><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><p role="alert"></p><button type="submit">Sign In</button></form>';
      document.body.append(login);
      login.addEventListener('cancel', (event) => event.preventDefault());
      login.querySelector('form').addEventListener('submit', async (event) => {
        event.preventDefault(); const form = event.currentTarget;
        const submit = form.querySelector('button'); submit.disabled = true;
        try {
          const response = await nativeFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Sign-in failed');
          account = data.user; form.elements.password.value = ''; login.close(); releaseAccess(); draw();
          window.dispatchEvent(new Event('emergenz:signed-in'));
        } catch (error) { form.querySelector('[role="alert"]').textContent = error.message; }
        finally { submit.disabled = false; }
      });
    }
    if (!login.open) login.showModal();
  }
  window.fetch = async function (input, init) {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url || String(input), location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/auth/')) return nativeFetch(input, init);
    await accessReady;
    const headers = new Headers(init?.headers || request?.headers);
    if (account?.csrf) headers.set('X-EMERGENZ-CSRF', account.csrf);
    const response = await nativeFetch(input, { ...init, headers });
    if (response.status === 401 && required) { account = null; draw(); void signIn(); }
    return response;
  };
  window.EMERGENZPlatform = {
    ready: accessReady,
    user: () => account,
    status(message, connection) {
      syncText = message;
      if (typeof connection === 'boolean') { serverConnected = connection; if (connection) verifiedAt = Date.now(); }
      draw();
    },
    connectionState,
    conflicts(items, resolve) { conflicts = items; resolver = resolve; draw(); },
  };
  void nativeFetch('/api/auth/session', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then((r) => { if (!r.ok) throw new Error('Session unavailable'); return r.json(); }).then((data) => {
    required = data.required; account = data.user; serverConnected = true; verifiedAt = Date.now();
    if (required && !account) void signIn(); else releaseAccess(); draw();
  }).catch(() => { serverConnected = false; syncText = 'Connection unavailable · using this device’s saved work'; releaseAccess(); draw(); });
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; draw(); });
  window.addEventListener('online', () => { serverConnected = null; draw(); }); window.addEventListener('offline', () => { serverConnected = false; draw(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; draw(); });
  void domReady.then(async () => {
    bar = document.createElement('aside'); bar.className = 'em-platform-bar'; bar.setAttribute('aria-label', 'Application connection and account');
    status = document.createElement('span'); status.className = 'em-platform-connection'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    connectionDot = document.createElement('span'); connectionDot.className = 'em-platform-dot'; connectionDot.setAttribute('aria-hidden', 'true');
    connectionLabel = document.createElement('span'); status.append(connectionDot, connectionLabel);
    warning = document.createElement('span'); warning.className = 'em-platform-warning'; warning.setAttribute('role', 'status'); warning.setAttribute('aria-live', 'polite'); warning.hidden = true;
    conflictButton = document.createElement('button'); conflictButton.type = 'button'; conflictButton.hidden = true;
    conflictButton.addEventListener('click', () => {
      const dialog = document.createElement('dialog'); dialog.className = 'em-platform-dialog';
      const heading = document.createElement('h2'); heading.textContent = 'Review Unsynced Changes'; dialog.append(heading);
      for (const conflict of conflicts) {
        const article = document.createElement('article'); const text = document.createElement('p');
        text.textContent = `${conflict.server.incidentName || conflict.incidentId}: the server record changed. Your device’s edits have been preserved.`;
        article.append(text);
        for (const [label, keep] of [['Use Server Copy', false], ['Keep My Changes', true]]) {
          if (keep && ['Deleted', 'Completed'].includes(conflict.server.status)) continue;
          const button = document.createElement('button'); button.textContent = label;
          button.addEventListener('click', () => { if (keep && !window.confirm('Replace the server record with this device’s saved version? Review other users’ changes first.')) return; resolver?.(conflict, keep); article.remove(); }); article.append(button);
        }
        dialog.append(article);
      }
      const close = document.createElement('button'); close.textContent = 'Close'; close.addEventListener('click', () => dialog.close()); dialog.append(close);
      dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
    });
    signButton = document.createElement('button'); signButton.type = 'button'; signButton.addEventListener('click', async () => {
      if (!account) return signIn();
      if (!window.confirm('Sign out on this device? Saved incident work remains on this managed device.')) return;
      try {
        const response = await nativeFetch('/api/auth/logout', { method: 'POST', headers: { 'X-EMERGENZ-CSRF': account.csrf }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Sign-out was not confirmed by the server.');
        account = null; location.reload();
      } catch {
        window.alert('Unable to confirm sign-out. Reconnect and try again before leaving this device.');
      }
    });
    installButton = document.createElement('button'); installButton.type = 'button'; installButton.textContent = 'Install App'; installButton.addEventListener('click', async () => {
      if (installPrompt) { await installPrompt.prompt(); installPrompt = null; }
      else window.alert('Use your browser’s Install App or Add to Home Screen option. On iPhone/iPad, open Share, then Add to Home Screen.');
    });
    updateButton = document.createElement('button'); updateButton.type = 'button'; updateButton.hidden = true; updateButton.textContent = 'Update Available';
    const settingsButton = document.createElement('button'); settingsButton.type = 'button'; settingsButton.className = 'em-platform-settings-link'; settingsButton.textContent = 'Details'; settingsButton.setAttribute('aria-label', 'Open connection and app settings');
    settingsButton.addEventListener('click', () => { window.HazMatIQ?.showView?.('settings'); document.getElementById('platform-settings-title')?.scrollIntoView({ block: 'nearest' }); });
    bar.append(status, warning, conflictButton, settingsButton); document.body.prepend(bar); mountSettingsControls(); draw();
    if ('serviceWorker' in navigator && window.isSecureContext) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' });
        const ready = () => { updateButton.hidden = !registration.waiting; };
        ready(); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', ready));
        updateButton.addEventListener('click', () => {
          if (!window.confirm('Save your work before updating. Update and reload now?')) return;
          if (window.EMERGENZPendingIncidentCount?.() > 0) return window.alert('Sync or resolve pending incident changes before updating.');
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
          registration.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' });
        });
      } catch { installCacheError = 'App installation cache unavailable · browser mode remains available'; draw(); }
    }
  });
})();

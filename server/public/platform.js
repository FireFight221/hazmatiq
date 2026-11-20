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
  let checkForUpdate = () => {};
  // App updates: the served page carries its build id; /app-version.json reports
  // the build now deployed. A difference means this open tab is stale.
  const buildMeta = document.querySelector('meta[name="emergenz-build"]');
  const loadedBuild = buildMeta && typeof buildMeta.getAttribute === 'function' ? buildMeta.getAttribute('content') || null : null;
  const AUTO_UPDATE_KEY = 'emergenz.autoUpdate';
  const AUTO_UPDATE_DELAY_SEC = 30;
  let latestVersion = null, versionCheckedAt = null, versionCheckError = '', updateReady = false, updatePostponedUntil = 0;
  let countdownTimer = null, countdownLeft = 0, postponeButton = null, swRegistration = null;
  let updateDetail, updateStatusDetail, checkUpdateButton, installUpdateButton, autoUpdateInput, syncNowButton, syncBusy = false;
  function storageGet(key) { try { return window.localStorage?.getItem(key) ?? null; } catch { return null; } }
  function storageSet(key, value) { try { window.localStorage?.setItem(key, value); } catch { /* private mode */ } }
  function autoUpdateEnabled() { return storageGet(AUTO_UPDATE_KEY) !== 'off'; }
  function shortBuild(version) { return version ? [version.build, version.commit ? `commit ${version.commit}` : ''].filter(Boolean).join(' · ') : ''; }
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
    if (updateButton) {
      updateButton.hidden = !updateReady;
      updateButton.textContent = countdownTimer ? `Updating in ${countdownLeft}s · Update Now` : 'Update Available · Tap to Install';
      bar.dataset.updating = countdownTimer ? 'countdown' : updateReady ? 'available' : 'none';
    }
    if (postponeButton) postponeButton.hidden = !countdownTimer;
    if (updateDetail) updateDetail.textContent = `This device: ${loadedBuild || 'build not stamped'}${latestVersion ? ` · Deployed: ${shortBuild(latestVersion)}` : ''}`;
    if (updateStatusDetail) {
      updateStatusDetail.textContent = countdownTimer ? `A new version is available. Updating automatically in ${countdownLeft} seconds.`
        : updateReady ? (pending ? `A new version is available. ${pending} incident change${pending === 1 ? ' is' : 's are'} saved on this device but not yet on the server. Install Update syncs first.` : 'A new version is available. Tap Install Update to load it.')
        : versionCheckError ? versionCheckError
        : versionCheckedAt ? `Up to date · checked ${new Date(versionCheckedAt).toLocaleTimeString()}`
        : 'Checking for updates…';
    }
    if (installUpdateButton) installUpdateButton.disabled = !updateReady || syncBusy;
    if (syncNowButton) { syncNowButton.disabled = syncBusy; syncNowButton.textContent = syncBusy ? 'Syncing…' : pending ? `Sync ${pending} Change${pending === 1 ? '' : 's'} Now` : 'Sync Now'; }
    if (autoUpdateInput) autoUpdateInput.checked = autoUpdateEnabled();
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
    syncNowButton = document.createElement('button'); syncNowButton.type = 'button'; syncNowButton.id = 'platform-sync-now';
    syncNowButton.addEventListener('click', () => { void syncNow(); });
    const actions = document.createElement('div'); actions.className = 'settings-actions'; actions.append(syncNowButton, signButton, installButton);
    const updatesTitle = document.createElement('h3'); updatesTitle.id = 'platform-updates-title'; updatesTitle.textContent = 'App Updates';
    updateDetail = document.createElement('p'); updateDetail.id = 'platform-update-version';
    updateStatusDetail = document.createElement('p'); updateStatusDetail.id = 'platform-update-status'; updateStatusDetail.setAttribute('role', 'status'); updateStatusDetail.setAttribute('aria-live', 'polite');
    const autoLabel = document.createElement('label'); autoLabel.className = 'em-platform-toggle';
    autoUpdateInput = document.createElement('input'); autoUpdateInput.type = 'checkbox'; autoUpdateInput.id = 'platform-auto-update';
    autoUpdateInput.addEventListener('change', () => {
      storageSet(AUTO_UPDATE_KEY, autoUpdateInput.checked ? 'on' : 'off');
      if (!autoUpdateInput.checked) stopCountdown(); else maybeAutoUpdate();
      draw();
    });
    const autoText = document.createElement('span'); autoText.textContent = 'Install updates automatically (30-second notice, never while changes are unsynced)';
    autoLabel.append(autoUpdateInput, autoText);
    checkUpdateButton = document.createElement('button'); checkUpdateButton.type = 'button'; checkUpdateButton.id = 'platform-check-update'; checkUpdateButton.textContent = 'Check for Updates';
    checkUpdateButton.addEventListener('click', () => { void checkVersion(true); });
    installUpdateButton = document.createElement('button'); installUpdateButton.type = 'button'; installUpdateButton.id = 'platform-install-update'; installUpdateButton.textContent = 'Install Update';
    installUpdateButton.addEventListener('click', () => requestUpdate(true));
    const updateActions = document.createElement('div'); updateActions.className = 'settings-actions'; updateActions.append(checkUpdateButton, installUpdateButton);
    card.append(connectionDetail, accountDetail, installDetail, actions, updatesTitle, updateDetail, updateStatusDetail, autoLabel, updateActions); grid.append(card); draw();
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
  function stopCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null; countdownLeft = 0;
  }
  function blockedByPendingWork() { return (window.EMERGENZPendingIncidentCount?.() || 0) > 0; }
  function applyUpdate() {
    stopCountdown();
    const reload = () => location.reload();
    const waiting = swRegistration?.waiting;
    if (waiting && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
      waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      // The shell is network-first, so a plain reload also loads the new build
      // if the worker hand-off is slow.
      setTimeout(reload, 4000);
    } else {
      reload();
    }
  }
  async function syncNow() {
    if (syncBusy || typeof window.EMERGENZSyncIncidentsNow !== 'function') return { pending: window.EMERGENZPendingIncidentCount?.() || 0, conflicts: conflicts.length };
    syncBusy = true; draw();
    try { return await window.EMERGENZSyncIncidentsNow(); }
    catch { return { pending: window.EMERGENZPendingIncidentCount?.() || 0, conflicts: conflicts.length }; }
    finally { syncBusy = false; draw(); }
  }
  async function requestUpdate(manual) {
    if (blockedByPendingWork() && manual) {
      stopCountdown();
      const result = await syncNow();
      if (/local save failed/i.test(syncText)) { window.alert('This device could not save some changes locally. Keep this tab open until they reach the server, then update.'); return; }
      if (result.conflicts) { window.alert(`Review ${result.conflicts} sync conflict${result.conflicts === 1 ? '' : 's'} (top bar) before updating.`); return; }
      if (result.pending && !window.confirm(`${result.pending} incident change${result.pending === 1 ? ' is' : 's are'} still waiting for the server. They are saved on this device and will keep syncing after the update. Update and reload now?`)) return;
      if (!result.pending && !window.confirm('All changes are synced. Update and reload now?')) return;
      applyUpdate(); return;
    }
    if (blockedByPendingWork()) { stopCountdown(); draw(); return; }
    if (manual && !countdownTimer && !window.confirm('Save your work before updating. Update and reload now?')) return;
    applyUpdate();
  }
  function maybeAutoUpdate() {
    if (!updateReady || countdownTimer || !autoUpdateEnabled() || Date.now() < updatePostponedUntil) return;
    if (blockedByPendingWork() || document.visibilityState === 'hidden') return;
    countdownLeft = AUTO_UPDATE_DELAY_SEC;
    countdownTimer = setInterval(() => {
      if (blockedByPendingWork()) { stopCountdown(); draw(); return; }
      countdownLeft -= 1; draw();
      if (countdownLeft <= 0) applyUpdate();
    }, 1000);
    draw();
  }
  function markUpdateReady() {
    if (!updateReady) updateReady = true;
    draw(); maybeAutoUpdate();
  }
  async function checkVersion(manual) {
    if (!navigator.onLine) { versionCheckError = 'Offline · updates are checked when the connection returns.'; draw(); return; }
    try {
      const response = await nativeFetch('/app-version.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Version check unavailable');
      const version = await response.json();
      versionCheckError = ''; versionCheckedAt = Date.now();
      if (version && typeof version.build === 'string') {
        latestVersion = version;
        if (loadedBuild && version.build !== loadedBuild) markUpdateReady();
      }
      if (swRegistration && typeof swRegistration.update === 'function') await Promise.resolve(swRegistration.update()).catch(() => {});
      draw();
    } catch {
      versionCheckError = manual ? 'Could not reach the server to check for updates. Try again when connected.' : 'Update check unavailable · will retry.';
      draw();
    }
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
  window.addEventListener('online', () => { serverConnected = null; draw(); checkForUpdate(); }); window.addEventListener('offline', () => { serverConnected = false; draw(); });
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
    updateButton = document.createElement('button'); updateButton.type = 'button'; updateButton.hidden = true; updateButton.className = 'em-platform-update'; updateButton.textContent = 'Update Available · Tap to Install'; updateButton.setAttribute('aria-label', 'A new EMERGENZ version is available. Install the update and reload.');
    const settingsButton = document.createElement('button'); settingsButton.type = 'button'; settingsButton.className = 'em-platform-settings-link'; settingsButton.textContent = 'Details'; settingsButton.setAttribute('aria-label', 'Open connection and app settings');
    settingsButton.addEventListener('click', () => { window.HazMatIQ?.showView?.('settings'); document.getElementById('platform-settings-title')?.scrollIntoView({ block: 'nearest' }); });
    postponeButton = document.createElement('button'); postponeButton.type = 'button'; postponeButton.hidden = true; postponeButton.className = 'em-platform-postpone'; postponeButton.textContent = 'Postpone';
    postponeButton.setAttribute('aria-label', 'Postpone the automatic update for 30 minutes');
    postponeButton.addEventListener('click', () => { stopCountdown(); updatePostponedUntil = Date.now() + 30 * 60 * 1000; draw(); });
    updateButton.addEventListener('click', () => requestUpdate(true));
    bar.append(status, warning, conflictButton, updateButton, postponeButton, settingsButton); document.body.prepend(bar); mountSettingsControls(); draw();
    // Long-running scene tabs never reload on their own: check for a new deploy
    // shortly after load, every 5 minutes, when the tab is shown again and when
    // the device comes back online.
    checkForUpdate = () => { void checkVersion(false); };
    setTimeout(checkForUpdate, 5000);
    setInterval(checkForUpdate, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkForUpdate(); maybeAutoUpdate(); } });
    if ('serviceWorker' in navigator && window.isSecureContext) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' });
        swRegistration = registration;
        const ready = async () => {
          if (!registration.waiting) return;
          if (!latestVersion) await checkVersion(false);
          if (!registration.waiting) return;
          // The shell is network-first, so a freshly loaded page may already run
          // the build the waiting worker caches: activate it silently. Otherwise
          // the waiting worker signals a new deploy.
          if (loadedBuild && latestVersion && latestVersion.build === loadedBuild && !updateReady) registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
          else markUpdateReady();
        };
        void ready(); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => { void ready(); }));
      } catch { installCacheError = 'App installation cache unavailable · browser mode remains available'; draw(); }
    }
  });
})();

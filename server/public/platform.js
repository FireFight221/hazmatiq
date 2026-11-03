(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  let account = null, required = null, installPrompt = null, releaseAccess;
  let syncText = 'Checking connection…', conflicts = [], resolver = null;
  const accessReady = new Promise((resolve) => { releaseAccess = resolve; });
  const domReady = document.readyState === 'loading' ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
  let bar, status, signButton, installButton, updateButton, conflictButton, login;
  function draw() {
    if (!bar) return;
    status.textContent = `${navigator.onLine ? syncText : 'Offline · live feeds unavailable'}${account ? ` · ${account.displayName}` : required === null ? ' · Account status unavailable' : required ? ' · Sign-in enabled' : ' · Pilot access: sign-in not enabled'}`;
    conflictButton.hidden = !conflicts.length;
    conflictButton.textContent = `Review ${conflicts.length} sync conflict${conflicts.length === 1 ? '' : 's'}`;
    signButton.hidden = !required;
    signButton.textContent = account ? 'Sign Out' : 'Sign In';
    installButton.hidden = Boolean(window.matchMedia('(display-mode: standalone)').matches);
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
    status(message) { syncText = message; draw(); },
    conflicts(items, resolve) { conflicts = items; resolver = resolve; draw(); },
  };
  void nativeFetch('/api/auth/session', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then((r) => { if (!r.ok) throw new Error('Session unavailable'); return r.json(); }).then((data) => {
    required = data.required; account = data.user;
    if (required && !account) void signIn(); else releaseAccess(); draw();
  }).catch(() => { syncText = 'Connection unavailable · using this device’s saved work'; releaseAccess(); draw(); });
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; draw(); });
  window.addEventListener('online', draw); window.addEventListener('offline', draw);
  void domReady.then(async () => {
    bar = document.createElement('aside'); bar.className = 'em-platform-bar'; bar.setAttribute('aria-label', 'Application connection and account');
    status = document.createElement('span'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
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
    bar.append(status, conflictButton, signButton, installButton, updateButton); document.body.prepend(bar); draw();
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
      } catch { syncText = 'App installation cache unavailable · browser mode remains available'; draw(); }
    }
  });
})();

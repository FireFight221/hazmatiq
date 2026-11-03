(function (global) {
  'use strict';
  // Persistent metadata only. Incident content stays in the existing incident store.
  function createTracker(storage, key = 'emergenz.incident-outbox.v1') {
    let state;
    try { state = JSON.parse(storage.getItem(key) || '{}'); } catch { state = {}; }
    if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
    state.pending = Object.assign(Object.create(null), state.pending || {});
    state.versions = Object.assign(Object.create(null), state.versions || {});
    const persist = () => { try { storage.setItem(key, JSON.stringify(state)); return true; } catch { return false; } };
    return {
      enqueue(id, unknownBase = false) {
        state.pending[id] = { mutation: global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, base: unknownBase ? null : state.versions[id] };
        return persist();
      },
      batch() { return Object.entries(state.pending).map(([id, item]) => ({ id, ...item })); },
      acknowledge(id, mutation, revision) {
        state.versions[id] = revision;
        if (state.pending[id]?.mutation === mutation) delete state.pending[id];
        else if (state.pending[id]) state.pending[id].base = revision;
        persist();
      },
      observe(id, revision) { state.versions[id] = revision; persist(); },
      has(id) { return Boolean(state.pending[id]); },
      resolve(id, revision, keepLocal) {
        state.versions[id] = revision;
        delete state.pending[id];
        if (keepLocal) this.enqueue(id); else persist();
      },
      count() { return Object.keys(state.pending).length; },
    };
  }
  global.EMERGENZSync = { createTracker };
})(typeof window === 'undefined' ? globalThis : window);

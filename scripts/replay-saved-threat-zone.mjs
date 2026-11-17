import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Supply an exported incident; no incident data or credentials are committed.
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/replay-saved-threat-zone.mjs /path/to/incident.json');
const incident = JSON.parse(readFileSync(input, 'utf8'));
const original = JSON.stringify(incident);
const saved = incident.plumeModelResults;
const geometry = saved.output?.geometry || saved.plumeResult?.output?.geometry;
assert.ok(geometry?.features?.length, 'Saved 2D geometry is required');
const base = process.env.REPLAY_BASE_URL || 'http://127.0.0.1:3000/';
const report = { incidentId: incident.incidentId, originalAffectedIncidentIdentified: false, savedRun: saved.id, screens: [] };
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let modelRequests = 0;
    await page.route('**/api/incidents**', (route) => route.fulfill({ json: { incidents: [] } }));
    await page.route('**/api/plume/run', (route) => { modelRequests += 1; return route.abort(); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((source) => {
      // A completed record is replayed only in this isolated browser context.
      writeIncidents([{ ...source, status: 'Active' }], { sync: false });
      localStorage.setItem(activeIncidentIdStorageKey, source.incidentId);
      window.HazMatIQ.activatePage('incident');
      window.HazMatIQ.refreshIncidentCommand();
    }, incident);
    assert.equal(await page.locator('#ic-plume-status').innerText(), 'PLOTTED');
    await page.locator('.app-nav-item[data-view="plume"]').click();
    await page.waitForFunction((id) => latestPlumeModelResult?.id === id && currentThreatZoneGeoJson?.features?.length === 3, saved.id, { timeout: 30000 });
    await page.waitForTimeout(750);
    const display = await page.evaluate(() => ({
      resultId: latestPlumeModelResult.id,
      geometry: currentThreatZoneGeoJson,
      sourceGeometry: plumeMap.getSource('hazmat-threat-zones')._data,
      rows: threatZonePanelData(latestPlumeModelResult, threatIntelligence, currentThreatZoneGeoJson.features).rows,
      releaseDuration: document.getElementById('plume-command-release-duration').textContent,
      targets: threatIntelligence.affectedFacilities,
      renderedTargets: (threatIntelligence.affectedFacilities || []).map((target) => ({
        name: target.name,
        zones: plumeMap.queryRenderedFeatures(plumeMap.project([target.longitude, target.latitude]), { layers: ['hazmat-threat-zones-fill'] }).map((feature) => feature.properties.label),
      })),
    }));
    assert.equal(display.resultId, saved.id);
    assert.deepEqual(display.geometry, geometry);
    assert.deepEqual(display.sourceGeometry, geometry);
    for (const row of display.rows) {
      const zone = geometry.features.find((feature) => Number(feature.properties.thresholdLevel) === row.level).properties;
      assert.ok(row.downwind.includes(Number(zone.maxDownwindM).toLocaleString('en-US', { maximumFractionDigits: 3 })));
      assert.equal(row.duration, '60 min');
    }
    assert.equal(display.releaseDuration, 'Not recorded');
    assert.ok(display.targets.length >= 3);
    for (const target of display.renderedTargets) assert.ok(target.zones.includes('AEGL-1'), `${target.name} must render inside AEGL-1`);
    await page.locator('#plume-threat-zone-open-btn').click();
    const dialog = page.locator('#plume-threat-zone-dialog');
    assert.ok(await dialog.isVisible());
    for (const target of display.targets) assert.ok((await dialog.innerText()).includes(target.name));
    await page.locator('#plume-threat-zone-dialog-close').click();
    await page.locator('.app-nav-item[data-view="incident"]').click();
    await page.locator('#ic-plume-preview-map').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !!commandPlumePreviewMap?.getSource('command-plume-preview-zones'));
    const command = await page.evaluate(() => ({
      geometry: commandPlumePreviewMap.getSource('command-plume-preview-zones')._data,
      facts: document.getElementById('ic-plume-preview-facts').innerText,
    }));
    assert.deepEqual(command.geometry, geometry);
    assert.ok(command.facts.includes(saved.id));
    assert.ok(command.facts.includes('60-minute'));
    assert.ok(command.facts.includes('Not recorded'));
    for (const zone of geometry.features) assert.ok(command.facts.includes(Number(zone.properties.maxDownwindM).toLocaleString('en-US', { maximumFractionDigits: 3 })));
    assert.equal(modelRequests, 0, 'Replay must not recalculate or replace the saved run');
    // Repeat navigation must retain the same run and geometry.
    await page.locator('.app-nav-item[data-view="plume"]').click();
    await page.waitForFunction((id) => latestPlumeModelResult?.id === id, saved.id);
    assert.equal(await page.evaluate(() => latestPlumeModelResult.id), saved.id);
    report.screens.push({ width, resultId: display.resultId, rows: display.rows, targets: display.renderedTargets, mapGeometryMatches: true, commandGeometryMatches: true, modelRequests });
    if (width === 1440 && process.env.REPLAY_LOOKUP_TIMING === '1') {
      report.lookups = [];
      for (const visit of ['cold', 'repeat']) {
        const started = performance.now();
        const response = await page.request.post(new URL('/api/threat-zones/facilities', base).href, { data: { zones: geometry.features }, timeout: 30000 });
        const result = await response.json();
        report.lookups.push({ visit, elapsedMs: Math.round(performance.now() - started), httpStatus: response.status(), status: result.status, targets: result.affectedFacilities, sourceStatuses: result.sourceStatuses });
      }
    }
    await page.evaluate(() => {
      const control = document.getElementById('plume-wind-speed');
      control.value = '15';
      control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => getActiveIncident()?.plumeModelResults?.requiresRecalculation === true);
    assert.equal(await page.evaluate(() => isIncidentPlumeCurrent(getActiveIncident().plumeModelResults, getActiveIncident())), false);
    assert.deepEqual(await page.evaluate(() => getActiveIncident().plumeModelResults.output.geometry), geometry);
    assert.equal(await page.locator('#ic-plume-status').innerText(), 'PLUME REQUIRES RECALCULATION');
    await page.evaluate(() => {
      const other = { incidentId: 'replay-other-incident', incidentName: 'Replay boundary check', status: 'Active' };
      writeIncidents([...readIncidents(), other], { sync: false });
      switchActiveIncident(other.incidentId);
    });
    assert.equal(await page.locator('#ic-plume-status').innerText(), 'NOT PLOTTED');
    assert.equal(await page.evaluate(() => currentThreatZoneGeoJson), null);
    await context.close();
  }
  assert.equal(JSON.stringify(incident), original);
  const output = process.env.REPLAY_REPORT || '/tmp/threat-zone-replay-report.json';
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ savedRun: report.savedRun, widths: report.screens.map((screen) => screen.width), targets: report.screens[0].targets, lookups: report.lookups?.map(({ visit, elapsedMs, httpStatus, status }) => ({ visit, elapsedMs, httpStatus, status })), report: output }));
} finally {
  await browser.close();
}

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const incidentPath = process.argv[2];
if (!incidentPath) throw new Error('Usage: node scripts/verify-map-regressions.mjs /path/to/saved-incident.json');
const incident = JSON.parse(readFileSync(incidentPath, 'utf8'));
const geometry = incident.plumeModelResults.output.geometry;
const base = process.env.MAP_BASE_URL || 'http://127.0.0.1:3000/';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const report = [];
try {
  for (const serviceWorkers of process.env.MAP_SW_MODE ? [process.env.MAP_SW_MODE] : ['block', 'allow']) {
    console.log(`Checking maps: service workers ${serviceWorkers}`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers });
    const page = await context.newPage();
    const network = [];
    page.on('response', (response) => {
      if (/rainviewer|openfreemap|arcgisonline/.test(response.url())) network.push({ url: response.url(), status: response.status(), type: response.headers()['content-type'] });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.route('**/api/incidents**', (route) => route.fulfill({ json: { incidents: [] } }));
    await page.goto(base, { waitUntil: 'load' });
    if (serviceWorkers === 'allow') await page.evaluate(async () => {
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Offline worker installation did not complete')), 20000))]);
      if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    if (serviceWorkers === 'allow') await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => {
      const OriginalMap = window.maplibregl.Map;
      window.__verifiedMaps = [];
      window.maplibregl.Map = class extends OriginalMap {
        constructor(options) { super(options); window.__verifiedMaps.push(this); }
      };
      window.HazMatIQ.weatherLocation.saveWeatherLocationState({ lat: 33.1649, lon: -86.7900 });
      window.HazMatIQ.activatePage('weather');
    });
    await page.waitForFunction(() => window.__verifiedMaps[0]?.getSource('weather-radar-source'));
    await page.evaluate(async () => {
      const map = window.__verifiedMaps[0];
      const radar = window.HazMatWeatherRadar.createController(map);
      await radar.selectProvider('NOAA_MRMS_OFFICIAL_FALLBACK');
      await radar.selectProvider('RAINVIEWER_VISUAL_PROTOTYPE');
    });
    await page.waitForFunction(() => document.getElementById('weather-map-status').textContent.includes('radar tiles loaded'));
    for (const zoom of [9, 12, 16, 6]) {
      await page.evaluate((zoom) => window.__verifiedMaps[0].jumpTo({ zoom }), zoom);
      await page.waitForTimeout(700);
      const source = await page.evaluate(() => {
        const map = window.__verifiedMaps[0];
        return { zoom: map.getZoom(), source: map.getStyle().sources['weather-radar-source'] };
      });
      assert.equal(source.zoom, zoom);
      assert.equal(source.source.maxzoom, 7);
      assert.equal(source.source.tileSize, 256);
    }
    for (const layer of ['fire', 'alerts', 'radar']) {
      await page.locator(`[data-weather-layer="${layer}"]`).click();
      await page.waitForTimeout(350);
      await page.locator(`[data-weather-layer="${layer}"]`).click();
    }
    await page.waitForTimeout(1000);
    await page.locator('[data-weather-layer="fire"]').click();
    await page.locator('#weather-map').screenshot({ path: `/tmp/weather-map-fixed-${serviceWorkers}.png` });
    const radarTiles = network.filter((item) => /rainviewer.*\/256\//.test(item.url));
    assert.ok(radarTiles.length > 0);
    assert.ok(radarTiles.every((item) => Number(item.url.match(/\/256\/(\d+)\//)[1]) <= 7));
    await page.evaluate((source) => {
      writeIncidents([{ ...source, status: 'Active' }], { sync: false });
      localStorage.setItem(activeIncidentIdStorageKey, source.incidentId);
      window.HazMatIQ.activatePage('plume');
    }, incident);
    await page.waitForFunction(() => currentThreatZoneGeoJson?.features?.length === 3);
    await page.evaluate(() => plumeMap.jumpTo({ center: [-86.787, 33.295], zoom: 13.5, bearing: 17, pitch: 10 }));
    const snapshot = await page.evaluate(() => ({
      center: plumeMap.getCenter().toArray(), zoom: plumeMap.getZoom(), bearing: plumeMap.getBearing(), pitch: plumeMap.getPitch(),
      pin: plumeSourceMarker.getLngLat().toArray(),
    }));
    for (const mode of ['street', 'satellite', 'street']) {
      await page.evaluate((mode) => setPlumeMapView(mode), mode);
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => ({
        mode: activePlumeMapView, geometry: plumeMap.getSource('hazmat-threat-zones')._data,
        center: plumeMap.getCenter().toArray(), zoom: plumeMap.getZoom(), bearing: plumeMap.getBearing(), pitch: plumeMap.getPitch(),
        pin: plumeSourceMarker.getLngLat().toArray(),
      }));
      assert.equal(state.mode, mode);
      assert.deepEqual(state.geometry, geometry);
      for (const field of ['center', 'pin']) state[field].forEach((value, index) => assert.ok(Math.abs(value - snapshot[field][index]) < 1e-7));
      for (const field of ['zoom', 'bearing', 'pitch']) assert.ok(Math.abs(state[field] - snapshot[field]) < 1e-7);
      await page.locator('#plume-gis-map').screenshot({ path: `/tmp/plume-map-fixed-${mode}-${serviceWorkers}.png` });
    }
    assert.ok(network.some((item) => item.type?.includes('vector-tile') && item.status === 200));
    assert.ok(network.some((item) => item.type?.includes('image/jpeg') && item.status === 200));
    assert.ok(!network.some((item) => /openfreemap.*fonts/.test(item.url) && item.status >= 400));
    // Force a real vector-source failure after the style itself loads.
    await page.evaluate(() => setPlumeMapView('satellite'));
    await page.route('https://tiles.openfreemap.org/planet/**', (route) => route.abort());
    await page.evaluate(() => setPlumeMapView('street'));
    await page.waitForFunction(() => activePlumeMapView === 'satellite');
    await page.waitForTimeout(700);
    const fallback = await page.evaluate(() => ({
      geometry: plumeMap.getSource('hazmat-threat-zones')._data,
      selected: document.querySelector('[data-plume-map-view="satellite"]').getAttribute('aria-pressed'),
      pin: plumeSourceMarker.getLngLat().toArray(), zoom: plumeMap.getZoom(), bearing: plumeMap.getBearing(), pitch: plumeMap.getPitch(),
    }));
    assert.deepEqual(fallback.geometry, geometry);
    assert.equal(fallback.selected, 'true');
    assert.deepEqual(fallback.pin, snapshot.pin);
    for (const field of ['zoom', 'bearing', 'pitch']) assert.ok(Math.abs(fallback[field] - snapshot[field]) < 1e-7);
    report.push({ serviceWorkers, radarRequests: radarTiles.length, radarMaxRequestedZoom: Math.max(...radarTiles.map((item) => Number(item.url.match(/\/256\/(\d+)\//)[1]))), streetAndSatelliteTiles: true, geometryAndPinPreserved: true, vectorFailureFallback: true });
    await context.close();
  }
  writeFileSync('/tmp/map-regression-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}

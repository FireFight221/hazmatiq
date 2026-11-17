import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function fixture() {
  const sources = new Map<string, Record<string, unknown>>([['satellite', { type: 'raster' }], ['fire', { type: 'geojson' }]]);
  const layers = new Map<string, Record<string, unknown>>();
  const events: Record<string, (event: Record<string, unknown>) => void> = {};
  const states: Array<Record<string, unknown>> = [];
  const noaa = { id: 'noaa', attribution: 'NOAA', displayName: 'NOAA', supportsTiles: true, getLayerConfig: async () => ({ tiles: ['noaa'], tileSize: 512, minzoom: 2, maxzoom: 17 }) };
  const rain = { id: 'rain', attribution: 'RainViewer', displayName: 'RainViewer', supportsTiles: true, supportsAnimation: true,
    getFrames: async () => [{ tiles: ['rain-frame'], timestamp: '2026-11-17T20:00:00Z' }],
    getLayerConfig: async () => ({ tiles: ['rain'], tileSize: 256, minzoom: 1, maxzoom: 7 }) };
  const map = {
    getStyle: () => ({ layers: [] }),
    getZoom: () => 9,
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: (id: string, config: Record<string, unknown>) => sources.set(id, { ...config, setTiles: vi.fn() }),
    addLayer: (layer: Record<string, unknown>) => layers.set(String(layer.id), layer),
    removeSource: (id: string) => sources.delete(id),
    removeLayer: (id: string) => layers.delete(id),
    moveLayer: vi.fn(), isStyleLoaded: () => true, isSourceLoaded: () => true,
    on: (event: string, handler: typeof events[string]) => { events[event] = handler; },
  };
  const window = { HazMatRadarProviders: {
    IDS: { NOAA: 'noaa' }, loadConfiguration: async () => {}, bestAvailableProvider: () => noaa,
    getProvider: (id: string) => id === 'rain' ? rain : noaa, providerStatus: () => 'Connected', isConfigured: () => true,
  }, setTimeout: vi.fn(), clearTimeout: vi.fn(), clearInterval: vi.fn(), dispatchEvent: vi.fn() } as Record<string, unknown>;
  runInNewContext(readFileSync(new URL('../server/public/weather-radar.js', import.meta.url), 'utf8'), {
    window, document: { addEventListener: vi.fn() }, CustomEvent: class { constructor(_type: string, _options: unknown) {} },
  });
  const controller = (window.HazMatWeatherRadar as { createController: (map: unknown, options: unknown) => {
    enable(): Promise<void>; selectProvider(id: string): Promise<void>; setFrame(index: number): void; ids: { source: string };
  } }).createController(map, { onStateChange: (state: Record<string, unknown>) => states.push(state) });
  return { controller, sources, events, states, map };
}

describe('radar raster source lifecycle', () => {
  it('replaces NOAA zoom/size/attribution when switching to RainViewer without changing map zoom', async () => {
    const { controller, sources, map } = fixture();
    await controller.enable();
    expect(sources.get(controller.ids.source)).toMatchObject({ tileSize: 512, maxzoom: 17 });
    await controller.selectProvider('rain');
    expect(sources.get(controller.ids.source)).toMatchObject({ tileSize: 256, minzoom: 1, maxzoom: 7, attribution: 'RainViewer' });
    controller.setFrame(0);
    expect(sources.get(controller.ids.source)).toMatchObject({ tileSize: 256, maxzoom: 7 });
    expect(map.getZoom()).toBe(9);
  });

  it('reports ready only after source tiles load and isolates radar failure from basemap/fire', async () => {
    const { controller, sources, events, states, map } = fixture();
    await controller.enable();
    expect(states.at(-1)?.tilesReady).toBe(false);
    events.sourcedata({ sourceId: controller.ids.source });
    expect(states.at(-1)?.tilesReady).toBe(true);
    map.getZoom = () => 0;
    events.zoomend({});
    expect(states.at(-1)).toMatchObject({ tilesReady: false, error: 'Radar is outside its supported zoom range.' });
    expect(map.getZoom()).toBe(0);
    map.getZoom = () => 9;
    events.error({ sourceId: controller.ids.source, error: new Error('Tile unavailable') });
    expect(states.at(-1)).toMatchObject({ tilesReady: false, status: 'Unavailable', error: 'Tile unavailable' });
    expect(sources.has(controller.ids.source)).toBe(false);
    expect(sources.has('satellite')).toBe(true);
    expect(sources.has('fire')).toBe(true);
  });
});

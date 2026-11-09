// Test that MainControlPanel shows correct controls per mode
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';

// Set up minimal DOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document as any;
global.HTMLElement = dom.window.HTMLElement as any;
global.window = dom.window as any;

import { MainControlPanel } from '../src/ui/MainControlPanel';
import AudioAnalyzer from '../src/audio';
import ModulationSystem from '../src/modulation';

// Mock params object
function createMockParams(mode: string) {
  return {
    mode,
    seed: 1234,
    paused: false,
    // 2D Flow params
    noiseScale: 1.5,
    evolution: 0.1,
    curl: 1.0,
    turbulence: 0.5,
    speed: 1.0,
    life: 0.5,
    decay: 0.95,
    pointSize: 2.0,
    gain: 0.1,
    // 3D Fabric params
    fold: 0.5,
    warp: 1.0,
    scale3d: 1.0,
    detail: 3,
    layers: 3,
    evolution3d: 0.1,
    gloss: 64,
    spec: 1.0,
    iridescence: 0.5,
    saturation: 1.0,
    brightness: 1.0,
    camDist: 3.0,
    fov: 60,
    orbitSpeed: 0.1,
    // Particle Fabric params
    mass: 1.0,
    stiffness: 1.0,
    damping: 0.5,
    wind: 0.5,
    stream: 1.0,
    pLife: 0.5,
    vmax: 10,
    pWidth: 2.0,
    pGain: 0.1,
    // Grass Field params
    gOn: true,
    gH: 0.5,
    gW: 0.02,
    gCurv: 0.5,
    gDensity: 256,
    gWind: 1.0,
    gWindAz: 0,
    gGustK: 1.0,
    gGustSpeed: 1.0,
    gcDist: 3.0,
    gcHeight: 1.0,
    gcFov: 60,
    // Liquid Spheres / Wall Studio params
    lsRadius: 0.04,
    lsDrip: 100,
    lsVisc: 0.1,
    lsCoh: 0.5,
    // Fractal params
    frType: 0,
    frPower: 8,
    frIter: 12,
    frBailout: 2,
    frScale: -2,
    frCamDist: 3.0,
    frCamFov: 60,
    frRotSpeed: 0.1,
    frLightAz: 45,
    frLightEl: 45,
    frAmbient: 0.3,
    frDiffuse: 1.0,
    frGlow: 0.5,
    frMaxSteps: 128,
    frMaxDist: 20,
    // Universal params
    exposure: 1.0,
    bloom: 0.5,
    hueShift: 0,
  };
}

// Helper to get visible control params from panel
function getVisibleControlParams(panel: MainControlPanel): Set<string> {
  const container = (panel as any).container;
  const params = new Set<string>();
  
  container.querySelectorAll('[data-param]').forEach((el: any) => {
    const section = el.closest('.panel-section');
    // Skip if section is hidden or collapsed
    if (section && !section.classList.contains('hidden')) {
      const param = el.dataset.param;
      if (param) params.add(param);
    }
  });
  
  return params;
}

test('MainControlPanel > 2D Flow mode shows correct controls', () => {
  const params = createMockParams('2D flow');
  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  const visible = getVisibleControlParams(panel);
  
  // Should have scene controls
  expect(visible.has('mode')).toBe(true);
  expect(visible.has('seed')).toBe(true);
  expect(visible.has('paused')).toBe(true);
  
  // Should have 2D flow specific controls
  expect(visible.has('noiseScale')).toBe(true);
  expect(visible.has('evolution')).toBe(true);
  expect(visible.has('curl')).toBe(true);
  expect(visible.has('turbulence')).toBe(true);
  expect(visible.has('life')).toBe(true);
  expect(visible.has('decay')).toBe(true);
  
  // Should have universal color controls
  expect(visible.has('exposure')).toBe(true);
  expect(visible.has('bloom')).toBe(true);
  
  // Should NOT have fractal controls
  expect(visible.has('frPower')).toBe(false);
  expect(visible.has('frIter')).toBe(false);
  
  // Should NOT have grass controls
  expect(visible.has('gH')).toBe(false);
  expect(visible.has('gWind')).toBe(false);
  
  panel.destroy();
});

test('MainControlPanel > 3D Fractal mode shows correct controls', () => {
  const params = createMockParams('3D Fractal');
  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  const visible = getVisibleControlParams(panel);
  
  // Should have scene controls
  expect(visible.has('mode')).toBe(true);
  expect(visible.has('seed')).toBe(true);
  
  // Should have fractal specific controls
  expect(visible.has('frType')).toBe(true);
  expect(visible.has('frPower')).toBe(true);
  expect(visible.has('frIter')).toBe(true);
  expect(visible.has('frBailout')).toBe(true);
  expect(visible.has('frCamDist')).toBe(true);
  expect(visible.has('frLightAz')).toBe(true);
  expect(visible.has('frMaxSteps')).toBe(true);
  
  // Should have universal controls
  expect(visible.has('exposure')).toBe(true);
  expect(visible.has('bloom')).toBe(true);
  
  // Should NOT have 2D flow controls
  expect(visible.has('noiseScale')).toBe(false);
  expect(visible.has('curl')).toBe(false);
  
  // Should NOT have grass controls
  expect(visible.has('gH')).toBe(false);
  
  panel.destroy();
});

test('MainControlPanel > 3D fabric mode shows correct controls', () => {
  const params = createMockParams('3D fabric');
  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  const visible = getVisibleControlParams(panel);
  
  // Should have fabric shape controls
  expect(visible.has('fold')).toBe(true);
  expect(visible.has('warp')).toBe(true);
  expect(visible.has('scale3d')).toBe(true);
  expect(visible.has('layers')).toBe(true);
  
  // Should have material controls
  expect(visible.has('gloss')).toBe(true);
  expect(visible.has('spec')).toBe(true);
  expect(visible.has('iridescence')).toBe(true);
  
  // Should have camera controls
  expect(visible.has('camDist')).toBe(true);
  expect(visible.has('fov')).toBe(true);
  
  // Should NOT have fractal controls
  expect(visible.has('frPower')).toBe(false);
  
  panel.destroy();
});

test('MainControlPanel > Particle Fabric mode shows correct controls', () => {
  const params = createMockParams('Particle Fabric');
  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  const visible = getVisibleControlParams(panel);
  
  // Should have physics controls
  expect(visible.has('mass')).toBe(true);
  expect(visible.has('stiffness')).toBe(true);
  expect(visible.has('damping')).toBe(true);
  expect(visible.has('wind')).toBe(true);
  
  // Should have particle controls
  expect(visible.has('stream')).toBe(true);
  expect(visible.has('pLife')).toBe(true);
  expect(visible.has('vmax')).toBe(true);
  
  // Should NOT have fractal controls
  expect(visible.has('frPower')).toBe(false);
  
  // Should NOT have grass controls
  expect(visible.has('gH')).toBe(false);
  
  panel.destroy();
});

test('MainControlPanel > Grass Field mode shows correct controls', () => {
  const params = createMockParams('Grass Field');
  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  const visible = getVisibleControlParams(panel);
  
  // Should have grass controls
  expect(visible.has('gOn')).toBe(true);
  expect(visible.has('gH')).toBe(true);
  expect(visible.has('gW')).toBe(true);
  expect(visible.has('gCurv')).toBe(true);
  expect(visible.has('gDensity')).toBe(true);
  
  // Should have wind controls
  expect(visible.has('gWind')).toBe(true);
  expect(visible.has('gWindAz')).toBe(true);
  
  // Should have camera controls
  expect(visible.has('gcDist')).toBe(true);
  expect(visible.has('gcHeight')).toBe(true);
  
  // Should NOT have fractal controls
  expect(visible.has('frPower')).toBe(false);
  
  // Should NOT have 2D flow controls
  expect(visible.has('noiseScale')).toBe(false);
  
  panel.destroy();
});

test('MainControlPanel > Wall Studio mode shows correct controls', () => {
  const params = createMockParams('Wall Studio');
  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  const visible = getVisibleControlParams(panel);
  
  // Should have fabric controls
  expect(visible.has('fold')).toBe(true);
  expect(visible.has('warp')).toBe(true);
  
  // Should have sphere controls
  expect(visible.has('lsRadius')).toBe(true);
  expect(visible.has('lsDrip')).toBe(true);
  expect(visible.has('lsVisc')).toBe(true);
  
  // Should have camera controls
  expect(visible.has('camDist')).toBe(true);
  
  // Should NOT have fractal controls
  expect(visible.has('frPower')).toBe(false);
  
  // Should NOT have grass controls
  expect(visible.has('gH')).toBe(false);
  
  panel.destroy();
});

test('MainControlPanel > Liquid Spheres mode shows correct controls', () => {
  const params = createMockParams('Liquid Spheres');
  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  const visible = getVisibleControlParams(panel);
  
  // Should have fabric controls
  expect(visible.has('fold')).toBe(true);
  
  // Should have sphere controls
  expect(visible.has('lsRadius')).toBe(true);
  expect(visible.has('lsVisc')).toBe(true);
  
  // Should NOT have fractal controls
  expect(visible.has('frPower')).toBe(false);
  
  panel.destroy();
});

test('MainControlPanel > All modes have universal controls', () => {
  const modes = ['2D flow', '3D fabric', 'Particle Fabric', 'Grass Field', 'Wall Studio', 'Liquid Spheres', '3D Fractal'];
  
  for (const mode of modes) {
    const params = createMockParams(mode);
    const audioAnalyzer = new AudioAnalyzer();
    const modulationSystem = new ModulationSystem();
    
    const panel = new MainControlPanel({
      params,
      audioState: audioAnalyzer.state,
      modulationSystem,
    });
    
    const visible = getVisibleControlParams(panel);
    
    // All modes should have scene controls
    expect(visible.has('mode')).toBe(true);
    expect(visible.has('seed')).toBe(true);
    expect(visible.has('paused')).toBe(true);
    
    // All modes should have color controls
    expect(visible.has('exposure')).toBe(true);
    expect(visible.has('bloom')).toBe(true);
    expect(visible.has('hueShift')).toBe(true);
    
    panel.destroy();
  }
});

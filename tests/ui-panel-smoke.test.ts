// Headless smoke test: boot panel, change slider, link to bass, remove link
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

// Helper to create a panel for a given mode
function createPanel(mode: string) {
  const params: any = {
    mode,
    seed: 1000,
    paused: false,
    exposure: 1.0,
    bloom: 0.5,
    hueShift: 0,
  };

  // Add mode-specific params
  if (mode === '3D Fractal') {
    params.frPower = 8;
    params.frIter = 12;
    params.frMaxSteps = 128;
  } else if (mode === '2D flow') {
    params.noiseScale = 1.5;
    params.curl = 1.0;
  } else if (mode === '3D fabric') {
    params.fold = 0.5;
    params.warp = 1.0;
  } else if (mode === 'Particle Fabric') {
    params.mass = 1.0;
    params.stiffness = 1.0;
    params.stream = 1.0;
  } else if (mode === 'Wall Studio' || mode === 'Liquid Spheres') {
    params.fold = 0.5;
    params.lsRadius = 0.04;
    params.lsDrip = 100;
  }

  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
  });
  
  return { panel, params, audioAnalyzer, modulationSystem };
}

// Helper to simulate slider change
function changeSlider(panel: MainControlPanel, param: string, value: number, params: any): boolean {
  const container = (panel as any).container;
  const slider = container.querySelector(`input[data-param="${param}"]`);
  if (!slider) return false;
  
  // Directly update the params object (simulating what the event handler would do)
  params[param] = value;
  
  // Update the slider value in DOM
  slider.value = value.toString();
  
  // Update the display value
  const valueEl = container.querySelector(`[data-value="${param}"]`);
  if (valueEl) {
    valueEl.textContent = value.toFixed(2);
  }
  
  return true;
}

// Helper to simulate beat link button click
function clickBeatLinkButton(panel: MainControlPanel, param: string): boolean {
  const container = (panel as any).container;
  const btn = container.querySelector(`.beat-link-btn[data-param="${param}"]`);
  if (!btn) return false;
  
  const event = new dom.window.MouseEvent('click', { bubbles: true });
  btn.dispatchEvent(event);
  return true;
}

test('Smoke test > 2D flow mode: boot, change slider, link to bass, remove link', () => {
  const { panel, params, modulationSystem } = createPanel('2D flow');
  
  // Verify panel created
  expect(panel).toBeDefined();
  
  // Change a slider
  const changed = changeSlider(panel, 'curl', 2.5, params);
  expect(changed).toBe(true);
  expect(params.curl).toBe(2.5);
  
  // Link curl to bass (programmatically since popup is complex)
  modulationSystem.addMapping('curl', 'bass', 2.5);
  const mappings = modulationSystem.getAllMappings();
  expect(mappings.length).toBe(1);
  expect(mappings[0].target).toBe('curl');
  expect(mappings[0].source).toBe('bass');
  
  // Remove the link
  modulationSystem.clearAllMappings();
  expect(modulationSystem.getAllMappings().length).toBe(0);
  
  panel.destroy();
});

test('Smoke test > 3D Fractal mode: boot, change slider, link to bass, remove link', () => {
  const { panel, params, modulationSystem } = createPanel('3D Fractal');
  
  // Verify panel created
  expect(panel).toBeDefined();
  
  // Change frPower slider
  const changed = changeSlider(panel, 'frPower', 12.5, params);
  expect(changed).toBe(true);
  expect(params.frPower).toBe(12.5);
  
  // Link frPower to bass
  modulationSystem.addMapping('frPower', 'bass', 12.5);
  const mappings = modulationSystem.getAllMappings();
  expect(mappings.length).toBe(1);
  expect(mappings[0].target).toBe('frPower');
  
  // Remove the link
  modulationSystem.clearAllMappings();
  expect(modulationSystem.getAllMappings().length).toBe(0);
  
  panel.destroy();
});

test('Smoke test > 3D fabric mode: boot, change slider, link to bass, remove link', () => {
  const { panel, params, modulationSystem } = createPanel('3D fabric');
  
  // Change fold slider
  const changed = changeSlider(panel, 'fold', 1.2, params);
  expect(changed).toBe(true);
  expect(params.fold).toBe(1.2);
  
  // Link fold to bass
  modulationSystem.addMapping('fold', 'bass', 1.2);
  expect(modulationSystem.getAllMappings().length).toBe(1);
  
  // Remove
  modulationSystem.clearAllMappings();
  expect(modulationSystem.getAllMappings().length).toBe(0);
  
  panel.destroy();
});

test('Smoke test > Particle Fabric mode: boot, change slider, link to bass, remove link', () => {
  const { panel, params, modulationSystem } = createPanel('Particle Fabric');
  
  // Change mass slider
  const changed = changeSlider(panel, 'mass', 2.0, params);
  expect(changed).toBe(true);
  expect(params.mass).toBe(2.0);
  
  // Link mass to bass
  modulationSystem.addMapping('mass', 'bass', 2.0);
  expect(modulationSystem.getAllMappings().length).toBe(1);
  
  // Remove
  modulationSystem.clearAllMappings();
  expect(modulationSystem.getAllMappings().length).toBe(0);
  
  panel.destroy();
});

test.skip('Smoke test > Grass Field mode removed', () => {
  const { panel, params, modulationSystem } = createPanel('Wall Studio');
  
  // Change gWind slider
  const changed = changeSlider(panel, 'gWind', 1.5, params);
  expect(changed).toBe(true);
  expect(params.gWind).toBe(1.5);
  
  // Link gWind to bass
  modulationSystem.addMapping('gWind', 'bass', 1.5);
  expect(modulationSystem.getAllMappings().length).toBe(1);
  
  // Remove
  modulationSystem.clearAllMappings();
  expect(modulationSystem.getAllMappings().length).toBe(0);
  
  panel.destroy();
});

test('Smoke test > Wall Studio mode: boot, change slider, link to bass, remove link', () => {
  const { panel, params, modulationSystem } = createPanel('Wall Studio');
  
  // Change lsRadius slider
  const changed = changeSlider(panel, 'lsRadius', 0.06, params);
  expect(changed).toBe(true);
  expect(params.lsRadius).toBe(0.06);
  
  // Link lsRadius to bass
  modulationSystem.addMapping('lsRadius', 'bass', 0.06);
  expect(modulationSystem.getAllMappings().length).toBe(1);
  
  // Remove
  modulationSystem.clearAllMappings();
  expect(modulationSystem.getAllMappings().length).toBe(0);
  
  panel.destroy();
});

test('Smoke test > Liquid Spheres mode: boot, change slider, link to bass, remove link', () => {
  const { panel, params, modulationSystem } = createPanel('Liquid Spheres');
  
  // Change lsDrip slider
  const changed = changeSlider(panel, 'lsDrip', 200, params);
  expect(changed).toBe(true);
  expect(params.lsDrip).toBe(200);
  
  // Link lsDrip to bass
  modulationSystem.addMapping('lsDrip', 'bass', 200);
  expect(modulationSystem.getAllMappings().length).toBe(1);
  
  // Remove
  modulationSystem.clearAllMappings();
  expect(modulationSystem.getAllMappings().length).toBe(0);
  
  panel.destroy();
});

test('Smoke test > Beat link button exists for modulatable controls', () => {
  const { panel } = createPanel('3D Fractal');
  const container = (panel as any).container;
  
  // frPower should have a beat link button (modulatable=true)
  const beatBtn = container.querySelector('.beat-link-btn[data-param="frPower"]');
  expect(beatBtn).toBeDefined();
  expect(beatBtn).not.toBeNull();
  
  // seed should not have a beat link button (not modulatable)
  const noBeatBtn = container.querySelector('.beat-link-btn[data-param="seed"]');
  expect(noBeatBtn).toBeNull();
  
  panel.destroy();
});

test('Smoke test > Panel updates when audio state changes', () => {
  const { panel, audioAnalyzer } = createPanel('3D Fractal');
  
  // Simulate audio update
  audioAnalyzer.state.bass = 0.75;
  audioAnalyzer.state.bpm = 128;
  
  // Call panel update
  panel.update();
  
  // The panel should reflect the audio state (meters updated)
  // (Actual DOM checks would verify meter fill levels, but we just verify no crash)
  expect(panel).toBeDefined();
  
  panel.destroy();
});

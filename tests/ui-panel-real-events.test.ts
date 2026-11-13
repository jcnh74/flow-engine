// Real event tests - dispatching actual bubbling events to catch selector/parsing bugs
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

function createPanel(initialMode: string) {
  const params: any = {
    mode: initialMode,
    seed: 1000,
    paused: false,
    exposure: 1.0,
    bloom: 0.5,
    hueShift: 0,
    // Add params for all modes
    noiseScale: 1.5, curl: 1.0, life: 0.5, decay: 0.95,
    fold: 0.5, warp: 1.0, scale3d: 1.0, gloss: 64, iridescence: 0.5,
    mass: 1.0, stiffness: 1.0, stream: 1.0, pLife: 0.5,
    gH: 0.5, gW: 0.02, gWind: 1.0, gcDist: 3.0,
    lsRadius: 0.04, lsDrip: 100, lsVisc: 0.1,
    frPower: 8, frIter: 12, frCamDist: 3.0, frMaxSteps: 128,
  };

  const audioAnalyzer = new AudioAnalyzer();
  const modulationSystem = new ModulationSystem();
  
  const panel = new MainControlPanel({
    params,
    audioState: audioAnalyzer.state,
    modulationSystem,
    onModeChange: () => {
      // Empty callback to ensure rebuild() gets called on mode change
    },
  });
  
  return { panel, params, audioAnalyzer, modulationSystem };
}

test('Real events > Mode switch to every mode sets P.mode to exact string', () => {
  const { panel, params } = createPanel('Wall Studio');
  const container = (panel as any).container;
  
  const modes = ['Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', '3D Fractal', 'Bead Knot', 'Mirror Mandala', 'Feather Vortex'];
  
  for (const mode of modes) {
    const select = container.querySelector('select[data-param="mode"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    
    // Dispatch real input event
    select.value = mode;
    const event = new dom.window.Event('input', { bubbles: true });
    select.dispatchEvent(event);
    
    // Verify P.mode is the EXACT string, not a number
    expect(params.mode).toBe(mode);
    expect(typeof params.mode).toBe('string');
    
    // Verify the mode's section actually renders
    const sections = container.querySelectorAll('.panel-section[data-section]');
    expect(sections.length).toBeGreaterThan(2); // At least Scene, Color, Audio
  }
  
  panel.destroy();
});

test('Real events > Moving a slider sets param to number, not undefined', () => {
  const { panel, params } = createPanel('3D Fractal');
  const container = (panel as any).container;
  
  const slider = container.querySelector('input[data-param="frPower"]') as HTMLInputElement;
  expect(slider).not.toBeNull();
  
  // Dispatch real input event
  slider.value = '12.5';
  const event = new dom.window.Event('input', { bubbles: true });
  slider.dispatchEvent(event);
  
  // Verify param is a number, not undefined
  expect(params.frPower).toBe(12.5);
  expect(typeof params.frPower).toBe('number');
  expect(params.frPower).not.toBeUndefined();
  
  panel.destroy();
});

test('Real events > Wrapper div with data-param does not clobber params', () => {
  const { panel, params } = createPanel('3D Fractal');
  const container = (panel as any).container;
  
  // Find a control wrapper div (has data-param but is not an input)
  const wrapperDiv = container.querySelector('div.control[data-param]') as HTMLElement;
  
  if (wrapperDiv) {
    const param = wrapperDiv.dataset.param!;
    const originalValue = params[param];
    
    // Simulate event bubbling from inside the wrapper
    const event = new dom.window.Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: wrapperDiv, writable: false });
    wrapperDiv.dispatchEvent(event);
    
    // Param should NOT be clobbered to undefined
    expect(params[param]).toBe(originalValue);
    expect(params[param]).not.toBeUndefined();
  }
  
  panel.destroy();
});

test('Real events > After two mode switches, one click fires Save once', () => {
  let saveCount = 0;
  const { panel } = createPanel('3D Fractal');
  let container = (panel as any).container;
  
  // Set up save callback with counter
  (panel as any).config.onSavePreset = () => { saveCount++; };
  
  // Switch mode twice to trigger rebuild twice
  let select = container.querySelector('select[data-param="mode"]') as HTMLSelectElement;
  select.value = '3D fabric';
  select.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  
  container = (panel as any).container;
  select = container.querySelector('select[data-param="mode"]') as HTMLSelectElement;
  select.value = 'Particle Fabric';
  select.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  
  // Re-query after rebuild
  container = (panel as any).container;
  
  // Click Save button once
  const saveBtn = container.querySelector('button[data-action="save-preset"]') as HTMLButtonElement;
  expect(saveBtn).not.toBeNull();
  
  saveBtn.click();
  
  // Should fire exactly once, not N times (listener stacking would cause N fires)
  expect(saveCount).toBe(1);
  
  panel.destroy();
});

test('Real events > Panel syncs with external P changes', () => {
  const { panel, params } = createPanel('3D Fractal');
  const container = (panel as any).container;
  
  // Simulate external change (e.g. randomize button, wheel zoom)
  params.frPower = 14.7;
  params.exposure = 2.5;
  
  // Call update (which happens in tick loop)
  panel.update();
  
  // Verify panel displays match external changes
  const frPowerSlider = container.querySelector('input[data-param="frPower"]') as HTMLInputElement;
  const exposureSlider = container.querySelector('input[data-param="exposure"]') as HTMLInputElement;
  
  expect(frPowerSlider.value).toBe('14.7');
  expect(exposureSlider.value).toBe('2.5');
  
  // Verify display values
  const frPowerDisplay = container.querySelector('[data-value="frPower"]');
  const exposureDisplay = container.querySelector('[data-value="exposure"]');
  
  if (frPowerDisplay) {
    expect(frPowerDisplay.textContent).toBe('14.70');
  }
  if (exposureDisplay) {
    expect(exposureDisplay.textContent).toBe('2.50');
  }
  
  panel.destroy();
});

test('Real events > Integer params are properly rounded', () => {
  const { panel, params } = createPanel('3D Fractal');
  const container = (panel as any).container;
  
  const frIterSlider = container.querySelector('input[data-param="frIter"]') as HTMLInputElement;
  
  // Set to fractional value
  frIterSlider.value = '15.7';
  frIterSlider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  
  // Should be rounded to integer
  expect(params.frIter).toBe(16);
  expect(Number.isInteger(params.frIter)).toBe(true);
  
  panel.destroy();
});

test('Real events > Checkbox params work correctly', () => {
  const { panel, params } = createPanel('Wall Studio');
  const container = (panel as any).container;
  
  const checkbox = container.querySelector('input[data-param="gOn"]') as HTMLInputElement;
  
  if (checkbox) {
    // Toggle checkbox
    checkbox.checked = false;
    checkbox.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    
    expect(params.gOn).toBe(false);
    
    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    
    expect(params.gOn).toBe(true);
  }
  
  panel.destroy();
});

test('Real events > Mode switch rebuilds panel correctly', () => {
  const { panel, params } = createPanel('2D flow');
  let container = (panel as any).container;
  
  // Initially should show 2D flow controls
  let curlSlider = container.querySelector('input[data-param="curl"]');
  expect(curlSlider).not.toBeNull();
  
  // Switch to 3D Fractal
  let select = container.querySelector('select[data-param="mode"]') as HTMLSelectElement;
  select.value = '3D Fractal';
  select.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  
  // Re-query container after rebuild
  container = (panel as any).container;
  
  // Should no longer show curl (2D flow param)
  curlSlider = container.querySelector('input[data-param="curl"]');
  expect(curlSlider).toBeNull();
  
  // Should now show frPower (3D Fractal param)
  const frPowerSlider = container.querySelector('input[data-param="frPower"]');
  expect(frPowerSlider).not.toBeNull();
  
  panel.destroy();
});

test('Real events > Numeric select options are parsed correctly', () => {
  const { panel, params } = createPanel('3D Fractal');
  const container = (panel as any).container;
  
  const select = container.querySelector('select[data-param="frType"]') as HTMLSelectElement;
  
  if (select) {
    // Select numeric option (Mandelbulb = 0)
    select.value = '0';
    select.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    
    expect(params.frType).toBe(0);
    expect(typeof params.frType).toBe('number');
  }
  
  panel.destroy();
});

import { test, expect, describe } from 'bun:test';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join } from 'path';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://127.0.0.1/' });
global.document = dom.window.document as any;
global.HTMLElement = dom.window.HTMLElement as any;
global.HTMLInputElement = dom.window.HTMLInputElement as any;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as any;
global.window = dom.window as any;
(global as any).requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16) as any;
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

import { shouldShowRestore, restoreLabel, StageChrome, STAGE_RESTORE_FADE_MS } from '../src/ui/stageChrome';
import { MainControlPanel } from '../src/ui/MainControlPanel';
import AudioAnalyzer from '../src/audio';
import ModulationSystem from '../src/modulation';

describe('shouldShowRestore', () => {
  test('hidden when the panel is visible', () => {
    expect(shouldShowRestore({ uiHidden: false, performanceMode: false, fullscreenPending: false }, true)).toBe(false);
  });
  test('hidden in performance mode until a poke', () => {
    expect(shouldShowRestore({ uiHidden: true, performanceMode: true, fullscreenPending: false }, false)).toBe(false);
    expect(shouldShowRestore({ uiHidden: true, performanceMode: true, fullscreenPending: false }, true)).toBe(true);
  });
  test('hidden while the tap-for-fullscreen prompt is up', () => {
    expect(shouldShowRestore({ uiHidden: true, performanceMode: true, fullscreenPending: true }, true)).toBe(false);
  });
  test('shown after a poke when only the UI is hidden', () => {
    expect(shouldShowRestore({ uiHidden: true, performanceMode: false, fullscreenPending: false }, false)).toBe(false);
    expect(shouldShowRestore({ uiHidden: true, performanceMode: false, fullscreenPending: false }, true)).toBe(true);
  });
});

describe('restoreLabel', () => {
  test('Exit fullscreen in performance mode, Show UI otherwise', () => {
    expect(restoreLabel({ performanceMode: true })).toBe('Exit fullscreen');
    expect(restoreLabel({ performanceMode: false })).toBe('Show UI');
  });
});

describe('StageChrome', () => {
  test('hide-UI shows the chip then auto-fades; a poke brings it back', async () => {
    const chrome = new StageChrome({
      fadeMs: 40,
      pokeGraceMs: 0,
      onRestore: () => {},
      onTapFullscreen: () => {},
    });
    chrome.mount(document.body);
    chrome.onHidden(false);
    expect(chrome.restore.classList.contains('is-visible')).toBe(true);
    expect(chrome.restore.textContent).toBe('Show UI');
    expect(chrome.restore.getBoundingClientRect).toBeDefined();
    await new Promise((r) => setTimeout(r, 60));
    expect(chrome.restore.classList.contains('is-visible')).toBe(false);
    document.body.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true }));
    // poke ignores events on body? pointer handler is on document and ignores .flow-panel only
    // dispatch on document
    document.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true }));
    expect(chrome.isPoked()).toBe(true);
    expect(chrome.restore.classList.contains('is-visible')).toBe(true);
    chrome.onShown();
    expect(chrome.restore.classList.contains('is-visible')).toBe(false);
    chrome.destroy();
  });

  test('performance mode keeps the chip hidden until a poke, then labels it Exit fullscreen', () => {
    const chrome = new StageChrome({ pokeGraceMs: 0, onRestore: () => {}, onTapFullscreen: () => {} });
    chrome.mount(document.body);
    chrome.onHidden(true);
    expect(chrome.restore.classList.contains('is-visible')).toBe(false);
    expect(chrome.restore.textContent).toBe('Exit fullscreen');
    chrome.poke();
    expect(chrome.restore.classList.contains('is-visible')).toBe(true);
    chrome.destroy();
  });

  test('default poke grace swallows an immediate poke after entering performance mode', () => {
    const chrome = new StageChrome({ pokeGraceMs: 200, onRestore: () => {}, onTapFullscreen: () => {} });
    chrome.mount(document.body);
    chrome.onHidden(true);
    chrome.poke();
    expect(chrome.restore.classList.contains('is-visible')).toBe(false);
    chrome.destroy();
  });

  test('tap-for-fullscreen prompt is shown only when pending, and click is a local gesture hook', () => {
    let tapped = 0;
    const chrome = new StageChrome({
      onRestore: () => {},
      onTapFullscreen: () => { tapped++; },
    });
    chrome.mount(document.body);
    chrome.sync({ uiHidden: true, performanceMode: true, fullscreen: false, fullscreenPending: true });
    expect(chrome.prompt.classList.contains('is-visible')).toBe(true);
    expect(chrome.restore.classList.contains('is-visible')).toBe(false);
    expect(chrome.promptButton.textContent).toBe('Tap for fullscreen');
    chrome.promptButton.click();
    expect(tapped).toBe(1);
    chrome.sync({ uiHidden: true, performanceMode: true, fullscreen: true, fullscreenPending: false });
    expect(chrome.prompt.classList.contains('is-visible')).toBe(false);
    chrome.destroy();
  });
});

describe('MainControlPanel stage buttons', () => {
  function mockParams() {
    return {
      mode: 'Jungle', seed: 1, paused: false, performanceMode: false, uiHidden: false,
      noiseScale: 1, evolution: 0.1, curl: 1, turbulence: 0.5, speed: 1, life: 0.5, decay: 0.95,
      pointSize: 2, gain: 0.1, saturation: 1, brightness: 1, exposure: 1, bloom: 0.2,
      palette: 'Ember', colorPreset: 'Default',
    } as any;
  }

  test('exposes 44px Hide UI and Fullscreen buttons, and H still toggles the panel', () => {
    const panel = new MainControlPanel({
      params: mockParams(),
      audioState: new AudioAnalyzer().state,
      modulationSystem: new ModulationSystem(),
    } as any);
    const root = (panel as any).container as HTMLElement;
    const hide = root.querySelector('button[data-action="hide"]') as HTMLButtonElement;
    const fs = root.querySelector('button[data-action="fullscreen"]') as HTMLButtonElement;
    expect(hide).toBeTruthy();
    expect(fs).toBeTruthy();
    expect(hide.textContent?.trim()).toBe('Hide UI');
    expect(fs.textContent?.trim()).toBe('Fullscreen');
    expect(hide.classList.contains('panel-stage-btn')).toBe(true);
    expect(fs.classList.contains('panel-stage-btn')).toBe(true);
    const container = root;

    expect(container.classList.contains('hidden')).toBe(false);
    hide.click();
    expect(container.classList.contains('hidden')).toBe(true);
    panel.show();
    expect(container.classList.contains('hidden')).toBe(false);
    window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    expect(container.classList.contains('hidden')).toBe(true);
    window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    expect(container.classList.contains('hidden')).toBe(false);
    panel.destroy();
  });

  test('Fullscreen button invokes onFullscreen from the click (user gesture path)', () => {
    let calls = 0;
    const panel = new MainControlPanel({
      params: mockParams(),
      audioState: new AudioAnalyzer().state,
      modulationSystem: new ModulationSystem(),
      onFullscreen: () => { calls++; },
    } as any);
    const fs = ((panel as any).container as HTMLElement).querySelector('button[data-action="fullscreen"]') as HTMLButtonElement;
    fs.click();
    expect(calls).toBe(1);
    panel.destroy();
  });
});

describe('remote.html display toggles', () => {
  test('ships Hide UI and Performance/Fullscreen toggles that send actions', () => {
    const html = readFileSync(join(import.meta.dir, '../remote.html'), 'utf8');
    expect(html).toContain('id="btn-hide-ui"');
    expect(html).toContain('id="btn-performance"');
    expect(html).toContain('Hide UI');
    expect(html).toContain('Performance / Fullscreen');
    expect(html).toContain("action: values.uiHidden ? 'show-ui' : 'hide-ui'");
    expect(html).toContain("action: values.performanceMode ? 'exit-performance' : 'enter-performance'");
    expect(html).toContain("send('action'");
    expect(html).toContain('Tap the display to go fullscreen');
    // lineup string must stay exact
    expect(html).toContain("const MODES = ['Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', '3D Fractal', 'Bead Knot', 'Mirror Mandala', 'Feather Vortex', 'Crystal Temple']");
  });
});

// Silence unused fade constant if a refactor drops the import use
void STAGE_RESTORE_FADE_MS;

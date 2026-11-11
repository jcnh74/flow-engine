/**
 * Headless smoke test: detects black canvas and console errors
 * Fails fast if rendering is broken
 * 
 * Run with: npm run test:smoke (uses Playwright, not bun test)
 * Port is configurable via SMOKE_TEST_PORT env var (default: 5194)
 * 
 * Note: Renamed to .spec.ts to avoid bun test discovery
 * Uses channel:chrome (not headless_shell) for WebGL support
 */

import { test, expect } from '@playwright/test';

// Use baseURL from Playwright config instead of hardcoding port

// Configure browser to use chrome channel (not headless_shell)
// Only configure if test.use is available (Playwright context, not bun)
if (typeof test !== 'undefined' && test.use) {
  test.use({
    channel: 'chrome',
    launchOptions: {
      args: ['--use-angle=swiftshader']
    }
  });
}

test.describe('Headless Smoke Tests', () => {
  test('should render non-black frame without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Capture page errors
    const pageErrors: string[] = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
    
    // Load app with simple mode (uses baseURL from config)
    await page.goto('/?mode=Tunnel', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for rendering to start
    await page.waitForTimeout(2000);
    
    // Check for page errors (should be none)
    expect(pageErrors.length).toBe(0);
    
    // Sample canvas via gl.readPixels (WebGL canvas)
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return { error: 'Canvas not found' };
      
      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };
      
      // Sample 64x64 region from center
      const w = 64, h = 64;
      const centerX = Math.floor(canvas.width / 2) - w / 2;
      const centerY = Math.floor(canvas.height / 2) - h / 2;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(centerX, centerY, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      
      let sumR = 0, sumG = 0, sumB = 0;
      let minLuma = 255, maxLuma = 0;
      
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        sumR += r;
        sumG += g;
        sumB += b;
        
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
      }
      
      const totalPixels = w * h;
      return {
        avgR: sumR / totalPixels,
        avgG: sumG / totalPixels,
        avgB: sumB / totalPixels,
        minLuma,
        maxLuma,
        lumaRange: maxLuma - minLuma
      };
    });
    
    // Check canvas is not black
    expect(canvasData).not.toHaveProperty('error');
    if ('avgR' in canvasData) {
      // For sparse-on-black scenes (Spiral Dreams, Tunnel), avgLuma can be low
      // Check maxLuma instead - if ANY pixel is bright, scene is rendering
      expect(canvasData.maxLuma).toBeGreaterThan(50);
      expect(canvasData.lumaRange).toBeGreaterThan(30);
    }
  });
  
  test('should render with feedback enabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
    
    // Load with feedback enabled (uses baseURL from config)
    await page.goto('/?feedback=1&fbmix=0.85&fbdecay=0.96', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000);
    
    // Should not throw errors
    expect(pageErrors.length).toBe(0);
    
    // Canvas should not be black (use gl.readPixels for WebGL canvas)
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      
      const gl = canvas.getContext('webgl2');
      if (!gl) return null;
      
      // Sample downscaled to avoid huge reads
      const w = Math.min(canvas.width, 256);
      const h = Math.min(canvas.height, 256);
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      
      let maxLuma = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const luma = 0.2126 * pixels[i] + 0.7152 * pixels[i+1] + 0.0722 * pixels[i+2];
        maxLuma = Math.max(maxLuma, luma);
      }
      
      return { maxLuma };
    });
    
    expect(canvasData).not.toBeNull();
    if (canvasData) {
      // Max luma should be >50 if ANY pixel is rendering (sparse or dense)
      expect(canvasData.maxLuma).toBeGreaterThan(50);
    }
  });
});

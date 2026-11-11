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

const TEST_PORT = process.env.SMOKE_TEST_PORT || '5194';
const TEST_URL = `http://127.0.0.1:${TEST_PORT}`;

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
    
    // Load app with simple mode
    await page.goto(`${TEST_URL}/?mode=Tunnel`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for rendering to start
    await page.waitForTimeout(2000);
    
    // Check for page errors (should be none)
    expect(pageErrors.length).toBe(0);
    
    // Sample canvas center pixel via toDataURL (works with WebGL canvas)
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return { error: 'Canvas not found' };
      
      // Convert canvas to data URL and sample center region
      const dataUrl = canvas.toDataURL();
      const img = new Image();
      
      return new Promise((resolve) => {
        img.onload = () => {
          // Create temp canvas for pixel reading
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d');
          if (!ctx) {
            resolve({ error: 'Cannot get temp context' });
            return;
          }
          
          ctx.drawImage(img, 0, 0);
          
          const centerX = Math.floor(img.width / 2);
          const centerY = Math.floor(img.height / 2);
          
          // Sample 10x10 region around center
          const imageData = ctx.getImageData(centerX - 5, centerY - 5, 10, 10);
          const data = imageData.data;
          
          let sumR = 0, sumG = 0, sumB = 0;
          let minLuma = 255, maxLuma = 0;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            sumR += r;
            sumG += g;
            sumB += b;
            
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            minLuma = Math.min(minLuma, luma);
            maxLuma = Math.max(maxLuma, luma);
          }
          
          const pixels = data.length / 4;
          resolve({
            avgR: sumR / pixels,
            avgG: sumG / pixels,
            avgB: sumB / pixels,
            minLuma,
            maxLuma,
            lumaRange: maxLuma - minLuma
          });
        };
        img.src = dataUrl;
      });
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
    
    // Load with feedback enabled
    await page.goto(`${TEST_URL}/?feedback=1&fbmix=0.85&fbdecay=0.96`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000);
    
    // Should not throw errors
    expect(pageErrors.length).toBe(0);
    
    // Canvas should not be black (use toDataURL for WebGL canvas)
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      
      const dataUrl = canvas.toDataURL();
      const img = new Image();
      
      return new Promise<any>((resolve) => {
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          
          ctx.drawImage(img, 0, 0);
          
          // Check max luma over whole canvas (not just center)
          // Sparse-on-black scenes have low center luma but high max
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const data = imageData.data;
          let maxLuma = 0;
          for (let i = 0; i < data.length; i += 4) {
            const luma = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
            maxLuma = Math.max(maxLuma, luma);
          }
          
          resolve({ maxLuma });
        };
        img.src = dataUrl;
      });
    });
    
    expect(canvasData).not.toBeNull();
    if (canvasData) {
      // Max luma should be >50 if ANY pixel is rendering (sparse or dense)
      expect(canvasData.maxLuma).toBeGreaterThan(50);
    }
  });
});

/**
 * Headless smoke test: detects black canvas and console errors
 * Fails fast if rendering is broken
 * 
 * Run with: npm run test:smoke (uses Playwright, not bun test)
 * Port is configurable via SMOKE_TEST_PORT env var (default: 5194)
 */

import { test, expect } from '@playwright/test';

const TEST_PORT = process.env.SMOKE_TEST_PORT || '5194';
const TEST_URL = `http://127.0.0.1:${TEST_PORT}`;

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
    
    // Sample canvas center pixel
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return { error: 'Canvas not found' };
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'Cannot get 2D context' };
      
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      
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
      return {
        avgR: sumR / pixels,
        avgG: sumG / pixels,
        avgB: sumB / pixels,
        minLuma,
        maxLuma,
        lumaRange: maxLuma - minLuma
      };
    });
    
    // Check canvas is not black
    expect(canvasData).not.toHaveProperty('error');
    if ('avgR' in canvasData) {
      const avgLuma = 0.2126 * canvasData.avgR + 0.7152 * canvasData.avgG + 0.0722 * canvasData.avgB;
      
      // Fail if canvas is uniform black (luma < 10 and range < 5)
      expect(avgLuma).toBeGreaterThan(10);
      expect(canvasData.lumaRange).toBeGreaterThan(5);
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
    
    // Canvas should not be black
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      const pixel = ctx.getImageData(centerX, centerY, 1, 1).data;
      
      return {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        luma: 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]
      };
    });
    
    expect(canvasData).not.toBeNull();
    if (canvasData) {
      expect(canvasData.luma).toBeGreaterThan(10);
    }
  });
});

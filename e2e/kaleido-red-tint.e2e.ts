import { test, expect } from '@playwright/test';

test('Kaleido red tint diagnostic', async ({ page }) => {
  // Navigate to app
  await page.goto('/');
  await page.waitForSelector('#c', { timeout: 10000 });
  
  // Set Kaleido mode
  await page.evaluate(() => {
    const engine = (window as any).engine;
    if (engine && engine.setMode) {
      engine.setMode('Kaleido');
      // Disable feedback to test raw renderTrippy output
      if (engine.P) {
        engine.P.feedbackEnabled = false;
        engine.P.feedbackKaleido = 0;
      }
    }
  });
  
  // Wait for rendering to stabilize
  await page.waitForTimeout(2000);
  
  // Sample pixels
  const stats = await page.evaluate(() => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');
    if (!gl) return null;
    
    const w = Math.min(canvas.width, 256);
    const h = Math.min(canvas.height, 256);
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    let sumR = 0, sumG = 0, sumB = 0;
    const totalPixels = w * h;
    
    for (let i = 0; i < pixels.length; i += 4) {
      sumR += pixels[i];
      sumG += pixels[i + 1];
      sumB += pixels[i + 2];
    }
    
    const meanR = sumR / totalPixels;
    const meanG = sumG / totalPixels;
    const meanB = sumB / totalPixels;
    
    return { meanR, meanG, meanB, w, h };
  });
  
  console.log('Kaleido red tint test:', stats);
  
  expect(stats).toBeTruthy();
  
  // If applyColorTransforms is on the rendering path, output should be RED
  // meanR should be high (>200), meanG and meanB should be low (<50)
  expect(stats!.meanR, 'Red channel should be high if applyColorTransforms is on path').toBeGreaterThan(200);
  expect(stats!.meanG, 'Green channel should be low').toBeLessThan(50);
  expect(stats!.meanB, 'Blue channel should be low').toBeLessThan(50);
});

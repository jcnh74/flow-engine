import { test, expect } from '@playwright/test';

interface PixelStats {
  meanR: number;
  meanG: number;
  meanB: number;
  meanLuma: number;
  maxLuma: number;
  dominantHueBin: string; // 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow'
  clippedPercent: number; // % of pixels with R|G|B >= 250
}

test.describe('Color Control Verification', () => {
  test('All modes respond to hue/sat/preset changes', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for comprehensive test
    
    // Navigate to app
    await page.goto('/');
    await page.waitForSelector('#c', { timeout: 10000 });
    
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    const modes = [
      'Wall Studio',
      'Tunnel',
      'Kaleido',
      'Plasma',
      'Morph',
      '3D Fractal',
      'MilkDrop'
    ];
    
    const results: any = {};
    
    for (const mode of modes) {
      console.log(`\n=== Testing ${mode} ===`);
      
      // Set mode (use window.setMode which is already exposed)
      await page.evaluate((m) => {
        const setMode = (window as any).setMode;
        if (setMode) {
          setMode(m);
        }
      }, mode);
      
      // Wait for mode to initialize
      await page.waitForTimeout(1000);
      
      // Wait for rendering to stabilize
      await waitFrames(page, 20); // Reduced wait time // Reduced from 60 to 30 for speed
      
      // Test baseline (hue 0, sat 1.0)
      const baseline = await capturePixelStats(page);
      console.log(`${mode} baseline:`, baseline);
      
      // Test hue 90
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.P) {
          engine.P.hueShift = 90;
        }
      });
      await waitFrames(page, 20); // Reduced wait time
      const hue90 = await capturePixelStats(page);
      const hue90Change = Math.max(
        Math.abs(hue90.meanR - baseline.meanR),
        Math.abs(hue90.meanG - baseline.meanG),
        Math.abs(hue90.meanB - baseline.meanB)
      );
      console.log(`${mode} hue 90: dRGB=${hue90Change.toFixed(1)}, hueBin=${hue90.dominantHueBin}`);
      
      // Test hue 180
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.P) {
          engine.P.hueShift = 180;
        }
      });
      await waitFrames(page, 20); // Reduced wait time
      const hue180 = await capturePixelStats(page);
      const hue180Change = Math.max(
        Math.abs(hue180.meanR - baseline.meanR),
        Math.abs(hue180.meanG - baseline.meanG),
        Math.abs(hue180.meanB - baseline.meanB)
      );
      console.log(`${mode} hue 180: dRGB=${hue180Change.toFixed(1)}, hueBin=${hue180.dominantHueBin}`);
      
      // Test hue 270
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.P) {
          engine.P.hueShift = 270;
        }
      });
      await waitFrames(page, 20); // Reduced wait time
      const hue270 = await capturePixelStats(page);
      const hue270Change = Math.max(
        Math.abs(hue270.meanR - baseline.meanR),
        Math.abs(hue270.meanG - baseline.meanG),
        Math.abs(hue270.meanB - baseline.meanB)
      );
      console.log(`${mode} hue 270: dRGB=${hue270Change.toFixed(1)}, hueBin=${hue270.dominantHueBin}`);
      
      // Reset hue
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.P) {
          engine.P.hueShift = 0;
        }
      });
      await waitFrames(page, 20); // Reduced wait time
      
      // Test Color Preset "Magma"
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.setStops) {
          // Magma gradient: red -> orange -> yellow
          engine.setStops([[0, '#ff0000'], [0.5, '#ff8c00'], [1, '#ffff00']]);
        }
      });
      await waitFrames(page, 20); // Reduced wait time
      const magma = await capturePixelStats(page);
      const magmaChange = Math.max(
        Math.abs(magma.meanR - baseline.meanR),
        Math.abs(magma.meanG - baseline.meanG),
        Math.abs(magma.meanB - baseline.meanB)
      );
      console.log(`${mode} Magma preset: dRGB=${magmaChange.toFixed(1)}, clipped=${magma.clippedPercent.toFixed(1)}%`);
      
      // Test sat 0.5
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.V) {
          engine.V.saturation = 0.5;
        }
      });
      await waitFrames(page, 20); // Reduced wait time
      const sat05 = await capturePixelStats(page);
      const sat05Change = Math.max(
        Math.abs(sat05.meanR - baseline.meanR),
        Math.abs(sat05.meanG - baseline.meanG),
        Math.abs(sat05.meanB - baseline.meanB)
      );
      console.log(`${mode} sat 0.5: dRGB=${sat05Change.toFixed(1)}`);
      
      // Test sat 2.0
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.V) {
          engine.V.saturation = 2.0;
        }
      });
      await waitFrames(page, 20); // Reduced wait time
      const sat20 = await capturePixelStats(page);
      const sat20Change = Math.max(
        Math.abs(sat20.meanR - baseline.meanR),
        Math.abs(sat20.meanG - baseline.meanG),
        Math.abs(sat20.meanB - baseline.meanB)
      );
      console.log(`${mode} sat 2.0: dRGB=${sat20Change.toFixed(1)}`);
      
      // Reset saturation
      await page.evaluate(() => {
        const engine = (window as any).engine;
        if (engine && engine.V) {
          engine.V.saturation = 1.0;
        }
      });
      
      // Store results
      results[mode] = {
        baseline,
        hue90: { stats: hue90, dRGB: hue90Change },
        hue180: { stats: hue180, dRGB: hue180Change },
        hue270: { stats: hue270, dRGB: hue270Change },
        magma: { stats: magma, dRGB: magmaChange },
        sat05: { stats: sat05, dRGB: sat05Change },
        sat20: { stats: sat20, dRGB: sat20Change }
      };
      
      // Assertions for this mode
      
      // At least ONE hue change must show dRGB >= 15 OR hue bin change
      const anyHueWorks = 
        hue90Change >= 15 || hue90.dominantHueBin !== baseline.dominantHueBin ||
        hue180Change >= 15 || hue180.dominantHueBin !== baseline.dominantHueBin ||
        hue270Change >= 15 || hue270.dominantHueBin !== baseline.dominantHueBin;
      
      expect(anyHueWorks, `${mode}: At least one hue shift (90/180/270) should change color significantly`).toBe(true);
      
      // Magma preset should change color
      expect(magmaChange, `${mode}: Magma preset should change color by >= 15`).toBeGreaterThanOrEqual(15);
      
      // Magma should not blow out (< 50% clipped)
      expect(magma.clippedPercent, `${mode}: Magma preset should not blow out (< 50% clipped)`).toBeLessThan(50);
      
      // At least ONE saturation change should be noticeable
      const anySatWorks = sat05Change >= 10 || sat20Change >= 10;
      expect(anySatWorks, `${mode}: At least one saturation change (0.5 or 2.0) should be noticeable`).toBe(true);
    }
    
    // Test official presets for blowout
    console.log(`\n=== Testing Official Presets ===`);
    const presetNames = [
      'Default',
      'Spiral Dreams',
      'Kaleidoscope Echo',
      'Fractal Echo'
    ];
    
    for (const presetName of presetNames) {
      await page.evaluate((name) => {
        const engine = (window as any).engine;
        if (engine && engine.loadPresetFromGallery) {
          engine.loadPresetFromGallery(name);
        }
      }, presetName);
      
      await waitFrames(page, 60);
      
      const stats = await capturePixelStats(page);
      console.log(`Preset "${presetName}": luma=${stats.meanLuma.toFixed(1)}, clipped=${stats.clippedPercent.toFixed(1)}%`);
      
      expect(stats.clippedPercent, `Preset "${presetName}" should not blow out (< 50% clipped)`).toBeLessThan(50);
    }
    
    // Print summary
    console.log(`\n=== Summary ===`);
    console.log(JSON.stringify(results, null, 2));
  });
});

async function waitFrames(page: any, frames: number): Promise<void> {
  await page.evaluate((n: number) => {
    return new Promise<void>((resolve) => {
      let count = 0;
      const wait = () => {
        count++;
        if (count >= n) resolve();
        else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    });
  }, frames);
}

async function capturePixelStats(page: any): Promise<PixelStats> {
  return await page.evaluate(() => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const engine = (window as any).engine;
    
    // Use engine.readPixelsFromHDR to read from HDR target before tonemap
    // This avoids the preserveDrawingBuffer=false issue where default FB is cleared after present
    const w = Math.min(canvas.width, 256);
    const h = Math.min(canvas.height, 256);
    let pixels: Uint8Array;
    
    if (engine && engine.readPixelsFromHDR) {
      pixels = engine.readPixelsFromHDR(0, 0, w, h);
      if (!pixels) {
        // Fallback to default FB if HDR target not available
        const gl = canvas.getContext('webgl2');
        if (!gl) throw new Error('No WebGL2 context');
        pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      }
    } else {
      // Fallback for old code
      const gl = canvas.getContext('webgl2');
      if (!gl) throw new Error('No WebGL2 context');
      pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }
    
    let sumR = 0, sumG = 0, sumB = 0, sumLuma = 0;
    let maxLuma = 0;
    let clippedCount = 0;
    
    // Hue bins: count which RGB channel is dominant
    let redDom = 0, greenDom = 0, blueDom = 0;
    let cyanDom = 0, magentaDom = 0, yellowDom = 0;
    
    const totalPixels = w * h;
    
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      
      sumR += r;
      sumG += g;
      sumB += b;
      
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      sumLuma += luma;
      maxLuma = Math.max(maxLuma, luma);
      
      // Count clipped pixels (any channel >= 250)
      if (r >= 250 || g >= 250 || b >= 250) {
        clippedCount++;
      }
      
      // Determine dominant hue bin
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      
      if (delta > 20) { // Only count pixels with some saturation
        if (r === max && g > b) yellowDom++; // yellow
        else if (r === max && g < b) magentaDom++; // magenta
        else if (r === max) redDom++; // red
        else if (g === max && b > r) cyanDom++; // cyan
        else if (g === max) greenDom++; // green
        else if (b === max) blueDom++; // blue
      }
    }
    
    const meanR = sumR / totalPixels;
    const meanG = sumG / totalPixels;
    const meanB = sumB / totalPixels;
    const meanLuma = sumLuma / totalPixels;
    const clippedPercent = (clippedCount / totalPixels) * 100;
    
    // Determine dominant hue bin
    const bins = { red: redDom, green: greenDom, blue: blueDom, cyan: cyanDom, magenta: magentaDom, yellow: yellowDom };
    const dominantHueBin = Object.entries(bins).reduce((a, b) => bins[a[0] as keyof typeof bins] > bins[b[0] as keyof typeof bins] ? a : b)[0];
    
    return {
      meanR,
      meanG,
      meanB,
      meanLuma,
      maxLuma,
      dominantHueBin,
      clippedPercent
    };
  });
}

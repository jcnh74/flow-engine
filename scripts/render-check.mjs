#!/usr/bin/env node
/**
 * Render-check harness: validates that every mode and fractal type actually renders
 * and that all sliders have visible effects.
 * 
 * Usage:
 *   bun scripts/render-check.mjs --url http://127.0.0.1:5191 --channel chrome --out ./render-check
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const channelIndex = args.indexOf('--channel');
const outIndex = args.indexOf('--out');

const url = urlIndex >= 0 ? args[urlIndex + 1] : 'http://127.0.0.1:5191';
const channel = channelIndex >= 0 ? args[channelIndex + 1] : 'chrome';
const outDir = outIndex >= 0 ? args[outIndex + 1] : './render-check';

mkdirSync(outDir, { recursive: true });

const MODES = [
  '2D Fractal',
  '3D Fractal',
  'Wall Studio',
  'Grass Field',
  '3D fabric',
  'Liquid Spheres',
  'Particle Fabric',
  '2D flow'
];

const FRACTAL_TYPES_2D = [
  'Mandelbrot',
  'Julia',
  'Burning Ship',
  'Newton',
  'Phoenix'
];

const FRACTAL_TYPES_3D = [
  'Mandelbulb',
  'Mandelbox',
  'Menger Sponge',
  'Sierpinski',
  'Kaleidoscopic',
  'Quaternion Julia'
];

// Image analysis functions
async function analyzeImage(buffer) {
  const image = sharp(buffer);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    pixels.push({ r, g, b, lum });
  }
  
  // Mean luminance
  const meanLum = pixels.reduce((sum, p) => sum + p.lum, 0) / pixels.length;
  
  // Std dev luminance
  const variance = pixels.reduce((sum, p) => sum + Math.pow(p.lum - meanLum, 2), 0) / pixels.length;
  const stdLum = Math.sqrt(variance);
  
  // Edge density (simple Sobel approximation)
  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < info.height - 1; y++) {
    for (let x = 1; x < info.width - 1; x++) {
      const idx = y * info.width + x;
      if (idx + 1 < pixels.length && idx - 1 >= 0 && 
          idx + info.width < pixels.length && idx - info.width >= 0) {
        const gx = Math.abs(pixels[idx + 1].lum - pixels[idx - 1].lum);
        const gy = Math.abs(pixels[idx + info.width].lum - pixels[idx - info.width].lum);
        edgeSum += Math.sqrt(gx * gx + gy * gy);
        edgeCount++;
      }
    }
  }
  const edgeDensity = edgeCount > 0 ? edgeSum / edgeCount : 0;
  
  // Distinct colors (bucketed to reduce noise)
  const colorSet = new Set();
  for (const p of pixels) {
    const bucket = (Math.floor(p.r / 16) << 16) | (Math.floor(p.g / 16) << 8) | Math.floor(p.b / 16);
    colorSet.add(bucket);
  }
  const distinctColors = colorSet.size;
  
  return {
    meanLum,
    stdLum,
    edgeDensity,
    distinctColors,
    width: info.width,
    height: info.height
  };
}

async function imageDiff(buffer1, buffer2) {
  const img1 = sharp(buffer1);
  const img2 = sharp(buffer2);
  
  const { data: data1 } = await img1.raw().toBuffer({ resolveWithObject: true });
  const { data: data2 } = await img2.raw().toBuffer({ resolveWithObject: true });
  
  if (data1.length !== data2.length) {
    throw new Error('Image dimensions do not match for diff');
  }
  
  let diffSum = 0;
  for (let i = 0; i < data1.length; i += 4) {
    const dr = data1[i] - data2[i];
    const dg = data1[i + 1] - data2[i + 1];
    const db = data1[i + 2] - data2[i + 2];
    diffSum += Math.sqrt(dr * dr + dg * dg + db * db);
  }
  
  return diffSum / (data1.length / 4);
}

async function run() {
  console.log(`Launching browser: ${channel}`);
  console.log(`URL: ${url}`);
  console.log(`Output: ${outDir}`);
  
  const browser = await chromium.launch({
    channel,
    headless: false,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-gpu-driver-bug-workarounds'
    ]
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  const consoleMessages = [];
  
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.error(`Console error: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', err => {
    errors.push({ type: 'page', message: err.message });
    console.error(`Page error: ${err.message}`);
  });
  
  await page.goto(url);
  await page.waitForTimeout(2000);
  
  const results = {
    url,
    timestamp: new Date().toISOString(),
    modes: [],
    errors,
    consoleMessages: consoleMessages.filter(m => m.type === 'error'),
    failures: []
  };
  
  for (const mode of MODES) {
    console.log(`\nTesting mode: ${mode}`);
    
    // Select mode
    await page.selectOption('select[data-param="mode"]', mode);
    await page.waitForTimeout(500);
    
    // Verify mode dropdown shows correct value
    const selectedMode = await page.$eval('select[data-param="mode"]', el => el.value);
    if (selectedMode !== mode) {
      const failure = `Mode dropdown shows "${selectedMode}" but should show "${mode}"`;
      results.failures.push(failure);
      console.error(`FAIL: ${failure}`);
    }
    
    const modeResult = {
      mode,
      selectedMode,
      types: [],
      sliders: []
    };
    
    // Test fractal types if applicable
    if (mode === '2D Fractal') {
      const typeSelect = await page.$('select[data-param="fr2Type"]');
      if (typeSelect) {
        let prevBuffer = null;
        
        for (const type of FRACTAL_TYPES_2D) {
          console.log(`  Type: ${type}`);
          
          // Find option by text
          await page.selectOption('select[data-param="fr2Type"]', { label: type });
          await page.waitForTimeout(2000);
          
          const canvas = await page.$('#c');
          const screenshot = await canvas.screenshot();
          const filename = `2DFractal-${type.replace(/\s+/g, '')}.png`;
          writeFileSync(join(outDir, filename), screenshot);
          
          const stats = await analyzeImage(screenshot);
          
          const typeResult = {
            type,
            filename,
            stats
          };
          
          // Check for near-uniform (boring) frames
          if (stats.stdLum < 10) {
            const failure = `2D Fractal ${type}: near-uniform (stdLum=${stats.stdLum.toFixed(2)})`;
            results.failures.push(failure);
            console.error(`  FAIL: ${failure}`);
          }
          
          // Check for primitive shapes (low edge density)
          if (stats.edgeDensity < 5) {
            const failure = `2D Fractal ${type}: looks like primitive (edgeDensity=${stats.edgeDensity.toFixed(2)})`;
            results.failures.push(failure);
            console.error(`  FAIL: ${failure}`);
          }
          
          // Compare to previous type
          if (prevBuffer) {
            const diff = await imageDiff(prevBuffer, screenshot);
            typeResult.diffFromPrev = diff;
            
            if (diff < 1.0) {
              const failure = `2D Fractal ${type}: pixel-identical to previous type (diff=${diff.toFixed(2)})`;
              results.failures.push(failure);
              console.error(`  FAIL: ${failure}`);
            }
          }
          
          prevBuffer = screenshot;
          modeResult.types.push(typeResult);
        }
      }
    } else if (mode === '3D Fractal') {
      const typeSelect = await page.$('select[data-param="frType"]');
      if (typeSelect) {
        let prevBuffer = null;
        
        for (const type of FRACTAL_TYPES_3D) {
          console.log(`  Type: ${type}`);
          
          await page.selectOption('select[data-param="frType"]', { label: type });
          await page.waitForTimeout(2000);
          
          const canvas = await page.$('#c');
          const screenshot = await canvas.screenshot();
          const filename = `3DFractal-${type.replace(/\s+/g, '')}.png`;
          writeFileSync(join(outDir, filename), screenshot);
          
          const stats = await analyzeImage(screenshot);
          
          const typeResult = {
            type,
            filename,
            stats
          };
          
          if (stats.stdLum < 10) {
            const failure = `3D Fractal ${type}: near-uniform (stdLum=${stats.stdLum.toFixed(2)})`;
            results.failures.push(failure);
            console.error(`  FAIL: ${failure}`);
          }
          
          if (stats.edgeDensity < 5) {
            const failure = `3D Fractal ${type}: looks like primitive (edgeDensity=${stats.edgeDensity.toFixed(2)})`;
            results.failures.push(failure);
            console.error(`  FAIL: ${failure}`);
          }
          
          if (prevBuffer) {
            const diff = await imageDiff(prevBuffer, screenshot);
            typeResult.diffFromPrev = diff;
            
            if (diff < 1.0) {
              const failure = `3D Fractal ${type}: pixel-identical to previous (diff=${diff.toFixed(2)})`;
              results.failures.push(failure);
              console.error(`  FAIL: ${failure}`);
            }
          }
          
          prevBuffer = screenshot;
          modeResult.types.push(typeResult);
        }
      }
    } else {
      // Take one screenshot for non-fractal modes
      await page.waitForTimeout(2000);
      const canvas = await page.$('#c');
      const screenshot = await canvas.screenshot();
      const filename = `${mode.replace(/\s+/g, '')}.png`;
      writeFileSync(join(outDir, filename), screenshot);
      
      const stats = await analyzeImage(screenshot);
      modeResult.types.push({ type: 'default', filename, stats });
    }
    
    // Slider sweep: test that each visible slider has an effect
    console.log(`  Testing sliders...`);
    const sliders = await page.$$('input[type="range"][data-param]');
    
    for (const slider of sliders) {
      const param = await slider.getAttribute('data-param');
      const min = await slider.getAttribute('min');
      const max = await slider.getAttribute('max');
      
      // Check if slider is visible
      const isVisible = await slider.isVisible();
      if (!isVisible) continue;
      
      console.log(`    Slider: ${param}`);
      
      // Set to min
      await slider.fill(min);
      await page.waitForTimeout(300);
      const canvas = await page.$('#c');
      const minShot = await canvas.screenshot();
      
      // Set to max
      await slider.fill(max);
      await page.waitForTimeout(300);
      const maxShot = await canvas.screenshot();
      
      const diff = await imageDiff(minShot, maxShot);
      
      const sliderResult = {
        param,
        min: parseFloat(min),
        max: parseFloat(max),
        diff
      };
      
      if (diff < 0.5) {
        const failure = `${mode} slider ${param}: no visible effect (diff=${diff.toFixed(2)})`;
        results.failures.push(failure);
        console.error(`    FAIL: ${failure}`);
      }
      
      modeResult.sliders.push(sliderResult);
    }
    
    results.modes.push(modeResult);
  }
  
  await browser.close();
  
  // Write report
  const reportPath = join(outDir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Modes tested: ${results.modes.length}`);
  console.log(`Failures: ${results.failures.length}`);
  
  if (results.failures.length > 0) {
    console.log(`\nFAILURES:`);
    results.failures.forEach(f => console.log(`  - ${f}`));
  }
  
  console.log(`\nReport written to: ${reportPath}`);
  console.log(`Screenshots in: ${outDir}`);
  
  // Exit with failure code if any failures
  process.exit(results.failures.length > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

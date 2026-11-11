#!/usr/bin/env node
/**
 * Render harness: validates rendering with SwiftShader
 * Takes screenshots and measures frame MAD
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const urlArg = args.find(a => a.startsWith('--url='));
const url = urlArg ? urlArg.split('=')[1] : 'http://127.0.0.1:5193';
const outDir = './proof-screenshots';
const useGpu = args.includes('--gpu');

mkdirSync(outDir, { recursive: true });

async function captureMode(page, modeName, params = {}) {
  const displayName = modeName || params.preset || 'Unknown';
  console.log(`\n📸 Capturing: ${displayName}`);
  
  // Build URL params (skip mode if null)
  const urlParamsObj = { ...params };
  if (modeName) {
    urlParamsObj.mode = modeName;
  }
  
  // Use galleryPreset for gallery preset loading (not preset which is export size)
  // Always transform preset → galleryPreset when preset is provided
  if (urlParamsObj.preset) {
    urlParamsObj.galleryPreset = urlParamsObj.preset;
    delete urlParamsObj.preset;
  }
  // Remove mode if galleryPreset is set (galleryPreset includes mode)
  if (urlParamsObj.galleryPreset && modeName) {
    delete urlParamsObj.mode;
  }
  
  const urlParams = new URLSearchParams(urlParamsObj);
  const fullUrl = `${url}?${urlParams}`;
  
  try {
    await page.goto(fullUrl, { waitUntil: 'load', timeout: 30000 });
    
    // Check if canvas exists
    await page.waitForTimeout(2000);
    const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
    if (!hasCanvas) {
      throw new Error('Canvas element not found in DOM');
    }
    
    // Wait for WebGL context
    const hasGL = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas && !!canvas.getContext('webgl2');
    });
    if (!hasGL) {
      throw new Error('WebGL2 context not available');
    }
    
    // Wait for rendering to start
    await page.waitForTimeout(3000);
    
    // Take screenshot (use displayName for filename, not modeName which can be null)
    const filename = displayName.toLowerCase().replace(/\s+/g, '-').replace(/:/g, '');
    const path = join(outDir, `${filename}.png`);
    await page.screenshot({ path, fullPage: false });
    
    // Measure MAD and spatial std if requested
    let mad = null;
    if (params.measureMAD) {
      mad = await page.evaluate(() => {
        return new Promise((resolve) => {
          const canvas = document.querySelector('canvas');
          const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
          if (!gl) {
            resolve({ error: 'No WebGL2' });
            return;
          }
          
          let prevPixels = null;
          const mads = [];
          const stds = [];
          let frameCount = 0;
          
          function measure() {
            if (frameCount >= 30) {
              const avgMad = mads.reduce((a, b) => a + b, 0) / mads.length;
              const avgStd = stds.reduce((a, b) => a + b, 0) / stds.length;
              resolve({ avgMad, avgStd, frames: mads.length });
              return;
            }
            
            requestAnimationFrame(() => {
              const w = canvas.width;
              const h = canvas.height;
              const pixels = new Uint8Array(w * h * 4);
              gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
              
              // Calculate MAD
              if (prevPixels) {
                let sum = 0;
                for (let i = 0; i < pixels.length; i++) {
                  sum += Math.abs(pixels[i] - prevPixels[i]);
                }
                mads.push(sum / pixels.length);
              }
              
              // Calculate spatial std (luminance)
              const lumas = [];
              for (let i = 0; i < pixels.length; i += 4) {
                const luma = 0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2];
                lumas.push(luma);
              }
              const meanLuma = lumas.reduce((a, b) => a + b, 0) / lumas.length;
              const variance = lumas.reduce((a, b) => a + Math.pow(b - meanLuma, 2), 0) / lumas.length;
              stds.push(Math.sqrt(variance));
              
              prevPixels = new Uint8Array(pixels);
              frameCount++;
              measure();
            });
          }
          
          requestAnimationFrame(measure);
        });
      });
    }
    
    console.log(`   ✅ Screenshot: ${path}`);
    if (mad && !mad.error) {
      console.log(`   📊 MAD: ${mad.avgMad.toFixed(2)}, Spatial std: ${mad.avgStd.toFixed(2)} (${mad.frames} frames)`);
      
      // Regression check: fail if frame is near-uniform
      if (mad.avgMad < 0.5) {
        console.log(`   ❌ REGRESSION: Near-uniform temporal (MAD ${mad.avgMad.toFixed(2)} < 0.5)`);
        return { path, mad: mad.avgMad, std: mad.avgStd, error: 'Near-uniform temporal', regression: true };
      }
      
      if (mad.avgStd < 5.0) {
        console.log(`   ❌ REGRESSION: Near-uniform spatial (std ${mad.avgStd.toFixed(2)} < 5.0)`);
        return { path, mad: mad.avgMad, std: mad.avgStd, error: 'Near-uniform spatial', regression: true };
      }
      
      return { path, mad: mad.avgMad, std: mad.avgStd };
    }
    
    return { path, mad: null };
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { error: err.message };
  }
}

async function run() {
  console.log(`🚀 Render Harness ${useGpu ? 'with Real GPU' : 'with SwiftShader'}\n`);
  console.log(`URL: ${url}`);
  console.log(`Output: ${outDir}\n`);
  
  const launchArgs = useGpu ? [
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ] : [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-gpu-driver-bug-workarounds',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'
  ];
  
  console.log(`Launching Chrome with ${useGpu ? 'real GPU' : 'SwiftShader'}...`);
  
  const browser = await chromium.launch({
    channel: useGpu ? 'chrome' : undefined,
    headless: !useGpu, // Headed for --gpu (real GPU needs visible window)
    args: useGpu ? launchArgs : [...launchArgs, '--headless=new']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  // Log console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log(`   🔴 Console: ${text}`);
    }
    // Log debug stage messages
    if (text.includes('After') || text.includes('Before') || text.includes('Feedback texture')) {
      console.log(`   🔍 ${text}`);
    }
  });
  
  page.on('pageerror', err => {
    console.log(`   🔴 Page error: ${err.message}`);
  });
  
  const results = [];
  
  // Required screenshots
  results.push(await captureMode(page, 'Tunnel'));
  results.push(await captureMode(page, 'Wall Studio'));
  
  // Fractal presets with MAD measurement
  results.push(await captureMode(page, '3D Fractal', { 
    preset: 'Fractal Dreams',
    measureMAD: true 
  }));
  results.push(await captureMode(page, '3D Fractal', { 
    preset: 'Mandel Vortex',
    measureMAD: true 
  }));
  
  // Feedback presets with MAD and spatial std measurement
  const feedbackPresets = [
    'Feedback: Spiral Dreams',
    'Feedback: Kaleidoscope Echo',
    'Feedback: Plasma Warp',
    'Feedback: Fractal Echo'
  ];
  
  for (const preset of feedbackPresets) {
    results.push(await captureMode(page, null, { 
      preset,
      measureMAD: true 
    }));
  }
  
  await browser.close();
  
  console.log('\n\n📋 Summary:');
  let hasErrors = false;
  for (const result of results) {
    if (result.error) {
      console.log(`   ❌ ${result.error}`);
      hasErrors = true;
    } else {
      const madStr = result.mad ? ` (MAD: ${result.mad.toFixed(2)})` : '';
      console.log(`   ✅ ${result.path}${madStr}`);
    }
  }
  
  // Write results JSON
  const reportPath = join(outDir, 'results.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Report: ${reportPath}`);
  
  // Exit with error code if any tests failed
  if (hasErrors) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

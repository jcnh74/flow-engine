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

mkdirSync(outDir, { recursive: true });

async function captureMode(page, modeName, params = {}) {
  console.log(`\n📸 Capturing: ${modeName}`);
  
  const urlParams = new URLSearchParams({ mode: modeName, ...params });
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
    
    // Take screenshot
    const filename = modeName.toLowerCase().replace(/\s+/g, '-');
    const path = join(outDir, `${filename}.png`);
    await page.screenshot({ path, fullPage: false });
    
    // Measure MAD if requested
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
          let frameCount = 0;
          
          function measure() {
            if (frameCount >= 30) {
              const avgMad = mads.reduce((a, b) => a + b, 0) / mads.length;
              resolve({ avgMad, frames: mads.length });
              return;
            }
            
            requestAnimationFrame(() => {
              const w = canvas.width;
              const h = canvas.height;
              const pixels = new Uint8Array(w * h * 4);
              gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
              
              if (prevPixels) {
                let sum = 0;
                for (let i = 0; i < pixels.length; i++) {
                  sum += Math.abs(pixels[i] - prevPixels[i]);
                }
                mads.push(sum / pixels.length);
              }
              
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
      console.log(`   📊 MAD: ${mad.avgMad.toFixed(2)} (${mad.frames} frames)`);
      
      // Regression check: fail if frame is near-uniform (MAD < 0.5)
      if (mad.avgMad < 0.5) {
        console.log(`   ❌ REGRESSION: Near-uniform frame (MAD ${mad.avgMad.toFixed(2)} < 0.5)`);
        return { path, mad: mad.avgMad, error: 'Near-uniform frame', regression: true };
      }
      
      return { path, mad: mad.avgMad };
    }
    
    return { path, mad: null };
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { error: err.message };
  }
}

async function run() {
  console.log('🚀 Render Harness with SwiftShader\n');
  console.log(`URL: ${url}`);
  console.log(`Output: ${outDir}\n`);
  
  const launchArgs = [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-gpu-driver-bug-workarounds',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'
  ];
  
  console.log('Launching Chrome with SwiftShader...');
  
  const browser = await chromium.launch({
    headless: true, // Use new headless mode
    args: [...launchArgs, '--headless=new']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  // Log console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`   🔴 Console: ${msg.text()}`);
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
  
  await browser.close();
  
  console.log('\n\n📋 Summary:');
  for (const result of results) {
    if (result.error) {
      console.log(`   ❌ ${result.error}`);
    } else {
      const madStr = result.mad ? ` (MAD: ${result.mad.toFixed(2)})` : '';
      console.log(`   ✅ ${result.path}${madStr}`);
    }
  }
  
  // Write results JSON
  const reportPath = join(outDir, 'results.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Report: ${reportPath}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

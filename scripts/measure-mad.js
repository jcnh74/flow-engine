#!/usr/bin/env node

/**
 * Measure frame MAD (Mean Absolute Difference) for presets
 * to verify visible animation is occurring.
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function measureMAD(presetName, duration = 3000) {
  console.log(`\n🎬 Measuring MAD for: ${presetName}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    
    // Start dev server and navigate
    const url = `http://localhost:5193?preset=${encodeURIComponent(presetName)}`;
    console.log(`   Loading: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
    
    // Wait for canvas to be ready
    await page.waitForSelector('canvas', { timeout: 5000 });
    await page.waitForTimeout(1000); // Let it settle
    
    // Inject MAD measurement code
    const mads = await page.evaluate((dur) => {
      return new Promise((resolve) => {
        const canvas = document.querySelector('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) {
          resolve({ error: 'No WebGL2 context' });
          return;
        }
        
        let prevPixels = null;
        const madValues = [];
        const startTime = performance.now();
        
        function captureAndCompare() {
          const now = performance.now();
          if (now - startTime > dur) {
            // Done measuring
            const avgMad = madValues.reduce((a, b) => a + b, 0) / madValues.length;
            const maxMad = Math.max(...madValues);
            const minMad = Math.min(...madValues);
            resolve({ avgMad, maxMad, minMad, frames: madValues.length });
            return;
          }
          
          try {
            // Read pixels from canvas
            const w = canvas.width;
            const h = canvas.height;
            const pixels = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            
            // Calculate MAD if we have a previous frame
            if (prevPixels) {
              let sum = 0;
              for (let i = 0; i < pixels.length; i++) {
                sum += Math.abs(pixels[i] - prevPixels[i]);
              }
              const mad = sum / pixels.length;
              madValues.push(mad);
            }
            
            prevPixels = new Uint8Array(pixels);
            requestAnimationFrame(captureAndCompare);
          } catch (err) {
            resolve({ error: err.message });
          }
        }
        
        requestAnimationFrame(captureAndCompare);
      });
    }, duration);
    
    if (mads.error) {
      console.log(`   ❌ Error: ${mads.error}`);
      return null;
    }
    
    console.log(`   ✅ Avg MAD: ${mads.avgMad.toFixed(2)} (min: ${mads.minMad.toFixed(2)}, max: ${mads.maxMad.toFixed(2)}, ${mads.frames} frames)`);
    return mads;
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('📊 Frame MAD Measurement (Target: MAD > 1.0)\n');
  console.log('Starting dev server first...\n');
  
  const presets = ['Fractal Dreams', 'Mandel Vortex'];
  const results = {};
  
  for (const preset of presets) {
    const result = await measureMAD(preset, 3000);
    if (result) {
      results[preset] = result.avgMad;
    }
  }
  
  console.log('\n📋 Summary:');
  for (const [preset, mad] of Object.entries(results)) {
    const status = mad > 1.0 ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${preset}: ${mad.toFixed(2)} ${status}`);
  }
}

main().catch(console.error);

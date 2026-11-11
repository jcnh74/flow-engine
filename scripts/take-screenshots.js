#!/usr/bin/env node

/**
 * Take screenshots of different modes to prove rendering works
 */

import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

async function takeScreenshot(browser, name, url) {
  console.log(`📸 Capturing: ${name}`);
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
    await page.waitForSelector('canvas', { timeout: 5000 });
    
    // Wait for a few frames to render
    await page.waitForTimeout(2000);
    
    // Take screenshot
    const path = `/agent/repos/flow-engine/proof-screenshots/${name}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`   ✅ Saved: ${path}`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('📷 Taking proof screenshots\n');
  
  // Create output directory
  mkdirSync('/agent/repos/flow-engine/proof-screenshots', { recursive: true });
  
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

  const baseUrl = 'http://localhost:5193';
  
  // Take screenshots of required modes
  await takeScreenshot(browser, 'tunnel', `${baseUrl}/?mode=Tunnel`);
  await takeScreenshot(browser, 'wall-studio', `${baseUrl}/?mode=Wall%20Studio`);
  
  // TODO: Add feedback presets when they exist
  // await takeScreenshot(browser, 'feedback-1', `${baseUrl}/?preset=Feedback1`);
  
  await browser.close();
  console.log('\n✅ Screenshot capture complete!');
}

main().catch(console.error);

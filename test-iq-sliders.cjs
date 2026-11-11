const { chromium } = require('playwright');

async function testIQSlider(page, param, value1, value2) {
  console.log(`\n=== Testing ${param}: ${value1} → ${value2} ===`);
  
  // Set first value
  await page.evaluate(([p, v]) => {
    window.engine.P[p] = v;
  }, [param, value1]);
  
  await page.waitForTimeout(500);
  
  // Capture first frame
  const luma1 = await page.evaluate(() => {
    const canvas = document.getElementById('c');
    const gl = canvas.getContext('webgl2');
    const w = 64, h = 64;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      sum += pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114;
    }
    return sum / (w * h);
  });
  
  // Set second value
  await page.evaluate(([p, v]) => {
    window.engine.P[p] = v;
  }, [param, value2]);
  
  await page.waitForTimeout(500);
  
  // Capture second frame
  const luma2 = await page.evaluate(() => {
    const canvas = document.getElementById('c');
    const gl = canvas.getContext('webgl2');
    const w = 64, h = 64;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      sum += pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114;
    }
    return sum / (w * h);
  });
  
  const diff = Math.abs(luma2 - luma1);
  console.log(`  luma1: ${luma1.toFixed(2)}, luma2: ${luma2.toFixed(2)}, diff: ${diff.toFixed(2)}`);
  
  return { luma1, luma2, diff };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const testURL = 'http://localhost:4173/';
  console.log(`Loading ${testURL}`);
  
  page.on('console', msg => {
    if (msg.text().includes('ERROR') || msg.text().includes('setMode')) {
      console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
    }
  });
  
  try {
    await page.goto(testURL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('Page loaded, waiting for initialization...');
    await page.waitForTimeout(3000);
    
    // Set mode to 3D Fractal
    const currentMode = await page.evaluate(() => window.engine.P.mode);
    console.log(`Current mode: ${currentMode}`);
    
    if (currentMode !== '3D Fractal') {
      console.log('Setting mode to 3D Fractal...');
      await page.evaluate(() => {
        window.engine.P.mode = '3D Fractal';
      });
      await page.waitForTimeout(1000);
    }
    
    // Test each IQ parameter
    const results = {};
    
    results.fogDensity = await testIQSlider(page, 'frFogDensity', 0, 0.3);
    results.fogStart = await testIQSlider(page, 'frFogStart', 0, 3);
    results.aoStrength = await testIQSlider(page, 'frAOStrength', 0, 5);
    results.aoRadius = await testIQSlider(page, 'frAORadius', 0.05, 0.3);
    results.shadowSharpness = await testIQSlider(page, 'frShadowSharpness', 2, 16);
    
    console.log('\n=== SUMMARY ===');
    for (const [param, result] of Object.entries(results)) {
      const status = result.diff > 1.0 ? 'PASS' : 'FAIL';
      console.log(`${param}: diff=${result.diff.toFixed(2)} [${status}]`);
    }
    
    const allPass = Object.values(results).every(r => r.diff > 1.0);
    console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
    
    await browser.close();
    process.exit(allPass ? 0 : 1);
    
  } catch (err) {
    console.error('Test failed:', err.message);
    await browser.close();
    process.exit(1);
  }
})();

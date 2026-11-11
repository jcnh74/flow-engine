const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));
  
  console.log('Loading app...');
  await page.goto('http://localhost:4173/', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  await page.waitForTimeout(3000);
  
  // Check current mode
  const info = await page.evaluate(() => {
    return {
      mode: window.engine ? window.engine.P.mode : 'no engine',
      frFogStart: window.engine ? window.engine.P.frFogStart : 'N/A'
    };
  });
  
  console.log('Initial state:', info);
  
  // Try to set 3D Fractal mode and read luma
  console.log('\nSetting to 3D Fractal and reading luma...');
  const result = await page.evaluate(() => {
    window.engine.P.mode = '3D Fractal';
    window.engine.reset();
    
    // Wait for a few frames
    return new Promise(resolve => {
      setTimeout(() => {
        const canvas = document.getElementById('c');
        const gl = canvas.getContext('webgl2');
        const w = 64, h = 64;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        let sum = 0, maxL = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const luma = pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114;
          sum += luma;
          if (luma > maxL) maxL = luma;
        }
        
        resolve({
          mode: window.engine.P.mode,
          avgLuma: (sum / (w * h)).toFixed(2),
          maxLuma: maxL.toFixed(2),
          frFogStart: window.engine.P.frFogStart
        });
      }, 3000);
    });
  });
  
  console.log('Result after 3s:', result);
  
  await browser.close();
  process.exit(result.avgLuma > 0 ? 0 : 1);
})();

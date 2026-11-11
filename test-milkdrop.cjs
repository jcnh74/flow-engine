const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:4173/?mode=milkdrop');
  
  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
    console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
  });
  
  // Detect page errors
  page.on('pageerror', err => {
    console.error(`PAGE ERROR: ${err.message}`);
    console.error(err.stack);
  });
  
  try {
    await page.goto('http://localhost:4173/?mode=milkdrop', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('Page loaded, waiting 3 seconds for initialization...');
    await page.waitForTimeout(3000);
    
    // Check mode and canvas state
    const pageState = await page.evaluate(() => {
      const P = window.P;
      return {
        mode: P ? P.mode : 'P not found',
        milkDropInstance: !!window.butterchurnInstance
      };
    });
    
    console.log('Page state:', pageState);
    
    // Check canvas luma
    const canvasLuma = await page.evaluate(() => {
      const canvas = document.getElementById('c');
      if (!canvas) return { error: 'No canvas found' };
      
      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };
      
      // Read a small region
      const w = 64, h = 64;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      
      let sum = 0, count = 0, maxLuma = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const luma = pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114;
        sum += luma;
        count++;
        if (luma > maxLuma) maxLuma = luma;
      }
      
      return { 
        avgLuma: sum / count,
        maxLuma,
        nonZeroPixels: Array.from(pixels).filter(v => v > 0).length
      };
    });
    
    console.log('\n=== VERIFICATION RESULTS ===');
    console.log('Canvas luma:', JSON.stringify(canvasLuma, null, 2));
    console.log('MilkDrop logs:', logs.filter(l => l.includes('MilkDrop')).join('\n'));
    console.log('===========================\n');
    
    if (canvasLuma.error) {
      console.error('FAIL:', canvasLuma.error);
      process.exit(1);
    }
    
    if (canvasLuma.maxLuma === 0) {
      console.error('FAIL: Canvas is completely black (maxLuma = 0)');
      process.exit(1);
    }
    
    console.log('PASS: MilkDrop loaded successfully, canvas has non-zero luma');
    await browser.close();
    process.exit(0);
    
  } catch (err) {
    console.error('Test failed:', err.message);
    console.error(err.stack);
    await browser.close();
    process.exit(1);
  }
})();

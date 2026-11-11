import { test, expect } from '@playwright/test';

test('MilkDrop loads and renders', async ({ page }) => {
  // Listen for console logs
  const logs: string[] = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  // Listen for page errors
  const errors: Error[] = [];
  page.on('pageerror', error => {
    errors.push(error);
    console.error('Page error:', error);
  });
  
  // Navigate to the app with MilkDrop mode (uses baseURL from config)
  await page.goto('/?mode=milkdrop');
  
  // Wait for the app to load
  await page.waitForSelector('#c', { timeout: 10000 });
  
  // Wait for MilkDrop to initialize and render at least one frame
  await page.waitForTimeout(4000); // Increased from 3s to 4s for reliable rendering
  
  // Check for errors
  if (errors.length > 0) {
    console.log('=== PAGE ERRORS ===');
    errors.forEach(e => console.error(e));
    throw new Error(`Page had ${errors.length} error(s): ${errors[0]?.message}`);
  }
  
  // Check console logs for success
  console.log('=== CONSOLE LOGS ===');
  logs.forEach(log => console.log(log));
  
  const hasLoadingLog = logs.some(log => log.includes('Loading butterchurn modules'));
  const hasInitLog = logs.some(log => log.includes('MilkDrop initialized successfully'));
  const hasCreateVisualizer = logs.some(log => log.includes('hasCreateVisualizer: true'));
  const hasGetPresets = logs.some(log => log.includes('hasGetPresets: true'));
  
  console.log('=== VERIFICATION ===');
  console.log('Loading log:', hasLoadingLog);
  console.log('Init log:', hasInitLog);
  console.log('createVisualizer:', hasCreateVisualizer);
  console.log('getPresets:', hasGetPresets);
  
  expect(hasLoadingLog, 'Should log "Loading butterchurn modules"').toBe(true);
  expect(hasInitLog, 'Should log "MilkDrop initialized successfully"').toBe(true);
  expect(hasCreateVisualizer, 'Should have createVisualizer function').toBe(true);
  expect(hasGetPresets, 'Should have getPresets function').toBe(true);
  
  // Check canvas pixel data to ensure non-zero luma
  const canvas = await page.$('#c');
  expect(canvas, 'Canvas should exist').toBeTruthy();
  
  // Get pixel data from WebGL canvas via readPixels
  const pixelData = await page.evaluate(() => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');
    if (!gl) return null;
    
    const w = Math.min(canvas.width, 256);
    const h = Math.min(canvas.height, 256);
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    let maxLuma = 0;
    let nonZeroPixels = 0;
    let sumLuma = 0;
    
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      
      if (luma > 0) nonZeroPixels++;
      maxLuma = Math.max(maxLuma, luma);
      sumLuma += luma;
    }
    
    return { 
      maxLuma, 
      avgLuma: sumLuma / (w * h),
      nonZeroPixels, 
      totalPixels: w * h 
    };
  });
  
  console.log('=== PIXEL DATA ===');
  console.log(JSON.stringify(pixelData, null, 2));
  
  expect(pixelData, 'Should have pixel data').toBeTruthy();
  expect(pixelData!.maxLuma, 'Should have non-zero luma').toBeGreaterThan(0);
  expect(pixelData!.nonZeroPixels, 'Should have non-zero pixels').toBeGreaterThan(0);
});

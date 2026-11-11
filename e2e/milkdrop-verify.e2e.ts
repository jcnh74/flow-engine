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
  
  // Wait a bit for MilkDrop to initialize
  await page.waitForTimeout(3000);
  
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
  
  // Get pixel data from canvas
  const pixelData = await page.evaluate(() => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let maxLuma = 0;
    let nonZeroPixels = 0;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const luma = (r + g + b) / 3;
      
      if (luma > 0) nonZeroPixels++;
      maxLuma = Math.max(maxLuma, luma);
    }
    
    return { maxLuma, nonZeroPixels, totalPixels: imageData.data.length / 4 };
  });
  
  console.log('=== PIXEL DATA ===');
  console.log(JSON.stringify(pixelData, null, 2));
  
  expect(pixelData, 'Should have pixel data').toBeTruthy();
  expect(pixelData!.maxLuma, 'Should have non-zero luma').toBeGreaterThan(0);
  expect(pixelData!.nonZeroPixels, 'Should have non-zero pixels').toBeGreaterThan(0);
});

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
    console.error('PAGE ERROR:', err.message);
  });
  
  const logs = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  console.log('=== 4. BROWSER BOOT TEST ===');
  console.log('Loading http://127.0.0.1:5190/');
  
  try {
    await page.goto('http://127.0.0.1:5190/', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    console.log('Page loaded, waiting 2 seconds for initialization...');
    await page.waitForTimeout(2000);
    
    console.log('\n=== RESULT ===');
    if (errors.length > 0) {
      console.error('FAIL: Page errors detected:');
      errors.forEach(e => console.error('  -', e));
      await browser.close();
      process.exit(1);
    }
    
    // Check for specific success indicators
    const firstFrameLog = logs.find(l => l.includes('FIRST FRAME'));
    console.log('First frame log:', firstFrameLog || 'not found');
    
    const hasP = await page.evaluate(() => typeof (window.engine?.P) !== 'undefined');
    console.log('window.engine.P exists:', hasP);
    
    if (!hasP) {
      console.error('FAIL: window.engine.P not found');
      await browser.close();
      process.exit(1);
    }
    
    console.log('PASS: Page boots without errors, window.engine.P exists');
    await browser.close();
    process.exit(0);
    
  } catch (err) {
    console.error('FAIL: Browser test failed:', err.message);
    await browser.close();
    process.exit(1);
  }
})();

// Real screenshot capture with proper waiting
import { spawn } from 'child_process';
import fs from 'fs';

async function capture(url, output, waitMs = 8000) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--user-data-dir=/tmp/chrome-cap-' + Date.now(),
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl',
      '--enable-unsafe-swiftshader',
      '--window-size=1920,1080',
      '--screenshot=' + output,
      '--hide-scrollbars',
      '--disable-gpu-sandbox',
      url
    ];
    
    console.log(`Capturing: ${url}`);
    console.log(`Output: ${output}`);
    console.log(`Wait: ${waitMs}ms`);
    
    const chrome = spawn('google-chrome', args);
    let stderr = '';
    
    chrome.stderr.on('data', d => stderr += d.toString());
    
    // Force kill after wait time
    const timeout = setTimeout(() => {
      chrome.kill('SIGTERM');
      setTimeout(() => chrome.kill('SIGKILL'), 2000);
    }, waitMs);
    
    chrome.on('close', (code) => {
      clearTimeout(timeout);
      
      if (fs.existsSync(output)) {
        const size = fs.statSync(output).size;
        console.log(`✓ Screenshot created: ${size} bytes`);
        
        // Check if it's the error screen (13266 bytes)
        if (size === 13266) {
          console.log('⚠️  WARNING: Size matches previous error screens');
        }
        
        resolve({ success: true, size, stderr });
      } else {
        console.log(`✗ No screenshot file created`);
        console.log(`Exit code: ${code}`);
        console.log(`Stderr (last 500): ${stderr.slice(-500)}`);
        reject(new Error(`No file created, exit ${code}`));
      }
    });
    
    chrome.on('error', reject);
  });
}

async function main() {
  const captures = [
    { url: 'http://127.0.0.1:5190/?mode=wall&wmat=silk', output: '/opt/cursor/artifacts/wall-silk.png', wait: 8000 },
    { url: 'http://127.0.0.1:5190/?mode=fractal&frType=0&frPower=8', output: '/opt/cursor/artifacts/fractal-mandelbulb.png', wait: 10000 },
    { url: 'http://127.0.0.1:5190/?mode=fractal&frType=1', output: '/opt/cursor/artifacts/fractal-mandelbox.png', wait: 10000 },
  ];
  
  for (const cap of captures) {
    try {
      console.log(`\n=== ${cap.output} ===`);
      await capture(cap.url, cap.output, cap.wait);
    } catch (err) {
      console.error(`Failed: ${err.message}`);
    }
  }
  
  console.log('\n=== DONE ===');
}

main().catch(console.error);

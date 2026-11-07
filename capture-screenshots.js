// Headless Chrome screenshot capture for Flow Engine
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/opt/cursor/artifacts';

async function captureScreenshot(url, outputPath, width = 1920, height = 1080, waitMs = 5000) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--use-gl=swiftshader',  // Software WebGL
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      `--window-size=${width},${height}`,
      '--screenshot=' + outputPath,
      '--hide-scrollbars',
      '--virtual-time-budget=' + waitMs,
      url
    ];
    
    console.log(`Capturing ${url} -> ${outputPath}`);
    console.log(`Command: google-chrome ${args.join(' ')}`);
    
    const chrome = spawn('google-chrome', args);
    
    let stdout = '';
    let stderr = '';
    
    chrome.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    chrome.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    chrome.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`✓ Captured: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
        resolve({ success: true, stdout, stderr });
      } else {
        console.log(`✗ Failed: ${outputPath}`);
        console.log(`Exit code: ${code}`);
        console.log(`Stdout: ${stdout}`);
        console.log(`Stderr: ${stderr.slice(0, 500)}`);
        reject(new Error(`Screenshot failed with code ${code}`));
      }
    });
    
    chrome.on('error', (err) => {
      console.log(`✗ Chrome error: ${err.message}`);
      reject(err);
    });
  });
}

async function main() {
  console.log('Flow Engine Screenshot Capture');
  console.log('Chrome version:', execSync('google-chrome --version').toString().trim());
  console.log('');
  
  const captures = [
    {
      name: 'wall-studio',
      url: 'http://127.0.0.1:5190/?mode=wall&wmat=silk&wobj=0',
      output: path.join(ARTIFACTS_DIR, 'wall-studio.png'),
      wait: 3000
    },
    {
      name: 'fractal-mandelbulb',
      url: 'http://127.0.0.1:5190/?mode=fractal',
      output: path.join(ARTIFACTS_DIR, 'fractal-mandelbulb.png'),
      wait: 5000
    },
    {
      name: 'fractal-mandelbox',
      url: 'http://127.0.0.1:5190/?mode=fractal&frType=1',
      output: path.join(ARTIFACTS_DIR, 'fractal-mandelbox.png'),
      wait: 5000
    }
  ];
  
  const results = [];
  
  for (const cap of captures) {
    try {
      const result = await captureScreenshot(cap.url, cap.output, 1920, 1080, cap.wait);
      results.push({ name: cap.name, success: true, path: cap.output });
    } catch (err) {
      console.error(`Failed to capture ${cap.name}:`, err.message);
      results.push({ name: cap.name, success: false, error: err.message });
    }
  }
  
  console.log('');
  console.log('=== RESULTS ===');
  results.forEach(r => {
    if (r.success) {
      console.log(`✓ ${r.name}: ${r.path}`);
    } else {
      console.log(`✗ ${r.name}: ${r.error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n${successCount}/${results.length} screenshots captured successfully`);
  
  process.exit(successCount === results.length ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

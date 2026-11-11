// Capture screenshots with Xvfb + headed Chrome
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureWithXvfb() {
  console.log('Starting Xvfb...');
  
  // Start Xvfb on display :99
  const xvfbProcess = exec('Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('Xvfb started on display :99');
  
  try {
    console.log('Launching headed Chrome with DISPLAY=:99...');
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader-webgl',
        '--enable-unsafe-swiftshader',
        '--disable-gpu-sandbox',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      env: {
        ...process.env,
        DISPLAY: ':99'
      }
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();
    
    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('pageerror', err => console.error('ERROR:', err.message));

    console.log('Loading app...');
    await page.goto('http://127.0.0.1:5190', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Check WebGL support
    const webglCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };
      
      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2' };
      
      const ext = gl.getExtension('EXT_color_buffer_float');
      return {
        webgl2: true,
        ext_color_buffer_float: !!ext,
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION)
      };
    });

    console.log('WebGL:', JSON.stringify(webglCheck, null, 2));

    if (!webglCheck.ext_color_buffer_float) {
      throw new Error('EXT_color_buffer_float still unavailable');
    }

    console.log('✅ WebGL2 + EXT_color_buffer_float available!\n');

    // Wait for first render
    await page.waitForTimeout(3000);

    const outputDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const modes = [
      { name: '2D flow', file: '01-2d-flow.png' },
      { name: '3D fabric', file: '02-3d-fabric.png' },
      { name: '3D Fractal', file: '03-3d-fractal.png' },
      { name: 'Grass Field', file: '04-grass-field.png' },
      { name: 'Wall Studio', file: '05-wall-studio.png' },
    ];

    for (const mode of modes) {
      console.log(`Capturing ${mode.name}...`);
      
      await page.evaluate((modeName) => {
        if (window.P) {
          window.P.mode = modeName;
        }
      }, mode.name);

      await page.waitForTimeout(2000);

      const screenshotPath = path.join(outputDir, mode.file);
      await page.screenshot({ path: screenshotPath });

      const stats = fs.statSync(screenshotPath);
      const buffer = fs.readFileSync(screenshotPath);
      const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50;
      
      console.log(`  ${mode.file}: ${stats.size} bytes, PNG: ${isPNG}`);
      
      if (stats.size < 10000) {
        console.warn(`  WARNING: Suspiciously small`);
      }
    }

    console.log('\n✅ Screenshots captured successfully!');
    console.log(`Saved to: ${outputDir}`);

    await browser.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    xvfbProcess.kill();
  }
}

captureWithXvfb().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

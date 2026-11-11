// Capture screenshots with SwiftShader WebGL support
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureScreenshots() {
  console.log('Launching browser with SwiftShader...');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--ignore-gpu-blocklist',
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  try {
    console.log('Loading application...');
    await page.goto('http://127.0.0.1:5190', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Debug: Check what's on the page
    const htmlContent = await page.content();
    console.log('Page loaded, checking for canvas...');
    
    const hasCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const body = document.body.innerHTML.substring(0, 500);
      return {
        hasCanvas: !!canvas,
        bodyPreview: body,
        canvasSelector: canvas ? `canvas#${canvas.id}.${canvas.className}` : 'none'
      };
    });
    console.log('Page status:', hasCanvas);
    
    if (!hasCanvas.hasCanvas) {
      // Wait a bit longer for dynamic content
      await page.waitForTimeout(3000);
    }
    
    // Wait for canvas to be ready
    await page.waitForSelector('canvas', { timeout: 15000 });
    console.log('Canvas found');

    // Check WebGL support
    const webglCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };
      
      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'WebGL2 not available' };
      
      const ext = gl.getExtension('EXT_color_buffer_float');
      return {
        webgl2: !!gl,
        ext_color_buffer_float: !!ext,
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        width: canvas.width,
        height: canvas.height
      };
    });

    console.log('WebGL Status:', JSON.stringify(webglCheck, null, 2));

    if (webglCheck.error) {
      throw new Error(`WebGL Check Failed: ${webglCheck.error}`);
    }

    // Wait for first frame to render
    console.log('Waiting for render...');
    await page.waitForTimeout(2000);

    const outputDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Modes to test
    const modes = [
      { name: '2D flow', file: '01-2d-flow.png' },
      { name: '3D fabric', file: '02-3d-fabric.png' },
      { name: '3D Fractal', file: '03-3d-fractal.png' },
      { name: 'Grass Field', file: '04-grass-field.png' },
      { name: 'Wall Studio', file: '05-wall-studio.png' },
    ];

    for (const mode of modes) {
      console.log(`\nCapturing ${mode.name}...`);
      
      // Switch mode
      await page.evaluate((modeName) => {
        const w = window;
        if (w.P) {
          w.P.mode = modeName;
          console.log('Switched to mode:', modeName);
        }
      }, mode.name);

      // Wait for mode switch to take effect
      await page.waitForTimeout(1000);

      // Capture screenshot
      const screenshotPath = path.join(outputDir, mode.file);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false
      });

      // Verify screenshot is not blank
      const stats = fs.statSync(screenshotPath);
      console.log(`  Saved: ${mode.file} (${stats.size} bytes)`);

      // Read first few bytes to check if it's a valid PNG
      const buffer = fs.readFileSync(screenshotPath);
      const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      console.log(`  Valid PNG: ${isPNG}`);
      
      if (stats.size < 5000) {
        console.warn(`  WARNING: Screenshot seems very small (${stats.size} bytes)`);
      }
    }

    console.log('\n✅ Screenshot capture complete!');
    console.log(`Screenshots saved to: ${outputDir}`);

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run
captureScreenshots().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

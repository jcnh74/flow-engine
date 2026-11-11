# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/smoke-headless.test.ts >> Headless Smoke Tests >> should render non-black frame without errors
- Location: tests/smoke-headless.test.ts:9:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
TimeoutError: page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "http://127.0.0.1:5193/?mode=Tunnel", waiting until "networkidle"

```

# Test source

```ts
  1   | /**
  2   |  * Headless smoke test: detects black canvas and console errors
  3   |  * Fails fast if rendering is broken
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test';
  7   | 
  8   | test.describe('Headless Smoke Tests', () => {
  9   |   test('should render non-black frame without errors', async ({ page }) => {
  10  |     const consoleErrors: string[] = [];
  11  |     
  12  |     // Capture console errors
  13  |     page.on('console', msg => {
  14  |       if (msg.type() === 'error') {
  15  |         consoleErrors.push(msg.text());
  16  |       }
  17  |     });
  18  |     
  19  |     // Capture page errors
  20  |     const pageErrors: string[] = [];
  21  |     page.on('pageerror', err => {
  22  |       pageErrors.push(err.message);
  23  |     });
  24  |     
  25  |     // Load app with simple mode
> 26  |     await page.goto('http://127.0.0.1:5193/?mode=Tunnel', { 
      |                ^ TimeoutError: page.goto: Timeout 30000ms exceeded.
  27  |       waitUntil: 'networkidle',
  28  |       timeout: 30000 
  29  |     });
  30  |     
  31  |     // Wait for rendering to start
  32  |     await page.waitForTimeout(2000);
  33  |     
  34  |     // Check for page errors (should be none)
  35  |     expect(pageErrors.length).toBe(0);
  36  |     
  37  |     // Sample canvas center pixel
  38  |     const canvasData = await page.evaluate(() => {
  39  |       const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  40  |       if (!canvas) return { error: 'Canvas not found' };
  41  |       
  42  |       const ctx = canvas.getContext('2d');
  43  |       if (!ctx) return { error: 'Cannot get 2D context' };
  44  |       
  45  |       const centerX = Math.floor(canvas.width / 2);
  46  |       const centerY = Math.floor(canvas.height / 2);
  47  |       
  48  |       // Sample 10x10 region around center
  49  |       const imageData = ctx.getImageData(centerX - 5, centerY - 5, 10, 10);
  50  |       const data = imageData.data;
  51  |       
  52  |       let sumR = 0, sumG = 0, sumB = 0;
  53  |       let minLuma = 255, maxLuma = 0;
  54  |       
  55  |       for (let i = 0; i < data.length; i += 4) {
  56  |         const r = data[i];
  57  |         const g = data[i + 1];
  58  |         const b = data[i + 2];
  59  |         sumR += r;
  60  |         sumG += g;
  61  |         sumB += b;
  62  |         
  63  |         const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  64  |         minLuma = Math.min(minLuma, luma);
  65  |         maxLuma = Math.max(maxLuma, luma);
  66  |       }
  67  |       
  68  |       const pixels = data.length / 4;
  69  |       return {
  70  |         avgR: sumR / pixels,
  71  |         avgG: sumG / pixels,
  72  |         avgB: sumB / pixels,
  73  |         minLuma,
  74  |         maxLuma,
  75  |         lumaRange: maxLuma - minLuma
  76  |       };
  77  |     });
  78  |     
  79  |     // Check canvas is not black
  80  |     expect(canvasData).not.toHaveProperty('error');
  81  |     if ('avgR' in canvasData) {
  82  |       const avgLuma = 0.2126 * canvasData.avgR + 0.7152 * canvasData.avgG + 0.0722 * canvasData.avgB;
  83  |       
  84  |       // Fail if canvas is uniform black (luma < 10 and range < 5)
  85  |       expect(avgLuma).toBeGreaterThan(10);
  86  |       expect(canvasData.lumaRange).toBeGreaterThan(5);
  87  |     }
  88  |   });
  89  |   
  90  |   test('should render with feedback enabled', async ({ page }) => {
  91  |     const pageErrors: string[] = [];
  92  |     page.on('pageerror', err => {
  93  |       pageErrors.push(err.message);
  94  |     });
  95  |     
  96  |     // Load with feedback enabled
  97  |     await page.goto('http://127.0.0.1:5193/?feedback=1&fbmix=0.85&fbdecay=0.96', {
  98  |       waitUntil: 'networkidle',
  99  |       timeout: 30000
  100 |     });
  101 |     
  102 |     await page.waitForTimeout(2000);
  103 |     
  104 |     // Should not throw errors
  105 |     expect(pageErrors.length).toBe(0);
  106 |     
  107 |     // Canvas should not be black
  108 |     const canvasData = await page.evaluate(() => {
  109 |       const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  110 |       if (!canvas) return null;
  111 |       
  112 |       const ctx = canvas.getContext('2d');
  113 |       if (!ctx) return null;
  114 |       
  115 |       const centerX = Math.floor(canvas.width / 2);
  116 |       const centerY = Math.floor(canvas.height / 2);
  117 |       const pixel = ctx.getImageData(centerX, centerY, 1, 1).data;
  118 |       
  119 |       return {
  120 |         r: pixel[0],
  121 |         g: pixel[1],
  122 |         b: pixel[2],
  123 |         luma: 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]
  124 |       };
  125 |     });
  126 |     
```
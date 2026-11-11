# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: color-controls.e2e.ts >> Color Control Verification >> All modes respond to hue/sat/preset changes
- Location: e2e/color-controls.e2e.ts:14:3

# Error details

```
Error: Channel closed
```

```
Error: page.evaluate: Target page, context or browser has been closed
```

# Test source

```ts
  135 |           engine.V.saturation = 0.5;
  136 |         }
  137 |       });
  138 |       await waitFrames(page, 20); // Reduced wait time
  139 |       const sat05 = await capturePixelStats(page);
  140 |       const sat05Change = Math.max(
  141 |         Math.abs(sat05.meanR - baseline.meanR),
  142 |         Math.abs(sat05.meanG - baseline.meanG),
  143 |         Math.abs(sat05.meanB - baseline.meanB)
  144 |       );
  145 |       console.log(`${mode} sat 0.5: dRGB=${sat05Change.toFixed(1)}`);
  146 |       
  147 |       // Test sat 2.0
  148 |       await page.evaluate(() => {
  149 |         const engine = (window as any).engine;
  150 |         if (engine && engine.V) {
  151 |           engine.V.saturation = 2.0;
  152 |         }
  153 |       });
  154 |       await waitFrames(page, 20); // Reduced wait time
  155 |       const sat20 = await capturePixelStats(page);
  156 |       const sat20Change = Math.max(
  157 |         Math.abs(sat20.meanR - baseline.meanR),
  158 |         Math.abs(sat20.meanG - baseline.meanG),
  159 |         Math.abs(sat20.meanB - baseline.meanB)
  160 |       );
  161 |       console.log(`${mode} sat 2.0: dRGB=${sat20Change.toFixed(1)}`);
  162 |       
  163 |       // Reset saturation
  164 |       await page.evaluate(() => {
  165 |         const engine = (window as any).engine;
  166 |         if (engine && engine.V) {
  167 |           engine.V.saturation = 1.0;
  168 |         }
  169 |       });
  170 |       
  171 |       // Store results
  172 |       results[mode] = {
  173 |         baseline,
  174 |         hue90: { stats: hue90, dRGB: hue90Change },
  175 |         hue180: { stats: hue180, dRGB: hue180Change },
  176 |         hue270: { stats: hue270, dRGB: hue270Change },
  177 |         magma: { stats: magma, dRGB: magmaChange },
  178 |         sat05: { stats: sat05, dRGB: sat05Change },
  179 |         sat20: { stats: sat20, dRGB: sat20Change }
  180 |       };
  181 |       
  182 |       // Assertions for this mode
  183 |       
  184 |       // At least ONE hue change must show dRGB >= 15 OR hue bin change
  185 |       const anyHueWorks = 
  186 |         hue90Change >= 15 || hue90.dominantHueBin !== baseline.dominantHueBin ||
  187 |         hue180Change >= 15 || hue180.dominantHueBin !== baseline.dominantHueBin ||
  188 |         hue270Change >= 15 || hue270.dominantHueBin !== baseline.dominantHueBin;
  189 |       
  190 |       expect(anyHueWorks, `${mode}: At least one hue shift (90/180/270) should change color significantly`).toBe(true);
  191 |       
  192 |       // Magma preset should change color
  193 |       expect(magmaChange, `${mode}: Magma preset should change color by >= 15`).toBeGreaterThanOrEqual(15);
  194 |       
  195 |       // Magma should not blow out (< 50% clipped)
  196 |       expect(magma.clippedPercent, `${mode}: Magma preset should not blow out (< 50% clipped)`).toBeLessThan(50);
  197 |       
  198 |       // At least ONE saturation change should be noticeable
  199 |       const anySatWorks = sat05Change >= 10 || sat20Change >= 10;
  200 |       expect(anySatWorks, `${mode}: At least one saturation change (0.5 or 2.0) should be noticeable`).toBe(true);
  201 |     }
  202 |     
  203 |     // Test official presets for blowout
  204 |     console.log(`\n=== Testing Official Presets ===`);
  205 |     const presetNames = [
  206 |       'Default',
  207 |       'Spiral Dreams',
  208 |       'Kaleidoscope Echo',
  209 |       'Fractal Echo'
  210 |     ];
  211 |     
  212 |     for (const presetName of presetNames) {
  213 |       await page.evaluate((name) => {
  214 |         const engine = (window as any).engine;
  215 |         if (engine && engine.loadPresetFromGallery) {
  216 |           engine.loadPresetFromGallery(name);
  217 |         }
  218 |       }, presetName);
  219 |       
  220 |       await waitFrames(page, 60);
  221 |       
  222 |       const stats = await capturePixelStats(page);
  223 |       console.log(`Preset "${presetName}": luma=${stats.meanLuma.toFixed(1)}, clipped=${stats.clippedPercent.toFixed(1)}%`);
  224 |       
  225 |       expect(stats.clippedPercent, `Preset "${presetName}" should not blow out (< 50% clipped)`).toBeLessThan(50);
  226 |     }
  227 |     
  228 |     // Print summary
  229 |     console.log(`\n=== Summary ===`);
  230 |     console.log(JSON.stringify(results, null, 2));
  231 |   });
  232 | });
  233 | 
  234 | async function waitFrames(page: any, frames: number): Promise<void> {
> 235 |   await page.evaluate((n: number) => {
      |              ^ Error: page.evaluate: Target page, context or browser has been closed
  236 |     return new Promise<void>((resolve) => {
  237 |       let count = 0;
  238 |       const wait = () => {
  239 |         count++;
  240 |         if (count >= n) resolve();
  241 |         else requestAnimationFrame(wait);
  242 |       };
  243 |       requestAnimationFrame(wait);
  244 |     });
  245 |   }, frames);
  246 | }
  247 | 
  248 | async function capturePixelStats(page: any): Promise<PixelStats> {
  249 |   return await page.evaluate(() => {
  250 |     const canvas = document.getElementById('c') as HTMLCanvasElement;
  251 |     const engine = (window as any).engine;
  252 |     
  253 |     // Use engine.readPixelsLDR to read from default FB after tonemap (same frame)
  254 |     // Must be called in the same animation frame to read before compositor clears
  255 |     const w = Math.min(canvas.width, 256);
  256 |     const h = Math.min(canvas.height, 256);
  257 |     let pixels: Uint8Array;
  258 |     
  259 |     if (engine && engine.readPixelsLDR) {
  260 |       pixels = engine.readPixelsLDR(0, 0, w, h);
  261 |       if (!pixels) {
  262 |         // Fallback to default FB if function not available
  263 |         const gl = canvas.getContext('webgl2');
  264 |         if (!gl) throw new Error('No WebGL2 context');
  265 |         pixels = new Uint8Array(w * h * 4);
  266 |         gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  267 |       }
  268 |     } else {
  269 |       // Fallback for old code
  270 |       const gl = canvas.getContext('webgl2');
  271 |       if (!gl) throw new Error('No WebGL2 context');
  272 |       pixels = new Uint8Array(w * h * 4);
  273 |       gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  274 |     }
  275 |     
  276 |     let sumR = 0, sumG = 0, sumB = 0, sumLuma = 0;
  277 |     let maxLuma = 0;
  278 |     let clippedCount = 0;
  279 |     
  280 |     // Hue bins: count which RGB channel is dominant
  281 |     let redDom = 0, greenDom = 0, blueDom = 0;
  282 |     let cyanDom = 0, magentaDom = 0, yellowDom = 0;
  283 |     
  284 |     const totalPixels = w * h;
  285 |     
  286 |     for (let i = 0; i < pixels.length; i += 4) {
  287 |       const r = pixels[i];
  288 |       const g = pixels[i + 1];
  289 |       const b = pixels[i + 2];
  290 |       
  291 |       sumR += r;
  292 |       sumG += g;
  293 |       sumB += b;
  294 |       
  295 |       const luma = r * 0.299 + g * 0.587 + b * 0.114;
  296 |       sumLuma += luma;
  297 |       maxLuma = Math.max(maxLuma, luma);
  298 |       
  299 |       // Count clipped pixels (any channel >= 250)
  300 |       if (r >= 250 || g >= 250 || b >= 250) {
  301 |         clippedCount++;
  302 |       }
  303 |       
  304 |       // Determine dominant hue bin
  305 |       const max = Math.max(r, g, b);
  306 |       const min = Math.min(r, g, b);
  307 |       const delta = max - min;
  308 |       
  309 |       if (delta > 20) { // Only count pixels with some saturation
  310 |         if (r === max && g > b) yellowDom++; // yellow
  311 |         else if (r === max && g < b) magentaDom++; // magenta
  312 |         else if (r === max) redDom++; // red
  313 |         else if (g === max && b > r) cyanDom++; // cyan
  314 |         else if (g === max) greenDom++; // green
  315 |         else if (b === max) blueDom++; // blue
  316 |       }
  317 |     }
  318 |     
  319 |     const meanR = sumR / totalPixels;
  320 |     const meanG = sumG / totalPixels;
  321 |     const meanB = sumB / totalPixels;
  322 |     const meanLuma = sumLuma / totalPixels;
  323 |     const clippedPercent = (clippedCount / totalPixels) * 100;
  324 |     
  325 |     // Determine dominant hue bin
  326 |     const bins = { red: redDom, green: greenDom, blue: blueDom, cyan: cyanDom, magenta: magentaDom, yellow: yellowDom };
  327 |     const dominantHueBin = Object.entries(bins).reduce((a, b) => bins[a[0] as keyof typeof bins] > bins[b[0] as keyof typeof bins] ? a : b)[0];
  328 |     
  329 |     return {
  330 |       meanR,
  331 |       meanG,
  332 |       meanB,
  333 |       meanLuma,
  334 |       maxLuma,
  335 |       dominantHueBin,
```
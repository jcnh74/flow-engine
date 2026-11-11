# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: color-controls.e2e.ts >> Color Control Verification >> All modes respond to hue/sat/preset changes
- Location: e2e/color-controls.e2e.ts:14:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.evaluate: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - text: ▾ ↕ ▸ ↕ ▸ ▾ ↕ ↕ ↕ ✓ ✓ ▸ ↕ ↕ ▸ ✓ ▸ ✓ ▸ ▸ ▸ ↕ ↕ ↕ ↕ ▾ ✓ ↕ ✓ ▸ ✓ ↕ ▸ ✓ ↕ ▸ ↕ ▸ ↕ ↕ ✓ ▾ ↕ ▾ ↕ ▸ ▸ ▾ ↕ ▾ ↕ ↕ ▾ ↕ ↕ ↕ ▾ ↕ ↕ ▸ ↕ ▸ ▸ ↕ ↕ ▾ ↕ ▸ ▸ ▸ ▾ ✓ ↕ ▾ ▾ ↕ ↕ ▾ ↕ ▸ ↕ ↕ ✓ ▾ ↕ ▾ ↕ ↕ ↕ ▾ ↕ ✓ ✓ ↕
  - generic [ref=f1e3]:
    - generic [ref=f1e4]:
      - heading "Flow Engine" [level=1] [ref=f1e5]
      - generic [ref=f1e6]:
        - button "−" [ref=f1e7] [cursor=pointer]
        - button "×" [ref=f1e8] [cursor=pointer]
    - generic [ref=f1e9]:
      - generic [ref=f1e10]:
        - generic [ref=f1e11] [cursor=pointer]:
          - generic [ref=f1e12]: ▼
          - generic [ref=f1e13]: Scene
        - generic [ref=f1e14]:
          - generic [ref=f1e16]:
            - generic [ref=f1e17]: Mode
            - combobox [ref=f1e18] [cursor=pointer]:
              - option "Wall Studio"
              - option "Tunnel" [selected]
              - option "Kaleido"
              - option "Plasma"
              - option "Morph"
              - option "3D Fractal"
              - option "MilkDrop"
              - option "3D fabric"
              - option "Liquid Spheres"
              - option "Particle Fabric"
              - option "2D flow"
          - generic [ref=f1e20]:
            - generic [ref=f1e21]: Seed
            - slider [ref=f1e22]: "1977"
            - generic [ref=f1e23]: "1977.00"
          - generic [ref=f1e25]:
            - generic [ref=f1e26]: Quality / Resolution
            - slider [ref=f1e27]: "0.75"
            - generic [ref=f1e28]: "0.75"
          - generic [ref=f1e31]:
            - checkbox "Auto Quality (60fps)" [checked] [ref=f1e32]
            - text: Auto Quality (60fps)
          - button "🎲 Randomize" [ref=f1e34] [cursor=pointer]
          - button "⛑ Reset" [ref=f1e36] [cursor=pointer]
          - generic [ref=f1e39]:
            - checkbox "Paused" [ref=f1e40]
            - text: Paused
      - generic [ref=f1e41]:
        - generic [ref=f1e42] [cursor=pointer]:
          - generic [ref=f1e43]: ▼
          - generic [ref=f1e44]: Fabric
        - generic [ref=f1e45]:
          - generic [ref=f1e47]:
            - generic [ref=f1e48]: Fold
            - slider [ref=f1e49]: "0.48"
            - generic [ref=f1e50]: "0.48"
            - button "🔗" [ref=f1e51] [cursor=pointer]
          - generic [ref=f1e53]:
            - generic [ref=f1e54]: Warp
            - slider [ref=f1e55]: "0.62"
            - generic [ref=f1e56]: "0.62"
            - button "🔗" [ref=f1e57] [cursor=pointer]
          - generic [ref=f1e59]:
            - generic [ref=f1e60]: Frequency
            - slider [ref=f1e61]: "0.6"
            - generic [ref=f1e62]: "0.60"
            - button "🔗" [ref=f1e63] [cursor=pointer]
      - generic [ref=f1e64]:
        - generic [ref=f1e65] [cursor=pointer]:
          - generic [ref=f1e66]: ▼
          - generic [ref=f1e67]: Spheres
        - generic [ref=f1e68]:
          - generic [ref=f1e70]:
            - generic [ref=f1e71]: Radius
            - slider [ref=f1e72]: "0.045"
            - generic [ref=f1e73]: "0.04"
            - button "🔗" [ref=f1e74] [cursor=pointer]
          - generic [ref=f1e76]:
            - generic [ref=f1e77]: Drip Rate
            - slider [ref=f1e78]: "300"
            - generic [ref=f1e79]: "300.00"
            - button "🔗" [ref=f1e80] [cursor=pointer]
          - generic [ref=f1e82]:
            - generic [ref=f1e83]: Viscosity
            - slider [ref=f1e84]: "0.08"
            - generic [ref=f1e85]: "0.08"
            - button "🔗" [ref=f1e86] [cursor=pointer]
          - generic [ref=f1e88]:
            - generic [ref=f1e89]: Cohesion
            - slider [ref=f1e90]: "0.25"
            - generic [ref=f1e91]: "0.25"
            - button "🔗" [ref=f1e92] [cursor=pointer]
      - generic [ref=f1e93]:
        - generic [ref=f1e94] [cursor=pointer]:
          - generic [ref=f1e95]: ▼
          - generic [ref=f1e96]: Camera
        - generic [ref=f1e97]:
          - generic [ref=f1e99]:
            - generic [ref=f1e100]: Distance
            - slider [ref=f1e101]: "4.2"
            - generic [ref=f1e102]: "4.20"
            - button "🔗" [ref=f1e103] [cursor=pointer]
          - generic [ref=f1e105]:
            - generic [ref=f1e106]: FOV
            - slider [ref=f1e107]: "40"
            - generic [ref=f1e108]: "40.00"
            - button "🔗" [ref=f1e109] [cursor=pointer]
      - generic [ref=f1e110]:
        - generic [ref=f1e111] [cursor=pointer]:
          - generic [ref=f1e112]: ▼
          - generic [ref=f1e113]: Color
        - generic [ref=f1e114]:
          - generic [ref=f1e116]:
            - generic [ref=f1e117]: Preset
            - combobox [ref=f1e118] [cursor=pointer]:
              - option "Neon Dreams" [selected]
              - option "Acid House"
              - option "Sunset Rave"
              - option "Deep Purple"
              - option "Monochrome"
              - option "Ice Club"
              - option "Magma"
              - option "Synthwave"
          - generic [ref=f1e120]:
            - generic [ref=f1e121]: Exposure
            - slider [ref=f1e122]: "1"
            - generic [ref=f1e123]: "1.00"
            - button "🔗" [ref=f1e124] [cursor=pointer]
          - generic [ref=f1e126]:
            - generic [ref=f1e127]: Bloom
            - slider [ref=f1e128]: "0.35"
            - generic [ref=f1e129]: "0.35"
            - button "🔗" [ref=f1e130] [cursor=pointer]
          - generic [ref=f1e132]:
            - generic [ref=f1e133]: Hue Shift
            - slider [ref=f1e134]: "0"
            - generic [ref=f1e135]: "0.00"
            - button "🔗" [ref=f1e136] [cursor=pointer]
          - generic [ref=f1e138]:
            - generic [ref=f1e139]: Saturation
            - slider [ref=f1e140]: "1.3"
            - generic [ref=f1e141]: "1.30"
            - button "🔗" [ref=f1e142] [cursor=pointer]
          - generic [ref=f1e144]:
            - generic [ref=f1e145]: Background
            - textbox [ref=f1e146] [cursor=pointer]: "#020208"
          - generic [ref=f1e148]:
            - generic [ref=f1e149]: Hue Cycle
            - slider [ref=f1e150]: "0"
            - generic [ref=f1e151]: "0.00"
            - button "🔗" [ref=f1e152] [cursor=pointer]
      - generic [ref=f1e153]:
        - generic [ref=f1e154] [cursor=pointer]:
          - generic [ref=f1e155]: ▼
          - generic [ref=f1e156]: Lighting & Studio
        - generic [ref=f1e157]:
          - generic [ref=f1e159]:
            - generic [ref=f1e160]: Studio Rig
            - combobox [ref=f1e161] [cursor=pointer]:
              - option "Softbox" [selected]
              - option "Three-Point"
              - option "Rim Light"
              - option "Club Strobe"
              - option "Sunset"
          - generic [ref=f1e163]:
            - generic [ref=f1e164]: Environment
            - slider [ref=f1e165]: "0.8"
            - generic [ref=f1e166]: "0.80"
            - button "🔗" [ref=f1e167] [cursor=pointer]
          - generic [ref=f1e169]:
            - generic [ref=f1e170]: Env Rotation
            - slider [ref=f1e171]: "0"
            - generic [ref=f1e172]: "0.00"
            - button "🔗" [ref=f1e173] [cursor=pointer]
          - generic [ref=f1e175]:
            - generic [ref=f1e176]: Shadow Softness
            - slider [ref=f1e177]: "1"
            - generic [ref=f1e178]: "2.00"
            - button "🔗" [ref=f1e179] [cursor=pointer]
          - generic [ref=f1e181]:
            - generic [ref=f1e182]: Ambient Occlusion
            - slider [ref=f1e183]: "0.8"
            - generic [ref=f1e184]: "0.80"
            - button "🔗" [ref=f1e185] [cursor=pointer]
          - generic [ref=f1e187]:
            - generic [ref=f1e188]: Fog
            - slider [ref=f1e189]: "0.05"
            - generic [ref=f1e190]: "0.05"
            - button "🔗" [ref=f1e191] [cursor=pointer]
      - generic [ref=f1e192]:
        - generic [ref=f1e193] [cursor=pointer]:
          - generic [ref=f1e194]: ▼
          - generic [ref=f1e195]: Audio & Beat
        - generic [ref=f1e196]:
          - generic [ref=f1e197]: "Source: None"
          - generic [ref=f1e198]:
            - generic [ref=f1e199]:
              - generic [ref=f1e200]: Level
              - generic [ref=f1e202]: "0.00"
            - generic [ref=f1e203]:
              - generic [ref=f1e204]: Bass
              - generic [ref=f1e206]: "0.00"
            - generic [ref=f1e207]:
              - generic [ref=f1e208]: Mid
              - generic [ref=f1e210]: "0.00"
            - generic [ref=f1e211]:
              - generic [ref=f1e212]: High
              - generic [ref=f1e214]: "0.00"
          - generic [ref=f1e215]: Drums
          - generic [ref=f1e216]:
            - generic [ref=f1e217]:
              - generic [ref=f1e218]: Kick
              - generic [ref=f1e220]: "0.00"
            - generic [ref=f1e221]:
              - generic [ref=f1e222]: Snare
              - generic [ref=f1e224]: "0.00"
            - generic [ref=f1e225]:
              - generic [ref=f1e226]: Hat
              - generic [ref=f1e228]: "0.00"
          - generic [ref=f1e229]: Envelopes
          - generic [ref=f1e230]:
            - generic [ref=f1e231]:
              - generic [ref=f1e232]: 8th
              - generic [ref=f1e234]: "0.00"
            - generic [ref=f1e235]:
              - generic [ref=f1e236]: 16th
              - generic [ref=f1e238]: "0.00"
            - generic [ref=f1e239]:
              - generic [ref=f1e240]: 32nd
              - generic [ref=f1e242]: "0.00"
          - generic [ref=f1e243]: 120 BPM
      - generic [ref=f1e246]:
        - generic [ref=f1e247] [cursor=pointer]:
          - generic [ref=f1e248]: ▼
          - generic [ref=f1e249]: Presets
        - generic [ref=f1e250]:
          - button "💾 Save Preset" [ref=f1e252] [cursor=pointer]
          - button "⬇ Export JSON" [ref=f1e254] [cursor=pointer]
          - button "⬆ Import JSON" [ref=f1e256] [cursor=pointer]
      - generic [ref=f1e257]:
        - generic [ref=f1e258] [cursor=pointer]:
          - generic [ref=f1e259]: ▼
          - generic [ref=f1e260]: MIDI
        - generic [ref=f1e261]:
          - generic [ref=f1e262]: ❌ Disconnected
          - generic [ref=f1e263]: No MIDI devices
          - generic [ref=f1e264]: Right-click any slider to MIDI Learn
          - button "⬇ Export MIDI Map" [ref=f1e266] [cursor=pointer]
          - button "⬆ Import MIDI Map" [ref=f1e268] [cursor=pointer]
          - generic [ref=f1e269]: "Mappings: 0"
      - generic [ref=f1e270]:
        - generic [ref=f1e271] [cursor=pointer]:
          - generic [ref=f1e272]: ▼
          - generic [ref=f1e273]: Remote Control
        - generic [ref=f1e274]:
          - generic [ref=f1e275]: ⚠️ Relay Offline
          - generic [ref=f1e276]: Scan QR code with iPhone/iPad
          - img "Remote QR Code" [ref=f1e278]
          - generic [ref=f1e279]: http://172.30.0.2:5190/remote.html
          - generic [ref=f1e280]:
            - text: "Start relay:"
            - code [ref=f1e281]: bun relay-server.ts
      - generic [ref=f1e282]:
        - generic [ref=f1e283]:
          - generic [ref=f1e284]: H
          - text: Hide
        - generic [ref=f1e285]:
          - generic [ref=f1e286]: C
          - text: Collapse
        - generic [ref=f1e287]:
          - generic [ref=f1e288]: Shift
          - text: +
          - generic [ref=f1e289]: R
          - text: Randomize
        - generic [ref=f1e290]:
          - generic [ref=f1e291]: Space
          - text: Pause
  - generic [ref=f1e292]:
    - generic [ref=f1e293]:
      - heading "Presets" [level=2] [ref=f1e294]
      - generic [ref=f1e295]:
        - button "◀" [ref=f1e296] [cursor=pointer]
        - button "🎲" [ref=f1e297] [cursor=pointer]
        - button "▶" [ref=f1e298] [cursor=pointer]
    - generic [ref=f1e299]:
      - generic [ref=f1e300] [cursor=pointer]:
        - generic [ref=f1e301]: ○
        - generic [ref=f1e304]:
          - generic [ref=f1e305]: Neon Tunnel
          - generic [ref=f1e306]: Tunnel
      - generic [ref=f1e307] [cursor=pointer]:
        - generic [ref=f1e308]: ❖
        - generic [ref=f1e311]:
          - generic [ref=f1e312]: Acid Kaleido
          - generic [ref=f1e313]: Kaleido
      - generic [ref=f1e314] [cursor=pointer]:
        - generic [ref=f1e315]: ◉
        - generic [ref=f1e318]:
          - generic [ref=f1e319]: Neon Chrome Wall
          - generic [ref=f1e320]: Wall Studio
      - generic [ref=f1e321] [cursor=pointer]:
        - generic [ref=f1e322]: ∿
        - generic [ref=f1e325]:
          - generic [ref=f1e326]: Sunset Liquid
          - generic [ref=f1e327]: Plasma
      - generic [ref=f1e328] [cursor=pointer]:
        - generic [ref=f1e329]: ●
        - generic [ref=f1e332]:
          - generic [ref=f1e333]: Morphing Blobs
          - generic [ref=f1e334]: Morph
      - generic [ref=f1e335] [cursor=pointer]:
        - generic [ref=f1e336]: ◉
        - generic [ref=f1e339]:
          - generic [ref=f1e340]: Deep Ocean Wall
          - generic [ref=f1e341]: Wall Studio
      - generic [ref=f1e342] [cursor=pointer]:
        - generic [ref=f1e343]: ✦
        - generic [ref=f1e346]:
          - generic [ref=f1e347]: Fractal Dreams
          - generic [ref=f1e348]: 3D Fractal
      - generic [ref=f1e349] [cursor=pointer]:
        - generic [ref=f1e350]: ○
        - generic [ref=f1e353]:
          - generic [ref=f1e354]: Electric Tunnel
          - generic [ref=f1e355]: Tunnel
      - generic [ref=f1e356] [cursor=pointer]:
        - generic [ref=f1e357]: ❖
        - generic [ref=f1e360]:
          - generic [ref=f1e361]: Rainbow Kaleido
          - generic [ref=f1e362]: Kaleido
      - generic [ref=f1e363] [cursor=pointer]:
        - generic [ref=f1e364]: ∿
        - generic [ref=f1e367]:
          - generic [ref=f1e368]: Techno Liquid
          - generic [ref=f1e369]: Plasma
      - generic [ref=f1e370] [cursor=pointer]:
        - generic [ref=f1e371]: ●
        - generic [ref=f1e374]:
          - generic [ref=f1e375]: Organic Morph
          - generic [ref=f1e376]: Morph
      - generic [ref=f1e377] [cursor=pointer]:
        - generic [ref=f1e378]: ◉
        - generic [ref=f1e381]:
          - generic [ref=f1e382]: Monochrome Strobe
          - generic [ref=f1e383]: Wall Studio
      - generic [ref=f1e384] [cursor=pointer]:
        - generic [ref=f1e385]: ○
        - generic [ref=f1e388]:
          - generic [ref=f1e389]: Hyperdrive
          - generic [ref=f1e390]: Tunnel
      - generic [ref=f1e391] [cursor=pointer]:
        - generic [ref=f1e392]: ✦
        - generic [ref=f1e395]:
          - generic [ref=f1e396]: Mandel Vortex
          - generic [ref=f1e397]: 3D Fractal
      - generic [ref=f1e398] [cursor=pointer]:
        - generic [ref=f1e399]: ✦
        - generic [ref=f1e402]:
          - generic [ref=f1e403]: Box Matrix
          - generic [ref=f1e404]: 3D Fractal
      - generic [ref=f1e405] [cursor=pointer]:
        - generic [ref=f1e406]: ✦
        - generic [ref=f1e409]:
          - generic [ref=f1e410]: Menger Cube
          - generic [ref=f1e411]: 3D Fractal
      - generic [ref=f1e412] [cursor=pointer]:
        - generic [ref=f1e413]: ∿
        - generic [ref=f1e416]:
          - generic [ref=f1e417]: Purple Haze
          - generic [ref=f1e418]: Plasma
      - generic [ref=f1e419] [cursor=pointer]:
        - generic [ref=f1e420]: ❖
        - generic [ref=f1e423]:
          - generic [ref=f1e424]: Mirror Dance
          - generic [ref=f1e425]: Kaleido
      - generic [ref=f1e426] [cursor=pointer]:
        - generic [ref=f1e427]: ●
        - generic [ref=f1e430]:
          - generic [ref=f1e431]: Lava Morph
          - generic [ref=f1e432]: Morph
      - generic [ref=f1e433] [cursor=pointer]:
        - generic [ref=f1e434]: ◉
        - generic [ref=f1e437]:
          - generic [ref=f1e438]: Sunset Gold Wall
          - generic [ref=f1e439]: Wall Studio
      - generic [ref=f1e440] [cursor=pointer]:
        - generic [ref=f1e441]: ◉
        - generic [ref=f1e444]:
          - generic [ref=f1e445]: Acid Rainbow Wall
          - generic [ref=f1e446]: Wall Studio
      - generic [ref=f1e447] [cursor=pointer]:
        - generic [ref=f1e448]: ○
        - generic [ref=f1e451]:
          - generic [ref=f1e452]: Void Tunnel
          - generic [ref=f1e453]: Tunnel
      - generic [ref=f1e454] [cursor=pointer]:
        - generic [ref=f1e455]: ○
        - generic [ref=f1e458]:
          - generic [ref=f1e459]: "Feedback: Spiral Dreams"
          - generic [ref=f1e460]: Tunnel
      - generic [ref=f1e461] [cursor=pointer]:
        - generic [ref=f1e462]: ❖
        - generic [ref=f1e465]:
          - generic [ref=f1e466]: "Feedback: Kaleidoscope Echo"
          - generic [ref=f1e467]: Kaleido
      - generic [ref=f1e468] [cursor=pointer]:
        - generic [ref=f1e469]: ∿
        - generic [ref=f1e472]:
          - generic [ref=f1e473]: "Feedback: Plasma Warp"
          - generic [ref=f1e474]: Plasma
      - generic [ref=f1e475] [cursor=pointer]:
        - generic [ref=f1e476]: ✦
        - generic [ref=f1e479]:
          - generic [ref=f1e480]: "Feedback: Fractal Echo"
          - generic [ref=f1e481]: 3D Fractal
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | interface PixelStats {
  4   |   meanR: number;
  5   |   meanG: number;
  6   |   meanB: number;
  7   |   meanLuma: number;
  8   |   maxLuma: number;
  9   |   dominantHueBin: string; // 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow'
  10  |   clippedPercent: number; // % of pixels with R|G|B >= 250
  11  | }
  12  | 
  13  | test.describe('Color Control Verification', () => {
  14  |   test('All modes respond to hue/sat/preset changes', async ({ page }) => {
  15  |     // Navigate to app
  16  |     await page.goto('/');
  17  |     await page.waitForSelector('#c', { timeout: 10000 });
  18  |     
  19  |     // Wait for initialization
  20  |     await page.waitForTimeout(2000);
  21  |     
  22  |     const modes = [
  23  |       'Wall Studio',
  24  |       'Tunnel',
  25  |       'Kaleido',
  26  |       'Plasma',
  27  |       'Morph',
  28  |       '3D Fractal',
  29  |       'MilkDrop'
  30  |     ];
  31  |     
  32  |     const results: any = {};
  33  |     
  34  |     for (const mode of modes) {
  35  |       console.log(`\n=== Testing ${mode} ===`);
  36  |       
  37  |       // Set mode
  38  |       await page.evaluate((m) => {
  39  |         const engine = (window as any).engine;
  40  |         if (engine && engine.setMode) {
  41  |           engine.setMode(m);
  42  |         }
  43  |       }, mode);
  44  |       
  45  |       // Wait for mode to initialize
  46  |       await page.waitForTimeout(1000);
  47  |       
  48  |       // Wait for rendering to stabilize (60 frames)
> 49  |       await page.evaluate(() => {
      |                  ^ Error: page.evaluate: Test timeout of 30000ms exceeded.
  50  |         return new Promise<void>((resolve) => {
  51  |           let frames = 0;
  52  |           const wait = () => {
  53  |             frames++;
  54  |             if (frames >= 60) resolve();
  55  |             else requestAnimationFrame(wait);
  56  |           };
  57  |           requestAnimationFrame(wait);
  58  |         });
  59  |       });
  60  |       
  61  |       // Test baseline (hue 0, sat 1.0)
  62  |       const baseline = await capturePixelStats(page);
  63  |       console.log(`${mode} baseline:`, baseline);
  64  |       
  65  |       // Test hue 90
  66  |       await page.evaluate(() => {
  67  |         const engine = (window as any).engine;
  68  |         if (engine && engine.P) {
  69  |           engine.P.hueShift = 90;
  70  |         }
  71  |       });
  72  |       await waitFrames(page, 30);
  73  |       const hue90 = await capturePixelStats(page);
  74  |       const hue90Change = Math.max(
  75  |         Math.abs(hue90.meanR - baseline.meanR),
  76  |         Math.abs(hue90.meanG - baseline.meanG),
  77  |         Math.abs(hue90.meanB - baseline.meanB)
  78  |       );
  79  |       console.log(`${mode} hue 90: dRGB=${hue90Change.toFixed(1)}, hueBin=${hue90.dominantHueBin}`);
  80  |       
  81  |       // Test hue 180
  82  |       await page.evaluate(() => {
  83  |         const engine = (window as any).engine;
  84  |         if (engine && engine.P) {
  85  |           engine.P.hueShift = 180;
  86  |         }
  87  |       });
  88  |       await waitFrames(page, 30);
  89  |       const hue180 = await capturePixelStats(page);
  90  |       const hue180Change = Math.max(
  91  |         Math.abs(hue180.meanR - baseline.meanR),
  92  |         Math.abs(hue180.meanG - baseline.meanG),
  93  |         Math.abs(hue180.meanB - baseline.meanB)
  94  |       );
  95  |       console.log(`${mode} hue 180: dRGB=${hue180Change.toFixed(1)}, hueBin=${hue180.dominantHueBin}`);
  96  |       
  97  |       // Test hue 270
  98  |       await page.evaluate(() => {
  99  |         const engine = (window as any).engine;
  100 |         if (engine && engine.P) {
  101 |           engine.P.hueShift = 270;
  102 |         }
  103 |       });
  104 |       await waitFrames(page, 30);
  105 |       const hue270 = await capturePixelStats(page);
  106 |       const hue270Change = Math.max(
  107 |         Math.abs(hue270.meanR - baseline.meanR),
  108 |         Math.abs(hue270.meanG - baseline.meanG),
  109 |         Math.abs(hue270.meanB - baseline.meanB)
  110 |       );
  111 |       console.log(`${mode} hue 270: dRGB=${hue270Change.toFixed(1)}, hueBin=${hue270.dominantHueBin}`);
  112 |       
  113 |       // Reset hue
  114 |       await page.evaluate(() => {
  115 |         const engine = (window as any).engine;
  116 |         if (engine && engine.P) {
  117 |           engine.P.hueShift = 0;
  118 |         }
  119 |       });
  120 |       await waitFrames(page, 30);
  121 |       
  122 |       // Test Color Preset "Magma"
  123 |       await page.evaluate(() => {
  124 |         const engine = (window as any).engine;
  125 |         if (engine && engine.setStops) {
  126 |           // Magma gradient: red -> orange -> yellow
  127 |           engine.setStops([[0, '#ff0000'], [0.5, '#ff8c00'], [1, '#ffff00']]);
  128 |         }
  129 |       });
  130 |       await waitFrames(page, 30);
  131 |       const magma = await capturePixelStats(page);
  132 |       const magmaChange = Math.max(
  133 |         Math.abs(magma.meanR - baseline.meanR),
  134 |         Math.abs(magma.meanG - baseline.meanG),
  135 |         Math.abs(magma.meanB - baseline.meanB)
  136 |       );
  137 |       console.log(`${mode} Magma preset: dRGB=${magmaChange.toFixed(1)}, clipped=${magma.clippedPercent.toFixed(1)}%`);
  138 |       
  139 |       // Test sat 0.5
  140 |       await page.evaluate(() => {
  141 |         const engine = (window as any).engine;
  142 |         if (engine && engine.V) {
  143 |           engine.V.saturation = 0.5;
  144 |         }
  145 |       });
  146 |       await waitFrames(page, 30);
  147 |       const sat05 = await capturePixelStats(page);
  148 |       const sat05Change = Math.max(
  149 |         Math.abs(sat05.meanR - baseline.meanR),
```
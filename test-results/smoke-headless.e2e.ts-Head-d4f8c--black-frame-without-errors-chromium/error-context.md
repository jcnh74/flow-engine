# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke-headless.e2e.ts >> Headless Smoke Tests >> should render non-black frame without errors
- Location: e2e/smoke-headless.e2e.ts:28:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 50
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - text: ▾ ↕ ▸ ↕ ▸ ▾ ↕ ↕ ↕ ✓ ✓ ▸ ↕ ↕ ▸ ✓ ▸ ✓ ▸ ▸ ▸ ↕ ↕ ↕ ↕ ▾ ✓ ↕ ✓ ▸ ✓ ↕ ▸ ✓ ↕ ▸ ↕ ▸ ↕ ↕ ✓ ▾ ↕ ▾ ↕ ▸ ▾ ▾ ↕ ▾ ↕ ↕ ▾ ↕ ↕ ↕ ▾ ↕ ↕ ▸ ↕ ▸ ▸ ↕ ↕ ▾ ↕ ▸ ▸ ▸ ▾ ✓ ↕ ▾ ▾ ↕ ↕ ▾ ↕ ▸ ↕ ↕ ✓ ▾ ↕ ▾ ↕ ↕ ↕ ▾ ↕ ✓ ↕
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Flow Engine" [level=1] [ref=e5]
      - generic [ref=e6]:
        - button "−" [ref=e7] [cursor=pointer]
        - button "×" [ref=e8] [cursor=pointer]
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11] [cursor=pointer]:
          - generic [ref=e12]: ▼
          - generic [ref=e13]: Scene
        - generic [ref=e14]:
          - generic [ref=e16]:
            - generic [ref=e17]: Mode
            - combobox [ref=e18] [cursor=pointer]:
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
          - generic [ref=e20]:
            - generic [ref=e21]: Seed
            - slider [ref=e22]: "1977"
            - generic [ref=e23]: "1977.00"
          - generic [ref=e25]:
            - generic [ref=e26]: Quality / Resolution
            - slider [ref=e27]: "0.85"
            - generic [ref=e28]: "0.85"
          - generic [ref=e31]:
            - checkbox "Auto Quality (60fps)" [checked] [ref=e32]
            - text: Auto Quality (60fps)
          - button "🎲 Randomize" [ref=e34] [cursor=pointer]
          - button "⛑ Reset" [ref=e36] [cursor=pointer]
          - generic [ref=e39]:
            - checkbox "Paused" [ref=e40]
            - text: Paused
      - generic [ref=e41]:
        - generic [ref=e42] [cursor=pointer]:
          - generic [ref=e43]: ▼
          - generic [ref=e44]: Fabric
        - generic [ref=e45]:
          - generic [ref=e47]:
            - generic [ref=e48]: Fold
            - slider [ref=e49]: "0.55"
            - generic [ref=e50]: "0.55"
            - button "🔗" [ref=e51] [cursor=pointer]
          - generic [ref=e53]:
            - generic [ref=e54]: Warp
            - slider [ref=e55]: "0.6"
            - generic [ref=e56]: "0.60"
            - button "🔗" [ref=e57] [cursor=pointer]
          - generic [ref=e59]:
            - generic [ref=e60]: Frequency
            - slider [ref=e61]: "0.6"
            - generic [ref=e62]: "0.60"
            - button "🔗" [ref=e63] [cursor=pointer]
      - generic [ref=e64]:
        - generic [ref=e65] [cursor=pointer]:
          - generic [ref=e66]: ▼
          - generic [ref=e67]: Spheres
        - generic [ref=e68]:
          - generic [ref=e70]:
            - generic [ref=e71]: Radius
            - slider [ref=e72]: "0.038"
            - generic [ref=e73]: "0.04"
            - button "🔗" [ref=e74] [cursor=pointer]
          - generic [ref=e76]:
            - generic [ref=e77]: Drip Rate
            - slider [ref=e78]: "300"
            - generic [ref=e79]: "300.00"
            - button "🔗" [ref=e80] [cursor=pointer]
          - generic [ref=e82]:
            - generic [ref=e83]: Viscosity
            - slider [ref=e84]: "0.08"
            - generic [ref=e85]: "0.08"
            - button "🔗" [ref=e86] [cursor=pointer]
          - generic [ref=e88]:
            - generic [ref=e89]: Cohesion
            - slider [ref=e90]: "0.25"
            - generic [ref=e91]: "0.25"
            - button "🔗" [ref=e92] [cursor=pointer]
      - generic [ref=e93]:
        - generic [ref=e94] [cursor=pointer]:
          - generic [ref=e95]: ▼
          - generic [ref=e96]: Camera
        - generic [ref=e97]:
          - generic [ref=e99]:
            - generic [ref=e100]: Distance
            - slider [ref=e101]: "4.2"
            - generic [ref=e102]: "4.20"
            - button "🔗" [ref=e103] [cursor=pointer]
          - generic [ref=e105]:
            - generic [ref=e106]: FOV
            - slider [ref=e107]: "40"
            - generic [ref=e108]: "40.00"
            - button "🔗" [ref=e109] [cursor=pointer]
      - generic [ref=e110]:
        - generic [ref=e111] [cursor=pointer]:
          - generic [ref=e112]: ▼
          - generic [ref=e113]: Color
        - generic [ref=e114]:
          - generic [ref=e116]:
            - generic [ref=e117]: Preset
            - combobox [ref=e118] [cursor=pointer]:
              - option "Neon Dreams" [selected]
              - option "Acid House"
              - option "Sunset Rave"
              - option "Deep Purple"
              - option "Monochrome"
              - option "Ice Club"
              - option "Magma"
              - option "Synthwave"
          - generic [ref=e120]:
            - generic [ref=e121]: Exposure
            - slider [ref=e122]: "1"
            - generic [ref=e123]: "1.00"
            - button "🔗" [ref=e124] [cursor=pointer]
          - generic [ref=e126]:
            - generic [ref=e127]: Bloom
            - slider [ref=e128]: "0.35"
            - generic [ref=e129]: "0.35"
            - button "🔗" [ref=e130] [cursor=pointer]
          - generic [ref=e132]:
            - generic [ref=e133]: Hue Shift
            - slider [ref=e134]: "0"
            - generic [ref=e135]: "0.00"
            - button "🔗" [ref=e136] [cursor=pointer]
          - generic [ref=e138]:
            - generic [ref=e139]: Saturation
            - slider [ref=e140]: "1.3"
            - generic [ref=e141]: "1.30"
            - button "🔗" [ref=e142] [cursor=pointer]
          - generic [ref=e144]:
            - generic [ref=e145]: Background
            - textbox [ref=e146] [cursor=pointer]: "#020208"
          - generic [ref=e148]:
            - generic [ref=e149]: Hue Cycle
            - slider [ref=e150]: "0"
            - generic [ref=e151]: "0.00"
            - button "🔗" [ref=e152] [cursor=pointer]
      - generic [ref=e153]:
        - generic [ref=e154] [cursor=pointer]:
          - generic [ref=e155]: ▼
          - generic [ref=e156]: Lighting & Studio
        - generic [ref=e157]:
          - generic [ref=e159]:
            - generic [ref=e160]: Studio Rig
            - combobox [ref=e161] [cursor=pointer]:
              - option "Softbox" [selected]
              - option "Three-Point"
              - option "Rim Light"
              - option "Club Strobe"
              - option "Sunset"
          - generic [ref=e163]:
            - generic [ref=e164]: Environment
            - slider [ref=e165]: "0.8"
            - generic [ref=e166]: "0.80"
            - button "🔗" [ref=e167] [cursor=pointer]
          - generic [ref=e169]:
            - generic [ref=e170]: Env Rotation
            - slider [ref=e171]: "0"
            - generic [ref=e172]: "0.00"
            - button "🔗" [ref=e173] [cursor=pointer]
          - generic [ref=e175]:
            - generic [ref=e176]: Shadow Softness
            - slider [ref=e177]: "0.35"
            - generic [ref=e178]: "0.35"
            - button "🔗" [ref=e179] [cursor=pointer]
          - generic [ref=e181]:
            - generic [ref=e182]: Ambient Occlusion
            - slider [ref=e183]: "0.7"
            - generic [ref=e184]: "0.70"
            - button "🔗" [ref=e185] [cursor=pointer]
          - generic [ref=e187]:
            - generic [ref=e188]: Fog
            - slider [ref=e189]: "0.5"
            - generic [ref=e190]: "0.50"
            - button "🔗" [ref=e191] [cursor=pointer]
      - generic [ref=e192]:
        - generic [ref=e193] [cursor=pointer]:
          - generic [ref=e194]: ▼
          - generic [ref=e195]: Audio & Beat
        - generic [ref=e196]:
          - generic [ref=e197]: "Source: None"
          - generic [ref=e198]:
            - generic [ref=e199]:
              - generic [ref=e200]: Level
              - generic [ref=e202]: "0.00"
            - generic [ref=e203]:
              - generic [ref=e204]: Bass
              - generic [ref=e206]: "0.00"
            - generic [ref=e207]:
              - generic [ref=e208]: Mid
              - generic [ref=e210]: "0.00"
            - generic [ref=e211]:
              - generic [ref=e212]: High
              - generic [ref=e214]: "0.00"
          - generic [ref=e215]: Drums
          - generic [ref=e216]:
            - generic [ref=e217]:
              - generic [ref=e218]: Kick
              - generic [ref=e220]: "0.00"
            - generic [ref=e221]:
              - generic [ref=e222]: Snare
              - generic [ref=e224]: "0.00"
            - generic [ref=e225]:
              - generic [ref=e226]: Hat
              - generic [ref=e228]: "0.00"
          - generic [ref=e229]: Envelopes
          - generic [ref=e230]:
            - generic [ref=e231]:
              - generic [ref=e232]: 8th
              - generic [ref=e234]: "0.00"
            - generic [ref=e235]:
              - generic [ref=e236]: 16th
              - generic [ref=e238]: "0.00"
            - generic [ref=e239]:
              - generic [ref=e240]: 32nd
              - generic [ref=e242]: "0.00"
          - generic [ref=e243]: 120 BPM
      - generic [ref=e246]:
        - generic [ref=e247] [cursor=pointer]:
          - generic [ref=e248]: ▼
          - generic [ref=e249]: Presets
        - generic [ref=e250]:
          - button "💾 Save Preset" [ref=e252] [cursor=pointer]
          - button "⬇ Export JSON" [ref=e254] [cursor=pointer]
          - button "⬆ Import JSON" [ref=e256] [cursor=pointer]
      - generic [ref=e257]:
        - generic [ref=e258] [cursor=pointer]:
          - generic [ref=e259]: ▼
          - generic [ref=e260]: MIDI
        - generic [ref=e261]:
          - generic [ref=e262]: ❌ Disconnected
          - generic [ref=e263]: No MIDI devices
          - generic [ref=e264]: Right-click any slider to MIDI Learn
          - button "⬇ Export MIDI Map" [ref=e266] [cursor=pointer]
          - button "⬆ Import MIDI Map" [ref=e268] [cursor=pointer]
          - generic [ref=e269]: "Mappings: 0"
      - generic [ref=e270]:
        - generic [ref=e271] [cursor=pointer]:
          - generic [ref=e272]: ▼
          - generic [ref=e273]: Remote Control
        - generic [ref=e274]:
          - generic [ref=e275]: ⚠️ Relay Offline
          - generic [ref=e276]: Scan QR code with iPhone/iPad
          - img "Remote QR Code" [ref=e278]
          - generic [ref=e279]: http://172.30.0.2:5190/remote.html
          - generic [ref=e280]:
            - text: "Start relay:"
            - code [ref=e281]: bun relay-server.ts
      - generic [ref=e282]:
        - generic [ref=e283]:
          - generic [ref=e284]: H
          - text: Hide
        - generic [ref=e285]:
          - generic [ref=e286]: C
          - text: Collapse
        - generic [ref=e287]:
          - generic [ref=e288]: Shift
          - text: +
          - generic [ref=e289]: R
          - text: Randomize
        - generic [ref=e290]:
          - generic [ref=e291]: Space
          - text: Pause
  - generic [ref=e292]:
    - generic [ref=e293]:
      - heading "Presets" [level=2] [ref=e294]
      - generic [ref=e295]:
        - button "◀" [ref=e296] [cursor=pointer]
        - button "🎲" [ref=e297] [cursor=pointer]
        - button "▶" [ref=e298] [cursor=pointer]
    - generic [ref=e299]:
      - generic [ref=e300] [cursor=pointer]:
        - generic [ref=e301]: ○
        - generic [ref=e304]:
          - generic [ref=e305]: Neon Tunnel
          - generic [ref=e306]: Tunnel
      - generic [ref=e307] [cursor=pointer]:
        - generic [ref=e308]: ❖
        - generic [ref=e311]:
          - generic [ref=e312]: Acid Kaleido
          - generic [ref=e313]: Kaleido
      - generic [ref=e314] [cursor=pointer]:
        - generic [ref=e315]: ◉
        - generic [ref=e318]:
          - generic [ref=e319]: Neon Chrome Wall
          - generic [ref=e320]: Wall Studio
      - generic [ref=e321] [cursor=pointer]:
        - generic [ref=e322]: ∿
        - generic [ref=e325]:
          - generic [ref=e326]: Sunset Liquid
          - generic [ref=e327]: Plasma
      - generic [ref=e328] [cursor=pointer]:
        - generic [ref=e329]: ●
        - generic [ref=e332]:
          - generic [ref=e333]: Morphing Blobs
          - generic [ref=e334]: Morph
      - generic [ref=e335] [cursor=pointer]:
        - generic [ref=e336]: ◉
        - generic [ref=e339]:
          - generic [ref=e340]: Deep Ocean Wall
          - generic [ref=e341]: Wall Studio
      - generic [ref=e342] [cursor=pointer]:
        - generic [ref=e343]: ✦
        - generic [ref=e346]:
          - generic [ref=e347]: Fractal Dreams
          - generic [ref=e348]: 3D Fractal
      - generic [ref=e349] [cursor=pointer]:
        - generic [ref=e350]: ○
        - generic [ref=e353]:
          - generic [ref=e354]: Electric Tunnel
          - generic [ref=e355]: Tunnel
      - generic [ref=e356] [cursor=pointer]:
        - generic [ref=e357]: ❖
        - generic [ref=e360]:
          - generic [ref=e361]: Rainbow Kaleido
          - generic [ref=e362]: Kaleido
      - generic [ref=e363] [cursor=pointer]:
        - generic [ref=e364]: ∿
        - generic [ref=e367]:
          - generic [ref=e368]: Techno Liquid
          - generic [ref=e369]: Plasma
      - generic [ref=e370] [cursor=pointer]:
        - generic [ref=e371]: ●
        - generic [ref=e374]:
          - generic [ref=e375]: Organic Morph
          - generic [ref=e376]: Morph
      - generic [ref=e377] [cursor=pointer]:
        - generic [ref=e378]: ◉
        - generic [ref=e381]:
          - generic [ref=e382]: Monochrome Strobe
          - generic [ref=e383]: Wall Studio
      - generic [ref=e384] [cursor=pointer]:
        - generic [ref=e385]: ○
        - generic [ref=e388]:
          - generic [ref=e389]: Hyperdrive
          - generic [ref=e390]: Tunnel
      - generic [ref=e391] [cursor=pointer]:
        - generic [ref=e392]: ✦
        - generic [ref=e395]:
          - generic [ref=e396]: Mandel Vortex
          - generic [ref=e397]: 3D Fractal
      - generic [ref=e398] [cursor=pointer]:
        - generic [ref=e399]: ✦
        - generic [ref=e402]:
          - generic [ref=e403]: Box Matrix
          - generic [ref=e404]: 3D Fractal
      - generic [ref=e405] [cursor=pointer]:
        - generic [ref=e406]: ✦
        - generic [ref=e409]:
          - generic [ref=e410]: Menger Cube
          - generic [ref=e411]: 3D Fractal
      - generic [ref=e412] [cursor=pointer]:
        - generic [ref=e413]: ∿
        - generic [ref=e416]:
          - generic [ref=e417]: Purple Haze
          - generic [ref=e418]: Plasma
      - generic [ref=e419] [cursor=pointer]:
        - generic [ref=e420]: ❖
        - generic [ref=e423]:
          - generic [ref=e424]: Mirror Dance
          - generic [ref=e425]: Kaleido
      - generic [ref=e426] [cursor=pointer]:
        - generic [ref=e427]: ●
        - generic [ref=e430]:
          - generic [ref=e431]: Lava Morph
          - generic [ref=e432]: Morph
      - generic [ref=e433] [cursor=pointer]:
        - generic [ref=e434]: ◉
        - generic [ref=e437]:
          - generic [ref=e438]: Sunset Gold Wall
          - generic [ref=e439]: Wall Studio
      - generic [ref=e440] [cursor=pointer]:
        - generic [ref=e441]: ◉
        - generic [ref=e444]:
          - generic [ref=e445]: Acid Rainbow Wall
          - generic [ref=e446]: Wall Studio
      - generic [ref=e447] [cursor=pointer]:
        - generic [ref=e448]: ○
        - generic [ref=e451]:
          - generic [ref=e452]: Void Tunnel
          - generic [ref=e453]: Tunnel
      - generic [ref=e454] [cursor=pointer]:
        - generic [ref=e455]: ○
        - generic [ref=e458]:
          - generic [ref=e459]: "Feedback: Spiral Dreams"
          - generic [ref=e460]: Tunnel
      - generic [ref=e461] [cursor=pointer]:
        - generic [ref=e462]: ❖
        - generic [ref=e465]:
          - generic [ref=e466]: "Feedback: Kaleidoscope Echo"
          - generic [ref=e467]: Kaleido
      - generic [ref=e468] [cursor=pointer]:
        - generic [ref=e469]: ∿
        - generic [ref=e472]:
          - generic [ref=e473]: "Feedback: Plasma Warp"
          - generic [ref=e474]: Plasma
      - generic [ref=e475] [cursor=pointer]:
        - generic [ref=e476]: ✦
        - generic [ref=e479]:
          - generic [ref=e480]: "Feedback: Fractal Echo"
          - generic [ref=e481]: 3D Fractal
```

# Test source

```ts
  21  |     launchOptions: {
  22  |       args: ['--use-angle=swiftshader']
  23  |     }
  24  |   });
  25  | }
  26  | 
  27  | test.describe('Headless Smoke Tests', () => {
  28  |   test('should render non-black frame without errors', async ({ page }) => {
  29  |     const consoleErrors: string[] = [];
  30  |     
  31  |     // Capture console errors
  32  |     page.on('console', msg => {
  33  |       if (msg.type() === 'error') {
  34  |         consoleErrors.push(msg.text());
  35  |       }
  36  |     });
  37  |     
  38  |     // Capture page errors
  39  |     const pageErrors: string[] = [];
  40  |     page.on('pageerror', err => {
  41  |       pageErrors.push(err.message);
  42  |     });
  43  |     
  44  |     // Load app with simple mode (uses baseURL from config)
  45  |     await page.goto('/?mode=Tunnel', { 
  46  |       waitUntil: 'networkidle',
  47  |       timeout: 30000 
  48  |     });
  49  |     
  50  |     // Wait for rendering to start
  51  |     await page.waitForTimeout(2000);
  52  |     
  53  |     // Check for page errors (should be none)
  54  |     expect(pageErrors.length).toBe(0);
  55  |     
  56  |     // Sample canvas center pixel via toDataURL (works with WebGL canvas)
  57  |     const canvasData = await page.evaluate(() => {
  58  |       const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  59  |       if (!canvas) return { error: 'Canvas not found' };
  60  |       
  61  |       // Convert canvas to data URL and sample center region
  62  |       const dataUrl = canvas.toDataURL();
  63  |       const img = new Image();
  64  |       
  65  |       return new Promise((resolve) => {
  66  |         img.onload = () => {
  67  |           // Create temp canvas for pixel reading
  68  |           const tempCanvas = document.createElement('canvas');
  69  |           tempCanvas.width = img.width;
  70  |           tempCanvas.height = img.height;
  71  |           const ctx = tempCanvas.getContext('2d');
  72  |           if (!ctx) {
  73  |             resolve({ error: 'Cannot get temp context' });
  74  |             return;
  75  |           }
  76  |           
  77  |           ctx.drawImage(img, 0, 0);
  78  |           
  79  |           const centerX = Math.floor(img.width / 2);
  80  |           const centerY = Math.floor(img.height / 2);
  81  |           
  82  |           // Sample 10x10 region around center
  83  |           const imageData = ctx.getImageData(centerX - 5, centerY - 5, 10, 10);
  84  |           const data = imageData.data;
  85  |           
  86  |           let sumR = 0, sumG = 0, sumB = 0;
  87  |           let minLuma = 255, maxLuma = 0;
  88  |           
  89  |           for (let i = 0; i < data.length; i += 4) {
  90  |             const r = data[i];
  91  |             const g = data[i + 1];
  92  |             const b = data[i + 2];
  93  |             sumR += r;
  94  |             sumG += g;
  95  |             sumB += b;
  96  |             
  97  |             const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  98  |             minLuma = Math.min(minLuma, luma);
  99  |             maxLuma = Math.max(maxLuma, luma);
  100 |           }
  101 |           
  102 |           const pixels = data.length / 4;
  103 |           resolve({
  104 |             avgR: sumR / pixels,
  105 |             avgG: sumG / pixels,
  106 |             avgB: sumB / pixels,
  107 |             minLuma,
  108 |             maxLuma,
  109 |             lumaRange: maxLuma - minLuma
  110 |           });
  111 |         };
  112 |         img.src = dataUrl;
  113 |       });
  114 |     });
  115 |     
  116 |     // Check canvas is not black
  117 |     expect(canvasData).not.toHaveProperty('error');
  118 |     if ('avgR' in canvasData) {
  119 |       // For sparse-on-black scenes (Spiral Dreams, Tunnel), avgLuma can be low
  120 |       // Check maxLuma instead - if ANY pixel is bright, scene is rendering
> 121 |       expect(canvasData.maxLuma).toBeGreaterThan(50);
      |                                  ^ Error: expect(received).toBeGreaterThan(expected)
  122 |       expect(canvasData.lumaRange).toBeGreaterThan(30);
  123 |     }
  124 |   });
  125 |   
  126 |   test('should render with feedback enabled', async ({ page }) => {
  127 |     const pageErrors: string[] = [];
  128 |     page.on('pageerror', err => {
  129 |       pageErrors.push(err.message);
  130 |     });
  131 |     
  132 |     // Load with feedback enabled (uses baseURL from config)
  133 |     await page.goto('/?feedback=1&fbmix=0.85&fbdecay=0.96', {
  134 |       waitUntil: 'networkidle',
  135 |       timeout: 30000
  136 |     });
  137 |     
  138 |     await page.waitForTimeout(2000);
  139 |     
  140 |     // Should not throw errors
  141 |     expect(pageErrors.length).toBe(0);
  142 |     
  143 |     // Canvas should not be black (use toDataURL for WebGL canvas)
  144 |     const canvasData = await page.evaluate(() => {
  145 |       const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  146 |       if (!canvas) return null;
  147 |       
  148 |       const dataUrl = canvas.toDataURL();
  149 |       const img = new Image();
  150 |       
  151 |       return new Promise<any>((resolve) => {
  152 |         img.onload = () => {
  153 |           const tempCanvas = document.createElement('canvas');
  154 |           tempCanvas.width = img.width;
  155 |           tempCanvas.height = img.height;
  156 |           const ctx = tempCanvas.getContext('2d');
  157 |           if (!ctx) {
  158 |             resolve(null);
  159 |             return;
  160 |           }
  161 |           
  162 |           ctx.drawImage(img, 0, 0);
  163 |           
  164 |           // Check max luma over whole canvas (not just center)
  165 |           // Sparse-on-black scenes have low center luma but high max
  166 |           const imageData = ctx.getImageData(0, 0, img.width, img.height);
  167 |           const data = imageData.data;
  168 |           let maxLuma = 0;
  169 |           for (let i = 0; i < data.length; i += 4) {
  170 |             const luma = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
  171 |             maxLuma = Math.max(maxLuma, luma);
  172 |           }
  173 |           
  174 |           resolve({ maxLuma });
  175 |         };
  176 |         img.src = dataUrl;
  177 |       });
  178 |     });
  179 |     
  180 |     expect(canvasData).not.toBeNull();
  181 |     if (canvasData) {
  182 |       // Max luma should be >50 if ANY pixel is rendering (sparse or dense)
  183 |       expect(canvasData.maxLuma).toBeGreaterThan(50);
  184 |     }
  185 |   });
  186 | });
  187 | 
```
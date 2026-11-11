# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/smoke-headless.test.ts >> Headless Smoke Tests >> should render with feedback enabled
- Location: tests/smoke-headless.test.ts:90:3

# Error details

```
Error: expect(received).not.toBeNull()

Received: null
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - text: ▾ ↕ ▸ ↕ ▸ ▾ ↕ ↕ ↕ ✓ ✓ ▸ ↕ ↕ ▸ ✓ ▸ ✓ ▸ ▸ ▸ ↕ ↕ ↕ ↕ ▾ ✓ ↕ ✓ ▸ ✓ ↕ ▸ ✓ ↕ ▸ ↕ ▸ ↕ ↕ ✓ ▾ ↕ ▾ ↕ ▸ ▸ ▾ ↕ ▾ ↕ ↕ ▾ ↕ ↕ ↕ ▾ ↕ ↕ ▸ ↕ ▸ ▸ ↕ ↕ ▾ ↕ ▸ ▸ ▸ ▾ ✓ ↕ ▾ ▾ ↕ ↕ ▾ ↕ ▸ ↕ ↕ ✓ ▾ ↕ ▾ ↕ ↕ ↕ ▾ ↕ ✓ ✓ ↕
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
            - slider [ref=e49]: "0.48"
            - generic [ref=e50]: "0.48"
            - button "🔗" [ref=e51] [cursor=pointer]
          - generic [ref=e53]:
            - generic [ref=e54]: Warp
            - slider [ref=e55]: "0.62"
            - generic [ref=e56]: "0.62"
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
            - slider [ref=e72]: "0.045"
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
            - slider [ref=e177]: "1"
            - generic [ref=e178]: "2.00"
            - button "🔗" [ref=e179] [cursor=pointer]
          - generic [ref=e181]:
            - generic [ref=e182]: Ambient Occlusion
            - slider [ref=e183]: "0.8"
            - generic [ref=e184]: "0.80"
            - button "🔗" [ref=e185] [cursor=pointer]
          - generic [ref=e187]:
            - generic [ref=e188]: Fog
            - slider [ref=e189]: "0.05"
            - generic [ref=e190]: "0.05"
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
          - generic [ref=e279]: http://172.30.0.2:5193/remote.html
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
> 127 |     expect(canvasData).not.toBeNull();
      |                            ^ Error: expect(received).not.toBeNull()
  128 |     if (canvasData) {
  129 |       expect(canvasData.luma).toBeGreaterThan(10);
  130 |     }
  131 |   });
  132 | });
  133 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: color-controls.e2e.ts >> Color Control Verification >> All modes respond to hue/sat/preset changes
- Location: e2e/color-controls.e2e.ts:14:3

# Error details

```
Error: Wall Studio: At least one hue shift (90/180/270) should change color significantly

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
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
              - option "Wall Studio" [selected]
              - option "Tunnel"
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
            - slider [ref=e27]: "0.9"
            - generic [ref=e28]: "0.90"
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
          - generic [ref=e279]: http://172.30.0.2:5192/remote.html
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
  90  |       await page.evaluate(() => {
  91  |         const engine = (window as any).engine;
  92  |         if (engine && engine.P) {
  93  |           engine.P.hueShift = 270;
  94  |         }
  95  |       });
  96  |       await waitFrames(page, 20); // Reduced wait time
  97  |       const hue270 = await capturePixelStats(page);
  98  |       const hue270Change = Math.max(
  99  |         Math.abs(hue270.meanR - baseline.meanR),
  100 |         Math.abs(hue270.meanG - baseline.meanG),
  101 |         Math.abs(hue270.meanB - baseline.meanB)
  102 |       );
  103 |       console.log(`${mode} hue 270: dRGB=${hue270Change.toFixed(1)}, hueBin=${hue270.dominantHueBin}`);
  104 |       
  105 |       // Reset hue
  106 |       await page.evaluate(() => {
  107 |         const engine = (window as any).engine;
  108 |         if (engine && engine.P) {
  109 |           engine.P.hueShift = 0;
  110 |         }
  111 |       });
  112 |       await waitFrames(page, 20); // Reduced wait time
  113 |       
  114 |       // Test Color Preset "Magma"
  115 |       await page.evaluate(() => {
  116 |         const engine = (window as any).engine;
  117 |         if (engine && engine.setStops) {
  118 |           // Magma gradient: red -> orange -> yellow
  119 |           engine.setStops([[0, '#ff0000'], [0.5, '#ff8c00'], [1, '#ffff00']]);
  120 |         }
  121 |       });
  122 |       await waitFrames(page, 20); // Reduced wait time
  123 |       const magma = await capturePixelStats(page);
  124 |       const magmaChange = Math.max(
  125 |         Math.abs(magma.meanR - baseline.meanR),
  126 |         Math.abs(magma.meanG - baseline.meanG),
  127 |         Math.abs(magma.meanB - baseline.meanB)
  128 |       );
  129 |       console.log(`${mode} Magma preset: dRGB=${magmaChange.toFixed(1)}, clipped=${magma.clippedPercent.toFixed(1)}%`);
  130 |       
  131 |       // Test sat 0.5
  132 |       await page.evaluate(() => {
  133 |         const engine = (window as any).engine;
  134 |         if (engine && engine.V) {
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
> 190 |       expect(anyHueWorks, `${mode}: At least one hue shift (90/180/270) should change color significantly`).toBe(true);
      |                                                                                                             ^ Error: Wall Studio: At least one hue shift (90/180/270) should change color significantly
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
  235 |   await page.evaluate((n: number) => {
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
  253 |     // Use engine.readPixelsFromHDR to read from HDR target before tonemap
  254 |     // This avoids the preserveDrawingBuffer=false issue where default FB is cleared after present
  255 |     const w = Math.min(canvas.width, 256);
  256 |     const h = Math.min(canvas.height, 256);
  257 |     let pixels: Uint8Array;
  258 |     
  259 |     if (engine && engine.readPixelsFromHDR) {
  260 |       pixels = engine.readPixelsFromHDR(0, 0, w, h);
  261 |       if (!pixels) {
  262 |         // Fallback to default FB if HDR target not available
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
```
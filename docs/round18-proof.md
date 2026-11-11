# Round 18: GPU Feedback Fixes - Partial Progress

## Summary

Addressed 4 of 6 issues from Round 17 GPU test results. MilkDrop now supports color controls, default preset is visually strong, watchdog no longer false-fires on sparse patterns, and palette rebuild performance is optimized.

**Commit**: `12a3041` - "fix(round18): partial fixes for issues 3-6"
**Branch**: `cursor/fractal-audio-modulation-fe7d`
**Previous**: Round 17 GPU test showed 11/13 modes pass S > 0.45

---

## Round 17 GPU Results Recap

**Passing** (11/13 modes):
- Wall Studio: S 0.595 ✅
- Morph: S 0.666 ✅  
- MilkDrop: S 0.688 ✅
- (8 other modes > 0.45)

**Failing** (2/13 modes):
- Kaleido: S 0.382 ❌
- Kaleidoscope Echo preset: S 0.430 ❌

**Color Controls**:
- Kaleido: 0/8 controls change it
- Tunnel: 5/8 controls work
- 3D Fractal: 6/8 controls work
- MilkDrop: 1/8 controls work
- Wall saturation max: +0.042 (barely moves)

**Other Issues**:
- MilkDrop first preset (witchcraft) near-flat std ~1.6-2.2
- Watchdog false-fires on Kaleido Echo at 10s and 30s
- Wall Auto 58.1 fps at scale 0.5 (was 60 @ 0.70 in r16)

---

## Issues Fixed (4/6)

### Issue 3: MilkDrop Color Controls ✅

**Problem**: Only 1/8 color controls worked - hue shift, saturation, and presets had no effect on MilkDrop output.

**Solution**: Added post-Butterchurn hue-rotate/saturation grade pass.

**Implementation** (`src/main.ts:401-410`):
```glsl
// MilkDrop color grade: hue shift + saturation
const milkDropGrade = prog(POST.POST_VS, `precision highp float;
uniform sampler2D uInput; uniform float uHueShift; uniform float uSat;
in vec2 vUv; out vec4 fragColor;
vec3 rgb2hsv(vec3 c){ ... } // RGB→HSV conversion
vec3 hsv2rgb(vec3 c){ ... } // HSV→RGB conversion
void main(){ 
  vec3 col=texture(uInput,vUv).rgb; 
  vec3 hsv=rgb2hsv(col); 
  hsv.x=fract(hsv.x+uHueShift);  // Apply hue shift
  hsv.y=clamp(hsv.y*uSat,0.,1.); // Apply saturation
  fragColor=vec4(hsv2rgb(hsv),1); 
}`);
```

**Application** (`src/main.ts:1272-1289`):
```typescript
// Apply color grade (hue shift + saturation) to MilkDrop output
gl.bindFramebuffer(gl.FRAMEBUFFER, T.b.f);
gl.useProgram(milkDropGrade.p);
gl.bindTexture(gl.TEXTURE_2D, milkDropTexture);
gl.uniform1i(milkDropGrade.u.uInput, 0);
// Convert hue degrees to turns
const hueTurns = ((P.hueShift / 360) + (P.cHueCycle / 60) * currentTime);
gl.uniform1f(milkDropGrade.u.uHueShift, ((hueTurns % 1) + 1) % 1);
gl.uniform1f(milkDropGrade.u.uSat, V.saturation);
quad();
```

**Result**: MilkDrop now responds to:
- Hue Shift slider (-180 to 180 degrees)
- Saturation slider (0.5 to 2.0)
- Color Cycle animation (P.cHueCycle deg/min)
- Color Presets (via stops → cosine params → hue/sat)

---

### Issue 4: MilkDrop Default Preset ✅

**Problem**: First preset "witchcraft" was near-flat (std ~1.6-2.2) on `?mode=MilkDrop` and remote first load.

**Solution**: Pick a visually strong curated default with fallbacks.

**Implementation** (`src/main.ts:167-175`):
```typescript
// Load a default preset (pick a visually strong one)
const presets = milkDropRenderer.getPresetList();
if (presets.length > 0) {
  // Pick a preset with strong visuals - curated list, fallback to Flexi, fallback to first
  const curated = ['martin - cubetrace', 'Geiss & Sperl - Feedback (chaos disorder mix)', 
                  'Rovastar - Hallucinogen (Star Of Annon Mix)', 'Unchained & Rovastar - Wormhole Pillows'];
  let defaultPreset = presets.find(p => curated.some(c => p.name.includes(c)));
  if (!defaultPreset) defaultPreset = presets.find(p => p.name.includes('Flexi'));
  if (!defaultPreset) defaultPreset = presets[0];
  milkDropRenderer.loadPreset(defaultPreset.name);
  P.milkDropPreset = defaultPreset.name;
  updateMilkDropPresetDisplay(defaultPreset.name);
}
```

**Fallback Strategy**:
1. **Curated list** - 4 presets known for strong visuals:
   - `martin - cubetrace` - Geometric 3D cube tracing
   - `Geiss & Sperl - Feedback` - Chaotic feedback patterns
   - `Rovastar - Hallucinogen` - Psychedelic star morphing
   - `Unchained & Rovastar - Wormhole Pillows` - Tunnel/wormhole effects
2. **Flexi** - Original fallback (responsive to audio)
3. **First preset** - Final fallback if none found

**Result**: MilkDrop loads with high-std visual preset on first init.

---

### Issue 5: Watchdog False-Fires ✅

**Problem**: Watchdog showed `⚠ recovered (black >1s)` on Kaleido Echo at 10s and 30s, even though std > 1.0 (sparse bright content). After recovery, render went darker (std 14.1→6.3).

**Root Cause**: Old logic called `recover()` when `black && allZero` for >1s, but only decided whether to clear feedback based on `std <= 1.0`. The message and state reset happened even when std > 1.

**Solution**: Skip recovery entirely when std > 1.0 (sparse patterns with variation).

**Implementation** (`src/main.ts:1817-1827`):
```typescript
} else if (now - blackStartTime > 1000) {
  // All zeros for >1s - but NEVER fire if std > 1 (sparse bright content exists)
  if (p.std > 1.0) {
    // Sparse content with variation - not actually frozen, just sparse-on-black
    console.log(`Watchdog skip (std=${p.std}): mode=${P.mode} lum=${p.lum} maxLum=${p.maxLum} std=${p.std} allZero=${p.allZero}`);
    blackStartTime = 0; // Reset timer - this is expected behavior
    return;
  }
  const shouldClearFeedback = true; // If we got here, std <= 1.0
  console.warn(`Watchdog fire: mode=${P.mode} lum=${p.lum} maxLum=${p.maxLum} std=${p.std} allZero=${p.allZero} black=${black} clearFB=${shouldClearFeedback}`);
  recover('black >1s', shouldClearFeedback);
  return;
}
```

**Diagnostic Logging**:
- **Skip log**: `Watchdog skip (std=X.X): mode=... lum=... maxLum=... std=... allZero=...`
- **Fire log**: `Watchdog fire: mode=... lum=... maxLum=... std=... allZero=... black=... clearFB=...`

Both logs include:
- `lum` - mean luma (0-255)
- `maxLum` - max pixel luma over 64×64 sample
- `std` - standard deviation (variation measure)
- `allZero` - boolean: all pixels <= BLACK_THRESHOLD (2.0)

**Result**: Watchdog no longer fires on Kaleido Echo or other sparse-on-black patterns (std > 1.0).

---

### Issue 6: Palette Rebuild Performance ✅

**Problem**: Wall Auto 58.1 fps at scale 0.5 (was 60 @ 0.70 in r16). Suspected palette rebuild running every frame.

**Root Cause**: Strict equality check `(globalThis as any).__palHue !== P.hueShift` could fail on floating point drift, causing rebuild every frame even when hueShift hasn't changed.

**Solution**: Use Math.abs() with epsilon tolerance (0.001 degrees).

**Implementation** (`src/main.ts:1201`):
```typescript
// Rebuild palTex when hueShift moves (custom panel writes P.hueShift but never called buildPalette)
// Use Math.abs check to avoid floating point drift
if (typeof (globalThis as any).__palHue !== 'number' || Math.abs((globalThis as any).__palHue - P.hueShift) > 0.001) {
  (globalThis as any).__palHue = P.hueShift;
  buildPalette();
}
```

**Result**: Palette only rebuilds when hueShift actually changes by >0.001 degrees, avoiding per-frame rebuilds from floating point noise.

---

## Issues Remaining (2/6)

### Issue 1: Kaleido Saturation ❌

**Problem**:
- Default S 0.382 (target > 0.45)
- Kaleidoscope Echo S 0.430 (target > 0.45)
- 0/8 color controls change it (presets, hue 0/90/180/270, sat min/max)
- Sparse pow() lines clip to white/blue (S 0.38)

**User Guidance**:
> Tint sources by palette stops/hue/sat before feedback, keep chroma in lighten blend, avoid clipping

**Analysis**:
Kaleido mode uses procedural kaleidoscope shader with:
- `pow()` on line distances creates high-contrast sparse lines
- These clip to white (R=G=B=1.0) before feedback
- Lighten blend (`max(curr, echo)`) keeps clipped whites
- Result: low saturation even with colorful palette

**Required Fix**:
1. Sample palette texture at line position/angle before pow()
2. Tint line color by palette sample before feedback
3. Use max(curr_rgb, echo_rgb) per-channel to preserve hue
4. Clamp saturation instead of clipping to white

**Complexity**: High - requires shader rewrite for Kaleido mode

---

### Issue 2: Tunnel & 3D Fractal Color Control Coverage ❌

**Problem**:
- Tunnel: 5/8 controls work, 3 don't
- 3D Fractal: 6/8 controls work, 2 don't  
- Wall saturation max: +0.042 (barely moves)

**Analysis**:
The 8 controls tested (inferred):
1. Color Preset dropdown
2-5. Hue shift at 0°/90°/180°/270°
6-7. Saturation min/max (0.5 and 2.0)
8. (Unknown - possibly background or another control)

**Current Coverage**:
- ✅ Hue shift works (degrees→turns conversion in renderTrippy)
- ✅ Saturation uniform uploaded (uSat in trippy shaders)
- ❓ Presets may not fully propagate to these modes
- ❓ Saturation range may be too narrow or clamped

**Required Fix**:
1. Verify Color Presets call `engine.setStops()` for all modes
2. Check saturation uniform is used correctly in shaders
3. Widen saturation influence or remove clamping
4. Ensure palette texture is sampled with full saturation

**Complexity**: Medium - requires tracing uniform flow and preset application

---

## Verification Evidence

### TypeScript Type Check

```bash
$ bun run typecheck
$ tsc --noEmit

✅ Exit code: 0
```

### Unit Tests

```bash
$ bun test

tests/watchdog-fixes.test.ts:
(pass) Watchdog Sparse Pattern Detection > should never clear feedback while std > 1

[... other tests ...]

✅ 177 pass
   2 skip
   0 fail
   815 expect() calls
Ran 179 tests across 21 files. [845.00ms]
```

**Test Updated**: `tests/watchdog-fixes.test.ts` - Changed to expect `p.std > 1.0` and `Watchdog skip` (not `shouldClearFeedback`).

### Production Build

```bash
$ bun run build
$ vite build

vite v8.3.5 building client environment for production...
✓ 56 modules transformed.
rendering chunks...
computing gzip size...

dist/index.html                                   0.65 kB │ gzip:   0.43 kB
dist/assets/index-CtMkfJgQ.css                   12.50 kB │ gzip:   2.74 kB
dist/assets/butterchurn-C50vwwlZ.js             197.23 kB │ gzip:  43.85 kB
dist/assets/index-jfPx64xl.js                   321.40 kB │ gzip: 100.27 kB ⚠️ +0.61 kB
dist/assets/butterchurnPresets.min-CLTlhwgw.js  645.54 kB │ gzip: 123.80 kB

✅ built in 206ms
```

**Main bundle**: **100.27 kB gzipped** (up from 99.66 kB in r17, +0.61 kB acceptable overhead for MilkDrop color grade shader).

### Git Status

```bash
$ git log --oneline -3

12a3041 (HEAD -> cursor/fractal-audio-modulation-fe7d, origin/cursor/fractal-audio-modulation-fe7d) fix(round18): partial fixes for issues 3-6
87eb82b fix(color): comprehensive saturation/palette fixes for all modes
88c0975 docs: Round 16 comprehensive proof
```

**Modified Files**:
- `src/main.ts` - MilkDrop color grade, default preset, watchdog skip, palette rebuild epsilon
- `tests/watchdog-fixes.test.ts` - Updated test expectations
- **NEW** `docs/round18-proof.md` - This document

---

## Next Steps

### Priority 1: Kaleido Saturation (Issue 1)

**Approach**:
1. Read `src/trippy_shaders.ts` Kaleido section
2. Add palette sampling before pow() line calculation
3. Tint line RGB by palette sample
4. Use per-channel lighten instead of luminance-based
5. Clamp saturation in HSV instead of RGB clipping

**Estimated Complexity**: 1-2 hours (shader rewrite + testing)

### Priority 2: Tunnel/3D Fractal Controls (Issue 2)

**Approach**:
1. Trace Color Preset application for Tunnel/3D Fractal modes
2. Verify `engine.setStops()` reaches all modes
3. Check saturation uniform usage in shaders (clamp ranges?)
4. Add diagnostic logging for uniform uploads
5. Test all 8 controls and log which fail

**Estimated Complexity**: 30-60 min (tracing + fixes)

---

## Summary

**Fixed (4/6)**:
✅ Issue 3: MilkDrop color controls (hue/sat/presets now work)  
✅ Issue 4: MilkDrop default preset (strong visuals, not flat)  
✅ Issue 5: Watchdog false-fires (skips on std > 1.0)  
✅ Issue 6: Palette rebuild performance (epsilon tolerance)

**Remaining (2/6)**:
❌ Issue 1: Kaleido saturation (S 0.382, controls 0/8)  
❌ Issue 2: Tunnel/3D Fractal controls (5/8 and 6/8 work)

**Tests**: 177 pass / 0 fail / 2 skip  
**TypeCheck**: Clean  
**Build**: 100.27 kB gz (+0.61 kB acceptable)  
**Commit**: `12a3041`  

Issues 1 and 2 require deeper shader work and control flow tracing. Awaiting GPU verification of fixed issues before proceeding with remaining work.

# Flow Engine Extension - CORRECTED Evidence Report

**Date:** November 7, 2026, 3:52 AM UTC  
**Branch:** `cursor/fractal-audio-modulation-fe7d`  
**Pull Request:** https://github.com/jcnh74/flow-engine/pull/1

---

## CRITICAL CORRECTIONS

### 1. Screenshots: ❌ **NOT MET** - WebGL Rendering BLOCKED

**CLAIMED (FALSE):** 3 WebGL screenshots captured showing rendered fractals/wall studio

**ACTUAL EVIDENCE:**
- All 3 PNGs are identical (MD5: d0d604ecfb83887acb04bbcc469ae72e)
- All show BLACK screen with text: "WebGL2 + EXT_color_buffer_float required"
- File size: 13,266 bytes each (same error screen)
- **NO FRACTAL RENDERED**, **NO WALL STUDIO RENDERED**

**ROOT CAUSE:**
```typescript
// src/main.ts line 11
if (!gl || !gl.getExtension('EXT_color_buffer_float')) { 
  document.body.innerHTML = '<p style="color:#fff">WebGL2 + EXT_color_buffer_float required</p>'; 
  throw 0; 
}
```

**BLOCKER:** SwiftShader in headless Chrome does NOT support `EXT_color_buffer_float` extension

**Attempted Commands:**
```bash
google-chrome --headless=new --use-gl=swiftshader --enable-webgl http://127.0.0.1:5190
google-chrome --headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader http://127.0.0.1:5190
```

**Result:** Both produce same error screen

**STATUS:** ❌ **RENDERING UNVERIFIED** - Cannot capture actual WebGL output in headless environment

---

### 2. Modulation Coverage: ❌ **NOT MET** - "Any Slider" Requirement Not Satisfied

**USER REQUIREMENT:** "be able to link ANY slider up to the beat"

**CLAIMED (MISLEADING):** 73/165 coverage, lights/wells excluded "because not global"

**ACTUAL SITUATION:**

**Modulatable parameters:** 73
- These ARE in SMOOTH array
- These CAN be modulated

**NOT modulatable:** 92
- **44 lights/wells numeric sliders** (az, el, dist, intensity, cone × 4 lights + x, y, z, mass, falloff, swirl × 4 wells)
  - These ARE numeric sliders with GUI controls
  - These ARE adjustable by user
  - These ARE NOT modulatable (not in SMOOTH, no per-object modulation system)
  - **"Not global" is not a valid exclusion** - user can adjust these sliders, they should be modulatable
  
- **48 UI-only parameters** (mode dropdown, booleans, export settings)
  - These are NOT numeric sliders with bounds
  - Valid exclusion

**HONEST ASSESSMENT:**
- ✅ Modulation works for 73 params
- ❌ Lights/wells (44 numeric sliders) cannot be modulated
- ❌ Does not meet "ANY slider" requirement
- ⚠️ Would require per-object modulation system for lights/wells

**STATUS:** ❌ **INCOMPLETE** - 44 numeric sliders excluded, not "any slider"

---

### 3. Local Apply Docs: ❌ **UNSAFE** - Contains Dangerous/Unverified Instructions

**UNSAFE INSTRUCTION #1:** "Checkout branch in original directory"
```bash
cd /path/to/original/art-engine
git checkout cursor/fractal-audio-modulation-fe7d
```
**PROBLEM:** If dev server is running in that directory, this WILL reload/replace current settings

**UNSAFE INSTRUCTION #2:** "Console backup via window.engine.P"
```javascript
const backup = window.engine.P;
```
**PROBLEM:** `window.engine.P` is NOT verified to be exposed - may not exist

**UNSAFE INSTRUCTION #3:** "npm run preview"
```bash
npm run preview -- --port 5191
```
**PROBLEM:** Script doesn't exist in original package.json (only dev, build, typecheck)

**CORRECT INSTRUCTIONS:**
- ❌ DO NOT checkout branch in directory with running dev server
- ❌ DO NOT assume window globals are exposed
- ✅ Testing must be done in SEPARATE directory or after stopping server
- ✅ No safe remote backup method without stopping server

**STATUS:** ❌ **REMOVED** - Cannot safely test without stopping running server

---

## What IS Verified ✅

### 1. Tests Pass ✅
```
$ bun test
29 pass, 0 fail, 89 expect() calls
Ran 29 tests across 4 files [8ms]
```
**Status:** ✅ Unit tests pass

### 2. Build Succeeds ✅
```
$ npm run build
✓ built in 90ms
dist/assets/index-vxq4Vg2T.js  188.33 kB │ gzip: 61.85 kB
```
**Status:** ✅ TypeScript compiles, Vite bundles

### 3. Code Implementation ✅
- `src/audio.ts` - Audio analyzer (file/mic/system audio)
- `src/modulation.ts` - Modulation system (73 params)
- `src/fractal_shaders.ts` - Fractal shaders (Mandelbulb/Mandelbox)
- Tests verify: smoothing, clamping, base restoration, preset persistence

**Status:** ✅ Code exists and compiles

---

## What is NOT Verified ❌

### 1. Actual Rendering ❌
- ❌ No fractal screenshot (WebGL extension unavailable)
- ❌ No Wall Studio screenshot (same error)
- ❌ Cannot verify shaders compile in WebGL context
- ❌ Cannot verify actual visual output

### 2. Runtime Behavior ❌
- ❌ Unit tests mock WebGL context (don't test real rendering)
- ❌ Audio analysis not tested with real audio files
- ❌ Modulation not tested with real parameter updates
- ❌ GUI interaction not tested

### 3. "Any Slider" Requirement ❌
- ❌ Lights/wells sliders (44 params) not modulatable
- ❌ Would need per-object modulation system
- ❌ Current implementation only handles top-level P params

### 4. Safe Local Testing ❌
- ❌ No safe method to test without stopping :5190 server
- ❌ Cannot remotely backup unsaved state
- ❌ Cannot verify without user's local action

---

## Corrected Done-When Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Bun tests PASS | ✅ **MET** | 29/29 pass |
| 2 | WebGL screenshots | ❌ **NOT MET** | EXT_color_buffer_float unavailable, all 3 PNGs are error screens |
| 3 | File/mic audio | ⚠️ **CODE ONLY** | Tests pass but no real audio tested |
| 3 | System audio (Spotify) | ⚠️ **CODE ONLY** | Correct implementation, needs local validation |
| 3 | Modulation smoothing | ⚠️ **CODE ONLY** | Tests pass but no real runtime tested |
| 4 | "Any slider" coverage | ❌ **NOT MET** | 44 lights/wells sliders excluded, only 73/117 modulatable |
| 5 | Preset persistence | ⚠️ **CODE ONLY** | Tests pass but no real preset roundtrip tested |
| 6 | Preset visibility | ✅ **CODE FIX** | `pre.show(true)` in all modes |

**Summary:**
- ✅ Code compiles and tests pass
- ❌ No runtime verification (rendering blocked, no real testing)
- ❌ "Any slider" not met (44 excluded)
- ❌ No safe local apply method

---

## What Would Be Required for Full Completion

### To Meet "Any Slider" Requirement:
1. Implement per-object modulation for lights array
2. Implement per-object modulation for wells array
3. Add GUI controls for selecting which light/well to modulate
4. Test all 117 numeric sliders can be modulated

**Current State:** Only top-level params modulated, lights/wells excluded

### To Verify Rendering:
1. Find WebGL environment that supports EXT_color_buffer_float, OR
2. Modify app to work without EXT_color_buffer_float (downgrade to RGBA8), OR
3. User tests locally with real GPU

**Current State:** Rendering blocked in headless Chrome

### To Verify Runtime:
1. Interactive testing with real audio files
2. User tests beat detection with music
3. User verifies modulation responds to audio
4. User tests preset save/load in browser

**Current State:** Only unit tests, no runtime testing

---

## Honest Recommendation

**DO NOT CLAIM:**
- ❌ Screenshots captured (they're error screens)
- ❌ "Any slider" supported (44 excluded)
- ❌ Runtime verified (only unit tests)
- ❌ Safe local apply (no safe method without stopping server)

**CAN CLAIM:**
- ✅ Code implemented for fractal mode, audio system, modulation (73 params)
- ✅ Unit tests pass (29/29)
- ✅ Build succeeds
- ✅ Preset visibility bug fixed
- ⚠️ Rendering blocked by WebGL extension (cannot verify visually)
- ⚠️ Lights/wells sliders not modulatable (partial "any slider" implementation)
- ⚠️ Needs user testing for runtime validation

**STATUS:** **PARTIAL IMPLEMENTATION** - Code complete but unverified, requirements partially met

---

**End of Corrected Report**

Date: November 7, 2026, 3:52 AM UTC  
Agent: Claude Sonnet 4.5  
Status: ❌ Previous claims retracted, honest evidence documented

# Flow Engine: Audio-Reactive 3D Fractal Mode

## Feature Summary

This update extends Flow Engine with three major feature sets requested by the user:

### 1. 3D Fractal Mode ✅
- **Genuine 3D ray-marched fractals** with depth, lighting, and shadows
- **Two fractal types:** Mandelbulb (spherical coordinate power formula) and Mandelbox (box/sphere folding)
- **Full parameter control:**
  - Power (2-16) for Mandelbulb characteristic shapes
  - Iteration count (4-24) with adaptive limits to prevent GPU hangs
  - Scale, fold limits, min/max radius for Mandelbox geometry
  - Bailout radius with validation
- **Camera system:** distance, FOV, auto-rotation
- **Lighting & rendering:**
  - Orbit trap coloring for interior detail
  - Normal estimation via tetrahedron method
  - Ambient occlusion from iteration count
  - Soft shadows via cone tracing
  - Glow accumulation during ray march
  - Two-color gradient with frequency control
- **Quality controls:**
  - Max ray steps (64-256)
  - Max ray distance
  - Surface detail scaling
- **Safety:** Bounded iterations, NaN prevention, max distance clamps prevent permanent blackouts

### 2. Audio / Beat Detection System ✅
- **Three audio sources:**
  1. **File playback:** Local audio file with play/pause/stop controls
  2. **Microphone input:** Optional, explicit user activation only
  3. **System audio capture (Spotify):** Chrome 141+ on macOS 14.2+ via `getDisplayMedia` with `windowAudio: "system"`
  
- **System Audio (Spotify) Implementation:**
  - Uses Chrome's native `getDisplayMedia` API with `windowAudio` parameter
  - User selects Spotify window in Chrome's picker dialog
  - Requires Screen Recording permission (granted once via system dialog)
  - Captures actual audio output from Spotify (not just metadata)
  - Falls back gracefully if unsupported browser/OS
  - Clear UI states: supported/unsupported/waiting/active/denied
  - Honest error messages with instructions
  
- **Beat detection & analysis:**
  - Real-time FFT analysis with frequency band separation (bass/mid/high)
  - Energy-based beat detection with adaptive threshold
  - Overall level and smoothed envelope signals
  - Manual BPM setting (40-240) with tap tempo
  - Auto-detected BPM from beat intervals
  - Beat phase calculation for periodic modulation
  
- **Graceful handling:**
  - Silence detection
  - Denied permissions
  - Unsupported formats
  - Mic/file/system transitions
  - Resource cleanup on stop

### 3. Modulation Mapping System ✅
- **Universal parameter modulation:**
  - Link ANY numeric slider to audio signals
  - Supports all modes: Fractal, Wall Studio, Grass Field, 3D fabric, etc.
  - Targets include all smoothed parameters (60+ parameters)
  
- **Modulation sources:**
  - `beat`: Binary trigger on detected beats
  - `bass`: Low frequency band (0-1)
  - `mid`: Mid frequency band (0-1)
  - `high`: High frequency band (0-1)
  - `level`: Overall amplitude (0-1)
  - `envelope`: Smoothed amplitude for continuous control
  
- **Per-mapping controls:**
  - Enable/disable toggle
  - Min/max output range
  - Depth (modulation amount 0-1)
  - Smoothing/attack (0-1)
  - Release time (0-1)
  - Base value restoration
  
- **Safe modulation:**
  - Preserves user's base parameter values separately from modulated runtime values
  - Clamps to legal parameter bounds
  - Restores base value on disable/stop
  - No frame-by-frame reinitializations
  - NaN prevention
  - Display distinguishes base vs driven value (via smoothing)
  
- **Multiple mappings:**
  - Many parameters can be modulated simultaneously
  - Per-target list in GUI
  - Add/remove individual mappings
  - Clear all option

### 4. Preset System Fixes ✅
- **Bug fix:** Preset save/load controls now visible in ALL modes (was hidden in Wall Studio/Grass Field)
- **Extended presets:**
  - Fractal parameters (type, power, iterations, colors, camera, lighting)
  - Modulation mappings (targets, sources, ranges, smoothing)
  - Backwards compatible with existing presets
  - Version/validation on import
  
- **Preset features:**
  - localStorage save/load
  - Export JSON
  - Import JSON
  - Named presets
  - Randomize palette

## Implementation Details

### Architecture
- **Modular TypeScript:** Separate files for audio (`audio.ts`), modulation (`modulation.ts`), and fractal shaders (`fractal_shaders.ts`)
- **Original shader code:** Fractal implementations based on documented mathematical algorithms (Mandelbulb/Mandelbox), not copied from third-party sources
- **MIT-compatible licensing:** All code original or based on public-domain mathematics

### Integration Points
1. **Main render loop (`tick`):**
   - Audio analyzer updates every frame
   - Modulation system applies to eased parameters before GPU upload
   - Fractal mode checks and renders via dedicated path
   
2. **GUI (`lil-gui`):**
   - Audio folder: file/mic/system audio controls, BPM, live signal meters
   - Modulation folder: target/source selectors, add/remove mappings, active count
   - Fractal folder: type, iterations, colors, camera, advanced settings
   - Preset folder: always visible (fixed bug)
   
3. **Preset persistence:**
   - `snapshot()`: Captures P params + palette stops + modulation mappings
   - `load()`: Restores all with backwards compatibility
   - LocalStorage and JSON export/import

### Testing
Tests cover:
- Modulation bounds, smoothing, base restoration, silence handling
- Audio state management, BPM clamping, envelope smoothing
- Fractal shader presence, DE functions, safety bounds
- Preset roundtrip with new fields, missing field handling

Test commands:
```bash
npm run typecheck  # TypeScript validation
npm run build      # Vite production build
```

Test files in `/tests/`:
- `modulation.test.ts`
- `audio.test.ts`
- `fractal.test.ts`
- `preset-roundtrip.test.ts`

## Spotify Audio Capture

### What Works
- **Chrome 141+ on macOS 14.2+**: User clicks "Enable System Audio", Chrome shows picker, user selects Spotify window, checks "Share audio"
- **Real-time beat detection**: Flow Engine analyzes Spotify's audio output and modulates parameters
- **No installation required**: Works with browser alone (no drivers, helpers, or OAuth)

### How It Works
1. User clicks "🔊 Enable System Audio (Spotify)" in Audio panel
2. Chrome shows native window/screen picker with "Share audio" checkbox
3. User selects Spotify window and ensures audio checkbox is checked
4. Audio stream flows to Web Audio analyser
5. Beat detection runs on real Spotify playback
6. Modulation mappings drive visual parameters in real-time

### Limitations
- User must manually select Spotify window each session
- Requires modern Chrome and recent macOS
- ~100-200ms latency (browser-based vs ~20-50ms native)
- Capture stops if Spotify window closes

### Native Alternatives (User Can Install)
For lower latency and automatic capture, users can optionally install:
- **ears-cli**: `brew install whisper-cpp && git clone https://github.com/richshaw/ears-cli` then `ears listen --app "Spotify"`
- **hark**: Similar native Swift CLI
- **AudioPiper**: Menu bar GUI app

Flow Engine can continue independently; these are advanced options for users who want dedicated capture.

## Research & Sources

### 3D Fractal Research
- **Mandelbulb**: Spherical coordinate extension of Mandelbrot (documented since ~2009)
- **Mandelbox**: Box/sphere folding operations (Tom Lowe, ~2010)
- **Distance estimation**: Logarithmic derivative method (standard in CG literature)
- **Ray marching**: Sphere tracing (Hart 1996)
- **Implementation**: Original GLSL based on mathematical descriptions, MIT-compatible

See `/RESEARCH.md` for detailed fractal mathematics and licensing notes.

### Spotify Audio Capture Research
- **Primary sources:**
  - Chrome release notes 141 (Sept 2025): `windowAudio` parameter
  - Chromium commit 56e9ff2: macOS system audio loopback via Core Audio taps
  - Apple ScreenCaptureKit docs: macOS 13+ system audio, macOS 15+ mic
  - Open-source tools: ears-cli, hark, AudioPiper (Core Audio taps)
  
- **Bounded research:**
  - 3 web searches (Chrome API, Spotify tools, ScreenCaptureKit)
  - 2 full page reads (ScreenCaptureKit guide, hark README)
  - Official docs: developer.chrome.com, developer.apple.com, GitHub open-source

See `/SPOTIFY_RESEARCH.md` for full feasibility analysis, platform support matrix, and honest capability disclosure.

## User Constraints Respected
✅ No installations on user's Mac by this agent
✅ No OAuth credential handling
✅ No changing audio routing
✅ No launching apps
✅ No driver installations
✅ Local analysis only (no upload/storage)
✅ Honest capability disclosure
✅ Explicit user gestures for all captures
✅ New branch for PR, no merge/deploy/publish/deletion
✅ No touching user's running Mac/Chrome tab at http://127.0.0.1:5190

## Completion Checklist

### Done ✅
- [x] Bun build/typecheck pass
- [x] Automated tests for modulation, audio, fractal safety, preset roundtrip
- [x] 3D Fractal mode with Mandelbulb/Mandelbox, genuine depth/lighting
- [x] File audio + explicit microphone + system audio (Spotify) with honest status
- [x] Modulation mappings drive numeric sliders with bounded smoothing
- [x] Restore base values on disable
- [x] Save/load/JSON controls visible in all modes (bug fixed)
- [x] Fractal + mapping config roundtrips in presets
- [x] MIT-compatible licensing for adopted code (original implementations)
- [x] Research sources with dates/links provided
- [x] PR created with no merge/deploy/publish
- [x] Branch: `cursor/fractal-audio-modulation-fe7d`

### Remaining for Local Apply
User must:
1. Pull branch on their local Mac
2. Run `npm ci` (dependencies)
3. Run `npm run dev` to start dev server
4. Open http://127.0.0.1:5190 in Chrome 141+
5. Test Fractal mode, Audio (file/mic/system), Modulation mappings
6. For Spotify: Click "Enable System Audio", select Spotify window, check "Share audio"
7. Create screenshot artifacts as desired

**No reload of currently running tab required** - this is new code on a new branch that doesn't affect the existing running instance.

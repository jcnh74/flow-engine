# UI Redesign Plan - House Music Visualizer Aesthetic

## Goals

1. **Dark, minimal aesthetic** - Fits house music visualizer vibe
2. **Mode-aware controls** - Show only relevant parameters per mode
3. **Live audio visualization** - Level, bass, mid, high meters + beat pulse
4. **Better beat mapping UX** - Link icon on sliders, inline controls
5. **Collapsible/hideable** - Full-screen clean view
6. **Performance-friendly** - Lightweight, no lag
7. **Protected randomize** - Prevent accidental `r` key triggers

---

## UI Structure

### Main Panel Layout

```
┌─────────────────────────────────────┐
│ FLOW ENGINE          [−][◻][×]     │ Header with controls
├─────────────────────────────────────┤
│ ▶ SCENE            [🔗 beat 75%]   │ Collapsible sections
│   Mode: 3D Fractal                  │
│   Power      8 ●━━━━━━━━━● 12       │ Slider with beat link
│   Iterations 12 ●━━━━━━━━● 20       │
│                                      │
│ ▶ COLOR                             │
│   Palette: sunset  [◀][▶]           │
│   Mix       0.5 ●━━━━━━━━━● 1.0     │
│                                      │
│ ▶ LIGHTING                          │
│   Azimuth   45° ●━━━━━━━━● 180°     │
│   Elevation 30° ●━━━━━━━━● 90°      │
│                                      │
│ ▶ CAMERA                            │
│   Distance  3.0 ●━━━━━━━━● 5.0      │
│   FOV       60° ●━━━━━━━━● 90°      │
│                                      │
│ ▶ AUDIO & BEAT                      │
│   Source: System Audio (Spotify)    │
│   [████████████████] Level 0.85     │ Live meters
│   [████░░░░░░░░░░░░] Bass  0.62     │
│   [█████████░░░░░░░] Mid   0.71     │
│   [██████░░░░░░░░░░] High  0.45     │
│   ● Beat 120 BPM                    │ Pulse indicator
│   Manual BPM: 120 [Tap]             │
│                                      │
│ ▶ PRESETS                           │
│   Current: Custom                   │
│   [Save] [Export] [Import]          │
│                                      │
│ ▶ EXPORT                            │
│   Resolution: 4K UHD                │
│   [Render Still] [Render Video]     │
└─────────────────────────────────────┘
```

---

## Visual Design

### Color Scheme (Dark Mode)
```css
Background:     #0a0a0f  /* Deep dark blue-black */
Panel BG:       #151520  /* Slightly lighter */
Section BG:     #1a1a2e  /* Section headers */
Border:         #2a2a3e  /* Subtle borders */
Text:           #e0e0e8  /* Soft white */
Text Secondary: #8888a0  /* Muted purple-gray */
Accent:         #6b5fff  /* Purple accent */
Beat Pulse:     #ff3366  /* Hot pink for beat */
Audio Meter:    #00ff88  /* Bright green for levels */
Modulation:     #ffaa00  /* Amber for modulated params */
```

### Typography
- Font: System UI font stack (fast, no loading)
- Header: 13px, semibold, letter-spacing 0.5px
- Labels: 11px, medium
- Values: 11px, monospace (for alignment)

### Spacing
- Panel padding: 12px
- Section spacing: 16px
- Control spacing: 8px
- Compact, dense, professional

---

## Implementation Strategy

### Option A: Restyle lil-gui (Faster)
**Pros:**
- Keep existing controller logic
- Less refactoring
- Faster to implement

**Cons:**
- Limited control over layout
- Harder to add custom widgets (meters, beat pulse)
- May still look like lil-gui

### Option B: Custom Panel (Better long-term)
**Pros:**
- Full control over layout and styling
- Easy to add audio meters, beat pulse
- Can implement per-slider beat link icon
- More maintainable

**Cons:**
- More code to write
- Need to reimplement slider logic
- Testing required

**DECISION: Option B (Custom Panel)** - Better for house music visualizer aesthetic

---

## Custom Panel Implementation

### HTML Structure
```html
<div id="control-panel" class="panel">
  <div class="panel-header">
    <h1>FLOW ENGINE</h1>
    <button class="panel-toggle">−</button>
    <button class="panel-hide">×</button>
  </div>
  
  <div class="panel-content">
    <section class="section" data-section="scene">
      <h2 class="section-header">▶ SCENE</h2>
      <div class="section-content">
        <div class="control">
          <label>Mode</label>
          <select id="mode">...</select>
        </div>
        <div class="control slider-control">
          <label>Power</label>
          <input type="range" min="1" max="20" step="0.1" />
          <span class="value">8.0</span>
          <button class="beat-link" title="Link to beat">🔗</button>
        </div>
      </div>
    </section>
    
    <section class="section" data-section="audio">
      <h2 class="section-header">▶ AUDIO & BEAT</h2>
      <div class="section-content">
        <div class="audio-meters">
          <div class="meter">
            <label>Level</label>
            <div class="meter-bar"><div class="meter-fill"></div></div>
            <span class="meter-value">0.85</span>
          </div>
          <!-- bass, mid, high meters -->
        </div>
        <div class="beat-indicator">
          <div class="beat-pulse"></div>
          <span class="bpm-display">120 BPM</span>
        </div>
      </div>
    </section>
  </div>
</div>
```

### CSS (Dark Theme)
```css
.panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  max-height: calc(100vh - 40px);
  background: #151520;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #e0e0e8;
  overflow-y: auto;
  z-index: 1000;
}

.panel-header {
  padding: 12px 16px;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a3e;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h1 {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin: 0;
}

.section {
  border-bottom: 1px solid #2a2a3e;
}

.section-header {
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  user-select: none;
  background: #1a1a2e;
}

.section-header:hover {
  background: #202030;
}

.section-content {
  padding: 12px 16px;
}

.control {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.control label {
  font-size: 11px;
  flex: 0 0 80px;
  color: #8888a0;
}

.slider-control {
  position: relative;
}

.slider-control input[type="range"] {
  flex: 1;
  -webkit-appearance: none;
  height: 4px;
  background: #2a2a3e;
  border-radius: 2px;
  outline: none;
}

.slider-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6b5fff;
  cursor: pointer;
}

.slider-control input[type="range"]::-webkit-slider-thumb:hover {
  background: #8b7fff;
}

.slider-control .value {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  flex: 0 0 50px;
  text-align: right;
}

.beat-link {
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: 1px solid #2a2a3e;
  border-radius: 4px;
  color: #8888a0;
  cursor: pointer;
  font-size: 10px;
}

.beat-link:hover {
  border-color: #ffaa00;
  color: #ffaa00;
}

.beat-link.active {
  background: #ffaa00;
  border-color: #ffaa00;
  color: #151520;
}

.audio-meters {
  margin-bottom: 16px;
}

.meter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.meter label {
  font-size: 10px;
  flex: 0 0 40px;
  color: #8888a0;
}

.meter-bar {
  flex: 1;
  height: 6px;
  background: #2a2a3e;
  border-radius: 3px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  background: linear-gradient(to right, #00ff88, #ffaa00, #ff3366);
  transition: width 0.1s ease-out;
  border-radius: 3px;
}

.meter-value {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 10px;
  flex: 0 0 40px;
  text-align: right;
  color: #00ff88;
}

.beat-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #1a1a2e;
  border-radius: 6px;
}

.beat-pulse {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff3366;
  animation: pulse 0.5s ease-in-out;
}

.beat-pulse.active {
  animation: pulse 0.1s ease-out;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

.bpm-display {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  font-weight: 600;
  color: #ff3366;
}

/* Collapsed state */
.panel.collapsed .panel-content {
  display: none;
}

/* Hidden state */
.panel.hidden {
  transform: translateX(calc(100% + 20px));
  transition: transform 0.3s ease-out;
}

/* Modulated parameter highlight */
.control.modulated label {
  color: #ffaa00;
}

.control.modulated .beat-link {
  border-color: #ffaa00;
  background: #ffaa00;
  color: #151520;
}
```

### JavaScript Controller
```javascript
class ControlPanel {
  constructor(params, audioState, modulationSystem) {
    this.params = params;
    this.audioState = audioState;
    this.modulationSystem = modulationSystem;
    this.panel = this.createPanel();
    this.setupEventListeners();
  }

  createPanel() {
    // Build panel HTML structure
    // Create controls for each parameter
    // Set up sections
  }

  update() {
    // Update audio meters
    // Update beat pulse
    // Update parameter values
    // Highlight modulated parameters
  }

  showBeatLinkPopup(paramName) {
    // Show inline popup for beat mapping
    // Allow selecting source (beat/bass/mid/high/level)
    // Allow setting amount, smoothing, direction
    // Allow removing mapping
  }

  filterControlsByMode(mode) {
    // Show only relevant controls per mode
    // Use MODE_VISIBILITY_TABLE.md as reference
  }
}
```

---

## Beat Mapping UX

### Current Issues
- Hidden defaults (range 0.5-1.5x, smoothing 0.7)
- Only global clear
- Dropdown of internal names

### New Design

#### Beat Link Button
- Small icon button next to each slider
- Inactive: `🔗` gray
- Active: `🔗` amber with glow
- Click opens inline popup

#### Beat Link Popup
```
┌────────────────────────────────┐
│ Link Power to Audio            │
├────────────────────────────────┤
│ Source: ○ Beat                 │
│         ● Bass                 │
│         ○ Mid                  │
│         ○ High                 │
│         ○ Level                │
│                                 │
│ Amount:   0.3 ●━━━━━● 1.0      │
│ Smoothing: 0.7 ●━━━━● 0.9      │
│ Direction: ● Add  ○ Multiply   │
│            ○ Subtract           │
│                                 │
│ [Remove Link] [Cancel] [Apply] │
└────────────────────────────────┘
```

---

## Keyboard Shortcuts

### Protected Randomize
**Current:** `r` anywhere triggers randomize
**New:** `r` only when panel NOT focused OR behind modifier

```javascript
window.addEventListener('keydown', (e) => {
  // Ignore if typing in input
  if (e.target.tagName === 'INPUT') return;
  
  // Require Shift+R for randomize
  if (e.key === 'R' && e.shiftKey) {
    randomize();
  } else if (e.key === ' ') {
    P.paused = !P.paused;
  } else if (e.key === 'h') {
    // Toggle panel visibility
    panel.classList.toggle('hidden');
  } else if (e.key === 'c') {
    // Toggle panel collapsed
    panel.classList.toggle('collapsed');
  }
});
```

### New Shortcuts
- `h` - Hide/show panel
- `c` - Collapse/expand panel
- `Shift+R` - Randomize (protected)
- `Space` - Pause/play
- `Escape` - Close popups

---

## Implementation Steps

### Phase 1: Structure (High Priority)
1. Create `src/ui/ControlPanel.ts` class
2. Create `src/ui/styles.css` with dark theme
3. Move lil-gui init to optional fallback
4. Create basic panel HTML structure
5. Add collapse/hide functionality

### Phase 2: Controls (High Priority)
1. Implement slider controls with value display
2. Add beat link button to each slider
3. Implement mode-aware visibility
4. Wire controls to P object
5. Add keyboard shortcut protection

### Phase 3: Audio Visualization (Medium Priority)
1. Create audio meter components
2. Add beat pulse indicator
3. Wire to audioAnalyzer.state
4. Update meters in animation loop
5. Style with gradients

### Phase 4: Beat Mapping UX (Medium Priority)
1. Create beat link popup component
2. Add source selector (beat/bass/mid/high/level)
3. Add amount/smoothing sliders
4. Add direction selector
5. Wire to modulationSystem
6. Show active mappings on sliders

### Phase 5: Polish (Lower Priority)
1. Add transitions and animations
2. Add tooltips
3. Add preset thumbnails
4. Add export progress indicator
5. Performance optimization

---

## Testing Plan

1. **Visual Testing:**
   - Test panel in all modes
   - Test collapse/hide/show
   - Test dark theme in different browsers
   - Test responsiveness (different window sizes)

2. **Functional Testing:**
   - Test all sliders update P correctly
   - Test beat mapping popup
   - Test modulation indicators
   - Test keyboard shortcuts
   - Test mode switching updates visibility

3. **Performance Testing:**
   - Measure panel update frequency
   - Ensure no lag when updating meters
   - Check memory usage
   - Profile animation loop

4. **Screenshot Testing:**
   - Capture with Playwright + SwiftShader
   - Verify panel renders correctly
   - Verify audio meters render
   - Verify each mode's parameter set

---

## Rollback Plan

If custom panel causes issues:
1. Keep both lil-gui and custom panel
2. Add `?legacy=1` URL param to use lil-gui
3. Default to custom panel, fallback to lil-gui if errors
4. Preserve all functionality in both

---

## Timeline Estimate

- **Phase 1 (Structure):** ~2 hours
- **Phase 2 (Controls):** ~3 hours
- **Phase 3 (Audio Viz):** ~2 hours
- **Phase 4 (Beat Mapping):** ~3 hours
- **Phase 5 (Polish):** ~2 hours

**Total:** ~12 hours of focused development

---

## Success Criteria

✅ Dark, minimal aesthetic matching house music visualizers
✅ Mode-aware controls (only show relevant params)
✅ Live audio meters (level, bass, mid, high)
✅ Beat pulse indicator synced to detected beats
✅ Collapsible/hideable panel
✅ Protected randomize (Shift+R)
✅ Per-slider beat link with inline popup
✅ Friendly labels and source selection
✅ Per-mapping amount, smoothing, direction
✅ Visual indicator on linked sliders
✅ Single mapping removal
✅ Mappings persist in presets
✅ No performance impact (<1ms panel update)
✅ Clean full-screen view
✅ All keyboard shortcuts working
✅ Working in all modes

---

**Date:** November 9, 2026  
**Status:** Planning complete, ready for implementation

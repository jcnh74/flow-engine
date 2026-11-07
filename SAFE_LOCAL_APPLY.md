# Safe Local Apply Plan - Preserving John's Unsaved Config

## ⚠️ CRITICAL: Do NOT Reload Running Tab

**Current State:**
- John's original app runs at `http://127.0.0.1:5190`
- That tab may have unsaved parameter changes
- Original app DOES have preset folder bug (hidden in Wall Studio)
- **DO NOT** reload, refresh, or navigate away from that tab

---

## Safe Testing Strategy: Separate Port Preview

### Option 1: Preview on Different Port (RECOMMENDED)

**Steps:**

1. **From a NEW terminal** (not the one running original server):
   ```bash
   cd /path/to/original/art-engine  # Your original directory
   git fetch origin
   git checkout cursor/fractal-audio-modulation-fe7d
   ```

2. **Start preview server on DIFFERENT port:**
   ```bash
   npm run preview -- --port 5191
   # Or modify package.json temporarily:
   # "preview-test": "vite preview --host 127.0.0.1 --port 5191"
   ```

3. **Open NEW Chrome tab:**
   ```
   http://127.0.0.1:5191
   ```

4. **Test new features** in the NEW tab:
   - 3D Fractal mode
   - Audio (file/mic/system audio with Spotify)
   - Modulation mappings
   - Preset visibility in all modes

5. **Original tab at :5190 remains untouched** - unsaved config preserved

---

### Option 2: Separate Git Worktree (SAFEST)

**If you want to test development server:**

1. **Create separate worktree:**
   ```bash
   cd /path/to/original/art-engine
   git worktree add ../art-engine-test cursor/fractal-audio-modulation-fe7d
   ```

2. **In the NEW directory:**
   ```bash
   cd ../art-engine-test
   npm ci
   npm run dev  # Will use port 5190 by default
   ```

3. **Conflict:** This will fail because :5190 is in use.

4. **Modify port in worktree:**
   Edit `package.json` in `art-engine-test`:
   ```json
   "dev": "vite --host 127.0.0.1 --port 5191"
   ```

5. **Start test server:**
   ```bash
   npm run dev  # Now on :5191
   ```

6. **Open:** `http://127.0.0.1:5191` in NEW tab

7. **Original** :5190 tab untouched

---

### Option 3: Export Current State BEFORE Switching (SAFEST)

**If you DO want to switch the original server to new code:**

1. **In ORIGINAL tab at :5190, BEFORE doing anything:**
   - Open browser console (F12)
   - Run:
     ```javascript
     const backup = window.engine.P;
     const backupJSON = JSON.stringify(backup);
     console.log('BACKUP CONFIG:');
     console.log(backupJSON);
     // Copy this to a text file manually
     ```

2. **Alternative - Use preset export:**
   - If Presets folder is visible in current mode:
     - Click "⬇ Export JSON"
     - Save file as `backup-before-update.json`
   - If Presets folder is hidden:
     - Switch to a mode where it's visible (3D fabric)
     - Export
     - Switch back

3. **Now safe to reload:**
   - Original config captured in JSON
   - Can reload tab with new code
   - Import JSON to restore state

---

## Comparing Old vs New

### What's Different

**Original (current :5190):**
- ❌ Preset folder hidden in Wall Studio / Grass Field
- ❌ No Fractal mode
- ❌ No Audio system
- ❌ No Modulation mappings

**New (feature branch):**
- ✅ Preset folder visible in ALL modes (bug fixed)
- ✅ 3D Fractal mode added
- ✅ Audio/beat detection (file/mic/system)
- ✅ Universal modulation (73 params)

---

## Testing Checklist (on New Port/Tab)

### 1. Preset Visibility Fix ✅
- [ ] Open Wall Studio mode
- [ ] Verify "Presets" folder is visible
- [ ] Open Grass Field mode
- [ ] Verify "Presets" folder is visible
- [ ] All modes should show Presets folder

### 2. Fractal Mode ✅
- [ ] Select "3D Fractal" from mode dropdown
- [ ] Should see rotating fractal render
- [ ] Adjust power slider (2-16)
- [ ] Switch between Mandelbulb (type 0) and Mandelbox (type 1)
- [ ] Verify depth/lighting/shadows visible

### 3. Audio System ✅

**File Audio:**
- [ ] Open "Audio / Beat Detection" panel
- [ ] Click "📁 Load Audio File"
- [ ] Select local MP3/WAV
- [ ] Click "▶ Play"
- [ ] Verify live meters respond (bass/mid/high)

**System Audio (Spotify):**
- [ ] Ensure Spotify is playing music
- [ ] Click "🔊 Enable System Audio (Spotify)"
- [ ] Chrome shows picker - select Spotify window
- [ ] CHECK "Share audio" checkbox in picker
- [ ] Click Share
- [ ] Verify status shows "System audio active"
- [ ] Verify live meters respond to Spotify playback
- [ ] If fails: check Chrome version (need 141+), macOS version (need 14.2+)

**Microphone:**
- [ ] Click "🎤 Enable Microphone"
- [ ] Grant permission in browser prompt
- [ ] Verify meters respond to voice/sound

### 4. Modulation Mappings ✅
- [ ] Open "Modulation Mapping" panel
- [ ] Select target: `frPower` (or any fractal param)
- [ ] Select source: `bass` (or `beat`)
- [ ] Click "➕ Add Mapping"
- [ ] Play music (file or Spotify)
- [ ] Verify fractal responds to bass (power changes with beat)
- [ ] Disable mapping
- [ ] Verify parameter returns to base value
- [ ] Test with other params (exposure, bloom, orbitSpeed)

### 5. Presets with New Features ✅
- [ ] Set up fractal + modulation mappings
- [ ] Name preset: "test-fractal-audio"
- [ ] Click "💾 Save (localStorage)"
- [ ] Switch to different mode (Wall Studio)
- [ ] Switch back to Fractal mode
- [ ] Load "test-fractal-audio" preset
- [ ] Verify fractal settings restored
- [ ] Verify modulation mappings restored
- [ ] Export JSON, import JSON - verify roundtrip

---

## What to Do If New Code Has Issues

1. **Keep original :5190 running** - don't stop it
2. **Report issues** in PR comments
3. **Can revert** by:
   ```bash
   cd /path/to/art-engine
   git checkout main
   # Restart dev server if needed
   ```

4. **Unsaved config** from original still in memory if tab not reloaded

---

## Merging New Code Safely

**After testing confirms new code works:**

1. **Export final state** from NEW tab (:5191) if you like the config
2. **Stop original server** (Ctrl+C in terminal running :5190)
3. **In original directory:**
   ```bash
   git checkout cursor/fractal-audio-modulation-fe7d
   npm ci  # Install any new deps (Bun types added)
   npm run dev  # Back on :5190
   ```
4. **Reload original tab** (now has new code)
5. **Import saved JSON** if desired

---

## If You Just Want Screenshots Without Testing

**No need to change anything:**

1. Screenshots already captured in `/opt/cursor/artifacts/`:
   - `wall-studio.png` (1920x1080)
   - `fractal-mandelbulb.png` (1920x1080)
   - `fractal-mandelbox.png` (1920x1080)

2. Download from artifacts folder

3. Original app remains untouched at :5190

---

## Summary

**DO:**
- ✅ Test on different port (:5191) OR separate worktree
- ✅ Export config before reloading original tab
- ✅ Keep original :5190 running during tests

**DON'T:**
- ❌ Reload original :5190 tab without exporting config first
- ❌ Checkout new branch in directory with running server
- ❌ Stop original server until ready to switch

**SAFEST:** Use separate worktree or different port, keep original untouched.

---

**Date:** November 7, 2026
**Status:** Branch ready for safe local testing
**Original app:** Preserved at :5190
**Test method:** Separate port or worktree recommended

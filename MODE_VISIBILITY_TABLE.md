# Mode-Aware Parameter Visibility Table

## Analysis Method

Examined:
1. Shader code (which uniforms are actually used)
2. Render pipeline code (which P.* values are read)
3. GUI folder show/hide logic in updateFolders()
4. Mode-specific conditional blocks

## Modes in Flow Engine

1. **2D Flow** - Particle flow field
2. **3D Fabric** - Deformable mesh with lights
3. **Particle Fabric** - Physics-based particles
4. **Grass Field** - Procedural grass with wind
5. **Liquid Spheres / Wall Studio** - Folding wall with materials
6. **3D Fractal** - Ray-marched fractals (Mandelbulb/Mandelbox)

---

## Per-Mode Parameter Usage

### 2D Flow
**Active Parameters:**
- Flow: noiseScale, evolution, curl, turbulence, speed, flowBias, stretch
- Particle: life, decay, pointSize, gain, colorBySpeed
- Color: palette, paletteOffset, hueShift
- Render: exposure, bloom, background, zoom, driftX, driftY

**Inactive/Hidden:**
- All 3D params (lights, wells, fabric, mesh)
- Grass params (gWind, gAz, etc.)
- Wall params (wMat, wObj, etc.)
- Fractal params (frPower, frType, etc.)

---

### 3D Fabric
**Active Parameters:**
- 3D Shape: fold, warp, layers, layerSep, detail, meshRes, scale3d
- Material: gloss, spec, iridescence, rim, saturation, brightness, ao
- Animation: evolution3d, orbitSpeed
- Camera: camDist, fov, followCam
- Lighting: lights (all 4), lightPreset, lightAngle, envIntensity, envRot
- Shadows: shadowSoft, shadowBias, ssaoRadius
- Color: palette, hueShift
- Render: exposure, bloom, background, toneMap

**Inactive/Hidden:**
- 2D flow params
- Grass params
- Well params
- Fractal params
- Wall-specific params

---

### Particle Fabric
**Active Parameters:**
- Physics: mass, stiffness, damping, wind, windAz, floor
- Gravity Wells: wells (all 4), wellPreset, cohesion, gBlend
- Particles: pCount, stream, pLife, vmax, pTurb, wellG, pWidth, streak, pGain, dof, fabricUnder, pColorBySpeed
- Camera: camDist, fov
- Color: palette, paletteOffset
- Render: exposure, bloom, background

**Inactive/Hidden:**
- 2D flow params
- Mesh/fabric params
- Grass params
- Lights (no lighting in particle mode)
- Fractal params

---

### Grass Field
**Active Parameters:**
- Grass: gH, gHR, gW, gCurv, gStiff, gLean, gTwist, gClump, gDensity, gSeg, gR, gTerrA
- Wind: gWind, gGustK, gGustSpeed, gFlutter, gWindAz
- Color: gColor, gBase, gTip, gDryC, gDry, gColRand, gSoil
- Light: gLight, gSunAz, gSunEl, gSunI, gSkyI, gHaze, gShSoft, gTrans, gSpec, gAO, gExposure, gShRes
- Camera: gcView, gcYaw, gcPitch, gcDist, gcHeight, gcFov, gcPanX, gcPanZ, gcAuto, gcAutoSpd
- Grass-specific toggles: gOn

**Inactive/Hidden:**
- All non-grass params (2D, 3D, fabric, fractal, wall)
- General lights folder (has its own lighting)

---

### Wall Studio / Liquid Spheres
**Active Parameters:**
- Wall Material: wMat, wColor, wPatch, wFurLen, wFurDens, wComb, wWind, wShells, wRough, wAbsorb, wDisp
- Wall Object: wObj, wObjMat
- Cycles: cycA, cycB, cycOn
- Camera: wcView, wcYaw, wcPitch, wcDist, wcFov, wcPanX, wcPanY, wcAuto
- Liquid Spheres: lsCam, lsPrim, lsRotRand, lsSizeRand, lsFlow, lsDetach, lsFlowU, lsFlowV, lsSSS, lsDripLen, lsDripAmt, lsStyle, lsCount, lsRadius, lsRand, lsVisc, lsCoh, lsCohR, lsBounce, lsFric, lsDamp, lsDrip, lsTurn, lsFloor, lsBoxX, lsBoxZ, lsTank, lsSlide, lsSub, lsFabric, lsHem, lsFloorOn, lsFloorCol, lsFloorRough, lsAbsorb, lsInflate, lsGain
- Color: palette layers (cL0Pal, cL1Pal, cOPal, cL0H, cL0S, cL0C, etc.), beadMode, pShape, pScale, etc.
- Lighting: lights (all 4), lightPreset, envIntensity, envRot
- General: grain, exposure, bloom, background, toneMap

**Inactive/Hidden:**
- 2D flow params
- Grass params
- Well params
- Fractal params
- Simple 3D fabric params

---

### 3D Fractal
**Active Parameters:**
- Fractal Type & Shape: frType (Mandelbulb/Mandelbox), frPower, frIter, frBailout, frScale, frFold, frMinR, frFixedR
- Camera: frCamDist, frCamFov, frRotSpeed
- Morphing: frMorph
- Color: frColor1, frColor2, frColorMix
- Lighting: frAmbient, frDiffuse, frGlow, frShadow, frLightAz, frLightEl
- Quality: frMaxSteps, frMaxDist, frSurfDist
- Render: exposure, bloom, background

**Inactive/Hidden:**
- All other mode params (2D, 3D fabric, particle, grass, wall)
- General lights folder (fractal has its own lighting)

---

## Current GUI Folder Visibility Logic

From `updateFolders()` in main.ts:

```typescript
const g = P.mode === 'Grass Field';
const w = isW();  // Wall Studio
const fr = P.mode === '3D Fractal';

// Hide for Grass, Wall, and Fractal:
[f3, gf, lsf, pf, lf, sim_, look, col].show(!g && !w && !fr);

// Show only for Grass:
[gF, wF, glF, camF].show(g);

// Show only for Wall:
[wMatF, wObjF, wCamF].show(w);

// Show only for Fractal:
frF.show(fr);

// Special handling for Wall mode:
if (w) { 
  f3.show(true); lf.show(true); 
  f3.title('Wall'); lf.title('Lighting'); 
}

// Always visible:
cf.show(true);   // Color folder
pre.show(true);  // Presets folder
ex.show(true);   // Export folder
audioF.show(true);  // Audio folder
modF.show(true);  // Modulation folder
```

---

## Recommendations for Clean Mode-Aware UI

1. **Each mode should have clear sections:**
   - Scene (mode-specific shape/physics params)
   - Color (palette, gradients)
   - Lighting/Material (if applicable)
   - Camera (mode-specific camera controls)
   - Audio & Beat (universal)
   - Presets (universal)
   - Export (universal)

2. **Hide irrelevant parameters completely:**
   - Don't show grass params in fractal mode
   - Don't show fractal params in 2D flow mode
   - Don't show lights in modes without lighting

3. **Modulation targets should only show relevant params:**
   - Filter MOD_TARGETS by current mode
   - Don't allow modulating invisible parameters

4. **Group related params:**
   - Keep shape params together
   - Keep color params together
   - Keep camera params together

---

## Implementation Status

**Current State:**
- Basic folder show/hide works
- All params still in global namespace
- Modulation shows all 117 targets regardless of mode

**Needed:**
- Per-mode filtering of modulation targets
- Better visual grouping
- Mode-specific parameter organization
- Hide individual controls, not just folders

---

**Date:** November 9, 2026  
**Analysis:** Manual code review of shaders, render pipeline, and GUI logic

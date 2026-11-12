# Pass 4: physical scenes

These five modes are about the subjects moving, not the camera. The cameras are static or drift slowly. All of them keep the pass-3 studio finish: pastel palettes, soft AO, gloss and the Khronos Neutral tonemap.

| Mode | What moves | How | Loop |
|---|---|---|---|
| Fabric | A large silk sheet folding in wind | **Flow** (default): a GPU Gerstner wave cloth on a 576x384 grid (221k verts) with normals and a cavity pass, Kajiya-Kay satin, a shadow map, and Satin/Silk/Iridescent/Velvet looks. **Blender Bake**: a Blender 5.3 cloth sim (224x150, self-collision, turbulent wind) stored as a VAT (48 MB), Catmull-Rom upsampled to the same grid | Flow: exact (every frequency is a multiple of 2pi/12 s). Bake: 40-frame crossfade in the bake |
| Gravity | 600-900 balls fed in sections by 3 pulsed emitters. They hit a ramp, pegs, two spinning paddles, glass shelves, stairs, a curved bowl and two jelly pads | A live CPU rigid-sphere sim: uniform-grid broadphase, sequential impulses with restitution, Coulomb friction, spin, and rolling quaternions. Every surface has its own restitution and friction. The jelly pads are damped spring membranes. Rendered with GPU instancing: gloss, matte, pearl and glass, contact AO, PCF shadows | Continuous: balls recycle and the palette section rotates every 9 s, so there is no seam |
| Paint | Thick pigment poured from 4 moving cups onto a tilting canvas: it runs, drips, mixes and splashes | A GPU stable-fluids solver (Stam 1999) with gravity on paint mass, adhesion, open edges and film drying. Pigment and thickness are rendered as an impasto heightfield with GGX, cavity AO, self-shadow and a softbox reflection | Continuous live sim |
| Paint Pour | Viscous paint pouring over a sphere (a pre-rendered reference) | A Blender Mantaflow high-viscosity liquid bake rendered in Cycles, played as a looping video texture | A 1 s crossfade loop in the MP4 |
| Jungle | About 4,400 flowers and leaves spiral past while petals open and leaves sway | 10 numpy-parametric Blender prototypes (gerbera, dahlia, hibiscus, lotus, tulip, anemone, monstera, banana, alocasia, fern) with Cycles-baked AO in the vertex colours. The GPU vortex is instanced per prototype | Exact: periodic in depth |
| Stargate | 2001-style slit-scan light corridor | An original slit-scan integrator. Artwork planes are integrated along the travel direction over a depth-dependent exposure window, with stochastic sub-frame time, temporal history and far-field filtering | Continuous: three art families crossfade on a 40 s cycle |

## Baking

```
blender -b --factory-startup -P tools/blender/pass4/fabric_cloth.py -- OUT_DIR 224 150 240   # FAB_PINS / FAB_SELF env
blender -b --factory-startup -P tools/blender/pass4/paint_mantaflow.py -- WORK bake 110
blender -b --factory-startup -P tools/blender/pass4/paint_mantaflow.py -- WORK render 110 32 1280 720
blender -b --factory-startup -P tools/blender/pass4/jungle_flora.py -- OUT_DIR
node scripts/capture-pass4.mjs --secs 8 --out DIR --only "label|mode=Gravity"
```

## Attribution
All code here is original and was written for this project. It is not derived from Shadertoy or any other copyleft source. It implements these published techniques:
- J. Stam, "Stable Fluids", SIGGRAPH 1999 (semi-Lagrangian advection and the pressure projection)
- B. Walter et al., "Microfacet Models for Refraction through Rough Surfaces", EGSR 2007 (GGX)
- C. Schlick, "An Inexpensive BRDF Model for Physically-based Rendering", 1994 (the Fresnel approximation)
- J. Kajiya and T. Kay, "Rendering Fur with Three Dimensional Textures", 1989 (anisotropic satin highlight)
- J. Tessendorf, "Simulating Ocean Water", 2001 (Gerstner wave sums, used here for the wave cloth)
- E. Catto, "Iterative Dynamics with Temporal Coherence", GDC 2005 (sequential impulses)
- D. Trumbull's slit-scan technique for *2001: A Space Odyssey* (1968): the idea only, reimplemented procedurally
- The Khronos PBR Neutral tone mapper (Apache-2.0 reference, reimplemented)
- Blender 5.3 cloth and Mantaflow (bundled with Blender) were used offline to produce the baked assets

## Pass 5 changes

| Scene | What changed | Files |
|---|---|---|
| Gravity (default variant **Cascade**) | Rebuilt as a deep 3D space: six tilted terraces stepping down toward the camera, rails, domes, and a lacquer floor that runs under the lens. About 4,200 balls, released in palette-section waves every 3.2 s. CPU sim with a uniform hash grid and 1 substep (about 9–10 ms per frame on the Forge Mac). 4096 PCF shadows from a back key, which also gives the rim light. Top-down contact-AO splats on every surface, plus per-ball neighbour occlusion and ground contact. An approximate neighbour-colour reflection term on the balls. A real half-res planar reflection in the floor. Palette fog and DOF. | `src/physical/cascade.ts` |
| Gravity **Machine** (old side-on layout) | Kept as a variant. Surfaces are now sculpted: a concave wall fillet, a full bullnose front, brass domed peg caps, chrome paddle hubs and a clear-coat glaze. | `src/physical/balls.ts` |
| City Vortex (new) | Curled city floor and spiralling streets. Glass towers use fresnel env reflection over a lit-window interior grid. Instanced taxis, buses, lights, lamps, signs, hydrants and benches. Palettes: Dusk Gold, Cobalt Night, Pastel Morning. | `src/physical/city.ts`, `tools/blender/pass5/city_parts.py` |
| Jungle | 10 species with solid petals, venation, translucency and sheen. Dark palette-tinted depth fog replaces the milky haze. | `src/physical/jungle.ts`, `tools/blender/pass5/jungle_flora5.py` |
| Fabric (default **Ribbon**) | A free-flying silk ribbon along a closed Lissajous spine, with tapered ends, torsion and flutter. Exact 12 s loop. | `src/physical/fabric.ts` |
| Stargate | Rotated Bayer jitter, depth-weighted history and far-field averaging; grain off. | `src/physical/stargate.ts` |
| Paint Pour | Four nozzle lanes (coral, cobalt, mint, gold). The dish is a collider and a rim torus drains paint, so the pool reaches a steady size. The loop is cut PERIOD-aligned in the steady part. | `tools/blender/pass4/paint_pour5.py`, `tools/blender/pass4/loop_crossfade.py` |
| Retired | Tunnel and Kaleido are removed from the mode lists and the preset gallery. Their code, `VALID_MODES` and `ALL_PRESETS` entries are kept. | `src/main.ts`, `src/ui/MainControlPanel.ts`, `src/presets.ts` |

## Pass 6 (2026-11-12)

| Mode | What changed | Files |
|---|---|---|
| Gravity | Default scene is now **Color Room**: bright walls, a reflective floor, and big single-colour clumps (~1100 balls) that drop in turn, splash, bounce and mix, then recycle. Uses Cascade's renderer: planar reflection, 4096 PCF shadows, contact AO. | `src/physical/colorroom.ts` |
| Paint | Default scene is now **Splash** (live). Crowns with finger ropes, Worthington jets, necking ropes and droplet sprays are thrown at the lens from many depths. Rendered as screen-space fluid: impostor depth and pigment MRT, radius-aware Vogel bilateral smoothing, wet acrylic shading. Pigments mix where splashes touch. | `src/physical/splash.ts` |
| Fabric | Default scene is now **Drift**. 5–10 ribbons or sheets come out of the haze toward the camera, with analytic VS geometry. Shading has a procedural plain-weave bump, thread-following anisotropic sheen and PCF shadows. 5 complementary palettes. | `src/physical/fabricdrift.ts` |
| City | Neighbourhoods built from a procedural box kit with procedural facades: glass downtown, brownstones, industrial, and a waterfront with a canal. Adds rooftop AC units and tanks, more traffic, and a district-bias relayout. | `src/physical/city.ts` |
| Jungle | Motif journey through Orchids, Heliconia/BoP, Monstera/Palm, Ferns/Moss, Bromeliads and Lotus. Each instance picks its zone at the far-end wrap, and the haze cross-fades per zone. | `src/physical/jungle.ts` |
| All modes | Per-mode panels (`src/modeControls.ts`, `MainControlPanel.buildModeControls`) with sliders, knobs and selectors bound to live scene keys. 3–6 built-in presets per mode, plus user Save/Load/Delete stored in localStorage under `flowModePresets:<mode>`. | `src/modeControls.ts`, `src/ui/MainControlPanel.ts` |

**Experiment kept:** `tools/blender/pass6/paint_splash6.py` (Mantaflow collision jets). At bakeable resolutions (64–72) it produced blobby sausages, not crowns, so the live Splash replaced it. Paint Pour still defaults to the pass-4 Cycles pour clip.

**Captures:** `node scripts/capture-pass4.mjs --seconds 10 --out DIR --only "label|mode=…&set=k:v;k:v"`. Panel screenshots: `node scripts/panel-shot.mjs DIR "Mode=Preset" …`.

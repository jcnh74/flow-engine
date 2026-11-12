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

# C4D studio-abstract style spec (pass 3)

Source: 12 reference images gathered from the "cinema4d studio abstract color look" image search
(Bing Images in real Chrome; Google returned a captcha). Sources per image: `out-landscape/pass3/refs12/sources.json`
(local only, not committed — the images belong to their authors and are used only as an internal style reference).

## What the references share
1. **Stage** — a seamless infinite cove: one saturated or pastel colour, a soft vertical gradient (lighter top,
   denser bottom), no visible horizon line, floor and wall the same hue. A faint bright bloom behind the subject.
2. **Subject** — one hero sculpture filling ~45–65 % of frame, plus 3–8 small satellites (spheres, little tori)
   at different depths. Forms are simple primitives pushed one step: twisted/roped torus, petals, capsules,
   knotted tubes, interlinked rings, metaballs. Edges are always rounded; no hard facets.
3. **Materials** — three families: matte clay/plastic (rough ~0.6), high gloss lacquer (rough ~0.1–0.2, crisp
   softbox reflections) and pearl/iridescent (hue drifts with view angle). Occasional satin metal or glass.
4. **Light** — one big softbox key (high, 35–60° to the side), white dome fill, gentle rim. Shadows are soft
   area shadows, **tinted by the cove colour, never black**. Deep AO contact shadows where objects touch the floor.
5. **Colour** — 3–5 harmonious hues with one accent: coral/peach/lilac/mint, cobalt/orange/cream,
   mint/pink/lilac, red cove with teal/bordeaux/cream, cream/gold monochrome. Background hue is part of the palette.
6. **Lens** — 35–50 mm feel, slight depth of field on far satellites, no heavy vignette, almost no grain.

## How flow-engine implements it
| Trait | Implementation |
|---|---|
| Cove | `backdrop()` gradient + glow (studio_shaders.ts); floor albedo solved so the lit floor equals the cove colour and fades into it |
| Geometry | `tools/blender/studio_scenes.py` (Blender 5.3 headless, numpy parametric meshes) → GLB |
| AO | Cycles AO bake (Metal GPU, 64 spp) into vertex colours; `pow(ao, stAO)` |
| Shadows | 2048² shadow map, 12-tap rotated Poisson PCF (`stShadowSoft`) |
| Gloss | GGX (Walter 2007) + Smith visibility + Schlick fresnel; studio env reflections (cove + 2 softboxes) |
| Rim | `pow(1-N·V, 3)` × rim colour × AO |
| Iridescent | cosine thin-film tint driven by N·V (`stIrid`) |
| DOF | 32-tap golden-angle gather on alpha = view distance (`stDof`, `stFocus`) |
| AA | 4× MSAA render buffer (RGBA16F) resolved before DOF |
| Tonemap | Khronos PBR Neutral so pastel and saturated cove colours stay true |
| Palettes | `STUDIO_LOOKS` in src/studio.ts: Coral Peach, Cobalt Orange, Mint Pink, Lilac Dream, Red Studio, Cream Gold |

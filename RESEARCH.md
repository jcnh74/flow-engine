# 3D Fractal Shader Research (November 2026)

## Research Summary

For genuine 3D fractals suitable for WebGL2 real-time rendering, the most established and well-documented approaches are ray-marched distance-estimator fractals. These techniques have been refined over the past decade and are widely used in real-time graphics.

### Primary Techniques Researched

1. **Mandelbulb** (Discovered ~2009, widely documented)
   - 3D extension of Mandelbrot set using spherical coordinates
   - Distance estimator: DE = 0.5 * r * log(r) / |dr|
   - Power parameter (typically 8.0) creates characteristic bulbous forms
   - Well-established algorithm with clear mathematical foundation

2. **Mandelbox** (Discovered by Tom Lowe, ~2010)
   - Uses box folding, sphere folding, and scaling operations
   - More geometric/architectural appearance than Mandelbulb
   - Parameters: scale (typically -1.5 to -3.0), fold limit, min/max radius
   - Excellent for creating infinite recursive structures

3. **Menger Sponge** (Classical fractal, well-documented)
   - Recursive box subdivision
   - Exact distance function available
   - Guaranteed correct geometry but computationally intensive

### Implementation Source

**Selected Approach: Mandelbulb with Mandelbox variants**

Rather than copying code from Shadertoy (which often has unclear licensing), I will implement the well-documented mathematical algorithms from primary sources:

- **Mandelbulb algorithm**: Based on spherical coordinate power formula, documented in Quilez's distance functions article and various academic sources since 2009
- **Distance estimation**: Using logarithmic derivative method (standard in computer graphics literature)
- **Ray marching**: Classic sphere tracing algorithm (documented by Hart, 1996 and refined by many)

### Licensing Note

The mathematical algorithms for these fractals (Mandelbulb, Mandelbox) are in the public domain - they are mathematical formulas and techniques that have been independently discovered and documented. The specific implementation will be original code based on the mathematical descriptions, making it suitable for MIT licensing.

### Key Implementation References (Concepts, not code)

1. **Distance Estimation Techniques**
   - Inigo Quilez's articles on distance functions (educational, widely cited)
   - John C. Hart's "Sphere Tracing" (1996) - seminal paper on ray marching
   - Mathematical derivations are public knowledge

2. **Fractal Mathematics**
   - Mandelbulb: Spherical coordinate transformation of complex power formula
   - Mandelbox: Geometric folding operations (mathematical operations, not copyrightable)

### Performance Considerations

- Adaptive iteration limits based on camera distance
- Early bailout conditions to prevent runaway iterations
- Quality presets for performance vs. visual quality tradeoffs
- Maximum iteration clamps to prevent GPU hangs

### Visual Quality Features

- Orbit trap coloring for interior detail
- Normal estimation via tetrahedron method for lighting
- Ambient occlusion from iteration count
- Soft shadows via cone tracing
- Camera controls: distance, FOV, rotation

## Conclusion

Implementation will use established mathematical algorithms (public domain mathematics) with original WebGL2/GLSL code, fully compatible with MIT license. No third-party shader code will be copied.

**Date of Research**: November 7, 2026
**Researcher**: AI Agent (Claude Sonnet 4.5)
**License Compatibility**: Original implementation, MIT-compatible

/**
 * Tests to ensure UI controls are wired to the render path
 * and that modulatable sliders are in MOD_TARGETS
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('UI Control Coverage', () => {
  const mainTs = readFileSync(join(__dirname, '../src/main.ts'), 'utf-8');
  const fractalShaders = readFileSync(join(__dirname, '../src/fractal_shaders.ts'), 'utf-8');
  const fractal2dShaders = readFileSync(join(__dirname, '../src/fractal2d_shaders.ts'), 'utf-8');

  // Extract SMOOTH array from main.ts
  const smoothMatch = mainTs.match(/const SMOOTH = \[([\s\S]*?)\];/);
  const smoothParams = smoothMatch ? 
    smoothMatch[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(s => s.length > 0) 
    : [];

  test('SMOOTH array is populated', () => {
    expect(smoothParams.length).toBeGreaterThan(50);
  });

  test('All fr2* params in SMOOTH are used in render2DFractal', () => {
    const fr2Params = smoothParams.filter(p => p.startsWith('fr2'));
    const unusedParams: string[] = [];

    for (const param of fr2Params) {
      // Check if param appears in uniform binding or calculation in render2DFractal
      const inMainTs = mainTs.includes(`P.${param}`) || mainTs.includes(`V.${param}`);
      const inShader = fractal2dShaders.includes(param) || 
                       mainTs.match(new RegExp(`render2DFractal[\\s\\S]{0,2000}${param}`));
      
      if (!inMainTs && !inShader) {
        unusedParams.push(param);
      }
    }

    expect(unusedParams).toEqual([]);
  });

  test('All 3D fractal motion params are used in renderFractal', () => {
    const motionParams = ['frFoldRot', 'frJuliaSpeed', 'frCamOrbitSpeed', 'frSlicePos'];
    const unusedParams: string[] = [];

    for (const param of motionParams) {
      // Check usage in renderFractal function or in uniform binding
      const used = mainTs.includes(`P.${param}`) || mainTs.includes(`V.${param}`);
      
      if (!used) {
        unusedParams.push(param);
      }
    }

    expect(unusedParams).toEqual([]);
  });

  test('All lighting rig params in SMOOTH are used', () => {
    const lightingParams = smoothParams.filter(p => 
      p === 'envIntensity' || p === 'envRot' || p === 'shadowSoft' || 
      p === 'shadowBias' || p === 'ssaoRadius'
    );
    const unusedParams: string[] = [];

    for (const param of lightingParams) {
      // These are passed to 3D rendering functions
      const used = mainTs.includes(`P.${param}`) || mainTs.includes(`V.${param}`);
      if (!used) {
        unusedParams.push(param);
      }
    }

    expect(unusedParams).toEqual([]);
  });

  test('Shader uniforms match parameter usage in renderFractal', () => {
    // Extract uniform declarations from shader
    const uniformMatches = fractalShaders.matchAll(/uniform\s+\w+\s+(\w+);/g);
    const declaredUniforms = Array.from(uniformMatches).map(m => m[1]);

    // Key uniforms that must be set
    const requiredUniforms = ['uFoldRot', 'uJuliaC', 'uSlicePlane', 'uSlicePos'];
    
    for (const uniform of requiredUniforms) {
      expect(declaredUniforms).toContain(uniform);
      
      // Check it's bound in renderFractal
      const boundInRender = mainTs.match(new RegExp(`gl\\.uniform.*${uniform}`));
      expect(boundInRender).toBeTruthy();
    }
  });

  test('All continuous params with beat link buttons are modulatable', () => {
    // Read MainControlPanel to find which params have beat link buttons
    const panelTs = readFileSync(join(__dirname, '../src/ui/MainControlPanel.ts'), 'utf-8');
    
    // buildSlider with modulatable=true creates beat link buttons
    const modulatableMatches = panelTs.matchAll(/buildSlider\('(\w+)'[^)]*true\)/g);
    const modulatableParams = Array.from(modulatableMatches).map(m => m[1]);
    
    // All should be in SMOOTH (which feeds MOD_TARGETS)
    const missingFromSmooth = modulatableParams.filter(p => !smoothParams.includes(p));
    
    expect(missingFromSmooth).toEqual([]);
  });

  test('2D Fractal type indices match shader switch cases', () => {
    // Check that shader has case for each type 0-4
    expect(fractal2dShaders).toContain('if (frType == 0)'); // Mandelbrot
    expect(fractal2dShaders).toContain('else if (frType == 1)'); // Julia
    expect(fractal2dShaders).toContain('else if (frType == 2)'); // Burning Ship
    expect(fractal2dShaders).toContain('else if (frType == 3)'); // Newton
    expect(fractal2dShaders).toContain('else'); // Phoenix
  });

  test('3D Fractal type indices match shader switch cases', () => {
    // Check that shader has case for each type 0-5
    expect(fractalShaders).toContain('if (uFractalType == 0)'); // Mandelbulb
    expect(fractalShaders).toContain('else if (uFractalType == 1)'); // Mandelbox
    expect(fractalShaders).toContain('else if (uFractalType == 2)'); // Menger
    expect(fractalShaders).toContain('else if (uFractalType == 3)'); // Sierpinski
    expect(fractalShaders).toContain('else if (uFractalType == 4)'); // Kaleidoscopic
    expect(fractalShaders).toContain('d = deQuaternionJulia(p)'); // Quaternion Julia (type 5, else case)
  });

  test('Fold rotation is applied in Mandelbox', () => {
    // Check that uFoldRot is used in deMandelbox
    const mandelboxMatch = fractalShaders.match(/float deMandelbox[\s\S]{0,1000}uFoldRot/);
    expect(mandelboxMatch).toBeTruthy();
  });

  test('Julia C is animated when orbit is enabled', () => {
    // Check that frJuliaOrbit and frJuliaSpeed are used in renderFractal
    const juliaOrbitLogic = mainTs.match(/if \(P\.frJuliaOrbit\)[\s\S]{0,300}frJuliaSpeed/);
    expect(juliaOrbitLogic).toBeTruthy();
  });
});

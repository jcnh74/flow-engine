import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Shader Version Preambles', () => {
  const mainSrc = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf-8');
  const postSrc = readFileSync(resolve(__dirname, '../src/post_shaders.ts'), 'utf-8');
  const toneSrc = readFileSync(resolve(__dirname, '../src/tonemap_shaders.ts'), 'utf-8');
  const trippySrc = readFileSync(resolve(__dirname, '../src/trippy_shaders.ts'), 'utf-8');
  const fractalSrc = readFileSync(resolve(__dirname, '../src/fractal_shaders.ts'), 'utf-8');
  const shadersSrc = readFileSync(resolve(__dirname, '../src/shaders.ts'), 'utf-8');
  
  function extractInlineShaders(src: string): string[] {
    // Match prog() calls with inline shader strings (backtick literals)
    const progRegex = /prog\([^,]+,\s*`([^`]+)`\)/g;
    const shaders: string[] = [];
    let match;
    
    while ((match = progRegex.exec(src)) !== null) {
      shaders.push(match[1]);
    }
    
    return shaders;
  }
  
  function extractExportedShaders(src: string): string[] {
    // Match exported const shader strings
    const exportRegex = /export const \w+(?:_FS|_VS|Frag|Vert) = `([^`]+)`/g;
    const shaders: string[] = [];
    let match;
    
    while ((match = exportRegex.exec(src)) !== null) {
      shaders.push(match[1]);
    }
    
    return shaders;
  }
  
  test('all inline fragment shaders in main.ts have #version 300 es', () => {
    const inlineShaders = extractInlineShaders(mainSrc);
    expect(inlineShaders.length).toBeGreaterThan(0);
    
    for (const shader of inlineShaders) {
      // Fragment shaders (have 'out vec4 fragColor') must start with #version 300 es
      if (shader.includes('out vec4 fragColor') || shader.includes('in vec2 vUv')) {
        const trimmed = shader.trim();
        expect(trimmed.startsWith('#version 300 es'), 
          `Fragment shader missing #version 300 es preamble:\n${shader.substring(0, 100)}...`
        ).toBe(true);
      }
    }
  });
  
  test('milkDropGrade shader has #version 300 es', () => {
    expect(mainSrc).toContain('milkDropGrade');
    const milkDropGradeMatch = mainSrc.match(/const milkDropGrade = prog\([^,]+,\s*`([^`]+)`\)/);
    expect(milkDropGradeMatch).toBeTruthy();
    
    if (milkDropGradeMatch) {
      const shader = milkDropGradeMatch[1].trim();
      expect(shader.startsWith('#version 300 es')).toBe(true);
    }
  });
  
  test('all exported fragment shaders have #version 300 es', () => {
    const sources = [postSrc, toneSrc, trippySrc, fractalSrc, shadersSrc];
    
    for (const src of sources) {
      const shaders = extractExportedShaders(src);
      
      for (const shader of shaders) {
        // Fragment shaders (have 'out vec4' or 'gl_FragColor') must have version
        if (shader.includes('out vec4') || shader.includes('gl_FragColor')) {
          const trimmed = shader.trim();
          expect(trimmed.startsWith('#version 300 es'), 
            `Exported fragment shader missing #version 300 es:\n${shader.substring(0, 100)}...`
          ).toBe(true);
        }
      }
    }
  });
  
  test('POST shader constants all have #version 300 es', () => {
    const postShaderNames = [
      'POST_VS', 'BLIT_FS', 'LUMA_KEY_FS', 'BLOOM_DOWN_FS', 
      'BLOOM_UP_FS', 'BLOOM_COMPOSITE_FS', 'FEEDBACK_FS', 
      'CA_DISTORT_FS', 'COLOR_GRADE_FS'
    ];
    
    for (const name of postShaderNames) {
      const regex = new RegExp(`export const ${name} = \`([^\`]+)\``, 's');
      const match = postSrc.match(regex);
      
      if (match) {
        const shader = match[1].trim();
        // All POST fragment shaders should have #version 300 es
        if (name.endsWith('_FS')) {
          expect(shader.startsWith('#version 300 es'), 
            `${name} missing #version 300 es`
          ).toBe(true);
        }
      }
    }
  });
  
  test('TONEMAP shader has #version 300 es', () => {
    expect(toneSrc).toContain('TONEMAP_FS');
    const match = toneSrc.match(/export const TONEMAP_FS = `([^`]+)`/s);
    
    if (match) {
      const shader = match[1].trim();
      expect(shader.startsWith('#version 300 es')).toBe(true);
    }
  });
  
  test('trippy shader has #version 300 es', () => {
    expect(trippySrc).toContain('trippyFrag');
    const match = trippySrc.match(/export const trippyFrag = `([^`]+)`/s);
    
    if (match) {
      const shader = match[1].trim();
      expect(shader.startsWith('#version 300 es')).toBe(true);
    }
  });
  
  test('fractal shader has #version 300 es', () => {
    expect(fractalSrc).toContain('FRACTAL_FS');
    const match = fractalSrc.match(/export const FRACTAL_FS = `([^`]+)`/s);
    
    if (match) {
      const shader = match[1].trim();
      expect(shader.startsWith('#version 300 es')).toBe(true);
    }
  });
});

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Color Control Coverage', () => {
  const trippySrc = readFileSync(resolve(__dirname, '../src/trippy_shaders.ts'), 'utf-8');
  const fractalSrc = readFileSync(resolve(__dirname, '../src/fractal_shaders.ts'), 'utf-8');
  const postSrc = readFileSync(resolve(__dirname, '../src/post_shaders.ts'), 'utf-8');

  describe('Kaleido Mode', () => {
    test('samples palette with getPaletteColor', () => {
      expect(trippySrc).toContain('renderKaleido');
      expect(trippySrc).toContain('getPaletteColor');
    });

    test('applies uSat to palette colors', () => {
      // Check that Kaleido function applies saturation to palette color
      const kaleidoSection = trippySrc.substring(
        trippySrc.indexOf('vec3 renderKaleido'),
        trippySrc.indexOf('vec3 renderPlasma')
      );
      expect(kaleidoSection).toContain('uSat');
      expect(kaleidoSection).toContain('mix(vec3(luma), paletteColor, uSat)');
    });

    test('colorizes pattern before feedback', () => {
      const kaleidoSection = trippySrc.substring(
        trippySrc.indexOf('vec3 renderKaleido'),
        trippySrc.indexOf('vec3 renderPlasma')
      );
      // Pattern should be multiplied by colored palette, not white
      expect(kaleidoSection).toContain('paletteColor * pattern');
    });

    test('clamps to avoid white clipping', () => {
      const kaleidoSection = trippySrc.substring(
        trippySrc.indexOf('vec3 renderKaleido'),
        trippySrc.indexOf('vec3 renderPlasma')
      );
      expect(kaleidoSection).toContain('min(col, vec3(');
    });
  });

  describe('Tunnel Mode', () => {
    test('samples palette with getPaletteColor', () => {
      const tunnelSection = trippySrc.substring(
        trippySrc.indexOf('vec3 renderTunnel'),
        trippySrc.indexOf('vec3 renderKaleido')
      );
      expect(tunnelSection).toContain('getPaletteColor');
    });

    test('applies uSat to palette colors', () => {
      const tunnelSection = trippySrc.substring(
        trippySrc.indexOf('vec3 renderTunnel'),
        trippySrc.indexOf('vec3 renderKaleido')
      );
      expect(tunnelSection).toContain('uSat');
      expect(tunnelSection).toContain('mix(vec3(luma), paletteColor, uSat)');
    });

    test('getPaletteColor does NOT apply uHueShift (handled by rotateHue)', () => {
      const getPaletteColorFunc = trippySrc.substring(
        trippySrc.indexOf('vec3 getPaletteColor'),
        trippySrc.indexOf('vec3 renderTunnel')
      );
      // uHueShift is now applied via YIQ rotation at the end, not in palette lookup
      expect(getPaletteColorFunc).toContain('t = fract(t)');
      expect(getPaletteColorFunc).toContain('rotateHue() handles that at the end');
    });
  });

  describe('Plasma Mode', () => {
    test('samples palette and applies uSat', () => {
      const plasmaSection = trippySrc.substring(
        trippySrc.indexOf('vec3 renderPlasma'),
        trippySrc.indexOf('vec3 renderMorph')
      );
      expect(plasmaSection).toContain('getPaletteColor');
      expect(plasmaSection).toContain('uSat');
      expect(plasmaSection).toContain('mix(vec3(luma), paletteColor, uSat)');
    });
  });

  describe('Morph Mode', () => {
    test('samples palette and applies uSat', () => {
      const morphSection = trippySrc.substring(
        trippySrc.indexOf('vec3 renderMorph'),
        trippySrc.indexOf('void main()')
      );
      expect(morphSection).toContain('getPaletteColor');
      expect(morphSection).toContain('uSat');
      expect(morphSection).toContain('mix(vec3(luma), paletteColor, uSat)');
    });
  });

  describe('3D Fractal Mode', () => {
    test('mixes cosine palette with Color1/Color2', () => {
      expect(fractalSrc).toContain('colStops = mix(uColor1, uColor2');
      expect(fractalSrc).toContain('col = mix(col, colStops');
    });

    test('uses high blend weight for Color1/Color2 dominance', () => {
      // Should be 0.85 or higher for Color pickers to dominate
      const mixLine = fractalSrc.match(/col = mix\(col, colStops, ([\d.]+)\)/);
      expect(mixLine).toBeTruthy();
      if (mixLine) {
        const weight = parseFloat(mixLine[1]);
        expect(weight).toBeGreaterThanOrEqual(0.85);
      }
    });
  });

  describe('Feedback Blend', () => {
    test('uses luma-based lighten blend', () => {
      expect(postSrc).toContain('FEEDBACK_FS');
      expect(postSrc).toContain('Lighten blend: compare by luma but carry full RGB');
    });

    test('compares by luma not per-channel', () => {
      const feedbackShader = postSrc.substring(
        postSrc.indexOf('FEEDBACK_FS'),
        postSrc.indexOf('BLOOM_COMPOSITE_FS')
      );
      expect(feedbackShader).toContain('currLuma');
      expect(feedbackShader).toContain('echoLumaScaled');
      expect(feedbackShader).toContain('echoLumaScaled > currLuma ? echoScaled : curr');
    });

    test('does not use per-channel max', () => {
      const feedbackShader = postSrc.substring(
        postSrc.indexOf('FEEDBACK_FS'),
        postSrc.indexOf('BLOOM_COMPOSITE_FS')
      );
      // Should NOT have: max(curr, echo)
      expect(feedbackShader).not.toContain('max(curr, echo');
    });
  });

  describe('Trippy Modes Final Pass', () => {
    test('does not double-apply saturation', () => {
      // Since each render function now applies uSat, the final pass should NOT
      const mainFunc = trippySrc.substring(
        trippySrc.indexOf('void main()'),
        trippySrc.length
      );
      // Check that final saturation pass is removed
      const saturationLines = (mainFunc.match(/mix\(vec3\(luma\), col, uSat\)/g) || []).length;
      expect(saturationLines).toBe(0); // Should be 0 since it's removed from final pass
    });
  });
});

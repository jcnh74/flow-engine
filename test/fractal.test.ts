import { describe, test, expect } from 'bun:test';
import { frag as fractal2dFS } from '../src/fractal2d_shaders';
import { FRACTAL_FS as fractal3dFS } from '../src/fractal_shaders';

describe('Fractal Shaders', () => {
  test('2D fractal shader has distinct Phoenix branch (frType==4)', () => {
    // Check that shader has explicit Phoenix case
    expect(fractal2dFS).toContain('frType == 4');
    expect(fractal2dFS).toContain('phoenix(coord)');
    
    // Check all 5 types are present
    expect(fractal2dFS).toContain('frType == 0'); // Mandelbrot
    expect(fractal2dFS).toContain('frType == 1'); // Julia
    expect(fractal2dFS).toContain('frType == 2'); // Burning Ship
    expect(fractal2dFS).toContain('frType == 3'); // Newton
  });
  
  test('3D fractal shader has explicit Quaternion Julia branch (uFractalType==5)', () => {
    // Check that shader has explicit type 5 case
    expect(fractal3dFS).toContain('uFractalType == 5');
    expect(fractal3dFS).toContain('deQuaternionJulia');
  });
  
  test('Quaternion multiplication is non-commutative', () => {
    // qMul from shader: vec4(x, y, z, w) where w is scalar
    // q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y
    const qMul = (q1: number[], q2: number[]): number[] => {
      const [x1, y1, z1, w1] = q1;
      const [x2, y2, z2, w2] = q2;
      return [
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,  // x
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,  // y
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,  // z
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2   // w
      ];
    };
    
    const a = [1, 0, 0, 0]; // Pure i
    const b = [0, 1, 0, 0]; // Pure j
    const ab = qMul(a, b);
    const ba = qMul(b, a);
    
    // Should be different (non-commutative)
    expect(ab).not.toEqual(ba);
  });
  
  test('Simulated Quaternion Julia DE varies non-spherically', () => {
    // Port the Julia iteration logic from GLSL
    // vec4(x, y, z, w) where w is scalar
    const qMul = (q1: number[], q2: number[]): number[] => {
      const [x1, y1, z1, w1] = q1;
      const [x2, y2, z2, w2] = q2;
      return [
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,  // x
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,  // y
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,  // z
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2   // w
      ];
    };
    
    const deQuaternionJulia = (p: number[], maxIter: number = 16): number => {
      // Match shader exactly: z = vec4(p, 0), dz = vec4(1, 0, 0, 0)
      let z = [...p, 0];
      const c = [-0.2, 0.6, 0.2, 0.2];  // x, y, z, w
      let dz = [1, 0, 0, 0]; // Match shader
      
      for (let i = 0; i < maxIter; i++) {
        const r2 = z[0]*z[0] + z[1]*z[1] + z[2]*z[2] + z[3]*z[3];
        if (r2 > 256.0) break;
        
        // dz = 2.0 * qMul(z, dz)
        const temp = qMul(z, dz);
        dz = temp.map(x => 2.0 * x);
        
        // z = qMul(z, z) + c
        const zSquared = qMul(z, z);
        z = zSquared.map((x, i) => x + c[i]);
      }
      
      const r = Math.sqrt(z[0]*z[0] + z[1]*z[1] + z[2]*z[2] + z[3]*z[3]);
      const dr = Math.sqrt(dz[0]*dz[0] + dz[1]*dz[1] + dz[2]*dz[2] + dz[3]*dz[3]);
      return 0.5 * r * Math.log(Math.max(r, 1e-6)) / Math.max(dr, 1e-6);
    };
    
    // Test various points (not just along axes)
    const tests = [
      [1.5, 0, 0],
      [0, 1.5, 0],
      [0, 0, 1.5],
      [1.0, 1.0, 0],
      [1.0, 0, 1.0],
      [0.8, 0.8, 0.8],
      [1.2, 0.5, 0.3]
    ];
    
    const distances = tests.map(p => deQuaternionJulia(p));
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    
    // For debugging: log the actual values
    console.log('Quaternion Julia distances:', distances);
    console.log('Min:', min, 'Max:', max);
    
    const variation = Math.abs(max - min) / ((Math.abs(max) + Math.abs(min)) / 2);
    console.log('Variation:', variation);
    
    // Should have significant variation (not a perfect sphere)
    expect(variation).toBeGreaterThan(0.01);
  });
});

import { describe, expect, test } from 'bun:test';
import { LiquidSim, LIQUID_N, LQ } from '../src/physical/liquid';

describe('Gravity Liquid sim', () => {
  test('fills to a steady ~10k live-ball budget, all inside the view frustum, no NaNs', () => {
    const sim = new LiquidSim();
    const counts: number[] = [];
    for (let i = 0; i < 60 * 12; i++) { sim.step(1 / 60, i % 30 === 0); if (i > 60 * 8) counts.push(sim.stats.alive); }
    expect(LIQUID_N).toBeGreaterThanOrEqual(12000);
    const lo = Math.min(...counts), hi = Math.max(...counts);
    expect(lo).toBeGreaterThan(8500);                 // fills the frame
    expect(hi).toBeLessThan(LIQUID_N);                // budgeted, not pool-limited
    expect((hi - lo) / hi).toBeLessThan(0.15);        // steady count (feedback emission)
    let bad = 0, outside = 0; const ez = sim.eyeZ(), tv = sim.P.tanV;
    for (let i = 0; i < sim.N; i++) if (sim.alive[i]) {
      if (!(Number.isFinite(sim.px[i]) && Number.isFinite(sim.vy[i]))) bad++;
      const dz = ez - sim.pz[i]; if (Math.abs(sim.py[i] - LQ.tgtY) > dz * tv + 0.7 || Math.abs(sim.px[i]) > dz * tv * LQ.aspect + 0.7) outside++;
    }
    expect(bad).toBe(0); expect(outside).toBe(0);
    let film = 0; for (let i = 0; i < sim.N; i++) film += sim.alive[i] & sim.film[i];
    expect(film).toBeGreaterThan(1500);              // backdrop film layer present (depth + shadow catcher)
  });
  test('cohesion and viscosity change the flow', () => {
    const run = (coh: number) => { const s = new LiquidSim(4000); s.P.cohesion = coh; s.P.viscosity = coh; for (let i = 0; i < 240; i++) s.step(1 / 60, false); return s.stats.contacts; };
    expect(run(2)).not.toBe(run(0));
  });
});

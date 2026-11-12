import { describe, expect, test } from 'bun:test';
import { LiquidSim, LIQUID_N } from '../src/physical/liquid';

describe('Gravity Liquid sim', () => {
  test('pours to 10k+ live balls, keeps them separated, cohesion holds streams together', () => {
    const sim = new LiquidSim();
    let peak = 0;
    for (let i = 0; i < 60 * 8; i++) { sim.step(1 / 60, i % 30 === 0); peak = Math.max(peak, sim.stats.alive); }
    expect(LIQUID_N).toBeGreaterThanOrEqual(13000);
    expect(peak).toBeGreaterThan(10000);
    let bad = 0;
    for (let i = 0; i < sim.N; i++) if (sim.alive[i] && !(Number.isFinite(sim.px[i]) && Number.isFinite(sim.vy[i]))) bad++;
    expect(bad).toBe(0);
    expect(sim.stats.contacts).toBeGreaterThan(1000);
  });
  test('cohesion and viscosity change the flow', () => {
    const run = (coh: number) => { const s = new LiquidSim(4000); s.P.cohesion = coh; s.P.viscosity = coh; for (let i = 0; i < 240; i++) s.step(1 / 60, false); return s.stats.contacts; };
    expect(run(2)).not.toBe(run(0));
  });
});

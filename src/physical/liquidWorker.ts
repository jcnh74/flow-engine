// MIT — Gravity Liquid physics worker: owns a LiquidSim, steps it on request and returns packed instance data.
import { LiquidSim } from './liquid';

const sim = new LiquidSim();
let prerolled = false;
self.onmessage = (e: MessageEvent) => {
  const { P, steps, buf } = e.data as { P: LiquidSim['P']; steps: number; buf: ArrayBuffer };
  Object.assign(sim.P, P);
  if (!prerolled) { for (let i = 0; i < 60 * 5; i++) sim.step(1 / 60, false); prerolled = true; }
  for (let k = 0; k < steps; k++) sim.step(1 / 60, k === steps - 1);
  const n = sim.pack(new Float32Array(buf));
  (self as unknown as Worker).postMessage({ buf, n, stats: { ...sim.stats, t: sim.t } }, [buf]);
};

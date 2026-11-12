// Pass 4 physical scenes: mode registry + lazy construction. Original MIT-licensed work for flow-engine.
import type { PhysFrame, PhysScene, PhysParams } from './common';
import { StargateScene, STARGATE_PALETTES } from './stargate';
import { PaintScene } from './paint';
import { BallsScene } from './balls';
import { FabricScene } from './fabric';
import { JungleScene } from './jungle';
import { VideoLoopScene } from './videoloop';
export { STARGATE_PALETTES };

/** Mode name -> scene id. */
export const PHYS_MODES: Record<string, string> = {
  'Fabric': 'fabric', 'Gravity': 'balls', 'Paint': 'paint', 'Jungle': 'jungle', 'Stargate': 'stargate', 'Paint Pour': 'pour',
};
export const PHYS_MODE_NAMES = Object.keys(PHYS_MODES);
export const PHYS_VARIANTS: Record<string, string[]> = {
  fabric: ['Flow', 'Blender Bake'], balls: ['Machine'], paint: ['Pour', 'Drip Wall'], jungle: ['Vortex', 'Canopy'], stargate: ['Floor + Ceiling', 'Walls'], pour: ['Loop'],
};
export const PHYS_MATS: Record<string, string[]> = {
  fabric: ['Satin', 'Silk', 'Iridescent', 'Velvet'], balls: ['Mixed'], paint: ['Wet Acrylic'], jungle: ['Natural', 'Pastel', 'Iridescent'], stargate: ['Light'], pour: ['Cycles'],
};

export class PhysicalRenderer {
  scenes: Record<string, PhysScene> = {};
  errors: Record<string, string> = {};
  constructor(private gl: WebGL2RenderingContext) {}
  get(id: string): PhysScene | null {
    if (this.scenes[id]) return this.scenes[id];
    try {
      const gl = this.gl;
      const s: PhysScene = id === 'stargate' ? new StargateScene(gl) : id === 'paint' ? new PaintScene(gl) : id === 'balls' ? new BallsScene(gl)
        : id === 'fabric' ? new FabricScene(gl) : id === 'jungle' ? new JungleScene(gl) : new VideoLoopScene(gl, '/pass4/paint_pour.mp4');
      void s.load();
      this.scenes[id] = s;
      return s;
    } catch (e) {
      this.errors[id] = e instanceof Error ? e.message : String(e);
      console.error(`Physical scene ${id} failed: ${this.errors[id]}`);
      return null;
    }
  }
  render(mode: string, f: PhysFrame): boolean {
    const id = PHYS_MODES[mode]; if (!id) return false;
    const s = this.get(id); if (!s) return false;
    s.render(f);
    return true;
  }
  stats(mode: string) { const s = this.scenes[PHYS_MODES[mode]]; return s ? { ready: s.ready, error: s.error, ...s.stats } : null; }
}
export type { PhysParams };

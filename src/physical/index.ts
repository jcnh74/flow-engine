// Pass 4 physical scenes: mode registry + lazy construction. Original MIT-licensed work for flow-engine.
import type { PhysFrame, PhysScene, PhysParams } from './common';
import { StargateScene, STARGATE_PALETTES } from './stargate';
import { PaintScene } from './paint';
import { SplashScene } from './splash';
import { BallsScene } from './balls';
import { CascadeScene } from './cascade';
import { ColorRoomScene } from './colorroom';
import { FabricScene } from './fabric';
import { FabricDriftScene } from './fabricdrift';
import { JungleScene } from './jungle';
import { VideoLoopScene } from './videoloop';
import { CityScene, CITY_PALETTES } from './city';
export { STARGATE_PALETTES, CITY_PALETTES };

/** Mode name -> scene id. */
export const PHYS_MODES: Record<string, string> = {
  'Fabric': 'fabric', 'Gravity': 'balls', 'Paint': 'paint', 'Jungle': 'jungle', 'City Vortex': 'city', 'Stargate': 'stargate', 'Paint Pour': 'pour',
};
export const PHYS_MODE_NAMES = Object.keys(PHYS_MODES);
export const PHYS_VARIANTS: Record<string, string[]> = {
  fabric: ['Drift', 'Ribbon', 'Flow', 'Blender Bake'], balls: ['Color Room', 'Cascade', 'Machine'], paint: ['Splash', 'Pour', 'Drip Wall'], jungle: ['Vortex', 'Canopy'], city: ['Vortex'], stargate: ['Floor + Ceiling', 'Walls'], pour: ['Loop'],
};
export const PHYS_MATS: Record<string, string[]> = {
  fabric: ['Satin', 'Silk', 'Iridescent', 'Velvet'], balls: ['Mixed'], paint: ['Wet Acrylic'], jungle: ['Natural', 'Pastel', 'Iridescent'], city: ['Dusk Gold', 'Cobalt Night', 'Pastel Morning'], stargate: ['Light'], pour: ['Cycles'],
};

export class PhysicalRenderer {
  scenes: Record<string, PhysScene> = {};
  errors: Record<string, string> = {};
  constructor(private gl: WebGL2RenderingContext) {}
  get(id: string): PhysScene | null {
    if (this.scenes[id]) return this.scenes[id];
    try {
      const gl = this.gl;
      const s: PhysScene = id === 'stargate' ? new StargateScene(gl) : id === 'paint' ? new PaintScene(gl) : id === 'splash' ? new SplashScene(gl) : id === 'balls' ? new BallsScene(gl) : id === 'cascade' ? new CascadeScene(gl) : id === 'colorroom' ? new ColorRoomScene(gl)
        : id === 'fabric' ? new FabricScene(gl) : id === 'drift' ? new FabricDriftScene(gl) : id === 'jungle' ? new JungleScene(gl) : id === 'city' ? new CityScene(gl) : new VideoLoopScene(gl, '/pass4/paint_pour.mp4');
      void s.load();
      this.scenes[id] = s;
      return s;
    } catch (e) {
      this.errors[id] = e instanceof Error ? e.message : String(e);
      console.error(`Physical scene ${id} failed: ${this.errors[id]}`);
      return null;
    }
  }
  private lastVariant = '';
  render(mode: string, f: PhysFrame): boolean {
    this.lastVariant = f.params.variant;
    let id = PHYS_MODES[mode]; if (!id) return false;
    if (id === 'balls') id = f.params.variant === 'Machine' ? 'balls' : f.params.variant === 'Cascade' ? 'cascade' : 'colorroom';   // Gravity: Color Room default; Cascade + Machine kept
    if (id === 'paint' && f.params.variant === 'Splash') id = 'splash';
    if (id === 'fabric' && f.params.variant === 'Drift') id = 'drift';   // Fabric: multi-ribbon drift (pass 6) default   // Paint: live screen-space splash (pass 6) default
    const s = this.get(id); if (!s) return false;
    s.render(f);
    return true;
  }
  stats(mode: string) { const id = PHYS_MODES[mode]; const s = id === 'paint' && this.lastVariant === 'Splash' ? this.scenes.splash : id === 'fabric' && this.lastVariant === 'Drift' ? this.scenes.drift : id === 'balls' ? this.scenes[this.lastVariant === 'Machine' ? 'balls' : this.lastVariant === 'Cascade' ? 'cascade' : 'colorroom'] : this.scenes[id]; return s ? { ready: s.ready, error: s.error, ...s.stats } : null; }
}
export type { PhysParams };

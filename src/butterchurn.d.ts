/**
 * Type declarations for butterchurn and butterchurn-presets
 * MIT-licensed visualization libraries
 */

declare module 'butterchurn' {
  interface ButterchurnOptions {
    width: number;
    height: number;
    pixelRatio: number;
    textureRatio: number;
  }
  
  interface ButterchurnVisualizer {
    loadPreset(preset: any, blendTime: number): void;
    render(): void;
    connectAudio(audioNode: AudioNode): void;
    setRendererSize(width: number, height: number): void;
  }
  
  function createVisualizer(
    audioContext: AudioContext,
    canvas: HTMLCanvasElement,
    options: ButterchurnOptions
  ): ButterchurnVisualizer;
  
  export default {
    createVisualizer
  };
}

declare module 'butterchurn-presets' {
  function getPresets(): { [name: string]: any };
  
  export default {
    getPresets
  };
}

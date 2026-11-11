/**
 * Butterchurn MilkDrop Integration
 * 
 * Uses MIT-licensed butterchurn and butterchurn-presets packages
 * to provide classic MilkDrop visualizations.
 * 
 * @license MIT
 * @see https://github.com/jberg/butterchurn
 * 
 * Butterchurn is licensed under the MIT License
 * Copyright (c) 2017 Jordan Berg
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

export interface MilkDropPreset {
  name: string;
  author?: string;
}

// Lazy-loaded modules (only loaded when MilkDrop mode is first entered)
let butterchurn: any = null;
let butterchurnPresets: any = null;
let loadingPromise: Promise<void> | null = null;

/**
 * Resolve a function from a deeply nested UMD/CJS module
 * Walks mod, mod.default, mod.default.default looking for the function
 */
function resolveFunction(mod: any, functionName: string): any {
  const candidates = [mod, mod?.default, mod?.default?.default];
  
  for (const candidate of candidates) {
    if (candidate && typeof candidate[functionName] === 'function') {
      console.log(`MilkDrop: Found ${functionName} at`, candidate === mod ? 'mod' : candidate === mod?.default ? 'mod.default' : 'mod.default.default');
      return candidate;
    }
  }
  
  // List available keys to help debug
  const keys = [
    `mod keys: ${mod ? Object.keys(mod).slice(0, 10).join(', ') : 'null'}`,
    `mod.default keys: ${mod?.default ? Object.keys(mod.default).slice(0, 10).join(', ') : 'null'}`,
    `mod.default.default keys: ${mod?.default?.default ? Object.keys(mod.default.default).slice(0, 10).join(', ') : 'null'}`
  ];
  
  throw new Error(`MilkDrop: Could not find ${functionName}. Searched:\n${keys.join('\n')}`);
}

/**
 * Load butterchurn and presets on demand
 * Handles UMD/CJS interop with deep default resolution
 */
async function ensureButterchurnLoaded(): Promise<void> {
  if (butterchurn && butterchurnPresets) return;
  if (loadingPromise) return loadingPromise;
  
  loadingPromise = (async () => {
    console.log('MilkDrop: Loading butterchurn modules...');
    try {
      const [bcMod, bcpMod] = await Promise.all([
        import('butterchurn'),
        import('butterchurn-presets')
      ]);
      
      console.log('MilkDrop: Modules imported, resolving functions...');
      
      // Resolve createVisualizer and getPresets from deeply nested CJS exports
      butterchurn = resolveFunction(bcMod, 'createVisualizer');
      butterchurnPresets = resolveFunction(bcpMod, 'getPresets');
      
      console.log('MilkDrop: Modules loaded successfully', {
        hasCreateVisualizer: typeof butterchurn.createVisualizer === 'function',
        hasGetPresets: typeof butterchurnPresets.getPresets === 'function'
      });
    } catch (err) {
      console.error('MilkDrop: Failed to load modules:', err);
      throw err;
    }
  })();
  
  return loadingPromise;
}

export class ButterchurnRenderer {
  private visualizer: any;
  private canvas: HTMLCanvasElement;
  private audioContext: AudioContext;
  private presets: { [name: string]: any } = {};
  private currentPresetName: string | null = null;
  private searchResults: string[] = [];
  private isReady: boolean = false;
  
  constructor(canvas: HTMLCanvasElement, audioContext: AudioContext) {
    this.canvas = canvas;
    this.audioContext = audioContext;
  }
  
  /**
   * Initialize butterchurn (async, loads modules on first call)
   */
  async init(): Promise<void> {
    if (this.isReady) return;
    
    await ensureButterchurnLoaded();
    
    // Get presets
    this.presets = butterchurnPresets.getPresets();
    
    // Initialize Butterchurn visualizer
    this.visualizer = butterchurn.createVisualizer(this.audioContext, this.canvas, {
      width: this.canvas.width,
      height: this.canvas.height,
      pixelRatio: window.devicePixelRatio || 1,
      textureRatio: 1
    });
    
    this.isReady = true;
    console.log('MilkDrop: Renderer initialized', { presetCount: Object.keys(this.presets).length });
  }
  
  /**
   * Load a preset by name
   */
  loadPreset(name: string): boolean {
    if (!this.isReady) {
      console.warn('MilkDrop: Renderer not ready, call init() first');
      return false;
    }
    
    const preset = this.presets[name];
    if (preset) {
      this.visualizer.loadPreset(preset, 0); // 0 = no blend transition
      this.currentPresetName = name;
      return true;
    }
    return false;
  }
  
  /**
   * Get list of all available presets
   */
  getPresetList(): MilkDropPreset[] {
    return Object.keys(this.presets).map(name => {
      const parts = name.split(' - ');
      return {
        name,
        author: parts.length > 1 ? parts[0] : undefined
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * Get sorted preset list (cached for consistency)
   */
  private getSortedPresetNames(): string[] {
    return Object.keys(this.presets).sort((a, b) => a.localeCompare(b));
  }
  
  /**
   * Get next preset in list
   */
  nextPreset(): string | null {
    const list = this.getSortedPresetNames();
    if (list.length === 0) return null;
    
    const currentIndex = this.currentPresetName ? list.indexOf(this.currentPresetName) : -1;
    const nextIndex = (currentIndex + 1) % list.length;
    const nextName = list[nextIndex];
    
    this.loadPreset(nextName);
    return nextName;
  }
  
  /**
   * Get previous preset in list
   */
  prevPreset(): string | null {
    const list = this.getSortedPresetNames();
    if (list.length === 0) return null;
    
    const currentIndex = this.currentPresetName ? list.indexOf(this.currentPresetName) : -1;
    const prevIndex = currentIndex <= 0 ? list.length - 1 : currentIndex - 1;
    const prevName = list[prevIndex];
    
    this.loadPreset(prevName);
    return prevName;
  }
  
  /**
   * Load a random preset
   */
  randomPreset(): string | null {
    const list = Object.keys(this.presets);
    if (list.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * list.length);
    const randomName = list[randomIndex];
    
    this.loadPreset(randomName);
    return randomName;
  }
  
  /**
   * Search presets by name (case-insensitive)
   */
  searchPresets(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    this.searchResults = Object.keys(this.presets)
      .filter(name => name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => a.localeCompare(b));
    return this.searchResults;
  }
  
  /**
   * Get current preset name
   */
  getCurrentPreset(): string | null {
    return this.currentPresetName;
  }
  
  /**
   * Connect audio source
   */
  connectAudio(analyserNode: AnalyserNode): void {
    if (this.isReady && this.visualizer) {
      this.visualizer.connectAudio(analyserNode);
    }
  }
  
  /**
   * Render frame
   */
  render(): void {
    if (this.isReady && this.visualizer) {
      this.visualizer.render();
    }
  }
  
  /**
   * Resize canvas
   */
  setRendererSize(width: number, height: number): void {
    if (this.isReady && this.visualizer) {
      this.visualizer.setRendererSize(width, height);
    }
  }
}

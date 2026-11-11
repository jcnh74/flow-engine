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

import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

export interface MilkDropPreset {
  name: string;
  author?: string;
}

export class ButterchurnRenderer {
  private visualizer: any;
  private canvas: HTMLCanvasElement;
  private presets: { [name: string]: any };
  private currentPresetName: string | null = null;
  private searchResults: string[] = [];
  
  constructor(canvas: HTMLCanvasElement, audioContext: AudioContext) {
    this.canvas = canvas;
    this.presets = butterchurnPresets.getPresets();
    
    // Initialize Butterchurn visualizer
    this.visualizer = butterchurn.createVisualizer(audioContext, canvas, {
      width: canvas.width,
      height: canvas.height,
      pixelRatio: window.devicePixelRatio || 1,
      textureRatio: 1
    });
  }
  
  /**
   * Load a preset by name
   */
  loadPreset(name: string) {
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
    });
  }
  
  /**
   * Search presets by name or author
   */
  searchPresets(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    this.searchResults = Object.keys(this.presets).filter(name =>
      name.toLowerCase().includes(lowerQuery)
    );
    return this.searchResults;
  }
  
  /**
   * Load next preset in search results or full list
   */
  nextPreset(): string | null {
    const list = this.searchResults.length > 0 ? this.searchResults : Object.keys(this.presets);
    if (list.length === 0) return null;
    
    const currentIndex = this.currentPresetName ? list.indexOf(this.currentPresetName) : -1;
    const nextIndex = (currentIndex + 1) % list.length;
    const nextName = list[nextIndex];
    
    this.loadPreset(nextName);
    return nextName;
  }
  
  /**
   * Load previous preset in search results or full list
   */
  prevPreset(): string | null {
    const list = this.searchResults.length > 0 ? this.searchResults : Object.keys(this.presets);
    if (list.length === 0) return null;
    
    const currentIndex = this.currentPresetName ? list.indexOf(this.currentPresetName) : -1;
    const prevIndex = currentIndex <= 0 ? list.length - 1 : currentIndex - 1;
    const prevName = list[prevIndex];
    
    this.loadPreset(prevName);
    return prevName;
  }
  
  /**
   * Load random preset
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
   * Get current preset name
   */
  getCurrentPreset(): string | null {
    return this.currentPresetName;
  }
  
  /**
   * Render frame
   */
  render() {
    this.visualizer.render();
  }
  
  /**
   * Connect audio node
   */
  connectAudio(audioNode: AudioNode) {
    this.visualizer.connectAudio(audioNode);
  }
  
  /**
   * Resize canvas
   */
  setRendererSize(width: number, height: number) {
    this.visualizer.setRendererSize(width, height);
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.visualizer) {
      // Butterchurn doesn't have a destroy method, but we can disconnect audio
      // and clear references
      this.visualizer = null;
    }
  }
}

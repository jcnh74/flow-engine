// Preset Gallery UI Component
import { PRESET_GALLERY, getRandomPreset, type Preset } from '../presets';

interface GalleryConfig {
  onLoadPreset: (preset: Preset) => void;
  currentPreset: string | null;
}

export class PresetGallery {
  private container: HTMLElement;
  private config: GalleryConfig;
  private thumbnails: Map<string, string> = new Map();
  private currentIndex: number = 0;

  constructor(config: GalleryConfig) {
    this.config = config;
    this.container = this.build();
    document.body.appendChild(this.container);
    this.setupEventListeners();
  }

  private build(): HTMLElement {
    const gallery = document.createElement('div');
    gallery.className = 'preset-gallery';
    gallery.innerHTML = `
      <div class="gallery-header">
        <h2 class="gallery-title">Presets</h2>
        <div class="gallery-controls">
          <button class="gallery-btn" data-action="prev" title="Previous (←)">◀</button>
          <button class="gallery-btn" data-action="random" title="Random (R)">🎲</button>
          <button class="gallery-btn" data-action="next" title="Next (→)">▶</button>
        </div>
      </div>
      <div class="gallery-grid">
        ${this.buildPresetCards()}
      </div>
    `;
    return gallery;
  }

  private buildPresetCards(): string {
    return PRESET_GALLERY.map((preset, index) => `
      <div class="preset-card" data-index="${index}" data-name="${preset.name}">
        <div class="preset-thumbnail" data-preset="${preset.name}">
          <div class="preset-thumbnail-placeholder">
            <span class="preset-mode-icon">${this.getModeIcon(preset.mode)}</span>
          </div>
        </div>
        <div class="preset-info">
          <div class="preset-name">${preset.name}</div>
          <div class="preset-mode">${preset.mode}</div>
        </div>
      </div>
    `).join('');
  }

  private getModeIcon(mode: string): string {
    const icons: Record<string, string> = {
      'Wall Studio': '◉',
      '3D Fractal': '✦',
      'Tunnel': '○',
      'Kaleido': '❖',
      'Plasma': '∿',
      'Morph': '●'
    };
    return icons[mode] || '○';
  }

  private setupEventListeners() {
    // Card clicks
    this.container.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.getAttribute('data-index')!);
        this.loadPresetByIndex(index);
      });

      // Lazy thumbnail generation on hover
      card.addEventListener('mouseenter', () => {
        const name = card.getAttribute('data-name')!;
        if (!this.thumbnails.has(name)) {
          this.generateThumbnail(name);
        }
      }, { once: true });
    });

    // Navigation buttons
    this.container.querySelector('[data-action="prev"]')?.addEventListener('click', () => this.prevPreset());
    this.container.querySelector('[data-action="next"]')?.addEventListener('click', () => this.nextPreset());
    this.container.querySelector('[data-action="random"]')?.addEventListener('click', () => this.randomPreset());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') this.prevPreset();
      if (e.key === 'ArrowRight') this.nextPreset();
      if (e.key === 'r' && e.shiftKey) this.randomPreset();
    });
  }

  private loadPresetByIndex(index: number) {
    this.currentIndex = index;
    const preset = PRESET_GALLERY[index];
    this.config.onLoadPreset(preset);
    this.updateActiveCard();
  }

  private prevPreset() {
    this.currentIndex = (this.currentIndex - 1 + PRESET_GALLERY.length) % PRESET_GALLERY.length;
    this.loadPresetByIndex(this.currentIndex);
  }

  private nextPreset() {
    this.currentIndex = (this.currentIndex + 1) % PRESET_GALLERY.length;
    this.loadPresetByIndex(this.currentIndex);
  }

  private randomPreset() {
    const preset = getRandomPreset();
    const index = PRESET_GALLERY.findIndex(p => p.name === preset.name);
    this.loadPresetByIndex(index);
  }

  private updateActiveCard() {
    this.container.querySelectorAll('.preset-card').forEach((card, index) => {
      card.classList.toggle('active', index === this.currentIndex);
    });
  }

  private generateThumbnail(presetName: string) {
    // Simple gradient-based thumbnail generation
    // In a real implementation, this would render offscreen
    const preset = PRESET_GALLERY.find(p => p.name === presetName);
    if (!preset) return;

    const thumbnail = this.container.querySelector(`.preset-thumbnail[data-preset="${presetName}"] .preset-thumbnail-placeholder`);
    if (!thumbnail) return;

    // Generate a gradient based on the preset's color stops
    const stops = preset.params.stops || [[0, '#6b5fff'], [1, '#ff3366']];
    const gradientStops = stops.map((s: [number, string]) => `${s[1]} ${s[0] * 100}%`).join(', ');
    const gradient = `linear-gradient(135deg, ${gradientStops})`;
    
    (thumbnail as HTMLElement).style.background = gradient;
    this.thumbnails.set(presetName, gradient);
  }

  public setCurrentPreset(name: string) {
    const index = PRESET_GALLERY.findIndex(p => p.name === name);
    if (index >= 0) {
      this.currentIndex = index;
      this.updateActiveCard();
    }
  }

  public show() {
    this.container.classList.remove('hidden');
  }

  public hide() {
    this.container.classList.add('hidden');
  }

  public toggle() {
    this.container.classList.toggle('hidden');
  }
}

// Beat Link Popup Component
import type { ModulationSystem } from '../modulation';

export interface BeatLinkConfig {
  param: string;
  currentMapping?: {
    source: string;
    amount: number;
    smoothing: number;
    invert: boolean;
  };
  onSave: (mapping: {
    source: string;
    amount: number;
    smoothing: number;
    invert: boolean;
  }) => void;
  onRemove: () => void;
  onCancel: () => void;
}

export class BeatLinkPopup {
  private overlay: HTMLElement;
  private popup: HTMLElement;

  constructor(config: BeatLinkConfig) {
    this.overlay = this.createOverlay();
    this.popup = this.createPopup(config);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.popup);
    
    // Position popup
    this.positionPopup();
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'beat-link-overlay';
    overlay.onclick = () => this.close();
    return overlay;
  }

  private createPopup(config: BeatLinkConfig): HTMLElement {
    const popup = document.createElement('div');
    popup.className = 'beat-link-popup';
    
    const current = config.currentMapping || {
      source: 'bass',
      amount: 0.5,
      smoothing: 0.7,
      invert: false
    };

    popup.innerHTML = `
      <div class="popup-header">
        <h3>Link ${config.param} to Audio</h3>
        <button class="popup-close">×</button>
      </div>
      <div class="popup-body">
        <div class="popup-section">
          <label>Source Signal</label>
          <div class="radio-group">
            <label><input type="radio" name="source" value="beat" ${current.source === 'beat' ? 'checked' : ''}> Beat</label>
            <label><input type="radio" name="source" value="bass" ${current.source === 'bass' ? 'checked' : ''}> Bass</label>
            <label><input type="radio" name="source" value="mid" ${current.source === 'mid' ? 'checked' : ''}> Mid</label>
            <label><input type="radio" name="source" value="high" ${current.source === 'high' ? 'checked' : ''}> High</label>
            <label><input type="radio" name="source" value="level" ${current.source === 'level' ? 'checked' : ''}> Level</label>
          </div>
        </div>
        
        <div class="popup-section">
          <label>Amount (0-1)</label>
          <div class="slider-with-value">
            <input type="range" id="popup-amount" min="0" max="1" step="0.01" value="${current.amount}" />
            <span class="slider-value">${current.amount.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="popup-section">
          <label>Smoothing (0-0.95)</label>
          <div class="slider-with-value">
            <input type="range" id="popup-smoothing" min="0" max="0.95" step="0.01" value="${current.smoothing}" />
            <span class="slider-value">${current.smoothing.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="popup-section">
          <label>
            <input type="checkbox" id="popup-invert" ${current.invert ? 'checked' : ''} />
            Invert (subtract instead of add)
          </label>
        </div>
      </div>
      <div class="popup-footer">
        ${config.currentMapping ? '<button class="popup-btn popup-btn-remove">Remove Link</button>' : ''}
        <button class="popup-btn popup-btn-cancel">Cancel</button>
        <button class="popup-btn popup-btn-save">Save</button>
      </div>
    `;

    // Event listeners
    popup.querySelector('.popup-close')!.addEventListener('click', () => config.onCancel());
    popup.querySelector('.popup-btn-cancel')!.addEventListener('click', () => config.onCancel());
    
    popup.querySelector('.popup-btn-save')!.addEventListener('click', () => {
      const source = (popup.querySelector('input[name="source"]:checked') as HTMLInputElement).value;
      const amount = parseFloat((popup.querySelector('#popup-amount') as HTMLInputElement).value);
      const smoothing = parseFloat((popup.querySelector('#popup-smoothing') as HTMLInputElement).value);
      const invert = (popup.querySelector('#popup-invert') as HTMLInputElement).checked;
      
      config.onSave({ source, amount, smoothing, invert });
      this.close();
    });

    const removeBtn = popup.querySelector('.popup-btn-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        config.onRemove();
        this.close();
      });
    }

    // Live value updates
    const amountSlider = popup.querySelector('#popup-amount') as HTMLInputElement;
    const amountValue = amountSlider.nextElementSibling!;
    amountSlider.addEventListener('input', () => {
      amountValue.textContent = parseFloat(amountSlider.value).toFixed(2);
    });

    const smoothingSlider = popup.querySelector('#popup-smoothing') as HTMLInputElement;
    const smoothingValue = smoothingSlider.nextElementSibling!;
    smoothingSlider.addEventListener('input', () => {
      smoothingValue.textContent = parseFloat(smoothingSlider.value).toFixed(2);
    });

    return popup;
  }

  private positionPopup(): void {
    // Center popup
    this.popup.style.position = 'fixed';
    this.popup.style.left = '50%';
    this.popup.style.top = '50%';
    this.popup.style.transform = 'translate(-50%, -50%)';
    this.popup.style.zIndex = '10001';
  }

  close(): void {
    this.overlay.remove();
    this.popup.remove();
  }
}

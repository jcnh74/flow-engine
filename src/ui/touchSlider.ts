// Touch-first sliders: relative drag, no jump-to-tap, pointer capture, fine-drag, rAF coalesce.
// Original MIT-licensed work for flow-engine.

export type TouchSliderHandlers = {
  onStart?: (key: string) => void;
  onChange?: (key: string, value: number) => void;
  onEnd?: (key: string, value: number) => void;
};

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function stepValue(v: number, min: number, max: number, step: number) {
  const s = step > 0 ? step : 0.01;
  const snapped = Math.round((v - min) / s) * s + min;
  const decimals = (String(s).split('.')[1] || '').length;
  return Number(clamp(snapped, min, max).toFixed(decimals));
}

/** Relative value: start value plus horizontal delta, with optional vertical fine-drag. */
export function valueFromRelativeDrag(
  startValue: number,
  dx: number,
  dy: number,
  trackWidth: number,
  min: number,
  max: number,
  step: number,
): number {
  const span = max - min;
  const width = Math.max(trackWidth, 1);
  const fine = 1 / (1 + Math.abs(dy) / 90);
  return stepValue(startValue + (dx / width) * span * fine, min, max, step);
}

export function fillRatio(value: number, min: number, max: number) {
  return clamp((value - min) / (max - min || 1), 0, 1);
}

export function paintSlider(root: HTMLElement, value: number) {
  const min = Number(root.dataset.min);
  const max = Number(root.dataset.max);
  const r = fillRatio(value, min, max);
  root.style.setProperty('--v', String(r));
  const fill = root.querySelector('.touch-slider-fill') as HTMLElement | null;
  const thumb = root.querySelector('.touch-slider-thumb') as HTMLElement | null;
  if (fill) fill.style.width = `${r * 100}%`;
  if (thumb) thumb.style.left = `${r * 100}%`;
  const input = root.querySelector('input[type="range"]') as HTMLInputElement | null;
  if (input && input.value !== String(value)) input.value = String(value);
}

type DragState = {
  id: number;
  startX: number;
  startY: number;
  startValue: number;
  width: number;
  last: number;
};

/** Bind a .touch-slider element. The inner range input is visual-only (pointer-events: none). */
export function bindTouchSlider(root: HTMLElement, handlers: TouchSliderHandlers = {}): () => void {
  const key = root.dataset.param || '';
  const input = root.querySelector('input[type="range"]') as HTMLInputElement | null;
  let drag: DragState | null = null;
  let raf = 0;
  let pending: number | null = null;
  let lastTap = 0;

  const min = () => Number(root.dataset.min);
  const max = () => Number(root.dataset.max);
  const step = () => Number(root.dataset.step || 0.01);
  const current = () => {
    const v = input ? parseFloat(input.value) : Number(root.dataset.value);
    return Number.isFinite(v) ? v : min();
  };
  const emit = (v: number, end = false) => {
    paintSlider(root, v);
    if (end) {
      handlers.onChange?.(key, v);
      handlers.onEnd?.(key, v);
      return;
    }
    pending = v;
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pending === null) return;
        const val = pending; pending = null;
        handlers.onChange?.(key, val);
      });
    }
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    root.setPointerCapture(e.pointerId);
    const track = root.querySelector('.touch-slider-track') as HTMLElement | null;
    const width = (track ?? root).getBoundingClientRect().width;
    drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, startValue: current(), width, last: current() };
    root.classList.add('is-dragging');
    handlers.onStart?.(key);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const v = valueFromRelativeDrag(drag.startValue, e.clientX - drag.startX, e.clientY - drag.startY, drag.width, min(), max(), step());
    drag.last = v;
    emit(v);
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const v = drag.last;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    drag = null;
    root.classList.remove('is-dragging');
    try { root.releasePointerCapture(e.pointerId); } catch {}
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pending = null;
    // Double-tap / double-click reset when the pointer barely moved.
    if (Math.hypot(dx, dy) <= 12) {
      const now = performance.now();
      if (now - lastTap < 380) {
        lastTap = 0;
        const def = root.dataset.default;
        if (def !== undefined) {
          const reset = stepValue(parseFloat(def), min(), max(), step());
          emit(reset, true);
          return;
        }
      } else lastTap = now;
    } else lastTap = 0;
    emit(v, true);
  };

  paintSlider(root, current());
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  root.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const def = root.dataset.default;
    if (def === undefined) return;
    emit(stepValue(parseFloat(def), min(), max(), step()), true);
  });

  return () => {
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerup', onUp);
    root.removeEventListener('pointercancel', onUp);
  };
}

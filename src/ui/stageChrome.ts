/** Stage chrome: restore-UI chip and the one-tap "Tap for fullscreen" prompt. */

export type StageState = {
  uiHidden: boolean;
  performanceMode: boolean;
  fullscreen: boolean;
  fullscreenPending: boolean;
};

/** Restore chip is visible only when the UI is hidden, the user has poked
 *  (mouse move / tap), and the fullscreen prompt is not covering the screen.
 *  In performance mode the chip stays hidden until a poke so the first frame
 *  of a show stays clean. */
export function shouldShowRestore(state: Pick<StageState, 'uiHidden' | 'performanceMode' | 'fullscreenPending'>, poked: boolean): boolean {
  if (!state.uiHidden) return false;
  if (state.fullscreenPending) return false;
  if (state.performanceMode && !poked) return false;
  return poked;
}

export function restoreLabel(state: Pick<StageState, 'performanceMode'>): string {
  return state.performanceMode ? 'Exit fullscreen' : 'Show UI';
}

export const STAGE_RESTORE_FADE_MS = 2500;

export class StageChrome {
  readonly restore: HTMLButtonElement;
  readonly prompt: HTMLElement;
  readonly promptButton: HTMLButtonElement;
  fadeMs: number;
  private fadeTimer: number | null = null;
  private poked = false;
  private ignorePokeUntil = 0;
  private state: StageState = {
    uiHidden: false,
    performanceMode: false,
    fullscreen: false,
    fullscreenPending: false,
  };
  private onRestore: () => void;
  private onTapFullscreen: () => void;
  private unbind: Array<() => void> = [];

  pokeGraceMs: number;
  private lastPointerX = Number.NaN;
  private lastPointerY = Number.NaN;

  constructor(opts: {
    fadeMs?: number;
    pokeGraceMs?: number;
    onRestore: () => void;
    onTapFullscreen: () => void;
  }) {
    this.fadeMs = opts.fadeMs ?? STAGE_RESTORE_FADE_MS;
    this.pokeGraceMs = opts.pokeGraceMs ?? 800;
    this.onRestore = opts.onRestore;
    this.onTapFullscreen = opts.onTapFullscreen;

    this.restore = document.createElement('button');
    this.restore.type = 'button';
    this.restore.id = 'stage-restore';
    this.restore.className = 'stage-restore';
    this.restore.textContent = 'Show UI';
    this.restore.setAttribute('aria-label', 'Show UI');

    this.prompt = document.createElement('div');
    this.prompt.id = 'stage-fs-prompt';
    this.prompt.className = 'stage-fs-prompt';
    this.prompt.setAttribute('role', 'dialog');
    this.prompt.setAttribute('aria-label', 'Tap for fullscreen');
    this.promptButton = document.createElement('button');
    this.promptButton.type = 'button';
    this.promptButton.className = 'stage-fs-prompt-btn';
    this.promptButton.textContent = 'Tap for fullscreen';
    this.prompt.appendChild(this.promptButton);
  }

  mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.restore);
    parent.appendChild(this.prompt);

    const onRestoreClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.onRestore();
    };
    const onPromptClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.onTapFullscreen();
    };
    const onPointer = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.('#stage-fs-prompt, #stage-restore, .flow-panel, .lil-gui, .preset-gallery')) return;
      const pe = e as PointerEvent;
      if (e.type === 'pointermove') {
        const x = pe.clientX, y = pe.clientY;
        if (Number.isFinite(this.lastPointerX) && Math.hypot(x - this.lastPointerX, y - this.lastPointerY) < 8) return;
        this.lastPointerX = x;
        this.lastPointerY = y;
      }
      this.poke();
    };

    this.restore.addEventListener('click', onRestoreClick);
    this.promptButton.addEventListener('click', onPromptClick);
    document.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerdown', onPointer, { passive: true });

    this.unbind.push(
      () => this.restore.removeEventListener('click', onRestoreClick),
      () => this.promptButton.removeEventListener('click', onPromptClick),
      () => document.removeEventListener('pointermove', onPointer),
      () => document.removeEventListener('pointerdown', onPointer),
    );
    this.render();
  }

  /** Call after Hide UI so the chip appears once, then auto-fades.
   *  Skipped in performance mode so the first frame stays clean. */
  onHidden(performanceMode: boolean): void {
    this.state.uiHidden = true;
    this.state.performanceMode = performanceMode;
    if (performanceMode) {
      this.suppressPoke();
    } else {
      this.poke();
    }
    this.render();
  }

  onShown(): void {
    this.state.uiHidden = false;
    this.poked = false;
    this.clearFade();
    this.render();
  }

  suppressPoke(ms?: number): void {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.ignorePokeUntil = now + (ms ?? this.pokeGraceMs);
    this.poked = false;
    this.clearFade();
    this.render();
  }

  poke(): void {
    if (!this.state.uiHidden) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now < this.ignorePokeUntil) return;
    this.poked = true;
    this.clearFade();
    this.fadeTimer = window.setTimeout(() => {
      this.poked = false;
      this.fadeTimer = null;
      this.render();
    }, this.fadeMs);
    this.render();
  }

  sync(state: StageState): void {
    this.state = { ...state };
    if (!state.uiHidden) {
      this.poked = false;
      this.clearFade();
    }
    this.render();
  }

  isPoked(): boolean {
    return this.poked;
  }

  destroy(): void {
    this.clearFade();
    this.unbind.forEach((fn) => fn());
    this.unbind = [];
    this.restore.remove();
    this.prompt.remove();
  }

  private clearFade(): void {
    if (this.fadeTimer != null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private render(): void {
    const show = shouldShowRestore(this.state, this.poked);
    const label = restoreLabel(this.state);
    this.restore.textContent = label;
    this.restore.setAttribute('aria-label', label);
    this.restore.classList.toggle('is-visible', show);
    this.restore.tabIndex = show ? 0 : -1;
    this.prompt.classList.toggle('is-visible', !!this.state.fullscreenPending);
  }
}

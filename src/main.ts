import GUI from 'lil-gui';
import * as S from './shaders';
import * as GS from './grass_shaders';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const hud = document.getElementById('hud')!; if (!new URLSearchParams(location.search).get('debug')) hud.style.display = 'none';
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })!;
if (!gl || !gl.getExtension('EXT_color_buffer_float')) { document.body.innerHTML = '<p style="color:#fff">WebGL2 + EXT_color_buffer_float required</p>'; throw 0; }
gl.getExtension('OES_texture_float_linear');
const MAXTEX = gl.getParameter(gl.MAX_TEXTURE_SIZE);
const DT = 1 / 60;

// ---------- palettes ----------
type Stop = [number, string];
const PALETTES: Record<string, Stop[]> = {
  'Liquid Spectrum': [[0, '#1b00ff'], [0.2, '#9d00ff'], [0.4, '#ff0080'], [0.6, '#ff7a00'], [0.8, '#ffe600'], [1, '#00ffd5']],
  'Silk Iris': [[0, '#00e5ff'], [0.25, '#3d5afe'], [0.5, '#d500f9'], [0.75, '#ff4081'], [1, '#ffd740']],
  'Tropical Ink': [[0, '#00c853'], [0.3, '#00b8d4'], [0.55, '#2962ff'], [0.8, '#aa00ff'], [1, '#ff6d00']],
  'Aurora Fluid': [[0, '#03001e'], [0.25, '#7303c0'], [0.5, '#ec38bc'], [0.75, '#fdeff9'], [1, '#22d3ee']],
  'Coral Reef': [[0, '#0b1d51'], [0.3, '#1fa2ff'], [0.55, '#12d8fa'], [0.8, '#ff7e5f'], [1, '#feb47b']],
  'Machine Dreams': [[0, '#120136'], [0.3, '#035aa6'], [0.55, '#40bad5'], [0.8, '#fcbf1e'], [1, '#ff2e63']],
  'Ember': [[0, '#1a0000'], [0.3, '#8b0000'], [0.6, '#ff4500'], [0.85, '#ffb347'], [1, '#fff4d6']],
  'Glacier': [[0, '#001219'], [0.3, '#005f73'], [0.55, '#0a9396'], [0.8, '#94d2bd'], [1, '#e9d8a6']],
  'Neon Bloom': [[0, '#ff00a8'], [0.33, '#7a00ff'], [0.66, '#00e5ff'], [1, '#c6ff00']],
  'Pastel Data': [[0, '#ffadad'], [0.25, '#ffd6a5'], [0.5, '#caffbf'], [0.75, '#9bf6ff'], [1, '#bdb2ff']],
};
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
function hueRot(c: number[], deg: number) { // YIQ rotation
  const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const y = .299 * c[0] + .587 * c[1] + .114 * c[2], i = .596 * c[0] - .274 * c[1] - .322 * c[2], q = .211 * c[0] - .523 * c[1] + .312 * c[2];
  const i2 = i * ca - q * sa, q2 = i * sa + q * ca;
  return [y + .956 * i2 + .621 * q2, y - .272 * i2 - .647 * q2, y - 1.106 * i2 + 1.703 * q2].map(v => Math.min(1, Math.max(0, v)));
}
function cmykSafe(c: number[]) {
  const l = .299 * c[0] + .587 * c[1] + .114 * c[2]; const d = c.map(v => v - l); const m = Math.max(...d.map(Math.abs));
  const lim = .42 * (1 - Math.abs(l - .5) * .9); const k = m > lim ? lim / m : 1;
  let o = d.map(v => l + v * k); o[2] = Math.min(o[2], o[0] * .5 + o[1] * .5 + .55); o[1] = Math.min(o[1], .88);
  return o.map(v => Math.min(.93, Math.max(.035, v)));
}

// ---------- params ----------
const P: any = {
  mode: 'Wall Studio', seed: 1977,
  wMat: 'clay', wColor: '#d9563c', wPatch: false, wFurLen: 0.06, wFurDens: 700, wComb: 0.8, wWind: 0.15, wShells: 16, wRough: 0.08, wAbsorb: 1.2, wDisp: 0.03,
  wObj: false, wObjMat: 'glossy', cycA: '#d8d8d8', cycB: '#8e8e8e', cycOn: true, grain: 0.025,
  wcView: 'Front', wcYaw: 0, wcPitch: 0, wcDist: 5.0, wcFov: 40, wcPanX: 0, wcPanY: 0, wcAuto: false,
  gOn: true, gH: 0.32, gHR: 0.5, gW: 0.012, gCurv: 0.35, gStiff: 1, gLean: 0.25, gTwist: 0.6, gClump: 0.4, gDensity: 576, gSeg: 6, gR: 11, gTerrA: 0.35,
  gWind: 0.6, gGustK: 0.45, gGustSpeed: 1.6, gFlutter: 0.03, gWindAz: 30,
  gColor: 'natural', gBase: '#2c4a12', gTip: '#8fb53a', gDryC: '#c9b46a', gDry: 0.5, gColRand: 0.35, gSoil: '#3b2f22',
  gLight: 'Golden hour', gSunAz: 235, gSunEl: 11, gSunI: 1, gSkyI: 1, gHaze: 1, gShSoft: 1.5, gTrans: 1, gSpec: 0.35, gAO: 0.25, gExposure: 1.1, gShRes: 2048,
  gcView: 'Eye level', gcYaw: 0, gcPitch: 10, gcDist: 4.5, gcHeight: 0.9, gcFov: 45, gcPanX: 0, gcPanZ: 0, gcAuto: false, gcAutoSpd: 3,
  lsCam: 0.85, lsPrim: 'sphere', lsRotRand: 1, lsSizeRand: 0.15, lsFlow: false, lsDetach: false, lsFlowU: 0.03, lsFlowV: -0.04, lsSSS: 1, cL0Pal: '(main)', cL1Pal: '(main)', cOPal: 'Liquid Spectrum', cL0H: 0, cL0S: 1, cL0C: 1, cL1H: 0.08, cL1S: 1, cL1C: 1, cOH: 0, cOS: 1.3, cOC: 1.05, cMix1: 'normal', cMixA1: 1, cMixO: 'normal', cMixAO: 0, cHueCycle: 0, cGrad: 'folds', beadMode: 'patchwork', pShape: 'voronoi', pScale: 4, pSoft: 0.15, pSeed: 3, pJit: 0.35, pDrift: 0, pFab: 0, pOff: 0, beadSolid: '#ffd27a', lsDripLen: 0.35, lsDripAmt: 0.25, lsStyle: 'Beads', lsCount: 32768, lsRadius: 0.0375, lsRand: 0.1, lsVisc: 0.08, lsCoh: 0.25, lsCohR: 0.3, lsBounce: 0.25, lsFric: 0.7, lsDamp: 0.4, lsDrip: 300, lsTurn: 0, lsFloor: -1.25, lsBoxX: 4, lsBoxZ: 2.5, lsTank: false, lsSlide: 0.15, lsSub: 2,
  lsFabric: true, lsHem: -5, lsFloorOn: true, lsFloorCol: '#4a505c', lsFloorRough: 0.42, lsAbsorb: 3, lsInflate: 1.3, lsGain: 1.6,
  gStrength: 0.6, gAz: 0, gEl: -90, mass: 1, stiffness: 1, damping: 0.5, wind: 0, windAz: 90, floor: 0.6, 
  pCount: 1048576, cohesion: 0.6, gBlend: 0.35, stream: 1.0, pLife: 0.12, vmax: 6, pTurb: 0.25, wellG: 1, pWidth: 1.1, streak: 0.06, pGain: 0.05, dof: 0, fabricUnder: 0, pColorBySpeed: 0.45,
  wells: [] as any[], particles: 1048576, noiseScale: 1.6, octaves: 3, evolution: 0.12, curl: 1.0, turbulence: 0.25,
  speed: 1.0, flowBias: 0.0, stretch: 1.6, life: 0.18, decay: 0.965, pointSize: 1.4, gain: 0.045, colorBySpeed: 0.7,
  palette: 'Glacier', hueShift: 0, paletteOffset: 0, blend: 'additive', exposure: 1.0, bloom: 0.35, bloomThreshold: 0.25,
  background: '#020208', densityComp: true, smoothing: 0.08,
  fold: 0.55, warp: 0.6, layers: 2, layerSep: 0.45, detail: 2, meshRes: 512, scale3d: 0.6, gloss: 70, spec: 1.0, iridescence: 0.5, rim: 0.7, saturation: 1.3, brightness: 0.6, ao: 0.7, evolution3d: 0.08,
  orbitSpeed: 0.05, camDist: 4.2, fov: 40, lightAngle: 35, fog: 0.5,
  lightPreset: 'Studio 3-point', envIntensity: 0.8, envRot: 0, followCam: false, toneMap: 'ACES', shadowSoft: 0.35, shadowBias: 0.0015, shadowResLive: 2048, shadowResExport: 4096, ssaoRadius: 0.25,
  lights: [] as any[], zoom: 1, driftX: 0.0, driftY: 0.0, paused: false, cmykSafe: false,
  exportPreset: '4K UHD 3840×2160', orientation: 'landscape', width: 3840, height: 2160, dpi: 300, tiff: false, pdf: false, frameToExport: true,
};
const SMOOTH = ['noiseScale','evolution','curl','turbulence','speed','flowBias','stretch','life','decay','pointSize','gain','colorBySpeed','paletteOffset','exposure','bloom','bloomThreshold','zoom','driftX','driftY',
  'fold','warp','layerSep','scale3d','gloss','spec','iridescence','rim','saturation','brightness','ao','evolution3d','orbitSpeed','camDist','fov','lightAngle','fog',
  'gStrength','gAz','gEl','mass','stiffness','damping','wind','windAz','floor','cohesion','gBlend','stream','pLife','vmax','pTurb','wellG','pWidth','streak','pGain','dof','fabricUnder','pColorBySpeed'];
const L: any = {}; SMOOTH.forEach(k => L[k] = P[k]);
let V: any = L; // values used by GL code: eased copy for preview, final P for stills
function easeParams() { for (const k of SMOOTH) { const d = P[k] - L[k]; L[k] = Math.abs(d) < 1e-6 ? P[k] : L[k] + d * Math.min(1, P.smoothing <= 0 ? 1 : P.smoothing * 2); } }
let stops: Stop[] = PALETTES[P.palette].map(s => [s[0], s[1]] as Stop);
const STOPP: any = {}; const syncStops = () => stops.forEach((s, i) => STOPP['stop' + i] = s[1]);
syncStops();

type ExportPreset = { name: string; w: number; h: number; dpi: number; board?: boolean; pdf?: boolean; note: string };
const PRESETS: ExportPreset[] = [
  { name: '4K UHD 3840×2160', w: 3840, h: 2160, dpi: 300, note: '16:9 still / video frame' },
  { name: '8K 7680×4320', w: 7680, h: 4320, dpi: 300, note: 'print-grade still' },
  { name: 'Topsheet 68×13in @300 (20400×3900)', w: 20400, h: 3900, dpi: 300, board: true, note: 'Proteus / Tribe full-bleed topsheet' },
  { name: 'Wrap City Blue 15×65in @300 (4500×19500)', w: 4500, h: 19500, dpi: 300, board: true, pdf: true, note: 'vinyl wrap, full bleed, default portrait' },
  { name: 'Custom', w: 0, h: 0, dpi: 300, note: 'type width/height' },
];
const DEFAULT_ORIENT: Record<string, string> = { 'Wrap City Blue 15×65in @300 (4500×19500)': 'portrait', 'Topsheet 68×13in @300 (20400×3900)': 'landscape' };
function applyPreset() {
  const p = PRESETS.find(x => x.name === P.exportPreset)!; if (!p || !p.w) return;
  const L = Math.max(p.w, p.h), Sh = Math.min(p.w, p.h);
  if (p.board) { [P.width, P.height] = P.orientation === 'portrait' ? [Sh, L] : [L, Sh]; } else { P.width = p.w; P.height = p.h; }
  P.dpi = p.dpi; P.pdf = !!p.pdf;
}

// ---------- GL helpers ----------
function prog(vs: string, fs: string) {
  const p = gl.createProgram()!;
  for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const e = gl.getShaderInfoLog(s); log('shader error ' + e); throw new Error(e!); }
    gl.attachShader(p, s);
  }
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)!);
  const u: any = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i)!; u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}
type FB = { t: WebGLTexture; f: WebGLFramebuffer; w: number; h: number };
function fbo(w: number, h: number, ifmt: number, fmt: number, type: number, filter: number): FB {
  const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
const del = (b?: FB) => { if (b) { gl.deleteTexture(b.t); gl.deleteFramebuffer(b.f); } };
const stateFB = (w: number, h: number) => fbo(w, h, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
const hdrFB = (w: number, h: number) => fbo(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);

const sim = prog(S.QUAD_VS, S.SIM_FS), draw = prog(S.DRAW_VS, S.DRAW_FS), fade = prog(S.QUAD_VS, S.FADE_FS),
  bright = prog(S.QUAD_VS, S.BRIGHT_FS), blur = prog(S.QUAD_VS, S.BLUR_FS), comp = prog(S.QUAD_VS, S.COMP_FS);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const palTex = gl.createTexture()!;
const palL = gl.createTexture()!;
const BLENDS = ['normal', 'add', 'screen', 'multiply', 'overlay', 'soft light', 'hue', 'color'];
const GRADS = ['folds', 'depth', 'height', 'normal']; const BEADM = ['palette', 'from fabric', 'solid', 'gradient', 'patchwork']; const PSHAPES = ['voronoi', 'noise blobs', 'bands']; const PRIMS = ['sphere', 'rounded cube', 'capsule', 'torus', 'teardrop', 'mixed'];
function rampOf(st0: Stop[], out: Uint8Array, row: number) { const st = [...st0].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < 256; i++) { const tt = i / 255; let j = 0; while (j < st.length - 2 && tt > st[j + 1][0]) j++;
    const a = st[j], b = st[Math.min(j + 1, st.length - 1)]; const k = b[0] > a[0] ? Math.min(1, Math.max(0, (tt - a[0]) / (b[0] - a[0]))) : 0;
    const ca = hex(a[1]), cb = hex(b[1]); let c = ca.map((v, n) => v + (cb[n] - v) * k); c = hueRot(c, P.hueShift); if (P.cmykSafe) c = cmykSafe(c);
    out.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], (row * 256 + i) * 4); } }
function buildLayers() { const d = new Uint8Array(256 * 3 * 4); [P.cL0Pal, P.cL1Pal, P.cOPal].forEach((n: string, r: number) => rampOf(n === '(main)' || !PALETTES[n] ? stops : PALETTES[n], d, r));
  gl.bindTexture(gl.TEXTURE_2D, palL); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 3, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
function colorUniforms(u: any) { if (!u.uPalL && !u.uLC0) return; bindTex(13, palL, u.uPalL);
  gl.uniform4f(u.uLC0, P.cL0H, P.cL0S, P.cL0C, 0); gl.uniform4f(u.uLC1, P.cL1H, P.cL1S, P.cL1C, 0); gl.uniform4f(u.uLC2, P.cOH, P.cOS, P.cOC, 0);
  gl.uniform1i(u.uMix1, BLENDS.indexOf(P.cMix1)); gl.uniform1i(u.uMixO, BLENDS.indexOf(P.cMixO)); gl.uniform1f(u.uMixA1, P.cMixA1); gl.uniform1f(u.uMixAO, P.cMixAO);
  gl.uniform1i(u.uGrad, GRADS.indexOf(P.cGrad)); gl.uniform1i(u.uBeadMode, BEADM.indexOf(P.beadMode)); const bs = hex(P.beadSolid); gl.uniform3f(u.uBeadSolid, bs[0], bs[1], bs[2]);
  gl.uniform1f(u.uHueT, P.cHueCycle / 60 * frame * DT);
  gl.uniform1i(u.uPShape, PSHAPES.indexOf(P.pShape)); gl.uniform1f(u.uPScale, P.pScale); gl.uniform1f(u.uPSoft, P.pSoft); gl.uniform1f(u.uPSeed, P.pSeed); gl.uniform1f(u.uPJit, P.pJit); gl.uniform1f(u.uPDrift, P.pDrift); gl.uniform1f(u.uPTime, frame * DT); gl.uniform1f(u.uPFab, P.pFab); gl.uniform1f(u.uPOff, P.pOff); }
function buildPalette() { buildLayers();
  const data = new Uint8Array(256 * 4); const st = [...stops].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let j = 0; while (j < st.length - 2 && t > st[j + 1][0]) j++;
    const a = st[j], b = st[Math.min(j + 1, st.length - 1)]; const k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
    const ca = hex(a[1]), cb = hex(b[1]); let c = ca.map((v, n) => v + (cb[n] - v) * k);
    c = hueRot(c, P.hueShift); if (P.cmykSafe) c = cmykSafe(c);
    data.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i * 4);
  }
  gl.bindTexture(gl.TEXTURE_2D, palTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
}

// ---------- simulation ----------
let texW = 1024, texH = 1024, st: FB[] = [];
function allocState() { st.forEach(del); texW = P.particles >= 2097152 ? 2048 : Math.min(1024, Math.ceil(Math.sqrt(P.particles))); texH = Math.ceil(P.particles / texW); st = [stateFB(texW, texH), stateFB(texW, texH)]; }
const quad = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
function axis(half: number[]) { return half[0] >= half[1] ? [1, 0] : [0, 1]; }
function simStep(frame: number, half: number[], init = false, time = frame * DT * V.evolution, off = [0, 0]) {
  gl.disable(gl.BLEND); gl.useProgram(sim.p); const u = sim.u;
  gl.bindFramebuffer(gl.FRAMEBUFFER, st[1].f); gl.viewport(0, 0, texW, texH);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st[0].t); gl.uniform1i(u.uState, 0);
  gl.uniform1i(u.uInit, init ? 1 : 0); gl.uniform1ui(u.uSeed, P.seed >>> 0); gl.uniform1ui(u.uFrame, frame >>> 0); gl.uniform1i(u.uTexW, texW);
  gl.uniform2f(u.uHalf, half[0], half[1]); gl.uniform1f(u.uDt, DT); gl.uniform1f(u.uTime, time); gl.uniform2f(u.uOffset, off[0], off[1]);
  gl.uniform1f(u.uScale, V.noiseScale); gl.uniform1f(u.uCurl, V.curl); gl.uniform1f(u.uTurb, V.turbulence); gl.uniform1f(u.uSpeed, V.speed);
  gl.uniform1f(u.uLife, V.life); gl.uniform1f(u.uStretch, V.stretch); gl.uniform1f(u.uBias, V.flowBias); gl.uniform1i(u.uOct, P.octaves);
  const ax = axis(half); gl.uniform2f(u.uAxis, ax[0], ax[1]);
  quad(); st.reverse();
}
function blendMode() {
  gl.enable(gl.BLEND);
  if (P.blend === 'max') { gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE); }
  else { gl.blendEquation(gl.FUNC_ADD); P.blend === 'screen' ? gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR) : gl.blendFunc(gl.ONE, gl.ONE); }
}
type Trails = { depth: WebGLRenderbuffer; a: FB; b: FB; b1: FB; b1t: FB; b2: FB; b2t: FB; w: number; h: number };
function makeTrails(w: number, h: number): Trails {
  const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
  const t = { a: hdrFB(w, h), b: hdrFB(w, h), depth: depthRB(w, h), b1: hdrFB(hw, hh), b1t: hdrFB(hw, hh), b2: hdrFB(qw, qh), b2t: hdrFB(qw, qh), w, h };
  for (const k of ['a', 'b']) { gl.bindFramebuffer(gl.FRAMEBUFFER, (t as any)[k].f); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.depth); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  return t;
}
const freeTrails = (t?: Trails) => { if (t) { freeG(t); [t.a, t.b, t.b1, t.b1t, t.b2, t.b2t].forEach(del); gl.deleteRenderbuffer(t.depth); } };
function depthRB(w: number, h: number) { const r = gl.createRenderbuffer()!; gl.bindRenderbuffer(gl.RENDERBUFFER, r); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); return r; }
// view: world-space center/half-extent the trail buffer covers; pxScale: pixels per 1080 short-side
function trailStep(T: Trails, c: number[], h: number[], pxScale: number) {
  gl.disable(gl.BLEND); gl.useProgram(fade.p); gl.bindFramebuffer(gl.FRAMEBUFFER, T.b.f); gl.viewport(0, 0, T.w, T.h);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.a.t); gl.uniform1i(fade.u.uT, 0); gl.uniform1f(fade.u.uDecay, V.decay); quad();
  blendMode(); gl.useProgram(draw.p); const u = draw.u;
  gl.bindTexture(gl.TEXTURE_2D, st[0].t); gl.uniform1i(u.uState, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, palTex); gl.uniform1i(u.uPal, 1); gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u.uTexW, texW); gl.uniform2f(u.uC, c[0], c[1]); gl.uniform2f(u.uH, h[0], h[1]);
  gl.uniform1f(u.uPt, Math.max(1, V.pointSize * pxScale)); gl.uniform1f(u.uSpeedMix, V.colorBySpeed); gl.uniform1f(u.uPalOff, V.paletteOffset);
  // keep energy per unit area constant when point size is clamped to 1px
  const eff = Math.max(1, V.pointSize * pxScale); gl.uniform1f(draw.u.uGain, V.gain * Math.pow(V.pointSize * pxScale / eff, 2) * gainNorm());
  gl.drawArrays(gl.POINTS, 0, P.particles); gl.disable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
  [T.a, T.b] = [T.b, T.a];
}
function bloomPass(T: Trails, pxScale: number) {
  gl.disable(gl.BLEND); gl.useProgram(bright.p); gl.bindFramebuffer(gl.FRAMEBUFFER, T.b1.f); gl.viewport(0, 0, T.b1.w, T.b1.h);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.a.t); gl.uniform1i(bright.u.uT, 0); gl.uniform1f(bright.u.uExp, V.exposure); gl.uniform1f(bright.u.uThr, V.bloomThreshold); quad();
  gl.useProgram(blur.p); gl.uniform1i(blur.u.uT, 0);
  const pass = (src: FB, dst: FB, dx: number, dy: number) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform2f(blur.u.uDir, dx / src.w, dy / src.h); quad(); };
  const k = Math.max(1, pxScale);
  pass(T.b1, T.b1t, k, 0); pass(T.b1t, T.b1, 0, k);
  pass(T.b1, T.b2t, 2 * k, 0); pass(T.b2t, T.b2, 0, k); pass(T.b2, T.b2t, k, 0); pass(T.b2t, T.b2, 0, k);
}
function composite(T: Trails, off: number[], vp: number[]) {
  gl.disable(gl.BLEND); gl.useProgram(comp.p); const u = comp.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.a.t); gl.uniform1i(u.uT, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.b1.t); gl.uniform1i(u.uB1, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.b2.t); gl.uniform1i(u.uB2, 2); gl.activeTexture(gl.TEXTURE0);
  gl.uniform2f(u.uOff, off[0], off[1]); gl.uniform2f(u.uFull, T.w, T.h); gl.uniform1f(u.uExp, V.exposure); gl.uniform1f(u.uBloom, V.bloom);
  const bg = hex(P.background); gl.uniform3f(u.uBg, bg[0], bg[1], bg[2]); gl.uniform1i(u.uCmyk, P.cmykSafe ? 1 : 0); { const a = hex(P.cycA), b = hex(P.cycB); gl.uniform1i(u.uCyc, isW() && P.cycOn ? 1 : 0); gl.uniform3f(u.uCycA, a[0], a[1], a[2]); gl.uniform3f(u.uCycB, b[0], b[1], b[2]); gl.uniform1f(u.uGrain, isW() ? P.grain : 0); gl.uniform1f(u.uGSeed, frame % 97); } gl.uniform1i(u.uTone, P.mode !== '2D flow' ? (P.toneMap === 'ACES' ? 1 : P.toneMap === 'Exponential' ? 0 : 2) : 0);
  gl.viewport(vp[0], vp[1], vp[2], vp[3]); quad();
}
let curAspect = 16 / 9;
function gainNorm() { let g = Math.pow(1048576 / P.particles, 0.6); if (P.densityComp) g *= Math.max(1, Math.max(curAspect, 1 / curAspect) / (16 / 9)); return g; }
const worldHalf = (aspect: number) => [aspect / 2, 0.5];
const viewCenter = (f: number) => [P.driftX * f * DT, P.driftY * f * DT];

// ---------- 3D fabric renderer ----------
const surf = prog(S.SURF_VS, S.SURF_FS);
const ibo = gl.createBuffer()!; let mesh = { rx: 0, ry: 0, count: 0 };
function ensureMesh(rx: number, ry: number) {
  if (mesh.rx === rx && mesh.ry === ry) return;
  const idx = new Uint32Array(rx * ry * 6); let n = 0; const R = rx + 1;
  for (let j = 0; j < ry; j++) for (let i = 0; i < rx; i++) { const a = j * R + i, b = a + 1, c = a + R, d = c + 1; idx[n++] = a; idx[n++] = b; idx[n++] = c; idx[n++] = b; idx[n++] = d; idx[n++] = c; }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); mesh = { rx, ry, count: n };
}
type V3 = number[];
const sub = (a: V3, b: V3) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a: V3) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return a.map(v => v / l); };
const cross = (a: V3, b: V3) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function mul(a: number[], b: number[]) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
function lookAt(e: V3, t: V3, up: V3) { const z = norm(sub(e, t)), x = norm(cross(up, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; }
function frustum(l: number, r: number, b: number, t: number, n: number, f: number) { return [2 * n / (r - l), 0, 0, 0, 0, 2 * n / (t - b), 0, 0, (r + l) / (r - l), (t + b) / (t - b), -(f + n) / (f - n), -1, 0, 0, -2 * f * n / (f - n), 0]; }
const hashSeed = (s: number, k: number) => (Math.sin(s * 12.9898 + k * 78.233) * 43758.5453 % 1 + 1) % 1;

// ---------- studio lighting ----------
type Light = { on: boolean; type: string; az: number; el: number; dist: number; color: string; intensity: number; shadow: boolean; cone: number };
const Lt = (on: boolean, type: string, az: number, el: number, dist: number, color: string, intensity: number, shadow: boolean, cone = 30): Light => ({ on, type, az, el, dist, color, intensity, shadow, cone });
const OFF = () => Lt(false, 'directional', 0, 30, 6, '#ffffff', 1, false);
const LIGHT_PRESETS: Record<string, { env: number; lights: Light[] }> = {
  'C4D Studio Softbox': { env: 1.0, lights: [Lt(true, 'directional', 35, 38, 6, '#fff6ec', 3.4, true), Lt(true, 'directional', -60, 15, 6, '#e6eeff', 0.8, false), Lt(true, 'directional', 160, 30, 6, '#ffffff', 2.4, false), OFF()] },
  'Rim Dramatic': { env: 0.35, lights: [Lt(true, 'directional', 150, 22, 6, '#ffffff', 5.0, true), Lt(true, 'directional', -150, 20, 6, '#ffe2c4', 3.5, false), Lt(true, 'directional', 20, 25, 6, '#c8d6ff', 0.6, false), OFF()] },
  'High-key White': { env: 1.8, lights: [Lt(true, 'directional', 10, 55, 6, '#ffffff', 2.6, true), Lt(true, 'directional', -70, 20, 6, '#ffffff', 1.4, false), Lt(true, 'directional', 70, 20, 6, '#ffffff', 1.4, false), OFF()] },
  'Colored Gels': { env: 0.5, lights: [Lt(true, 'directional', 45, 30, 6, '#ff3d8b', 3.4, true), Lt(true, 'directional', -50, 25, 6, '#2fa8ff', 3.2, false), Lt(true, 'directional', 170, 35, 6, '#ffd36b', 2.2, false), OFF()] },
  'Studio 3-point': { env: 0.8, lights: [Lt(true, 'directional', 40, 42, 6, '#fff1e0', 3.2, true), Lt(true, 'directional', -65, 18, 6, '#cfe0ff', 0.9, false), Lt(true, 'directional', 165, 35, 6, '#ffffff', 2.6, false), OFF()] },
  'Softbox top': { env: 1.3, lights: [Lt(true, 'directional', 5, 78, 6, '#ffffff', 3.0, true), Lt(true, 'directional', 180, 12, 6, '#e8eeff', 0.5, false), OFF(), OFF()] },
  'Rim/backlit': { env: 0.7, lights: [Lt(true, 'directional', 155, 28, 6, '#ffffff', 4.2, true), Lt(true, 'directional', -155, 24, 6, '#ffd0f0', 3.2, false), Lt(true, 'directional', 0, 10, 6, '#b0c4ff', 0.9, false), OFF()] },
  'Dramatic single key': { env: 0.12, lights: [Lt(true, 'spot', 62, 38, 6, '#fff0dc', 7.5, true, 28), OFF(), OFF(), OFF()] },
  'Gallery spot': { env: 0.25, lights: [Lt(true, 'spot', 12, 68, 6, '#fff6e8', 8, true, 20), Lt(true, 'directional', -90, 10, 6, '#c8d6ff', 0.3, false), OFF(), OFF()] },
};
P.lights = LIGHT_PRESETS['Studio 3-point'].lights.map(l => ({ ...l }));
function applyLightPreset(name: string) { const p = LIGHT_PRESETS[name]; if (!p) return; p.lights.forEach((l, i) => Object.assign(P.lights[i], l)); P.envIntensity = p.env; }
const surfD = prog(S.SURF_VS, S.DEPTH_FS), ssao = prog(S.QUAD_VS, S.SSAO_FS), applyAO = prog(S.QUAD_VS, S.APPLYAO_FS);
const sCmp = gl.createSampler()!, sRaw = gl.createSampler()!;
for (const [sm, f] of [[sCmp, gl.LINEAR], [sRaw, gl.NEAREST]] as const) { gl.samplerParameteri(sm, gl.TEXTURE_MIN_FILTER, f); gl.samplerParameteri(sm, gl.TEXTURE_MAG_FILTER, f); gl.samplerParameteri(sm, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.samplerParameteri(sm, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
gl.samplerParameteri(sCmp, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.samplerParameteri(sCmp, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
const shadowMaps: { t: WebGLTexture; f: WebGLFramebuffer; size: number }[] = [];
function ensureShadow(i: number, size: number) {
  const m = shadowMaps[i]; if (m && m.size === size) return m; if (m) { gl.deleteTexture(m.t); gl.deleteFramebuffer(m.f); }
  const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
  const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  return shadowMaps[i] = { t, f, size };
}
for (let i = 0; i < 4; i++) ensureShadow(i, 1);
function ortho(l: number, r: number, b: number, t: number, n: number, f: number) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]; }
const xf = (m: number[], p: V3) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
function lightVP(dir: V3, ext: number[], zr: number) {
  const up = Math.abs(dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]; const view = lookAt(dir.map(v => v * 20), [0, 0, 0], up);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const q = xf(view, [sx * ext[0], sy * ext[1], sz * zr]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]); } }
  lastLProj = ortho(mn[0], mx[0], mn[1], mx[1], -mx[2] - 0.5, -mn[2] + 0.5); lastLView = view; return mul(lastLProj, view);
}
let lastLProj: number[] = [], lastLView: number[] = [];
function setSurfVS(pr: any, VP: number[], View: number[], depthOnly: number, ext: number[], t3: number, aspect: number) {
  const u = pr.u; gl.useProgram(pr.p); gl.uniform2i(u.uRes, mesh.rx, mesh.ry); setFab(u, ext, t3, aspect);
  gl.uniformMatrix4fv(u.uVP, false, VP); if (u.uView) gl.uniformMatrix4fv(u.uView, false, View); gl.uniform1i(u.uDepthOnly, depthOnly); gl.uniform1i(u.uShellN, 0); gl.uniform1f(u.uFurLen, P.wFurLen); gl.uniform1f(u.uComb, P.wComb); gl.uniform1f(u.uFurWind, P.wWind); gl.uniform1f(u.uWT, t3);
}
function gbuf(T: any) {
  if (!T.g) {
    const mk = () => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, T.w, T.h); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    T.g = { f: gl.createFramebuffer(), pos: mk(), nrm: mk(), ao1: hdrFB(T.w, T.h), ao2: hdrFB(T.w, T.h) };
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.g.f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, T.g.pos, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, T.g.nrm, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, T.depth); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
  }
  return T.g;
}
function freeG(T: any) { if (T?.fl) { gl.deleteRenderbuffer(T.fl.d); del(T.fl.z); del(T.fl.z2); del(T.fl.th); T.fl = null; } if (T?.g) { gl.deleteFramebuffer(T.g.f); gl.deleteTexture(T.g.pos); gl.deleteTexture(T.g.nrm); del(T.g.ao1); del(T.g.ao2); T.g = null; } }
let shadowMsLast = 0;
let settleFrame = 0;
const isLS = () => P.mode === 'Liquid Spheres' || P.mode === 'Wall Studio';
const isW = () => P.mode === 'Wall Studio';
const effL = () => isW() ? 1 : P.layers;
const WMATS = ['silk', 'water', 'glass', 'clay', 'fur', 'grass'], OMATS = ['glossy', 'chrome', 'glass', 'clay'];
const W_VIEWS: Record<string, number[]> = { 'Front': [0, 0, 5.0, 40], '3/4 left': [-30, 5, 4.8, 40], '3/4 right': [30, 5, 4.8, 40], 'Close-up': [8, 3, 2.4, 34], 'Wide': [0, 8, 8.5, 42] };
function applyWView(n: string) { const v = W_VIEWS[n]; if (!v) return; P.wcView = n; [P.wcYaw, P.wcPitch, P.wcDist, P.wcFov] = v; P.wcPanX = 0; P.wcPanY = 0; }
function wClamp() { const wide = P.wcView === 'Wide'; P.wcYaw = Math.max(-50, Math.min(50, P.wcYaw)); P.wcPitch = Math.max(-25, Math.min(25, P.wcPitch)); P.wcDist = Math.max(1.2, Math.min(wide ? 10 : 5.4, P.wcDist));
  const pm = wide ? 2 : Math.max(0, (5.4 - P.wcDist) * 0.3); P.wcPanX = Math.max(-pm, Math.min(pm, P.wcPanX)); P.wcPanY = Math.max(-pm, Math.min(pm, P.wcPanY)); }
function cam3D(aspect: number, tO: number, subr: number[]) {
  if (isW()) { wClamp(); const yaw = (P.wcYaw + (P.wcAuto ? 12 * Math.sin(tO) : 0)) * Math.PI / 180, pitch = P.wcPitch * Math.PI / 180, dist = P.wcDist, tg = [P.wcPanX, P.wcPanY, 0];
    const eye = [tg[0] + dist * Math.sin(yaw) * Math.cos(pitch), tg[1] + dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch)];
    const n = 0.05, f = 60, tS = Math.tan(P.wcFov * Math.PI / 360); let top: number, right: number; if (aspect >= 1) { top = tS * n; right = top * aspect; } else { right = tS * n; top = right / aspect; }
    const l = -right + 2 * right * subr[0], r = -right + 2 * right * subr[1], t = top - 2 * top * subr[2], b = top - 2 * top * subr[3];
    const Proj = frustum(l, r, b, t, n, f), View = lookAt(eye, tg, [0, 1, 0]), VP = mul(Proj, View);
    const tS0 = Math.tan(V.fov * Math.PI / 360); return { yaw, dist, eye, Proj, View, VP, ext: fabricExt(aspect).map((e: number) => e * 2.0), halfVis: V.camDist * tS0 * Math.max(1 / aspect, 1) }; }
  const isSc = isLS(); const yaw = Math.sin(tO) * (isSc ? 0.35 : 0.5), pitch = (isSc ? 0.3 : 0.16) + 0.1 * Math.sin(tO * 0.71), dist = V.camDist * (isSc ? P.lsCam : 1) * (1 + 0.08 * Math.sin(tO * 0.53));
  const eye = [dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch)];
  const n = 0.05, f = 50, tS = Math.tan(V.fov * Math.PI / 360);
  let top: number, right: number; if (aspect >= 1) { top = tS * n; right = top * aspect; } else { right = tS * n; top = right / aspect; }
  const l = -right + 2 * right * subr[0], r = -right + 2 * right * subr[1], t = top - 2 * top * subr[2], b = top - 2 * top * subr[3];
  const Proj = frustum(l, r, b, t, n, f), View = lookAt(eye, [0, 0, 0], [0, 1, 0]), VP = mul(Proj, View);
  return { yaw, dist, eye, Proj, View, VP, ext: fabricExt(aspect), halfVis: V.camDist * tS * Math.max(1 / aspect, 1) };
}
// sheet extent depends only on params + aspect (not on camera dolly / tile) so sims and tiles agree
function fabricExt(aspect: number) { const tS = Math.tan(V.fov * Math.PI / 360); return [V.camDist * 1.08 * tS * Math.max(aspect, 1) * 1.75 + V.fold, V.camDist * 1.08 * tS * Math.max(1 / aspect, 1) * 1.75 + V.fold]; }
const dirOf = (az: number, el: number) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]; };
function settleAt(f: number) { const t = f * DT, r = Math.max(0.1, V.mass / V.stiffness), k = 0.5 + 2.5 * V.damping, w = 3 / Math.sqrt(r); return Math.max(0, 1 - Math.exp(-k * t) * Math.cos(w * t) * (1 - 0.6 * V.damping)); }
function setFab(u: any, ext: number[], t3: number, aspect: number) {
  gl.uniform2f(u.uExt, ext[0], ext[1]); gl.uniform1f(u.uTime, t3); gl.uniform1f(u.uFold, V.fold); gl.uniform1f(u.uWarp, V.warp);
  gl.uniform1f(u.uScale, V.scale3d); gl.uniform1f(u.uSep, V.layerSep); gl.uniform1f(u.uStretch, V.stretch); gl.uniform1i(u.uOct, P.detail); gl.uniform1i(u.uLayers, effL());
  gl.uniform3f(u.uSeedOff, hashSeed(P.seed, 1) * 200, hashSeed(P.seed, 2) * 200, hashSeed(P.seed, 3) * 200);
  gl.uniform2f(u.uAxis, aspect >= 1 ? 1 : 0, aspect >= 1 ? 0 : 1);
  const g = dirOf(V.gAz, V.gEl).map(v => v * Math.min(2, Math.max(0, V.gStrength))); gl.uniform3f(u.uGrav, g[0], g[1], g[2]);
  gl.uniform1f(u.uSag, Math.min(3, Math.max(0.1, V.mass / Math.max(0.2, V.stiffness))) * 0.9); gl.uniform1f(u.uSettle, settleAt(settleFrame));
  const tS = Math.tan(V.fov * Math.PI / 360); gl.uniform1f(u.uFloor, isLS() ? 50 : V.floor * V.camDist * tS * Math.max(1 / aspect, 1)); gl.uniform1f(u.uStiffFreq, Math.sqrt(Math.max(0.2, V.stiffness)));
  const wd = dirOf(V.windAz, 0).map(v => v * Math.min(1.5, V.wind)); gl.uniform3f(u.uWind, wd[0], wd[1], wd[2]);
}
// sub = [fx0, fx1, fy0, fy1] fraction of the full image (y from top); can exceed 0..1 for tile margins
function render3D(T: Trails, aspect: number, t3: number, tO: number, subr: number[], pxScale: number, meshMul = 1, shadowRes = P.shadowResLive, hooks: any = null) {
  const drawFab = !hooks || hooks.fabric; const clipY = hooks ? P.lsHem : -1e9;
  const C = cam3D(aspect, tO, subr); const { yaw, dist, eye, Proj, View, VP, ext } = C;
  const ratio = ext[0] / ext[1], base = P.meshRes * meshMul * (isLS() && !busy ? 0.5 : 1); ensureMesh(Math.ceil(base * Math.sqrt(ratio)), Math.ceil(base / Math.sqrt(ratio)));
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  // lights (same for every tile: depend only on params + time, never on the tile)
  const camAz = P.followCam ? yaw * 180 / Math.PI : 0; const zr = V.fold * 2 + effL() * V.layerSep + 0.5;
  const act = P.lights.filter((x: Light) => x.on && x.intensity > 0).slice(0, 4);
  const LT: number[] = [], LP: number[] = [], LC: number[] = [], LCos: number[] = [], LSh: number[] = [], LVP: number[] = [], STx: number[] = [];
  let si = 0;
  act.forEach((x: Light) => {
    const az = (x.az + camAz) * Math.PI / 180, el = x.el * Math.PI / 180; const d = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    LT.push(x.type === 'spot' ? 1 : x.type === 'point' ? 2 : 0); const p = x.type === 'directional' ? d : d.map(v => v * x.dist); LP.push(...p);
    const c = hex(x.color); LC.push(c[0] * x.intensity, c[1] * x.intensity, c[2] * x.intensity); LCos.push(Math.cos(x.cone * Math.PI / 180));
    if (x.shadow && si < 4) {
      const vp = lightVP(d, [ext[0] * 0.8, ext[1] * 0.8], zr); const m = ensureShadow(si, shadowRes);
      const t0 = performance.now();
      gl.bindFramebuffer(gl.FRAMEBUFFER, m.f); gl.viewport(0, 0, m.size, m.size); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
      if (drawFab) { setSurfVS(surfD, vp, View, 1, ext, t3, aspect); gl.uniform1f(surfD.u.uClipY, clipY); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0, effL()); }
      if (hooks?.shadow) hooks.shadow(lastLView, lastLProj, m.size);
      gl.disable(gl.POLYGON_OFFSET_FILL); shadowMsLast = performance.now() - t0;
      LSh.push(si); LVP.push(...vp); STx.push(1 / m.size); si++;
    } else LSh.push(-1);
  });
  while (LVP.length < 64) LVP.push(0); while (STx.length < 4) STx.push(0);
  const pad = (a: number[], n: number) => { while (a.length < n) a.push(0); return a; };
  // main pass -> HDR color + view pos + view normal
  const G = gbuf(T);
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.a.t, 0);
  gl.viewport(0, 0, T.w, T.h); gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 2, [0, 0, 0, 0]); gl.clearBufferfv(gl.DEPTH, 0, [1]);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  const applyL = (pr: any) => { gl.useProgram(pr.p); const u = pr.u; if (u.uView) gl.uniformMatrix4fv(u.uView, false, View);
  gl.uniform3f(u.uEye, eye[0], eye[1], eye[2]);
  gl.uniform1f(u.uGloss, V.gloss); gl.uniform1f(u.uSpec, V.spec); gl.uniform1f(u.uIrid, V.iridescence); { const mi = isW() ? WMATS.indexOf(P.wMat) : 0; gl.uniform1i(u.uMat, Math.max(0, mi)); gl.uniform1i(u.uWallPatch, P.wPatch && !P.wObj ? 1 : 0); const mc = hex(P.wColor); gl.uniform3f(u.uMatCol, mc[0], mc[1], mc[2]); gl.uniform1f(u.uWT2, t3); gl.uniform1f(u.uFurDens, P.wFurDens); gl.uniform1f(u.uRough2, P.wRough); gl.uniform1f(u.uAbsorb2, P.wAbsorb); gl.uniform1f(u.uDisp, P.wDisp); } gl.uniform1f(u.uRim, V.rim); gl.uniform1f(u.uFog, V.fog); gl.uniform1f(u.uFogStart, dist * 0.6);
  gl.uniform1f(u.uSat, V.saturation); gl.uniform1f(u.uBright, V.brightness); gl.uniform1f(u.uPalOff, V.paletteOffset); gl.uniform1f(u.uPx, pxScale); colorUniforms(u);
  gl.uniform1i(u.uNL, act.length); gl.uniform1iv(u['uLType[0]'], pad(LT, 4)); gl.uniform3fv(u['uLPos[0]'], pad(LP, 12)); gl.uniform3fv(u['uLCol[0]'], pad(LC, 12));
  gl.uniform1fv(u['uLCos[0]'], pad(LCos, 4)); gl.uniform1iv(u['uLSh[0]'], pad(LSh, 4)); gl.uniformMatrix4fv(u['uLVP[0]'], false, LVP); if (u['uShTexel[0]']) gl.uniform1fv(u['uShTexel[0]'], STx);
  gl.uniform1f(u.uShSoft, P.shadowSoft); gl.uniform1f(u.uShBias, P.shadowBias); gl.uniform1f(u.uEnvI, P.envIntensity); gl.uniform1f(u.uEnvRot, P.envRot * Math.PI / 180);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, palTex); gl.uniform1i(u.uPal, 0);
  for (let i = 0; i < 4; i++) {
    gl.activeTexture(gl.TEXTURE1 + i); gl.bindTexture(gl.TEXTURE_2D, shadowMaps[i].t); gl.bindSampler(1 + i, sCmp); gl.uniform1i(u['uSC' + i], 1 + i);
    gl.activeTexture(gl.TEXTURE5 + i); gl.bindTexture(gl.TEXTURE_2D, shadowMaps[i].t); gl.bindSampler(5 + i, sRaw); gl.uniform1i(u['uSD' + i], 5 + i);
  }
  };
  if (drawFab) { setSurfVS(surf, VP, View, 0, ext, t3, aspect); applyL(surf); gl.uniform1f(surf.u.uClipY, clipY); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0, effL());
    if (isW() && (P.wMat === 'fur' || P.wMat === 'grass')) { const ns = Math.round((P.wMat === 'grass' ? P.wShells * 1.5 : P.wShells) * (busy ? 1 : 0.55)); gl.uniform1i(surf.u.uShellN, ns); const fl = P.wMat === 'grass' ? P.wFurLen * 2.5 : P.wFurLen; gl.uniform1f(surf.u.uFurLen, fl); gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0, ns); gl.uniform1i(surf.u.uShellN, 0); } }
  if (hooks?.main) hooks.main(C, applyL, T, G, pxScale);
  for (let i = 1; i < 9; i++) { gl.bindSampler(i, null); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
  gl.activeTexture(gl.TEXTURE0); gl.disable(gl.DEPTH_TEST);
  // SSAO (contact shadows) -> blur -> multiply
  if (V.ao > 0.001) {
    gl.useProgram(ssao.p); gl.bindFramebuffer(gl.FRAMEBUFFER, G.ao1.f); gl.viewport(0, 0, T.w, T.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.pos); gl.uniform1i(ssao.u.uPos, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.nrm); gl.uniform1i(ssao.u.uNrm, 1); gl.activeTexture(gl.TEXTURE0);
    gl.uniformMatrix4fv(ssao.u.uProj, false, Proj); gl.uniform2f(ssao.u.uFull, T.w, T.h);
    gl.uniform2f(ssao.u.uPixOff, Math.round(subr[0] * 1e6), Math.round(subr[3] * 1e6)); // tile-invariant noise seed offset
    gl.uniform1f(ssao.u.uRadius, P.ssaoRadius); gl.uniform1f(ssao.u.uMaxPx, 18 * pxScale); gl.uniform1f(ssao.u.uStrength, V.ao); quad();
    gl.useProgram(blur.p); gl.uniform1i(blur.u.uT, 0);
    const k = Math.max(1, pxScale * 0.75);
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.ao2.f); gl.bindTexture(gl.TEXTURE_2D, G.ao1.t); gl.uniform2f(blur.u.uDir, k / T.w, 0); quad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.ao1.f); gl.bindTexture(gl.TEXTURE_2D, G.ao2.t); gl.uniform2f(blur.u.uDir, 0, k / T.h); quad();
    gl.useProgram(applyAO.p); gl.bindFramebuffer(gl.FRAMEBUFFER, T.b.f);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.a.t); gl.uniform1i(applyAO.u.uT, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.ao1.t); gl.uniform1i(applyAO.u.uAO, 1); gl.activeTexture(gl.TEXTURE0); quad();
    [T.a, T.b] = [T.b, T.a];
  }
}

// ---------- Particle Fabric ----------
const psim = prog(S.QUAD_VS, S.PSIM_FS), pdraw = prog(S.PDRAW_VS, S.PDRAW_FS);
type PState = { f: WebGLFramebuffer; pos: WebGLTexture; vel: WebGLTexture; uv: WebGLTexture };
let pW = 1024, pH = 1024, ps: PState[] = [];
function allocP3() {
  ps.forEach(x => { gl.deleteFramebuffer(x.f); gl.deleteTexture(x.pos); gl.deleteTexture(x.vel); gl.deleteTexture(x.uv); });
  pW = P.pCount >= 2097152 ? 2048 : Math.min(1024, Math.ceil(Math.sqrt(P.pCount))); pH = Math.ceil(P.pCount / pW);
  const mk = () => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, pW, pH); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
  ps = [0, 1].map(() => { const x = { f: gl.createFramebuffer()!, pos: mk(), vel: mk(), uv: mk() }; gl.bindFramebuffer(gl.FRAMEBUFFER, x.f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, x.pos, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, x.vel, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, x.uv, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]); return x; });
}
type Well = { on: boolean; x: number; y: number; z: number; mass: number; falloff: number; swirl: number };
const Wl = (on: boolean, x: number, y: number, z: number, mass: number, falloff: number, swirl: number): Well => ({ on, x, y, z, mass, falloff, swirl });
const WELL_PRESETS: Record<string, { blend: number; wells: Well[] }> = {
  'Twin attractors': { blend: 0.35, wells: [Wl(true, -1.3, 0.2, 0.3, 1.2, 0.35, 0.6), Wl(true, 1.4, -0.3, 0.1, 1.0, 0.35, -0.6), Wl(false, 0, 0, 0, 1, 0.4, 0), Wl(false, 0, 0, 0, 1, 0.4, 0)] },
  'Accelerator ring': { blend: 0.6, wells: [Wl(true, 0, 0, 0, 1.6, 0.5, 2.4), Wl(false, 0, 0, 0, 1, 0.4, 0), Wl(false, 0, 0, 0, 1, 0.4, 0), Wl(false, 0, 0, 0, 1, 0.4, 0)] },
  'Repel + sink': { blend: 0.45, wells: [Wl(true, 0, 0.5, 0.4, -1.2, 0.45, 0), Wl(true, 1.6, -0.8, 0, 1.4, 0.3, 1.2), Wl(true, -1.6, -0.6, 0, 1.2, 0.3, -1.0), Wl(false, 0, 0, 0, 1, 0.4, 0)] },
  'Fabric only': { blend: 0, wells: [Wl(false, 0, 0, 0, 1, 0.4, 0), Wl(false, 0, 0, 0, 1, 0.4, 0), Wl(false, 0, 0, 0, 1, 0.4, 0), Wl(false, 0, 0, 0, 1, 0.4, 0)] },
};
P.wellPreset = 'Twin attractors'; P.wells = WELL_PRESETS['Twin attractors'].wells.map(w => ({ ...w }));
function applyWellPreset(n: string) { const p = WELL_PRESETS[n]; if (!p) return; p.wells.forEach((w, i) => Object.assign(P.wells[i], w)); P.gBlend = p.blend; }
function pStep(f: number, aspect: number, t: number, init = false) {
  gl.disable(gl.BLEND); gl.useProgram(psim.p); const u = psim.u; const ext = fabricExt(aspect);
  gl.bindFramebuffer(gl.FRAMEBUFFER, ps[1].f); gl.viewport(0, 0, pW, pH);
  [ps[0].pos, ps[0].vel, ps[0].uv].forEach((tx, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx); });
  gl.uniform1i(u.uPos, 0); gl.uniform1i(u.uVel, 1); gl.uniform1i(u.uUv, 2); gl.activeTexture(gl.TEXTURE0);
  settleFrame = f; setFab(u, ext, t, aspect);
  gl.uniform1i(u.uInit, init ? 1 : 0); gl.uniform1i(u.uTexW, pW); gl.uniform1ui(u.uSeed, P.seed >>> 0); gl.uniform1ui(u.uFrame, f >>> 0); gl.uniform1f(u.uDt, DT);
  gl.uniform1f(u.uCoh, Math.max(0, V.cohesion)); gl.uniform1f(u.uBlend, Math.min(1, Math.max(0, V.gBlend))); gl.uniform1f(u.uStream, V.stream); gl.uniform1f(u.uLifeR, V.pLife);
  gl.uniform1f(u.uVmax, Math.min(20, Math.max(0.5, V.vmax))); gl.uniform1f(u.uTurb, V.pTurb); gl.uniform1f(u.uGWell, V.wellG);
  const act = P.wells.filter((w: Well) => w.on).slice(0, 4); const W4: number[] = [], WP: number[] = [];
  act.forEach((w: Well) => { W4.push(w.x, w.y, w.z, Math.max(-5, Math.min(5, w.mass))); WP.push(Math.max(0.05, w.falloff), w.swirl); });
  while (W4.length < 16) W4.push(0); while (WP.length < 8) WP.push(0);
  gl.uniform1i(u.uNW, act.length); gl.uniform4fv(u['uW[0]'], W4); gl.uniform2fv(u['uWP[0]'], WP); gl.uniform3f(u.uBound, ext[0] * 1.3, ext[1] * 1.3, 5);
  quad(); ps.reverse();
}
function pDraw(T: Trails, C: any, pxScale: number, clear: boolean) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, T.a.f); gl.viewport(0, 0, T.w, T.h); if (clear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(pdraw.p); const u = pdraw.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ps[0].pos); gl.uniform1i(u.uPos, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ps[0].vel); gl.uniform1i(u.uVel, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, palTex); gl.uniform1i(u.uPal, 2); gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u.uTexW, pW); gl.uniformMatrix4fv(u.uVP, false, C.VP); gl.uniformMatrix4fv(u.uView, false, C.View); gl.uniform2f(u.uRes, T.w, T.h);
  gl.uniform1f(u.uW, V.pWidth); gl.uniform1f(u.uStreak, V.streak); gl.uniform1f(u.uGain, V.pGain * Math.pow(1048576 / P.pCount, 0.6) * 40);
  gl.uniform1f(u.uSpeedMix, V.pColorBySpeed); gl.uniform1f(u.uPalOff, V.paletteOffset); gl.uniform1f(u.uFog, V.fog); gl.uniform1f(u.uFogStart, C.dist * 0.6);
  gl.uniform1f(u.uFocus, C.dist); gl.uniform1f(u.uDof, V.dof * 6); gl.uniform1f(u.uPx, pxScale); gl.uniform3f(u.uEye, C.eye[0], C.eye[1], C.eye[2]);
  gl.drawArrays(gl.TRIANGLES, 0, P.pCount * 6); gl.disable(gl.BLEND);
}
// fabric (optional, faint) + particles into T.a
function renderParticleScene(T: Trails, aspect: number, t3v: number, tO: number, subr: number[], pxScale: number, meshMul = 1, shRes = P.shadowResLive) {
  const C = cam3D(aspect, tO, subr);
  if (V.fabricUnder > 0.001) {
    render3D(T, aspect, t3v, tO, subr, pxScale, meshMul, shRes);
    gl.disable(gl.BLEND); gl.useProgram(fade.p); gl.bindFramebuffer(gl.FRAMEBUFFER, T.b.f); gl.viewport(0, 0, T.w, T.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.a.t); gl.uniform1i(fade.u.uT, 0); gl.uniform1f(fade.u.uDecay, V.fabricUnder); quad(); [T.a, T.b] = [T.b, T.a];
    pDraw(T, C, pxScale, false);
  } else pDraw(T, C, pxScale, true);
}

// ---------- Liquid Spheres ----------
const sPred = prog(S.QUAD_VS, S.SPRED_FS), sGrid = prog(S.SGRID_VS, S.SGRID_FS), sSolve = prog(S.QUAD_VS, S.SSOLVE_FS), sphereP = prog(S.SPHERE_VS, S.SPHERE_FS),
  floorP = prog(S.FLOOR_VS, S.FLOOR_FS), fblurP = prog(S.QUAD_VS, S.FBLUR_FS), fluidP = prog(S.QUAD_VS, S.FLUID_FS);
let sW = 512, sH = 256, ss: PState[] = [], sXp: FB | undefined; let sN = 0;
function mk3(w: number, h: number): PState {
  const mk = () => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
  const x = { f: gl.createFramebuffer()!, pos: mk(), vel: mk(), uv: mk() }; gl.bindFramebuffer(gl.FRAMEBUFFER, x.f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, x.pos, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, x.vel, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, x.uv, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]); return x;
}
function allocS() {
  ss.forEach(x => { gl.deleteFramebuffer(x.f); gl.deleteTexture(x.pos); gl.deleteTexture(x.vel); gl.deleteTexture(x.uv); }); del(sXp);
  sN = P.lsCount; sW = Math.min(1024, Math.ceil(Math.sqrt(sN))); sH = Math.ceil(sN / sW); ss = [mk3(sW, sH), mk3(sW, sH)]; sXp = stateFB(sW, sH);
}
let grid: any = null;
function gridSetup() {
  let cell = 2 * P.lsRadius * (1 + P.lsRand) * 1.02; const ymin = P.lsFloor - 0.1, ymax = 2.4;
  let GX = 0, GY = 0, GZ = 0, tilesX = 1, w = 0, h = 0;
  for (let it = 0; it < 8; it++) {
    GX = Math.ceil(2 * P.lsBoxX / cell) + 2; GY = Math.ceil((ymax - ymin) / cell) + 1; GZ = Math.ceil(2 * P.lsBoxZ / cell) + 2;
    tilesX = Math.max(1, Math.floor(4096 / GX)); w = GX * Math.min(tilesX, GZ); h = GY * Math.ceil(GZ / tilesX); if (h <= 4096) break; cell *= 1.25;
  }
  const key = `${w}x${h}`;
  if (!grid || grid.key !== key) {
    if (grid) { grid.tex.forEach((t: any) => gl.deleteTexture(t)); grid.fb.forEach((f: any) => gl.deleteFramebuffer(f)); gl.deleteRenderbuffer(grid.depth); }
    const depth = gl.createRenderbuffer()!; gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    const tex: WebGLTexture[] = [], fb: WebGLFramebuffer[] = [];
    for (let k = 0; k < 4; k++) { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth); tex.push(t); fb.push(f); }
    grid = { key, tex, fb, depth };
  }
  Object.assign(grid, { w, h, cell, GX, GY, GZ, tilesX, gmin: [-P.lsBoxX - cell, ymin, -P.lsBoxZ - cell] });
}
function sCommon(u: any, dt: number, tNow: number) {
  gl.uniform1i(u.uTexW, sW); gl.uniform1i(u.uN, sN); gl.uniform1f(u.uR, P.lsRadius); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uTNow, tNow);
  gl.uniform3f(u.uGMin, grid.gmin[0], grid.gmin[1], grid.gmin[2]); gl.uniform1f(u.uCell, grid.cell); gl.uniform3i(u.uGDim, grid.GX, grid.GY, grid.GZ); gl.uniform1i(u.uTilesX, grid.tilesX);
}
const bindTex = (unit: number, t: WebGLTexture, loc: any) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
let sNowT = 0;
function sStep(f: number, aspect: number, t: number, init = false) {
  gridSetup(); const ext = fabricExt(aspect); settleFrame = f; gl.disable(gl.BLEND);
  const sub = Math.max(1, Math.min(4, Math.round(P.lsSub))), dt = DT / sub;
  const span = sN / Math.max(100, P.lsDrip);
  if (init) { gl.useProgram(sSolve.p); setFab(sSolve.u, ext, t, aspect); { const Cc = cam3D(aspect, tOrbit, [0, 1, 0, 1]); gl.uniformMatrix4fv(sSolve.u.uCamVP, false, Cc.VP); gl.uniform3f(sSolve.u.uCamEye, Cc.eye[0], Cc.eye[1], Cc.eye[2]); } sCommon(sSolve.u, dt, 0); gl.uniform1i(sSolve.u.uInit, 1); gl.uniform1ui(sSolve.u.uSeed, P.seed >>> 0);
    gl.uniform1f(sSolve.u.uRand, Math.min(0.8, Math.max(0, P.lsRand))); gl.uniform1f(sSolve.u.uSpan, span);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ss[0].f); gl.viewport(0, 0, sW, sH); quad(); return; }
  const g = dirOf(V.gAz, V.gEl).map(v => v * 6 * Math.min(2, Math.max(0, V.gStrength)));
  for (let s = 0; s < sub; s++) {
    const tNow = (f + s / sub) * DT; sNowT = tNow;
    gl.useProgram(sPred.p); setFab(sPred.u, ext, t, aspect); sCommon(sPred.u, dt, tNow); gl.uniform3f(sPred.u.uG, g[0], g[1], g[2]);
    bindTex(0, ss[0].pos, sPred.u.uPos); bindTex(1, ss[0].vel, sPred.u.uVel); bindTex(2, ss[0].uv, sPred.u.uAux);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sXp!.f); gl.viewport(0, 0, sW, sH); quad();
    gl.useProgram(sGrid.p); sCommon(sGrid.u, dt, tNow); gl.uniform2f(sGrid.u.uGridRes, grid.w, grid.h); bindTex(0, sXp!.t, sGrid.u.uXp);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    for (let k = 0; k < 4; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, grid.fb[k]); gl.viewport(0, 0, grid.w, grid.h); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1i(sGrid.u.uLayer, k); bindTex(1, grid.tex[Math.max(0, k - 1)], sGrid.u.uPrev); if (k === 0) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, grid.tex[3]); }
      gl.drawArrays(gl.POINTS, 0, sN);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(sSolve.p); const u = sSolve.u; setFab(u, ext, t, aspect); sCommon(u, dt, tNow); gl.uniform1i(u.uInit, 0); gl.uniform1ui(u.uSeed, P.seed >>> 0);
    gl.uniform1f(u.uRand, P.lsRand); gl.uniform1f(u.uSpan, span); gl.uniform1f(u.uCoh, Math.min(1, Math.max(0, P.lsCoh))); gl.uniform1f(u.uCohR, Math.min(0.8, Math.max(0.05, P.lsCohR)));
    gl.uniform1f(u.uVisc, Math.min(0.5, Math.max(0, P.lsVisc))); gl.uniform1f(u.uBounce, Math.min(0.9, Math.max(0, P.lsBounce))); gl.uniform1f(u.uFric, Math.min(1, Math.max(0, P.lsFric)));
    gl.uniform1f(u.uDamp, Math.min(5, Math.max(0, P.lsDamp))); gl.uniform1f(u.uTurn, Math.max(0, P.lsTurn)); gl.uniform1f(u.uFloorY, P.lsFloor); gl.uniform2f(u.uBox, P.lsTank ? P.lsBoxX : 1e4, P.lsTank ? P.lsBoxZ : 1e4); gl.uniform1f(u.uSlide, P.lsSlide); gl.uniform1f(u.uDripPer, 1200 / Math.max(30, P.lsDrip)); gl.uniform1f(u.uDripLen, P.lsDripLen); gl.uniform1f(u.uDripAmt, P.lsDripAmt); gl.uniform1f(u.uFlowOn, P.lsFlow ? 1 : 0); gl.uniform1f(u.uDetach, P.lsDetach ? 1 : 0); gl.uniform2f(u.uFlowV, P.lsFlowU, P.lsFlowV); gl.uniform3f(u.uGv, g[0], g[1], g[2]);
    bindTex(0, ss[0].pos, u.uPos); bindTex(1, ss[0].vel, u.uVel); bindTex(2, ss[0].uv, u.uAux); bindTex(3, sXp!.t, u.uXp);
    for (let k = 0; k < 4; k++) bindTex(4 + k, grid.tex[k], u['uG' + k]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ss[1].f); gl.viewport(0, 0, sW, sH); quad(); ss.reverse();
  }
  gl.activeTexture(gl.TEXTURE0);
}
function invRigid(m: number[]) { // inverse of a rotation+translation view matrix (column-major)
  const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1]; const t = [m[12], m[13], m[14]];
  r[12] = -(r[0] * t[0] + r[4] * t[1] + r[8] * t[2]); r[13] = -(r[1] * t[0] + r[5] * t[1] + r[9] * t[2]); r[14] = -(r[2] * t[0] + r[6] * t[1] + r[10] * t[2]); return r;
}
function sphereUniforms(u: any, VPm: number[], Vm: number[], Pm: number[], w: number, h: number, mode: number, inflate = 1) {
  gl.uniform1i(u.uSTexW, sW); gl.uniform1f(u.uSR, P.lsRadius); gl.uniform1f(u.uInflate, inflate); gl.uniformMatrix4fv(u.uSVP, false, VPm); gl.uniformMatrix4fv(u.uSV, false, Vm); gl.uniformMatrix4fv(u.uSProj, false, Pm);
  gl.uniform2f(u.uSRes, w, h); gl.uniform1f(u.uSTime, sNowT); gl.uniform1i(u.uSMode, mode); gl.uniform1f(u.uSPalOff, V.paletteOffset); gl.uniform1f(u.uSSpeedMix, V.colorBySpeed);
  bindTex(9, ss[0].pos, u.uSPos); bindTex(10, ss[0].vel, u.uSVel); bindTex(11, ss[0].uv, u.uSAux); bindTex(12, palTex, u.uPal2); colorUniforms(u); gl.uniform1i(u.uPrim, Math.max(0, PRIMS.indexOf(P.lsPrim))); gl.uniform1f(u.uRotRand, P.lsRotRand); gl.uniform1f(u.uSizeRand, P.lsSizeRand); gl.uniform1f(u.uSSSS, P.lsSSS);
  if (u.uSInvV) gl.uniformMatrix4fv(u.uSInvV, false, invRigid(Vm)); gl.uniform1f(u.uSSat, V.saturation); gl.uniform1f(u.uSBright, V.brightness * 1.3 * P.lsGain);
}
function fluidBufs(T: any) {
  if (!T.fl) { const d = depthRB(T.w, T.h); const z = hdrFB(T.w, T.h), z2 = hdrFB(T.w, T.h), th = hdrFB(T.w, T.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, z.f); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d); T.fl = { d, z, z2, th }; }
  return T.fl;
}
const sphereHooks = {
  get fabric() { return P.lsFabric; },
  shadow(LV: number[], LP: number[], size: number) {
    if (isW() && !P.wObj) return; gl.useProgram(sphereP.p); sphereUniforms(sphereP.u, mul(LP, LV), LV, LP, size, size, 1); gl.drawArrays(gl.POINTS, 0, sN); gl.activeTexture(gl.TEXTURE0);
  },
  main(C: any, applyL: any, T: any, G: any, pxScale: number) {
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    if (P.lsFloorOn && (!isW() || P.wcDist > 6)) { applyL(floorP); const u = floorP.u; gl.uniformMatrix4fv(u.uFVP, false, C.VP); gl.uniformMatrix4fv(u.uFV, false, C.View); gl.uniform1f(u.uFY, P.lsFloor); gl.uniform1f(u.uFS, 14);
      const fc = hex(P.lsFloorCol); gl.uniform3f(u.uFCol, fc[0], fc[1], fc[2]); gl.uniform1f(u.uFRough, Math.min(1, Math.max(0.04, P.lsFloorRough))); gl.drawArrays(gl.TRIANGLES, 0, 6); }
    if (isW() && !P.wObj) return;
    if (P.lsStyle === 'Beads' || isW()) { applyL(sphereP); gl.useProgram(sphereP.p); gl.uniform1i(sphereP.u.uObjMat, isW() ? OMATS.indexOf(P.wObjMat) : 0); sphereUniforms(sphereP.u, C.VP, C.View, C.Proj, T.w, T.h, 0); gl.drawArrays(gl.POINTS, 0, sN); }
    else {
      const F = fluidBufs(T);
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.z.f); gl.viewport(0, 0, T.w, T.h); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(sphereP.p); sphereUniforms(sphereP.u, C.VP, C.View, C.Proj, T.w, T.h, 2, P.lsInflate); gl.drawArrays(gl.POINTS, 0, sN);
      gl.disable(gl.DEPTH_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, F.th.f); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform1i(sphereP.u.uSMode, 3); gl.drawArrays(gl.POINTS, 0, sN); gl.disable(gl.BLEND);
      gl.useProgram(fblurP.p); gl.uniform1i(fblurP.u.uT, 0); gl.activeTexture(gl.TEXTURE0); gl.uniform1f(fblurP.u.uRange, P.lsRadius * 3);
      const k = Math.max(1, pxScale) * 1.2;
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.z2.f); gl.bindTexture(gl.TEXTURE_2D, F.z.t); gl.uniform2f(fblurP.u.uDir, k / T.w, 0); quad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.z.f); gl.bindTexture(gl.TEXTURE_2D, F.z2.t); gl.uniform2f(fblurP.u.uDir, 0, k / T.h); quad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, G.f); gl.viewport(0, 0, T.w, T.h); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      applyL(fluidP); const u = fluidP.u; bindTex(9, F.z.t, u.uFZ); bindTex(10, F.th.t, u.uFT); gl.uniformMatrix4fv(u.uFProj, false, C.Proj); gl.uniformMatrix4fv(u.uFInvV, false, invRigid(C.View));
      gl.uniform2f(u.uFRes, T.w, T.h); gl.uniform1f(u.uAbsorb, P.lsAbsorb); gl.uniform1f(u.uFSat, V.saturation); quad();
    }
    gl.activeTexture(gl.TEXTURE0);
  },
};

// ---------- preview ----------
let frame = 0, trails: Trails | undefined, frameRect = [0, 0, 1, 1], previewAspect = 16 / 9;
let tSim = 0, off2d = [0, 0], t3 = 0, tOrbit = 0;
function layout() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr);
  const cw = canvas.width, ch = canvas.height;
  previewAspect = Math.min(8, Math.max(1 / 8, P.frameToExport && P.width > 0 && P.height > 0 ? P.width / P.height : cw / ch));
  let w = cw, h = Math.round(cw / previewAspect); if (h > ch) { h = ch; w = Math.round(ch * previewAspect); }
  w = Math.max(64, w); h = Math.max(64, h);
  frameRect = [Math.floor((cw - w) / 2), Math.floor((ch - h) / 2), w, h];
  freeTrails(trails); trails = makeTrails(w, h);
}
function reset() { allocState(); allocP3(); layout(); frame = 0; tSim = 0; off2d = [0, 0]; t3 = 0; tOrbit = 0; simStep(0, worldHalf(previewAspect), true); settleFrame = 0; pStep(0, previewAspect, 0, true); allocS(); sStep(0, previewAspect, 0, true); }
let fpsAcc = 0, fpsN = 0, fps = 0, last = performance.now(), busy = false;
const POPT = location.search.includes("test=pop"); let popPrev: Float32Array | null = null; const popStat: any = { logged: 0, frames: 0, maxJump: 0, faded: 0, hidden: 0, jumps: 0 };
function popProbe() { if (!isLS() || !ss) return; const n = sW * sH; const pos = new Float32Array(n * 4), vel = new Float32Array(n * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, ss[0].f); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, sW, sH, gl.RGBA, gl.FLOAT, pos); gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.readPixels(0, 0, sW, sH, gl.RGBA, gl.FLOAT, vel); gl.readBuffer(gl.COLOR_ATTACHMENT0);
  let faded = 0, jumps = 0, mj = 0; const tN = frame * DT;
  for (let i = 0; i < sN; i++) { const fin = Math.min(1, Math.max(0, (tN - vel[i * 4]) / 0.3)) * (1 - vel[i * 4 + 1]); if (fin < 0.999) faded++;
    if (popPrev) { const d = Math.hypot(pos[i * 4] - popPrev[i * 4], pos[i * 4 + 1] - popPrev[i * 4 + 1], pos[i * 4 + 2] - popPrev[i * 4 + 2]); if (d > mj) mj = d; if (d > P.lsRadius * 1.5) jumps++; } }
  if (jumps > 0 && popStat.frames % 1 === 0 && (popStat as any).logged < 12) { (popStat as any).logged++; let ex = ''; for (let i = 0; i < sN && ex.length < 200; i++) { const d = popPrev ? Math.hypot(pos[i*4]-popPrev[i*4], pos[i*4+1]-popPrev[i*4+1], pos[i*4+2]-popPrev[i*4+2]) : 0; if (d > P.lsRadius * 1.5) ex += ` #${i} d=${d.toFixed(3)} y=${pos[i*4+1].toFixed(2)} s=${vel[i*4+2].toFixed(2)}`; } log(`POPJUMP f=${popStat.frames} n=${jumps}${ex}`); }
  if (mj > 0.2) { let bi = -1, bd = 0; for (let i = 0; i < sN; i++) { const d = popPrev ? Math.hypot(pos[i*4]-popPrev[i*4], pos[i*4+1]-popPrev[i*4+1], pos[i*4+2]-popPrev[i*4+2]) : 0; if (d > bd) { bd = d; bi = i; } } log(`POPBIG f=${popStat.frames} #${bi} d=${bd.toFixed(3)} s=${vel[bi*4+2].toFixed(2)} hw=${(pos[bi*4+3]/0.45).toFixed(2)} prevhw=${popPrev ? (popPrev[bi*4+3]/0.45).toFixed(2) : ''} y=${pos[bi*4+1].toFixed(2)}`); }
  popPrev = pos; popStat.frames++; popStat.maxJump = Math.max(popStat.maxJump, mj); popStat.faded = Math.max(popStat.faded, faded); popStat.jumps += jumps; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (popStat.frames === 300) log(`POPTEST frames=300 beads=${sN} maxFadedOrRamping=${popStat.faded} maxPerFrameMove=${popStat.maxJump.toFixed(4)} jumpEvents(>1.5r)=${popStat.jumps}`); }
function tick(now: number) {
  requestAnimationFrame(tick); if (busy || gl.isContextLost()) return;
  const dt = now - last; last = now; fpsAcc += dt; fpsN++; if (fpsAcc > 500) { fps = 1000 * fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  easeParams(); V = L; curAspect = previewAspect;
  const half = worldHalf(previewAspect);
  const T = trails!; const px = Math.min(T.w, T.h) / 1080;
  if (P.mode === 'Grass Field') {
    if (!P.paused) frame++; renderGrass(T, previewAspect, frame * DT, [0, 1, 0, 1], px);
  } else if (P.mode === '3D fabric') {
    if (!P.paused) { t3 += DT * V.evolution3d; tOrbit += DT * V.orbitSpeed; frame++; }
    settleFrame = frame; render3D(T, previewAspect, t3, tOrbit, [0, 1, 0, 1], px);
  } else if (isLS()) {
    if (!P.paused) { if (!isW() || P.wObj) sStep(frame, previewAspect, t3); if (POPT && popStat.frames < 300) popProbe(); t3 += DT * V.evolution3d; tOrbit += DT * V.orbitSpeed; frame++; }
    settleFrame = frame; render3D(T, previewAspect, t3, tOrbit, [0, 1, 0, 1], px, 1, P.shadowResLive, sphereHooks);
  } else if (P.mode === 'Particle Fabric') {
    if (!P.paused) { pStep(frame, previewAspect, t3); t3 += DT * V.evolution3d; tOrbit += DT * V.orbitSpeed; frame++; }
    settleFrame = frame; renderParticleScene(T, previewAspect, t3, tOrbit, [0, 1, 0, 1], px);
  } else if (!P.paused) {
    tSim += DT * V.evolution; off2d = [off2d[0] + V.driftX * DT, off2d[1] + V.driftY * DT];
    simStep(frame, half, false, tSim, off2d); trailStep(T, [0, 0], [half[0] / V.zoom, half[1] / V.zoom], px); frame++;
  }
  bloomPass(T, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 1); gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT);
  composite(T, [-frameRect[0], -frameRect[1]], frameRect);
  const what = isLS() ? `Liquid Spheres ${(sN / 1000).toFixed(0)}K ${P.lsStyle} · ${P.lightPreset}` : P.mode === 'Particle Fabric' ? `Particle Fabric ${(P.pCount / 1e6).toFixed(2)}M · ${P.wellPreset} · blend ${P.gBlend.toFixed(2)}` : P.mode === '3D fabric' ? `3D fabric ${mesh.rx}×${mesh.ry}×${P.layers} layers · ${P.lightPreset} · shadow ${P.shadowResLive}` : `${(P.particles / 1e6).toFixed(2)}M particles`;
  hud.textContent = `${fps.toFixed(1)} fps  ·  ${what}  ·  frame ${frame}  ·  seed ${P.seed}\npreview ${T.w}×${T.h}  ·  export ${P.width}×${P.height} ${P.orientation}${busy ? '  ·  RENDERING' : ''}${recoverMsg ? '  ·  ' + recoverMsg : ''}`;
}
function log(m: string) { fetch('/api/log', { method: 'POST', body: m }).catch(() => { }); }
setInterval(() => !busy && log(`fps=${fps.toFixed(1)} mode=${P.mode} particles=${isLS() ? sN : P.mode === 'Particle Fabric' ? P.pCount : P.particles} style=${P.lsStyle} fabric=${P.lsFabric} mesh=${mesh.rx}x${mesh.ry}x${P.layers} preview=${trails?.w}x${trails?.h} frame=${frame}`), 3000);


// ---------- Grass Field mode ----------
const G_LIGHTS: Record<string, any> = {
  'Golden hour': { az: 235, el: 11, sun: [3.2, 1.9, 0.9], sky: [0.35, 0.45, 0.65], gnd: [0.25, 0.2, 0.12], haze: [0.95, 0.72, 0.5], hd: 0.035, soft: 1.5 },
  'Overcast': { az: 200, el: 55, sun: [0.55, 0.57, 0.6], sky: [0.8, 0.83, 0.88], gnd: [0.3, 0.3, 0.27], haze: [0.72, 0.74, 0.77], hd: 0.045, soft: 4 },
  'Noon': { az: 160, el: 70, sun: [3.4, 3.25, 3.0], sky: [0.35, 0.55, 0.95], gnd: [0.25, 0.24, 0.18], haze: [0.7, 0.8, 0.95], hd: 0.02, soft: 1 },
  'Backlit dusk': { az: 'back', el: 6, sun: [3.0, 1.25, 0.6], sky: [0.25, 0.22, 0.42], gnd: [0.12, 0.08, 0.1], haze: [0.85, 0.47, 0.42], hd: 0.04, soft: 1.5 } };
const G_VIEWS: Record<string, any> = {
  'Ground level': { pitch: 4, dist: 1.6, height: 0.18, fov: 55 }, 'Eye level': { pitch: 10, dist: 4.5, height: 0.9, fov: 45 },
  'High angle': { pitch: 38, dist: 6, height: 0, fov: 45 }, 'Top down': { pitch: 89, dist: 5.5, height: 0, fov: 45 }, 'Close-up': { pitch: 12, dist: 0.7, height: 0.15, fov: 35 } };
let gLightState = { ...G_LIGHTS['Golden hour'] };
function applyGLight(name: string) { const p = G_LIGHTS[name]; if (!p) return; gLightState = { ...p }; P.gSunAz = p.az === 'back' ? (P.gcYaw + 180) % 360 : p.az; P.gSunEl = p.el; P.gShSoft = p.soft; }
function applyGView(name: string) { const v = G_VIEWS[name]; if (!v) return; Object.assign(P, { gcPitch: v.pitch, gcDist: v.dist, gcHeight: v.height, gcFov: v.fov, gcPanX: 0, gcPanZ: 0 }); }
const ghJ = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const gvnJ = (x: number, y: number) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = ghJ(ix, iy), b = ghJ(ix + 1, iy), c = ghJ(ix, iy + 1), d = ghJ(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const hgtJ = (x: number, z: number, tt: number) => P.gTerrA * (Math.sin(x * .33 + tt * .12) * .55 + Math.sin(z * .26 - tt * .09 + 1.3) * .5 + Math.sin((x + z) * .55 + tt * .17) * .22 + (gvnJ(x * .4, z * .4) - .5) * .5);
function gCam(aspect: number, tt: number, subr: number[]) {
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  P.gcDist = clamp(P.gcDist, 0.3, 7); P.gcPitch = clamp(P.gcPitch, -2, 89); P.gcPanX = clamp(P.gcPanX, -3, 3); P.gcPanZ = clamp(P.gcPanZ, -3, 3); P.gcHeight = clamp(P.gcHeight, 0, 3); P.gcFov = clamp(P.gcFov, 15, 90);
  const yaw = (P.gcYaw + (P.gcAuto ? P.gcAutoSpd * tt : 0)) * Math.PI / 180, pitch = P.gcPitch * Math.PI / 180;
  const tg = [P.gcPanX, hgtJ(P.gcPanX, P.gcPanZ, tt) + P.gcHeight, P.gcPanZ];
  const eye = [tg[0] + P.gcDist * Math.cos(pitch) * Math.sin(yaw), tg[1] + P.gcDist * Math.sin(pitch), tg[2] + P.gcDist * Math.cos(pitch) * Math.cos(yaw)];
  eye[1] = Math.max(eye[1], hgtJ(eye[0], eye[2], tt) + 0.06);
  const up = P.gcPitch > 85 ? [-Math.sin(yaw), 0, -Math.cos(yaw)] : [0, 1, 0];
  const View = lookAt(eye, tg, up); const n = 0.02, f = 150, top = n * Math.tan(P.gcFov * Math.PI / 360), right = top * aspect;
  const l = -right + 2 * right * subr[0], r = -right + 2 * right * subr[1], tp = top - 2 * top * subr[2], b = top - 2 * top * subr[3];
  const Proj = frustum(l, r, b, tp, n, f); return { eye, View, Proj, VP: mul(Proj, View), yaw };
}
const gBlade = prog(GS.BLADE_VS, GS.BLADE_FS), gBladeSh = prog(GS.BLADE_VS, GS.DEPTHONLY_FS), gGround = prog(GS.GROUND_VS, GS.GROUND_FS), gGroundSh = prog(GS.GROUND_VS, GS.DEPTHONLY_FS), gSky = prog(GS.SKY_VS, GS.SKY_FS);
let gSh: any = null, gMS: any = null;
function gShadowFB(n: number) { if (gSh && gSh.n === n) return gSh; if (gSh) { gl.deleteTexture(gSh.t); gl.deleteFramebuffer(gSh.f); }
  const tx = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tx); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, n, n);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tx, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  gSh = { n, t: tx, f }; return gSh; }
function gMSFB(w: number, h: number) { if (gMS && gMS.w === w && gMS.h === h) return gMS; if (gMS) { gl.deleteRenderbuffer(gMS.c); gl.deleteRenderbuffer(gMS.d); gl.deleteFramebuffer(gMS.f); }
  const s = Math.min(4, gl.getParameter(gl.MAX_SAMPLES)); const c = gl.createRenderbuffer()!, d = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, gl.RGBA16F, w, h);
  gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, gl.DEPTH_COMPONENT24, w, h);
  const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
  gMS = { w, h, c, d, f }; return gMS; }
function renderGrass(T: Trails, aspect: number, tt: number, subr: number[], pxScale: number, shRes = P.gShRes) {
  const C = gCam(aspect, tt, subr); const L0 = gLightState; const az = P.gSunAz * Math.PI / 180, el = P.gSunEl * Math.PI / 180;
  const sd = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  const R = P.gR, ext = R + 1.5; const LV = lookAt([sd[0] * 30, sd[1] * 30, sd[2] * 30], [0, 0, 0], Math.abs(sd[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0]); const LP = ortho(-ext, ext, -ext, ext, 1, 70); const LVP = mul(LP, LV);
  const GN = Math.max(64, Math.min(768, Math.round(P.gDensity))), seg = Math.max(2, Math.min(8, Math.round(P.gSeg)));
  const wa = P.gWindAz * Math.PI / 180;
  const common = (u: any) => { gl.uniform1f(u.uT, tt); gl.uniform1f(u.uTerrA, P.gTerrA); gl.uniform1f(u.uWind, P.gWind); gl.uniform1f(u.uGustK, P.gGustK); gl.uniform1f(u.uGustSpeed, P.gGustSpeed); gl.uniform1f(u.uFlutter, P.gFlutter); gl.uniform2f(u.uWindDir, Math.sin(wa), Math.cos(wa)); };
  const blade = (pr: any, VP: number[]) => { const u = pr.u; gl.useProgram(pr.p); common(u); gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform1i(u.uGN, GN); gl.uniform1i(u.uSeg, seg); gl.uniform1f(u.uGR, R);
    gl.uniform1f(u.uH, P.gH); gl.uniform1f(u.uHR, P.gHR); gl.uniform1f(u.uBW, P.gW); gl.uniform1f(u.uCurv, P.gCurv); gl.uniform1f(u.uStiff, P.gStiff); gl.uniform1f(u.uLean, P.gLean); gl.uniform1f(u.uTwist, P.gTwist); gl.uniform1f(u.uClump, P.gClump); };
  const GRES = 160, GEXT = 45;
  const ground = (pr: any, VP: number[]) => { const u = pr.u; gl.useProgram(pr.p); common(u); gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform1i(u.uGRes, GRES); gl.uniform1f(u.uGExt, GEXT); };
  // shadow pass
  const sh = gShadowFB(shRes); gl.bindFramebuffer(gl.FRAMEBUFFER, sh.f); gl.viewport(0, 0, sh.n, sh.n); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2);
  ground(gGroundSh, LVP); gl.drawArrays(gl.TRIANGLES, 0, GRES * GRES * 6);
  if (P.gOn) { blade(gBladeSh, LVP); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * (seg + 1), GN * GN); }
  gl.disable(gl.POLYGON_OFFSET_FILL);
  // main pass (4x MSAA, resolved into T.a)
  const ms = gMSFB(T.w, T.h); gl.bindFramebuffer(gl.FRAMEBUFFER, ms.f); gl.viewport(0, 0, T.w, T.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const sI = P.gSunI, kI = P.gSkyI; const sun = L0.sun.map((v: number) => v * sI), sky = L0.sky.map((v: number) => v * kI), gnd = L0.gnd.map((v: number) => v * kI), hz = L0.haze.map((v: number) => v * kI);
  const lightU = (u: any) => { gl.uniform3f(u.uEye, C.eye[0], C.eye[1], C.eye[2]); gl.uniform3f(u.uSunDir, sd[0], sd[1], sd[2]); gl.uniform3fv(u.uSunCol, sun); gl.uniform3fv(u.uSkyCol, sky); gl.uniform3fv(u.uGndCol, gnd); gl.uniform3fv(u.uHazeCol, hz);
    gl.uniform1f(u.uHaze, L0.hd * P.gHaze); gl.uniform1f(u.uShSoft, P.gShSoft); gl.uniform1f(u.uShTex, 1 / sh.n); gl.uniform1f(u.uAOMin, P.gAO); gl.uniform1f(u.uTrans, P.gTrans); gl.uniform1f(u.uSpec, P.gSpec); gl.uniform1f(u.uSpecP, 60);
    gl.uniformMatrix4fv(u.uLVP, false, LVP); gl.activeTexture(gl.TEXTURE14); gl.bindSampler(14, null); gl.bindTexture(gl.TEXTURE_2D, sh.t); gl.uniform1i(u.uShadow, 14); colorUniforms(u); };
  gl.disable(gl.DEPTH_TEST); gl.useProgram(gSky.p); { const u = gSky.u; gl.uniformMatrix4fv(u.uInvVP, false, inv4(C.VP)); gl.uniform3f(u.uEye, C.eye[0], C.eye[1], C.eye[2]); gl.uniform3f(u.uSunDir, sd[0], sd[1], sd[2]); gl.uniform3fv(u.uSunCol, sun); gl.uniform3fv(u.uSkyCol, sky); gl.uniform3fv(u.uHazeCol, hz); } quad();
  gl.enable(gl.DEPTH_TEST);
  ground(gGround, C.VP); lightU(gGround.u); { const u = gGround.u; gl.uniform1i(u.uGrassOn, P.gOn ? 1 : 0); gl.uniform1f(u.uGR, R); const so = hex(P.gSoil), gt = hex(P.gTip), gb = hex(P.gBase).map((v, i) => Math.pow(v * 0.45 + gt[i] * 0.55, 2.2)); gl.uniform3f(u.uSoil, Math.pow(so[0], 2.2), Math.pow(so[1], 2.2), Math.pow(so[2], 2.2)); gl.uniform3f(u.uGBase, gb[0] * .85, gb[1] * .85, gb[2] * .85); }
  gl.drawArrays(gl.TRIANGLES, 0, GRES * GRES * 6);
  if (P.gOn) { blade(gBlade, C.VP); lightU(gBlade.u); const u = gBlade.u; gl.uniform1i(u.uGrassColor, P.gColor === 'patchwork' ? 1 : 0); gl.uniform1f(u.uColRand, P.gColRand); gl.uniform1f(u.uDry, P.gDry);
    const lin = (h: string) => hex(h).map(v => Math.pow(v, 2.2)); gl.uniform3fv(u.uGBase, lin(P.gBase)); gl.uniform3fv(u.uGTip, lin(P.gTip)); gl.uniform3fv(u.uGDry, lin(P.gDryC));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * (seg + 1), GN * GN); }
  gl.disable(gl.DEPTH_TEST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, ms.f); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.a.f); gl.blitFramebuffer(0, 0, T.w, T.h, 0, 0, T.w, T.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
}
function inv4(m: number[]) { const a = m, o = new Array(16); const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; det = 1 / (det || 1e-12);
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det; return o; }
// mouse camera (Grass mode only): drag = orbit, wheel = zoom, right/shift-drag = pan
{ let drag: any = null; canvas.addEventListener('contextmenu', e => { if (P.mode === 'Grass Field' || isW()) e.preventDefault(); });
  canvas.addEventListener('pointerdown', e => { if (P.mode !== 'Grass Field' && !isW()) return; drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (isW()) { if (drag.pan) { P.wcPanX -= dx * P.wcDist * 0.0012; P.wcPanY += dy * P.wcDist * 0.0012; } else { P.wcYaw -= dx * 0.2; P.wcPitch += dy * 0.15; } wClamp(); }
    else if (drag.pan) { const y = P.gcYaw * Math.PI / 180, k = P.gcDist * 0.0015; P.gcPanX -= (Math.cos(y) * dx - Math.sin(y) * dy) * k; P.gcPanZ -= (-Math.sin(y) * dx - Math.cos(y) * dy) * k; }
    else { P.gcYaw = ((P.gcYaw - dx * 0.3) % 360 + 540) % 360 - 180; P.gcPitch += dy * 0.2; }
    gui.controllersRecursive().forEach(c => c.updateDisplay()); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', e => { if (P.mode !== 'Grass Field' && !isW()) return; e.preventDefault(); if (isW()) { P.wcDist *= Math.exp(e.deltaY * 0.001); wClamp(); } else P.gcDist *= Math.exp(e.deltaY * 0.001); gui.controllersRecursive().forEach(c => c.updateDisplay()); }, { passive: false }); }

// ---------- tiled still render ----------
const status = { text: 'idle' };
async function renderStill() {
  if (busy) return; busy = true; V = P; // stills use the final (target) values, not the eased ones
  const W = Math.round(P.width), H = Math.round(P.height), aspect = W / H, half = worldHalf(aspect), N = frame; curAspect = aspect;
  const pxScale = Math.min(W, H) / 1080; const isP = P.mode === 'Particle Fabric', isS = isLS(), isG = P.mode === 'Grass Field'; const is3D = P.mode === '3D fabric' || isP || isS || isG;
  const K = is3D ? 0 : Math.min(N, Math.min(900, Math.max(30, Math.ceil(Math.log(0.002) / Math.log(P.decay)))));
  const TILE = Math.min(2048, MAXTEX - 512); const M = Math.ceil(24 * pxScale + P.pointSize * pxScale) + 4;
  const job = Math.random().toString(36).slice(2); const t0 = performance.now();
  const name = `still_${isG ? 'grass' : isS ? 'spheres-' + P.lsStyle.toLowerCase() : isP ? 'particles' : is3D ? '3d' : '2d'}_${W}x${H}_seed${P.seed}_${P.palette.replace(/\W+/g, '')}_f${N}${P.cmykSafe ? '_cmyksafe' : ''}`;
  const yieldUI = () => new Promise(r => setTimeout(r, 0));
  const ft = (f: number) => f * DT * P.evolution, fo = (f: number) => [P.driftX * f * DT, P.driftY * f * DT];
  let snap: FB | undefined; let t3s = t3;
  if (isP) { // simulate ONCE from frame 0 with the final values, then only the camera is tiled
    pStep(0, aspect, 0, true); for (let f = 0; f < N; f++) { pStep(f, aspect, f * DT * P.evolution3d); if (f % 64 == 0) { gl.flush(); status.text = `simulating ${f}/${N}`; await yieldUI(); } }
    t3s = N * DT * P.evolution3d;
  }
  if (isS) { sStep(0, aspect, 0, true); for (let f = 0; f < N; f++) { sStep(f, aspect, f * DT * P.evolution3d); if (f % 16 == 0) { gl.flush(); status.text = `simulating ${f}/${N}`; await yieldUI(); } } t3s = N * DT * P.evolution3d; }
  settleFrame = N;
  const copy = (src: FB, dst: FB) => { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.f); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.f); gl.blitFramebuffer(0, 0, texW, texH, 0, 0, texW, texH, gl.COLOR_BUFFER_BIT, gl.NEAREST); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null); };
  if (!is3D) {
    simStep(0, half, true); for (let f = 0; f < N - K; f++) { simStep(f, half, false, ft(f), fo(f)); if (f % 64 == 0) { gl.flush(); await yieldUI(); } }
    snap = stateFB(texW, texH); copy(st[0], snap);
  }
  const cols = Math.ceil(W / TILE), rows = Math.ceil(H / TILE); let T: Trails | undefined; let out: FB | undefined;
  const vh = [half[0] / P.zoom, half[1] / P.zoom];
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const x0 = tx * TILE, y0 = ty * TILE, tw = Math.min(TILE, W - x0), th = Math.min(TILE, H - y0);
    const fw = tw + 2 * M, fh = th + 2 * M;
    if (!T || T.w !== fw || T.h !== fh) { freeTrails(T); T = makeTrails(fw, fh); del(out); out = fbo(tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST); }
    else for (const k of ['a', 'b']) { gl.bindFramebuffer(gl.FRAMEBUFFER, (T as any)[k].f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    const px0 = x0 - M, px1 = x0 + tw + M, py0 = y0 - M, py1 = y0 + th + M;
    if (is3D) {
      const sr = [px0 / W, px1 / W, py0 / H, py1 / H]; settleFrame = N;
      if (isG) renderGrass(T, aspect, N * DT, sr, pxScale, 4096); else if (isS) render3D(T, aspect, t3s, tOrbit, sr, pxScale, P.stillMeshMul, P.shadowResExport, sphereHooks); else if (isP) renderParticleScene(T, aspect, t3s, tOrbit, sr, pxScale, P.stillMeshMul, P.shadowResExport); else render3D(T, aspect, t3, tOrbit, sr, pxScale, P.stillMeshMul, P.shadowResExport);
      status.text = `tile ${ty * cols + tx + 1}/${cols * rows}`; gl.flush(); await yieldUI();
    } else {
      const wx = (px: number) => -vh[0] + px / W * 2 * vh[0], wy = (py: number) => vh[1] - py / H * 2 * vh[1];
      const tc = [(wx(px0) + wx(px1)) / 2, (wy(py0) + wy(py1)) / 2], thf = [(wx(px1) - wx(px0)) / 2, (wy(py0) - wy(py1)) / 2];
      copy(snap!, st[0]);
      for (let f = N - K; f < N; f++) {
        simStep(f, half, false, ft(f), fo(f)); trailStep(T, tc, thf, pxScale);
        if (f % 16 == 0) { gl.flush(); status.text = `tile ${ty * cols + tx + 1}/${cols * rows} step ${f - N + K}/${K}`; await yieldUI(); }
      }
    }
    bloomPass(T, pxScale);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out!.f); composite(T, [M, M], [0, 0, tw, th]);
    const px = new Uint8Array(tw * th * 4); gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const flip = new Uint8Array(px.length); const rb = tw * 4; for (let r = 0; r < th; r++) flip.set(px.subarray((th - 1 - r) * rb, (th - r) * rb), r * rb);
    await fetch(`/api/tile?job=${job}&x=${x0}&y=${y0}&w=${tw}&h=${th}`, { method: 'POST', body: flip });
  }
  freeTrails(T); del(out); if (snap) del(snap);
  status.text = 'stitching…'; await yieldUI();
  const r = await fetch(`/api/finish?job=${job}&W=${W}&H=${H}&name=${name}&dpi=${P.dpi}&tiff=${P.tiff ? 1 : 0}&pdf=${P.pdf ? 1 : 0}`, { method: 'POST' }).then(r => r.json());
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  status.text = `done ${W}×${H} in ${secs}s → ${r.files.map((f: string) => f.split('/').pop()).join(', ')}`;
  log(`still ${name} tiles=${cols * rows} K=${K} M=${M} secs=${secs} files=${r.files.join(',')}`);
  if (!is3D) { simStep(0, worldHalf(previewAspect), true); for (let f = 0; f < frame; f++) simStep(f, worldHalf(previewAspect), false, ft(f), fo(f)); }
  if (isS) { sStep(0, previewAspect, 0, true); let tt = 0; for (let f = 0; f < frame; f++) { sStep(f, previewAspect, tt); tt += DT * P.evolution3d; } }
  if (isP) { pStep(0, previewAspect, 0, true); let tt = 0; for (let f = 0; f < frame; f++) { pStep(f, previewAspect, tt); tt += DT * P.evolution3d; } }
  V = L; busy = false; return r;
}
// ---------- deterministic MP4 (frames -> ffmpeg) ----------
async function renderVideo(seconds = 6, w = 1920, h = 1080, warm = 120) {
  if (busy || P.mode === '2D flow') return; busy = true; V = P; const isP = P.mode === 'Particle Fabric', isS = isLS(), isG = P.mode === 'Grass Field'; const aspect = w / h; curAspect = aspect;
  const name = `video_${isW() ? 'wall-' + P.wMat : isG ? 'grass' : isS ? 'spheres-' + P.lsStyle.toLowerCase() : isP ? 'particles' : '3d'}_${w}x${h}_seed${P.seed}_${P.palette.replace(/\W+/g, '')}_${seconds}s`; const t0 = performance.now();
  await fetch(`/api/vstart?name=${name}&w=${w}&h=${h}&fps=60&crf=26`, { method: 'POST' });
  const T = makeTrails(w, h); const out = fbo(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST); const px = new Uint8Array(w * h * 4);
  if (isP) { pStep(0, aspect, 0, true); for (let f = 0; f < warm; f++) pStep(f, aspect, f * DT * P.evolution3d); }
  if (isS) { sStep(0, aspect, 0, true); for (let f = 0; f < warm; f++) sStep(f, aspect, f * DT * P.evolution3d); }
  const n = seconds * 60, pxScale = h / 1080;
  for (let k = 0; k < n; k++) {
    const f = warm + k; if (isP) pStep(f, aspect, f * DT * P.evolution3d); if (isS) sStep(f, aspect, f * DT * P.evolution3d);
    const tt = (f + 1) * DT * P.evolution3d, to = (f + 1) * DT * P.orbitSpeed; settleFrame = f + 1;
    if (isG) renderGrass(T, aspect, (f + 1) * DT, [0, 1, 0, 1], pxScale); else if (isS) render3D(T, aspect, tt, to, [0, 1, 0, 1], pxScale, 1, P.shadowResLive, sphereHooks); else if (isP) renderParticleScene(T, aspect, tt, to, [0, 1, 0, 1], pxScale); else render3D(T, aspect, tt, to, [0, 1, 0, 1], pxScale);
    bloomPass(T, pxScale); gl.bindFramebuffer(gl.FRAMEBUFFER, out.f); composite(T, [0, 0], [0, 0, w, h]);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    await fetch('/api/vframe', { method: 'POST', body: px }); status.text = `video frame ${k + 1}/${n}`;
  }
  freeTrails(T); del(out); const r = await fetch('/api/vend', { method: 'POST' }).then(r => r.json());
  const secs = ((performance.now() - t0) / 1000).toFixed(1); status.text = `video done in ${secs}s (${(r.size / 1e6).toFixed(1)} MB)`; log(`video ${name} frames=${n} secs=${secs} size=${r.size}`);
  if (isP || isS) reset(); V = L; busy = false; return r;
}

// ---------- recovery: watchdog, last-good settings, context loss ----------
const DEFAULTS = JSON.parse(JSON.stringify(P)); const DEFAULT_STOPS = JSON.parse(JSON.stringify(stops));
let lastGood: any = null, badTicks = 0, recoverMsg = '', lastGoodAt = 0;
function probe() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); let s = 0, n = 0;
  for (const [fx, fy] of [[.5, .5], [.25, .25], [.75, .25], [.25, .75], [.75, .75]]) {
    const w = 16, px = new Uint8Array(w * w * 4);
    gl.readPixels(Math.floor(frameRect[0] + frameRect[2] * fx) - 8, Math.floor(frameRect[1] + frameRect[3] * fy) - 8, w, w, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let i = 0; i < px.length; i += 4) { s += px[i] + px[i + 1] + px[i + 2]; n += 3; }
  }
  const lum = s / n; let nan = false;
  if (isLS()) { const sp = new Float32Array(256 * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, ss[0].f); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, 256, 1, gl.RGBA, gl.FLOAT, sp); nan = sp.some(v => !Number.isFinite(v)); }
  else if (P.mode === 'Particle Fabric') { const sp = new Float32Array(256 * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, ps[0].f); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, 256, 1, gl.RGBA, gl.FLOAT, sp); nan = sp.some(v => !Number.isFinite(v)); }
  else if (P.mode !== '3D fabric') { const sp = new Float32Array(256 * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, st[0].f); gl.readPixels(0, 0, 256, 1, gl.RGBA, gl.FLOAT, sp); nan = sp.some(v => !Number.isFinite(v)); }
  const bad = SMOOTH.some(k => !Number.isFinite(L[k]));
  return { lum: +lum.toFixed(1), nan: nan || bad, lost: gl.isContextLost() };
}
const bgLum = () => hex(P.background).reduce((a, b) => a + b, 0) / 3 * 255;
function recover(why: string) {
  const src = lastGood || { ...DEFAULTS, stops: DEFAULT_STOPS };
  load(JSON.parse(JSON.stringify(src)), true); SMOOTH.forEach(k => L[k] = P[k]); reset(); badTicks = 0;
  recoverMsg = `recovered (${why})`; setTimeout(() => recoverMsg = '', 4000); log('RECOVER ' + why);
}
setInterval(() => {
  if (busy || P.paused || gl.isContextLost() || frame < 30) return;
  const p = probe(); const black = p.lum <= bgLum() + 1.2;
  if (black || p.nan) { if (++badTicks >= 3) recover(p.nan ? 'NaN' : 'black frame'); }
  else { badTicks = 0; if (p.lum > bgLum() + 6 && performance.now() - lastGoodAt > 2000) { lastGood = snapshot(); lastGoodAt = performance.now(); } }
}, 400);
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); sessionStorage.setItem('flow-recover', JSON.stringify(lastGood || snapshot())); log('CONTEXT LOST'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());

// ---------- UI ----------
const gui = new GUI({ title: 'Flow Engine — controls', width: 330 });
gui.add(P, 'mode', ['Wall Studio', 'Grass Field', '3D fabric', 'Liquid Spheres', 'Particle Fabric', '2D flow']).name('render mode').onChange(() => { if (isW()) wallDefaults(); reset(); updateFolders(); wsU(); });
gui.add({ r() { recover('button'); } }, 'r').name('⛑ Reset / Recover (Esc)');
gui.add(P, 'seed', 0, 999999, 1).onFinishChange(reset);
gui.add({ randomize }, 'randomize').name('🎲 Randomize (R)');
gui.add(P, 'paused').name('pause (Space)'); gui.add(P, 'smoothing', 0, 0.5, 0.01).name('slider easing');
const f3 = gui.addFolder('3D Fabric');
f3.add(P, 'fold', 0, 1.5, 0.01).name('fold amount'); f3.add(P, 'warp', 0, 2, 0.01).name('warp strength'); f3.add(P, 'scale3d', 0.2, 3, 0.01).name('fold frequency');
f3.add(P, 'detail', 1, 5, 1).name('surface detail'); f3.add(P, 'layers', 1, 5, 1).name('layer count'); f3.add(P, 'layerSep', 0.05, 1, 0.01).name('layer spacing');
f3.add(P, 'meshRes', [256, 384, 512, 768, 1024]).name('mesh resolution'); f3.add(P, 'evolution3d', 0, 0.5, 0.001).name('flow speed');
f3.add(P, 'stretch', 0.5, 3, 0.01).name('long-axis stretch');
f3.add(P, 'gloss', 4, 256, 1).name('gloss'); f3.add(P, 'spec', 0, 3, 0.01).name('specular'); f3.add(P, 'iridescence', 0, 1, 0.01); f3.add(P, 'rim', 0, 2, 0.01).name('fresnel rim');
f3.add(P, 'saturation', 0.5, 2, 0.01); f3.add(P, 'brightness', 0.3, 3, 0.01); 
f3.add(P, 'orbitSpeed', 0, 0.5, 0.001).name('camera orbit speed'); f3.add(P, 'camDist', 1.5, 6, 0.01).name('camera distance'); f3.add(P, 'fov', 20, 80, 0.1).name('FOV');
f3.add(P, 'fog', 0, 1, 0.01).name('depth fog');
const gf = gui.addFolder('Gravity (fabric + particles)');
gf.add(P, 'gStrength', 0, 2, 0.01).name('gravity strength'); gf.add(P, 'gAz', -180, 180, 1).name('gravity azimuth'); gf.add(P, 'gEl', -90, 90, 1).name('gravity elevation (-90 = down)');
gf.add(P, 'mass', 0.2, 3, 0.01); gf.add(P, 'stiffness', 0.2, 3, 0.01); gf.add(P, 'damping', 0, 1, 0.01); gf.add(P, 'floor', 0.1, 2, 0.01).name('pool / floor level');
gf.add(P, 'wind', 0, 1.5, 0.01).name('wind / noise forcing'); gf.add(P, 'windAz', -180, 180, 1).name('wind azimuth');
gf.add({ s() { frame = 0; settleFrame = 0; } }, 's').name('↻ Drop again (re-settle)');
const lsf = gui.addFolder('Liquid Spheres');
lsf.add(P, 'lsStyle', ['Beads', 'Liquid']).name('render style');
let lsT: any; const lsReset = () => { clearTimeout(lsT); lsT = setTimeout(reset, 350); };
lsf.add(P, 'lsCount', { '32K': 32768, '65K': 65536, '131K': 131072, '262K': 262144, '524K (export)': 524288 }).name('spheres').onChange(lsReset); for (const f of gui.folders) if (f !== lsf) f.close(); lsf.add(P, 'lsPrim', PRIMS).name('object primitive'); lsf.add(P, 'lsSizeRand', 0, 1, 0.01).name('size randomness'); lsf.add(P, 'lsRotRand', 0, 1, 0.01).name('rotation randomness'); lsf.add(P, 'lsSSS', 0, 3, 0.01).name('gloss / translucency'); lsf.add(P, 'lsFlow').name('flow along fabric'); lsf.add(P, 'lsDetach').name('drip detach (experimental)'); lsf.add(P, 'lsFlowU', -0.2, 0.2, 0.001).name('flow u'); lsf.add(P, 'lsFlowV', -0.2, 0.2, 0.001).name('flow v');
lsf.add(P, 'lsCam', 0.3, 2.5, 0.01).name('camera pull-back');
lsf.add(P, 'lsRadius', 0.015, 0.1, 0.001).name('radius'); lsf.add(P, 'lsRand', 0, 0.8, 0.01).name('radius randomness').onChange(lsReset);
lsf.add(P, 'lsDrip', 30, 3000, 10).name('drip rate (cycles/min ×10)'); lsf.add(P, 'lsDripLen', 0, 1.5, 0.01).name('drip length'); lsf.add(P, 'lsDripAmt', 0, 1, 0.01).name('drip amount'); lsf.add(P, 'lsTurn', 0, 30, 0.1).name('pool turnover s (0 = keep)');
lsf.add(P, 'lsVisc', 0, 0.5, 0.005).name('viscosity'); lsf.add(P, 'lsCoh', 0, 1, 0.01).name('cohesion / surface tension'); lsf.add(P, 'lsCohR', 0.05, 0.8, 0.01).name('cohesion range');
lsf.add(P, 'lsBounce', 0, 0.9, 0.01).name('bounce'); lsf.add(P, 'lsFric', 0, 1, 0.01).name('floor friction'); lsf.add(P, 'lsDamp', 0, 5, 0.01).name('air damping');
lsf.add(P, 'lsFloor', -2, -0.4, 0.01).name('pool floor height'); lsf.add(P, 'lsTank').name('tank walls'); lsf.add(P, 'lsSlide', 0, 3, 0.01).name('slide along fabric'); lsf.add(P, 'lsBoxX', 0.5, 4, 0.01).name('tank half-width'); lsf.add(P, 'lsBoxZ', 0.3, 3, 0.01).name('tank half-depth');
lsf.add(P, 'lsSub', 1, 4, 1).name('substeps'); lsf.add(P, 'lsFabric').name('show fabric'); lsf.add(P, 'lsHem', -2, 1.5, 0.01).name('fabric hem height');
lsf.add(P, 'lsFloorOn').name('studio floor'); lsf.addColor(P, 'lsFloorCol').name('floor color'); lsf.add(P, 'lsFloorRough', 0.04, 1, 0.01).name('floor roughness');
lsf.add(P, 'lsAbsorb', 0, 10, 0.1).name('liquid absorption'); lsf.add(P, 'lsInflate', 1, 2, 0.01).name('liquid merge (inflate)'); lsf.add(P, 'lsGain', 0.2, 3, 0.01).name('sphere brightness');
lsf.add({ d() { reset(); } }, 'd').name('↻ Reset / drop');
const pf = gui.addFolder('Particle Fabric'); pf.close();
let pcT: any; pf.add(P, 'pCount', { '262K': 262144, '1M': 1048576, '2M': 2097152, '4M': 4194304 }).name('particles').onChange(() => { clearTimeout(pcT); pcT = setTimeout(reset, 350); });
pf.add(P, 'wellPreset', Object.keys(WELL_PRESETS)).name('well preset').onChange((v: string) => { applyWellPreset(v); gui.controllersRecursive().forEach(c => c.updateDisplay()); });
pf.add(P, 'gBlend', 0, 1, 0.01).name('fabric flow ↔ gravity'); pf.add(P, 'cohesion', 0, 2, 0.01).name('fabric cohesion');
pf.add(P, 'wellG', 0, 4, 0.01).name('well strength (G)'); pf.add(P, 'stream', 0, 4, 0.01).name('stream speed'); pf.add(P, 'pTurb', 0, 2, 0.01).name('turbulence');
pf.add(P, 'vmax', 0.5, 20, 0.1).name('speed limit'); pf.add(P, 'pLife', 0.02, 1, 0.01).name('respawn rate');
pf.add(P, 'pWidth', 0.5, 4, 0.01).name('streak width'); pf.add(P, 'streak', 0, 0.3, 0.001).name('motion-blur length'); pf.add(P, 'pGain', 0.005, 0.3, 0.001).name('glow energy');
pf.add(P, 'pColorBySpeed', 0, 1, 0.01).name('color by speed/energy'); pf.add(P, 'dof', 0, 1, 0.01).name('depth of field'); pf.add(P, 'fabricUnder', 0, 1, 0.01).name('lit fabric underneath');
P.wells.forEach((w: Well, i: number) => { const g = pf.addFolder(`Well ${i + 1}`); g.close();
  g.add(w, 'on'); g.add(w, 'x', -3, 3, 0.01); g.add(w, 'y', -2, 2, 0.01); g.add(w, 'z', -2, 2, 0.01); g.add(w, 'mass', -3, 3, 0.01).name('mass (− repels)'); g.add(w, 'falloff', 0.05, 1.5, 0.01).name('falloff / softening'); g.add(w, 'swirl', -4, 4, 0.01).name('orbit / swirl'); });
const lf = gui.addFolder('Lighting & Shadows'); lf.close();
const refreshAll = () => gui.controllersRecursive().forEach(c => c.updateDisplay());
lf.add(P, 'lightPreset', Object.keys(LIGHT_PRESETS)).name('studio preset').onChange((v: string) => { applyLightPreset(v); refreshAll(); });
lf.add(P, 'envIntensity', 0, 3, 0.01).name('environment (IBL)'); lf.add(P, 'envRot', -180, 180, 1).name('env rotation');
lf.add(P, 'followCam').name('lights follow camera'); lf.add(P, 'toneMap', ['ACES', 'Filmic (AgX-style)', 'Exponential']).name('tone map');
lf.add(P, 'shadowSoft', 0, 1, 0.01).name('shadow softness (PCSS)'); lf.add(P, 'shadowBias', 0, 0.01, 0.0001).name('shadow bias');
lf.add(P, 'shadowResLive', [1024, 2048, 4096]).name('shadow map (live)'); lf.add(P, 'shadowResExport', [2048, 4096, 8192]).name('shadow map (export)');
lf.add(P, 'ao', 0, 1, 0.01).name('SSAO strength'); lf.add(P, 'ssaoRadius', 0.02, 0.8, 0.01).name('SSAO radius');
P.lights.forEach((x: Light, i: number) => {
  const g = lf.addFolder(`Light ${i + 1}`); if (i > 0) g.close();
  g.add(x, 'on'); g.add(x, 'type', ['directional', 'spot', 'point']); g.add(x, 'az', -180, 180, 1).name('azimuth'); g.add(x, 'el', -10, 90, 1).name('elevation');
  g.add(x, 'dist', 1.5, 12, 0.1).name('distance (spot/point)'); g.addColor(x, 'color'); g.add(x, 'intensity', 0, 10, 0.01); g.add(x, 'shadow').name('casts shadow'); g.add(x, 'cone', 5, 60, 0.5).name('spot cone°');
});
const sim_ = gui.addFolder('2D Flow'); sim_.close();
let pcTimer: any; sim_.add(P, 'particles', { '65K': 65536, '262K': 262144, '1M': 1048576, '2M': 2097152, '4M': 4194304 }).onChange(() => { clearTimeout(pcTimer); pcTimer = setTimeout(reset, 350); });
sim_.add(P, 'noiseScale', 0.3, 5, 0.01); sim_.add(P, 'octaves', 1, 5, 1); sim_.add(P, 'evolution', 0, 1, 0.001).name('evolution speed');
sim_.add(P, 'curl', 0, 3, 0.01).name('curl strength'); sim_.add(P, 'turbulence', 0, 1.5, 0.01); sim_.add(P, 'speed', 0, 3, 0.01);
sim_.add(P, 'flowBias', 0, 1.5, 0.01).name('flow along long axis'); sim_.add(P, 'life', 0.03, 1, 0.01).name('particle life rate');
sim_.add(P, 'decay', 0.85, 0.995, 0.001).name('trail decay'); sim_.add(P, 'pointSize', 0.5, 5, 0.05); sim_.add(P, 'gain', 0.01, 0.3, 0.001).name('point energy');
sim_.add(P, 'blend', ['additive', 'screen', 'max']); sim_.add(P, 'zoom', 0.6, 3, 0.01);
sim_.add(P, 'driftX', -0.1, 0.1, 0.001).name('field drift X'); sim_.add(P, 'driftY', -0.1, 0.1, 0.001).name('field drift Y');
sim_.add(P, 'densityComp').name('density compensation');
const look = gui.addFolder('Look');
look.add(P, 'exposure', 0.4, 4, 0.01); look.add(P, 'bloom', 0, 2, 0.01).name('bloom strength'); look.add(P, 'bloomThreshold', 0, 0.8, 0.01);
look.addColor(P, 'background');
const col = gui.addFolder('Palette');
col.add(P, 'palette', Object.keys(PALETTES)).onChange((v: string) => { stops = PALETTES[v].map(s => [s[0], s[1]] as Stop); syncStops(); rebuildStops(); buildPalette(); });
col.add(P, 'hueShift', -180, 180, 1).onChange(buildPalette); col.add(P, 'paletteOffset', 0, 1, 0.001); col.add(P, 'colorBySpeed', 0, 1, 0.01).name('color by speed (2D)');
col.add(P, 'cmykSafe').name('CMYK-safe palette').onChange(buildPalette);
const stopF = col.addFolder('Gradient stops (editable)'); stopF.close();
function rebuildStops() { [...stopF.controllers].forEach(c => c.destroy()); syncStops(); stops.forEach((s, i) => stopF.addColor(STOPP, 'stop' + i).name(`stop @ ${s[0].toFixed(2)}`).onChange((v: string) => { stops[i][1] = v; buildPalette(); })); }
rebuildStops();
const cf = gui.addFolder('Color (layers + mixing)');
const palNames = () => ['(main)', ...Object.keys(PALETTES)];
const RB = () => buildLayers();
const randPal = () => { const h0 = Math.random(), sch = [0, 0.08, 0.33, 0.5, 0.58][Math.floor(Math.random() * 5)]; const st: Stop[] = [];
  for (let i = 0; i < 5; i++) { const tt = i / 4; const h = (h0 + (i % 2 ? sch : 0) + tt * 0.12) % 1; const l = 0.08 + 0.8 * tt; const sat = 0.55 + 0.4 * Math.random();
    const f = (n: number) => { const k = (n + h * 12) % 12; const a = sat * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    st.push([tt, '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')]); }
  return st; };
const savePal = (name: string, st: Stop[]) => { PALETTES[name] = st.map(s => [s[0], s[1]] as Stop); const sv = JSON.parse(localStorage.getItem('flow-palettes') || '{}'); sv[name] = PALETTES[name]; localStorage.setItem('flow-palettes', JSON.stringify(sv)); refreshPalCtl(); };
const CA: any = { randomize: () => { const st = randPal(); const n = 'Random ' + new Date().toLocaleTimeString(); savePal(n, st); P.palette = n; stops = st.map(s => [s[0], s[1]] as Stop); syncStops(); rebuildStops(); buildPalette(); gui.controllersRecursive().forEach(c => c.updateDisplay()); },
  save: () => { const n = prompt('Palette name', 'My palette ' + Object.keys(PALETTES).length); if (n) savePal(n, stops); },
  addStop: () => { if (stops.length < 6) { stops.push([1, stops[stops.length - 1][1]]); stops.forEach((s, i) => s[0] = i / (stops.length - 1)); rebuildStops(); buildPalette(); } },
  removeStop: () => { if (stops.length > 3) { stops.pop(); stops.forEach((s, i) => s[0] = i / (stops.length - 1)); rebuildStops(); buildPalette(); } } };
cf.add(CA, 'randomize').name('🎲 randomize palette (saves preset)'); cf.add(CA, 'save').name('save current palette'); cf.add(CA, 'addStop').name('+ stop (max 6)'); cf.add(CA, 'removeStop').name('− stop (min 3)');
const lay = (key: string, label: string) => { const f = cf.addFolder(label); const pc = f.add(P, `c${key}Pal`, palNames()).name('palette').onChange(RB); f.add(P, `c${key}H`, -0.5, 0.5, 0.005).name('hue shift'); f.add(P, `c${key}S`, 0, 2.5, 0.01).name('saturation'); f.add(P, `c${key}C`, 0.3, 2.5, 0.01).name('contrast'); return { f, pc }; };
const L0 = lay('L0', 'Fabric layer 1'), L1 = lay('L1', 'Fabric layer 2'), LO = lay('O', 'Objects / beads');
L1.f.add(P, 'cMix1', BLENDS).name('blend over layer 1'); L1.f.add(P, 'cMixA1', 0, 1, 0.01).name('blend mix');
LO.f.add(P, 'beadMode', BEADM).name('bead color mode'); LO.f.addColor(P, 'beadSolid').name('solid color'); LO.f.add(P, 'cMixO', BLENDS).name('blend with fabric'); LO.f.add(P, 'cMixAO', 0, 1, 0.01).name('blend mix');
const pw = cf.addFolder('Patchwork (large color regions)'); pw.add(P, 'pShape', PSHAPES).name('patch shape'); pw.add(P, 'pScale', 1, 12, 0.1).name('patch scale (count)'); pw.add(P, 'pSoft', 0, 1, 0.01).name('edge softness'); pw.add(P, 'pSeed', 0, 50, 1).name('patch seed'); pw.add(P, 'pJit', 0, 1, 0.01).name('per-patch variation'); pw.add(P, 'pDrift', 0, 0.5, 0.005).name('patch drift'); pw.add(P, 'pFab', 0, 1, 0.01).name('share with fabric tint'); pw.add(P, 'pOff', -1, 1, 0.01).name('fabric patch offset');
cf.add(P, 'cHueCycle', -20, 20, 0.1).name('hue cycle (turns/min)'); cf.add(P, 'cGrad', GRADS).name('gradient direction');
function refreshPalCtl() { [L0, L1, LO].forEach(o => { o.pc = o.pc.options(palNames()).onChange(RB); }); const pcx = col.controllers.find((c: any) => c.property === 'palette'); if (pcx) (pcx as any).options(Object.keys(PALETTES)).onChange((v: string) => { stops = PALETTES[v].map(s => [s[0], s[1]] as Stop); syncStops(); rebuildStops(); buildPalette(); }); }
try { const sv = JSON.parse(localStorage.getItem('flow-palettes') || '{}'); Object.assign(PALETTES, sv); } catch {}
const pre = gui.addFolder('Presets'); pre.close();
const store = { name: 'my-preset', saved: '' };
const savedKeys = () => Object.keys(JSON.parse(localStorage.getItem('flow-presets') || '{}'));
pre.add(store, 'name').name('preset name');
pre.add({ save() { const all = JSON.parse(localStorage.getItem('flow-presets') || '{}'); all[store.name] = snapshot(); localStorage.setItem('flow-presets', JSON.stringify(all)); refreshSaved(); } }, 'save').name('💾 Save (localStorage)');
let savedCtl: any; function refreshSaved() { savedCtl?.destroy(); savedCtl = pre.add(store, 'saved', savedKeys()).name('load saved').onChange((k: string) => load(JSON.parse(localStorage.getItem('flow-presets')!)[k])); }
refreshSaved();
pre.add({ exportJSON() { const b = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = store.name + '.json'; a.click(); } }, 'exportJSON').name('⬇ Export JSON');
pre.add({ importJSON() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async () => load(JSON.parse(await i.files![0].text())); i.click(); } }, 'importJSON').name('⬆ Import JSON');
const gF = gui.addFolder('Grass'); gF.add(P, 'gOn').name('grass on (off = colored plane)'); gF.add(P, 'gDensity', 128, 768, 16).name('density (blades per side)');
gF.add(P, 'gH', 0.05, 1.2, 0.01).name('height (m)'); gF.add(P, 'gHR', 0, 1, 0.01).name('height randomness'); gF.add(P, 'gW', 0.003, 0.04, 0.001).name('blade width (m)');
gF.add(P, 'gCurv', 0, 1.5, 0.01).name('curvature'); gF.add(P, 'gStiff', 0.2, 3, 0.01).name('stiffness'); gF.add(P, 'gLean', 0, 1, 0.01).name('lean randomness'); gF.add(P, 'gTwist', 0, 2, 0.01).name('twist');
gF.add(P, 'gClump', 0, 1, 0.01).name('clumping'); gF.add(P, 'gSeg', 2, 8, 1).name('segments'); gF.add(P, 'gTerrA', 0, 1, 0.01).name('terrain roll (m)');
gF.add(P, 'gColor', ['natural', 'patchwork']).name('color'); gF.addColor(P, 'gBase').name('base color'); gF.addColor(P, 'gTip').name('tip color'); gF.addColor(P, 'gDryC').name('dry tip color'); gF.add(P, 'gDry', 0, 1, 0.01).name('dry tips'); gF.add(P, 'gColRand', 0, 1, 0.01).name('color randomness'); gF.addColor(P, 'gSoil').name('soil color');
const wF = gui.addFolder('Wind'); wF.add(P, 'gWind', 0, 2, 0.01).name('strength'); wF.add(P, 'gWindAz', -180, 180, 1).name('direction (°)'); wF.add(P, 'gGustK', 0.05, 2, 0.01).name('gust size (1/m)'); wF.add(P, 'gGustSpeed', 0, 6, 0.01).name('gust speed'); wF.add(P, 'gFlutter', 0, 0.2, 0.001).name('flutter');
const glF = gui.addFolder('Lighting'); glF.add(P, 'gLight', Object.keys(G_LIGHTS)).name('preset').onChange((v: string) => { applyGLight(v); gui.controllersRecursive().forEach(c => c.updateDisplay()); });
glF.add(P, 'gSunAz', 0, 360, 1).name('sun direction (°)'); glF.add(P, 'gSunEl', 1, 89, 0.5).name('sun height (°)'); glF.add(P, 'gSunI', 0, 3, 0.01).name('sun intensity'); glF.add(P, 'gSkyI', 0, 3, 0.01).name('sky fill');
glF.add(P, 'gShSoft', 0.5, 6, 0.1).name('shadow softness'); glF.add(P, 'gTrans', 0, 3, 0.01).name('translucency / backlight'); glF.add(P, 'gSpec', 0, 2, 0.01).name('blade sheen'); glF.add(P, 'gAO', 0, 1, 0.01).name('root darkness (min AO)'); glF.add(P, 'gHaze', 0, 4, 0.01).name('haze');
glF.add(P, 'exposure', 0.2, 4, 0.01).name('exposure');
const camF = gui.addFolder('Camera'); camF.add(P, 'gcView', Object.keys(G_VIEWS)).name('preset view').onChange((v: string) => { applyGView(v); gui.controllersRecursive().forEach(c => c.updateDisplay()); });
camF.add(P, 'gcHeight', 0, 3, 0.01).name('look-at height (m)'); camF.add(P, 'gcDist', 0.3, 7, 0.01).name('distance (m)'); camF.add(P, 'gcPitch', -2, 89, 0.5).name('angle / pitch (°)'); camF.add(P, 'gcYaw', -180, 180, 0.5).name('turn / yaw (°)');
camF.add(P, 'gcFov', 15, 90, 0.5).name('field of view (° vertical)'); camF.add(P, 'gcAuto').name('auto orbit'); camF.add(P, 'gcAutoSpd', -20, 20, 0.1).name('orbit speed (°/s)');
camF.add({ reset: () => { P.gcYaw = 0; P.gcView = 'Eye level'; applyGView('Eye level'); gui.controllersRecursive().forEach(c => c.updateDisplay()); } }, 'reset').name('Reset camera');
camF.add({ tip: 'drag = orbit · wheel = zoom · right/shift-drag = pan' }, 'tip').name('mouse').disable();
const ex = gui.addFolder('Export'); ex.close();
const wsU = () => gui.controllersRecursive().forEach(c => c.updateDisplay());
function wallDefaults() { P.lightPreset = 'C4D Studio Softbox'; applyLightPreset(P.lightPreset); P.toneMap = 'Filmic (AgX-style)'; P.bloom = 0.18; P.ao = 1.4; P.ssaoRadius = 0.3; P.shadowSoft = 1.4; P.shadowBias = 0.003; P.lsFloorCol = '#9a9a9a'; P.lsFloorRough = 0.6; P.fog = 0; P.lsCount = 32768; P.lsRadius = 0.04; P.fold = 0.32; P.warp = 0.45; P.iridescence = 0.15; }
const wMatF = gui.addFolder('Material');
wMatF.add(P, 'wMat', WMATS).name('wall material'); wMatF.addColor(P, 'wColor').name('color'); wMatF.add(P, 'wPatch').name('palette patchwork (no objects)');
wMatF.add(P, 'wRough', 0, 0.6, 0.01).name('glass frost'); wMatF.add(P, 'wAbsorb', 0, 4, 0.01).name('absorption / thickness'); wMatF.add(P, 'wDisp', 0, 0.1, 0.001).name('glass dispersion');
wMatF.add(P, 'wFurLen', 0.01, 0.2, 0.001).name('fur/grass length'); wMatF.add(P, 'wFurDens', 100, 1500, 1).name('fur density'); wMatF.add(P, 'wComb', 0, 2, 0.01).name('comb (follows folds)'); wMatF.add(P, 'wWind', 0, 1, 0.01).name('wind'); wMatF.add(P, 'wShells', 8, 48, 1).name('shell count');
const wObjF = gui.addFolder('Objects');
wObjF.add(P, 'wObj').name('attach objects'); wObjF.add(P, 'wObjMat', OMATS).name('object material'); wObjF.add(P, 'lsPrim', PRIMS).name('primitive'); wObjF.add(P, 'lsCount', { '32K': 32768, '65K': 65536, '131K': 131072 }).name('count').onChange(lsReset); wObjF.add(P, 'lsRadius', 0.01, 0.08, 0.001).name('radius'); wObjF.add(P, 'lsSizeRand', 0, 1, 0.01).name('size random'); wObjF.add(P, 'lsRotRand', 0, 1, 0.01).name('rotation random');
const wCamF = gui.addFolder('Camera ');
wCamF.add(P, 'wcView', Object.keys(W_VIEWS)).name('preset view').onChange((v: string) => { applyWView(v); wsU(); });
wCamF.add(P, 'wcYaw', -50, 50, 0.5).name('orbit (deg)'); wCamF.add(P, 'wcPitch', -25, 25, 0.5).name('tilt (deg)'); wCamF.add(P, 'wcDist', 1.2, 9, 0.01).name('distance'); wCamF.add(P, 'wcFov', 20, 60, 0.5).name('lens FOV');
wCamF.add(P, 'wcPanX', -2, 2, 0.01).name('pan X'); wCamF.add(P, 'wcPanY', -2, 2, 0.01).name('pan Y'); wCamF.add(P, 'wcAuto').name('gentle auto orbit');
wCamF.add({ r: () => { applyWView('Front'); wsU(); } }, 'r').name('reset camera');
wCamF.add(P, 'cycOn').name('cyclorama'); wCamF.addColor(P, 'cycA').name('cyc top'); wCamF.addColor(P, 'cycB').name('cyc bottom'); wCamF.add(P, 'grain', 0, 0.1, 0.001).name('film grain');
function updateFolders() { const g = P.mode === 'Grass Field', w = isW(); for (const f of [f3, gf, lsf, pf, lf, sim_, look, col, pre]) f.show(!g && !w); for (const f of [gF, wF, glF, camF]) f.show(g); for (const f of [wMatF, wObjF, wCamF]) f.show(w); if (w) { f3.show(true); lf.show(true); f3.title('Wall'); lf.title('Lighting'); } else { f3.title('3D Fabric'); lf.title('Lighting & Shadows'); } cf.show(true); ex.show(true); if (g || w) cf.close(); }
P.stillMeshMul = 2;
ex.add(P, 'exportPreset', PRESETS.map(p => p.name)).name('preset').onChange((v: string) => { if (DEFAULT_ORIENT[v]) P.orientation = DEFAULT_ORIENT[v]; applyPreset(); ex.controllersRecursive().forEach(c => c.updateDisplay()); layout(); });
ex.add(P, 'orientation', ['landscape', 'portrait']).name('orientation (boards)').onChange(() => { applyPreset(); ex.controllersRecursive().forEach(c => c.updateDisplay()); layout(); });
ex.add(P, 'width', 256, 40000, 1).name('width px').onFinishChange(layout); ex.add(P, 'height', 256, 40000, 1).name('height px').onFinishChange(layout);
ex.add(P, 'dpi', 72, 1200, 1); ex.add(P, 'tiff').name('also TIFF (sRGB)'); ex.add(P, 'pdf').name('also PDF wrapper');
ex.add(P, 'stillMeshMul', 1, 4, 1).name('3D still mesh ×');
ex.add(P, 'frameToExport').name('preview framed to export').onChange(layout);
ex.add({ renderStill }, 'renderStill').name('📸 Render still (tiled)');
ex.add(status, 'text').name('status').listen().disable();
ex.add({ v() { renderVideo(6); } }, 'v').name('🎞 Render MP4 1080p60 6s (3D modes)');
const listEl = document.createElement('pre'); listEl.textContent = 'Export presets:\n' + PRESETS.map(p => `• ${p.name}${p.board ? ' [board, orientable]' : ''}${p.pdf ? ' +PDF' : ''}`).join('\n'); listEl.style.cssText = 'margin:4px 8px;font-size:10px;color:#aaa;white-space:pre-wrap';
(ex as any).$children.appendChild(listEl);

function snapshot() { const { paused, ...rest } = P; return JSON.parse(JSON.stringify({ ...rest, stops })); }
function load(o: any, quiet = false) {
  const pc = o.particles !== P.particles || (o.pCount && o.pCount !== P.pCount); const lights = o.lights, wells = o.wells; o = { ...o }; delete o.lights; delete o.wells; if (Array.isArray(wells)) wells.forEach((w: any, i: number) => P.wells[i] && Object.assign(P.wells[i], w)); Object.assign(P, o); if (Array.isArray(lights)) lights.forEach((l: any, i: number) => P.lights[i] && Object.assign(P.lights[i], l)); if (o.stops) stops = o.stops; rebuildStops(); buildPalette();
  gui.controllersRecursive().forEach(c => c.updateDisplay()); if (!quiet) pc ? reset() : layout();
}
function randomize() {
  const r = (a: number, b: number) => a + Math.random() * (b - a); P.seed = Math.floor(Math.random() * 999999);
  Object.assign(P, { noiseScale: r(0.6, 3.5), octaves: 2 + Math.floor(r(0, 3)), evolution: r(0.03, 0.3), curl: r(0.6, 2), turbulence: r(0, 0.8), speed: r(0.6, 2),
    stretch: r(1, 2.2), decay: r(0.94, 0.985), hueShift: Math.round(r(-60, 60)), colorBySpeed: r(0.2, 0.9), palette: Object.keys(PALETTES)[Math.floor(r(0, Object.keys(PALETTES).length))],
    fold: r(0.35, 0.9), warp: r(0.5, 1.5), scale3d: r(0.6, 1.4), iridescence: r(0.3, 0.8), lightAngle: Math.round(r(-120, 120)), paletteOffset: r(0, 1) });
  stops = PALETTES[P.palette].map(s => [s[0], s[1]] as Stop); rebuildStops(); buildPalette(); gui.controllersRecursive().forEach(c => c.updateDisplay()); reset();
}
addEventListener('resize', layout);
addEventListener('keydown', e => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; if (e.key === ' ') P.paused = !P.paused; if (e.key === 'r') randomize(); if (e.key === 'Escape') recover('Esc'); });

// ---------- boot + automation via URL params ----------
const q = new URLSearchParams(location.search);
const rec = sessionStorage.getItem('flow-recover'); if (rec) { sessionStorage.removeItem('flow-recover'); Object.assign(P, JSON.parse(rec)); }
if (q.get('mode') === '2d') P.mode = '2D flow';
if (q.get('mode') === 'particles') P.mode = 'Particle Fabric';
if (q.get('mode') === 'spheres') P.mode = 'Liquid Spheres';
if (q.get('mode') === 'grass') P.mode = 'Grass Field';
if (q.get('mode') === 'spheres') P.mode = 'Liquid Spheres';
if (isW()) wallDefaults();
if (q.get('wmat')) P.wMat = q.get('wmat')!; if (q.get('wobj')) P.wObj = q.get('wobj') === '1'; if (q.get('omat')) P.wObjMat = q.get('omat')!; if (q.get('wview')) applyWView(q.get('wview')!);
if (q.get('wlight')) { P.lightPreset = q.get('wlight')!; applyLightPreset(P.lightPreset); }
if (q.get('mode') === '3d') P.mode = '3D fabric';
if (q.get('glight')) { P.gLight = Object.keys(G_LIGHTS).find(k => k.toLowerCase().startsWith(q.get('glight')!.toLowerCase())) ?? P.gLight; }
if (q.get('gview')) { P.gcView = Object.keys(G_VIEWS).find(k => k.toLowerCase().startsWith(q.get('gview')!.toLowerCase())) ?? P.gcView; applyGView(P.gcView); }
applyGLight(P.gLight);
if (q.get('style')) P.lsStyle = q.get('style') === 'liquid' ? 'Liquid' : 'Beads';
const COMBOS: any[] = [
  { palette: 'Glacier', cOPal: '(main)', cOH: 0, cMixO: 'normal', cMixAO: 0, cL1Pal: '(main)', cMix1: 'normal' },
  { palette: 'Ember', cOPal: 'Glacier', cOH: 0, cMixO: 'screen', cMixAO: 0.35, cL1Pal: 'Coral Reef', cMix1: 'overlay', cMixA1: 0.7 },
  { palette: 'Coral Reef', cOPal: 'Neon Bloom', cOH: 0, cMixO: 'soft light', cMixAO: 0.5, cL1Pal: 'Tropical Ink', cMix1: 'screen', cMixA1: 0.6 },
  { palette: 'Tropical Ink', cOPal: 'Ember', cOH: 0.1, beadMode: 'gradient', cL1Pal: 'Glacier', cMix1: 'hue', cMixA1: 0.8, cGrad: 'height' },
  { palette: 'Pastel Data', cOPal: 'Machine Dreams', beadMode: 'palette', cOS: 1.5, cL1Pal: 'Silk Iris', cMix1: 'multiply', cMixA1: 0.6, cGrad: 'normal' },
  { palette: 'Machine Dreams', beadMode: 'solid', beadSolid: '#ffcf6a', cMixO: 'overlay', cMixAO: 0.3, cL1Pal: 'Aurora Fluid', cMix1: 'color', cMixA1: 0.9, cGrad: 'depth' }];
if (q.get('combo')) { Object.assign(P, COMBOS[+q.get('combo')!] ?? {}); stops = PALETTES[P.palette].map(s => [s[0], s[1]] as Stop); }
if (q.get('prim')) P.lsPrim = PRIMS.find(p => p.startsWith(q.get('prim')!)) ?? P.lsPrim;
if (q.get('pshape')) P.pShape = PSHAPES.find(x => x.startsWith(q.get('pshape')!)) ?? P.pShape;
if (q.get('psoft')) P.pSoft = +q.get('psoft')!;
if (q.get('pfab')) P.pFab = +q.get('pfab')!;
if (q.get('pscale')) P.pScale = +q.get('pscale')!;
if (q.get('damt')) P.lsDripAmt = +q.get('damt')!;
if (q.get('flow')) P.lsFlow = q.get('flow') === '1';
if (q.get('sfab')) P.lsFabric = q.get('sfab') === '1';
if (q.get('scam')) P.lsCam = +q.get('scam')!;
if (q.get('scount')) P.lsCount = +q.get('scount')!;
if (q.get('wells')) { P.wellPreset = Object.keys(WELL_PRESETS).find(k => k.toLowerCase().startsWith(q.get('wells')!.toLowerCase())) ?? P.wellPreset; applyWellPreset(P.wellPreset); }
if (q.get('pcount')) P.pCount = +q.get('pcount')!;
if (q.get('grav')) P.gStrength = +q.get('grav')!;
if (q.get('under')) P.fabricUnder = +q.get('under')!;
if (q.get('preset')) { P.exportPreset = PRESETS.find(p => p.name.startsWith(q.get('preset')!))?.name ?? P.exportPreset; if (DEFAULT_ORIENT[P.exportPreset]) P.orientation = DEFAULT_ORIENT[P.exportPreset]; }
if (q.get('orient')) P.orientation = q.get('orient');
if (q.get('particles')) P.particles = +q.get('particles')!;
if (q.get('seed')) P.seed = +q.get('seed')!;
if (q.get('palette')) { P.palette = q.get('palette'); stops = PALETTES[P.palette].map(s => [s[0], s[1]] as Stop); }
if (q.get('hue')) P.hueShift = +q.get('hue')!;
if (q.get('cmyk')) P.cmykSafe = true;
if (q.get('light')) { P.lightPreset = Object.keys(LIGHT_PRESETS).find(k => k.toLowerCase().startsWith(q.get('light')!.toLowerCase())) ?? P.lightPreset; applyLightPreset(P.lightPreset); }
if (q.get('nolight')) { P.lights.forEach((x: Light) => x.shadow = false); P.ao = 0; }
applyPreset(); SMOOTH.forEach(k => L[k] = P[k]); rebuildStops(); buildPalette(); reset(); gui.controllersRecursive().forEach(c => c.updateDisplay());
updateFolders(); requestAnimationFrame(tick);
log(`boot maxTex=${MAXTEX} renderer=${gl.getParameter(gl.RENDERER)} mode=${P.mode}`);
if (q.get('auto') === 'still') { const after = +(q.get('after') || 360); const iv = setInterval(() => { if (frame >= after) { clearInterval(iv); renderStill().then(r => log('auto done ' + JSON.stringify(r))); } }, 200); }
(window as any).engine = { P, renderStill, reset, recover, renderVideo };

// ---------- scripted slider sweep test (?test=sweep) ----------
const waitFrames = (n: number) => new Promise<void>(res => { const f0 = frame; const t0 = performance.now(); const iv = setInterval(() => { if (frame - f0 >= n || performance.now() - t0 > 8000) { clearInterval(iv); res(); } }, 16); });
const waitMs = (ms: number) => new Promise(r => setTimeout(r, ms));
async function sweep() {
  const res: any[] = []; const ctrls = (gui.controllersRecursive() as any[]).filter(c => c.object === P && typeof c._min === 'number' && !['dpi', 'seed', 'stillMeshMul'].includes(c.property));
  await waitFrames(90); const base = probe(); log(`SWEEP[${P.mode}] base ` + JSON.stringify(base));
  for (const c of ctrls) {
    const init = c.getValue(); const vals = [c._min, c._max, (c._min + c._max) / 2];
    let worst = 999, anyNaN = false;
    for (let k = 0; k <= 20; k++) { c.setValue(c._min + (c._max - c._min) * k / 20); await waitFrames(2); const p = probe(); worst = Math.min(worst, p.lum); anyNaN ||= p.nan || p.lost; }
    for (const v of vals) { c.setValue(v); await waitFrames(30); const p = probe(); worst = Math.min(worst, p.lum); anyNaN ||= p.nan || p.lost; }
    c.setValue(init); if (['width', 'height'].includes(c.property)) layout(); await waitFrames(90); const after = probe();
    const r = { prop: c.property, min: c._min, max: c._max, worstLum: worst, nanOrLost: anyNaN, afterRestoreLum: after.lum, recovered: after.lum > bgLum() + 3 && !after.nan };
    res.push(r); log(`SWEEP[${P.mode}] ` + JSON.stringify(r));
  }
  const pc = (gui.controllersRecursive() as any[]).find(c => c.property === 'particles');
  for (const v of [65536, 4194304, 262144, 2097152, 1048576]) { pc.setValue(v); await waitMs(500); await waitFrames(40); const p = probe(); res.push({ prop: 'particles', v, ...p, recovered: p.lum > bgLum() + 3 }); log(`SWEEP[${P.mode}] particles ${v} ` + JSON.stringify(p)); }
  // fault injection: poison a param with NaN, expect watchdog to restore last-good within ~1.5 s
  const before = (window as any).__rec = 0; const k = P.mode === '3D fabric' ? 'fold' : 'speed';
  P[k] = NaN; L[k] = NaN; await waitMs(2500); const inj = probe();
  const r2 = { prop: 'inject-NaN:' + k, ...inj, paramNow: P[k], recovered: Number.isFinite(P[k]) && inj.lum > bgLum() + 3 }; res.push(r2); log(`SWEEP[${P.mode}] ` + JSON.stringify(r2));
  // Esc / button recovery
  P.exposure = 0.4; P.brightness = 0.3; recover('test-Esc'); await waitFrames(60); const esc = probe();
  const r3 = { prop: 'esc-recover', ...esc, recovered: esc.lum > bgLum() + 3 }; res.push(r3); log(`SWEEP[${P.mode}] ` + JSON.stringify(r3));
  const fails = res.filter(r => !r.recovered || r.nanOrLost).map(r => r.prop);
  log(`SWEEP[${P.mode}] DONE ${res.length} checks, failures=[${fails.join(',')}] worstLumOverall=${Math.min(...res.filter(r => r.worstLum !== undefined).map(r => r.worstLum))}`);
  return res;
}
(window as any).engine.sweep = sweep;
if (q.get('test') === 'sweep') sweep();
if (q.get('ui') === 'light') { f3.close(); }
if (q.get('ui') === 'particles') { f3.close(); lf.close(); }
if (q.get('ui') === 'spheres') { f3.close(); gf.close(); }
if (q.get('auto') === 'video') { const iv = setInterval(() => { if (frame >= 30) { clearInterval(iv); renderVideo(+(q.get('secs') || 6)).then(r => log('auto video done ' + JSON.stringify(r))); } }, 200); }
if (q.get('debug')) setInterval(() => {
  if (busy) return; const n = 1024, a = new Float32Array(n * 4), b = new Float32Array(n * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, ps[0].f); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 7, n, 1, gl.RGBA, gl.FLOAT, a); gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.readPixels(0, 7, n, 1, gl.RGBA, gl.FLOAT, b); gl.readBuffer(gl.COLOR_ATTACHMENT0);
  const st = (arr: Float32Array, k: number) => { let mn = 1e9, mx = -1e9, s = 0; for (let i = 0; i < n; i++) { const v = arr[i * 4 + k]; mn = Math.min(mn, v); mx = Math.max(mx, v); s += v; } return `${mn.toFixed(2)}/${(s / n).toFixed(2)}/${mx.toFixed(2)}`; };
  log(`PDBG x ${st(a, 0)} y ${st(a, 1)} z ${st(a, 2)} life ${st(a, 3)} speed ${st(b, 3)}`);
}, 3000);
if (q.get('test') === 'inject') (async () => {
  await waitFrames(120);
  for (const k of ['gStrength', 'cohesion', 'mass', 'wellG']) {
    P[k] = NaN; L[k] = NaN; P.wells[0].mass = NaN; await waitMs(2500); const p = probe();
    log(`INJECT[${P.mode}] ${k} -> ${JSON.stringify(p)} now=${P[k]} well0=${P.wells[0].mass} ok=${Number.isFinite(P[k]) && !p.nan && p.lum > bgLum() + 3}`);
  }
})();

// Minimal glTF 2.0 / GLB parser for flow-engine Landscape mode.
// Original MIT-licensed work. Supports one or more mesh primitives with
// POSITION, optional NORMAL / COLOR_0, and indices. Applies node TRS.
// No external glTF library; no Shadertoy code.

export type Vec3 = [number, number, number];

export type GlbMesh = {
  name: string;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array; // rgba, 0..1, alpha often stores normalized height
  indices: Uint32Array;
  min: Vec3;
  max: Vec3;
};

export type CameraSample = { p: Vec3; t: Vec3 };

export type CameraPath = {
  space: string;
  fovDeg: number;
  durationSec: number;
  sampleCount: number;
  samples: CameraSample[];
};

const COMP = {
  5120: { bytes: 1, read: (v: DataView, o: number) => v.getInt8(o) },
  5121: { bytes: 1, read: (v: DataView, o: number) => v.getUint8(o) },
  5122: { bytes: 2, read: (v: DataView, o: number) => v.getInt16(o, true) },
  5123: { bytes: 2, read: (v: DataView, o: number) => v.getUint16(o, true) },
  5125: { bytes: 4, read: (v: DataView, o: number) => v.getUint32(o, true) },
  5126: { bytes: 4, read: (v: DataView, o: number) => v.getFloat32(o, true) },
} as const;

const COMP_NORM = {
  5120: 1 / 127,
  5121: 1 / 255,
  5122: 1 / 32767,
  5123: 1 / 65535,
  5125: 1 / 4294967295,
  5126: 1,
} as const;

const TYPE_SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

type Gltf = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: {
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  meshes?: { name?: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  accessors?: {
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
    normalized?: boolean;
    min?: number[];
    max?: number[];
  }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
};

function matIdent(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function matMul(a: number[], b: number[]): number[] {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function matFromTRS(t?: number[], r?: number[], s?: number[]): number[] {
  const tx = t?.[0] ?? 0, ty = t?.[1] ?? 0, tz = t?.[2] ?? 0;
  const qx = r?.[0] ?? 0, qy = r?.[1] ?? 0, qz = r?.[2] ?? 0, qw = r?.[3] ?? 1;
  const sx = s?.[0] ?? 1, sy = s?.[1] ?? 1, sz = s?.[2] ?? 1;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, yy = qy * y2, zz = qz * z2;
  const xy = qx * y2, xz = qx * z2, yz = qy * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function xformPoint(m: number[], p: Vec3): Vec3 {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  return [x, y, z];
}

function xformDir(m: number[], p: Vec3): Vec3 {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2];
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function readAccessor(gltf: Gltf, bin: ArrayBuffer, accIndex: number): { values: Float32Array; nComp: number; count: number; rawInt?: Uint32Array } {
  const acc = gltf.accessors![accIndex];
  const nComp = TYPE_SIZE[acc.type] ?? 1;
  const comp = COMP[acc.componentType as keyof typeof COMP];
  if (!comp) throw new Error(`Unsupported componentType ${acc.componentType}`);
  const view = acc.bufferView === undefined ? undefined : gltf.bufferViews![acc.bufferView];
  const viewOff = view?.byteOffset ?? 0;
  const accOff = acc.byteOffset ?? 0;
  const stride = view?.byteStride ?? nComp * comp.bytes;
  const dv = new DataView(bin);
  const out = new Float32Array(acc.count * nComp);
  const norm = acc.normalized ? (COMP_NORM[acc.componentType as keyof typeof COMP_NORM] ?? 1) : 1;
  const ints = acc.componentType !== 5126 ? new Uint32Array(acc.count * nComp) : undefined;
  for (let i = 0; i < acc.count; i++) {
    const base = viewOff + accOff + i * stride;
    for (let c = 0; c < nComp; c++) {
      const raw = comp.read(dv, base + c * comp.bytes);
      if (ints) ints[i * nComp + c] = raw >>> 0;
      out[i * nComp + c] = acc.normalized && acc.componentType !== 5126 ? raw * norm : raw;
    }
  }
  return { values: out, nComp, count: acc.count, rawInt: ints };
}

function computeNormals(pos: Float32Array, idx: Uint32Array): Float32Array {
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i] * 3, ib = idx[i + 1] * 3, ic = idx[i + 2] * 3;
    const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
    const bx = pos[ib], by = pos[ib + 1], bz = pos[ib + 2];
    const cx = pos[ic], cy = pos[ic + 1], cz = pos[ic + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    nrm[ia] += nx; nrm[ia + 1] += ny; nrm[ia + 2] += nz;
    nrm[ib] += nx; nrm[ib + 1] += ny; nrm[ib + 2] += nz;
    nrm[ic] += nx; nrm[ic + 1] += ny; nrm[ic + 2] += nz;
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
  }
  return nrm;
}

function defaultColors(pos: Float32Array, min: Vec3, max: Vec3): Float32Array {
  const n = pos.length / 3;
  const col = new Float32Array(n * 4);
  const span = Math.max(1e-6, max[1] - min[1]);
  for (let i = 0; i < n; i++) {
    const h = (pos[i * 3 + 1] - min[1]) / span;
    col[i * 4] = 0.6; col[i * 4 + 1] = 0.5; col[i * 4 + 2] = 0.4; col[i * 4 + 3] = h;
  }
  return col;
}

function splitGlb(buffer: ArrayBuffer): { json: Gltf; bin: ArrayBuffer } {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 12) throw new Error('GLB too short');
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error('Not a GLB (missing glTF magic)');
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);
  const length = dv.getUint32(8, true);
  if (length > buffer.byteLength) throw new Error('GLB length exceeds buffer');
  let off = 12;
  let json: Gltf | null = null;
  let bin: ArrayBuffer | null = null;
  while (off + 8 <= length) {
    const chunkLen = dv.getUint32(off, true);
    const chunkType = dv.getUint32(off + 4, true);
    const start = off + 8;
    const end = start + chunkLen;
    if (end > buffer.byteLength) throw new Error('GLB chunk overruns buffer');
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(buffer.slice(start, end))) as Gltf;
    } else if (chunkType === 0x004e4942) {
      bin = buffer.slice(start, end);
    }
    off = end;
    // chunks are 4-byte aligned already in the file (length includes padding? length is unpadded, but
    // the next chunk starts at start+chunkLen, and writers pad chunkLen to 4).
  }
  if (!json) throw new Error('GLB missing JSON chunk');
  if (!bin) {
    // JSON-only GLB is unusual; allow empty bin if no views need it
    bin = new ArrayBuffer(0);
  }
  return { json, bin };
}

function collectNodes(gltf: Gltf): { node: number; world: number[] }[] {
  const nodes = gltf.nodes ?? [];
  const scenes = gltf.scenes ?? [];
  const roots = scenes[gltf.scene ?? 0]?.nodes ?? nodes.map((_, i) => i);
  const out: { node: number; world: number[] }[] = [];
  const visit = (i: number, parent: number[]) => {
    const n = nodes[i];
    if (!n) return;
    const local = n.matrix && n.matrix.length === 16 ? n.matrix.slice() : matFromTRS(n.translation, n.rotation, n.scale);
    const world = matMul(parent, local);
    out.push({ node: i, world });
    for (const c of n.children ?? []) visit(c, world);
  };
  for (const r of roots) visit(r, matIdent());
  return out;
}

/** Parse a glTF Binary (.glb) buffer into a single combined mesh in world space. */
export function parseGlb(buffer: ArrayBuffer): GlbMesh {
  const { json, bin } = splitGlb(buffer);
  if (!json.meshes || json.meshes.length === 0) throw new Error('GLB has no meshes');
  const visited = collectNodes(json);

  const posParts: Float32Array[] = [];
  const nrmParts: Float32Array[] = [];
  const colParts: Float32Array[] = [];
  const idxParts: Uint32Array[] = [];
  let names: string[] = [];
  let vmin: Vec3 = [Infinity, Infinity, Infinity];
  let vmax: Vec3 = [-Infinity, -Infinity, -Infinity];
  let base = 0;

  const pushPrim = (meshName: string, prim: { attributes: Record<string, number>; indices?: number }, world: number[]) => {
    if (prim.attributes.POSITION === undefined) return;
    const posAcc = readAccessor(json, bin, prim.attributes.POSITION);
    const pos = new Float32Array(posAcc.values);
    for (let i = 0; i < posAcc.count; i++) {
      const p = xformPoint(world, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
      pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
      vmin[0] = Math.min(vmin[0], p[0]); vmin[1] = Math.min(vmin[1], p[1]); vmin[2] = Math.min(vmin[2], p[2]);
      vmax[0] = Math.max(vmax[0], p[0]); vmax[1] = Math.max(vmax[1], p[1]); vmax[2] = Math.max(vmax[2], p[2]);
    }
    let nrm: Float32Array;
    if (prim.attributes.NORMAL !== undefined) {
      const nAcc = readAccessor(json, bin, prim.attributes.NORMAL);
      nrm = new Float32Array(nAcc.values);
      for (let i = 0; i < nAcc.count; i++) {
        const d = xformDir(world, [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]]);
        nrm[i * 3] = d[0]; nrm[i * 3 + 1] = d[1]; nrm[i * 3 + 2] = d[2];
      }
    } else {
      nrm = new Float32Array(pos.length); // filled after indices
    }
    let col: Float32Array;
    if (prim.attributes.COLOR_0 !== undefined) {
      const cAcc = readAccessor(json, bin, prim.attributes.COLOR_0);
      col = new Float32Array(posAcc.count * 4);
      const nc = cAcc.nComp;
      for (let i = 0; i < posAcc.count; i++) {
        col[i * 4] = cAcc.values[i * nc];
        col[i * 4 + 1] = cAcc.values[i * nc + 1];
        col[i * 4 + 2] = cAcc.values[i * nc + 2];
        col[i * 4 + 3] = nc > 3 ? cAcc.values[i * nc + 3] : 1;
      }
    } else {
      col = defaultColors(pos, vmin, vmax);
    }
    let idx: Uint32Array;
    if (prim.indices !== undefined) {
      const iAcc = readAccessor(json, bin, prim.indices);
      const src = iAcc.rawInt ?? Uint32Array.from(iAcc.values);
      idx = new Uint32Array(iAcc.count);
      for (let i = 0; i < iAcc.count; i++) idx[i] = src[i] + base;
    } else {
      idx = new Uint32Array(posAcc.count);
      for (let i = 0; i < posAcc.count; i++) idx[i] = base + i;
    }
    if (prim.attributes.NORMAL === undefined) {
      const localIdx = new Uint32Array(idx.length);
      for (let i = 0; i < idx.length; i++) localIdx[i] = idx[i] - base;
      nrm = computeNormals(pos, localIdx);
    }
    posParts.push(pos); nrmParts.push(nrm); colParts.push(col); idxParts.push(idx);
    names.push(meshName);
    base += posAcc.count;
  };

  let used = false;
  for (const { node, world } of visited) {
    const n = json.nodes![node];
    if (n.mesh === undefined) continue;
    const mesh = json.meshes[n.mesh];
    for (const prim of mesh.primitives) {
      pushPrim(mesh.name ?? `mesh${n.mesh}`, prim, world);
      used = true;
    }
  }
  // Orphan meshes (no nodes) — still load the first
  if (!used) {
    const mesh = json.meshes[0];
    for (const prim of mesh.primitives) pushPrim(mesh.name ?? 'mesh0', prim, matIdent());
  }
  if (posParts.length === 0) throw new Error('GLB contained no POSITION data');

  const concatF = (parts: Float32Array[]) => {
    let n = 0; for (const p of parts) n += p.length;
    const o = new Float32Array(n); let w = 0;
    for (const p of parts) { o.set(p, w); w += p.length; }
    return o;
  };
  const concatU = (parts: Uint32Array[]) => {
    let n = 0; for (const p of parts) n += p.length;
    const o = new Uint32Array(n); let w = 0;
    for (const p of parts) { o.set(p, w); w += p.length; }
    return o;
  };

  return {
    name: names[0] ?? 'mesh',
    positions: concatF(posParts),
    normals: concatF(nrmParts),
    colors: concatF(colParts),
    indices: concatU(idxParts),
    min: vmin,
    max: vmax,
  };
}

export function parseCameraPath(json: unknown): CameraPath {
  const o = json as Partial<CameraPath> & { samples?: { p?: number[]; t?: number[] }[] };
  if (!o || !Array.isArray(o.samples) || o.samples.length < 2) {
    throw new Error('camera path JSON must have at least 2 samples');
  }
  const samples: CameraSample[] = o.samples.map((s, i) => {
    if (!s?.p || !s?.t || s.p.length < 3 || s.t.length < 3) throw new Error(`bad camera sample ${i}`);
    return { p: [s.p[0], s.p[1], s.p[2]], t: [s.t[0], s.t[1], s.t[2]] };
  });
  return {
    space: o.space ?? 'gltf-y-up',
    fovDeg: typeof o.fovDeg === 'number' ? o.fovDeg : 55,
    durationSec: typeof o.durationSec === 'number' ? o.durationSec : 40,
    sampleCount: samples.length,
    samples,
  };
}

/** Linear interpolate a ping-ponging camera along the path.
 *  `timeSec * speed / durationSec` maps one one-way trip at speed=1.
 *  Odd trips reverse so the camera never jumps from the end back to the start. */
export function sampleCameraPath(path: CameraPath, timeSec: number, speed: number): { position: Vec3; target: Vec3; travelingBack: boolean } {
  const dur = Math.max(0.001, path.durationSec);
  const trip = (timeSec * Math.max(0, speed)) / dur;
  const cycle = trip - 2 * Math.floor(trip / 2); // [0, 2)
  const back = cycle >= 1;
  const u = back ? 2 - cycle : cycle; // [0, 1]
  const n = path.samples.length;
  const f = u * (n - 1);
  const i = Math.min(n - 2, Math.max(0, Math.floor(f)));
  const a = f - i;
  const s0 = path.samples[i], s1 = path.samples[i + 1];
  const lerp = (x: Vec3, y: Vec3): Vec3 => [x[0] + (y[0] - x[0]) * a, x[1] + (y[1] - x[1]) * a, x[2] + (y[2] - x[2]) * a];
  const position = lerp(s0.p, s1.p);
  // Look ~28m along the path so the horizon stays in frame (short look-ahead pitches the camera into the dirt)
  const spacing = Math.hypot(
    path.samples[1].p[0] - path.samples[0].p[0],
    path.samples[1].p[1] - path.samples[0].p[1],
    path.samples[1].p[2] - path.samples[0].p[2],
  ) || 0.22;
  const look = Math.max(16, Math.round(28 / spacing));
  const j = back ? Math.max(0, i - look) : Math.min(n - 1, i + 1 + look);
  const target = path.samples[j].p;
  // If the look-ahead collapsed (end of path), fall back to the authored target, flipped when returning
  if (j === i || (target[0] === position[0] && target[1] === position[1] && target[2] === position[2])) {
    const authored = lerp(s0.t, s1.t);
    if (back) {
      return {
        position,
        target: [position[0] * 2 - authored[0], position[1] * 2 - authored[1], position[2] * 2 - authored[2]],
        travelingBack: back,
      };
    }
    return { position, target: authored, travelingBack: back };
  }
  return { position, target, travelingBack: back };
}

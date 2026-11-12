import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlb, parseCameraPath, sampleCameraPath } from '../src/gltf';

function buildGlb(json: object, bin: Uint8Array): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonChunkLen = jsonBytes.length + jsonPad;
  const binChunkLen = bin.length + binPad;
  const total = 12 + 8 + jsonChunkLen + 8 + binChunkLen;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonChunkLen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  u8.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) u8[20 + jsonBytes.length + i] = 0x20;
  const binHeader = 20 + jsonChunkLen;
  dv.setUint32(binHeader, binChunkLen, true);
  dv.setUint32(binHeader + 4, 0x004e4942, true);
  u8.set(bin, binHeader + 8);
  return out;
}

function f32(arr: number[]): Uint8Array {
  return new Uint8Array(new Float32Array(arr).buffer);
}
function u16(arr: number[]): Uint8Array {
  return new Uint8Array(new Uint16Array(arr).buffer);
}

describe('parseGlb', () => {
  test('parses a triangle with positions, normals, colors, indices', () => {
    const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    const nrm = [0, 0, 1, 0, 0, 1, 0, 0, 1];
    const col = [1, 0, 0, 0.25, 0, 1, 0, 0.5, 0, 0, 1, 1];
    const idx = [0, 1, 2];
    const binParts = [f32(pos), f32(nrm), f32(col), u16(idx)];
    const bin = new Uint8Array(binParts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    const views = [];
    for (const p of binParts) {
      views.push({ buffer: 0, byteOffset: off, byteLength: p.length });
      bin.set(p, off);
      off += p.length;
    }
    const json = {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ name: 'Tri', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
        { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      bufferViews: views,
      buffers: [{ byteLength: bin.length }],
    };
    const mesh = parseGlb(buildGlb(json, bin));
    expect(mesh.name).toBe('Tri');
    expect(mesh.positions.length).toBe(9);
    expect(mesh.normals.length).toBe(9);
    expect(mesh.colors.length).toBe(12);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
    expect(mesh.positions[3]).toBeCloseTo(1);
    expect(mesh.colors[3]).toBeCloseTo(0.25);
    expect(mesh.normals[2]).toBeCloseTo(1);
  });

  test('computes normals and default colors when missing', () => {
    const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    const idx = [0, 1, 2];
    const binParts = [f32(pos), u16(idx)];
    const bin = new Uint8Array(binParts.reduce((n, p) => n + p.length, 0));
    bin.set(binParts[0], 0);
    bin.set(binParts[1], binParts[0].length);
    const json = {
      asset: { version: '2.0' },
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: binParts[0].length },
        { buffer: 0, byteOffset: binParts[0].length, byteLength: binParts[1].length },
      ],
      buffers: [{ byteLength: bin.length }],
    };
    const mesh = parseGlb(buildGlb(json, bin));
    expect(mesh.normals.length).toBe(9);
    // Triangle in XY, normal should point +Z
    expect(mesh.normals[2]).toBeCloseTo(1, 5);
    expect(mesh.colors.length).toBe(12);
    expect(mesh.colors[3]).toBeGreaterThanOrEqual(0);
  });

  test('applies node translation to positions', () => {
    const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    const bin = f32(pos);
    const json = {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, translation: [10, 2, -3] }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
      buffers: [{ byteLength: bin.length }],
    };
    const mesh = parseGlb(buildGlb(json, bin));
    expect(mesh.positions[0]).toBeCloseTo(10);
    expect(mesh.positions[1]).toBeCloseTo(2);
    expect(mesh.positions[2]).toBeCloseTo(-3);
    expect(mesh.min[0]).toBeCloseTo(10);
    expect(mesh.max[0]).toBeCloseTo(11);
  });

  test('rejects non-GLB buffers', () => {
    expect(() => parseGlb(new TextEncoder().encode('not a glb').buffer)).toThrow(/GLB too short/);
    const buf = new ArrayBuffer(16);
    new Uint8Array(buf).set(new TextEncoder().encode('NOPE....PADPADPA'));
    expect(() => parseGlb(buf)).toThrow(/Not a GLB/);
  });
});

describe('canyon asset (generated by tools/blender/landscape.py)', () => {
  const glb = readFileSync(join(import.meta.dir, '..', 'public', 'landscape', 'terrain.glb'));
  const pathJson = JSON.parse(readFileSync(join(import.meta.dir, '..', 'public', 'landscape', 'camera-path.json'), 'utf8'));

  test('parses the exported canyon GLB', () => {
    const mesh = parseGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength));
    expect(mesh.positions.length / 3).toBeGreaterThan(10000);
    expect(mesh.indices.length).toBeGreaterThan(30000);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.colors.length / 4).toBe(mesh.positions.length / 3);
    // Y-up bounds should cover the authored canyon
    expect(mesh.min[0]).toBeCloseTo(-40, 0);
    expect(mesh.max[0]).toBeCloseTo(40, 0);
    expect(mesh.min[2]).toBeCloseTo(-80, 0);
    expect(mesh.max[2]).toBeCloseTo(80, 0);
    expect(mesh.max[1]).toBeGreaterThan(5);
    // vertex colors in 0-1
    let maxC = 0;
    for (let i = 0; i < mesh.colors.length; i++) maxC = Math.max(maxC, mesh.colors[i]);
    expect(maxC).toBeGreaterThan(0.2);
    expect(maxC).toBeLessThanOrEqual(1.0001);
  });

  test('camera path has 600 samples and ping-pongs without a jump', () => {
    const path = parseCameraPath(pathJson);
    expect(path.sampleCount).toBe(600);
    expect(path.samples.length).toBe(600);
    expect(path.durationSec).toBeGreaterThan(1);
    const a = sampleCameraPath(path, 0, 1);
    const mid = sampleCameraPath(path, path.durationSec * 0.5, 1);
    const end = sampleCameraPath(path, path.durationSec, 1);
    const backABit = sampleCameraPath(path, path.durationSec * 1.05, 1);
    expect(a.travelingBack).toBe(false);
    // At t = duration the trip index is 1, which is the turnaround (still at the last sample).
    expect(backABit.travelingBack).toBe(true);
    // Mid should have moved along Z relative to the start
    expect(Math.abs(mid.position[2] - a.position[2])).toBeGreaterThan(10);
    // Shortly after the turnaround, we should still be near the end, not teleported to the start
    const distToEnd = Math.hypot(
      backABit.position[0] - path.samples[599].p[0],
      backABit.position[1] - path.samples[599].p[1],
      backABit.position[2] - path.samples[599].p[2],
    );
    const distToStart = Math.hypot(
      backABit.position[0] - path.samples[0].p[0],
      backABit.position[1] - path.samples[0].p[1],
      backABit.position[2] - path.samples[0].p[2],
    );
    expect(distToEnd).toBeLessThan(distToStart);
    expect(distToEnd).toBeLessThan(20);
  });
});

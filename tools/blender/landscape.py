#!/usr/bin/env python3
"""Sculpted pigment relief for flow-engine Landscape mode (pass 2).

Headless usage:
  blender -b --python tools/blender/landscape.py -- --out public/landscape

Builds a crumpled, folded "pigment sculpture" heightfield (domain-warped ridged
multifractal + crease folds), bakes ambient occlusion with Cycles into a vertex
color attribute, renders an Eevee reference still, and writes a compact GLB:

  terrain.glb       POSITION f32, NORMAL i8n, COLOR_0 u8n = (AO, cavity, height01, pigment zone)
                    split into <=65536-vertex chunks with u16 indices (keeps the file small)
  camera-path.json  closed-loop camera drift (glTF Y-up), "loop": true
  preview.png       Eevee still (1920x1080) for reference
  meta.json         stats, bake method, timings

Original MIT-licensed work for flow-engine. Perlin-style gradient noise written
from the published algorithm (Ken Perlin, 2002 "Improving Noise"). No Shadertoy code.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import struct
import sys
import time

import bpy
import numpy as np


# ---------------------------------------------------------------------------
# Vectorised gradient noise
# ---------------------------------------------------------------------------
class Noise2:
    def __init__(self, seed: int):
        rng = np.random.default_rng(seed)
        p = rng.permutation(256)
        self.perm = np.concatenate([p, p]).astype(np.int64)
        ang = rng.uniform(0, 2 * np.pi, 256)
        self.gx = np.cos(ang)
        self.gy = np.sin(ang)

    def __call__(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        xi = np.floor(x).astype(np.int64)
        yi = np.floor(y).astype(np.int64)
        xf = x - xi
        yf = y - yi
        xi &= 255
        yi &= 255
        P = self.perm

        def grad(ix, iy, dx, dy):
            h = P[P[ix] + iy] & 255
            return self.gx[h] * dx + self.gy[h] * dy

        n00 = grad(xi, yi, xf, yf)
        n10 = grad(xi + 1, yi, xf - 1, yf)
        n01 = grad(xi, yi + 1, xf, yf - 1)
        n11 = grad(xi + 1, yi + 1, xf - 1, yf - 1)
        u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
        v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
        a = n00 + u * (n10 - n00)
        b = n01 + u * (n11 - n01)
        return (a + v * (b - a)) * 1.414  # ~[-1, 1]


def fbm(N: Noise2, x, y, octaves=5, lac=2.0, gain=0.5):
    amp, f, s, norm = 1.0, 1.0, 0.0, 0.0
    for i in range(octaves):
        s = s + amp * N(x * f + i * 17.3, y * f - i * 9.1)
        norm += amp
        amp *= gain
        f *= lac
    return s / norm


def ridged(N: Noise2, x, y, octaves=5, lac=2.07, gain=0.55, sharp=2.2):
    """Musgrave-style ridged multifractal: creased folds whose detail is weighted by the previous octave."""
    s = np.zeros_like(x)
    w = np.ones_like(x)
    amp, f, norm = 1.0, 1.0, 0.0
    for i in range(octaves):
        n = 1.0 - np.abs(N(x * f + i * 31.7, y * f + i * 11.3))
        n = n ** sharp
        n = n * w
        w = np.clip(n * 1.6, 0.0, 1.0)
        s = s + n * amp
        norm += amp
        amp *= gain
        f *= lac
    return s / norm


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def blur(h, passes=1):
    for _ in range(passes):
        p = np.pad(h, 1, mode="edge")
        h = (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:] + 2 * p[1:-1, :-2] + 4 * p[1:-1, 1:-1] + 2 * p[1:-1, 2:] + p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) / 16.0
    return h


# ---------------------------------------------------------------------------
# Heightfield
# ---------------------------------------------------------------------------
def build_heights(res: int, size: float, seed: int):
    N1, N2, N3 = Noise2(seed), Noise2(seed + 1), Noise2(seed + 2)
    lin = (np.arange(res) / (res - 1) - 0.5) * size
    X, Y = np.meshgrid(lin, lin)  # rows = Y, cols = X
    q = X / 52.0, Y / 52.0
    # Two-level domain warp gives the poured / folded-cloth flow
    wx = fbm(N2, q[0] + 1.7, q[1] + 9.2, 4)
    wy = fbm(N2, q[0] + 8.3, q[1] + 2.8, 4)
    rx, ry = q[0] + 1.25 * wx, q[1] + 1.25 * wy
    wx2 = fbm(N3, rx * 1.9 + 4.1, ry * 1.9 - 3.3, 3)
    wy2 = fbm(N3, rx * 1.9 - 7.7, ry * 1.9 + 5.9, 3)
    sx, sy = rx + 0.45 * wx2, ry + 0.45 * wy2

    folds = ridged(N1, sx * 1.6, sy * 1.6, octaves=5, sharp=2.4)     # main creased sheets
    crumple = ridged(N3, sx * 4.3 + 3.0, sy * 4.3 - 1.0, octaves=3, sharp=2.6)  # secondary crumple
    mass = 0.5 + 0.5 * fbm(N2, q[0] * 0.55 - 3.0, q[1] * 0.55 + 6.0, 3)
    mass = smoothstep(0.15, 0.85, mass)

    h = 3.0 + 17.0 * folds * (0.45 + 0.75 * mass) + 5.5 * crumple * (0.4 + 0.6 * folds) + 4.0 * mass
    # Soft terraces on the big sheets: overlapping pigment layers
    step = 2.6
    k = np.floor(h / step)
    f = h / step - k
    terr = (k + smoothstep(0.1, 0.9, f)) * step
    h = 0.85 * h + 0.15 * terr
    h = blur(h, 2)

    # Pigment zones: large warped regions (sharp-ish borders) like poured paint
    zone = 0.5 + 0.5 * fbm(N1, sx * 0.9 + 12.0, sy * 0.9 - 4.0, 4)
    zone = np.clip(zone, 0.0, 1.0)
    return X, Y, h, zone


def normals_from_heights(h, spacing):
    gy, gx = np.gradient(h, spacing)  # d/drow (Y), d/dcol (X)
    n = np.stack([-gx, -gy, np.ones_like(h)], axis=-1)  # Blender Z-up
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n


def cavity_map(h, spacing):
    p = np.pad(h, 2, mode="edge")
    lap = (p[2:-2, :-4] + p[2:-2, 4:] + p[:-4, 2:-2] + p[4:, 2:-2] - 4 * h) / (2 * spacing) ** 2
    c = np.clip(0.5 + lap * 0.9, 0.0, 1.0)  # >0.5 = concave crease, <0.5 = convex crest
    return blur(c, 1)


def horizon_ao(h, spacing, dirs=16, steps=28, max_dist=14.0):
    """Fallback heightfield AO (used only if the Cycles bake fails)."""
    res = h.shape[0]
    occ = np.zeros_like(h)
    for d in range(dirs):
        a = 2 * np.pi * d / dirs
        dx, dy = np.cos(a), np.sin(a)
        best = np.zeros_like(h)
        for s in range(1, steps + 1):
            dist = max_dist * (s / steps) ** 1.5
            ox, oy = int(round(dx * dist / spacing)), int(round(dy * dist / spacing))
            sh = np.roll(np.roll(h, -oy, axis=0), -ox, axis=1)
            best = np.maximum(best, (sh - h) / max(dist, 1e-3))
        occ += np.sin(np.arctan(best))
    return np.clip(1.0 - occ / dirs, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Blender mesh + Cycles AO bake + Eevee preview
# ---------------------------------------------------------------------------
def build_mesh(X, Y, h, res):
    nv = res * res
    co = np.stack([X.ravel(), Y.ravel(), h.ravel()], axis=-1).astype(np.float32)
    i = np.arange(res - 1)
    jj, ii = np.meshgrid(i, i)  # ii row, jj col
    a = (ii * res + jj).ravel()
    b = a + 1
    c = a + res + 1
    d = a + res
    quads = np.stack([a, b, c, d], axis=-1).astype(np.int32)  # CCW seen from +Z
    mesh = bpy.data.meshes.new("PigmentRelief")
    mesh.vertices.add(nv)
    mesh.vertices.foreach_set("co", co.ravel())
    mesh.loops.add(quads.size)
    mesh.loops.foreach_set("vertex_index", quads.ravel())
    mesh.polygons.add(quads.shape[0])
    mesh.polygons.foreach_set("loop_start", np.arange(0, quads.size, 4, dtype=np.int32))
    try:
        mesh.polygons.foreach_set("loop_total", np.full(quads.shape[0], 4, dtype=np.int32))
    except Exception:
        pass
    mesh.update(calc_edges=True)
    mesh.validate()
    mesh.polygons.foreach_set("use_smooth", np.ones(quads.shape[0], dtype=bool))
    obj = bpy.data.objects.new("PigmentRelief", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj, quads


def cycles_bake_ao(obj, nv, samples=48, distance=9.0):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        scene.cycles.device = "GPU"
    except Exception as e:  # CPU is fine, just slower
        print("cycles GPU unavailable:", e)
    scene.cycles.samples = samples
    if scene.world is None:
        scene.world = bpy.data.worlds.new("BakeWorld")
    scene.world.light_settings.distance = distance
    mesh = obj.data
    attr = mesh.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="POINT")
    mesh.color_attributes.active_color = attr
    mat = bpy.data.materials.new("BakeMat")
    mat.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    t0 = time.time()
    bpy.ops.object.bake(type="AO")
    buf = np.zeros(nv * 4, dtype=np.float32)
    attr.data.foreach_get("color", buf)
    ao = buf.reshape(-1, 4)[:, 0]
    return ao, time.time() - t0, scene.cycles.device


PALETTE_PREVIEW = [  # Living-pigment preview colors (linear)
    (0.010, 0.018, 0.030), (0.020, 0.180, 0.260), (0.050, 0.520, 0.600), (0.900, 0.560, 0.120), (0.950, 0.880, 0.720),
]


def ramp(t):
    t = np.clip(t, 0, 1) * (len(PALETTE_PREVIEW) - 1)
    i = np.minimum(np.floor(t).astype(int), len(PALETTE_PREVIEW) - 2)
    f = (t - i)[:, None]
    P = np.array(PALETTE_PREVIEW)
    return P[i] * (1 - f) + P[i + 1] * f


def setup_preview(obj, ao, h01, zone, cav):
    mesh = obj.data
    t = np.clip(0.55 * zone + 0.45 * h01 + (0.5 - cav) * 0.25, 0, 1)
    col = ramp(t) * (0.25 + 0.75 * ao[:, None] ** 1.4)
    rgba = np.concatenate([col, np.ones((col.shape[0], 1))], axis=1).astype(np.float32)
    attr = mesh.color_attributes.new(name="Preview", type="FLOAT_COLOR", domain="POINT")
    attr.data.foreach_set("color", rgba.ravel())
    mesh.color_attributes.active_color = attr
    mat = bpy.data.materials.new("PreviewMat")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Preview"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.42
    obj.data.materials.clear()
    obj.data.materials.append(mat)

    scene = bpy.context.scene
    # Big soft studio key (area light) + rim + dark gradient world
    key = bpy.data.lights.new("Key", "AREA")
    key.energy = 220000
    key.size = 120
    key.color = (1.0, 0.93, 0.85)
    ko = bpy.data.objects.new("Key", key)
    ko.location = (-60, -90, 140)
    ko.rotation_euler = (math.radians(38), 0, math.radians(-30))
    bpy.context.collection.objects.link(ko)
    rim = bpy.data.lights.new("Rim", "SUN")
    rim.energy = 2.0
    rim.color = (0.55, 0.75, 1.0)
    ro = bpy.data.objects.new("Rim", rim)
    ro.rotation_euler = (math.radians(70), 0, math.radians(160))
    bpy.context.collection.objects.link(ro)
    w = scene.world
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.012, 0.013, 0.018, 1)
    bg.inputs["Strength"].default_value = 1.0


def render_preview(path, cam_sample, fov):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    ee = scene.eevee
    for k, v in (("taa_render_samples", 64), ("use_shadows", True), ("use_raytracing", True), ("use_gtao", True), ("gtao_distance", 6.0)):
        if hasattr(ee, k):
            try:
                setattr(ee, k, v)
            except Exception:
                pass
    from mathutils import Vector
    def to_b(q):
        return Vector((q[0], -q[2], q[1]))
    cd = bpy.data.cameras.new("Cam")
    cd.lens_unit = "FOV"
    cd.angle = math.radians(fov)
    co = bpy.data.objects.new("Cam", cd)
    bpy.context.collection.objects.link(co)
    loc, tgt = to_b(cam_sample["p"]), to_b(cam_sample["t"])
    co.location = loc
    co.rotation_euler = (tgt - loc).to_track_quat("-Z", "Y").to_euler()
    scene.camera = co
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------------------
# Camera loop
# ---------------------------------------------------------------------------
def sample_h(h, size, res, x, y):
    fx = (x / size + 0.5) * (res - 1)
    fy = (y / size + 0.5) * (res - 1)
    ix = int(np.clip(round(fx), 0, res - 1))
    iy = int(np.clip(round(fy), 0, res - 1))
    r = 10
    return float(h[max(0, iy - r): iy + r + 1, max(0, ix - r): ix + r + 1].max())


def build_camera_loop(h, size, res, n=1800):
    pts = []
    for i in range(n):
        a = 2 * np.pi * i / n
        rx, ry = 40.0 + 6.0 * math.sin(2 * a), 32.0 + 5.0 * math.cos(3 * a)
        x, y = rx * math.cos(a), ry * math.sin(a)
        z = sample_h(h, size, res, x, y) + 30.0 + 4.0 * math.sin(3 * a + 1.0)
        # Look ahead along the loop and inward toward the centre of the sculpture
        a2 = a + 0.42
        tx = 0.55 * (40.0 * math.cos(a2))
        ty = 0.55 * (32.0 * math.sin(a2))
        tz = sample_h(h, size, res, tx, ty) * 0.6 + 2.0
        pts.append(((x, y, z), (tx, ty, tz)))
    # Circular smoothing (closed loop)
    P = np.array([p for p, _ in pts])
    T = np.array([t for _, t in pts])
    for _ in range(6):
        P = (np.roll(P, 1, 0) + 2 * P + np.roll(P, -1, 0)) / 4
        T = (np.roll(T, 1, 0) + 2 * T + np.roll(T, -1, 0)) / 4
    g = lambda v: [round(float(v[0]), 4), round(float(v[2]), 4), round(float(-v[1]), 4)]
    return [{"p": g(P[i]), "t": g(T[i])} for i in range(n)]


# ---------------------------------------------------------------------------
# Compact GLB writer (chunked, quantized)
# ---------------------------------------------------------------------------
def write_glb(path, pos, nrm, col, res):
    """pos/nrm: (res*res,3) glTF space; col: (res*res,4) 0..1. Splits rows so each chunk has <=65536 verts."""
    rows_per = 65536 // res
    stepr = rows_per - 1
    bin_parts, views, accs, prims = [], [], [], []
    offset = 0

    def add_view(data: bytes, target=None, stride=None):
        nonlocal offset
        pad = (-len(data)) % 4
        bin_parts.append(data + b"\x00" * pad)
        v = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if stride:
            v["byteStride"] = stride
        if target:
            v["target"] = target
        views.append(v)
        offset += len(data) + pad
        return len(views) - 1

    r0 = 0
    while r0 < res - 1:
        r1 = min(res - 1, r0 + stepr)
        rows = r1 - r0 + 1
        vid = np.arange(r0 * res, (r1 + 1) * res)
        p = pos[vid].astype(np.float32)
        n8 = np.clip(np.round(nrm[vid] * 127), -127, 127).astype(np.int8)
        n8 = np.concatenate([n8, np.zeros((n8.shape[0], 1), np.int8)], axis=1)  # stride 4
        c8 = np.clip(np.round(col[vid] * 255), 0, 255).astype(np.uint8)
        i = np.arange(res - 1)
        jj, ii = np.meshgrid(i, np.arange(rows - 1))
        a = (ii * res + jj).ravel()
        b, c, d = a + 1, a + res + 1, a + res
        # (a,b,c) is CCW seen from +Z in Blender; the Z-up -> Y-up map is a proper rotation, so it stays CCW from +Y.
        tris = np.stack([a, b, c, a, c, d], axis=-1).reshape(-1).astype(np.uint16)
        vp = add_view(p.tobytes(), 34962)
        vn = add_view(n8.tobytes(), 34962, 4)
        vc = add_view(c8.tobytes(), 34962)
        vi = add_view(tris.tobytes(), 34963)
        cnt = len(vid)
        accs.append({"bufferView": vp, "componentType": 5126, "count": cnt, "type": "VEC3", "min": p.min(0).tolist(), "max": p.max(0).tolist()})
        accs.append({"bufferView": vn, "componentType": 5120, "normalized": True, "count": cnt, "type": "VEC3"})
        accs.append({"bufferView": vc, "componentType": 5121, "normalized": True, "count": cnt, "type": "VEC4"})
        accs.append({"bufferView": vi, "componentType": 5123, "count": int(tris.size), "type": "SCALAR"})
        k = len(accs)
        prims.append({"attributes": {"POSITION": k - 4, "NORMAL": k - 3, "COLOR_0": k - 2}, "indices": k - 1, "mode": 4})
        r0 = r1
    binary = b"".join(bin_parts)
    gltf = {
        "asset": {"version": "2.0", "generator": "flow-engine tools/blender/landscape.py (MIT)"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "PigmentRelief"}],
        "meshes": [{"name": "PigmentRelief", "primitives": prims, "extras": {"COLOR_0": "R=AO(Cycles) G=cavity B=height01 A=pigment zone"}}],
        "accessors": accs,
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(binary), 0x004E4942))
        f.write(binary)
    return len(prims)


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/landscape")
    ap.add_argument("--seed", type=int, default=1977)
    ap.add_argument("--res", type=int, default=512)
    ap.add_argument("--size", type=float, default=200.0)
    ap.add_argument("--fov", type=float, default=50.0)
    ap.add_argument("--duration", type=float, default=150.0)
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--no-bake", action="store_true")
    ap.add_argument("--no-preview", action="store_true")
    o = ap.parse_args(argv)
    out = os.path.abspath(o.out)
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    res, size = o.res, o.size
    spacing = size / (res - 1)
    X, Y, h, zone = build_heights(res, size, o.seed)
    print(f"heights {res}x{res} range {h.min():.2f}..{h.max():.2f} ({time.time()-t0:.1f}s)")
    cav = cavity_map(h, spacing)
    nrm_b = normals_from_heights(h, spacing)
    obj, _ = build_mesh(X, Y, h, res)

    bake = "cycles"
    bake_s = 0.0
    device = "n/a"
    ao = None
    if not o.no_bake:
        try:
            ao, bake_s, device = cycles_bake_ao(obj, res * res, samples=o.samples)
            print(f"cycles AO bake {bake_s:.1f}s device={device} mean={ao.mean():.3f}")
        except Exception as e:
            print("cycles bake failed:", e)
            ao = None
    if ao is None:
        bake = "horizon-numpy"
        ao = horizon_ao(h, spacing).ravel()
    ao = np.clip(ao, 0, 1)
    # Stretch AO so deep creases really go dark (C4D-style contact shadow)
    lo, hi = np.percentile(ao, 2), np.percentile(ao, 99.5)
    ao = np.clip((ao - lo) / max(1e-3, hi - lo), 0, 1)

    h01 = ((h - h.min()) / (h.max() - h.min())).ravel()
    col = np.stack([ao, cav.ravel(), h01, zone.ravel()], axis=-1)
    pos = np.stack([X.ravel(), h.ravel(), -Y.ravel()], axis=-1)
    nrm = np.stack([nrm_b[..., 0].ravel(), nrm_b[..., 2].ravel(), -nrm_b[..., 1].ravel()], axis=-1)

    samples = build_camera_loop(h, size, res)
    path = {"space": "gltf-y-up", "loop": True, "fovDeg": o.fov, "durationSec": o.duration, "sampleCount": len(samples), "seed": o.seed, "samples": samples}
    with open(os.path.join(out, "camera-path.json"), "w") as f:
        json.dump(path, f, separators=(",", ":"))

    glb = os.path.join(out, "terrain.glb")
    chunks = write_glb(glb, pos, nrm, col, res)
    size_b = os.path.getsize(glb)
    print(f"wrote {glb} {size_b} bytes ({size_b/1048576:.2f} MB) chunks={chunks}")

    if not o.no_preview:
        setup_preview(obj, ao, h01, zone.ravel(), cav.ravel())
        render_preview(os.path.join(out, "preview.png"), samples[len(samples) // 5], o.fov)
    meta = {"res": res, "size": size, "verts": res * res, "tris": 2 * (res - 1) ** 2, "hMin": float(h.min()), "hMax": float(h.max()),
            "ao": bake, "aoDevice": str(device), "aoBakeSec": round(bake_s, 1), "aoMean": float(ao.mean()), "glbBytes": size_b, "chunks": chunks,
            "totalSec": round(time.time() - t0, 1)}
    with open(os.path.join(out, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print("META", json.dumps(meta))
    return 0 if size_b < 15 * 1048576 else 2


if __name__ == "__main__":
    sys.exit(main())

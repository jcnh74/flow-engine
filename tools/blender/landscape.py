#!/usr/bin/env python3
"""Procedural canyon / ridge landscape for flow-engine Landscape mode.

Headless usage:
  blender -b --python tools/blender/landscape.py -- --out public/landscape

Writes:
  terrain.glb          Y-up glTF mesh with normals + vertex colors (RGB albedo, A height 0-1)
  camera-path.json     600 samples of position + look target in the same Y-up space
  preview.png          Eevee still, 1280x720, from a mid-path camera

Original MIT-licensed work for flow-engine. No Shadertoy code.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector, Color, Euler


# ---------------------------------------------------------------------------
# Deterministic value noise (no add-ons)
# ---------------------------------------------------------------------------

def _hash2(ix: int, iy: int, seed: int) -> float:
    n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0x7FFFFFFF
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0x7FFFFFFF) / 2147483647.0


def _smooth(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def value_noise(x: float, y: float, seed: int) -> float:
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    u, v = _smooth(fx), _smooth(fy)
    a = _hash2(ix, iy, seed)
    b = _hash2(ix + 1, iy, seed)
    c = _hash2(ix, iy + 1, seed)
    d = _hash2(ix + 1, iy + 1, seed)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def fbm(x: float, y: float, seed: int, octaves: int = 5, lac: float = 2.03, gain: float = 0.5) -> float:
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for i in range(octaves):
        total += amp * value_noise(x * freq, y * freq, seed + i * 101)
        norm += amp
        amp *= gain
        freq *= lac
    return total / norm if norm else 0.0


def ridge_noise(x: float, y: float, seed: int, octaves: int = 4) -> float:
    # 1 - |2n-1| creases, useful for rocky ridgelines
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for i in range(octaves):
        n = 1.0 - abs(value_noise(x * freq, y * freq, seed + 17 + i * 59) * 2.0 - 1.0)
        n = n * n
        total += amp * n
        norm += amp
        amp *= 0.5
        freq *= 2.15
    return total / norm if norm else 0.0


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge0 == edge1:
        return 0.0 if x < edge0 else 1.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


# Canyon meander in Blender space (X right, Y forward, Z up)
def canyon_center_x(y: float) -> float:
    return math.sin(y * 0.055) * 9.0 + math.sin(y * 0.021 + 0.7) * 5.5 + math.sin(y * 0.11 + 1.3) * 1.6


def terrain_height(x: float, y: float, seed: int) -> tuple[float, float, float]:
    """Return (height, slope_proxy, normalized_height_for_color)."""
    cx = canyon_center_x(y)
    d = abs(x - cx)

    # Macro ground + rocky detail
    macro = fbm(x * 0.035, y * 0.035, seed, octaves=4) * 6.5
    detail = fbm(x * 0.18, y * 0.18, seed + 3, octaves=5) * 1.35
    ridges = ridge_noise(x * 0.09, y * 0.09, seed + 9, octaves=4) * 3.2

    # Carve a river canyon: tight floor, steep walls, high shoulders
    floor = -1.6 + fbm(x * 0.08, y * 0.08, seed + 21, octaves=3) * 0.7
    wall = smoothstep(2.8, 13.0, d)
    shoulder = smoothstep(12.0, 24.0, d)
    # Keep a walkable trough so the camera never clips
    height = floor * (1.0 - wall) + (macro + 3.4) * wall + ridges * shoulder + detail * (0.35 + 0.65 * wall)

    # Occasional distant peaks
    height += shoulder * (fbm(x * 0.02 + 40, y * 0.02, seed + 41, octaves=3) ** 2) * 7.0

    # Slope proxy from a small finite difference (pre-final, good enough for color)
    slope = min(1.0, abs(d - 8.0) * 0.08 + abs(detail) * 0.25 + ridges * 0.15)
    # Normalized 0-1 over a generous range for COLOR_0.a
    h01 = max(0.0, min(1.0, (height + 3.0) / 22.0))
    return height, slope, h01


def terrain_color(h01: float, slope: float, x: float, y: float, seed: int) -> tuple[float, float, float, float]:
    """Punchy but earthy albedo. Alpha stores normalized height."""
    # Sand / silt floor
    floor_c = (0.42, 0.28, 0.16)
    # Warm sandstone mid
    sand_c = (0.72, 0.42, 0.22)
    # Cooler high rock
    rock_c = (0.28, 0.30, 0.34)
    # Lit ridge / mineral
    ridge_c = (0.85, 0.62, 0.38)
    # Shadowed moss flecks
    moss_c = (0.16, 0.28, 0.14)

    t_sand = smoothstep(0.12, 0.38, h01)
    t_rock = smoothstep(0.38, 0.70, h01)
    t_ridge = smoothstep(0.62, 0.90, h01)
    r = floor_c[0] * (1 - t_sand) + sand_c[0] * t_sand
    g = floor_c[1] * (1 - t_sand) + sand_c[1] * t_sand
    b = floor_c[2] * (1 - t_sand) + sand_c[2] * t_sand
    r = r * (1 - t_rock) + rock_c[0] * t_rock
    g = g * (1 - t_rock) + rock_c[1] * t_rock
    b = b * (1 - t_rock) + rock_c[2] * t_rock
    r = r * (1 - t_ridge) + ridge_c[0] * t_ridge
    g = g * (1 - t_ridge) + ridge_c[1] * t_ridge
    b = b * (1 - t_ridge) + ridge_c[2] * t_ridge

    # Steep faces go darker / cooler
    r = r * (1.0 - 0.35 * slope) + 0.10 * slope
    g = g * (1.0 - 0.28 * slope) + 0.12 * slope
    b = b * (1.0 - 0.15 * slope) + 0.16 * slope

    # Sparse moss in mid elevations, low slope
    moss = (1.0 - slope) * max(0.0, 1.0 - abs(h01 - 0.4) * 4.0) * value_noise(x * 0.6, y * 0.6, seed + 77)
    if moss > 0.35:
        k = min(1.0, (moss - 0.35) * 2.2)
        r = r * (1 - k) + moss_c[0] * k
        g = g * (1 - k) + moss_c[1] * k
        b = b * (1 - k) + moss_c[2] * k

    return (max(0, min(1, r)), max(0, min(1, g)), max(0, min(1, b)), h01)


# glTF Y-up conversion matching the official exporter (export_yup=True):
# Blender (X, Y, Z) Z-up -> glTF (X, Z, -Y) Y-up
def to_gltf(v: Vector | tuple[float, float, float]) -> list[float]:
    x, y, z = float(v[0]), float(v[1]), float(v[2])
    return [round(x, 5), round(z, 5), round(-y, 5)]


def parse_args(argv: list[str]) -> argparse.Namespace:
    # Blender leaves user args after "--"
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="public/landscape", help="Output directory")
    p.add_argument("--seed", type=int, default=1977)
    p.add_argument("--res-x", type=int, default=192, help="Grid resolution across canyon (X)")
    p.add_argument("--res-y", type=int, default=320, help="Grid resolution along flight (Y)")
    p.add_argument("--size-x", type=float, default=80.0)
    p.add_argument("--size-y", type=float, default=160.0)
    p.add_argument("--samples", type=int, default=600)
    p.add_argument("--duration", type=float, default=40.0, help="Seconds to fly the path at speed=1")
    p.add_argument("--fov", type=float, default=55.0)
    p.add_argument("--preview-only", action="store_true")
    return p.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_terrain(opts) -> tuple[bpy.types.Object, dict]:
    nx, ny = opts.res_x, opts.res_y
    sx, sy = opts.size_x, opts.size_y
    seed = opts.seed

    bm = bmesh.new()
    verts: list[bmesh.types.BMVert] = []
    heights: list[float] = []
    colors: list[tuple[float, float, float, float]] = []
    slopes: list[float] = []

    for j in range(ny):
        v = (j / (ny - 1) - 0.5) * sy  # Y in [-sy/2, sy/2]
        for i in range(nx):
            u = (i / (nx - 1) - 0.5) * sx
            h, slope, h01 = terrain_height(u, v, seed)
            vert = bm.verts.new((u, v, h))
            verts.append(vert)
            heights.append(h)
            slopes.append(slope)
            colors.append(terrain_color(h01, slope, u, v, seed))

    bm.verts.ensure_lookup_table()
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = verts[j * nx + i]
            b = verts[j * nx + i + 1]
            c = verts[(j + 1) * nx + i + 1]
            d = verts[(j + 1) * nx + i]
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Smooth-ish shading via vertex normals
    for f in bm.faces:
        f.smooth = True

    mesh = bpy.data.meshes.new("CanyonTerrain")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    if hasattr(mesh, "shade_smooth"):
        try:
            mesh.shade_smooth()
        except Exception:
            pass

    # Point-domain float color: RGB albedo, A = normalized height
    attr = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="POINT")
    for i, col in enumerate(colors):
        attr.data[i].color = col
    try:
        mesh.color_attributes.active_color = attr
    except Exception:
        mesh.color_attributes.active = attr

    obj = bpy.data.objects.new("CanyonTerrain", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Smooth shading operator as a fallback
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass

    stats = {
        "verts": len(mesh.vertices),
        "faces": len(mesh.polygons),
        "hMin": min(heights),
        "hMax": max(heights),
        "sizeX": sx,
        "sizeY": sy,
        "resX": nx,
        "resY": ny,
    }
    return obj, stats


def build_camera_path(opts, stats: dict) -> list[dict]:
    """Sample a smooth flight through the canyon trough, slightly above the floor."""
    samples = []
    n = opts.samples
    sy = opts.size_y
    y0, y1 = -sy * 0.42, sy * 0.42
    seed = opts.seed
    look_ahead = 10.0
    clearance = 3.4

    raw: list[tuple[Vector, Vector]] = []
    for i in range(n):
        t = i / (n - 1)
        y = y0 + (y1 - y0) * t
        cx = canyon_center_x(y)
        # Stay in the trough (a little off-center for a more cinematic line)
        sway = math.sin(t * math.pi * 2.0) * 0.6
        x = cx + sway
        h, _, _ = terrain_height(x, y, seed)
        pos = Vector((x, y, h + clearance + 0.4 * math.sin(t * math.pi * 3.0)))

        y2 = min(y1, y + look_ahead)
        cx2 = canyon_center_x(y2)
        h2, _, _ = terrain_height(cx2, y2, seed)
        tgt = Vector((cx2, y2, h2 + clearance * 0.55))
        raw.append((pos, tgt))

    # Simple 5-tap smoothing so the flight does not jitter with the noise
    def avg(idx: int, attr: int) -> Vector:
        acc = Vector((0, 0, 0))
        wsum = 0.0
        for k, w in ((-2, 1), (-1, 2), (0, 3), (1, 2), (2, 1)):
            j = max(0, min(n - 1, idx + k))
            acc += raw[j][attr] * w
            wsum += w
        return acc / wsum

    for i in range(n):
        p = avg(i, 0)
        t = avg(i, 1)
        # Keep looking somewhat ahead even after smoothing
        if i < n - 1:
            ahead = avg(min(n - 1, i + 8), 0)
            t = t.lerp(ahead, 0.45)
        samples.append({"p": to_gltf(p), "t": to_gltf(t)})
    return samples


def make_preview_camera(sample: dict, fov_deg: float) -> bpy.types.Object:
    # sample is already glTF Y-up; convert back to Blender Z-up for the scene camera
    def to_blender(q: list[float]) -> Vector:
        x, y, z = q  # glTF
        return Vector((x, -z, y))

    loc = to_blender(sample["p"])
    tgt = to_blender(sample["t"])
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens_unit = "FOV"
    cam_data.angle = math.radians(fov_deg)
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = loc
    direction = tgt - loc
    # Track-to: camera looks down local -Z
    rot = direction.to_track_quat("-Z", "Y")
    cam.rotation_euler = rot.to_euler()
    bpy.context.scene.camera = cam
    return cam


def setup_preview_look(terrain: bpy.types.Object) -> None:
    # Vertex-color material
    mat = bpy.data.materials.new("CanyonPreview")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (500, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (200, 0)
    attr = nodes.new("ShaderNodeVertexColor")
    attr.location = (0, 0)
    attr.layer_name = "Color"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    # Slightly rough rock
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.72
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.25
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.25
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    terrain.data.materials.append(mat)

    # Sun (late-day, warm)
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 6.5
    sun_data.angle = math.radians(4.0)
    if hasattr(sun_data, "color"):
        sun_data.color = (1.0, 0.82, 0.62)
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = Euler((math.radians(42), math.radians(0), math.radians(128)), "XYZ")

    # Fill
    fill_data = bpy.data.lights.new("Fill", "SUN")
    fill_data.energy = 1.1
    fill_data.color = (0.45, 0.55, 0.85)
    fill = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.rotation_euler = Euler((math.radians(75), 0, math.radians(-40)), "XYZ")

    # World: dusk sky
    world = bpy.data.worlds.new("Dusk")
    world.use_nodes = True
    wnt = world.node_tree
    wnt.nodes.clear()
    wbg = wnt.nodes.new("ShaderNodeBackground")
    wbg.inputs["Color"].default_value = (0.22, 0.28, 0.42, 1)
    wbg.inputs["Strength"].default_value = 0.55
    wout = wnt.nodes.new("ShaderNodeOutputWorld")
    wnt.links.new(wbg.outputs["Background"], wout.inputs["Surface"])
    bpy.context.scene.world = world


def render_preview(path: str, width: int = 1280, height: int = 720) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    scene.render.film_transparent = False
    eevee = scene.eevee
    if hasattr(eevee, "taa_render_samples"):
        eevee.taa_render_samples = 32
    if hasattr(eevee, "use_shadows"):
        eevee.use_shadows = True
    if hasattr(eevee, "use_raytracing"):
        eevee.use_raytracing = False
    bpy.ops.render.render(write_still=True)


def export_glb(path: str) -> None:
    # Isolate the terrain
    bpy.ops.object.select_all(action="DESELECT")
    terrain = bpy.data.objects.get("CanyonTerrain")
    if terrain is None:
        raise RuntimeError("CanyonTerrain missing")
    terrain.select_set(True)
    bpy.context.view_layer.objects.active = terrain
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True,
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_materials="NONE",
        export_extras=False,
        export_image_format="NONE",
    )


def main() -> int:
    opts = parse_args(sys.argv)
    out = os.path.abspath(opts.out)
    os.makedirs(out, exist_ok=True)
    print(f"landscape.py out={out} seed={opts.seed} res={opts.res_x}x{opts.res_y}")

    reset_scene()
    terrain, stats = build_terrain(opts)
    print("terrain", stats)

    samples = build_camera_path(opts, stats)
    path_json = {
        "space": "gltf-y-up",
        "fovDeg": opts.fov,
        "durationSec": opts.duration,
        "sampleCount": len(samples),
        "seed": opts.seed,
        "bounds": {
            "min": [-opts.size_x / 2, stats["hMin"], -opts.size_y / 2],
            "max": [opts.size_x / 2, stats["hMax"], opts.size_y / 2],
            "note": "bounds listed in Blender Z-up (X,Z height,Y); samples are glTF Y-up",
        },
        "blender": {"sizeX": opts.size_x, "sizeY": opts.size_y, "resX": opts.res_x, "resY": opts.res_y, "verts": stats["verts"], "faces": stats["faces"]},
        "samples": samples,
    }
    json_path = os.path.join(out, "camera-path.json")
    with open(json_path, "w") as f:
        json.dump(path_json, f, separators=(",", ":"))
    print("wrote", json_path, "samples", len(samples), "bytes", os.path.getsize(json_path))

    setup_preview_look(terrain)
    mid = samples[len(samples) // 2]
    make_preview_camera(mid, opts.fov)

    preview_path = os.path.join(out, "preview.png")
    render_preview(preview_path)
    print("wrote", preview_path, "bytes", os.path.getsize(preview_path) if os.path.exists(preview_path) else 0)

    glb_path = os.path.join(out, "terrain.glb")
    export_glb(glb_path)
    size = os.path.getsize(glb_path)
    print("wrote", glb_path, "bytes", size, f"({size/1024/1024:.2f} MB)")
    if size > 10 * 1024 * 1024:
        print("WARNING: GLB exceeds 10 MB budget")
        return 2
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""
flow-engine pass 3: procedural C4D-style "studio abstract" scenes, authored headless in Blender.

  blender -b --factory-startup --python tools/blender/studio_scenes.py -- --scene kaleido --out public/studio

Scenes
  tunnel   closed-loop flight through ribbed / twisted elliptical torus rings, a double helix of
           glossy tubes and pearls riding the walls (camera path baked into meta.json)
  kaleido  radially-mirrored (8-fold) sculpture of petals, rings and spheres on an infinite cove
           floor; each ring of elements is its own rotation layer (counter-rotating in WebGL)
  plasma   "twisted rope" torus (ref: C4D twisted-torus renders) + an interlinked glossy torus and
           spheres on the cove; the rope spins about its own axis so the strands appear to flow

Every vertex carries COLOR_0 = (AO baked with Cycles, palette slot/7, material/3, layer/7).
Geometry is generated parametrically with numpy (no add-ons, no third-party assets).
Original MIT-licensed work for flow-engine. No Shadertoy code.
"""
import bpy, bmesh, json, math, os, struct, sys, time
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default):
    return argv[argv.index("--" + name) + 1] if "--" + name in argv else default
SCENE = arg("scene", "kaleido")
OUT = os.path.abspath(arg("out", "public/studio"))
SAMPLES = int(arg("samples", "64"))
os.makedirs(OUT, exist_ok=True)
RNG = np.random.default_rng(int(arg("seed", "7")))

# ---------------------------------------------------------------- parametric primitives (Y-up "author space")
class Part:
    def __init__(self, name, P, faces, slot, mat, layer=0):
        self.name, self.P, self.faces, self.slot, self.mat, self.layer = name, np.asarray(P, np.float64), faces, slot, mat, layer

def grid_faces(nu, nv, wrap_u, wrap_v):
    f = []
    cu = nu if wrap_u else nu - 1
    cv = nv if wrap_v else nv - 1
    for i in range(cu):
        for j in range(cv):
            a = i * nv + j
            b = ((i + 1) % nu) * nv + j
            c = ((i + 1) % nu) * nv + (j + 1) % nv
            d = i * nv + (j + 1) % nv
            f.append((a, b, c, d))
    return f

def frame_from(t, up=np.array([0.0, 1.0, 0.0])):
    t = t / np.linalg.norm(t)
    if abs(np.dot(t, up)) > 0.95:
        up = np.array([1.0, 0.0, 0.0])
    n = np.cross(up, t); n /= np.linalg.norm(n)
    b = np.cross(t, n)
    return t, n, b

def torus(R, r, nu=96, nv=32, sx=1.0, sy=1.0):
    u = np.linspace(0, 2 * np.pi, nu, endpoint=False)[:, None]
    v = np.linspace(0, 2 * np.pi, nv, endpoint=False)[None, :]
    x = (R + r * np.cos(v)) * np.cos(u) * sx
    z = (R + r * np.cos(v)) * np.sin(u) * sy
    y = r * np.sin(v) * np.ones_like(u)
    P = np.stack([x, y, z], -1).reshape(-1, 3)
    return P, grid_faces(nu, nv, True, True)

def sphere(r, nu=48, nv=24, scale=(1, 1, 1)):
    # UV sphere without pole duplicates: rings + two pole vertices
    P = [(0, r, 0)]
    for j in range(1, nv):
        th = np.pi * j / nv
        for i in range(nu):
            ph = 2 * np.pi * i / nu
            P.append((r * np.sin(th) * np.cos(ph), r * np.cos(th), r * np.sin(th) * np.sin(ph)))
    P.append((0, -r, 0))
    P = np.array(P) * np.array(scale)
    F = []
    for i in range(nu):
        F.append((0, 1 + (i + 1) % nu, 1 + i))
    for j in range(nv - 2):
        for i in range(nu):
            a = 1 + j * nu + i; b = 1 + j * nu + (i + 1) % nu
            c = 1 + (j + 1) * nu + (i + 1) % nu; d = 1 + (j + 1) * nu + i
            F.append((a, b, c, d))
    last = len(P) - 1; base = 1 + (nv - 2) * nu
    for i in range(nu):
        F.append((base + i, base + (i + 1) % nu, last))
    return P, F

def tube_along(path, radius, nv=16, closed=True, radius_fn=None):
    """Tube swept along a polyline (N,3). Parallel-transport frames; closed loops get the twist error spread out."""
    N = len(path)
    T = np.roll(path, -1, 0) - np.roll(path, 1, 0) if closed else np.gradient(path, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    n = np.cross(T[0], [0.0, 1.0, 0.0]);
    if np.linalg.norm(n) < 1e-3: n = np.cross(T[0], [1.0, 0.0, 0.0])
    n /= np.linalg.norm(n)
    Ns = [n]
    for i in range(1, N):
        n = Ns[-1] - np.dot(Ns[-1], T[i]) * T[i]; n /= np.linalg.norm(n); Ns.append(n)
    Ns = np.array(Ns)
    if closed:  # distribute holonomy
        n_end = Ns[-1] - np.dot(Ns[-1], T[0]) * T[0]; n_end /= np.linalg.norm(n_end)
        ang = math.atan2(np.dot(np.cross(n_end, Ns[0]), T[0]), np.dot(n_end, Ns[0]))
        for i in range(N):
            a = ang * i / N; b = np.cross(T[i], Ns[i])
            Ns[i] = Ns[i] * math.cos(a) + b * math.sin(a)
    B = np.cross(T, Ns)
    v = np.linspace(0, 2 * np.pi, nv, endpoint=False)
    P = np.zeros((N, nv, 3))
    for i in range(N):
        rr = radius_fn(i / N) if radius_fn else radius
        P[i] = path[i] + rr * (np.cos(v)[:, None] * Ns[i] + np.sin(v)[:, None] * B[i])
    F = grid_faces(N, nv, closed, True)
    P = P.reshape(-1, 3)
    if not closed:  # cap ends with a fan to keep it watertight-ish
        c0 = len(P); c1 = c0 + 1
        P = np.vstack([P, path[0], path[-1]])
        for j in range(nv):
            F.append((c0, (j + 1) % nv, j))
            F.append((c1, (N - 1) * nv + j, (N - 1) * nv + (j + 1) % nv))
    return P, F

def floor_disc(R=30.0, K=110, S=192):
    P = [(0, 0, 0)]
    for k in range(1, K + 1):
        r = R * (k / K) ** 2
        for s in range(S):
            a = 2 * np.pi * s / S
            P.append((r * np.cos(a), 0, r * np.sin(a)))
    F = [(0, 1 + (s + 1) % S, 1 + s) for s in range(S)]
    for k in range(K - 1):
        for s in range(S):
            a = 1 + k * S + s; b = 1 + k * S + (s + 1) % S
            F.append((a, b, b + S, a + S))
    return np.array(P), F

def rot_y(P, a):
    c, s = math.cos(a), math.sin(a)
    M = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return P @ M.T
def rot_x(P, a):
    c, s = math.cos(a), math.sin(a)
    M = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    return P @ M.T
def rot_z(P, a):
    c, s = math.cos(a), math.sin(a)
    M = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    return P @ M.T
def place(P, M3, t):
    return P @ np.asarray(M3).T + np.asarray(t)

# ---------------------------------------------------------------- scenes
def scene_kaleido():
    """Bold, radially mirrored (8-fold) sculpture: chunky petals, an upright crown, pearls and one gyroscope ring."""
    parts = []; layers = []
    def layer(axis, pivot, speed):
        layers.append({"axis": axis, "pivot": pivot, "speed": speed}); return len(layers)  # 1-based
    L_pet = layer([0, 1, 0], [0, 0, 0], 0.14)
    L_crown = layer([0, 1, 0], [0, 0, 0], -0.2)
    L_ring = layer([0.0, 1.0, 0.0], [0, 0, 0], 0.3)
    L_orb = layer([0, 1, 0], [0, 0, 0], -0.06)
    parts.append(Part("floor", *floor_disc(), slot=7, mat=0, layer=0))
    P, F = sphere(1.0, 96, 32, (1.9, 0.26, 1.9)); parts.append(Part("pedestal", P + [0, 0.1, 0], F, slot=4, mat=0, layer=0))
    P, F = torus(1.85, 0.2, 128, 28); parts.append(Part("pedestal_rim", P + [0, 0.22, 0], F, slot=3, mat=1, layer=0))
    P, F = sphere(0.78, 64, 32); parts.append(Part("core", P + [0, 1.4, 0], F, slot=0, mat=2, layer=L_crown))
    P, F = sphere(1.0, 48, 24, (0.34, 0.9, 0.34)); parts.append(Part("stem", P + [0, 0.75, 0], F, slot=5, mat=1, layer=0))
    N = 8
    for k in range(N):
        a = 2 * np.pi * k / N
        P, F = sphere(1.0, 56, 28, (1.0, 0.3, 0.52))
        P = rot_z(P + [1.0, 0, 0], math.radians(24))
        P = rot_y(P, a) + [0, 1.0, 0]
        parts.append(Part(f"petal{k}", P, F, slot=1 if k % 2 == 0 else 2, mat=0, layer=L_pet))
        P, F = sphere(0.24, 40, 20)
        P = rot_y(P + [2.12, 0, 0], a) + [0, 1.88, 0]
        parts.append(Part(f"tip{k}", P, F, slot=3 if k % 2 == 0 else 0, mat=1, layer=L_pet))
        P, F = sphere(1.0, 40, 20, (0.2, 0.62, 0.2))
        P = rot_z(P + [0, 0.5, 0], math.radians(-26))
        P = rot_y(P + [0.0, 0, 0], a + np.pi / N) + [0, 1.75, 0]
        parts.append(Part(f"crown{k}", P, F, slot=5 if k % 2 == 0 else 3, mat=1, layer=L_crown))
        r = 0.32 if k % 2 == 0 else 0.22
        P, F = sphere(r, 40, 20)
        P = rot_y(P + [3.05, 0, 0], a + np.pi / N * 0.5) + [0, r, 0]
        parts.append(Part(f"orb{k}", P, F, slot=[1, 4, 2, 0][k % 4], mat=1 if k % 2 else 2, layer=L_orb))
    P, F = torus(2.45, 0.11, 192, 20); P = rot_x(P, math.radians(16)) + [0, 1.45, 0]
    parts.append(Part("ring", P, F, slot=5, mat=3, layer=L_ring))
    for i, (x, z, r, s, m) in enumerate([(-4.8, 1.4, 0.8, 2, 0), (4.4, -2.9, 0.55, 1, 1), (-3.6, -4.2, 0.45, 4, 2)]):
        P, F = sphere(r, 48, 24); parts.append(Part(f"prop{i}", P + [x, r, z], F, slot=s, mat=m, layer=0))
    camera = {"type": "orbit", "target": [0, 1.2, 0], "radius": 6.3, "height": 2.55, "fov": 37, "speed": 0.045, "bob": 0.3, "focus": 6.3}
    return parts, layers, camera, 1.4

def scene_plasma():
    parts = []; layers = []
    tilt = math.radians(-22)
    axis = rot_z(np.array([[0, 1.0, 0]]), tilt)[0]
    center = np.array([0, 1.75, 0])
    layers.append({"axis": axis.tolist(), "pivot": center.tolist(), "speed": 0.32})   # rope spin (strands flow)
    layers.append({"axis": axis.tolist(), "pivot": center.tolist(), "speed": -0.18})  # companion torus
    parts.append(Part("floor", *floor_disc(), slot=7, mat=0, layer=0))
    R, a0, k, S = 1.35, 0.42, 3, 13
    u = np.linspace(0, 2 * np.pi, 720, endpoint=False)
    for s in range(S):
        ph = 2 * np.pi * s / S + k * u
        rr = a0 * (0.92 + 0.08 * np.cos(3 * ph))
        x = (R + rr * np.cos(ph)) * np.cos(u); z = (R + rr * np.cos(ph)) * np.sin(u); y = rr * np.sin(ph) * 1.15
        path = np.stack([x, y, z], -1)
        P, F = tube_along(path, 0.115, 14, True)
        P = rot_z(P, tilt) + center
        slot = [0, 1, 2, 0, 1, 3, 0, 1, 2, 0, 1, 3, 4][s]
        parts.append(Part(f"strand{s}", P, F, slot=slot, mat=1 if s % 3 else 0, layer=1))
    P, F = torus(1.05, 0.2, 128, 32); P = rot_x(P, np.pi / 2); P = rot_z(P, tilt) + center + rot_z(np.array([[1.35, 0, 0]]), tilt)[0]
    parts.append(Part("link_torus", P, F, slot=5, mat=2, layer=0))
    for i, (x, z, r, s, m) in enumerate([(2.6, 1.2, 0.55, 3, 1), (-2.4, 1.7, 0.36, 4, 2), (3.4, -1.6, 0.28, 0, 1), (-1.5, -2.6, 0.8, 2, 0), (1.0, 2.6, 0.22, 1, 1)]):
        P, F = sphere(r, 48, 24); parts.append(Part(f"orb{i}", P + [x, r, z], F, slot=s, mat=m, layer=0))
    camera = {"type": "orbit", "target": [0, 1.5, 0], "radius": 7.0, "height": 2.5, "fov": 38, "speed": 0.035, "bob": 0.25, "focus": 7.0}
    return parts, layers, camera, 1.2

def tunnel_path(n):
    th = np.linspace(0, 2 * np.pi, n, endpoint=False)
    R = 26.0
    x = R * np.cos(th) + 3.0 * np.cos(3 * th)
    z = R * np.sin(th) + 3.0 * np.sin(2 * th)
    y = 2.2 * np.sin(2 * th) + 0.8 * np.sin(5 * th)
    return np.stack([x, y, z], -1)

def scene_tunnel():
    parts = []; layers = []
    st = 110
    path = tunnel_path(st)
    fine = tunnel_path(1800)
    for i in range(st):
        p = path[i]
        t, n, b = frame_from(path[(i + 1) % st] - path[i - 1])
        band = (i // 2) % 5
        slot = [0, 1, 2, 3, 4][band]
        twist = i * 0.21
        thick = 0.42 if i % 2 == 0 else 0.24
        Rr = 2.65 if i % 2 == 0 else 2.95
        P, F = torus(Rr, thick, 96, 24 if thick > 0.3 else 18, sx=1.0, sy=0.78)  # elliptical ring in XZ plane
        P = rot_y(P, twist)
        # ring plane XZ -> plane spanned by (n, b), axis = t
        M = np.stack([n, t, b], 1)  # columns: x->n, y->t, z->b
        P = place(P, M, p)
        parts.append(Part(f"ring{i}", P, F, slot=slot, mat=1 if i % 2 == 0 else 2, layer=0))
    # double helix of glossy tubes riding just outside the rings
    for h in range(2):
        pts = []
        Nf = len(fine)
        for j in range(Nf):
            p = fine[j]; t, n, b = frame_from(fine[(j + 1) % Nf] - fine[j - 1])
            a = 2 * np.pi * j / Nf * 46 + h * np.pi
            pts.append(p + 3.25 * (np.cos(a) * n + 0.8 * np.sin(a) * b))
        P, F = tube_along(np.array(pts), 0.16, 14, True)
        parts.append(Part(f"helix{h}", P, F, slot=5 if h == 0 else 3, mat=1, layer=0))
    # pearls clinging to the inside of rings
    for i in range(0, st, 3):
        p = path[i]; t, n, b = frame_from(path[(i + 1) % st] - path[i - 1])
        a = RNG.uniform(0, 2 * np.pi)
        r = RNG.uniform(0.25, 0.42)
        c = p + (2.25 - r) * (np.cos(a) * n + 0.78 * np.sin(a) * b) + t * RNG.uniform(-0.4, 0.4)
        P, F = sphere(r, 32, 16)
        parts.append(Part(f"pearl{i}", P + c, F, slot=int(RNG.integers(0, 5)), mat=2 if i % 2 else 1, layer=0))
    # camera loop: centre line, looking 7 units ahead
    cam_n = 1200
    cp = tunnel_path(cam_n)
    look = 30
    samples = [{"p": cp[j].tolist(), "t": cp[(j + look) % cam_n].tolist()} for j in range(cam_n)]
    camera = {"type": "path", "fov": 62, "durationSec": 150, "loop": True, "samples": samples, "focus": 7.5}
    return parts, layers, camera, 1.8

# ---------------------------------------------------------------- Blender: build, AO bake, export
def to_blender(P):  # author Y-up -> Blender Z-up (proper rotation)
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], -1)
def from_blender(B):
    return np.stack([B[:, 0], B[:, 2], -B[:, 1]], -1)

def build_objects(parts):
    objs = []
    for pt in parts:
        me = bpy.data.meshes.new(pt.name)
        me.from_pydata(to_blender(pt.P).tolist(), [], [tuple(f) for f in pt.faces])
        me.update()
        ob = bpy.data.objects.new(pt.name, me)
        bpy.context.scene.collection.objects.link(ob)
        bm = bmesh.new(); bm.from_mesh(me)
        if pt.name != "floor":
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        else:
            for f in bm.faces:
                if f.normal.z < 0: f.normal_flip()
        bm.to_mesh(me); bm.free()
        for poly in me.polygons: poly.use_smooth = True
        me.update()
        objs.append(ob)
    return objs

def bake_ao(objs, distance):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    dev = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = "GPU"; dev = "GPU(Metal)"
    except Exception as e:
        print("GPU unavailable:", e)
    sc.cycles.samples = SAMPLES
    if sc.world is None: sc.world = bpy.data.worlds.new("W")
    sc.world.light_settings.distance = distance
    mat = bpy.data.materials.new("Bake")
    for ob in objs:
        ob.data.materials.clear(); ob.data.materials.append(mat)
        a = ob.data.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="POINT")
        ob.data.color_attributes.active_color = a
    sc.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs: ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    t0 = time.time()
    bpy.ops.object.bake(type="AO")
    return time.time() - t0, dev

def extract(ob, pt):
    me = ob.data
    nv = len(me.vertices)
    co = np.zeros(nv * 3); me.vertices.foreach_get("co", co)
    nr = np.zeros(nv * 3); me.vertex_normals.foreach_get("vector", nr) if hasattr(me, "vertex_normals") else me.vertices.foreach_get("normal", nr)
    ao = np.ones(nv)
    if "AO" in me.color_attributes:
        c = np.zeros(nv * 4, np.float32); me.color_attributes["AO"].data.foreach_get("color", c); ao = c.reshape(-1, 4)[:, 0]
    me.calc_loop_triangles()
    tri = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get("vertices", tri)
    P = from_blender(co.reshape(-1, 3)); N = from_blender(nr.reshape(-1, 3))
    col = np.stack([ao, np.full(nv, pt.slot / 7), np.full(nv, pt.mat / 3), np.full(nv, pt.layer / 7)], -1)
    return P.astype(np.float32), N.astype(np.float32), col, tri.astype(np.uint32)

def write_glb(path, meshes):
    bin_parts, views, accs, prims = [], [], [], []
    off = 0
    def view(data, target, stride=None):
        nonlocal off
        pad = (-len(data)) % 4
        bin_parts.append(data + b"\x00" * pad)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target}
        if stride: v["byteStride"] = stride
        views.append(v); off += len(data) + pad; return len(views) - 1
    for name, P, N, C, I in meshes:
        n8 = np.concatenate([np.clip(np.round(N * 127), -127, 127).astype(np.int8), np.zeros((len(N), 1), np.int8)], 1)
        c8 = np.clip(np.round(C * 255), 0, 255).astype(np.uint8)
        vp = view(P.tobytes(), 34962); vn = view(n8.tobytes(), 34962, 4); vc = view(c8.tobytes(), 34962); vi = view(I.tobytes(), 34963)
        accs += [{"bufferView": vp, "componentType": 5126, "count": len(P), "type": "VEC3", "min": P.min(0).tolist(), "max": P.max(0).tolist()},
                 {"bufferView": vn, "componentType": 5120, "normalized": True, "count": len(P), "type": "VEC3"},
                 {"bufferView": vc, "componentType": 5121, "normalized": True, "count": len(P), "type": "VEC4"},
                 {"bufferView": vi, "componentType": 5125, "count": int(I.size), "type": "SCALAR"}]
        k = len(accs)
        prims.append({"attributes": {"POSITION": k - 4, "NORMAL": k - 3, "COLOR_0": k - 2}, "indices": k - 1, "mode": 4})
    binary = b"".join(bin_parts)
    g = {"asset": {"version": "2.0", "generator": "flow-engine tools/blender/studio_scenes.py (MIT)"},
         "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": SCENE}],
         "meshes": [{"name": SCENE, "primitives": prims, "extras": {"COLOR_0": "R=AO(Cycles) G=slot/7 B=material/3 A=layer/7"}}],
         "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(binary)}]}
    js = json.dumps(g, separators=(",", ":")).encode(); js += b" " * ((-len(js)) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(binary), 0x004E4942)); f.write(binary)
    return os.path.getsize(path)

def preview(objs, camera, path):
    """Workbench clay preview with cavity + shadow, for a quick geometry sanity check."""
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"; sh.color_type = "VERTEX"; sh.show_cavity = True; sh.show_shadows = True
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); sc.collection.objects.link(cam); sc.camera = cam
    if camera["type"] == "orbit":
        t = np.array(camera["target"]); a = 0.6
        p = t + np.array([math.sin(a) * camera["radius"], camera["height"] - t[1] + 0.3, math.cos(a) * camera["radius"]])
        cam.data.angle = math.radians(camera["fov"]) * 16 / 9 * 0.62
    else:
        s = camera["samples"][0]; p, t = np.array(s["p"]), np.array(s["t"])
        cam.data.angle = math.radians(camera["fov"]) * 1.4
    pb, tb = to_blender(p[None])[0], to_blender(t[None])[0]
    from mathutils import Vector
    d = Vector(tb.tolist()) - Vector(pb.tolist())
    cam.location = pb.tolist(); cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parts, layers, camera, ao_dist = {"kaleido": scene_kaleido, "plasma": scene_plasma, "tunnel": scene_tunnel}[SCENE]()
    objs = build_objects(parts)
    bake_s, dev = bake_ao(objs, ao_dist)
    meshes = []
    aos = []
    for ob, pt in zip(objs, parts):
        P, N, C, I = extract(ob, pt); meshes.append((pt.name, P, N, C, I)); aos.append(C[:, 0])
    glb = os.path.join(OUT, f"{SCENE}.glb")
    size = write_glb(glb, meshes)
    allP = np.concatenate([m[1] for m in meshes])
    meta = {"scene": SCENE, "layers": layers, "camera": camera,
            "bounds": {"min": allP.min(0).tolist(), "max": allP.max(0).tolist()},
            "stats": {"parts": len(parts), "verts": int(sum(len(m[1]) for m in meshes)), "tris": int(sum(m[4].size for m in meshes) // 3),
                      "glbBytes": size, "ao": "cycles", "aoDevice": dev, "aoSamples": SAMPLES, "aoDistance": ao_dist,
                      "aoBakeSec": round(bake_s, 1), "aoMean": float(np.concatenate(aos).mean()), "buildSec": round(time.time() - t0, 1)},
            "license": "MIT (flow-engine, procedural)"}
    with open(os.path.join(OUT, f"{SCENE}.json"), "w") as f: json.dump(meta, f, separators=(",", ":"))
    # vertex-color preview: AO only
    for ob in objs:
        ob.data.color_attributes.active_color = ob.data.color_attributes["AO"]
    try:
        preview(objs, camera, os.path.join(OUT, f"{SCENE}-blender-ao.png"))
    except Exception as e:
        print("preview failed:", e)
    print("STUDIO_SCENE", json.dumps(meta["stats"]))

main()

# Pass 5 "Jungle / Flower Vortex" (realism pass): procedural flora library authored in Blender (headless, numpy parametric
# surfaces -> Blender meshes), Cycles AO baked into vertex colours, exported as one compact binary of prototypes
# that the engine instances thousands of times with GPU animation (petals opening, leaves swaying, vortex flow).
#   flowers: phalaenopsis orchid (sepals, petals, 3-lobed lip, column), hibiscus (ruffled, stamen column),
#            heliconia (zig-zag rachis of boat-shaped bracts), plumeria (5 twisted obovate petals), bromeliad (rosette + bracts)
#   leaves : monstera (fenestrated), palm frond (arched rachis, 2x44 leaflets), fern frond, banana leaf, alocasia
#   petals and bracts are solid: a back sheet offset along the surface normal plus a rim strip gives real thickness
# Per vertex: pos3 nrm3 uv2 part bend hingeX hingeZ tone ao  (14 float32).  part: 0 petal 1 centre/stamen 2 leaf 3 stem
# Run: blender -b --factory-startup -P jungle_flora.py -- OUT_DIR
# Original MIT-licensed work for flow-engine.
import bpy, bmesh, sys, os, json, math, time
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def grid_faces(nu, nv):
    f = []
    for j in range(nv - 1):
        for i in range(nu - 1):
            a = j * nu + i; f.append((a, a + 1, a + nu + 1, a + nu))
    return f

class Part:
    def __init__(self): self.P = []; self.F = []; self.A = []; self.n = 0   # A: u v part bend hx hz tone
    def add(self, P, F, A):
        self.P.append(P); self.F += [tuple(x + self.n for x in f) for f in F]; self.A.append(A); self.n += len(P)
    def arrays(self): return np.concatenate(self.P), self.F, np.concatenate(self.A)

def rot_x(P, a): c, s = math.cos(a), math.sin(a); return P @ np.array([[1, 0, 0], [0, c, s], [0, -s, c]])
def rot_y(P, a): c, s = math.cos(a), math.sin(a); return P @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])

def petal(L, W, cup=0.3, curl=0.15, ruffle=0.0, tip=1.0, notch=0.0, nu=9, nv=16, base_w=0.12):
    u = np.linspace(-1, 1, nu); v = np.linspace(0, 1, nv)
    U, Vv = np.meshgrid(u, v)
    w = W * (base_w + (1 - base_w) * np.sin(np.pi * np.clip(Vv, 0, 1) ** 0.75) ** 0.6) * (1 - 0.92 * Vv ** (2 + 6 * (1 - tip)))
    z = Vv * L * (1 - notch * np.exp(-(U / 0.3) ** 2) * Vv ** 10)
    x = U * w
    y = cup * U ** 2 * w + curl * L * Vv ** 2 + ruffle * W * 0.22 * np.sin(U * 7 + Vv * 11) * Vv ** 1.5
    P = np.stack([x, y, z], -1).reshape(-1, 3)
    A = np.stack([(U * 0.5 + 0.5), Vv], -1).reshape(-1, 2)
    return P, grid_faces(nu, nv), A

def place_petal(part, P, F, UV, az, tilt, tone, lift=0.0, r0=0.0):
    Q = P.copy(); Q[:, 2] += r0
    Q = rot_x(Q, -tilt); Q[:, 1] += lift; Q = rot_y(Q, az)
    hx, hz = math.sin(az), math.cos(az)
    A = np.column_stack([UV, np.zeros(len(P)), UV[:, 1], np.full(len(P), hx), np.full(len(P), hz), np.full(len(P), tone)])
    part.add(Q, F, A)

def disc(part, R, H, nr=10, na=28, bumps=0.0, partid=1, y0=0.0):
    r = np.linspace(0, 1, nr); a = np.linspace(0, 2 * np.pi, na, endpoint=False)
    Rr, Aa = np.meshgrid(r, a, indexing='ij')
    y = y0 + H * (1 - Rr ** 2) + bumps * np.sin(Rr * 40) * np.sin(Aa * 13 + Rr * 30) * (1 - Rr) * 0.5
    P = np.stack([Rr * R * np.cos(Aa), y, Rr * R * np.sin(Aa)], -1).reshape(-1, 3)
    F = []
    for i in range(nr - 1):
        for j in range(na):
            a0 = i * na + j; a1 = i * na + (j + 1) % na; F.append((a0, a0 + na, a1 + na, a1))
    A = np.column_stack([Rr.ravel(), Aa.ravel() / (2 * np.pi), np.full(len(P), partid), 1 - Rr.ravel(), np.zeros(len(P)), np.ones(len(P)), np.zeros(len(P))])
    part.add(P, F, A)

def tube(part, pts, rad, nv=8, partid=3, tone=0.0):
    pts = np.asarray(pts, float); n = len(pts); P = []; F = []
    for i in range(n):
        t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]; t /= np.linalg.norm(t) + 1e-9
        a = np.array([1.0, 0, 0]) if abs(t[0]) < 0.9 else np.array([0, 0, 1.0])
        b1 = np.cross(t, a); b1 /= np.linalg.norm(b1); b2 = np.cross(t, b1)
        r = rad(i / (n - 1)) if callable(rad) else rad
        for k in range(nv):
            th = 2 * np.pi * k / nv; P.append(pts[i] + r * (np.cos(th) * b1 + np.sin(th) * b2))
    for i in range(n - 1):
        for k in range(nv):
            a0 = i * nv + k; a1 = i * nv + (k + 1) % nv; F.append((a0, a1, a1 + nv, a0 + nv))
    P = np.array(P); idx = np.repeat(np.arange(n) / (n - 1), nv)
    A = np.column_stack([np.tile(np.arange(nv) / nv, n), idx, np.full(len(P), partid), idx, np.zeros(len(P)), np.ones(len(P)), np.full(len(P), tone)])
    part.add(P, F, A)

def blob(part, c, r, partid=1, tone=0.0, nu=10, nv=7):
    a = np.linspace(0, 2 * np.pi, nu, endpoint=False); b = np.linspace(0.15, np.pi - 0.15, nv)
    B, Aa = np.meshgrid(b, a, indexing='ij')
    P = np.stack([np.sin(B) * np.cos(Aa), np.cos(B), np.sin(B) * np.sin(Aa)], -1).reshape(-1, 3) * r + np.asarray(c)
    F = []
    for i in range(nv - 1):
        for j in range(nu):
            a0 = i * nu + j; a1 = i * nu + (j + 1) % nu; F.append((a0, a1, a1 + nu, a0 + nu))
    A = np.column_stack([np.zeros(len(P)), np.ones(len(P)), np.full(len(P), partid), np.ones(len(P)), np.zeros(len(P)), np.ones(len(P)), np.full(len(P), tone)])
    part.add(P, F, A)


def sheet_normals(P, nu, nv):
    G = P.reshape(nv, nu, 3)
    du = np.gradient(G, axis=1); dv = np.gradient(G, axis=0)
    N = np.cross(du, dv); N /= (np.linalg.norm(N, axis=-1, keepdims=True) + 1e-9); return N.reshape(-1, 3)

def solid_petal(part, P, UV, nu, nv, az, tilt, tone, lift=0.0, r0=0.0, thick=0.014, twist=0.0, partid=0):
    """Place a petal grid as a closed solid: front sheet, back sheet offset along -normal, rim around the outline."""
    Q = P.copy()
    if twist:
        a = twist * UV[:, 1]; c, s = np.cos(a), np.sin(a); x, y = Q[:, 0].copy(), Q[:, 1].copy(); Q[:, 0] = x * c - y * s; Q[:, 1] = x * s + y * c
    N = sheet_normals(Q, nu, nv)
    t = thick * (1.0 - 0.6 * UV[:, 1:2])                     # thinner toward the tip
    B = Q - N * t
    allP = np.vstack([Q, B]); n = len(Q)
    F = grid_faces(nu, nv); Fb = [tuple(x + n for x in f[::-1]) for f in F]
    ring = [j * nu for j in range(nv)] + [(nv - 1) * nu + i for i in range(1, nu)] + [j * nu + nu - 1 for j in range(nv - 2, -1, -1)]
    Fr = [(ring[k + 1], ring[k], ring[k] + n, ring[k + 1] + n) for k in range(len(ring) - 1)]
    allP[:, 2] += r0
    allP = rot_x(allP, -tilt); allP[:, 1] += lift; allP = rot_y(allP, az)
    hx, hz = math.sin(az), math.cos(az)
    UV2 = np.vstack([UV, UV])
    A = np.column_stack([UV2, np.full(2 * n, partid), UV2[:, 1], np.full(2 * n, hx), np.full(2 * n, hz), np.full(2 * n, tone)])
    part.add(allP, F + Fb + Fr, A)

# ---------------- flowers (face +Y, unit-ish radius)
def orchid():
    p = Part()
    P, _, UV = petal(0.82, 0.2, cup=0.12, curl=-0.06, tip=0.8, nu=7, nv=12, base_w=0.25)        # sepals
    for az in (0.0, 2.2, 4.08): solid_petal(p, P, UV, 7, 12, az, 0.12, 0.0, r0=0.05)
    P, _, UV = petal(0.72, 0.5, cup=0.1, curl=-0.04, tip=0.05, nu=11, nv=14, base_w=0.08)       # broad petals
    for az in (1.1, -1.1): solid_petal(p, P, UV, 11, 14, az, 0.16, 0.25, lift=0.02, r0=0.03)
    u = np.linspace(-1, 1, 11); v = np.linspace(0, 1, 12); U, Vv = np.meshgrid(u, v)          # 3-lobed lip
    w = 0.32 * (0.35 + 0.65 * np.sin(np.pi * Vv) ** 0.8) * (1 + 0.5 * np.exp(-((Vv - 0.35) / 0.12) ** 2))
    X = U * w; Y = 0.25 * U ** 2 * w + 0.12 * Vv ** 2 - 0.05 * np.exp(-((Vv - 0.8) / 0.1) ** 2) * (1 - U ** 2); Z = Vv * 0.48
    LP = np.stack([X, Y, Z], -1).reshape(-1, 3); LUV = np.stack([U * 0.5 + 0.5, Vv], -1).reshape(-1, 2)
    solid_petal(p, LP, LUV, 11, 12, math.pi, 0.5, 1.0, lift=0.05, r0=0.02, thick=0.02)
    blob(p, [0, 0.12, 0.06], 0.06, partid=1, tone=0.6, nu=10, nv=6)                            # column
    tube(p, [[0, 0, -0.05], [0, -0.4, -0.15], [0.05, -0.9, -0.1]], 0.025)
    return p
def hibiscus():
    p = Part()
    P, _, UV = petal(1.05, 0.62, cup=0.22, curl=0.08, ruffle=0.35, tip=0.0, nu=13, nv=18, base_w=0.08)
    for i in range(5): solid_petal(p, P, UV, 13, 18, 2 * np.pi * i / 5 + 0.1, 0.35, i / 5.0, twist=0.15)
    col = [[0, 0, 0], [0.02, 0.35, 0.03], [0.05, 0.7, 0.08], [0.08, 1.0, 0.15]]
    tube(p, col, lambda t: 0.035 * (1 - 0.4 * t), partid=1, tone=0.0)
    for k in range(18):
        a = 2 * np.pi * k / 18; blob(p, [0.08 + 0.08 * np.cos(a), 0.92 + 0.1 * np.sin(a * 2) + 0.05 * k / 18, 0.15 + 0.08 * np.sin(a)], 0.024, partid=1, tone=1.0, nu=6, nv=4)
    for k in range(5):
        a = 2 * np.pi * k / 5; blob(p, [0.1 + 0.05 * np.cos(a), 1.08, 0.16 + 0.05 * np.sin(a)], 0.03, partid=1, tone=0.3, nu=6, nv=4)
    tube(p, [[0, 0, 0], [0, -0.5, 0.05], [0, -0.9, 0.1]], 0.035)
    return p
def heliconia():
    p = Part(); n = 8
    rach = np.array([[0.08 * ((i % 2) * 2 - 1), 0.0, 0.22 * i] for i in range(n + 1)])
    tube(p, np.vstack([[0, 0, -1.0], rach]), 0.03, partid=3)
    for i in range(n):
        L = 0.75 - 0.055 * i
        P, _, UV = petal(L, 0.16, cup=0.95, curl=0.18, tip=0.9, nu=9, nv=14, base_w=0.35)
        s = 1 if i % 2 else -1
        Q = P.copy(); Q = rot_x(Q, -1.15); Q = rot_y(Q, s * 1.35); Q[:, 2] += rach[i][2] - 0.4; Q[:, 0] += rach[i][0]
        N = sheet_normals(Q, 9, 14); B = Q - N * 0.018; allP = np.vstack([Q, B]); m = len(Q)
        F = grid_faces(9, 14); Fb = [tuple(x + m for x in f[::-1]) for f in F]
        UV2 = np.vstack([UV, UV]); A = np.column_stack([UV2, np.zeros(2 * m), UV2[:, 1] * 0.35, np.full(2 * m, math.sin(s * 1.35)), np.full(2 * m, math.cos(s * 1.35)), np.full(2 * m, i / n)])
        p.add(allP, F + Fb, A)
    P = p.arrays()[0]; return p
def plumeria():
    p = Part()
    P, _, UV = petal(0.8, 0.46, cup=-0.08, curl=-0.12, tip=0.0, nu=11, nv=15, base_w=0.12)
    for i in range(5): solid_petal(p, P, UV, 11, 15, 2 * np.pi * i / 5, 0.32, i / 5.0, twist=0.55, lift=0.01 * i, r0=0.02)
    tube(p, [[0, 0.02, 0], [0, -0.5, 0.05], [0, -0.9, 0.1]], 0.03)
    return p
def bromeliad():
    p = Part()
    for i in range(20):                                         # rosette of arching strap leaves (leaf part)
        az = i * 2.39996; k = i / 20
        u = np.linspace(-1, 1, 7); v = np.linspace(0, 1, 18); U, Vv = np.meshgrid(u, v)
        w = 0.11 * (1 - Vv ** 3) + 0.01; L = 1.0 + 0.3 * (1 - k)
        X = U * w; Y = L * (0.9 * Vv - (0.75 + 0.3 * k) * Vv ** 2) - 0.12 * np.abs(U) * w; Z = L * 0.62 * Vv
        Q = np.stack([X, Y + 0.05, Z], -1).reshape(-1, 3); Q = rot_y(Q, az)
        A = np.column_stack([(U * 0.5 + 0.5).ravel(), Vv.ravel(), np.full(Q.shape[0], 2), Vv.ravel(), np.zeros(Q.shape[0]), np.ones(Q.shape[0]), np.full(Q.shape[0], 0.8)])
        p.add(Q, grid_faces(7, 18), A)
    P, _, UV = petal(0.42, 0.1, cup=0.6, curl=-0.1, tip=1.0, nu=7, nv=10, base_w=0.4)        # central bracts
    for i in range(10): solid_petal(p, P, UV, 7, 10, i * 2.39996, 0.25 + 0.06 * (i % 3), 0.5, lift=0.08, thick=0.012)
    for k in range(12): a = k * 2.39996; blob(p, [0.05 * np.cos(a), 0.2 + 0.02 * k, 0.05 * np.sin(a)], 0.025, partid=1, tone=0.3, nu=6, nv=4)
    return p
# ---------------- leaves (length along +Z, up +Y)
def leaf_surface(p, L, W, shape, fold, droop, serr=0.0, slits=0, tears=0, nu=17, nv=30, tone=0.0):
    u = np.linspace(-1, 1, nu); v = np.linspace(0, 1, nv)
    U, Vv = np.meshgrid(u, v)
    if shape == 'heart': w = W * (np.sin(np.pi * Vv ** 0.62) ** 0.7 + 0.45 * np.exp(-((Vv - 0.04) / 0.07) ** 2))
    elif shape == 'long': w = W * np.sin(np.pi * Vv ** 0.85) ** 0.35 * (1 - Vv ** 6)
    else: w = W * np.sin(np.pi * Vv ** 0.7) ** 0.75
    x = U * w
    y = -fold * np.abs(U) * w * 0.6 - droop * L * Vv ** 2 + serr * W * 0.06 * np.sin(Vv * 70) * np.abs(U) ** 3 + 0.04 * W * np.sin(Vv * 9 + U * 2) * np.abs(U)
    z = Vv * L - (0.18 * W * (1 - Vv) if shape == 'heart' else 0) * (U ** 2)
    P = np.stack([x, y, z], -1).reshape(-1, 3)
    F = grid_faces(nu, nv)
    keep = []
    for j in range(nv - 1):
        for i in range(nu - 1):
            uu = abs(u[i] + u[i + 1]) / 2; vv = (v[j] + v[j + 1]) / 2
            cut = False
            # slits run perpendicular to the midrib along whole face rows, so their edges stay clean
            if slits and uu > 0.42 and 0.12 < vv < 0.92 and j % max(2, (nv - 1) // slits) == 1: cut = True
            if tears and uu > 0.2 and j % max(3, (nv - 1) // tears) == 2 and ((u[i] > 0) == (j % 2 == 0)): cut = True
            if not cut: keep.append(F[j * (nu - 1) + i])
    A = np.column_stack([(U * 0.5 + 0.5).ravel(), Vv.ravel(), np.full(len(P), 2), Vv.ravel(), np.zeros(len(P)), np.ones(len(P)), np.full(len(P), tone)])
    p.add(P, keep, A)
def monstera():
    p = Part(); leaf_surface(p, 1.6, 0.75, 'heart', 0.12, 0.12, slits=5, nu=25, nv=36)
    tube(p, [[0, 0, -0.9], [0, 0.05, -0.4], [0, 0.02, 0.02]], 0.035); return p
def banana():
    p = Part(); leaf_surface(p, 2.2, 0.38, 'long', 0.35, 0.22, tears=4, nu=15, nv=40)
    tube(p, [[0, -0.02, -0.6], [0, 0, 0.0], [0, -0.05, 1.1], [0, -0.2, 2.1]], lambda t: 0.035 * (1 - 0.7 * t)); return p
def alocasia():
    p = Part(); leaf_surface(p, 1.5, 0.6, 'heart', 0.2, 0.08, serr=1.0, nu=21, nv=32, tone=0.6)
    tube(p, [[0, 0, -0.8], [0, 0.04, -0.3], [0, 0.02, 0.05]], 0.03); return p
def fern():
    p = Part(); n = 34
    rach = np.array([[0, 0.25 * np.sin(t * 2.4) * t - 0.25 * t ** 3, 2.0 * t] for t in np.linspace(0, 1, 40)])
    tube(p, rach, lambda t: 0.022 * (1 - 0.8 * t), partid=2)
    P0, F0, _ = petal(0.36, 0.07, cup=-0.1, curl=0.0, tip=1.0, nu=5, nv=8, base_w=0.5)
    for i in range(n):
        t = (i + 1.5) / (n + 2); c = rach[int(t * 39)]
        L = 1.0 - 0.85 * t
        for s in (-1, 1):
            Q = P0 * np.array([1, 1, L]); Q = rot_x(Q, 0.15); Q = rot_y(Q, s * (1.25 - 0.3 * t)); Q = Q + c
            UV = np.column_stack([np.tile(np.linspace(0, 1, 5), 8), np.repeat(np.linspace(0, 1, 8), 5)])
            A = np.column_stack([UV, np.full(len(Q), 2), np.full(len(Q), t * 0.6 + 0.4 * UV[:, 1]), np.zeros(len(Q)), np.ones(len(Q)), np.full(len(Q), 0.3)])
            p.add(Q, F0, A)
    return p

def palm():
    p = Part(); n = 44
    rach = np.array([[0, 0.55 * np.sin(t * 2.2) * t - 0.7 * t ** 2.2, 2.8 * t] for t in np.linspace(0, 1, 50)])
    tube(p, np.vstack([[0, -0.1, -0.6], rach]), lambda t: 0.04 * (1 - 0.8 * t), partid=2)
    for i in range(n):
        t = (i + 2) / (n + 3); c = rach[int(t * 49)]; L = 0.95 * np.sin(np.pi * (0.15 + 0.85 * t)) ** 0.7 + 0.15
        for s in (-1, 1):
            u = np.linspace(-1, 1, 3); v = np.linspace(0, 1, 9); U, Vv = np.meshgrid(u, v)
            w = 0.055 * np.sin(np.pi * Vv ** 0.6) ** 0.8; X = U * w; Y = -0.35 * L * Vv ** 2 - 0.25 * np.abs(U) * w; Z = Vv * L
            Q = np.stack([X, Y, Z], -1).reshape(-1, 3); Q = rot_x(Q, 0.25); Q = rot_y(Q, s * (1.05 + 0.25 * t)); Q = Q + c
            A = np.column_stack([(U * 0.5 + 0.5).ravel(), Vv.ravel(), np.full(len(Q), 2), (t * 0.5 + 0.5 * Vv).ravel(), np.zeros(len(Q)), np.ones(len(Q)), np.full(len(Q), 0.45)])
            p.add(Q, grid_faces(3, 9), A)
    return p

PROTOS = [('orchid', 'flower', orchid), ('hibiscus', 'flower', hibiscus), ('heliconia', 'flower', heliconia), ('plumeria', 'flower', plumeria),
          ('bromeliad', 'flower', bromeliad),
          ('monstera', 'leaf', monstera), ('palm', 'leaf', palm), ('banana', 'leaf', banana), ('alocasia', 'leaf', alocasia), ('fern', 'leaf', fern)]

def to_b(P): return np.stack([P[:, 0], -P[:, 2], P[:, 1]], -1)
def from_b(B): return np.stack([B[:, 0], B[:, 2], -B[:, 1]], -1)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
t0 = time.time(); objs = []; parts = []
for k, (name, kind, fn) in enumerate(PROTOS):
    P, F, A = fn().arrays()
    off = np.array([k * 6.0, 0, 0])
    me = bpy.data.meshes.new(name); me.from_pydata(to_b(P + off).tolist(), [], F); me.update()
    for poly in me.polygons: poly.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    objs.append(ob); parts.append((name, kind, A, off))
# Cycles AO bake into vertex colours
sc = bpy.context.scene; sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
for d in prefs.devices: d.use = True
sc.cycles.device = 'GPU'; sc.cycles.samples = 64
if sc.world is None: sc.world = bpy.data.worlds.new('W')
sc.world.light_settings.distance = 0.35
mat = bpy.data.materials.new('Bake')
for ob in objs:
    ob.data.materials.append(mat)
    a = ob.data.color_attributes.new(name='AO', type='FLOAT_COLOR', domain='POINT'); ob.data.color_attributes.active_color = a
sc.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for ob in objs: ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
tb = time.time(); bpy.ops.object.bake(type='AO'); bake_s = time.time() - tb
verts, idxs, meta = [], [], []
vo = io = 0
for ob, (name, kind, A, off) in zip(objs, parts):
    me = ob.data; nv = len(me.vertices)
    co = np.zeros(nv * 3); me.vertices.foreach_get('co', co)
    nr = np.zeros(nv * 3); me.vertices.foreach_get('normal', nr)
    c = np.zeros(nv * 4, np.float32); me.color_attributes['AO'].data.foreach_get('color', c); ao = c.reshape(-1, 4)[:, 0]
    me.calc_loop_triangles(); tri = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get('vertices', tri)
    P = from_b(co.reshape(-1, 3)) - off; N = from_b(nr.reshape(-1, 3))
    V = np.column_stack([P, N, A, ao]).astype(np.float32)
    assert V.shape[1] == 14
    verts.append(V); idxs.append(tri.astype(np.uint32))
    r = float(np.linalg.norm(P, axis=1).max())
    meta.append(dict(name=name, kind=kind, vOff=vo, vCount=nv, iOff=io, iCount=int(len(tri)), radius=round(r, 3), tris=int(len(tri) // 3), aoMean=round(float(ao.mean()), 3)))
    vo += nv; io += len(tri)
Vall = np.concatenate(verts); Iall = np.concatenate(idxs)
with open(os.path.join(OUT, 'jungle.bin'), 'wb') as fh: fh.write(Vall.tobytes()); fh.write(Iall.tobytes())
J = dict(scene='jungle', stride=14, layout='pos3 nrm3 uv2 part bend hingeX hingeZ tone ao', vertexBytes=int(Vall.nbytes), indexCount=int(len(Iall)), protos=meta,
         stats=dict(blender=bpy.app.version_string, ao='cycles', aoSamples=64, aoBakeSec=round(bake_s, 1), buildSec=round(time.time() - t0, 1), totalTris=int(len(Iall) // 3)))
json.dump(J, open(os.path.join(OUT, 'jungle.json'), 'w'), indent=1)
print('DONE', json.dumps(J['stats']), [(m['name'], m['tris']) for m in meta])
# preview lineup render (proof of the authored prototypes)
for ob, (name, kind, A, off) in zip(objs, parts):
    m = bpy.data.materials.new(name + '_m'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'AO'
    base = (0.95, 0.35, 0.45, 1) if kind == 'flower' else (0.18, 0.55, 0.3, 1)
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
    mix.inputs['A'].default_value = base; nt.links.new(ca.outputs['Color'], mix.inputs['B']); nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.45; ob.data.materials.clear(); ob.data.materials.append(m)
bpy.ops.object.camera_add(location=(27, -62, 14)); cam = bpy.context.object; cam.data.lens = 50
cam.rotation_euler = (math.radians(80), 0, 0); sc.camera = cam
bpy.ops.object.light_add(type='AREA', location=(20, -10, 12)); bpy.context.object.data.energy = 6000; bpy.context.object.data.size = 10
sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.85, 0.93, 0.9, 1)
sc.render.resolution_x, sc.render.resolution_y = 1600, 600; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.render.filepath = os.path.join(OUT, 'jungle5_prototypes.png'); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'jungle5_flora.blend'))
print('PREVIEW', sc.render.filepath)

# Pass 5 "City Vortex": procedural city kit authored in Blender (headless numpy geometry -> Blender meshes),
# Cycles AO baked to vertex colours, exported as one binary of prototypes that the engine instances on a
# cylindrical "city wall" around the camera (streets spiral, taxis drive, lights blink).
#   towers : setback octagon tower w/ spire, cylinder tower, twisted tower, slab tower w/ fins, stepped podium tower
#   street : road segment (asphalt, kerbs, sidewalks, dashed + edge lines), crosswalk segment, ground tile
#   props  : taxi, bus, traffic light, street lamp, sign, hydrant, bench
# Per vertex: pos3 nrm3 uv2 part code ex ey tone ao (14 float32). part ids:
#   0 curtain-wall glass (uv = metres around / up)  1 mullion metal  2 asphalt  3 road paint  4 taxi yellow
#   5 bus paint  6 emissive (code: 0 red 1 amber 2 green 3 lamp 4 head 5 tail 6 taxi sign)  7 concrete
#   8 rubber / black  9 chrome  10 vehicle glass  11 accent paint (tone picks colour)  12 ground plaza
# Frame: x lateral, y up (away from the city wall), z forward along the street.
# Run: blender -b --factory-startup -P city_parts.py -- OUT_DIR
# Original MIT-licensed work for flow-engine.
import bpy, sys, os, json, math, time
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; os.makedirs(OUT, exist_ok=True)

class Kit:
    def __init__(self): self.P, self.N, self.F, self.A = [], [], [], []; self.n = 0
    def add(self, P, N, F, A):
        P = np.asarray(P, float); N = np.asarray(N, float); A = np.asarray(A, float)
        self.P.append(P); self.N.append(N); self.A.append(A); self.F += [tuple(int(x) + self.n for x in f) for f in F]; self.n += len(P)
    def arrays(self): return np.concatenate(self.P), np.concatenate(self.N), self.F, np.concatenate(self.A)

def attrs(n, uv, part, code=0.0, tone=0.0):
    return np.column_stack([uv, np.full(n, part), np.full(n, code), np.zeros(n), np.zeros(n), np.full(n, tone)])

def quad(k, p0, p1, p2, p3, part, code=0.0, tone=0.0, uv=None):
    P = np.array([p0, p1, p2, p3], float); nrm = np.cross(P[1] - P[0], P[3] - P[0]); nrm /= (np.linalg.norm(nrm) + 1e-9)
    if uv is None: uv = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], float)
    k.add(P, np.tile(nrm, (4, 1)), [(0, 1, 2, 3)], attrs(4, uv, part, code, tone))

def rbox(k, c, h, r, part, code=0.0, tone=0.0, uvs=1.0):
    """Rounded box (bevel radius r) from a cube grid: p = clamp(q) + r*normalize(q - clamp(q))."""
    c = np.asarray(c, float); h = np.asarray(h, float); r = min(r, *(h * 0.98))
    def axis(hh): return np.array([-hh, -hh + 0.3 * r, -hh + 0.7 * r, -hh + r, hh - r, hh - 0.7 * r, hh - 0.3 * r, hh])
    for ax in range(3):
        for sgn in (-1, 1):
            a1, a2 = [(1, 2), (2, 0), (0, 1)][ax]
            u = axis(h[a1]); v = axis(h[a2]); U, V = np.meshgrid(u, v, indexing='ij')
            Q = np.zeros(U.shape + (3,)); Q[..., ax] = sgn * h[ax]; Q[..., a1] = U; Q[..., a2] = V
            inner = h - r; C = np.clip(Q, -inner, inner); D = Q - C; L = np.linalg.norm(D, axis=-1, keepdims=True) + 1e-9
            Pp = C + D / L * r; Nn = D / L
            nu, nv = U.shape; F = []
            for i in range(nu - 1):
                for j in range(nv - 1):
                    a = i * nv + j; f = (a, a + nv, a + nv + 1, a + 1)
                    F.append(f if sgn > 0 else f[::-1])
            uv = np.stack([(U + h[a1]) * uvs, (V + h[a2]) * uvs], -1).reshape(-1, 2)
            k.add(Pp.reshape(-1, 3) + c, Nn.reshape(-1, 3), F, attrs(nu * nv, uv, part, code, tone))

def cyl(k, c, rad, hgt, part, seg=24, code=0.0, tone=0.0, caps=True, axis='y', uvs=1.0):
    c = np.asarray(c, float); a = np.linspace(0, 2 * np.pi, seg + 1)
    ring = np.stack([np.cos(a), np.sin(a)], -1)
    def tr(x, y, z):  # local (radial-x, along, radial-z) -> world
        if axis == 'y': return np.stack([x, y, z], -1)
        if axis == 'x': return np.stack([y, x, z], -1)
        return np.stack([x, z, y], -1)
    P = np.concatenate([tr(ring[:, 0] * rad, np.zeros(seg + 1), ring[:, 1] * rad), tr(ring[:, 0] * rad, np.full(seg + 1, hgt), ring[:, 1] * rad)]) + c
    N = np.concatenate([tr(ring[:, 0], np.zeros(seg + 1), ring[:, 1])] * 2)
    F = [(i, i + seg + 1, i + seg + 2, i + 1) for i in range(seg)]
    uv = np.concatenate([np.stack([a * rad * uvs, np.zeros(seg + 1)], -1), np.stack([a * rad * uvs, np.full(seg + 1, hgt * uvs)], -1)])
    k.add(P, N, F, attrs(len(P), uv, part, code, tone))
    if caps:
        for yy, s in ((hgt, 1), (0, -1)):
            Pc = np.concatenate([tr(np.zeros(1), np.full(1, yy), np.zeros(1)), tr(ring[:-1, 0] * rad, np.full(seg, yy), ring[:-1, 1] * rad)]) + c
            Nc = np.tile(tr(np.zeros(1), np.full(1, float(s)), np.zeros(1)), (seg + 1, 1))
            Fc = [((0, 1 + i, 1 + (i + 1) % seg) if s < 0 else (0, 1 + (i + 1) % seg, 1 + i)) for i in range(seg)]
            k.add(Pc, Nc, Fc, attrs(seg + 1, np.zeros((seg + 1, 2)), part, code, tone))

def prism(k, poly, y0, y1, part, twist=0.0, taper=1.0, rows=1, uvs=1.0, cap=True, code=0.0):
    """Vertical prism over a 2D polygon (x,z), optional twist (rad over height) and taper; flat-shaded sides."""
    poly = np.asarray(poly, float); m = len(poly); per = 0.0
    ys = np.linspace(y0, y1, rows + 1)
    def at(p, y):
        t = (y - y0) / max(y1 - y0, 1e-6); s = 1 + (taper - 1) * t; a = twist * t
        x, z = p[0] * s, p[1] * s; return np.array([x * math.cos(a) - z * math.sin(a), y, x * math.sin(a) + z * math.cos(a)])
    for i in range(m):
        pa, pb = poly[i], poly[(i + 1) % m]; L = float(np.linalg.norm(pb - pa))
        for j in range(rows):
            q0, q1, q2, q3 = at(pa, ys[j]), at(pb, ys[j]), at(pb, ys[j + 1]), at(pa, ys[j + 1])
            uv = np.array([[per, ys[j]], [per + L, ys[j]], [per + L, ys[j + 1]], [per, ys[j + 1]]]) * uvs
            quad(k, q0, q1, q2, q3, part, code, 0.0, uv)
        per += L
    if cap:
        top = np.array([at(p, y1) for p in poly]); cen = top.mean(0)
        P = np.vstack([cen, top]); N = np.tile([0, 1, 0], (m + 1, 1))
        k.add(P, N, [(0, 1 + (i + 1) % m, 1 + i) for i in range(m)], attrs(m + 1, np.zeros((m + 1, 2)), 1))
    return per

def ngon(r, n, rot=0.0, sx=1.0, sz=1.0):
    a = np.arange(n) * 2 * np.pi / n + rot; return np.stack([np.cos(a) * r * sx, np.sin(a) * r * sz], -1)
def chamfer_rect(w, d, c):
    return np.array([[w - c, -d], [w, -d + c], [w, d - c], [w - c, d], [-w + c, d], [-w, d - c], [-w, -d + c], [-w + c, -d]])[::-1]

# ---------------- towers
def tower_setback():
    k = Kit(); y = 0.0
    for (w, d, c, hh) in [(1.5, 1.5, 0.45, 4.2), (1.2, 1.2, 0.36, 3.0), (0.9, 0.9, 0.27, 2.2)]:
        rbox(k, (0, y + 0.06, 0), (w + 0.05, 0.06, d + 0.05), 0.04, 1)
        prism(k, chamfer_rect(w, d, c), y + 0.12, y + hh, 0, rows=1, cap=False); y += hh
    rbox(k, (0, y + 0.08, 0), (0.95, 0.08, 0.95), 0.05, 1)
    cyl(k, (0, y + 0.16, 0), 0.08, 1.6, 9, seg=12); cyl(k, (0, y + 1.76, 0), 0.025, 0.7, 9, seg=8)
    rbox(k, (0, y + 2.48, 0), (0.05, 0.05, 0.05), 0.04, 6, code=0)
    for sx in (-1, 1):
        for sz in (-1, 1): rbox(k, (sx * 1.38, 2.2, sz * 1.38), (0.05, 2.1, 0.05), 0.03, 1)
    return k
def tower_cylinder():
    k = Kit(); rbox(k, (0, 0.3, 0), (1.6, 0.3, 1.6), 0.12, 7)
    prism(k, ngon(1.25, 40), 0.6, 9.0, 0, taper=0.82, rows=1, cap=False)
    for yy in np.arange(1.2, 9.0, 1.6): cyl(k, (0, yy, 0), 1.27 - 0.2 * (yy - 0.6) / 8.4, 0.05, 1, seg=40)
    cyl(k, (0, 9.0, 0), 1.04, 0.25, 1, seg=40); cyl(k, (0, 9.25, 0), 0.6, 0.5, 0, seg=32)
    return k
def tower_twist():
    k = Kit(); rbox(k, (0, 0.2, 0), (1.3, 0.2, 1.3), 0.1, 7)
    prism(k, chamfer_rect(1.0, 1.0, 0.18), 0.4, 11.0, 0, twist=1.2, rows=22, cap=True)
    for j, yy in enumerate(np.linspace(0.4, 11.0, 12)):
        a = 1.2 * (yy - 0.4) / 10.6
        P = chamfer_rect(1.03, 1.03, 0.19); P = np.stack([P[:, 0] * math.cos(a) - P[:, 1] * math.sin(a), P[:, 0] * math.sin(a) + P[:, 1] * math.cos(a)], -1)
        prism(k, P, yy - 0.03, yy + 0.03, 1, cap=False)
    return k
def tower_slab():
    k = Kit(); rbox(k, (0, 0.35, 0), (2.0, 0.35, 0.9), 0.1, 7)
    prism(k, np.array([[1.7, -0.55], [1.7, 0.55], [-1.7, 0.55], [-1.7, -0.55]])[::-1], 0.7, 7.0, 0, cap=True)
    for x in np.linspace(-1.6, 1.6, 9):
        rbox(k, (x, 3.85, -0.6), (0.025, 3.15, 0.07), 0.02, 1); rbox(k, (x, 3.85, 0.6), (0.025, 3.15, 0.07), 0.02, 1)
    rbox(k, (0, 7.15, 0), (1.75, 0.15, 0.62), 0.06, 1); rbox(k, (0.9, 7.5, 0), (0.4, 0.2, 0.3), 0.05, 7)
    return k
def tower_podium():
    k = Kit(); rbox(k, (0, 0.6, 0), (1.9, 0.6, 1.9), 0.18, 7)
    prism(k, np.array([[1.75, -1.75], [1.75, 1.75], [-1.75, 1.75], [-1.75, -1.75]])[::-1], 1.2, 2.4, 0, cap=True)
    prism(k, ngon(1.0, 6, 0.3), 2.4, 6.6, 0, cap=False)
    for i, (x, z) in enumerate(ngon(1.02, 6, 0.3)): rbox(k, (x, 4.5, z), (0.04, 2.1, 0.04), 0.03, 1)
    cyl(k, (0, 6.6, 0), 1.0, 0.15, 1, seg=6); cyl(k, (0, 6.75, 0), 0.55, 0.9, 0, seg=24); cyl(k, (0, 7.65, 0), 0.58, 0.08, 1, seg=24)
    return k
# ---------------- street pieces (length 4 along z, width 2.2 incl. sidewalks)
def street(cross=False):
    k = Kit(); n = 6
    for i in range(n):  # asphalt in strips so it bends smoothly on the cylinder
        z0, z1 = -2 + 4 * i / n, -2 + 4 * (i + 1) / n
        quad(k, (-0.8, 0, z0), (0.8, 0, z0), (0.8, 0, z1), (-0.8, 0, z1), 2, uv=np.array([[0, z0], [1.6, z0], [1.6, z1], [0, z1]]))
        for s in (-1, 1):
            xo, xi = s * 1.1, s * 0.8
            quad(k, (min(xi, xo), 0.08, z0), (max(xi, xo), 0.08, z0), (max(xi, xo), 0.08, z1), (min(xi, xo), 0.08, z1), 7, uv=np.array([[0, z0], [0.3, z0], [0.3, z1], [0, z1]]))
            a, b = (xi, xi) ; quad(k, (xi, 0, z0) if s > 0 else (xi, 0.08, z0), (xi, 0, z1) if s > 0 else (xi, 0.08, z1), (xi, 0.08, z1) if s > 0 else (xi, 0, z1), (xi, 0.08, z0) if s > 0 else (xi, 0, z0), 7)
    for zz in np.arange(-1.8, 2.0, 0.8):  # dashed centre line
        if cross and abs(zz) > 1.0: continue
        quad(k, (-0.03, 0.006, zz), (0.03, 0.006, zz), (0.03, 0.006, zz + 0.4), (-0.03, 0.006, zz + 0.4), 3)
    for s in (-1, 1): quad(k, (s * 0.72 - 0.02, 0.006, -2), (s * 0.72 + 0.02, 0.006, -2), (s * 0.72 + 0.02, 0.006, 2), (s * 0.72 - 0.02, 0.006, 2), 3)
    if cross:
        for zc in (-1.55, 1.55):
            for x in np.arange(-0.66, 0.7, 0.19): quad(k, (x, 0.007, zc - 0.25), (x + 0.11, 0.007, zc - 0.25), (x + 0.11, 0.007, zc + 0.25), (x, 0.007, zc + 0.25), 3)
            quad(k, (-0.75, 0.007, zc - 0.36), (0.75, 0.007, zc - 0.36), (0.75, 0.007, zc - 0.32), (-0.75, 0.007, zc - 0.32), 3)
    return k
def ground_tile():
    k = Kit(); n = 8
    for i in range(n):
        for j in range(n):
            x0, x1, z0, z1 = -2 + 4 * i / n, -2 + 4 * (i + 1) / n, -2 + 4 * j / n, -2 + 4 * (j + 1) / n
            quad(k, (x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1), 12, uv=np.array([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]))
    return k
# ---------------- vehicles & props (real-world-ish proportions; a lane is 0.8 wide)
def wheels(k, xs, zs, r=0.09, y=0.09):
    for x in xs:
        for z in zs:
            cyl(k, (x - 0.025 if x < 0 else x - 0.025, y, z), r, 0.05, 8, seg=16, axis='x'); cyl(k, (x - 0.03 if x < 0 else x - 0.02, y, z), r * 0.55, 0.06, 9, seg=12, axis='x')
def taxi():
    k = Kit()
    rbox(k, (0, 0.2, 0), (0.2, 0.09, 0.47), 0.07, 4)                  # body
    rbox(k, (0, 0.34, -0.03), (0.18, 0.07, 0.25), 0.06, 10)            # glasshouse
    rbox(k, (0, 0.415, -0.03), (0.165, 0.012, 0.2), 0.01, 4)           # roof
    rbox(k, (0, 0.45, -0.03), (0.07, 0.025, 0.035), 0.015, 6, code=6)  # roof sign
    rbox(k, (0, 0.12, 0.47), (0.2, 0.03, 0.02), 0.015, 9); rbox(k, (0, 0.12, -0.47), (0.2, 0.03, 0.02), 0.015, 9)  # bumpers
    rbox(k, (0, 0.205, 0.04), (0.205, 0.012, 0.18), 0.008, 8)          # checker band (dark)
    for s in (-1, 1):
        rbox(k, (s * 0.13, 0.22, 0.475), (0.045, 0.02, 0.008), 0.008, 6, code=4); rbox(k, (s * 0.15, 0.23, -0.475), (0.035, 0.02, 0.008), 0.008, 6, code=5)
    wheels(k, (-0.2, 0.2), (-0.29, 0.29)); return k
def bus():
    k = Kit()
    rbox(k, (0, 0.4, 0), (0.26, 0.3, 1.25), 0.08, 5)
    rbox(k, (0, 0.5, 0.05), (0.265, 0.1, 1.12), 0.04, 10)               # window band
    rbox(k, (0, 0.5, 1.2), (0.22, 0.14, 0.06), 0.04, 10)                # windscreen
    rbox(k, (0, 0.72, -0.3), (0.18, 0.04, 0.4), 0.03, 7)                # roof unit
    for s in (-1, 1): rbox(k, (s * 0.17, 0.22, 1.255), (0.04, 0.025, 0.006), 0.006, 6, code=4); rbox(k, (s * 0.19, 0.25, -1.255), (0.035, 0.03, 0.006), 0.006, 6, code=5)
    wheels(k, (-0.25, 0.25), (-0.85, 0.75), r=0.12, y=0.12); return k
def traffic_light():
    k = Kit(); cyl(k, (0, 0, 0), 0.03, 1.1, 9, seg=12); cyl(k, (0, 1.06, 0), 0.022, 0.6, 9, seg=10, axis='x')
    rbox(k, (0.56, 0.86, 0), (0.07, 0.2, 0.06), 0.03, 8)
    for i, yy in enumerate((1.0, 0.86, 0.72)): cyl(k, (0.56, yy, 0.055), 0.045, 0.02, 6, seg=16, axis='z', code=i)
    for i, yy in enumerate((1.0, 0.86, 0.72)): rbox(k, (0.56, yy + 0.05, 0.085), (0.055, 0.008, 0.03), 0.005, 8)
    return k
def street_lamp():
    k = Kit(); cyl(k, (0, 0, 0), 0.05, 0.12, 9, seg=14); cyl(k, (0, 0.12, 0), 0.022, 1.3, 1, seg=12)
    pts = [(0, 1.42, 0), (0.12, 1.52, 0), (0.32, 1.54, 0)]
    for a, b in zip(pts[:-1], pts[1:]):
        d = np.subtract(b, a); L = float(np.linalg.norm(d)); c = np.add(a, b) / 2
        rbox(k, c, (L / 2, 0.012, 0.012), 0.01, 1)
    rbox(k, (0.38, 1.52, 0), (0.1, 0.025, 0.05), 0.02, 1); rbox(k, (0.38, 1.49, 0), (0.08, 0.008, 0.035), 0.006, 6, code=3)
    return k
def sign():
    k = Kit(); cyl(k, (0, 0, 0), 0.018, 0.85, 9, seg=10)
    rbox(k, (0, 0.92, 0), (0.17, 0.11, 0.012), 0.03, 11, tone=0.3); rbox(k, (0, 0.92, 0.014), (0.14, 0.085, 0.002), 0.01, 3)
    rbox(k, (0, 0.68, 0), (0.12, 0.05, 0.01), 0.02, 11, tone=0.8); return k
def hydrant():
    k = Kit(); cyl(k, (0, 0, 0), 0.075, 0.03, 11, seg=16, tone=0.0); cyl(k, (0, 0.03, 0), 0.055, 0.2, 11, seg=16, tone=0.0)
    cyl(k, (0, 0.23, 0), 0.065, 0.025, 11, seg=16, tone=0.0); rbox(k, (0, 0.28, 0), (0.05, 0.035, 0.05), 0.045, 11, tone=0.0)
    cyl(k, (-0.09, 0.15, 0), 0.025, 0.18, 9, seg=10, axis='x'); cyl(k, (0, 0.15, 0), 0.03, 0.09, 9, seg=10, axis='z'); return k
def bench():
    k = Kit()
    for i in range(4): rbox(k, (0, 0.2, -0.09 + i * 0.045), (0.32, 0.01, 0.018), 0.008, 11, tone=0.55)
    for i in range(3): rbox(k, (0, 0.27 + i * 0.045, 0.1), (0.32, 0.015, 0.008), 0.006, 11, tone=0.55)
    for s in (-1, 1): rbox(k, (s * 0.27, 0.1, 0), (0.015, 0.1, 0.1), 0.01, 9); rbox(k, (s * 0.27, 0.3, 0.1), (0.015, 0.1, 0.012), 0.008, 9)
    return k

PROTOS = [('tower_setback', 'tower', tower_setback), ('tower_cylinder', 'tower', tower_cylinder), ('tower_twist', 'tower', tower_twist),
          ('tower_slab', 'tower', tower_slab), ('tower_podium', 'tower', tower_podium),
          ('street', 'street', lambda: street(False)), ('crosswalk', 'street', lambda: street(True)), ('ground', 'ground', ground_tile),
          ('taxi', 'car', taxi), ('bus', 'car', bus), ('traffic_light', 'prop', traffic_light), ('street_lamp', 'prop', street_lamp),
          ('sign', 'prop', sign), ('hydrant', 'prop', hydrant), ('bench', 'prop', bench)]

def to_b(P): return np.stack([P[:, 0], -P[:, 2], P[:, 1]], -1)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
t0 = time.time(); objs = []; parts = []
for kk, (name, kind, fn) in enumerate(PROTOS):
    P, N, F, A = fn().arrays()
    off = np.array([kk * 6.0, 0, 0])
    me = bpy.data.meshes.new(name); me.from_pydata(to_b(P + off).tolist(), [], F); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    objs.append(ob); parts.append((name, kind, P, N, A))
sc = bpy.context.scene; sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
for d in prefs.devices: d.use = True
sc.cycles.device = 'GPU'; sc.cycles.samples = 64
if sc.world is None: sc.world = bpy.data.worlds.new('W')
sc.world.light_settings.distance = 0.5
mat = bpy.data.materials.new('Bake')
for ob in objs:
    ob.data.materials.append(mat)
    a = ob.data.color_attributes.new(name='AO', type='FLOAT_COLOR', domain='POINT'); ob.data.color_attributes.active_color = a
sc.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for ob in objs: ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
tb = time.time(); bpy.ops.object.bake(type='AO'); bake_s = time.time() - tb
verts, idxs, meta = [], [], []; vo = io = 0
for ob, (name, kind, P, N, A) in zip(objs, parts):
    me = ob.data; nv = len(me.vertices); assert nv == len(P)
    c = np.zeros(nv * 4, np.float32); me.color_attributes['AO'].data.foreach_get('color', c); ao = c.reshape(-1, 4)[:, 0]
    me.calc_loop_triangles(); tri = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get('vertices', tri)
    V = np.column_stack([P, N, A, ao]).astype(np.float32); assert V.shape[1] == 14
    verts.append(V); idxs.append(tri.astype(np.uint32))
    mn, mx = P.min(0), P.max(0)
    meta.append(dict(name=name, kind=kind, vOff=vo, vCount=nv, iOff=io, iCount=int(len(tri)), tris=int(len(tri) // 3),
                     min=[round(float(x), 3) for x in mn], max=[round(float(x), 3) for x in mx], aoMean=round(float(ao.mean()), 3)))
    vo += nv; io += len(tri)
Vall = np.concatenate(verts); Iall = np.concatenate(idxs)
with open(os.path.join(OUT, 'city.bin'), 'wb') as fh: fh.write(Vall.tobytes()); fh.write(Iall.tobytes())
J = dict(scene='city', stride=14, layout='pos3 nrm3 uv2 part code ex ey tone ao', vertexBytes=int(Vall.nbytes), indexCount=int(len(Iall)), protos=meta,
         stats=dict(blender=bpy.app.version_string, ao='cycles', aoSamples=64, aoBakeSec=round(bake_s, 1), buildSec=round(time.time() - t0, 1), totalTris=int(len(Iall) // 3)))
json.dump(J, open(os.path.join(OUT, 'city.json'), 'w'), indent=1)
print('DONE', json.dumps(J['stats']), [(m['name'], m['tris']) for m in meta])

# Pass 4 "Fabric in Wind": Blender cloth sim baked to a grid VAT (vertex animation texture).
# The cloth is a regular NX x NY grid, so each frame is stored as an NX x NY RGB16F position image;
# the engine samples it bicubically on a much denser grid (>100k verts) and crossfades the loop.
# Run: blender -b --factory-startup -P fabric_cloth.py -- OUT_DIR [NX NY FRAMES]
# Original MIT-licensed work for flow-engine.
import bpy, sys, json, math, os, time
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/fabric'
NX = int(argv[1]) if len(argv) > 1 else 192
NY = int(argv[2]) if len(argv) > 2 else 128
L = int(argv[3]) if len(argv) > 3 else 240      # loop length (frames @30fps)
F = 40                                          # crossfade frames
S = 70                                          # loop start (settle time)
END = S + L
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc.frame_start, sc.frame_end = 1, END
sc.render.fps = 30
W, H = 5.2, 3.4
bpy.ops.mesh.primitive_grid_add(x_subdivisions=NX - 1, y_subdivisions=NY - 1, size=1)
cl = bpy.context.object; cl.name = 'Silk'
me = cl.data
# grid_add vertex order: x fastest. Scale to W x H in the XZ plane (hanging sheet), top edge at z=+H/2
co = np.zeros(len(me.vertices) * 3, dtype=np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
gx = (co[:, 0] + 0.5); gy = (co[:, 1] + 0.5)
order = np.lexsort((gx, gy))       # row-major index by (y, x)
assert len(co) == NX * NY
new = np.stack([(gx - 0.5) * W, np.zeros_like(gx), (gy - 0.5) * H], 1)
# a little initial ripple so wind can catch it
new[:, 1] = 0.04 * np.sin(gx * 9.0) * gy
me.vertices.foreach_set('co', new.astype(np.float32).ravel()); me.update()
vg = cl.vertex_groups.new(name='pin')
top = [i for i in range(len(co)) if gy[i] > 0.999]
# pin the top edge only at 5 hanging points so the sheet scallops and billows between them
PIN_AT = (0.0, 1.0) if os.environ.get('FAB_PINS', '5') == '2' else (0.0, 0.25, 0.5, 0.75, 1.0)
pins = [i for i in top if min(abs(gx[i] - p) for p in PIN_AT) < 0.012]
vg.add(pins, 1.0, 'REPLACE')
m = cl.modifiers.new('Cloth', 'CLOTH')
s = m.settings
s.quality = 8
s.mass = 0.1                 # silk/satin: light
s.air_damping = 0.35
s.tension_stiffness = s.compression_stiffness = 15
s.shear_stiffness = 6
s.bending_stiffness = 0.002    # very low bending = thin crisp folds
s.tension_damping = s.compression_damping = 4
s.shear_damping = 4
s.bending_damping = 0.4
s.pin_stiffness = 1
s.vertex_group_mass = 'pin'
s.effector_weights.gravity = 0.5
m.collision_settings.use_self_collision = os.environ.get('FAB_SELF', '1') == '1'
m.collision_settings.self_distance_min = 0.008
m.collision_settings.self_friction = 2
m.point_cache.frame_start, m.point_cache.frame_end = 1, END
# wind + turbulence (time-varying via animated strength/rotation)
bpy.ops.object.effector_add(type='WIND', location=(0, -3, 0.6))
wind = bpy.context.object; wind.rotation_euler = (math.radians(-90), 0, 0)
wind.field.strength = 200; wind.field.flow = 0.6; wind.field.noise = 3.0; wind.field.seed = 7
for fr, st, rz in [(1, 120, -18), (50, 230, 6), (95, 130, 20), (140, 250, -12), (190, 140, 15), (240, 240, -18), (290, 150, 10), (340, 220, -14)]:
    wind.field.strength = st; wind.field.keyframe_insert('strength', frame=fr)
    wind.rotation_euler[2] = math.radians(rz); wind.keyframe_insert('rotation_euler', frame=fr)
bpy.ops.object.effector_add(type='TURBULENCE', location=(0, 0, 0))
tb = bpy.context.object; tb.field.strength = 260; tb.field.size = 0.5; tb.field.flow = 0.5; tb.field.noise = 0.0
for fr, x in [(1, -2.0), (END, 6.0)]:
    tb.location.x = x; tb.keyframe_insert('location', frame=fr)
t0 = time.time()
frames = []
dg = bpy.context.evaluated_depsgraph_get()
for f in range(1, END + 1):
    sc.frame_set(f)
    if f > S - F - 1:
        ev = cl.evaluated_get(dg)
        mm = ev.to_mesh(); a = np.zeros(len(mm.vertices) * 3, dtype=np.float32); mm.vertices.foreach_get('co', a); ev.to_mesh_clear()
        a = a.reshape(-1, 3)[order]                     # row-major (y, x)
        a = (np.array(ev.matrix_world)[:3, :3] @ a.T).T + np.array(ev.matrix_world)[:3, 3]
        frames.append((f, a.astype(np.float32)))
    if f % 30 == 0: print(f'frame {f}/{END} {time.time() - t0:.1f}s', flush=True)
byf = dict(frames)
out = []
for i in range(L):
    a = byf[S + i]
    if i >= L - F:
        w = (i - (L - F) + 1) / (F + 1); w = w * w * (3 - 2 * w)
        a = (1 - w) * a + w * byf[S + i - L]
    out.append(a)
arr = np.stack(out)                                     # L, NY*NX, 3  (Blender Z-up)
arr = arr[:, :, [0, 2, 1]] * np.array([1, 1, -1], dtype=np.float32)   # -> Y-up, Z toward camera
lo = arr.reshape(-1, 3).min(0); hi = arr.reshape(-1, 3).max(0)
arr.astype(np.float16).tofile(os.path.join(OUT, 'fabric.vat'))
meta = dict(scene='fabric', nx=NX, ny=NY, frames=L, fps=30, format='rgb16f', layout='frame-major, row-major (y,x), xyz', loop_crossfade=F,
            bounds=dict(min=lo.tolist(), max=hi.tolist()), sim=dict(engine='blender-cloth', version=bpy.app.version_string, quality=s.quality,
            bake_seconds=round(time.time() - t0, 1), verts=NX * NY, pins=len(pins)))
json.dump(meta, open(os.path.join(OUT, 'fabric.json'), 'w'))
print('DONE', json.dumps(meta))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'fabric_sim.blend'))

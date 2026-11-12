# Pass 6 "Paint Splash": thick paint launched in pulses from the back of a deep domain toward the lens.
# Blobs stretch into ropes, collide mid-air into sheets, hit the floor in crowns and fly out through the open
# front border right past the camera. Colour = six lanes across x (noise-warped). Every emitter pulses with
# period PERIOD, so once the domain is in steady state frames PERIOD apart line up for a seamless loop.
# Run: blender -b --factory-startup -P paint_splash6.py -- WORK bake RES END
# Render framing/look lives in this file too (saved into WORK/splash.blend).
# Original MIT-licensed work for flow-engine.
import bpy, sys, os, math, time
argv = sys.argv[sys.argv.index('--') + 1:]
WORK = argv[0]; RES = int(argv[2]); END = int(argv[3])
os.makedirs(WORK, exist_ok=True)
PERIOD = 120
VISC = float(os.environ.get('PAINT_VISC', '0.006'))
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.render.fps = 30; sc.frame_start, sc.frame_end = 1, END
# domain: x[-2.8,2.8] y[-3.2,4.0] z[-1.2,3.4]; open front, top, sides and bottom: paint leaves the frame and the domain
bpy.ops.mesh.primitive_cube_add(location=(0, 0.4, 1.1)); dom = bpy.context.object; dom.name = 'Domain'; dom.scale = (2.8, 3.6, 2.3)
md = dom.modifiers.new('Fluid', 'FLUID'); md.fluid_type = 'DOMAIN'; ds = md.domain_settings
ds.domain_type = 'LIQUID'; ds.resolution_max = RES
ds.use_viscosity = True; ds.viscosity_value = VISC
ds.use_mesh = True; ds.mesh_scale = 2; ds.mesh_smoothen_pos = 1; ds.mesh_smoothen_neg = 1
for side in ('front', 'top', 'left', 'right', 'bottom'): setattr(ds, f'use_collision_border_{side}', False)
ds.cache_directory = os.path.join(WORK, 'cache'); ds.cache_type = 'ALL'; ds.cache_frame_start, ds.cache_frame_end = 1, END
# emitters: collision clusters. At each point 2-3 jets converge from opposite sides and smash into flat sheets,
# crowns, ropes and droplets; every jet also carries velocity toward the lens so the splash flies at the camera.
EM = []
CL = [((-1.0, 2.6, 1.6), 0), ((1.1, 1.2, 1.0), 30), ((-0.2, 3.0, 0.4), 60), ((0.6, 0.6, 2.2), 90)]
for ci, ((px, py, pz), ph) in enumerate(CL):
    dirs = [(1, 0.25, 0.0), (-1, 0.25, 0.1)] + ([(0.0, 1.0, -0.35)] if ci % 2 == 0 else [(0.3, 0.6, 0.8)])
    for (dx, dy, dz) in dirs:
        L = math.sqrt(dx * dx + dy * dy + dz * dz); dx, dy, dz = dx / L, dy / L, dz / L
        D = 2.2; spd = 8.5
        x, y, z = px - dx * D, py - dy * D, pz - dz * D
        t = D / spd
        EM.append((x, y, z, dx * spd, dy * spd - 2.6, dz * spd + 0.5 * 9.81 * t + 0.3, ph))
ON = 7
for i, (x, y, z, vx, vy, vz, ph) in enumerate(EM):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.24, location=(x, y, z)); n = bpy.context.object; n.name = f'Emit_{i}'; n.hide_render = True
    fm = n.modifiers.new('Fluid', 'FLUID'); fm.fluid_type = 'FLOW'; fs = fm.flow_settings
    fs.flow_type = 'LIQUID'; fs.flow_behavior = 'INFLOW'; fs.use_initial_velocity = True; fs.velocity_coord = (vx, vy, vz)
    fs.use_inflow = False; fs.keyframe_insert('use_inflow', frame=1)
    for c in range(0, END // PERIOD + 2):
        for half in (0, PERIOD // 2):
            f0 = 2 + c * PERIOD + (ph + half) % PERIOD
            for fr, on in ((f0 - 1, False), (f0, True), (f0 + ON, True), (f0 + ON + 1, False)):
                if fr < 1: continue
                fs.use_inflow = on; fs.keyframe_insert('use_inflow', frame=fr)
t0 = time.time()
with bpy.context.temp_override(object=dom, active_object=dom, scene=sc):
    bpy.ops.fluid.bake_all()
print('BAKE_DONE', round(time.time() - t0, 1), flush=True)
# ---- look (same wet-acrylic shading as Paint Pour)
def srgb(h):
    v = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]; return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v)
def mat(name, base, rough, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(base), 1); b.inputs['Roughness'].default_value = rough
    if coat: b.inputs['Coat Weight'].default_value = coat
    return m
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -3.0)); fl = bpy.context.object; fl.data.materials.append(mat('Floor', '#f3d2c4', 0.35, 0.4))
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 14, 0), rotation=(math.radians(90), 0, 0)); bw = bpy.context.object; bw.data.materials.append(mat('Back', '#f6c6b0', 0.8))
pm = bpy.data.materials.new('Paint'); pm.use_nodes = True; nt = pm.node_tree; b = nt.nodes['Principled BSDF']
b.inputs['Roughness'].default_value = 0.1; b.inputs['Coat Weight'].default_value = 0.7; b.inputs['Coat Roughness'].default_value = 0.04
b.inputs['Subsurface Weight'].default_value = 0.08
tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.2; nz.inputs['Detail'].default_value = 3; nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
nm = nt.nodes.new('ShaderNodeMath'); nm.operation = 'MULTIPLY_ADD'; nm.inputs[1].default_value = 0.3; nm.inputs[2].default_value = -0.15; nt.links.new(nz.outputs['Fac'], nm.inputs[0])
xm = nt.nodes.new('ShaderNodeMath'); xm.operation = 'MULTIPLY_ADD'; xm.inputs[1].default_value = 0.5; xm.inputs[2].default_value = 0.5; nt.links.new(sep.outputs['X'], xm.inputs[0])
ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; ad.use_clamp = True; nt.links.new(xm.outputs[0], ad.inputs[0]); nt.links.new(nm.outputs[0], ad.inputs[1])
ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp; cr.interpolation = 'EASE'
COLS = ['#ff4a3d', '#ffb000', '#20c997', '#2546d8', '#e8338f', '#8a4fe0']
stops = []
for i, c in enumerate(COLS):
    a = i / len(COLS); stops += [(a + 0.02, c), (a + 1 / len(COLS) - 0.02, c)]
cr.elements[0].position, cr.elements[0].color = stops[0][0], (*srgb(stops[0][1]), 1)
cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*srgb(stops[-1][1]), 1)
for p, c in stops[1:-1]:
    e = cr.elements.new(p); e.color = (*srgb(c), 1)
nt.links.new(ad.outputs[0], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
dom.data.materials.append(pm)
bpy.ops.object.light_add(type='AREA', location=(-3.5, -2.5, 5.0)); k = bpy.context.object; k.data.energy = 1400; k.data.size = 4.0; k.rotation_euler = (math.radians(35), 0, math.radians(-40))
bpy.ops.object.light_add(type='AREA', location=(4.0, 1.0, 3.0)); f2 = bpy.context.object; f2.data.energy = 600; f2.data.size = 4; f2.rotation_euler = (math.radians(60), 0, math.radians(70))
bpy.ops.object.light_add(type='AREA', location=(0.0, 6.0, 4.0)); f3 = bpy.context.object; f3.data.energy = 900; f3.data.size = 5; f3.rotation_euler = (math.radians(-50), 0, math.radians(180))
w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('#f7d0c0'), 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
bpy.ops.object.camera_add(location=(0, -4.6, 1.1)); cam = bpy.context.object; cam.rotation_euler = (math.radians(93), 0, 0); cam.data.lens = 22
cam.data.dof.use_dof = True; cam.data.dof.focus_distance = 4.0; cam.data.dof.aperture_fstop = 3.2; sc.camera = cam
sc.render.engine = 'CYCLES'; sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'splash.blend'))
print('SAVED', flush=True)

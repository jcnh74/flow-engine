# Pass 5 "Paint Pour": four-lane viscous paint (coral / cobalt / mint / gold) poured by four nozzles onto a
# studio sphere; paint runs down its own side, drips into a shallow dish whose floor is an outflow, so the
# amount of paint on screen reaches a steady state. Nozzle sway is periodic (PERIOD frames) so loop points
# picked PERIOD*k apart in the steady part line up.
# Run: blender -b --factory-startup -P paint_pour5.py -- WORK bake RES END
#      blender -b --factory-startup -P paint_pour5.py -- WORK render START END SAMPLES W H
# Original MIT-licensed work for flow-engine.
import bpy, sys, os, math, time
argv = sys.argv[sys.argv.index('--') + 1:]
WORK, MODE = argv[0], argv[1]
os.makedirs(WORK, exist_ok=True)
blend = os.path.join(WORK, 'paint.blend')
PERIOD = 120
VISC = float(os.environ.get('PAINT_VISC', '0.015'))
if MODE == 'render':
    a0, a1, spp, W, H = int(argv[2]), int(argv[3]), int(argv[4]), int(argv[5]), int(argv[6])
    bpy.ops.wm.open_mainfile(filepath=blend); sc = bpy.context.scene
    bpy.ops.preferences.addon_enable(module='cycles')
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = d.type == 'METAL'
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'GPU'; sc.cycles.samples = spp; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.join(WORK, 'frames', 'f_')
    sc.frame_start, sc.frame_end = a0, a1
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
    t0 = time.time(); bpy.ops.render.render(animation=True); print('RENDER_DONE', round(time.time() - t0, 1)); sys.exit(0)

RES = int(argv[2]) if len(argv) > 2 else 100
END = int(argv[3]) if len(argv) > 3 else 420
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.render.fps = 30; sc.frame_start, sc.frame_end = 1, END
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 1.6)); dom = bpy.context.object; dom.name = 'Domain'; dom.scale = (1.75, 1.75, 1.6)
md = dom.modifiers.new('Fluid', 'FLUID'); md.fluid_type = 'DOMAIN'; ds = md.domain_settings
ds.domain_type = 'LIQUID'; ds.resolution_max = RES
ds.use_viscosity = True; ds.viscosity_value = VISC
ds.use_mesh = True; ds.mesh_scale = 2; ds.mesh_smoothen_pos = 2; ds.mesh_smoothen_neg = 2
ds.use_collision_border_bottom = False
ds.cache_directory = os.path.join(WORK, 'cache'); ds.cache_type = 'ALL'; ds.cache_frame_start, ds.cache_frame_end = 1, END
def eff(o, kind='COLLISION'):
    m = o.modifiers.new('Fluid', 'FLUID'); m.fluid_type = 'EFFECTOR'; m.effector_settings.effector_type = kind; return m
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.72, location=(0, 0, 1.32), segments=128, ring_count=64); sph = bpy.context.object; sph.name = 'Sphere'; bpy.ops.object.shade_smooth(); eff(sph)
bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=0.7, location=(0, 0, 0.42), vertices=96); ped = bpy.context.object; ped.name = 'Pedestal'; eff(ped)
# shallow dish (rendered) + outflow sheet just above its floor (not rendered): paint that lands is drained
bpy.ops.mesh.primitive_cylinder_add(radius=1.62, depth=0.16, location=(0, 0, 0.08), vertices=160); dish = bpy.context.object; dish.name = 'Dish'
sol = dish.modifiers.new('Solid', 'SOLIDIFY'); sol.thickness = 0.05
bv = dish.modifiers.new('Bevel', 'BEVEL'); bv.width = 0.02; bv.segments = 4
bpy.ops.object.shade_smooth(); eff(dish)
# drain = closed torus near the dish rim: paint pools on the dish floor, spreads out and is removed at r~1.35,
# so the pool reaches a steady size instead of filling the basin
bpy.ops.mesh.primitive_torus_add(major_radius=1.47, minor_radius=0.13, location=(0, 0, 0.2)); out = bpy.context.object; out.name = 'Drain'
om = out.modifiers.new('Fluid', 'FLUID'); om.fluid_type = 'FLOW'; om.flow_settings.flow_type = 'LIQUID'; om.flow_settings.flow_behavior = 'OUTFLOW'; out.hide_render = True
LANES = [('coral', 200), ('cobalt', 250), ('mint', 290), ('gold', 340)]   # all on the camera-facing half
for i, (name, az) in enumerate(LANES):
    a = math.radians(az); x0, y0 = 0.4 * math.cos(a), 0.4 * math.sin(a)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.052, location=(x0, y0, 2.95)); n = bpy.context.object; n.name = f'Nozzle_{name}'; n.hide_render = True
    fm = n.modifiers.new('Fluid', 'FLUID'); fm.fluid_type = 'FLOW'; fs = fm.flow_settings
    fs.flow_type = 'LIQUID'; fs.flow_behavior = 'INFLOW'; fs.use_initial_velocity = True; fs.velocity_coord = (0.25 * math.cos(a), 0.25 * math.sin(a), -1.3)
    # periodic sway (period PERIOD frames): small ellipse, phase-shifted per lane so ribbons fold
    for fr in range(1, END + 2, 10):
        ph = 2 * math.pi * fr / PERIOD + i * 1.7
        n.location = (x0 + 0.07 * math.cos(ph), y0 + 0.05 * math.sin(2 * ph + i), 2.95)
        n.keyframe_insert('location', frame=fr)
t0 = time.time()
with bpy.context.temp_override(object=dom, active_object=dom, scene=sc):
    bpy.ops.fluid.bake_all()
print('BAKE_DONE', round(time.time() - t0, 1), flush=True)
# ---- look
def srgb(h):
    v = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]; return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v)
def mat(name, base, rough, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(base), 1); b.inputs['Roughness'].default_value = rough
    if coat: b.inputs['Coat Weight'].default_value = coat
    return m
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); fl = bpy.context.object
fl.data.materials.append(mat('Cove', '#f2c9b8', 0.75)); sph.data.materials.append(mat('Ball', '#fff3e8', 0.3, 0.3))
ped.data.materials.append(mat('Ped', '#f6d8c8', 0.5)); dish.data.materials.append(mat('Dish', '#fbe9df', 0.25, 0.5))
# paint: four lanes by azimuth around the vertical axis (each nozzle's paint runs down its own side),
# boundaries warped by noise so neighbouring lanes feather into each other
pm = bpy.data.materials.new('Paint'); pm.use_nodes = True; nt = pm.node_tree; b = nt.nodes['Principled BSDF']
b.inputs['Roughness'].default_value = 0.1; b.inputs['Coat Weight'].default_value = 0.7; b.inputs['Coat Roughness'].default_value = 0.04
b.inputs['Subsurface Weight'].default_value = 0.08
tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
at = nt.nodes.new('ShaderNodeMath'); at.operation = 'ARCTAN2'; nt.links.new(sep.outputs['Y'], at.inputs[0]); nt.links.new(sep.outputs['X'], at.inputs[1])
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 4; nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
nm = nt.nodes.new('ShaderNodeMath'); nm.operation = 'MULTIPLY_ADD'; nm.inputs[1].default_value = 0.9; nm.inputs[2].default_value = -0.45
nt.links.new(nz.outputs['Fac'], nm.inputs[0])
ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; nt.links.new(at.outputs[0], ad.inputs[0]); nt.links.new(nm.outputs[0], ad.inputs[1])
# angle -> [0,1) with lane centres at 45/135/225/315 deg -> 0.125/0.375/0.625/0.875
dv = nt.nodes.new('ShaderNodeMath'); dv.operation = 'MULTIPLY_ADD'; dv.inputs[1].default_value = 1 / (2 * math.pi); dv.inputs[2].default_value = 1.0
nt.links.new(ad.outputs[0], dv.inputs[0])
fr_ = nt.nodes.new('ShaderNodeMath'); fr_.operation = 'FRACT'; nt.links.new(dv.outputs[0], fr_.inputs[0])
ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp; cr.interpolation = 'EASE'
# lane centres 200/250/290/340 deg -> 0.556/0.694/0.806/0.944 of a turn; boundaries at the midpoints
cols = [(0.0, '#ffb000'), (0.05, '#ff5a4a'), (0.6, '#ff5a4a'), (0.65, '#2f4fd8'), (0.735, '#2f4fd8'), (0.765, '#2fcf9e'), (0.86, '#2fcf9e'), (0.89, '#ffb000'), (1.0, '#ffb000')]
cr.elements[0].position, cr.elements[0].color = cols[0][0], (*srgb(cols[0][1]), 1)
cr.elements[1].position, cr.elements[1].color = cols[-1][0], (*srgb(cols[-1][1]), 1)
for p, c in cols[1:-1]:
    e = cr.elements.new(p); e.color = (*srgb(c), 1)
nt.links.new(fr_.outputs[0], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
dom.data.materials.append(pm)
bpy.ops.object.light_add(type='AREA', location=(-2.6, -3.2, 4.4)); k = bpy.context.object; k.data.energy = 1000; k.data.size = 3.0; k.rotation_euler = (math.radians(48), 0, math.radians(-38))
bpy.ops.object.light_add(type='AREA', location=(3.4, -1.2, 2.8)); f2 = bpy.context.object; f2.data.energy = 350; f2.data.size = 4; f2.rotation_euler = (math.radians(65), 0, math.radians(62))
bpy.ops.object.light_add(type='AREA', location=(0.5, 3.5, 3.5)); f3 = bpy.context.object; f3.data.energy = 400; f3.data.size = 3; f3.rotation_euler = (math.radians(-55), 0, math.radians(175))
w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('#f7d6c6'), 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
bpy.ops.object.camera_add(location=(0, -6.4, 2.7)); cam = bpy.context.object; cam.rotation_euler = (math.radians(77), 0, 0); cam.data.lens = 50; sc.camera = cam
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend, flush=True)

# Pass 4 "Thick Paint" (pre-rendered fallback / reference): Mantaflow high-viscosity liquid.
# Three viscous paint streams pour over a studio sphere and drip off it; the open domain floor lets paint
# leave so the flow reaches a steady state, which makes a crossfaded loop seamless.
# Step 1 (this file, mode=bake): bake. Step 2 (mode=render): Cycles render of frames S..S+L+F.
# Run: blender -b --factory-startup -P paint_mantaflow.py -- WORK_DIR bake|render [RES]
# Original MIT-licensed work for flow-engine.
import bpy, sys, os, math, time
argv = sys.argv[sys.argv.index('--') + 1:]
WORK, MODE = argv[0], argv[1]
RES = int(argv[2]) if len(argv) > 2 else 110
os.makedirs(WORK, exist_ok=True)
S, L, F = 60, 150, 30      # loop start, loop length, crossfade (frames @30fps)
END = S + L + F
blend = os.path.join(WORK, 'paint.blend')
if MODE == 'render':
    bpy.ops.wm.open_mainfile(filepath=blend)
    sc = bpy.context.scene
    bpy.ops.preferences.addon_enable(module='cycles')
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = d.type == 'METAL'
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'GPU'
    sc.cycles.samples = int(argv[3]) if len(argv) > 3 else 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = (int(argv[4]), int(argv[5])) if len(argv) > 5 else (1280, 720)
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = os.path.join(WORK, 'frames', 'f_')
    sc.frame_start, sc.frame_end = S, END
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    t0 = time.time(); bpy.ops.render.render(animation=True); print('RENDER_DONE', round(time.time() - t0, 1))
    sys.exit(0)

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.render.fps = 30; sc.frame_start, sc.frame_end = 1, END
# domain
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 1.6)); dom = bpy.context.object; dom.name = 'Domain'; dom.scale = (2.0, 1.4, 1.6)
md = dom.modifiers.new('Fluid', 'FLUID'); md.fluid_type = 'DOMAIN'; ds = md.domain_settings
ds.domain_type = 'LIQUID'; ds.resolution_max = RES
ds.use_viscosity = True; ds.viscosity_value = float(os.environ.get('PAINT_VISC', '0.15'))  # 2.5 froze the streams solid
ds.use_mesh = True; ds.mesh_scale = 2; ds.mesh_smoothen_pos = 2; ds.mesh_smoothen_neg = 2
ds.use_collision_border_bottom = False
ds.cache_directory = os.path.join(WORK, 'cache'); ds.cache_type = 'ALL'
ds.cache_frame_start, ds.cache_frame_end = 1, END
ds.use_spray_particles = False
# obstacle sphere (the paint drips over it)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.75, location=(0, 0, 1.15), segments=96, ring_count=48); sph = bpy.context.object; sph.name = 'Sphere'
bpy.ops.object.shade_smooth()
me = sph.modifiers.new('Fluid', 'FLUID'); me.fluid_type = 'EFFECTOR'; me.effector_settings.effector_type = 'COLLISION'
# a small pedestal so paint pools a little and drips off the rim
bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.9, location=(0, 0, 0.35), vertices=96); ped = bpy.context.object; ped.name = 'Pedestal'
pe = ped.modifiers.new('Fluid', 'FLUID'); pe.fluid_type = 'EFFECTOR'; pe.effector_settings.effector_type = 'COLLISION'
# three inflow nozzles (left / centre / right), each slightly off the sphere top so streams fold over each other
noz = []
for i, (x, y, vx) in enumerate([(-0.42, 0.10, 0.25), (0.05, -0.18, 0.0), (0.46, 0.12, -0.28)]):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.085, location=(x, y, 2.85)); n = bpy.context.object; n.name = f'Nozzle{i}'
    fm = n.modifiers.new('Fluid', 'FLUID'); fm.fluid_type = 'FLOW'; fs = fm.flow_settings
    fs.flow_type = 'LIQUID'; fs.flow_behavior = 'INFLOW'; fs.use_initial_velocity = True; fs.velocity_coord = (vx, 0, -1.6)
    n.hide_render = True; noz.append(n)
    # slow pendulum sway so the streams lay ribbons
    for fr, dx in [(1, 0), (45, 0.12), (90, -0.1), (135, 0.08), (180, -0.12), (225, 0.1), (END, 0)]:
        n.location.x = x + dx * (1 if i != 1 else -1); n.keyframe_insert('location', index=0, frame=fr)
t0 = time.time()
with bpy.context.temp_override(object=dom, active_object=dom, scene=sc):
    bpy.ops.fluid.bake_all()
print('BAKE_DONE', round(time.time() - t0, 1), flush=True)
# ---- look: studio cove, glossy multi-colour paint (colour bands from object-space position + noise; Mantaflow liquids carry no per-inflow colour)
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); fl = bpy.context.object; fl.name = 'Floor'
def mat(name, base, rough, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1); b.inputs['Roughness'].default_value = rough
    if coat: b.inputs['Coat Weight'].default_value = coat
    return m
def srgb(h): 
    v = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]; return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v)
fl.data.materials.append(mat('Cove', srgb('#e9a291'), 0.7)); sph.data.materials.append(mat('Ball', srgb('#fff0e1'), 0.35)); ped.data.materials.append(mat('Ped', srgb('#f7cdb9'), 0.6))
pm = bpy.data.materials.new('Paint'); pm.use_nodes = True; nt = pm.node_tree; b = nt.nodes['Principled BSDF']
b.inputs['Roughness'].default_value = 0.12; b.inputs['Coat Weight'].default_value = 0.6; b.inputs['Coat Roughness'].default_value = 0.05
tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.2; nz.inputs['Detail'].default_value = 3
sep = nt.nodes.new('ShaderNodeSeparateXYZ'); mth = nt.nodes.new('ShaderNodeMath'); mth.operation = 'ADD'
mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.9
ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp; cr.interpolation = 'CONSTANT'
cols = ['#4458e0', '#ff6f5f', '#ffd27a', '#79d0bd', '#ff6f5f']
cr.elements[0].color = (*srgb(cols[0]), 1); cr.elements[1].position = 0.2; cr.elements[1].color = (*srgb(cols[1]), 1)
for k, c in enumerate(cols[2:]):
    e = cr.elements.new(0.4 + 0.2 * k); e.color = (*srgb(c), 1)
nt.links.new(tc.outputs['Generated'], nz.inputs['Vector']); nt.links.new(tc.outputs['Object'], sep.inputs[0])
nt.links.new(sep.outputs['X'], mth.inputs[0]); nt.links.new(nz.outputs['Fac'], mul.inputs[0]); nt.links.new(mul.outputs[0], mth.inputs[1])
mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -0.2; mr.inputs['From Max'].default_value = 1.6
nt.links.new(mth.outputs[0], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
dom.data.materials.append(pm)
# lights + camera
bpy.ops.object.light_add(type='AREA', location=(-2.5, -3.0, 4.2)); k = bpy.context.object; k.data.energy = 900; k.data.size = 3.0
k.rotation_euler = (math.radians(50), 0, math.radians(-38))
bpy.ops.object.light_add(type='AREA', location=(3.5, -1.5, 2.5)); f2 = bpy.context.object; f2.data.energy = 300; f2.data.size = 4
f2.rotation_euler = (math.radians(65), 0, math.radians(60))
w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('#f7cdb9'), 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
bpy.ops.object.camera_add(location=(0, -5.6, 1.9)); cam = bpy.context.object; cam.rotation_euler = (math.radians(86), 0, 0); cam.data.lens = 50; sc.camera = cam
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

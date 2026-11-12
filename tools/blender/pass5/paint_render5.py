# Pass 5 render-time framing for the paint_pour5 bake (wider camera + chrome feed pipes). Original MIT-licensed work for flow-engine.
# Render-time framing for the pass-5 paint bake: wider camera that shows nozzles, sphere and dish,
# plus visible chrome feed pipes parented to the (animated, hidden) nozzle flow objects.
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
mode = a[0]
sc = bpy.context.scene
bpy.ops.preferences.addon_enable(module='cycles')
pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
for d in pr.devices: d.use = d.type == 'METAL'
cam = sc.camera; cam.location = (0, -8.6, 2.75); cam.rotation_euler = (math.radians(82.5), 0, 0); cam.data.lens = 42
chrome = bpy.data.materials.new('Chrome'); chrome.use_nodes = True
bs = chrome.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = (0.9, 0.9, 0.92, 1); bs.inputs['Metallic'].default_value = 1.0; bs.inputs['Roughness'].default_value = 0.18
for n in [o for o in bpy.data.objects if o.name.startswith('Nozzle_')]:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=2.0, vertices=32, location=(0, 0, 1.0 + 0.02))
    p = bpy.context.object; p.data.materials.append(chrome); p.parent = n; p.location = (0, 0, 1.06)
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_torus_add(major_radius=0.075, minor_radius=0.02, location=(0, 0, 0))
    t = bpy.context.object; t.data.materials.append(chrome); t.parent = n; t.location = (0, 0, 0.08); bpy.ops.object.shade_smooth()
sc.render.engine = 'CYCLES'; sc.cycles.device = 'GPU'; sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
if mode == 'one':
    sc.cycles.samples = 24; sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.frame_set(int(a[1])); sc.render.filepath = a[2]; bpy.ops.render.render(write_still=True)
else:  # seq START END SPP W H OUTDIR
    s, e, spp, w, h, out = int(a[1]), int(a[2]), int(a[3]), int(a[4]), int(a[5]), a[6]
    sc.cycles.samples = spp; sc.render.resolution_x, sc.render.resolution_y = w, h
    for f in range(s, e + 1):
        sc.frame_set(f); sc.render.filepath = f'{out}/f_{f:04d}.png'; bpy.ops.render.render(write_still=True)

# Build a seamless loop from a rendered sequence S..S+L+F: out[i] = src[S+i] for i>=F,
# out[i] = mix(src[S+L+i], src[S+i], i/F) for i<F (the tail continues into the head). Uses Blender's numpy.
# Usage: blender -b --factory-startup -P loop_crossfade.py -- IN_DIR OUT_DIR S L F
# Original MIT-licensed work for flow-engine.
import bpy, sys, os, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
src, dst, S, L, F = a[0], a[1], int(a[2]), int(a[3]), int(a[4])
os.makedirs(dst, exist_ok=True)
def load(i):
    im = bpy.data.images.load(os.path.join(src, f'f_{i:04d}.png')); im.colorspace_settings.name = 'Non-Color'
    w, h = im.size; px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px); bpy.data.images.remove(im); return px, w, h
for i in range(L):
    px, w, h = load(S + i)
    if i < F:
        t = i / F; t = t * t * (3 - 2 * t); tail, _, _ = load(S + L + i); px = tail * (1 - t) + px * t
    out = bpy.data.images.new('o', w, h, alpha=True); out.colorspace_settings.name = 'Non-Color'
    out.pixels.foreach_set(px); out.filepath_raw = os.path.join(dst, f'l_{i:04d}.png'); out.file_format = 'PNG'; out.save(); bpy.data.images.remove(out)
print('LOOP_DONE', L)

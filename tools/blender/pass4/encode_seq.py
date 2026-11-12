# Encode a numbered JPEG/PNG sequence to H.264 MP4 using Blender's bundled FFmpeg (fallback encoder when the
# system ffmpeg is unavailable). Usage: blender -b --factory-startup -P encode_seq.py -- SEQ_DIR PREFIX COUNT OUT.mp4 [FPS] [W H]
# Original MIT-licensed work for flow-engine.
import bpy, sys, os
a = sys.argv[sys.argv.index('--') + 1:]
d, prefix, n, out = a[0], a[1], int(a[2]), a[3]
fps = int(a[4]) if len(a) > 4 else 30
W, H = (int(a[5]), int(a[6])) if len(a) > 6 else (1920, 1080)
files = sorted(f for f in os.listdir(d) if f.startswith(prefix))[:n]
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.render.fps = fps; sc.frame_start, sc.frame_end = 1, len(files)
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
se = sc.sequence_editor_create()
coll = se.strips if hasattr(se, 'strips') else se.sequences
st = coll.new_image('seq', os.path.join(d, files[0]), 1, 1)
for f in files[1:]: st.elements.append(f)
if hasattr(st, 'fit_method'): st.fit_method = 'FIT'
r = sc.render; r.use_sequencer = True
if hasattr(r.image_settings, 'media_type'): r.image_settings.media_type = 'VIDEO'
r.image_settings.file_format = 'FFMPEG'
r.ffmpeg.format = 'MPEG4'; r.ffmpeg.codec = 'H264'; r.ffmpeg.constant_rate_factor = 'PERC_LOSSLESS'; r.ffmpeg.ffmpeg_preset = 'GOOD'
r.ffmpeg.gopsize = 30; r.ffmpeg.audio_codec = 'NONE'
r.filepath = out; r.use_file_extension = False
bpy.ops.render.render(animation=True)
print('ENCODED', out, len(files))

"""Mapeia eventos de um vídeo gravado (trocas de legenda, ações, telas paradas).

Uso:
  python scripts/vids/detectar.py eventos <video>
  python scripts/vids/detectar.py folha   <video> --de 12 --ate 19.3 --passo 0.5
  python scripts/vids/detectar.py diff    <video> 11.6 13.8
Ver docs/treinamento-google-vids.md (Parte 3, Passo 1).
"""
import os, re, subprocess, sys, tempfile
from PIL import Image, ImageChops, ImageDraw
FF = os.environ.get('FF', 'ffmpeg')
cmd, src = sys.argv[1], sys.argv[2]

def quadro(t, w=None):
    p = tempfile.mktemp(suffix='.png')
    vf = ['-vf', f'scale={w}:-1'] if w else []
    subprocess.run([FF, '-v', 'error', '-y', '-ss', str(t), '-i', src, '-frames:v', '1', *vf, p], check=True)
    return Image.open(p)

if cmd == 'eventos':
    r = subprocess.run([FF, '-hide_banner', '-i', src, '-vf',
                        "scale=480:-1,select='gt(scene,0.02)',metadata=print", '-an', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    ts = re.findall(r'pts_time:([\d.]+)', r); sc = re.findall(r'scene_score=([\d.]+)', r)
    for t, s in zip(ts, sc):
        s = float(s); tipo = 'página' if s >= .3 else 'legenda?' if .06 <= s < .1 else 'clique/realce?'
        print(f'{float(t):6.2f}s  {s:.3f}  {tipo}')
elif cmd == 'folha':
    a = float(sys.argv[sys.argv.index('--de')+1]); b = float(sys.argv[sys.argv.index('--ate')+1])
    p = float(sys.argv[sys.argv.index('--passo')+1]) if '--passo' in sys.argv else 1.0
    ts = [round(a + i*p, 2) for i in range(int((b - a)/p) + 1)]
    W, H = 480, 270; o = Image.new('RGB', (W*4, H*((len(ts)+3)//4)))
    for i, t in enumerate(ts):
        im = quadro(t, W).convert('RGB'); d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 64, 18), fill=(220, 0, 0)); d.text((4, 3), f'{t}s', fill='white')
        o.paste(im, ((i % 4)*W, (i//4)*H))
    out = os.path.splitext(src)[0] + f'_folha_{a}-{b}.png'; o.save(out); print(out)
elif cmd == 'diff':
    a, b = quadro(sys.argv[3]).convert('L'), quadro(sys.argv[4]).convert('L')
    bb = ImageChops.difference(a, b).point(lambda v: 255 if v > 25 else 0).getbbox()
    print('iguais' if bb is None or (bb[2]-bb[0] <= 3 and bb[3]-bb[1] <= 3) else f'diferentes em {bb}')

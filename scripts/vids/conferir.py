"""Confere um teste exportado do Google Vids contra o cenas-<tag>.json.

Uso: FF=<ffmpeg> python scripts/vids/conferir.py teste.mp4 cenas-insp-m1.json --saida "<pasta>"
Ver docs/treinamento-google-vids.md (Parte 3, Passo 5).
"""
import json, os, re, subprocess, sys
import numpy as np
FF = os.environ.get('FF', 'ffmpeg'); W, H, R = 160, 90, 10
teste, spec = sys.argv[1], json.load(open(sys.argv[2], encoding='utf-8'))
saida = sys.argv[sys.argv.index('--saida') + 1] if '--saida' in sys.argv else '.'
pasta = os.path.join(saida, 'cenas', f"Modulo-{spec['modulo']}")

def frames(p, fps=R, ss=None, n=None):
    a = [FF, '-v', 'error'] + (['-ss', str(ss)] if ss is not None else []) + ['-i', p]
    a += ['-vf', f'fps={fps},scale={W}:{H},format=gray'] + (['-frames:v', str(n)] if n else [])
    raw = subprocess.run(a + ['-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.int16)

def dur(p):
    r = subprocess.run([FF, '-hide_banner', '-i', p], capture_output=True, text=True).stderr
    h, m, s = r.split('Duration: ')[1].split(',')[0].split(':'); return int(h)*3600 + int(m)*60 + float(s)

T = frames(teste); total = len(T) / R
# 1) início real de cada cena no export: procura o quadro 0,3 s da cena perto do esperado
inicio, esperado = [], 0.0
for c in spec['cenas']:
    clip = os.path.join(pasta, c['nome'] + '.mp4'); ref = frames(clip, ss=0.3, n=1)[0]
    i0, i1 = max(0, int((esperado - 1) * R)), min(len(T), int((esperado + 4) * R))
    d = np.array([np.abs(T[i] - ref).mean() for i in range(i0, i1)])
    cand = np.where(d <= d.min() + 1.0)[0] + i0       # telas paradas iguais: fica o mais perto do esperado
    k = int(cand[np.argmin(np.abs(cand / R - 0.3 - esperado))])
    ini = max(0.0, k / R - 0.3); inicio.append(ini); esperado = ini + dur(clip)
fim_cena = inicio[1:] + [total]
# 2) trechos com voz
r = subprocess.run([FF, '-hide_banner', '-i', teste, '-af', 'silencedetect=noise=-35dB:d=0.25',
                    '-vn', '-f', 'null', '-'], capture_output=True, text=True).stderr
si = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r)]
se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r)] + [total]
voz, cur = [], 0.0
for a, b in zip(si, se):
    if a > cur + 0.05: voz.append((cur, a))
    cur = b
if cur < total - 0.05: voz.append((cur, total))
# 3) relatório
ruins = 0
for c, a, b in zip(spec['cenas'], inicio, fim_cena):
    v = [(x, y) for x, y in voz if a - 0.2 <= x < b - 0.1]
    if not v: print(f"{c['nome']:28s} {a:5.1f}–{b:5.1f}  SEM VOZ"); continue
    v0, v1 = v[0][0], v[-1][1]; st = []
    if v1 > b + 0.05: st.append(f'PASSA {v1-b:.1f}s do fim')
    if b - v1 > 2.0: st.append(f'silêncio de {b-v1:.1f}s no fim')
    if v0 - a > 0.9: st.append(f'voz entra {v0-a:.1f}s depois (transição?)')
    ruins += bool(st)
    print(f"{c['nome']:28s} cena {a:5.1f}–{b:5.1f}  voz {v0:5.1f}–{v1:5.1f}  {' · '.join(st) or 'OK'}")
print(f"\n{ruins} cena(s) para ajustar.")

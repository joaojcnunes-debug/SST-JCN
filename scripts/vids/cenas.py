"""Gera as cenas do Google Vids e o roteiro por cena a partir de um cenas-<tag>.json.

Uso: FF=<ffmpeg> python scripts/vids/cenas.py cenas-insp-m1.json --saida "<pasta>"
Ver docs/treinamento-google-vids.md (Parte 3, Passo 3).
"""
import json, os, re, subprocess, sys
FF = os.environ.get('FF', 'ffmpeg'); FPS = 25
WPS, LEAD, TAIL, PAUSA = 2.8, 0.5, 0.3, 0.25

def dur(p):
    r = subprocess.run([FF, '-hide_banner', '-i', p], capture_output=True, text=True).stderr
    h, m, s = r.split('Duration: ')[1].split(',')[0].split(':'); return int(h)*3600 + int(m)*60 + float(s)

def fala_seg(txt):
    pal = len(re.findall(r"[\wÀ-ú-]+", txt)); pausas = txt.count('?') + txt.count('…')
    return LEAD + pal / WPS + PAUSA * pausas, pal

def montar(segs, dst, congelar=0):
    ins, fc = [], ''
    for i, (f, a, b) in enumerate(segs):
        ins += ['-i', f]; b = dur(f) if b is None else b
        fc += f'[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p[v{i}];'
    fc += ''.join(f'[v{i}]' for i in range(len(segs))) + f'concat=n={len(segs)}:v=1:a=0'
    fc += f',tpad=stop_mode=clone:stop_duration={congelar}[out]' if congelar else '[out]'
    subprocess.run([FF, '-loglevel', 'error', '-y', *ins, '-filter_complex', fc, '-map', '[out]',
                    '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium',
                    '-movflags', '+faststart', dst], check=True)

if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    saida = sys.argv[sys.argv.index('--saida') + 1] if '--saida' in sys.argv else '.'
    so = sys.argv[sys.argv.index('--so') + 1].split(',') if '--so' in sys.argv else None
    pasta = os.path.join(saida, 'cenas', f"Modulo-{spec['modulo']}"); os.makedirs(pasta, exist_ok=True)
    txt = [f"MÓDULO {spec['modulo']} — {spec['titulo'].upper()} · Roteiro por cena (Google Vids)",
           'Cole o texto de cada cena no Script da cena com o mesmo nome. Sem transições entre cenas.', '']
    alertas = []
    for c in spec['cenas']:
        segs = [(os.path.join(spec['origem'], f), a, b) for f, a, b in c['segs']]
        dst = os.path.join(pasta, c['nome'] + '.mp4')
        if so is None or c['nome'] in so:
            montar(segs, dst, c.get('congelar', 0))
        d = dur(dst); need, pal = fala_seg(c['fala'])
        folga = d - need - TAIL
        if folga < -0.3: alertas.append(f"{c['nome']}: fala longa demais ({need:.1f}s p/ cena de {d:.1f}s) — corte {int(-folga*WPS)+1} palavra(s)")
        if folga > 2.0: alertas.append(f"{c['nome']}: {folga:.1f}s de silêncio no fim — encurte a cena ou aumente a fala")
        br = lambda x: f'{x:.1f}'.replace('.', ',')
        txt += [f"{c['nome']}  ({br(d)} s · fala ≈ {br(need)} s · {pal} palavras)", c['fala'], '']
    open(os.path.join(saida, f"Roteiro-por-cena-M{spec['modulo']}.txt"), 'w',
         encoding='utf-8-sig', newline='\r\n').write('\n'.join(txt) + '\n')
    print('\n'.join(alertas) or 'Todas as cenas dentro do orçamento.')

"""Etapa 4: monta o vídeo final de cada módulo (vinheta + tela + voz + legenda + trilha) e o completo.

Uso:
  python montar.py <roteiro-m1.json> [<roteiro-m2.json> ...] --saida "<Downloads/.../narrado>"
         [--musica trilha.wav] [--completo "Treinamento-Inspecao-completo"] [--sem-queimar] [--legenda-topo]

Precisa do sincronia-<tag>.json do narrar.py (rode o narrar.py de novo se mudou o roteiro).
Saídas: Modulo-N-<titulo>.mp4 (legenda queimada) + .srt ao lado; com --completo, o vídeo único com
a trilha contínua e o .srt dele. Ver docs/treinamento-pipeline.md (Etapa 4).
"""
import argparse, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import FPS, run, dur, loud, ler, slug, caminho, br

FONTE, FONTE2 = 'C\\:/Windows/Fonts/arialbd.ttf', 'C\\:/Windows/Fonts/arial.ttf'
ABAIXO = 10      # trilha 10 LU abaixo da narração
NARRACAO = -18   # LUFS da narração


def esc(t):
    return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", '’').replace('%', '\\%').replace(',', '\\,')


def srt_tempo(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def escrever_srt(cues, dst):
    with open(dst, 'w', encoding='utf-8-sig', newline='\r\n') as f:
        for i, c in enumerate(cues, 1):
            f.write(f"{i}\n{srt_tempo(c['a'])} --> {srt_tempo(c['z'])}\n{c['texto']}\n\n")


ASS_CAB = """[Script Info]
ScriptType: v4.00+
PlayResX: 1600
PlayResY: 900
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Padrao,Arial,38,&H00FFFFFF,&H00FFFFFF,&H302A3712,&H302A3712,-1,0,0,0,100,100,0,0,3,12,0,{al},120,120,{mv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def escrever_ass(cues, dst, topo):
    def t(x):
        cs = int(round(x * 100)); h, cs = divmod(cs, 360000); m, cs = divmod(cs, 6000); s, cs = divmod(cs, 100)
        return f'{h}:{m:02d}:{s:02d}.{cs:02d}'
    with open(dst, 'w', encoding='utf-8-sig') as f:
        f.write(ASS_CAB.format(al=8 if topo else 2, mv=30 if topo else 44))
        for c in cues:
            texto = c['texto'].replace('\n', '\\N')
            f.write(f"Dialogue: 0,{t(c['a'])},{t(c['z'])},Padrao,,0,0,0,,{texto}\n")


def montar_modulo(rp, saida, a):
    base = os.path.dirname(os.path.abspath(rp)); R = ler(rp)
    sp = os.path.join(base, f"sincronia-{R['tag']}.json")
    if not os.path.exists(sp) or os.path.getmtime(sp) < os.path.getmtime(rp):
        raise SystemExit(f"{R['tag']}: rode o narrar.py antes (sincronia ausente ou mais velha que o roteiro)")
    S = ler(sp); video = caminho(base, S['video'])
    vin = S.get('vinheta'); dv = round((vin['dur'] if vin else 0) * FPS) / FPS

    # vídeo: vinheta + peças (em quadros inteiros, com arredondamento acumulado → sem deriva)
    fc, partes, out_t = [], [], 0.0
    if vin:
        num = f"Módulo {R.get('modulo', '')}".strip()
        fc.append(f"color=c=0x12372A:s=1600x900:r={FPS}:d={dv},format=yuv420p,"
                  f"drawbox=x=0:y=0:w=24:h=900:color=0xF0B866:t=fill,"
                  f"drawtext=fontfile='{FONTE}':text='{esc(num)}':fontcolor=0xF0B866:fontsize=34:x=140:y=300,"
                  f"drawtext=fontfile='{FONTE}':text='{esc(R.get('titulo', ''))}':fontcolor=0xF5F7F2:fontsize=76:x=140:y=360,"
                  f"drawtext=fontfile='{FONTE2}':text='{esc(R.get('subtitulo', ''))}':fontcolor=0xC8DACF:fontsize=34:x=140:y=470,"
                  f"drawtext=fontfile='{FONTE2}':text='{esc(R.get('treinamento', ''))}':fontcolor=0x8FB8A0:fontsize=26:x=140:y=110,"
                  f"fade=t=in:st=0:d=0.4,fade=t=out:st={dv - 0.4:.2f}:d=0.4,setsar=1[vin]")
        partes.append('[vin]')
    pecas = S['pecas']
    fc.append(f"[0:v]fps={FPS},format=yuv420p,setsar=1,split={len(pecas)}" + ''.join(f'[s{i}]' for i in range(len(pecas))))
    for i, (tipo, x, y) in enumerate(pecas):
        q0 = round(out_t * FPS); out_t += (y - x) if tipo == 'seg' else y; n = max(1, round(out_t * FPS) - q0)
        if tipo == 'seg':
            f0 = round(x * FPS)
            fc.append(f'[s{i}]trim=start_frame={f0}:end_frame={f0 + n},setpts=PTS-STARTPTS[p{i}]')
        else:
            f0 = round(x * FPS)
            fc.append(f'[s{i}]trim=start_frame={f0}:end_frame={f0 + 1},setpts=PTS-STARTPTS,'
                      f'tpad=stop_mode=clone:stop={n - 1}[p{i}]')
        partes.append(f'[p{i}]')
    total = dv + round(out_t * FPS) / FPS

    # legendas (tempo final = vinheta + corpo)
    cues = []
    if vin: cues += vin['legendas']
    for v in S['vozes']: cues += [dict(c, a=c['a'] + dv, z=c['z'] + dv) for c in v['legendas']]
    for c, d in zip(cues, cues[1:]): c['z'] = min(c['z'], d['a'] - 0.04)
    nome = f"Modulo-{R.get('modulo', '')}-{slug(R.get('titulo', R['tag']))}"
    srt = os.path.join(saida, nome + '.srt'); escrever_srt(cues, srt)
    queimar = ''
    if not a.sem_queimar:
        escrever_ass(cues, os.path.join(saida, f'.{nome}.ass'), a.legenda_topo)
        queimar = f",subtitles=filename='.{nome}.ass'"  # caminho relativo (cwd = saída): sem o "C:" que quebra o filtro
    # setpts=N/…: renumera os quadros; sem isso o concat sobrepõe os carimbos dos quadros congelados (tpad)
    # e o vídeo fica mais curto que o áudio (o clique adianta em relação à fala)
    fc.append(''.join(partes) + f'concat=n={len(partes)}:v=1:a=0,setpts=N/({FPS}*TB){queimar}[v]')

    # áudio: cada voz no seu lugar
    ins, sons = ['-i', video], []
    vozes = ([dict(mp3=vin['mp3'], arquivo_em=vin['arquivo_em'] - dv)] if vin else []) + S['vozes']
    for k, v in enumerate(vozes, 1):
        ins += ['-i', caminho(base, v['mp3'])]
        ms = max(0, int(round((v['arquivo_em'] + dv) * 1000)))
        fc.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{k}]')
        sons.append(f'[a{k}]')
    fc.append(''.join(sons) + f'amix=inputs={len(sons)}:normalize=0:dropout_transition=0,apad,atrim=0:{total:.3f},'
              f'loudnorm=I={NARRACAO}:TP=-1.5:LRA=11,aresample=48000[a]')
    tmp = os.path.join(saida, f'.{nome}-voz.mp4')
    run(ins + ['-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}',
               '-r', str(FPS), '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p',
               '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', '-movflags', '+faststart', tmp], cwd=saida)
    final = os.path.join(saida, nome + '.mp4')
    com_musica(tmp, final, a.musica)
    if os.path.exists(os.path.join(saida, f'.{nome}.ass')): os.remove(os.path.join(saida, f'.{nome}.ass'))
    print(f'{nome}: {br(dur(final))} s · {len(cues)} legendas', flush=True)
    return tmp, final, cues, total


def com_musica(src, dst, musica):
    if not musica:
        shutil.copyfile(src, dst); return
    d = dur(src); alvo = loud(src) - ABAIXO
    fc = (f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{d:.2f},loudnorm=I={alvo:.1f}:TP=-6:LRA=7,"
          f"afade=t=in:st=0:d=2,afade=t=out:st={max(0, d - 3):.2f}:d=3[m];[0:a][m]amix=inputs=2:normalize=0:duration=first[a]")
    run(['-i', src, '-stream_loop', '-1', '-i', musica, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
         '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', dst])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('roteiros', nargs='+'); ap.add_argument('--saida', required=True)
    ap.add_argument('--musica'); ap.add_argument('--completo')
    ap.add_argument('--sem-queimar', action='store_true'); ap.add_argument('--legenda-topo', action='store_true')
    a = ap.parse_args()
    if a.musica: a.musica = os.path.abspath(a.musica)
    os.makedirs(a.saida, exist_ok=True); a.saida = os.path.abspath(a.saida)
    nomes = [f"Modulo-{ler(r).get('modulo', '')}-{slug(ler(r).get('titulo', ler(r)['tag']))}" for r in a.roteiros]
    if len(set(nomes)) < len(nomes):
        raise SystemExit('dois roteiros geram o mesmo arquivo (mesmo módulo e título): ' + ', '.join(sorted({n for n in nomes if nomes.count(n) > 1})))
    feitos = [montar_modulo(r, a.saida, a) for r in a.roteiros]
    if a.completo:
        lst = os.path.join(a.saida, '.completo.txt')
        open(lst, 'w', encoding='utf-8').write(''.join(f"file '{t.replace(chr(92), '/')}'\n" for t, _, _, _ in feitos))
        tmp = os.path.join(a.saida, '.completo.mp4')
        run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', tmp])
        com_musica(tmp, os.path.join(a.saida, a.completo + '.mp4'), a.musica)
        cues, off = [], 0.0
        for t, _, c, d in feitos:
            cues += [dict(x, a=x['a'] + off, z=x['z'] + off) for x in c]; off += dur(t)
        escrever_srt(cues, os.path.join(a.saida, a.completo + '.srt'))
        os.remove(lst); os.remove(tmp); print(f"{a.completo}: {br(dur(os.path.join(a.saida, a.completo + '.mp4')))} s")
    for t, _, _, _ in feitos: os.remove(t)
    print('OK')


if __name__ == '__main__':
    main()

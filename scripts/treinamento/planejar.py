"""Etapa 2a: prepara o vídeo gravado e o esqueleto do roteiro.

Uso:
  python planejar.py <pasta>/eventos-<tag>.json [--titulo "Criar a inspeção"] [--modulo 1]
  python planejar.py <video.mp4> --tag insp-m1 [--de 3.5] [--ate 95]      (vídeo antigo, sem eventos)

Saídas, na pasta do vídeo/eventos:
  <tag>.mp4                 vídeo de origem, 25 fps constante, a partir do quadro de sincronia
  roteiro-<tag>.json        eventos (passos e ações) + trechos de fala vazios para preencher
  folhas/<tag>-NN.png       folhas de quadros: como a tela fica depois de cada evento
Ver docs/treinamento-pipeline.md (Etapa 2).
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import FF, FPS, run, dur, quadros, ler, gravar, br
import subprocess

OFF_PADRAO = 0.55      # atraso médio vídeo × relógio quando não há quadro de sincronia
LIMIAR_PIX, MIN_PIX = 18, 8   # pixel mudou > 18 níveis; > 8 pixels (em 320×180) = movimento (ignora o cursor de texto)


def achar_sync(video):
    """Tempo (no vídeo) do começo e do fim do quadro magenta do g.sync()."""
    raw = subprocess.run([FF, '-v', 'error', '-t', '40', '-i', video, '-vf', f'fps={FPS},scale=16:9',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    q = np.frombuffer(raw, np.uint8).reshape(-1, 9, 16, 3).astype(int).mean(axis=(1, 2))
    mag = np.where((q[:, 0] > 200) & (q[:, 1] < 70) & (q[:, 2] > 200))[0]
    if not len(mag):
        return None
    return mag[0] / FPS, (mag[mag < mag[0] + FPS][-1] + 1) / FPS


def movimento(video):
    """Intervalos [a, b] em que a tela se mexe (cursor, digitação, rolagem, carregamento)."""
    q = quadros(video, fps=10)
    n_pix = (np.abs(np.diff(q, axis=0)) > LIMIAR_PIX).sum(axis=(1, 2)); mud = n_pix > MIN_PIX
    iv, ini = [], None
    for i, m in enumerate(mud):
        t = (i + 1) / 10
        if m and ini is None: ini = t - 0.1
        if not m and ini is not None: iv.append([round(ini, 2), round(t, 2)]); ini = None
    if ini is not None: iv.append([round(ini, 2), round(len(q) / 10, 2)])
    junta = []
    for a, b in iv:  # junta movimentos separados por menos de 0,3 s
        if junta and a - junta[-1][1] < 0.3: junta[-1][1] = b
        else: junta.append([a, b])
    for m in junta:  # pico = quadro que mais muda (a tela reagindo ao clique); serve de "instante da ação"
        i0, i1 = int(m[0] * 10), max(int(m[0] * 10) + 1, int(m[1] * 10))
        m.append(round((i0 + int(np.argmax(n_pix[i0:i1])) + 1) / 10 - 0.1, 2))
    return junta, len(q) / 10


def folhas(video, eventos, tag, pasta, total):
    os.makedirs(pasta, exist_ok=True)
    W, H, por = 400, 225, 12
    try: fonte = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 15)
    except OSError: fonte = ImageFont.load_default()
    saidas = []
    for k in range(0, len(eventos), por):
        grupo = eventos[k:k + por]
        folha = Image.new('RGB', (W * 4, H * ((len(grupo) + 3) // 4)), 'white')
        for i, e in enumerate(grupo):
            t = min(total - 0.05, e['fim'] + 0.3)
            png = os.path.join(pasta, '_q.png')
            run(['-ss', f'{t:.2f}', '-i', video, '-frames:v', '1', '-vf', f'scale={W}:{H}', png])
            im = Image.open(png).convert('RGB'); d = ImageDraw.Draw(im)
            rot = f"{e['id']} {e['tipo']} {br(e['t'])}s  {e.get('rotulo') or ''}"[:48]
            d.rectangle((0, 0, W, 22), fill=(18, 55, 42)); d.text((5, 3), rot, fill=(240, 184, 102), font=fonte)
            folha.paste(im, ((i % 4) * W, (i // 4) * H))
        out = os.path.join(pasta, f'{tag}-{k // por + 1:02d}.png'); folha.save(out); saidas.append(out)
    if os.path.exists(os.path.join(pasta, '_q.png')): os.remove(os.path.join(pasta, '_q.png'))
    return saidas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('entrada'); ap.add_argument('--tag'); ap.add_argument('--titulo', default='')
    ap.add_argument('--modulo', default='1'); ap.add_argument('--de', type=float, default=0.0)
    ap.add_argument('--ate', type=float); ap.add_argument('--treinamento', default='')
    a = ap.parse_args()
    pasta = os.path.dirname(os.path.abspath(a.entrada))
    evs, sync_log = [], None
    if a.entrada.endswith('.json'):
        info = ler(a.entrada); tag = a.tag or info['tag']
        if info.get('privacidadeFalhou'):
            raise SystemExit('gravação com falha de privacidade: não use, grave de novo')
        bruto = os.path.join(pasta, info['video']); evs = info['eventos']; sync_log = info.get('sync')
    else:
        tag = a.tag or os.path.splitext(os.path.basename(a.entrada))[0]; bruto = a.entrada
    video = os.path.join(pasta, tag + '.mp4')

    # 1) relógio: evento (relógio do script) → tempo no vídeo
    corte = a.de
    if evs:
        s = achar_sync(bruto)
        if s and sync_log is not None:
            off = s[0] - sync_log; corte = max(corte, s[1] + 0.1)
            print(f'sincronia: quadro magenta em {br(s[0], 2)} s → atraso {br(off, 2)} s')
        else:
            off = OFF_PADRAO; print(f'sem quadro de sincronia: usando atraso padrão {br(off, 2)} s')
        for e in evs:
            for k in ('ini', 't', 'fim'): e[k] = round(e[k] + off - corte, 2)
        evs = [e for e in evs if e['t'] >= 0]
    fim = ['-to', f'{a.ate:.2f}'] if a.ate else []
    if os.path.abspath(bruto) != os.path.abspath(video) or corte or fim:
        tmp = video + '.tmp.mp4'
        run(['-ss', f'{corte:.2f}', *fim, '-i', bruto, '-an', '-vf', f'fps={FPS},scale=1600:900:flags=lanczos,setsar=1,format=yuv420p',
             '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', tmp])
        os.replace(tmp, video)
    total = dur(video)

    # 2) movimento na tela; o que não é evento registrado vira evento "movimento"
    mov, _ = movimento(video)
    cobertos = [(e['ini'] - 0.3, e['fim'] + 0.8) for e in evs]
    extra = [m for m in mov if not any(x <= m[0] <= y for x, y in cobertos)]
    for i, (x, y, pico) in enumerate(extra, 1):
        evs.append({'id': f'm{i:02d}', 'tipo': 'movimento', 'rotulo': '', 'ini': x, 't': max(x, pico), 'fim': y})
    mov = [m[:2] for m in mov]
    evs.sort(key=lambda e: e['t'])

    # 3) esqueleto do roteiro (não sobrescreve um roteiro já escrito)
    trechos, gravados = [], any(e['tipo'] != 'movimento' for e in evs)
    for i, e in enumerate(evs):
        if e['tipo'] == 'movimento' and gravados:
            continue  # com eventos registrados, movimento solto (carregamento) não ganha fala
        prox = evs[i + 1]['t'] if i + 1 < len(evs) else total
        livre = max(0.0, prox - e['t'])
        trechos.append({'em': e['id'], **({'ancora': ''} if e['tipo'] != 'passo' else {}), 'fala': '',
                        '_tela': f"{e['tipo']} {e.get('rotulo') or ''}".strip(),
                        '_tempo_natural': round(livre, 1), '_palavras_ate': max(2, int((livre - 0.6) * 2.6))})
    rot = {
        'tag': tag, 'modulo': a.modulo, 'titulo': a.titulo, 'subtitulo': '', 'treinamento': a.treinamento,
        'video': os.path.basename(video), 'voz': 'pt-BR-ThalitaMultilingualNeural', 'ritmo': '+0%',
        'pronuncia': {}, 'vinheta': {'fala': ''}, 'fechamento': {'fala': ''},
        'eventos': evs, 'movimento': mov, 'trechos': trechos,
    }
    destino = os.path.join(pasta, f'roteiro-{tag}.json')
    if os.path.exists(destino):
        destino = os.path.join(pasta, f'roteiro-{tag}.esqueleto.json')
    gravar(destino, rot)
    fs = folhas(video, evs, tag, os.path.join(pasta, 'folhas'), total)

    print(f'\nvídeo: {video} ({br(total)} s) · {len(evs)} eventos · {len(mov)} trechos com movimento')
    for e in evs:
        print(f"  {e['id']:4s} {e['tipo']:9s} {br(e['ini'], 2):>6s}–{br(e['fim'], 2):>6s}  ação em {br(e['t'], 2):>6s}  {e.get('rotulo') or ''}")
    print('\nroteiro:', destino); print('folhas:', *fs, sep='\n  ')


if __name__ == '__main__':
    main()

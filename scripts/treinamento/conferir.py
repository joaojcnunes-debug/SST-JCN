"""Etapa 5: confere o vídeo montado contra o plano (sem precisar assistir tudo).

Uso: python conferir.py <roteiro-<tag>.json> <video-montado.mp4>

1. Mede no áudio do MP4 onde cada fala começa e compara com o planejado (tolerância 0,2 s).
2. Folha conferir-<tag>.png: o quadro do instante em que cada palavra-âncora é dita
   (o clique tem de estar acontecendo) e o primeiro quadro de cada fala sem âncora.
Ver docs/treinamento-pipeline.md (Etapa 5).
"""
import os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import FF, run, dur, ler, br, caminho


def main():
    rp, mp4 = sys.argv[1], sys.argv[2]
    base = os.path.dirname(os.path.abspath(rp)); R = ler(rp)
    S = ler(os.path.join(base, f"sincronia-{R['tag']}.json"))
    dv = round((S['vinheta']['dur'] if S.get('vinheta') else 0) * 25) / 25
    trechos = {(t.get('id') or f'f{i:02d}'): t for i, t in enumerate(R['trechos'], 1)}
    total = dur(mp4)

    # 1) voz no MP4 (sem a trilha não dá para separar: com música, use o arquivo .srt para conferir)
    r = subprocess.run([FF, '-hide_banner', '-i', mp4, '-af', 'silencedetect=noise=-38dB:d=0.3', '-vn', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    fins = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r)]
    if len(fins) < len(S['vozes']) / 2:
        print('Sem silêncio entre as falas: o vídeo tem trilha. Monte sem --musica para conferir o áudio; a folha abaixo vale igual.\n')
        fins = []
    ruins = 0
    print(f"{'trecho':10s} {'plano':>7s} {'medido':>7s}  ")
    for v in S['vozes']:
        plano = v['fala_de'] + dv
        perto = min(fins, key=lambda x: abs(x - plano)) if fins else None
        ok = perto is not None and abs(perto - plano) <= 0.2
        ruins += not ok
        print(f"{v['id']:10s} {br(plano, 2):>7s} {(br(perto, 2) if perto else '—'):>7s}  {'ok' if ok else 'CONFERIR (trilha alta ou fala colada na anterior?)'}")

    # 2) folha: o quadro da palavra-âncora
    W, H = 480, 270
    try: fonte = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 15)
    except OSError: fonte = ImageFont.load_default()
    marcas = []
    for v in S['vozes']:
        t = trechos.get(v['id'], {}); anc = (t.get('ancora') or '').lower()
        quando, rot = v['fala_de'] + dv, f"{v['id']} início"
        if anc:
            js = os.path.splitext(caminho(base, v['mp3']))[0] + '.json'
            pal = ler(js)['palavras']
            w = next((p for p in pal if p['p'].lower().startswith(anc)), None)
            if w: quando, rot = v['arquivo_em'] + w['a'] + dv, f"{v['id']} \"{w['p']}\""
        marcas.append((min(quando, total - 0.05), rot))
    folha = Image.new('RGB', (W * 4, H * ((len(marcas) + 3) // 4)), 'white')
    png = os.path.join(base, '_q.png')
    for i, (q, rot) in enumerate(marcas):
        run(['-ss', f'{q:.2f}', '-i', mp4, '-frames:v', '1', '-vf', f'scale={W}:{H}', png])
        im = Image.open(png).convert('RGB'); d = ImageDraw.Draw(im)
        d.rectangle((0, 0, W, 22), fill=(18, 55, 42)); d.text((5, 3), f'{rot}  {br(q, 2)}s', fill=(240, 184, 102), font=fonte)
        folha.paste(im, ((i % 4) * W, (i // 4) * H))
    os.remove(png)
    out = os.path.join(base, f"conferir-{R['tag']}.png"); folha.save(out)
    print(f"\n{ruins} fala(s) para conferir · folha: {out}")


if __name__ == '__main__':
    main()

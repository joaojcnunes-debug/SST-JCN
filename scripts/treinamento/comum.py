"""Funções comuns do pipeline de treinamento (gravar → roteiro → voz → montagem).

Ver docs/treinamento-pipeline.md. Ferramentas em C:/Users/Usuario/ferramentas (venv com edge-tts).
"""
import json, os, re, subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')  # console do Windows (cp1252) estraga os acentos
except (AttributeError, ValueError):
    pass

FPS = 25
VW, VH = 1600, 900


def ffmpeg():
    if os.environ.get('FF'):
        return os.environ['FF']
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


FF = ffmpeg()


def run(args, cwd=None):
    r = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y'] + args, capture_output=True, text=True, cwd=cwd)
    if r.returncode:
        raise SystemExit('ffmpeg falhou:\n' + r.stderr[-2000:])


def dur(p):
    r = subprocess.run([FF, '-hide_banner', '-i', p], capture_output=True, text=True).stderr
    h, m, s = r.split('Duration: ')[1].split(',')[0].split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def loud(p):
    r = subprocess.run([FF, '-hide_banner', '-i', p, '-map', '0:a', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    return float(r.split('I:')[-1].split('LUFS')[0])


def quadros(p, fps=10, w=320, h=180, ss=None, t=None):
    """Quadros em tons de cinza (numpy int16, shape n×h×w)."""
    import numpy as np
    a = [FF, '-v', 'error'] + (['-ss', str(ss)] if ss is not None else []) + ['-i', p]
    a += (['-t', str(t)] if t is not None else []) + ['-vf', f'fps={fps},scale={w}:{h},format=gray', '-f', 'rawvideo', '-']
    raw = subprocess.run(a, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)


def ler(p):
    return json.load(open(p, encoding='utf-8'))


def gravar(p, obj):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def br(x, n=1):
    return f'{x:.{n}f}'.replace('.', ',')


def slug(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-')


def caminho(base, p):
    """Caminho do roteiro: relativo à pasta do próprio roteiro."""
    return p if os.path.isabs(p) else os.path.normpath(os.path.join(base, p))

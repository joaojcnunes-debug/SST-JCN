"""Trilha original e motivacional (sem direitos de terceiros), feita por síntese.

104 BPM, Dó maior, progressão I–V–vi–IV. Seções: intro leve, parte cheia (A),
parte leve (B), alternando até a duração pedida. Saída: WAV 16 bits estéreo.
Uso: python musica.py <saida.wav> <segundos>
"""
import sys, wave
import numpy as np

SR = 32000
BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)


def hz(n):  # n = nota MIDI
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.01, r=0.3, sus=1.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * sus
    if r:
        e *= np.exp(-t / r)
    return e


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):  # só para trechos curtos (pad gerado por compasso)
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y


def pad_chord(notas, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for m in notas:
        for det in (-0.12, 0.0, 0.12):  # supersaw suave (3 vozes)
            f = hz(m) * 2 ** (det / 12)
            s += 2 * ((t * f) % 1.0) - 1
    s /= len(notas) * 3
    # filtro barato: média móvel em cascata
    k = 24
    for _ in range(3):
        s = np.convolve(s, np.ones(k) / k, mode='same')
    a = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.25 + 0.0)
    return s * np.clip(a, 0, 1)


def pluck(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return s * env(n, 0.004, 0.32)


def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return s * env(n, 0.005, 0.22)


def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.12)


def clap():
    n = int(0.2 * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - np.convolve(x, np.ones(6) / 6, mode='same')  # tira graves
    return x * np.exp(-t / 0.05) * 0.6


def hat():
    n = int(0.06 * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - np.convolve(x, np.ones(3) / 3, mode='same')
    return x * np.exp(-t / 0.015)


def add(buf, sig, at, g):
    i = int(at * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += g * sig[: j - i]


ACORDES = [  # (pad, raiz baixo, arpejo)
    ([48, 52, 55, 60], 36, [60, 64, 67, 72]),  # C
    ([43, 47, 50, 55], 31, [55, 59, 62, 67]),  # G
    ([45, 48, 52, 57], 33, [57, 60, 64, 69]),  # Am
    ([41, 45, 48, 53], 29, [53, 57, 60, 65]),  # F
]
PAD = [pad_chord(p, BAR) for p, _, _ in ACORDES]
K, C, H = kick(), clap(), hat()


def bloco(compassos, cheio, leve=False):
    out = np.zeros(int(compassos * BAR * SR) + SR)
    for b in range(compassos):
        p, r, arp = ACORDES[b % 4]
        t0 = b * BAR
        add(out, PAD[b % 4], t0, 0.16)
        padrao = [0, 1, 2, 3, 2, 1, 2, 3] if b % 2 == 0 else [0, 2, 1, 3, 0, 2, 3, 1]
        for i in range(8):  # arpejo em colcheias
            add(out, pluck(arp[padrao[i]] + (12 if (cheio and i == 7) else 0), BEAT), t0 + i * BEAT / 2, 0.14 if not leve else 0.10)
        if cheio or leve:
            for i in range(8):  # baixo pulsante
                add(out, bass(r + (12 if i % 4 == 3 else 0), BEAT / 2), t0 + i * BEAT / 2, 0.22 if cheio else 0.14)
        if cheio:
            for q in range(4):
                add(out, K, t0 + q * BEAT, 0.42)
                if q in (1, 3): add(out, C, t0 + q * BEAT, 0.09)
            for i in range(8):
                add(out, H, t0 + i * BEAT / 2 + BEAT / 4, 0.025)
        elif leve:
            for q in (0, 2):
                add(out, K, t0 + q * BEAT, 0.30)
    return out[: int(compassos * BAR * SR)]


def main(saida, seg):
    intro = bloco(4, cheio=False)
    A = bloco(8, cheio=True)
    B = bloco(8, cheio=False, leve=True)
    partes = [intro]; total = len(intro); i = 0
    while total < seg * SR:
        x = A if i % 3 != 2 else B
        partes.append(x); total += len(x); i += 1
    mono = np.concatenate(partes)[: int(seg * SR)]
    # estéreo: leve atraso no lado direito
    d = int(0.012 * SR)
    L = mono; R = np.concatenate([np.zeros(d), mono[:-d]])
    st = np.stack([L, R], axis=1)
    st /= np.max(np.abs(st)) / 0.89
    fade = int(3 * SR); st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    pcm = (st * 32767).astype('<i2')
    with wave.open(saida, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


main(sys.argv[1], float(sys.argv[2]))

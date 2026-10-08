# Treinamento para o Google Vids (vídeo sem áudio + narração por cena)

Use este MD para gerar a versão **Google Vids** de um treinamento: vídeos sem narração e sem música,
cortados em **uma cena por fala**, mais o **roteiro em texto** para colar no Script de cada cena.
Vale aqui no `sst-jcn` e no `painel-sst`.

## Como pedir

Basta mandar uma destas mensagens:

```
/treinamento <módulo> — versão Google Vids
```

```
Gere a versão Google Vids do treinamento de <módulo>: vídeos sem narração e sem música,
uma cena por fala, e o roteiro em texto separado por clipe.
```

- Se o treinamento do módulo **já existe** (`docs/treinamentos/<modulo>.md`), só refaz a partir dos
  vídeos prontos.
- Se **não existe**, primeiro cria o treinamento completo pela skill `/treinamento`
  (ou pelo `docs/replicar-no-painel-treinamento-video-slides.md`) e depois gera esta versão.

## O que é entregue

Tudo em `Downloads/Treinamento-<Módulo>/sem-audio/`:

| Arquivo | Para quê |
|---|---|
| `Modulo-N-...-sem-audio.mp4` e `Treinamento-<Módulo>-completo-sem-audio.mp4` | mesma imagem dos vídeos narrados, sem áudio |
| `cenas/Modulo-N/MN-00-vinheta.mp4` | vinheta com o título do módulo (sem fala) |
| `cenas/Modulo-N/MN-01-q01.mp4`, `MN-02-q02.mp4`… | **um clipe por fala**, na ordem |
| `Roteiro-por-cena-<Módulo>.txt` | nome de cada clipe + o texto da fala + duração |
| `Roteiro-narracao-<Módulo>.txt` | as falas com o tempo de cada uma no vídeo do módulo e no completo |

Na resposta, a narração também vem no chat, separada por módulo e por clipe (`M3-05: <texto>`).

## Por que uma cena por fala

Com o vídeo do módulo inteiro numa cena só, a voz do Vids (que tem outro ritmo) vai se
**desencontrando da tela** e o atraso acumula. Com um clipe por fala, cada fala começa junto com a
sua tela e a diferença fica presa dentro da cena.

Cada clipe termina com **1,5 s de imagem parada** de folga. Na voz Francisca, todos ficam pelo menos
uns 4 s maiores que a fala.

## Como montar no Google Vids

1. Uma cena por clipe, na ordem dos números (`M1-00`, `M1-01`, `M1-02`…).
2. Em cada cena, cole no **Script** a fala daquele clipe (do `Roteiro-por-cena`).
3. Se a voz terminar antes do clipe, apare o fim; se passar, estique a cena.
4. A cena `00` é só o título, sem fala.

Se ainda desencontrar, diga o número do clipe e o corte é ajustado.

## Passos técnicos

Parte dos arquivos do pipeline do `docs/replicar-no-painel-treinamento-video-slides.md`:
- `linha-<tag>.json`: quando cada fala começou na gravação (campo `t`);
- `narr-<tag>.json`: o texto das falas;
- `narr/<id>.mp3`: a duração de cada fala;
- os MP4 por módulo e a tabela `MODULOS` do `build-<tag>.py`: a fala que abre cada módulo.

Use as mesmas constantes do build: `OFF=0.55` (atraso da fala), vinheta de `3.5` s, e o corte do
módulo começando em `T[primeira fala] - 0.6` (ou `0.3` no primeiro módulo).

### 1. Tirar o áudio

```bash
for f in modulos/*.mp4; do
  "$FF" -y -i "$f" -map 0:v -c:v copy -an -movflags +faststart "sem-audio/$(basename "${f%.mp4}")-sem-audio.mp4"
done
```

### 2. Cortar uma cena por fala e escrever o roteiro

Para cada módulo:
- **cena 00:** `[0, 3.5]` (a vinheta);
- **cena k:**
  - começa em `3.5 + T[fala k] - ini_do_módulo - 0.3`; a primeira começa em `3.5`;
  - termina no início da próxima fala, ou no fim do vídeo;
  - recebe `tpad=stop_mode=clone:stop_duration=1.5`;
  - é recodificada (`libx264`, `crf 20`, 25 fps, sem áudio), para o corte ficar exato.

Script modelo (`cenas.py`, roda na pasta dos scripts; `FF` aponta para o ffmpeg do imageio-ffmpeg):

```python
import json, os, subprocess
FF = os.environ['FF']; OFF = 0.55; VIN = 3.5; PAD = 1.5
SRC = os.environ['SRC']            # pasta com os *-sem-audio.mp4
OUT = SRC + '/cenas'
L = json.load(open('linha-insp.json', encoding='utf-8'))['linha']
N = json.load(open('narr-insp.json', encoding='utf-8'))
T = {x['id']: x['t'] + OFF for x in L}; ids = [x['id'] for x in L]
# (número, título, fala que abre, fala que abre o próximo, arquivo) — igual à tabela MODULOS do build
MOD = [('1', 'Criar a inspeção', None, 'q06', 'Modulo-1-Criar-a-inspecao'),
       # ...
       ('7', 'Concluir, relatório e PGR', 'q34', None, 'Modulo-7-Concluir-relatorio-PGR')]

def dur(p):
    r = subprocess.run([FF, '-hide_banner', '-i', p], capture_output=True, text=True).stderr
    h, m, s = r.split('Duration: ')[1].split(',')[0].split(':'); return int(h)*3600 + int(m)*60 + float(s)

def cut(src, a, b, dst, pad):
    vf = f'tpad=stop_mode=clone:stop_duration={pad}' if pad else 'null'
    subprocess.run([FF, '-loglevel', 'error', '-y', '-ss', f'{a:.2f}', '-to', f'{b:.2f}', '-i', src, '-vf', vf,
                    '-an', '-r', '25', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', dst], check=True)

out = []
for num, tit, a, b, arq in MOD:
    src = f'{SRC}/{arq}-sem-audio.mp4'; vd = dur(src)
    ini = 0.3 if a is None else T[a] - 0.6
    sel = ids[ids.index(a) if a else 0: ids.index(b) if b else len(ids)]
    pasta = f'{OUT}/Modulo-{num}'; os.makedirs(pasta, exist_ok=True)
    cut(src, 0, VIN, f'{pasta}/M{num}-00-vinheta.mp4', 0)
    out += [f'MÓDULO {num} — {tit.upper()}', '', f'M{num}-00-vinheta.mp4', '(sem fala)', '']
    st = [VIN + T[i] - ini - 0.3 for i in sel]; st[0] = VIN
    for k, i in enumerate(sel):
        e = st[k+1] if k+1 < len(sel) else vd
        nome = f'M{num}-{k+1:02d}-{i}.mp4'; cut(src, st[k], e, f'{pasta}/{nome}', PAD)
        out += [f'{nome}  (clipe {e - st[k] + PAD:.1f} s · fala com cerca de {dur(f"narr/{i}.mp3"):.0f} s)', N[i], '']
open(SRC + '/Roteiro-por-cena.txt', 'w', encoding='utf-8-sig', newline='\r\n').write('\n'.join(out) + '\n')
```

- **Codificação:** grave o roteiro em UTF-8 **com BOM** (`utf-8-sig`) e com quebra `\r\n`, para abrir
  certo no Bloco de Notas.
- **Formatação:** não troque `.` por `,` na linha inteira (estraga o `.mp4`). Formate só os números.

### 3. Conferir

- A quantidade de clipes é igual à de falas, mais uma vinheta por módulo.
- Abra 2 ou 3 clipes: a tela da fala tem que estar no começo do clipe.
- O roteiro tem todas as falas, na ordem.

## Observações

- **Pronúncia:** as falas ficam escritas como devem ser faladas (AIHA = "aiá", NR-09 = "NR zero nove").
  Se preferir as siglas normais no Vids, troque no roteiro.
- **Legendas e cursor:** fazem parte da gravação da tela e continuam nos vídeos. Para tirá-los, é
  preciso gravar de novo sem o overlay de legenda.
- **Acesso ao Vids:** não há conexão direta com o Google Vids. Os arquivos podem ir para o Google
  Drive (conector) e ser importados de lá no Vids.

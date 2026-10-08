# Treinamento para o Google Vids — narração humanizada e sincronizada

Use este MD para gerar a versão **Google Vids** de um treinamento do Painel SST: vídeos sem áudio,
cortados em **cenas sincronizadas com a tela**, mais o **roteiro em primeira pessoa** para colar no
campo de narração (Script) de cada cena. Vale no `sst-jcn` e no `painel-sst`.

O objetivo é que o treinamento soe como **eu (João Jefferson) apresentando o sistema**: fala
dinâmica, natural, e cada frase entrando exatamente quando a coisa acontece na tela.

> Substitui o MD anterior ("uma cena por fala + 1,5 s de folga"). Aquele método deixava silêncios
> longos, a legenda do passo seguinte aparecendo antes da voz e a fala do clique desencontrada do
> clique. As regras abaixo saíram do teste do Módulo 1 (Criar a inspeção), que foi validado.

---

## Como pedir

```
/treinamento <módulo> — versão Google Vids humanizada
```

```
Gere a versão Google Vids do treinamento de <módulo> seguindo docs/treinamento-google-vids.md:
cenas sincronizadas, roteiro em primeira pessoa e prévia de conferência.
```

- Se o treinamento do módulo **já existe** (`docs/treinamentos/<modulo>.md` e os MP4 gravados), parte
  dos vídeos prontos.
- Se **não existe**, primeiro grava o treinamento pela skill `/treinamento` (ou pelo
  `docs/replicar-no-painel-treinamento-video-slides.md`) e depois gera esta versão.

---

## O que é entregue

Tudo em `Downloads/Treinamento-<Módulo>/vids/`:

| Arquivo | Para quê |
|---|---|
| `cenas/Modulo-N/MN-01-vinheta.mp4`, `MN-02-<nome>.mp4`… | uma cena por arquivo, na ordem de montagem |
| `cenas-<tag>.json` | o mapa das cenas (de onde cada uma foi cortada) — para refazer só uma cena |
| `Roteiro-por-cena-<Módulo>.txt` | nome da cena + duração + texto para colar no Script |
| `Previa-<Módulo>.mp4` | (opcional) prévia com a voz de um teste exportado do Vids |

Na resposta do chat, o roteiro vem também em tabela: `cena | duração | texto`.

---

## Parte 1 — As regras de tempo (o que faz a sincronia funcionar)

### 1.1 Como o Vids se comporta (medido no teste)

| Medida | Valor | Uso |
|---|---|---|
| Atraso da voz no início da cena | **0,4 a 0,9 s** (média 0,5 s) | a fala nunca começa no quadro zero |
| Ritmo da voz | **≈ 2,8 palavras/s** (≈ 170 palavras/min; varia de 2,6 a 3,3) | orçamento de palavras |
| Pausa em `?` ou `…` | **+0,25 s** cada | somar no orçamento |
| Transição entre cenas | **+0,4 s** e desloca a voz | **não usar transições** (só depois da vinheta, se quiser) |
| A voz passa do fim da cena | corta ou atropela a cena seguinte | a cena tem que ser maior que a fala |

**Fórmula da duração mínima da cena:**

```
duração_mín = 0,5 + palavras / 2,8 + 0,25 × (nº de "?" e "…") + 0,3
```

Na prática: **cena de N segundos aguenta no máximo ≈ (N − 0,8) × 2,8 palavras.** (Estimativa; quem
manda é o teste do Passo 5.)

### 1.2 O que a gravação tem (e por que o corte antigo falhava)

Os vídeos gravados seguem sempre este padrão:

1. a legenda (overlay) do passo aparece;
2. a tela fica **parada** por vários segundos;
3. a **ação** acontece no fim (clique, digitação, rolagem);
4. **a legenda do passo seguinte já aparece no finalzinho** do mesmo vídeo.

Por isso, cortar "uma cena por fala do início ao fim do vídeo" dá errado: a voz termina cedo
(silêncio de 4 a 6 s), a fala do clique não bate com o clique e a legenda do próximo passo aparece
antes de a voz chegar nele.

> **Nos nossos gravadores** (`rec-*.js`), o `cap()` mostra a legenda e espera
> `max(2,6 s, duração da fala + 0,7 s)` com a tela parada; só depois o script executa as ações.
> Então, com o `linha-<tag>.json` e o `narr-<tag>-dur.json`, dá para calcular a janela parada e o
> início das ações de cada passo sem adivinhar. Use o vídeo **por módulo** sem áudio como origem
> (as bordas dele já caem nas trocas de legenda).

### 1.3 As regras de corte

1. **Toda cena começa numa troca de legenda ou numa ação** — nunca no meio de uma tela parada qualquer.
2. **O rabo de cada vídeo (a partir da troca de legenda) vai para o começo da cena seguinte.** A cena
   pode juntar trechos de dois arquivos (fim do `q01` + começo do `q02`).
3. **Cada passo vira duas cenas:**
   - **cena de explicação:** da troca de legenda até um ponto da tela parada; tem a fala que explica a
     tela;
   - **cena de ação:** começa ≈ **1,0 a 1,5 s antes da ação** e vai até a próxima troca de legenda;
     tem a fala curta do clique, posicionada para o verbo ("clica", "seleciona") cair em cima da ação.
   - **Ação curta (menos de 3 s):** fica na mesma cena da explicação (dois trechos colados num ponto
     parado), e a fala termina com o verbo da ação.
4. **Tela parada sobrando é cortada fora** (corte seco entre dois pontos parados). Antes de cortar,
   confirme com diferença de pixels que os dois quadros são iguais (`detectar.py --diff`); se a
   diferença for maior que um ponto de cursor, mude o ponto.
5. **Tela parada faltando** (fala maior que a cena): primeiro encurte o texto; se não der, use
   `tpad=stop_mode=clone` só o necessário (congelar ≤ 1,5 s).
6. **Folga no fim:** entre 0,3 e 1,0 s depois da fala. Silêncio máximo dentro do vídeo: **2 s**.
7. **Cena mínima:** 2 s (com fala de 1 a 4 palavras).
8. **Ação com fala:** clique, abrir lista, digitar, rolar a tela. Carregamentos (skeleton) não
   precisam de fala; deixe-os no começo da cena seguinte ou corte se forem longos.

### 1.4 Exemplo real (Módulo 1)

| Cena | Trecho | Dur. | Fala |
|---|---|---|---|
| 01 | vinheta `0–3,52` | 3,5 | E aí, vamos criar uma inspeção juntos? |
| 02 | `q01 1,4–11,1` | 9,7 | Essa é a tela de Inspeções. Tudo que já foi feito aparece aqui: a empresa, a data, quem foi a campo e em que pé está cada uma. |
| 03 | `q01 13,3–17,6` (clique em 15,8) | 4,3 | Pra começar, é só clicar em Nova Inspeção. |
| 04 | `q01 17,6–fim` + `q02 0–7,6` | 9,3 | Primeiro: em qual empresa vai ser a inspeção? Se a lista for grande, sem problema… dá pra buscar pelo nome ou pelo cê-ene-pê-jota. |
| 05 | `q02 10,4–15,0` (lista abre 10,9 · Próximo 13,7) | 4,6 | Achou a empresa? Seleciona e clica em Próximo. |
| 06 | `q02 15,0–fim` + `q03 0–8,72` | 10,4 | Agora você escolhe como quer começar. Em Branco é do zero. Se a empresa já tem inspeção, a Nova Revisão aproveita tudo que foi feito antes. |
| 07 | `q03 12,9–15,4` (clique 13,5) | 2,5 | Aqui, vamos começar do zero. |
| 08 | `q03 15,4–fim` + `q04 0–9,5` | 11,2 | Último passo: os dados da visita. Confere a data e quem vai a campo; se tiver mais alguém, é só adicionar. Repara: a revisão já vem numerada sozinha. |
| 09 | `q04 14,6–22,5` (digita 15–18,4 · Criar 19,5) | 7,9 | Nas observações, vale anotar o contexto da visita. Tudo certo? Clica em Criar Inspeção. |
| 10 | `q04 22,5–fim` + `q05 0–0,6` | 2,2 | E… prontinho! |
| 11 | `q05 0,6–9,1` | 8,5 | Lá em cima ficam os dados da empresa e os documentos que ela já tem. Daqui você tira o relatório, o pê-gê-érre, e conclui tudo. |
| 12 | `q05 12,2–fim` (rolagem 12,6) | 4,3 | Lá embaixo, as abas seguem o roteiro do campo. |

Resultado: de 1min40 com silêncios de até 6,3 s para 1min18 com silêncio máximo de 1,7 s.
(As cenas 02 e 11 passam um pouco da fórmula, mas foram aprovadas no teste real do Vids.)

---

## Parte 2 — Como escrever a narração (estilo "eu apresentando")

### 2.1 Persona

- Quem fala sou **eu, João**, mostrando o sistema para um colega técnico de SST, ao lado dele.
- Tom: **seguro, leve e prático**. Nem locutor de comercial, nem manual lido em voz alta.
- Pessoa: "você" para quem assiste; "a gente" quando fazemos juntos; "eu" de vez em quando
  ("eu sempre confiro a data antes").

### 2.2 Regras de linguagem

1. **Uma ideia por cena.** A tela manda: falo do que está aparecendo, no momento em que aparece.
2. **Frases curtas**, de 5 a 14 palavras. Nada de períodos com três vírgulas.
3. **Conversa, não lista:** "Primeiro:", "Agora", "Último passo:", "E… prontinho!" no lugar de
   "Passo um de três" ou "Etapa dois".
4. **Imperativo informal** nas ações: "clica", "seleciona", "confere", "repara". Pode usar "pra".
5. **Perguntas de gancho** puxam a próxima tela: "Achou a empresa?", "Tudo certo?".
6. **Reticências** para pausa curta e respiração: "sem problema… dá pra buscar pelo nome".
7. **Nome de botão e de aba exatamente como na tela** (Nova Inspeção, Próximo, Criar Inspeção).
8. **Dizer o porquê em meia frase** quando ajuda: "vale anotar o contexto da visita".
9. **Ligação entre cenas:** a última frase de uma cena prepara a próxima ("Pra começar, é só
   clicar em Nova Inspeção." → "Primeiro: em qual empresa vai ser a inspeção?").
10. **Fechamento do módulo** (última cena): uma frase que amarra e, se couber, aponta o próximo
    módulo ("No próximo, a gente cadastra os setores.").
11. Sem emoji, sem "olá pessoal", sem "neste vídeo vamos aprender". Sem citar número de item de norma
    que não esteja verificado (use `[VERIFICAR CITAÇÃO]` e avise).

### 2.3 Pronúncia

- Números por extenso ("revisão quatro").
- Siglas escritas como devem soar: CNPJ = "cê-ene-pê-jota", PGR = "pê-gê-érre", NR-01 =
  "ênê-érre zero um", EPI = "é-pê-i".
- **Teste na voz escolhida:** se o Vids já ler bem a sigla normal, volte para a sigla — às vezes a
  forma soletrada soa mais artificial. Registre a decisão no roteiro (`Pronúncia:` no topo).

### 2.4 Antes × depois (referência)

| Robótico (evitar) | Humanizado (usar) |
|---|---|
| Passo um de três: a empresa. Escolha onde a inspeção será feita. | Primeiro: em qual empresa vai ser a inspeção? |
| Selecione a empresa e clique em Próximo. | Achou a empresa? Seleciona e clica em Próximo. |
| O sistema numera a revisão automaticamente. | Repara: a revisão já vem numerada sozinha. |
| Pronto, a inspeção foi criada. | E… prontinho! |

### 2.5 Orçamento

Escreva a fala **depois** de saber a duração da cena e confira com a fórmula da 1.1. Se passar:
corte adjetivos e explicações secundárias primeiro; nunca corte o nome do botão nem o verbo da ação.
Palavras soletradas ("pê-gê-érre") contam como uma palavra na fórmula, mas duram mais: deixe folga.

---

## Parte 3 — Passos técnicos

Entradas (do pipeline `docs/replicar-no-painel-treinamento-video-slides.md`):
- os MP4 gravados por fala (`MN-00-vinheta.mp4`, `MN-01-q01.mp4`…) ou por módulo;
- `linha-<tag>.json` (campo `t`: quando cada legenda/fala começou), se existir;
- se o script de gravação registrar os cliques (`acoes-<tag>.json` com `t` e `tipo`), use; senão,
  detecte (passo 1).

`FF` aponta para o ffmpeg (imageio-ffmpeg ou do sistema). Scripts em `scripts/vids/`
(`detectar.py`, `cenas.py`, `conferir.py`; precisam de Pillow e numpy).

### Passo 1 — Mapear os eventos de cada vídeo

Para cada vídeo de origem, achar: **trocas de legenda**, **ações** (clique, lista abrindo, troca de
página, digitação, rolagem) e **trechos parados**.

```bash
python scripts/vids/detectar.py eventos  cenas-origem/M1-01-q01.mp4
python scripts/vids/detectar.py folha    cenas-origem/M1-01-q01.mp4 --de 12 --ate 19.3 --passo 0.5
python scripts/vids/detectar.py diff     cenas-origem/M1-01-q01.mp4 11.6 13.8
```

- `eventos`: lista de mudanças de cena do ffmpeg com nota. Nos nossos vídeos: **par de notas ≈ 0,07
  com 0,15 s de distância = troca de legenda** (fade da caixa); ≈ 0,04–0,05 = clique/realce;
  ≥ 0,3 = troca de página. Mudanças periódicas de ≈ 0,009 a cada 5,1 s são ruído — ignore.
- `folha`: folha de quadros com o tempo carimbado. **Sempre olhe a folha** antes de decidir o corte;
  a nota sozinha engana (digitação quase não gera nota).
- `diff`: confirma se dois quadros são iguais (para corte seco em tela parada).

Monte uma tabela por vídeo: `legenda Lk em t`, `ação em t`, `próxima legenda em t`, `fim`.

### Passo 2 — Planejar as cenas (`cenas-<tag>.json`)

Aplique as regras da 1.3 e escreva o mapa:

```json
{
  "modulo": "1",
  "titulo": "Criar a inspeção",
  "origem": "cenas-origem",
  "cenas": [
    {"nome": "M1-01-vinheta",        "segs": [["M1-00-vinheta.mp4", 0, 3.52]],
     "fala": "E aí, vamos criar uma inspeção juntos?"},
    {"nome": "M1-02-lista-inspecoes", "segs": [["M1-01-q01.mp4", 1.4, 11.1]],
     "fala": "Essa é a tela de Inspeções. Tudo que já foi feito aparece aqui: ..."},
    {"nome": "M1-04-passo1-empresa",  "segs": [["M1-01-q01.mp4", 17.6, null], ["M1-02-q02.mp4", 0, 7.6]],
     "fala": "Primeiro: em qual empresa vai ser a inspeção? ...", "acao": null},
    {"nome": "M1-05-seleciona-empresa", "segs": [["M1-02-q02.mp4", 10.4, 15.0]],
     "fala": "Achou a empresa? Seleciona e clica em Próximo.", "acao": [0.5, 3.3]}
  ]
}
```

- `null` no fim = até o fim do arquivo.
- `acao` (opcional): segundos **dentro da cena** em que as ações acontecem — o `cenas.py` avisa se o
  verbo da fala provavelmente cai longe delas.
- `congelar` (opcional): segundos de `tpad` no fim, só quando a regra 1.3.5 exigir.

### Passo 3 — Gerar as cenas e o roteiro

```bash
python scripts/vids/cenas.py cenas-insp-m1.json --saida "Downloads/Treinamento-Inspecao/vids"
python scripts/vids/cenas.py cenas-insp-m1.json --saida "..." --so M1-05-seleciona-empresa   # refaz só uma cena
```

`scripts/vids/cenas.py` (resumo; o arquivo no repositório é a referência):

```python
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

spec = json.load(open(sys.argv[1], encoding='utf-8'))
saida = sys.argv[sys.argv.index('--saida') + 1] if '--saida' in sys.argv else '.'
pasta = os.path.join(saida, 'cenas', f"Modulo-{spec['modulo']}"); os.makedirs(pasta, exist_ok=True)
txt = [f"MÓDULO {spec['modulo']} — {spec['titulo'].upper()} · Roteiro por cena (Google Vids)",
       'Cole o texto de cada cena no Script da cena com o mesmo nome. Sem transições entre cenas.', '']
alertas = []
for c in spec['cenas']:
    segs = [(os.path.join(spec['origem'], f), a, b) for f, a, b in c['segs']]
    dst = os.path.join(pasta, c['nome'] + '.mp4'); montar(segs, dst, c.get('congelar', 0))
    d = dur(dst); need, pal = fala_seg(c['fala'])
    folga = d - need - TAIL
    if folga < -0.3: alertas.append(f"{c['nome']}: fala longa demais ({need:.1f}s p/ cena de {d:.1f}s) — corte {int(-folga*WPS)+1} palavra(s)")
    if folga > 2.0: alertas.append(f"{c['nome']}: {folga:.1f}s de silêncio no fim — encurte a cena ou aumente a fala")
    br = lambda x: f'{x:.1f}'.replace('.', ',')
    txt += [f"{c['nome']}  ({br(d)} s · fala ≈ {br(need)} s · {pal} palavras)", c['fala'], '']
open(os.path.join(saida, f"Roteiro-por-cena-M{spec['modulo']}.txt"), 'w',
     encoding='utf-8-sig', newline='\r\n').write('\n'.join(txt) + '\n')
print('\n'.join(alertas) or 'Todas as cenas dentro do orçamento.')
```

- **Codificação:** roteiro em UTF-8 **com BOM** e `\r\n` (abre certo no Bloco de Notas).
- **Formatação:** troque `.` por `,` só nos números, nunca na linha inteira (estraga o `.mp4`).
- Recodifica sempre (`libx264`, 25 fps, sem áudio) para o corte ficar exato.

`scripts/vids/detectar.py` (eventos, folha e diff) e `scripts/vids/conferir.py` (Passo 5) estão no
repositório.

### Passo 4 — Conferir (antes de entregar)

- Número de cenas = passos × 2 (explicação + ação), mais vinheta, mais fechamento quando houver
  (menos um por ação curta que ficou na cena da explicação).
- `cenas.py` sem alertas.
- Folha de quadros do **primeiro e do último quadro de cada cena**: a cena começa na legenda certa e
  **não mostra a legenda do passo seguinte** no fim.
- Nenhum corte seco visível (todos passaram no `diff`).

### Passo 5 — Validar com o teste do Vids (quando houver um export)

Depois que eu montar no Vids e exportar um teste (`teste.mp4`), rode:

```bash
python scripts/vids/conferir.py teste.mp4 cenas-insp-m1.json --saida "Downloads/Treinamento-Inspecao/vids"
```

O `conferir.py` acha onde cada cena começa no export (pela imagem, então funciona mesmo com
transições ligadas), acha as falas no áudio e compara.

Critério de aprovado: **toda voz termina antes do fim da cena**, **atraso ≤ 0,9 s**, **silêncio ≤ 2 s**.
Se algo falhar: ajuste o corte daquela cena (ou o texto) no `cenas-<tag>.json` e gere de novo só ela
(`--so <nome>`).

**Prévia opcional:** com os trechos de voz do teste, dá para colar cada fala sobre a cena nova
(`adelay=400`) e gerar `Previa-<Módulo>.mp4` para ouvir antes de refazer no Vids.

---

## Como montar no Google Vids

1. Apague as cenas antigas. **Uma cena por arquivo**, na ordem dos números.
2. **Sem transições** entre as cenas (no máximo uma depois da vinheta).
3. Em cada cena, cole no **Script** o texto da cena (do `Roteiro-por-cena`). Sempre a mesma voz.
4. Gere as vozes e confira na linha do tempo: **a barra azul da narração termina antes do fim da
   cena.** Se passar, encurte o texto daquela cena; não estique a cena no Vids (desalinha o resto).
5. Exporte um teste e rode o Passo 5 se quiser validar com números.

---

## Observações

- **Legendas e cursor** fazem parte da gravação. Para tirá-los, grave de novo sem o overlay. Se
  regravar, **registre os cliques com tempo** (`acoes-<tag>.json`) — o Passo 1 fica automático.
- **Gravações futuras:** deixar ~2 s de tela parada depois de cada ação e só então mostrar a legenda
  do passo seguinte facilita o corte.
- **Acesso ao Vids:** não há conexão direta. Os arquivos podem ir para o Google Drive e ser
  importados de lá.

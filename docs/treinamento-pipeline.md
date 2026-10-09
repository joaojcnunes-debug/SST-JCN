# Treinamento em vídeo: gravar → roteiro → voz → vídeo final

Padrão para criar os próximos treinamentos do **Painel SST**. O resultado é um vídeo por
módulo, mais o vídeo completo, com a tela do sistema, a narração em primeira pessoa (o João
apresentando), a **voz encaixada no que acontece na tela** e a legenda.

> Substitui o fluxo do Google Vids (`docs/treinamento-google-vids.md`). Aquele fluxo cortava cenas e
> dependia da voz do Vids: a voz entrava com atraso, as cenas desalinhavam e o tempo era estimado por
> fórmula. Aqui a voz é gerada localmente com o **edge-tts**, que informa o instante de cada palavra.
> Por isso dá para fazer o "clica" cair exatamente no clique. Foi validado em 2026-10-08 com o
> Módulo 1 da Inspeção e com uma gravação de teste.

## Como pedir

```
/treinamento <módulo>
```
ou: *"Siga docs/treinamento-pipeline.md para criar o treinamento de <módulo>."*

O conteúdo do treinamento continua sendo levantado na skill `/treinamento` (Fases 0 a 2: combinar,
entender pelo código, dividir em módulos). Este documento define **como o vídeo é produzido**.

## Visão geral

```
 Etapa 1  GRAVAR      rec-<tag>.js (gravador.js) ─► <tag>.webm + eventos-<tag>.json + prints/
 Etapa 2  ROTEIRO     planejar.py ─► <tag>.mp4 + roteiro-<tag>.json (esqueleto) + folhas/
                      você escreve as falas no roteiro, presas aos eventos
 Etapa 3  VOZ         agente narrador-tts: narrar.py ⟲ ajusta falas até "STATUS: OK"
 Etapa 4  MONTAGEM    montar.py ─► Modulo-N-<titulo>.mp4 + .srt  (e o completo)
 Etapa 5  CONFERIR    conferir.py ─► voz medida no MP4 + folha das palavras-âncora
```

Tudo em `scripts/treinamento/`. Cada script tem o uso no cabeçalho.

## Ferramentas (uma vez por máquina)

```bash
bash scripts/treinamento/instalar.sh
```

O script instala, **fora do projeto**, em `C:/Users/Usuario/ferramentas/`:

| O quê | Onde |
|---|---|
| edge-tts (clonado de https://github.com/rany2/edge-tts) | `ferramentas/edge-tts` (instalado com `pip -e` no venv) |
| Python com edge-tts, numpy, Pillow, imageio-ffmpeg | `ferramentas/treinamento-venv` |
| ffmpeg completo (libx264, libass, drawtext) | dentro do venv (`imageio_ffmpeg`); o `comum.py` acha sozinho |
| playwright-core 1.63 | `ferramentas/pw/node_modules` (use `NODE_PATH`) |
| Chromium headless | o que o Playwright MCP já baixou: `%LOCALAPPDATA%/ms-playwright/chromium_headless_shell-1228/…` |

Atalhos usados abaixo:
```bash
PY=C:/Users/Usuario/ferramentas/treinamento-venv/Scripts/python.exe
T=C:/Users/Usuario/sst-jcn/scripts/treinamento
```

Nada disso entra no `package.json` do projeto. A pasta `ferramentas` sobrevive entre sessões; o
scratchpad, não. Por isso as ferramentas ficam lá, e não no scratchpad.

---

## Etapa 1: gravar a tela (mantida, agora com eventos)

> **Sempre no Painel SST** (`https://painel-sst.chabra.com.br`), nunca no SST-JCN, mesmo que o módulo
> exista nos dois e mesmo que seja preciso regravar. É produção: só a empresa de teste
> **TESTE JOÃO E PHELIPE** e as proteções de privacidade abaixo.

A gravação continua como antes: Playwright headless em 1600×900, cursor vermelho injetado, empresa de
teste, login feito pelo usuário e `state.json` só na pasta temporária. O que mudou é que o
`rec-<tag>.js` usa o **`gravador.js`**, que registra o tempo de cada passo e de cada ação.

Modelo: `scripts/treinamento/rec-modelo.js`. Rodar:
```bash
MSYS_NO_PATHCONV=1 NODE_PATH=C:/Users/Usuario/ferramentas/pw/node_modules MODE=debug node rec-<tag>.js
```

| Função | Para quê |
|---|---|
| `g.sync()` | pisca um quadro magenta logo depois da primeira página; o `planejar.py` acha esse quadro e acerta o relógio (acabou o `OFF = 0,55 s` chutado) |
| `g.passo(rotulo, {fala \| ms})` | começo de um assunto/tela; segura a tela parada pelo tempo estimado da fala de rascunho (mínimo 2,5 s) |
| `g.clicar(loc, rotulo)` | leva o cursor até o alvo, espera 0,45 s e clica; o instante registrado é o **clique** |
| `g.digitar(loc, texto, rotulo)` · `g.escolher(loc, opção)` · `g.foco(loc)` | digitação, select e rolagem, com o mesmo registro |
| `g.acao(rotulo, fn)` | qualquer outra ação |
| `g.cobrir(texto)` · `g.descobrir()` | **privacidade:** capa verde sobre a página inteira (o gravador confere que está no topo, senão aborta). Cubra **antes** de abrir qualquer lista com empresas ou pessoas, filtre até sobrar só o registro de teste, confira por código e só então descubra |
| `g.print(nome)` | print sem cursor e sem legenda (vai para `prints/`) |
| `g.fim()` | fecha e grava `<tag>.webm` e `eventos-<tag>.json` |

Regras de gravação:
1. **Um `passo` por tela ou assunto, e uma chamada por ação.** Cada ação vira um ponto onde a fala pode se prender.
2. **Nunca desenhe legenda na tela** (`legendaNaTela: false`, o padrão). A única legenda do vídeo é a
   da narração, gerada na montagem. Gravação com caixa de legenda (os `rec-*.js` antigos com `cap()`)
   sai com duas legendas sobrepostas: regrave.
3. **Tela parada é barata.** O tempo exato não importa: na Etapa 3, a tela parada é esticada ou
   encurtada para caber a fala. Mesmo assim, deixe ~2 s parado depois de cada ação importante.
4. Sempre `MODE=debug` antes do `final`.
5. **Privacidade (Painel = produção):** toda lista que possa mostrar cliente real (seletor de empresa,
   listas gerais) fica sob `g.cobrir()` até o filtro deixar só a empresa de teste. **Não** confie em CSS
   para esconder a lista: em 2026-10-09 o `visibility:hidden` por classe no `<html>` não pegou e a
   gravação mostrou clientes (foi apagada na hora). Depois de gravar, gere a folha do trecho da lista
   (`python scripts/vids/detectar.py folha <tag>.mp4 --de A --ate B --passo 0.25`) e olhe quadro a quadro.
   Nunca abra /aep (lista) nem a Sinalização.
6. Uma gravação por módulo (`TAG=insp-m1`, `insp-m2`…). Fica mais fácil regravar um módulo só.

## Etapa 2: roteiro preso aos eventos

```bash
$PY $T/planejar.py <pasta>/eventos-insp-m1.json --modulo 1 --titulo "Criar a inspeção"
```

O script:
- acha o quadro de sincronia, corta o começo e gera `<tag>.mp4` a 25 fps constante;
- mede o **movimento** na imagem (cursor, digitação, carregamento, rolagem). O que se mexe é **rígido**
  (nunca é cortado nem esticado); o resto é **tela parada** (elástica);
- grava o `roteiro-<tag>.json` com os eventos e um trecho de fala vazio por evento. Se o roteiro já
  existir, grava `roteiro-<tag>.esqueleto.json` e não apaga o seu;
- gera `folhas/<tag>-NN.png`, com a tela logo depois de cada evento. **Olhe as folhas antes de escrever.**

### O formato do roteiro

```json
{
 "tag": "insp-m1", "modulo": "1", "titulo": "Criar a inspeção",
 "subtitulo": "Empresa, tipo e dados da visita", "treinamento": "Treinamento Inspeção · Painel SST",
 "video": "insp-m1.mp4", "voz": "pt-BR-ThalitaMultilingualNeural", "ritmo": "+0%",
 "pronuncia": {"CNPJ": "cê-ene-pê-jota"},
 "vinheta":    {"fala": "E aí, vamos criar uma inspeção juntos?"},
 "fechamento": {"fala": "No próximo, a gente cadastra os setores."},
 "eventos": [ "... gerado pelo planejar.py, não editar ..." ],
 "trechos": [
  {"em": "e01", "fala": "Essa é a tela de Inspeções. Tudo que já foi feito aparece aqui."},
  {"em": "e02", "ancora": "clicar", "fala": "Pra começar, é só clicar em Nova Inspeção."},
  {"em": "e05", "fala": "Último passo: os dados da visita."},
  {"fala": "Nas observações, vale anotar o contexto da visita."},
  {"em": "e07", "ancora": "clica", "fala": "Tudo certo? Clica em Criar Inspeção."}
 ]
}
```

| Campo | Regra |
|---|---|
| `em` | evento ao qual a fala se prende. **Sem `em`**, a fala é dita logo depois da anterior (encadeada). Use para explicar antes de uma ação que vem colada em outra |
| `ancora` | começo de uma palavra da fala (`clica`, `seleciona`, `escolhe`). Essa palavra começa 0,1 s antes do instante da ação. Sem âncora, a fala começa 0,3 s depois do evento (e pode atrasar até 1,5 s dentro da tela parada) |
| `fala` | texto **escrito normal** (é o que vai para a legenda). A pronúncia vai em `pronuncia` |
| `_tela`, `_tempo_natural`, `_palavras_ate` | dicas do esqueleto (ignoradas pelos scripts): o que a tela mostra, quanto tempo há até o próximo evento e quantas palavras cabem sem esticar |
| trecho com `fala` vazia | ignorado (o evento passa sem narração) |
| `voz` | `pt-BR-ThalitaMultilingualNeural` (padrão, escolhida pelo usuário em 2026-10-08). Outras: `pt-BR-FranciscaNeural`, `pt-BR-AntonioNeural`. Use sempre a mesma voz em todos os módulos |

**Explicação + ação.** Para um passo com tela nova e clique no fim, faça dois trechos: um preso ao
`passo`, que explica a tela, e outro preso ao clique, com âncora no verbo. Ação curta junto de outra
(selecionar e já clicar em Próximo) fica num trecho só, com âncora no primeiro verbo.

### Como escrever (estilo "eu apresentando")

Mantido do MD do Vids, porque funcionou:

1. **Quem fala é o João**, ao lado de um colega técnico de SST. O tom é seguro, leve e prático: nem
   locutor de comercial, nem manual lido. Use "você" para quem assiste, "a gente" quando fazemos
   juntos e "eu" de vez em quando.
2. **Uma ideia por trecho**, sobre o que está na tela naquele momento. Frases de 5 a 14 palavras
   (interjeições e ganchos curtos, como "E… prontinho!", são a exceção).
3. **Conversa, não lista:** "Primeiro:", "Agora", "Último passo:", "E… prontinho!", e não "Passo um de três".
4. **Imperativo informal nas ações** ("clica", "seleciona", "confere", "repara"); pode usar "pra".
5. **Pergunta de gancho** puxa a próxima tela: "Achou a empresa?", "Tudo certo?".
6. **Reticências** para respirar: "sem problema… dá pra buscar pelo nome".
7. **Nome de botão e de aba exatamente como na tela.**
8. **O porquê em meia frase** quando ajuda: "vale anotar o contexto da visita".
9. A última frase de um trecho prepara o próximo. O **fechamento** amarra o módulo e aponta o próximo.
10. Sem emoji, sem "olá pessoal", sem "neste vídeo vamos aprender". Item de norma não verificado vai
    como `[VERIFICAR CITAÇÃO]` e você avisa o usuário.
11. Todo fato sai do código (Fase 1 da skill). Não invente regra do sistema.

| Robótico (evitar) | Humanizado (usar) |
|---|---|
| Passo um de três: a empresa. Escolha onde a inspeção será feita. | Primeiro: em qual empresa vai ser a inspeção? |
| Selecione a empresa e clique em Próximo. | Achou a empresa? Seleciona e clica em Próximo. |
| O sistema numera a revisão automaticamente. | Repara: a revisão já vem numerada sozinha. |
| Pronto, a inspeção foi criada. | E… prontinho! |

**Pronúncia.** Escreva a sigla normal e ouça. Só se soar mal, ponha no `pronuncia` (`"NR-01": "ênê-érre
zero um"`, `"EPI": "é-pê-i"`, `"AIHA": "aiá"`). Números por extenso na fala quando forem lidos errado.
Registre o dicionário em `docs/treinamentos/<modulo>.md`.

**Orçamento.** Use `_palavras_ate` como teto inicial. Passar um pouco não tem problema: a tela parada
estica. Quem decide se coube é o `narrar.py`.

## Etapa 3: voz e encaixe (agente `narrador-tts`)

O roteiro pronto vai para o agente **`narrador-tts`** (`.claude/agents/narrador-tts.md`). Ele roda
o `narrar.py`, lê o relatório, reescreve só as falas que não couberam (mantendo o estilo acima) e
repete até `STATUS: OK`. Depois monta e confere (Etapas 4 e 5). Exemplo de chamada:

> Agent `narrador-tts`: "Narre e monte `…/gravacao/roteiro-insp-m1.json` e `roteiro-insp-m2.json`.
> Saída `Downloads/Treinamentos Painel SST/Treinamento-Inspecao/narrado`, trilha `…/trilha.wav`,
> completo `Treinamento-Inspecao-completo`."

À mão:
```bash
$PY $T/narrar.py <pasta>/roteiro-insp-m1.json
```

### Como o encaixe funciona

1. Cada fala vira MP3 pelo edge-tts (`WordBoundary`), com o tempo de cada palavra. O cache fica em
   `voz/<hash>.mp3` e muda só quando o texto, a voz ou o ritmo mudam.
2. O vídeo é dividido em trechos **rígidos** (ações e movimento) e trechos de **tela parada**.
3. Cada fala é posicionada no seu evento: a âncora fica no instante da ação, e a fala sem âncora
   começa logo depois do evento.
4. Se a fala precisa de mais tempo antes do evento, **congela-se a última tela parada** antes dele.
   Isso não aparece no vídeo, porque a tela já estava parada. Se sobra silêncio (mais de 1 s entre
   falas), a tela parada é **encurtada** (no mínimo 0,4 s por trecho). Trecho rígido nunca muda.
5. Saem `sincronia-<tag>.json` (cortes, posição de cada voz, legendas) e `relatorio-<tag>.txt`.

| Alerta no relatório | Significa | Correção |
|---|---|---|
| `congelou X s antes de eN — corte ~K palavras de fNN` | a fala citada não cabe; a tela ficaria presa mais de 3,5 s | encurtar ~K palavras da fala citada |
| `congelou durante movimento … encadeie` | não há tela parada entre duas ações coladas | tirar o `em` da fala anterior ou encurtá-la |
| `a fala começa X s antes da tela eN` | a parte antes da âncora é longa e invade a tela anterior | encurtar antes da âncora ou dividir em dois trechos |
| `âncora "x" não está na fala` | âncora digitada errado | corrigir a âncora |
| `X s sem fala antes (tela em movimento)` | ação longa sem narração | opcional: fala curta no meio |
| `final: congelou` | fechamento longo para a última tela | encurtar |

Na tabela do relatório, a coluna **`tela`** mostra quanto a tela parada antes do evento foi esticada
(`+1,0` = congelou 1 s) ou encurtada (`-3,4`). Até 3,5 s é normal e não gera alerta.

Limites (constantes no topo do `narrar.py`): congelar até 3,5 s (6 s na última tela), pausa máxima
de 1 s entre falas quando há tela parada para cortar, 0,35 s de respiro entre falas e ritmo `+0%`
(com `+5%` a voz ficou travada).

## Etapa 4: montagem

```bash
$PY $T/montar.py <pasta>/roteiro-insp-m1.json <pasta>/roteiro-insp-m2.json … \
    --saida "C:/Users/Usuario/Downloads/Treinamentos Painel SST/Treinamento-<Módulo>/narrado" \
    --musica "<…>/trilha-motivacional-original.wav" --completo "Treinamento-<Módulo>-completo"
```

- **Vinheta** de 3,5 s (ou mais, se a fala da vinheta pedir), com "Módulo N", título, subtítulo e
  nome do treinamento (identidade verde `#12372A` e âmbar `#F0B866`).
- **Nome do arquivo:** `Modulo-<modulo>-<titulo>`. Dois roteiros com o mesmo módulo e título na mesma
  chamada são recusados.
- **Vídeo:** as peças do `sincronia` em quadros inteiros, renumeradas depois do concat
  (`setpts=N/(25*TB)`). Sem isso, os quadros congelados encurtavam o vídeo e o clique adiantava em
  relação à fala.
- **Voz:** cada MP3 no seu instante, com a narração normalizada em −18 LUFS.
- **Legenda:** `.srt` ao lado de cada MP4 (para YouTube, Drive e players) e **queimada** no vídeo
  (ASS 1600×900, Arial 38, caixa verde semitransparente, embaixo). `--legenda-topo` sobe a legenda
  quando a gravação antiga tem caixa embaixo; `--sem-queimar` entrega só o `.srt`.
- **Trilha** (opcional) 10 LU abaixo da narração, com entrada de 2 s e saída de 3 s. No completo, a
  trilha entra uma vez e corre contínua. Trilha original: `$PY $T/musica.py trilha.wav 960` (síntese
  própria; nunca baixe música de terceiros).

## Etapa 5: conferir antes de entregar

```bash
$PY $T/montar.py <roteiro> --saida <pasta>/conferencia          # sem --musica
$PY $T/conferir.py <roteiro> <pasta>/conferencia/Modulo-N-….mp4
```

- **Áudio:** mede onde cada fala começa no MP4 e compara com o plano (tolerância de 0,2 s). Com
  trilha não há silêncio para medir, por isso a conferência é feita na versão sem música.
- **Folha `conferir-<tag>.png`** (gravada ao lado do roteiro): mostra o quadro do instante em que cada palavra-âncora é dita. O
  cursor tem que estar no botão, ou a lista abrindo. Abra com `Read`.
- Assista a pelo menos um módulo inteiro antes de entregar.

## Entrega

Em `Downloads/Treinamentos Painel SST/Treinamento-<Módulo>/`:

| Pasta/arquivo | Conteúdo |
|---|---|
| `narrado/Modulo-N-<titulo>.mp4` + `.srt` | **versão principal**: voz encaixada e legenda |
| `narrado/Treinamento-<Módulo>-completo.mp4` + `.srt` | todos os módulos com trilha contínua |
| `prints/` | prints de cada etapa (sem cursor e sem legenda) |
| `_producao/` | `rec-*.js`, `eventos-*.json`, `roteiro-*.json`, `sincronia-*.json`, `relatorio-*.txt` (para refazer um módulo) |

Registre em `docs/treinamentos/<modulo>.md` os módulos, as falas finais (copie dos roteiros), o
dicionário de pronúncia e os pontos de atenção da gravação. Os slides seguem a skill `/treinamento`
(Fase 5).

## Refazer quando o sistema mudar

- **Mudou o texto:** edite o roteiro, rode `narrar.py` e depois `montar.py` (minutos).
- **Mudou a tela de um módulo:** regrave só aquele `rec-<tag>.js` e rode `planejar.py`. O esqueleto novo
  vem como `.esqueleto.json`: copie para o roteiro os `eventos` e o `movimento` novos e confira se
  cada `em` ainda aponta para o evento certo.

## Gravações antigas (sem `eventos-*.json`)

Não use para entregar. As gravações antigas têm a caixa de legenda desenhada na tela (fica uma
legenda de fundo sob a nova) e algumas foram feitas no SST-JCN. Regrave no Painel SST com o
`gravador.js`. O `planejar.py <video.mp4> --tag X --de 3.6` ainda aceita um vídeo sem eventos (cria um
evento `mNN` por trecho de movimento), mas só serve para teste.

## Google Vids (opcional)

Para quem ainda precisar montar no Vids, o fluxo antigo continua em `docs/treinamento-google-vids.md`,
com `scripts/vids/`. O caminho padrão agora é este.

## Checklist

- [ ] `instalar.sh` rodado; `ferramentas/treinamento-venv` existe.
- [ ] Gravação **no Painel SST** com `gravador.js`, `g.sync()` logo no começo, `MODE=debug` antes do `final`, só a empresa de teste.
- [ ] Listas de empresas sob `g.cobrir()`; folha do trecho olhada quadro a quadro (nenhum cliente real).
- [ ] `planejar.py` achou o quadro de sincronia ("sincronia: quadro magenta em …").
- [ ] Folhas olhadas; cada fala presa ao evento certo; âncora no verbo das ações.
- [ ] `narrar.py` com `STATUS: OK` em todos os módulos.
- [ ] `conferir.py` com 0 falas para conferir e a folha das âncoras olhada.
- [ ] Um módulo assistido inteiro; volume da trilha só de fundo.
- [ ] `state.json` apagado; registros de demonstração listados para o usuário decidir (nunca apagar sem um sim).
- [ ] `docs/treinamentos/<modulo>.md` atualizado com as falas finais e a pronúncia.

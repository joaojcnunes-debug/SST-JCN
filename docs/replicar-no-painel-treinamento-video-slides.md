# Replicar no Painel SST: criação de treinamento (vídeo-aula narrada + slides)

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-treinamento-video-slides.md` para criar o treinamento da AEP"*
> (ou de outro módulo: troque o roteiro, Passo 4).
>
> Origem: JCN (`sst-jcn`), 2026-10-07. Produziu o treinamento da AEP: deck de 47 slides com notas,
> 8 vídeo-aulas por módulo + vídeo completo (13min46s), narração em português e trilha de fundo original.
> **Nada disto entra no código do painel nem no banco.** É um processo de produção que roda numa pasta
> temporária e usa o sistema em produção só como "cenário" da gravação.

## O que o processo entrega

| Peça | Como é feita |
|---|---|
| **Prints** de cada etapa | navegador automático (Playwright) preenchendo uma AEP de demonstração |
| **Vídeo com cursor e legendas** | o mesmo navegador grava a tela (`recordVideo`); cursor vermelho e caixa de legenda injetados na página |
| **Narração** | texto por passo → voz neural pt-BR (`edge-tts`, voz `pt-BR-FranciscaNeural`, ritmo normal) |
| **Sincronia voz × imagem** | a narração é gerada **antes**; o robô espera cada fala terminar e registra o segundo exato de cada uma (`linha*.json`) |
| **Trilha de fundo** | música original sintetizada em Python (sem direitos de terceiros), mixada ~10 LU abaixo da narração |
| **Módulos** | cortes do vídeo narrado pelos tempos registrados + vinheta de 3,5 s com título |
| **Slides** | Artifact do tipo **Slides** (claude.ai): HTML por slide, prints e vídeos como assets |

## Regras de segurança (obrigatórias)

1. **Só uma empresa de teste.** A gravação cria e salva uma AEP de verdade. Use a empresa de teste do
   painel (nunca cliente real). Ao final, liste as AEPs criadas e **pergunte ao usuário** antes de mandar
   qualquer uma para a Lixeira.
2. **Login é do usuário.** Abra a tela de login no navegador do Playwright MCP e peça para ele entrar.
   Nunca peça a senha no chat.
3. **Sessão copiada = segredo.** O `state.json` (cookies/token) fica só na pasta temporária, nunca no
   repositório, e é **apagado** ao fim de cada gravação.
4. **Não clicar em "salvar na biblioteca"** nem alterar Texto Padrão/biblioteca durante a demonstração
   (mexe em dados compartilhados).
5. **Ferramentas em pasta temporária**, fora do projeto (`npm`/`pip --target`). Não mexer em
   `package.json` do painel.
6. A narração é enviada ao serviço de voz on-line da Microsoft (`edge-tts`): só o **texto da narração**,
   nunca dados do sistema.

## Passo 1: ferramentas (pasta temporária `<T>`)

```bash
T=<pasta-temporária>; mkdir -p "$T/pw" && cd "$T/pw"
npm init -y && npm i playwright-core@<mesma versão do Playwright MCP>
python -m pip install --target "$T/pyff" imageio-ffmpeg          # ffmpeg COMPLETO (concat, libx264, aac, drawtext)
python -m pip install --target "$T/pytts" edge-tts numpy pillow   # voz + música
export FF="$T/pyff/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"   # nome exato: veja a pasta
```

- **Navegador:** use o Chromium que o Playwright MCP já baixou, por exemplo
  `%LOCALAPPDATA%/ms-playwright/chromium_headless_shell-<rev>/chrome-headless-shell-win64/chrome-headless-shell.exe`.
  Defina o caminho em `CHROME_PATH`. Se a versão do `playwright-core` pedir outra revisão, aponte para a que existe.
- **ffmpeg:** **não** use o ffmpeg que vem com o Playwright. Ele só codifica VP8 e não tem `concat`.

## Passo 2: sessão de login

1. No Playwright MCP, abra `<BASE_URL>/login` e peça ao usuário para entrar.
2. Exporte a sessão, salvando dentro da raiz que o MCP permite (a pasta do projeto) e mova **na hora**
   para `$T/pw/state.json`:
   ```js
   async (page) => { await page.context().storageState({ path: '<projeto>/.playwright-mcp/state.json' }); }
   ```
3. Antes de cada gravação nova, exporte de novo, porque a sessão expira. Ao terminar, faça `rm state.json`.

## Passo 3: gravar SEM janela (headless) — lição aprendida

- **Gravar em navegador headless.** Gravar na janela visível falhou: a tela do usuário limita a altura
  da janela e o vídeo saiu com uma faixa vazia embaixo.
- **Tamanho:** `viewport` e `recordVideo` iguais, em 1600×900.
- **`run_code` do MCP não serve para isto.** Ele não guarda estado entre chamadas e não importa
  módulos. Por isso a gravação é um script Node próprio (`rec3.js`), rodado com `node`.

Variáveis do script:

| Variável | Exemplo |
|---|---|
| `BASE_URL` | URL do painel em produção |
| `EMPRESA_BUSCA` | texto que acha a empresa de teste no seletor (e no Comercial) |
| `RESPONSAVEL` | nome exato no select "Responsável pela elaboração" |
| `CHROME_PATH` | caminho do headless shell |
| `MODE` | `debug` (não salva nada, usa `AEP_ID` existente) ou `final` (cria e salva) |
| `ATE` | para em `coleta`, `cognitiva`, `sinais` ou `ni` (ensaios curtos) |
| `GESTAO=1` | ensaia só o checklist de gestão |
| `START=1` + `AEP_ID` | retoma do "Liberar para o Comercial" numa AEP já concluída |

**Sempre ensaie com `MODE=debug`** numa AEP de rascunho antes do `final`. Cada `final` cria uma AEP nova.

## Passo 4: roteiro de narração

- **Formato:** um JSON `{id: texto}`, **na mesma ordem** das chamadas `cap()` do script. Os ids `p01`… são
  atribuídos em sequência; confira que o número de `cap(` com texto é igual ao número de falas.
- **Legenda × fala:** a legenda (texto curto na tela) é o argumento do `cap()`. A fala, mais longa e
  explicativa, está no JSON.
- **Pronúncia:**
  - "AIHA" deve soar **"aiá"**: escreva `aiá` no texto da fala;
  - "N/I" vira `N I` e "N/A" vira `N A`;
  - números grandes vão por extenso ("vinte e seis").
- **Sem aceleração:** ritmo `+0%`. Com `+5%`, a voz ficou "travada".
- **Estilo:** explique **campo por campo**, dizendo o que preencher e por quê (é o que deixou dinâmico).

### `narr3.json` (o roteiro usado na AEP)

```json
{
  "p01": "Vamos criar uma AEP do zero. Em Nova Análise, comece pela empresa: digite parte do nome ou o CNPJ e escolha na lista.",
  "p02": "Agora escolha o responsável pela elaboração. O título e o registro profissional saem impressos no laudo, junto da assinatura. Confira se estão corretos.",
  "p03": "Em Registrar em inspeção, você pode usar a inspeção da visita, criar uma nova ou seguir sem inspeção. Neste exemplo, vamos sem inspeção.",
  "p04": "Pronto, a AEP foi criada. A faixa no topo mostra a situação do documento. Sem inspeção, ele entra na Sinalização Psicossocial quando for concluído.",
  "p05": "Cada setor é avaliado separadamente. Clique em Adicionar setor.",
  "p06": "Informe o nome do setor como a empresa usa no dia a dia. O GHE é o grupo homogêneo de exposição: trabalhadores com atividades parecidas, expostos aos mesmos fatores.",
  "p07": "Na jornada, registre a carga horária real, como oito horas por dia e quarenta e quatro na semana. Em quantidade de expostos, informe quantas pessoas trabalham no setor.",
  "p08": "Em Cargos do setor, clique em Cargo e informe o nome da função, uma descrição curta do que a pessoa faz e quantos trabalhadores ocupam essa função.",
  "p09": "Agora a participação dos trabalhadores, exigida pela NR-01. Registre como você ouviu as pessoas. Dá para marcar mais de um método.",
  "p10": "Nas condições da coleta, informe quantos trabalhadores foram abordados, quantos participaram e quantas recusas ou respostas evasivas houve. Só números, nunca nomes.",
  "p11": "Se a liderança estava presente, marque. E se perceber sinais de inibição, como silêncio quando a liderança se aproxima, marque também. O sistema avisa e recomenda um instrumento anônimo.",
  "p12": "No campo de observações da coleta, descreva como e onde as conversas aconteceram.",
  "p13": "Atenção: nunca identifique quem falou. Descreva condições e processos de trabalho, e não pessoas.",
  "p14": "Agora a triagem ergonômica, em três blocos: física, cognitiva e organizacional. Responda Sim quando o risco foi identificado, Não quando foi avaliado e está ausente, e N A quando não se aplica.",
  "p15": "Ao marcar Sim, a observação faz toda a diferença: escreva o fato concreto. Aqui, cadeiras sem regulagem em quatro dos seis postos.",
  "p16": "Na ergonomia cognitiva avaliamos atenção, carga mental e pressão. Marcamos atenção contínua e pressão por metas, com o que foi observado.",
  "p17": "Salve sempre antes de trocar de tela.",
  "p18": "Próximo passo: o checklist de gestão. São vinte e seis itens, respondidos uma vez por AEP, com o gestor ou o RH. Primeiro, informe com quem foi respondido.",
  "p19": "Em cada item, escolha a resposta e a origem: documento, entrevista com gestor ou RH, ou observação. Item que não existe vira fonte geradora dos fatores ligados a ele.",
  "p20": "Quando o item existe e foi evidenciado, ele vira medida de controle existente. No campo de evidência, anote o documento, a data ou o responsável.",
  "p21": "Existe, mas sem evidência, também conta como lacuna. É o caso da capacitação das lideranças. E não existe, como o código de conduta.",
  "p22": "Esta é a parte principal: a Ergonomia Organizacional, com treze fatores psicossociais. Cada fator traz um roteiro de campo, com perguntas indiretas e o que observar.",
  "p23": "Marcou Sim? Informe de onde veio a evidência e escreva o fato observado, sem nomes. Quanto mais origens, maior a confiança.",
  "p24": "Agora marque só os sinais que você realmente viu ou ouviu. Cada sinal sobe um nível de probabilidade na matriz aiá.",
  "p25": "Três sinais indicam exposição elevada. Como assédio parte de severidade irreversível, o resultado é Alto.",
  "p26": "Logo abaixo fica o inventário de risco. Cada tópico é uma lista: escolha várias opções da biblioteca ou digite uma nova.",
  "p27": "Repare: as lacunas do checklist de gestão já aparecem nas fontes geradoras, com a etiqueta gestão. Vamos somar uma fonte codificada da biblioteca.",
  "p28": "Não achou na lista? Digite e tecle Enter. O texto vira um item manual, no mesmo campo.",
  "p29": "Em medidas recomendadas, marque o que a empresa ainda precisa implantar. Aqui, capacitação das lideranças.",
  "p30": "O campo de evidências é só leitura: ele mostra, em vermelho, os sinais marcados acima, que contam na matriz.",
  "p31": "Agora a sobrecarga. Marcamos Sim, a origem relato em grupo e dois sinais: equipe reduzida e metas difíceis. Com severidade severa, o resultado é Moderado.",
  "p32": "Não foi possível verificar um fator? Use N I e informe o motivo. Aqui, receio dos trabalhadores em se manifestar. O sistema não salva N I sem motivo.",
  "p33": "O sistema calcula sozinho: um fator Alto, ou dois Moderados, e o setor passa a necessitar de AET.",
  "p34": "O botão Gerar IA escreve o rascunho do parecer técnico e das recomendações. O técnico sempre revisa e assume o texto.",
  "p35": "Em Dados e Conclusão, confira empresa, responsável, título, registro e data de elaboração. Informe a validade do documento: ela gera alerta de vencimento.",
  "p36": "Considerações finais é um texto livre. Se ficar em branco, o sistema escreve a conclusão automática, com o escopo, a indicação de AET e os encaminhamentos.",
  "p37": "Concluído significa enviado ao cliente. A data de conclusão é gravada automaticamente. Depois, clique em Salvar alterações.",
  "p38": "Com a AEP concluída, a faixa fica verde. Clique em Liberar para o Comercial.",
  "p39": "O sistema pede confirmação. Confira o preenchimento antes de liberar.",
  "p40": "O laudo é montado com tudo o que foi preenchido. Daqui você baixa o PDF e o inventário em Excel para o SGG.",
  "p41": "E no módulo Comercial, a AEP liberada indica a AET e o questionário psicossocial para a empresa. Fim da demonstração."
}
```

### `narr-inv.json` (módulo do inventário, tópico a tópico)

```json
{
  "i01": "Neste módulo, vamos ver o inventário de risco em detalhe. Ele aparece em cada fator organizacional marcado como Sim, logo abaixo da matriz aiá.",
  "i02": "O inventário segue as mesmas colunas do inventário psicossocial que vai para o laudo, para o PDF, para a planilha do SGG e para a inteligência artificial. O que você escolher aqui sai igual em todos eles.",
  "i03": "Perigo. É o fator de risco avaliado. Ele já vem preenchido pela biblioteca, com o nome do fator. Se precisar detalhar, digite um texto novo, por exemplo: assédio moral pela supervisão.",
  "i04": "Fontes geradoras. São as situações do trabalho que produzem o perigo. As lacunas do checklist de gestão entram sozinhas, com a etiqueta gestão. Você completa com as fontes codificadas da biblioteca e, se faltar alguma, digita uma nova.",
  "i05": "Veja: ao clicar no campo, abre a lista da biblioteca com o código de cada fonte. Dá para marcar várias, e digitar filtra a lista.",
  "i06": "Evidências. Este campo é só leitura. Ele mostra, em vermelho, os sinais observados que você marcou acima. São esses sinais que contam na matriz aiá. Para mudar, volte aos sinais.",
  "i07": "Meio de propagação. É o caminho pelo qual o fator chega ao trabalhador, como a organização do trabalho ou as relações interpessoais. Cada fator já traz um padrão, e você pode trocar.",
  "i08": "Situação. Indica se a exposição acontece em condição normal ou também em emergência.",
  "i09": "Tempo de exposição. Informe se é habitual e permanente, intermitente ou eventual, de acordo com o que você viu na rotina do setor.",
  "i10": "Medidas de controle existentes. Registre só o que a empresa já tem e que foi constatado. Os itens evidenciados no checklist de gestão aparecem sozinhos aqui.",
  "i11": "Medidas de controle recomendadas. É o que ainda falta implantar. Essas medidas entram no laudo e também orientam as recomendações da inteligência artificial.",
  "i12": "Descrição do risco e danos à saúde. São textos técnicos que vêm da biblioteca. Mantenha, ajuste ou complete conforme a realidade do setor.",
  "i13": "Probabilidade vezes severidade, e confiança, são apenas leitura. O nível vem da matriz aiá, e a confiança vem da origem da evidência.",
  "i14": "Sugestões iniciais e ações. São a base do plano de ação. A inteligência artificial só recomenda ações que estejam marcadas aqui, além de AET, questionário psicossocial e revisão.",
  "i15": "Item digitado à mão aparece com a etiqueta manual. O administrador pode salvar na biblioteca, e o técnico pode sugerir. Assim, a biblioteca cresce com a experiência de campo.",
  "i16": "Use o botão Recolher para fechar o inventário quando terminar. E lembre: tudo o que estiver aqui vai para o laudo, para a planilha do SGG e para a inteligência artificial. Fim do módulo."
}
```

## Passo 5: gerar as falas

```bash
FF=$FF PYTHONPATH="$T/pytts" NARR=narr3 python tts.py      # gera narr/pNN.mp3 e narr3-dur.json
FF=$FF PYTHONPATH="$T/pytts" NARR=narr-inv python tts.py   # gera narr/iNN.mp3 e narr-inv-dur.json
```

### `tts.py`

```python
import asyncio, json, os, re, subprocess, sys
import edge_tts

VOZ = os.environ.get('VOZ', 'pt-BR-FranciscaNeural')
AQUI = os.path.dirname(os.path.abspath(__file__))
FF = os.environ['FF']
OUT = os.path.join(AQUI, 'narr')
os.makedirs(OUT, exist_ok=True)
NARR = os.environ.get('NARR', 'narr')
textos = json.load(open(os.path.join(AQUI, NARR + '.json'), encoding='utf-8'))


def dur(path):
    r = subprocess.run([FF, '-hide_banner', '-i', path, '-f', 'null', '-'], capture_output=True, text=True)
    t = re.findall(r'time=(\d+):(\d+):([\d.]+)', r.stderr)
    h, m, s = t[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


async def main():
    duracoes = {}
    for k, t in textos.items():
        p = os.path.join(OUT, k + '.mp3')
        await edge_tts.Communicate(t, VOZ, rate='+0%').save(p)
        duracoes[k] = round(dur(p), 2)
        print(k, duracoes[k], flush=True)
    json.dump(duracoes, open(os.path.join(AQUI, NARR + '-dur.json'), 'w'), indent=1)

asyncio.run(main())
```

## Passo 6: gravar

```bash
MODE=final BASE_URL=... EMPRESA_BUSCA=... RESPONSAVEL="..." CHROME_PATH=... node rec3.js     # vídeo em ../aep-video, prints em ../aep-shots, linha3.json
AEP_ID=<AEP gravada> BASE_URL=... CHROME_PATH=... node rec-inv.js                              # módulo do inventário (não salva nada)
```

- Depois de gravar, confira que nenhuma fala invade a seguinte: para cada fala, `t + duração` tem de
  ser menor que o `t` da próxima.
- Confira 3 ou 4 prints (`Read` nas imagens) antes de montar.

**Armadilhas que já aconteceram e estão resolvidas no script:**

| O que aconteceu | Como o script resolve |
|---|---|
| Título profissional virou "TITécnico…" (o campo já vinha preenchido) | limpa o campo com `fill('')` antes de digitar |
| A janela "Liberar para o Comercial?" travou o script | clica no botão "Liberar" do modal, localizado por texto (não por papel) |
| O ensaio perdia o setor ao trocar de tela | em `debug`, o checklist de gestão é pulado (só testa com `GESTAO=1`) |
| A rolagem não acompanhava o elemento | usa `window.scrollTo` (a página rola no documento, não num contêiner) |

### `rec3.js` (preenchimento completo, narrado)

```js
// Grava o preenchimento de uma AEP de demonstração (empresa Teste).
// MODE=debug: usa uma AEP existente (AEP_ID) e não salva nada.
// MODE=final: cria a AEP, salva tudo, gera IA, conclui e libera.
const { chromium } = require('playwright-core');
const path = require('path');

const MODE = process.env.MODE || 'debug';
const FINAL = MODE === 'final';
const ATE = process.env.ATE || 'tudo';
const BASE = process.env.BASE_URL; // ex.: https://<painel>.vercel.app
const DIR = path.resolve(__dirname, '..');
const SHOTS = path.join(DIR, FINAL ? 'aep-shots' : 'aep-shots-debug');
const VIDEO = path.join(DIR, FINAL ? 'aep-video' : 'aep-video-debug');
const VW = 1600, VH = 900;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await browser.newContext({
    storageState: path.join(__dirname, 'state.json'),
    viewport: { width: VW, height: VH },
    locale: 'pt-BR',
    recordVideo: { dir: VIDEO, size: { width: VW, height: VH } },
  });
  await ctx.addInitScript(() => {
    const mk = () => {
      if (document.getElementById('__cur')) return;
      const d = document.createElement('div');
      d.id = '__cur';
      d.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,.5);border:2px solid #b91c1c;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);transition:left .3s,top .3s,width .15s,height .15s';
      document.body.appendChild(d);
      document.addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
      document.addEventListener('mousedown', () => { d.style.width = '40px'; d.style.height = '40px'; setTimeout(() => { d.style.width = '22px'; d.style.height = '22px'; }, 260); }, true);
      const c = document.createElement('div');
      c.id = '__cap';
      c.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:80%;background:rgba(18,55,42,.95);color:#F5F7F2;font:600 22px/1.35 Arial,sans-serif;padding:14px 24px;border-radius:12px;border-left:6px solid #F0B866;box-shadow:0 6px 24px rgba(0,0,0,.25);pointer-events:none;z-index:2147483646;display:none;text-align:left';
      document.body.appendChild(c);
      const saved = sessionStorage.getItem('__capText');
      if (saved) { c.textContent = saved; c.style.display = 'block'; }
      window.__cap = (t) => { sessionStorage.setItem('__capText', t || ''); c.textContent = t || ''; c.style.display = t ? 'block' : 'none'; };
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
  });
  const fs = require('fs');
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const w = (ms) => p.waitForTimeout(ms);
  const DUR = JSON.parse(fs.readFileSync(path.join(__dirname, 'narr3-dur.json'), 'utf8'));
  const T0 = Date.now();
  const LINHA = [];
  let nCap = 0;
  const cap = async (t, ms = 2800) => {
    await p.evaluate((t) => window.__cap && window.__cap(t), t);
    if (!t) { await w(ms); return; }
    const id = 'p' + String(++nCap).padStart(2, '0');
    LINHA.push({ id, t: (Date.now() - T0) / 1000 });
    await w(Math.max(ms, Math.round((DUR[id] || 0) * 1000) + 700));
  };
  const shot = async (n) => {
    await p.evaluate(() => { const c = document.getElementById('__cap'); const d = document.getElementById('__cur'); if (c) { c.dataset.v = c.style.display; c.style.display = 'none'; } if (d) d.style.visibility = 'hidden'; });
    await p.screenshot({ path: path.join(SHOTS, n + '.png') });
    await p.evaluate(() => { const c = document.getElementById('__cap'); const d = document.getElementById('__cur'); if (c) c.style.display = c.dataset.v || 'none'; if (d) d.style.visibility = 'visible'; });
  };
  const focus = async (loc, off = 90) => { await loc.evaluate((e, off) => { const y = e.getBoundingClientRect().top + window.scrollY - off; window.scrollTo({ top: y, behavior: 'smooth' }); }, off); await w(1200); };
  const typeIn = async (loc, txt, d = 35) => { await loc.scrollIntoViewIfNeeded(); await loc.click(); await loc.pressSequentially(txt, { delay: d }); await w(250); };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const head = (label) => p.locator('span', { hasText: new RegExp('^' + esc(label) + '$') }).first().locator('xpath=..');
  const card = (label) => head(label).locator('xpath=..');
  const resp = async (label, v, d = 220) => { const r = head(label); await r.scrollIntoViewIfNeeded(); await r.getByRole('button', { name: v, exact: true }).click(); await w(d); };
  const salvarSetores = async () => {
    if (!FINAL) return;
    await p.locator('main').getByRole('button', { name: 'Salvar', exact: true }).first().click();
    await w(2500);
  };
  const menu = async (nome) => { await p.locator('aside, nav').getByRole('link', { name: nome, exact: true }).first().click(); await w(2500); };

  let url;
  // ── 1. Nova análise ─────────────────────────────────────────────
  if (FINAL && !process.env.START) {
    await p.goto(BASE + '/aep/novo');
    await p.getByRole('heading', { name: 'Nova Análise AEP' }).waitFor();
    await w(800);
    await cap('1. Nova Análise: escolha a empresa e o responsável pela elaboração.');
    await p.getByRole('button', { name: 'Selecione a empresa...' }).click();
    await w(500);
    await p.getByPlaceholder('Buscar por nome, CNPJ ou grupo...').pressSequentially(process.env.EMPRESA_BUSCA, { delay: 110 });
    await w(700);
    await p.locator('button').filter({ hasText: new RegExp('^' + process.env.EMPRESA_BUSCA) }).first().click();
    await w(800);
    await cap('Responsável, título e registro profissional (saem no laudo)');
    await p.locator('select').first().selectOption({ label: process.env.RESPONSAVEL });
    await w(500);
    await p.getByPlaceholder('Ex: Eng. de Segurança').fill('');
    await typeIn(p.getByPlaceholder('Ex: Eng. de Segurança'), 'Técnico de Segurança do Trabalho', 30);
    await focus(p.getByText('Registrar em inspeção', { exact: true }), 160);
    await cap('Registrar em inspeção: use a inspeção da visita, crie uma nova ou siga sem inspeção. Aqui: sem inspeção.', 3800);
    await p.getByText('Sem inspeção', { exact: true }).click();
    await w(1200);
    await shot('01-nova-analise');
    await p.getByRole('button', { name: 'Criar e continuar' }).click();
    await p.waitForURL(/\/aep\/[0-9a-f-]+\/setores/, { timeout: 30000 });
  } else {
    await p.goto(BASE + '/aep/' + process.env.AEP_ID + '/setores');
  }
  await w(2500);
  url = p.url();
  console.log('AEP', url);
  if (!process.env.START) {
  await cap('A faixa do topo mostra a situação da AEP. Sem inspeção, ela entra na Sinalização quando for Concluída.', 3800);
  await shot('02-editor-vazio');
  }
  const START = process.env.START;
  if (!START) {

  // ── 2. Setor ────────────────────────────────────────────────────
  await cap('2. Cada setor é avaliado separado. Clique em Adicionar setor.', 2400);
  await p.locator('main').getByRole('button', { name: 'Adicionar setor' }).last().click();
  await w(1300);
  await cap('Nome do setor e GHE (Grupo Homogêneo de Exposição)');
  await typeIn(p.getByPlaceholder('Nome do setor'), 'Atendimento ao Cliente');
  await typeIn(p.getByPlaceholder('Grupo Homogêneo de Exposição'), 'GHE-03');
  await cap('Jornada real e quantidade de expostos');
  await typeIn(p.getByPlaceholder('Ex: 8h/dia, 44h/semana'), '8h/dia, 44h/semana');
  const qtd = p.locator('label:has-text("Qtd. expostos") + input');
  await qtd.click(); await qtd.fill(''); await qtd.pressSequentially('12', { delay: 90 });
  await w(400);
  await cap('Cargos do setor: cargo, o que a pessoa faz e quantos são.', 2200);
  await p.getByRole('button', { name: 'Cargo', exact: true }).click();
  await w(600);
  await typeIn(p.getByPlaceholder('Cargo', { exact: true }), 'Atendente');
  await typeIn(p.getByPlaceholder('Descrição da atividade do cargo'), 'Atendimento presencial e por telefone, registro de reclamações e cobranças', 18);
  const q = p.getByPlaceholder('Qtd', { exact: true }); await q.click(); await q.fill('12');
  await w(700);
  await focus(p.getByText('Identificação', { exact: true }), 110);
  await shot('03-identificacao');

  // ── 3. Coleta ───────────────────────────────────────────────────
  await focus(p.getByText('Participação dos trabalhadores — NR-1'), 60);
  await cap('3. Participação NR-01: registre como ouviu os trabalhadores. Pode marcar mais de um método.', 3000);
  await p.getByRole('button', { name: 'Selecione…' }).click();
  await w(600);
  await p.getByLabel('Observação direta').check(); await w(450);
  await p.getByLabel('Entrevista com trabalhadores').check(); await w(450);
  await p.getByLabel('Entrevista com gestores').check(); await w(800);
  await shot('04-metodo-coleta');
  await p.getByText('Condições da coleta', { exact: true }).click();
  await w(400);
  const num = async (label, v) => { const i = p.locator(`label:has-text("${label}") + input`); await i.click(); await i.pressSequentially(v, { delay: 90 }); await w(300); };
  await cap('Condições da coleta: quantos foram abordados, quantos participaram e quantas recusas.', 2600);
  await num('Trabalhadores abordados', '8');
  await num('Participaram', '6');
  await num('Recusas', '1');
  await cap('Viu sinal de inibição (ex.: silêncio quando a liderança chega)? Marque. O sistema avisa e indica instrumento anônimo.', 3600);
  await p.getByLabel('Silêncio ou mudança de comportamento com a aproximação da liderança').check();
  await w(800);
  await cap('Observações da coleta: como e onde as conversas aconteceram');
  const obs = p.getByPlaceholder('Observações sobre a coleta (sem identificar trabalhadores)');
  await obs.click();
  await obs.pressSequentially('Conversas no balcão e na copa, em grupos pequenos, longe da supervisão.', { delay: 22 });
  await w(600);
  await focus(p.getByText('Participação dos trabalhadores — NR-1'), 60);
  await cap('Nunca identifique quem falou. Descreva condições e processos, não pessoas.', 3000);
  await shot('05-coleta');
  if (ATE === 'coleta') return fim();

  // ── 4. Física e Cognitiva ───────────────────────────────────────
  await focus(p.getByText('Ergonomia Física', { exact: true }), 90);
  await cap('4. Triagem: responda cada item. Sim = risco identificado; Não = avaliado e ausente; N/A = não se aplica.', 3800);
  await resp('Mobiliário inadequado', 'Sim', 500);
  await cap('Marcou Sim? Escreva o fato concreto na observação');
  const obsMob = card('Mobiliário inadequado').getByPlaceholder('Observação de campo...');
  await obsMob.click(); await obsMob.pressSequentially('Cadeiras sem regulagem de altura em 4 dos 6 postos do balcão.', { delay: 22 });
  await w(700);
  await focus(p.getByText('Ergonomia Física', { exact: true }), 90);
  await shot('06-ergonomia-fisica');
  await focus(p.getByText('Ergonomia Cognitiva', { exact: true }), 90);
  await cap('Ao marcar Sim, registre na observação o que viu em campo.', 2400);
  await resp('Atenção contínua / concentração elevada', 'Sim', 500);
  await resp('Pressão psicológica / cobrança excessiva', 'Sim', 500);
  const obsPre = card('Pressão psicológica / cobrança excessiva').getByPlaceholder('Observação de campo...');
  await obsPre.click(); await obsPre.pressSequentially('Metas diárias de atendimento afixadas no quadro, com ranking por atendente.', { delay: 22 });
  await w(700);
  await focus(p.getByText('Ergonomia Cognitiva', { exact: true }), 90);
  await shot('07-ergonomia-cognitiva');
  await cap('Salve sempre antes de trocar de tela.', 2000);
  await salvarSetores();
  if (ATE === 'cognitiva') return fim();

  // ── 5. Checklist de gestão ──────────────────────────────────────
  // (em debug nada é salvo: sair da tela perderia o setor; GESTAO=1 testa só ela)
  if (FINAL || process.env.GESTAO) {
  await menu('Checklist de gestão');
  await cap('5. Checklist de gestão: 26 itens, uma vez por AEP, respondido com gestor ou RH.', 3200);
  await typeIn(p.getByPlaceholder('Ex.: Supervisora de RH e gerente de produção'), 'Gerente da loja e analista de RH', 30);
  const item = (cod) => p.locator('div.rounded-xl').filter({ has: p.locator('span', { hasText: new RegExp('^' + cod + '$') }) }).first();
  const gresp = async (cod, curto, origem, evid) => {
    const it = item(cod);
    await it.scrollIntoViewIfNeeded();
    await it.getByRole('button', { name: curto, exact: true }).click();
    await w(500);
    if (origem) { await it.locator('select').selectOption({ label: origem }); await w(300); }
    if (evid) { await typeIn(it.getByPlaceholder('Evidência: nome do documento, data, responsável…'), evid, 22); }
  };
  await cap('"Não existe" ou "sem evidência" vira FONTE GERADORA dos fatores ligados ao item.', 3200);
  await gresp('G01', 'Não existe', 'Entrevista com gestor/RH');
  await cap('"Existe e foi evidenciado" vira MEDIDA DE CONTROLE EXISTENTE. Anote a evidência.', 3200);
  await gresp('G02', 'Evidenciado', 'Documento', 'Procedimento do canal de denúncia, rev. 03/2026');
  await cap('"Sem evidência" também é lacuna');
  await gresp('G04', 'Sem evidência', 'Entrevista com gestor/RH');
  await gresp('G05', 'Não existe', 'Entrevista com gestor/RH');
  await focus(p.getByText('G01', { exact: true }), 140);
  await shot('08-checklist-gestao');
  if (FINAL) { await p.getByRole('button', { name: 'Salvar', exact: true }).first().click(); await w(2500); }
  if (process.env.GESTAO) return fim();
  await menu('Setores / Triagem');
  await w(1500);
  }

  // ── 6. Organizacional: Assédio ──────────────────────────────────
  const A = 'Assédio de qualquer natureza no trabalho';
  await focus(p.getByText('Ergonomia Organizacional', { exact: true }), 90);
  await cap('6. Ergonomia Organizacional: 13 fatores psicossociais. Cada um tem roteiro de campo com perguntas indiretas.', 3800);
  await shot('09-organizacional-roteiro');
  await focus(head(A), 90);
  await resp(A, 'Sim', 1200);
  await cap('Marcou Sim: diga de onde veio a evidência. Mais origens = mais confiança.', 3000);
  const cA = card(A);
  await cA.getByRole('button', { name: 'Observação direta', exact: true }).click(); await w(600);
  await cA.getByRole('button', { name: 'Relato em grupo', exact: true }).click(); await w(900);
  const oA = cA.getByPlaceholder('Observação de campo...');
  await oA.click();
  await oA.pressSequentially('Supervisor cobra metas em voz alta no balcão, na frente de clientes. Equipe fica em silêncio quando ele se aproxima.', { delay: 18 });
  await w(800);
  await focus(head(A), 90);
  await shot('10-assedio-origem');
  const sinal1 = cA.getByLabel('Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras', { exact: true });
  await focus(sinal1, 220);
  await cap('Marque só os sinais que viu. Cada sinal sobe um nível de probabilidade na matriz AIHA.', 3200);
  for (const s of ['Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras', 'Cobranças em público', 'Ambiente de tensão ou silêncio excessivo']) {
    await cA.getByLabel(s, { exact: true }).check();
    await w(1200);
  }
  await cap('3 sinais = exposição elevada. Assédio parte de severidade Irreversível: resultado ALTO.', 3600);
  await shot('11-assedio-sinais-matriz');
  if (ATE === 'sinais') return fim();

  // ── 7. Inventário ───────────────────────────────────────────────
  const inv = cA.getByText('Inventário de risco', { exact: true }).first();
  await focus(inv, 40);
  await cap('7. Inventário de risco: cada tópico é uma lista. Escolha várias opções da biblioteca ou digite uma nova.', 3600);
  await shot('12-inventario');
  const linha = (rot) => cA.locator('tr').filter({ has: p.locator('th', { hasText: new RegExp('^' + esc(rot) + '$') }) }).first();
  const fontes = linha('Fontes geradoras');
  await focus(fontes, 160);
  await cap('As lacunas do checklist de gestão já aparecem sozinhas, com a etiqueta "gestão".', 3200);
  await fontes.locator('input').click();
  await w(1200);
  await shot('13-inventario-lista-aberta');
  await fontes.getByRole('button').filter({ hasText: /^1\.4/ }).first().click();
  await w(900);
  await cap('Não achou na lista? Digite e tecle Enter: vira um item "manual" no mesmo campo.', 3000);
  await fontes.locator('input').pressSequentially('Ranking diário de atendimento exposto no quadro', { delay: 30 });
  await w(700);
  await p.keyboard.press('Enter');
  await w(900);
  await p.keyboard.press('Escape');
  await w(600);
  const rec = linha('Medidas de controle recomendadas');
  await focus(rec, 160);
  await cap('Medidas recomendadas: o que a empresa ainda precisa implantar.', 2600);
  await rec.locator('input').click();
  await w(900);
  await rec.getByRole('button').filter({ hasText: /Capacita/ }).first().click();
  await w(700);
  await p.keyboard.press('Escape');
  await w(500);
  await focus(fontes, 120);
  await cap('Evidências é só leitura: mostra os sinais marcados acima (em vermelho, contam na matriz).', 3200);
  await shot('14-inventario-preenchido');

  // ── 8. Sobrecarga e N/I ────────────────────────────────────────
  const SB = 'Excesso de demandas no trabalho (Sobrecarga)';
  await focus(head(SB), 90);
  await cap('Sobrecarga: Sim, relato em grupo e 2 sinais = MODERADO');
  await resp(SB, 'Sim', 1000);
  const cS = card(SB);
  await cS.getByRole('button', { name: 'Relato em grupo', exact: true }).click(); await w(500);
  for (const s of ['Equipe reduzida para o volume de trabalho', 'Metas percebidas como difíceis de atingir']) {
    await cS.getByLabel(s, { exact: true }).scrollIntoViewIfNeeded();
    await cS.getByLabel(s, { exact: true }).check();
    await w(900);
  }
  await focus(cS.getByText('Sinais observados', { exact: false }).first(), 120);
  await shot('15-sobrecarga');
  const MR = 'Maus relacionamentos no local de trabalho';
  await focus(head(MR), 90);
  await cap('Não deu para verificar? Use N/I e diga o motivo. O Salvar não aceita N/I sem motivo.', 3400);
  await resp(MR, 'N/I', 900);
  await card(MR).locator('select').first().selectOption({ label: 'Receio dos trabalhadores em se manifestar' });
  await w(1200);
  await focus(head(MR), 90);
  await shot('16-ni-motivo');
  if (ATE === 'ni') return fim();

  // ── 9. AET e parecer ────────────────────────────────────────────
  await salvarSetores();
  const aviso = p.getByText('Este setor requer elaboração de AET completa').first();
  await focus(aviso, 200);
  await cap('8. O sistema calcula sozinho: 1 fator Alto (ou 2 Moderados) = setor NECESSITA AET.', 3800);
  await shot('17-necessita-aet');
  if (FINAL) {
    await cap('Gerar IA escreve o rascunho do Parecer e das Recomendações. O técnico revisa e assume o texto.', 3200);
    const g = p.getByRole('button', { name: 'Gerar IA' });
    await g.first().click();
    await p.getByText('Gerando...').first().waitFor({ state: 'detached', timeout: 90000 }).catch(() => {});
    await w(2500);
    await g.nth(1).click();
    await p.getByText('Gerando...').first().waitFor({ state: 'detached', timeout: 90000 }).catch(() => {});
    await w(2500);
    await focus(aviso, 120);
    await shot('18-parecer-ia');
    await salvarSetores();
  }

  // ── 10. Dados / Conclusão ──────────────────────────────────────
  await menu('Dados / Conclusão');
  await cap('9. Dados / Conclusão: confira responsável e datas, e informe a validade do documento.', 3200);
  const val = p.locator('label:has-text("Validade do documento") + input');
  await val.scrollIntoViewIfNeeded();
  await val.fill('2027-10-07');
  await w(800);
  const cf = p.getByText('Considerações finais', { exact: true }).first();
  await focus(cf, 200);
  await cap('Considerações finais: em branco, o sistema gera a conclusão automática');
  await focus(p.getByText('Status', { exact: true }).first(), 120);
  await cap('Concluído = enviado ao cliente. A data de conclusão é gravada sozinha.', 3000);
  await p.getByRole('button', { name: 'Concluído', exact: true }).click();
  await w(1200);
  await focus(p.getByText('Status', { exact: true }).first(), 120);
  await shot('19-dados-conclusao');
  if (FINAL) { await p.getByRole('button', { name: /Salvar alterações/ }).click(); await w(3000); }

  }
  // ── 11. Liberar para o Comercial ───────────────────────────────
  await menu('Setores / Triagem');
  await w(1500);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await w(800);
  await cap('10. Concluída: a faixa fica verde. Clique em Liberar para o Comercial.', 3200);
  await shot('20-faixa-concluida');
  if (FINAL) {
    await p.getByRole('button', { name: /Liberar para o Comercial/ }).first().click();
    await w(1500);
    await cap('O sistema pede confirmação: confira o preenchimento antes de liberar.', 2800);
    await shot('21-confirmar-liberacao');
    await p.locator('button').filter({ hasText: /^s*Liberars*$/ }).last().click();
    await w(2500);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await w(800);
    await shot('21-liberada');
  }

  // ── 12. Laudo ──────────────────────────────────────────────────
  await menu('Laudo / Imprimir');
  await w(3000);
  await cap('11. Laudo: montado com o que foi preenchido. Baixe o PDF e o inventário (Excel) para o SGG.', 3600);
  await shot('22-laudo-topo');
  const tri = p.getByText('Triagem Ergonômica por Setor').first();
  if (await tri.count()) { await focus(tri, 60); await w(800); await shot('23-laudo-triagem'); }
  const ind = p.getByText('Indicadores de Necessidade de AET').first();
  if (await ind.count()) { await focus(ind, 60); await w(800); await shot('24-laudo-aet'); }

  // ── 13. Comercial ──────────────────────────────────────────────
  if (FINAL) {
    await p.goto(BASE + '/comercial');
    await w(4000);
    await p.getByPlaceholder(/Buscar empresa/).pressSequentially(process.env.EMPRESA_BUSCA, { delay: 90 });
    await w(2500);
    await cap('12. No Comercial, a AEP liberada indica AET e DRPS/Questionário para a empresa.', 3600);
    await shot('25-comercial');
  }
  await cap('', 500);
  return fim();

  async function fim() {
    await w(1500);
    const v = p.video();
    await ctx.close();
    await browser.close();
    console.log('VIDEO', v ? await v.path() : null);
    fs.writeFileSync(path.join(__dirname, 'linha3.json'), JSON.stringify({ total: (Date.now() - T0) / 1000, linha: LINHA }, null, 1));
  }
})().catch(async (e) => { console.error('ERRO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
```

### `rec-inv.js` (inventário tópico a tópico; só navega e destaca)

```js
// Módulo "Inventário de risco": percorre o inventário do Assédio na AEP de
// exemplo, destacando tópico por tópico. Não salva nada.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const AEP = process.env.AEP_ID;
const BASE = process.env.BASE_URL; // ex.: https://<painel>.vercel.app
const DIR = path.resolve(__dirname, '..');
const SHOTS = path.join(DIR, 'inv-shots');
const VIDEO = path.join(DIR, 'inv-video');
const VW = 1600, VH = 900;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await browser.newContext({ storageState: path.join(__dirname, 'state.json'), viewport: { width: VW, height: VH }, locale: 'pt-BR', recordVideo: { dir: VIDEO, size: { width: VW, height: VH } } });
  await ctx.addInitScript(() => {
    const mk = () => {
      if (document.getElementById('__cur')) return;
      const d = document.createElement('div'); d.id = '__cur';
      d.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,.5);border:2px solid #b91c1c;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);transition:left .3s,top .3s';
      document.body.appendChild(d);
      document.addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
      const c = document.createElement('div'); c.id = '__cap';
      c.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:80%;background:rgba(18,55,42,.95);color:#F5F7F2;font:600 22px/1.35 Arial,sans-serif;padding:14px 24px;border-radius:12px;border-left:6px solid #F0B866;box-shadow:0 6px 24px rgba(0,0,0,.25);pointer-events:none;z-index:2147483646;display:none';
      document.body.appendChild(c);
      window.__cap = (t) => { c.textContent = t || ''; c.style.display = t ? 'block' : 'none'; };
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
  });
  fs.mkdirSync(SHOTS, { recursive: true });
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  const DUR = JSON.parse(fs.readFileSync(path.join(__dirname, 'narr-inv-dur.json'), 'utf8'));
  const T0 = Date.now();
  const LINHA = [];
  const w = (ms) => p.waitForTimeout(ms);
  const fala = async (id, t, extra = 600) => {
    await p.evaluate((t) => window.__cap && window.__cap(t), t);
    LINHA.push({ id, t: (Date.now() - T0) / 1000 });
    await w(Math.round((DUR[id] || 3) * 1000) + extra);
  };
  const shot = async (n) => {
    await p.evaluate(() => { const c = document.getElementById('__cap'); const d = document.getElementById('__cur'); c.dataset.v = c.style.display; c.style.display = 'none'; d.style.visibility = 'hidden'; });
    await p.screenshot({ path: path.join(SHOTS, n + '.png') });
    await p.evaluate(() => { const c = document.getElementById('__cap'); const d = document.getElementById('__cur'); c.style.display = c.dataset.v || 'none'; d.style.visibility = 'visible'; });
  };
  const focus = async (loc, off = 120) => { await loc.evaluate((e, off) => { const y = e.getBoundingClientRect().top + window.scrollY - off; window.scrollTo({ top: y, behavior: 'smooth' }); }, off); await w(1100); };
  const marca = async (loc) => {
    await p.evaluate(() => document.querySelectorAll('[data-destaque]').forEach((e) => { e.style.outline = ''; e.style.background = ''; e.removeAttribute('data-destaque'); }));
    if (loc) await loc.evaluate((e) => { e.setAttribute('data-destaque', '1'); e.style.outline = '4px solid #F0B866'; e.style.outlineOffset = '-2px'; e.style.background = 'rgba(240,184,102,.12)'; });
    await w(300);
  };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const head = (label) => p.locator('span', { hasText: new RegExp('^' + esc(label) + '$') }).first().locator('xpath=..');
  const cA = head('Assédio de qualquer natureza no trabalho').locator('xpath=..');
  const linha = (rot) => cA.locator('tr').filter({ has: p.locator('th', { hasText: new RegExp('^' + esc(rot) + '$') }) }).first();

  await p.goto(BASE + '/aep/' + AEP + '/setores');
  await w(3500);
  const inv = cA.getByText('Inventário de risco', { exact: true }).first();
  await focus(cA.getByText('Matriz de risco AIHA', { exact: false }).first(), 140);
  await fala('i01', 'Módulo: Inventário de risco do fator "Sim"');
  await focus(inv, 30);
  await marca(inv.locator('xpath=ancestor::div[contains(@class,"rounded-md")][1]'));
  await fala('i02', 'Mesmas colunas do inventário psicossocial: laudo, PDF, planilha do SGG e IA');
  await shot('i00-inventario');

  const passo = async (rot, id, txt, n, off = 160) => {
    const l = linha(rot);
    await focus(l, off);
    await marca(l);
    await l.locator('th').hover().catch(() => {});
    await fala(id, txt);
    await shot(n);
  };
  await passo('Perigo', 'i03', 'Perigo: o fator de risco avaliado', 'i01-perigo');
  await passo('Fontes geradoras', 'i04', 'Fontes geradoras: o que no trabalho produz o perigo', 'i02-fontes');
  const fin = linha('Fontes geradoras').locator('input');
  await fin.click();
  await w(800);
  await fala('i05', 'A lista da biblioteca abre com o código de cada fonte', 400);
  await shot('i03-fontes-lista');
  await p.keyboard.press('Escape');
  await w(500);
  await passo('Evidências (sinais)', 'i06', 'Evidências: só leitura, vêm dos sinais marcados', 'i04-evidencias');
  await passo('Meio de propagação', 'i07', 'Meio de propagação: como o fator chega ao trabalhador', 'i05-meio');
  await passo('Situação', 'i08', 'Situação: normal ou também emergência', 'i06-situacao');
  await passo('Tempo de exposição', 'i09', 'Tempo de exposição: habitual, intermitente ou eventual', 'i07-tempo');
  await passo('Medidas de controle existentes', 'i10', 'Medidas existentes: só o que foi constatado', 'i08-medidas-existentes');
  await passo('Medidas de controle recomendadas', 'i11', 'Medidas recomendadas: o que falta implantar', 'i09-medidas-recomendadas');
  await passo('Descrição do risco', 'i12', 'Descrição do risco e danos à saúde: textos técnicos da biblioteca', 'i10-descricao-danos');
  await passo('Probabilidade × Severidade', 'i13', 'Probabilidade × Severidade e Confiança: só leitura', 'i11-pxs-confianca', 240);
  await passo('Sugestões iniciais', 'i14', 'Sugestões e ações: base do plano de ação e da IA', 'i12-sugestoes-acoes', 200);
  const manual = linha('Fontes geradoras').locator('span', { hasText: /^manual$/ }).first().locator('xpath=..');
  await focus(linha('Fontes geradoras'), 200);
  await marca(manual);
  await manual.hover().catch(() => {});
  await fala('i15', 'Item manual: "salvar na biblioteca" (Admin) ou "sugerir" (técnico)');
  await shot('i13-item-manual');
  await marca(null);
  await focus(inv, 30);
  await p.getByRole('button', { name: /Recolher/ }).first().hover().catch(() => {});
  await fala('i16', 'Recolher fecha o inventário. Tudo aqui vai para laudo, planilha e IA', 300);
  await p.evaluate(() => window.__cap(''));
  await w(1500);
  const v = p.video();
  await ctx.close(); await browser.close();
  fs.writeFileSync(path.join(__dirname, 'linha-inv.json'), JSON.stringify({ total: (Date.now() - T0) / 1000, linha: LINHA }, null, 1));
  console.log('VIDEO', await v.path());
})().catch((e) => { console.error('ERRO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
```

## Passo 7: trilha de fundo original

```bash
PYTHONPATH="$T/pytts" python musica.py ../trilha.wav 960    # 16 min; sobra é cortada
```

- **Estilo:** 104 BPM, dó maior, progressão I–V–vi–IV, pad, arpejo, baixo pulsante e bateria leve.
- **Estrutura:** intro leve, depois partes cheias (A) e leves (B) alternadas.
- **Volume:** chimbal e palmas já estão baixos (fundo de narração).

```python
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
```

## Passo 8: montar módulos e o completo

```bash
FF=$FF python build.py ../trilha.wav      # sem argumento = só narração
```

- **Montagem:** narração encaixada pelos tempos de `linha3.json` e `linha-inv.json`, com
  `OFF = 0.55 s` (diferença entre o início do vídeo e o relógio do script).
- **Módulos:** cortes entre as falas que abrem cada módulo (tabela `MODULOS`) + vinheta com `drawtext`
  (fonte do Windows).
- **Música:**
  - medida e nivelada `ABAIXO = 10 LU` sob a narração de cada vídeo ("metade da intensidade percebida");
  - entrada de 2 s e saída de 3 s;
  - no vídeo completo, entra **uma vez** e corre contínua.
- **Demora:** a montagem passa de 10 minutos. Rode em segundo plano.

```python
"""Monta os vídeos narrados por módulo (e o completo).

Uso: FF=<ffmpeg> python build.py [musica.mp3]
Sem música: só narração. Com música: fundo em volume bem abaixo da narração.
"""
import glob, json, os, shutil, subprocess, sys

FF = os.environ['FF']
AQUI = os.path.dirname(os.path.abspath(__file__))
S = os.path.dirname(AQUI)
OUT = os.environ.get('OUT', os.path.join(S, 'modulos'))
MUSICA = sys.argv[1] if len(sys.argv) > 1 else None
ABAIXO = float(os.environ.get('ABAIXO', '10'))  # LU abaixo da narração (10 LU = metade da intensidade percebida)
OFF = 0.55
os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(S, 'tmp-build'); os.makedirs(TMP, exist_ok=True)
FONTE = 'C\\:/Windows/Fonts/arialbd.ttf'
FONTE2 = 'C\\:/Windows/Fonts/arial.ttf'


def run(args):
    r = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y'] + args, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-1500:])


def narrar(video, linha_json, pasta, saida):
    L = json.load(open(os.path.join(AQUI, linha_json)))['linha']
    a = ['-i', video]
    for x in L: a += ['-i', os.path.join(AQUI, pasta, x['id'] + '.mp3')]
    parts = [f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int((x['t']+OFF)*1000)}|{int((x['t']+OFF)*1000)}[a{i}]" for i, x in enumerate(L, 1)]
    mix = ''.join(f'[a{i}]' for i in range(1, len(L) + 1))
    fc = ';'.join(parts) + f";{mix}amix=inputs={len(L)}:normalize=0:dropout_transition=0,apad[aout]"
    run(a + ['-filter_complex', fc, '-map', '0:v', '-map', '[aout]', '-r', '25', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', '-shortest', saida])
    return L


def cortar(src, ini, fim, saida):
    a = ['-ss', f'{ini:.2f}'] + (['-to', f'{fim:.2f}'] if fim else []) + ['-i', src]
    run(a + ['-r', '25', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', saida])


def esc(t):
    return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", "’").replace('%', '\\%')


def vinheta(num, titulo, sub, saida):
    vf = (f"drawbox=x=0:y=0:w=24:h=900:color=0xF0B866:t=fill,"
          f"drawtext=fontfile='{FONTE}':text='{esc(num)}':fontcolor=0xF0B866:fontsize=34:x=140:y=300,"
          f"drawtext=fontfile='{FONTE}':text='{esc(titulo)}':fontcolor=0xF5F7F2:fontsize=76:x=140:y=360,"
          f"drawtext=fontfile='{FONTE2}':text='{esc(sub)}':fontcolor=0xC8DACF:fontsize=34:x=140:y=470,"
          f"drawtext=fontfile='{FONTE2}':text='Treinamento AEP · Painel SST JCN':fontcolor=0x8FB8A0:fontsize=26:x=140:y=800,"
          f"fade=t=in:st=0:d=0.4,fade=t=out:st=3.1:d=0.4")
    run(['-f', 'lavfi', '-i', 'color=c=0x12372A:s=1600x900:r=25:d=3.5', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '3.5',
         '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', saida])


def juntar(partes, saida):
    a = []
    for p in partes: a += ['-i', p]
    fc = ''.join(f'[{i}:v][{i}:a]' for i in range(len(partes))) + f'concat=n={len(partes)}:v=1:a=1[v][a]'
    run(a + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', saida])


def loudness(src):
    r = subprocess.run([FF, '-hide_banner', '-i', src, '-map', '0:a', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(r.split('I:')[-1].split('LUFS')[0])


def duracao(src):
    r = subprocess.run([FF, '-hide_banner', '-i', src], capture_output=True, text=True).stderr
    h, m, sg = r.split('Duration: ')[1].split(',')[0].split(':')
    return int(h) * 3600 + int(m) * 60 + float(sg)


def com_musica(src, saida):
    if not MUSICA:
        os.replace(src, saida); return
    d = duracao(src); alvo = loudness(src) - ABAIXO
    fc = (f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{d:.2f},loudnorm=I={alvo:.1f}:TP=-6:LRA=7,"
          f"afade=t=in:st=0:d=2,afade=t=out:st={max(0, d-3):.2f}:d=3[m];"
          f"[0:a][m]amix=inputs=2:normalize=0:duration=first[a]")
    run(['-i', src, '-i', MUSICA, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', saida])


MODULOS = [
    ('m1', 'Módulo 1', 'Criar a AEP', 'Empresa, responsável e vínculo com inspeção', None, 'p05'),
    ('m2', 'Módulo 2', 'Setor e coleta', 'Identificação, cargos e participação NR-01', 'p05', 'p14'),
    ('m3', 'Módulo 3', 'Ergonomia Física e Cognitiva', 'Sim, Não e N/A com observação de campo', 'p14', 'p18'),
    ('m4', 'Módulo 4', 'Checklist de gestão', '26 itens com gestor ou RH', 'p18', 'p22'),
    ('m5', 'Módulo 5', 'Ergonomia Organizacional', 'Roteiro, origem, sinais, matriz e N/I', 'p22', 'p33'),
    ('m6', 'Módulo 6', 'Inventário de risco', 'Cada tópico, do perigo às ações', 'INV', None),
    ('m7', 'Módulo 7', 'AET e parecer com IA', 'O que o sistema indica sozinho', 'p33', 'p35'),
    ('m8', 'Módulo 8', 'Conclusão e entrega', 'Dados, liberação, laudo e Comercial', 'p35', None),
]
ARQ = {
    'm1': 'Modulo-1-Criar-a-AEP', 'm2': 'Modulo-2-Setor-e-coleta', 'm3': 'Modulo-3-Fisica-e-Cognitiva',
    'm4': 'Modulo-4-Checklist-de-gestao', 'm5': 'Modulo-5-Ergonomia-Organizacional', 'm6': 'Modulo-6-Inventario-de-risco',
    'm7': 'Modulo-7-AET-e-parecer-IA', 'm8': 'Modulo-8-Conclusao-e-entrega',
}

principal = glob.glob(os.path.join(S, 'aep-video', '*.webm'))[0]
inventario = glob.glob(os.path.join(S, 'inv-video', '*.webm'))[0]
nm = os.path.join(TMP, 'principal.mp4'); ni = os.path.join(TMP, 'inventario.mp4')
L = narrar(principal, 'linha3.json', 'narr', nm)
# a narração do inventário mora em narr/ também (ids iNN)
narrar(inventario, 'linha-inv.json', 'narr', ni)
T = {x['id']: x['t'] + OFF for x in L}

semmusica = []
for mid, num, tit, sub, a, b in MODULOS:
    v = os.path.join(TMP, mid + '-vinheta.mp4'); vinheta(num, tit, sub, v)
    c = os.path.join(TMP, mid + '-corpo.mp4')
    if a == 'INV':
        cortar(ni, 0.3, None, c)
    else:
        ini = 0.3 if a is None else T[a] - 0.6
        fim = None if b is None else T[b] - 0.6
        cortar(nm, ini, fim, c)
    m = os.path.join(TMP, mid + '.mp4'); juntar([v, c], m)
    semmusica.append(m)
    final = os.path.join(OUT, ARQ[mid] + '.mp4')
    tmp = os.path.join(TMP, mid + '-copia.mp4'); shutil.copyfile(m, tmp)
    com_musica(tmp, final); print(final, flush=True)

completo = os.path.join(TMP, 'completo.mp4')
juntar(semmusica, completo)
com_musica(completo, os.path.join(OUT, 'Treinamento-AEP-completo.mp4'))
print('OK')
```

## Passo 9: slides (Artifact "Slides")

1. **Criar o deck:** `Artifact` → `quickstart` (intent `slides`) e depois `publish` com o `type_url` do
   tipo Slides, um `title` e `auto_open: after_first_write`.
2. **Escrever os arquivos:**
   - em `project/`: `deck.json` primeiro, com `order` completo, `sections` e `faces` (Rubik + Nunito Sans);
   - depois um arquivo `project/slides/<id>.html` por slide (uma `<section>` 1920×1080, estilos inline);
   - publique de 3 em 3.
3. **Assets** (`publish` com `asset: true`, até 25 por chamada):
   - prints em PNG;
   - vídeos MP4 de no máximo **20 MB**: refaça em 1280×720, `-crf 27`, áudio de 96–112k;
   - uma imagem de capa por vídeo;
   - use a url `/_blob/<id>` devolvida, sem mudar nada.
4. **Slide de vídeo:** `<img src="/_blob/<capa>" data-video="/_blob/<clip>" data-video-sound="on" data-video-start="click" …>`.
   O vídeo completo (~70 MB) não cabe no deck: ele fica só no arquivo, e o deck mostra uma videoteca.
5. **Estrutura que funcionou** (47 slides):
   1. O que é e o caminho em 6 etapas.
   2. Criar e vínculo.
   3. Setor e coleta.
   4. Três checklists.
   5. Checklist de gestão (antes da parte organizacional).
   6. **Seção da parte organizacional "na prática"**, o foco do treinamento:
      - princípio;
      - preparo da visita;
      - como conversar (tabela "Evite / Prefira");
      - roteiro dos 13 fatores em 3 tabelas;
      - origem e confiança;
      - qual resposta marcar;
      - como escrever a observação;
      - quando ninguém fala;
      - exemplo do campo ao resultado.
   7. Matriz e severidade.
   8. Inventário tópico a tópico (2 tabelas + print da lista).
   9. Biblioteca, AET, IA, Dados, laudo e entrega.
   10. Videoteca, glossário, 6 exercícios + gabarito, papéis, boas práticas.
   11. Um slide de vídeo logo depois de cada conteúdo correspondente.
6. **Conteúdo:**
   - fatos só do código e do guia do módulo (no painel: o equivalente a `docs/AEP-COMO-FUNCIONA.md`);
   - boas práticas de campo marcadas nas notas como "conferir padrão da empresa";
   - números e nomes que o usuário não deu ficam entre colchetes.
7. **Rodapés:** renumere por script quando inserir slides (`Treinamento … · N`).
8. **Compartilhamento:** o deck é privado. Avise o usuário que ele precisa compartilhar pelo menu
   **Compartilhar** para os técnicos abrirem.

## Passo 10: entregar

- Copie para `Downloads/Treinamento-<módulo>/`:
  - `modulos/*.mp4`;
  - `prints/`;
  - a trilha.
- Apague o `state.json`.
- Liste as AEPs de teste criadas e pergunte se pode mandar para a Lixeira.

## Checklist final

- [ ] Ensaio `debug` completo sem erro antes do `final`.
- [ ] Nenhuma fala sobreposta (`t + duração < próximo t`).
- [ ] Prints conferidos (sem faixa vazia, sem modal escondendo a tela).
- [ ] Música audível só como fundo: na vinheta (só música) cerca de −30 dB de média; narração cerca de −19 LUFS.
- [ ] Vídeos do deck com no máximo 20 MB; slides de vídeo com `data-video-sound="on"`.
- [ ] `state.json` apagado; nada novo no repositório do painel.
- [ ] AEPs de teste listadas para o usuário decidir.

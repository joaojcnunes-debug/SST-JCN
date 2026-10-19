---
name: treinamento
description: Cria o treinamento completo de um módulo do sistema (vídeo-aulas narradas em 1ª pessoa com a voz encaixada na tela, legenda e música de fundo, prints, slides com notas, glossário e exercícios), simulando o uso real no sistema. Use quando o usuário pedir "treinamento", "vídeo-aula", "curso" ou "capacitação" de um módulo ou processo (ex.: "/treinamento inspeção", "faça o treinamento do EPI", "versão Google Vids da inspeção").
---

# Treinamento por módulo

O usuário só faz o pedido, por exemplo `/treinamento inspeção`. Você entrega o pacote inteiro,
como foi feito para a AEP em 2026-10-07.

O "como fazer" do vídeo (gravar → roteiro → voz → montagem) está em **`docs/treinamento-pipeline.md`**,
com os scripts em `scripts/treinamento/` e o agente **`narrador-tts`** para a voz. Leia esse arquivo
antes da Fase 3. O `docs/replicar-no-painel-treinamento-video-slides.md` continua valendo para as
armadilhas de automação do sistema e para os slides (Passo 9).

> **Todo treinamento é gravado no Painel SST** (`https://painel-sst.chabra.com.br`), nunca no SST-JCN,
> mesmo que o módulo exista aqui. O código deste repositório serve só para entender o processo (Fase 1).

## O que entregar (sempre)

1. **Vídeo-aulas por etapa do processo** (5 a 9 módulos), em MP4 1600×900, com:
   - narração em 1ª pessoa no estilo do João (sempre a voz `pt-BR-FranciscaNeural`, ritmo `+0%`), com cada fala
     encaixada no que acontece na tela (o verbo cai no clique);
   - legenda da narração (queimada e em `.srt`) e cursor visível;
   - vinheta de abertura com título;
   - trilha de fundo original, cerca de 10 LU abaixo da narração.
2. **Vídeo completo:** todos os módulos em sequência, com a música contínua.
3. **Prints de cada etapa** (PNG, sem legenda nem cursor).
4. **Deck de slides** (Artifact do tipo Slides) com notas do apresentador:
   - conteúdo por etapa, com prints e um slide de vídeo depois de cada etapa;
   - uma seção "na prática", que explica como o técnico aplica o processo em campo;
   - glossário;
   - 6 exercícios + gabarito;
   - videoteca;
   - quem faz o quê;
   - boas práticas.
5. **Pasta no computador do usuário:** `Downloads/Treinamentos Painel SST/Treinamento-<Módulo>/` com
   `narrado/`, `prints/`, `_producao/` e a trilha (gravar no Painel SST, não no SST-JCN).
6. **Registro do roteiro:** `docs/treinamentos/<modulo>.md`, com as etapas, as falas e os links do deck.
   Ele permite refazer o treinamento quando o sistema mudar.
7. **Google Vids só se pedirem:** o caminho padrão é o vídeo narrado aqui. Se o pedido for
   "versão Google Vids", siga `docs/treinamento-google-vids.md` e `scripts/vids/`.

## Catálogo de módulos (onde procurar no código)

| Pedido do usuário | Grupo de rotas | Processo principal |
|---|---|---|
| inspeção, segurança, PGR | `app/(app)` | já feito: `docs/treinamentos/inspecao.md` (falas de `narr-insp.json`) |
| AEP | `app/(aep)` | já feito: `docs/treinamentos/aep.md` (ou as falas de `narr3.json` no doc técnico) |
| AET | `app/(aet)` | análise ergonômica completa |
| DRPS, psicossocial | `app/(psicossocial)` | diagnóstico de riscos psicossociais |
| QPS, questionários | `app/(questionarios-psicossociais)` | aplicação de questionário e respostas |
| sinalização | `app/(sinalizacao-psicossocial)` | painel de alertas |
| apreciação, NR-12, máquinas | `app/(apreciacao-maquinas)` | apreciação de risco de máquina |
| químicos | `app/(analise-quimicos)` | análise de produtos químicos |
| EPI | `app/(epi)` | fichas e entregas de EPI |
| equipamentos | `app/(equipamentos)` | inventário de equipamentos |
| conformidade / não conformidade | `app/(conformidade)`, `app/(nao-conformidade)` | relatórios por NR |
| investigação, acidente | `app/(investigacao-acidente)` | investigação de acidente |
| comercial | `app/(comercial)` | oportunidades e liberação |
| empresas, grupos | `app/(empresas)` | cadastro, grupos matriz/filial |
| dimensionamento, escala, frota, gestão | `app/(dimensionamento)`, `(escala)`, `(frota)`, `(gestao-gerencial)` | conforme o módulo |

Se o pedido for ambíguo, ou não estiver na tabela, pergunte qual módulo **com uma única pergunta**
(`AskUserQuestion`, opções desta tabela). Se o módulo for grande, como Inspeção, proponha o recorte
(o fluxo principal primeiro) e siga.

## Fase 0: combinar (uma única mensagem)

Antes de qualquer gravação, diga ao usuário, numa mensagem curta:
- o plano de módulos (Fase 2, em resumo);
- a **empresa de teste** que vai usar (procure no banco uma empresa chamada "Teste" ou similar);
- que a simulação **cria registros de demonstração** nessa empresa;
- que ele precisa **fazer o login** na janela do navegador automático (abra `<URL>/login` pelo
  Playwright MCP). Nunca peça a senha.

Só pare para esperar o login. O resto segue sem novas perguntas, salvo bloqueio real.

## Fase 1: entender o processo pelo código (sem inventar)

1. Leia, nesta ordem:
   - a seção do módulo em `docs/SISTEMA-COMPLETO.md`;
   - as páginas `app/(<grupo>)/**/page.tsx` do fluxo;
   - os componentes de formulário e os hooks;
   - as regras em `lib/<modulo>/`;
   - os testes do módulo.
   Delegue a varredura a um subagente (`Agent`) se o módulo for grande.
2. Escreva para você (no scratchpad) um **"como funciona"** com:
   - o fluxo do começo ao fim;
   - **cada campo**: o que é, se é obrigatório, como preencher, o que o sistema calcula sozinho;
   - os status e quem pode o quê (perfis);
   - para onde a informação vai (laudo/PDF, outros módulos);
   - as armadilhas (validações que travam o Salvar, modais de confirmação, campos que já vêm
     preenchidos).
3. Todo fato do treinamento sai daqui. Boa prática de campo que não vem do código entra **marcada**
   nas notas: "conferir padrão da empresa".

## Fase 2: roteiro

1. **Módulos:** divida o processo em 5 a 9 etapas de 0:40 a 3:00 cada. Uma etapa com muitos campos
   (como o inventário da AEP) vira um módulo próprio, gravado só navegando e destacando.
2. **Exemplo:** crie um caso realista e coerente do começo ao fim (setor, cargos, achados), que mostre
   as regras importantes: um item que dispara cálculo, uma validação, um caso de "não se aplica".
3. **Falas de rascunho** por passo, só para dimensionar a gravação (`g.passo(rotulo, {fala})`).
   As falas definitivas são escritas **depois** de gravar, no `roteiro-<tag>.json`, presas aos eventos
   (Etapa 2 do `docs/treinamento-pipeline.md`): 1ª pessoa, estilo do João, campo por campo, o que
   preencher e por quê.
4. **Pronúncia:** sigla escrita normal na fala; o que soar mal vai para o `pronuncia` do roteiro
   (AIHA → "aiá", N/I → "N I"). Mantenha o dicionário em `docs/treinamentos/<modulo>.md`.

## Fase 3: gravar (Etapa 1 do `docs/treinamento-pipeline.md`)

1. **Ferramentas:** `bash scripts/treinamento/instalar.sh` (fica em `C:/Users/Usuario/ferramentas`, fora do projeto).
2. **Script:** um `rec-<tag>.js` por módulo, a partir de `scripts/treinamento/rec-modelo.js` (usa o `gravador.js`).
   - Mantenha: `g.sync()` logo depois da primeira página, `g.passo()` por tela, `g.clicar()`/`g.digitar()`
     por ação, `g.print()`, `MODE=debug|final`.
   - Troque: as telas, os seletores (tirados do código: placeholder, label, texto do botão, papel)
     e os dados do exemplo. Armadilhas de cada sistema: doc técnico (`rec3.js`) e memórias.
3. **Ensaio:** sempre `MODE=debug` antes, sem salvar, usando um registro de rascunho. Corrija até
   rodar inteiro.
4. **Valendo:** `MODE=final` em segundo plano. Depois confira:
   - nenhuma fala sobreposta;
   - 3 ou 4 prints (`Read`).
5. **Módulos "tour":** etapas só de navegação viram um script como o `rec-inv.js`, que destaca cada
   área e não salva nada.

## Fase 4: roteiro, voz e montagem (Etapas 2 a 5 do `docs/treinamento-pipeline.md`)

- **Roteiro:** `planejar.py` em cada gravação → olhe as folhas → escreva as falas no `roteiro-<tag>.json`
  (âncora no verbo de cada ação).
- **Voz:** entregue os roteiros ao agente **`narrador-tts`** (`Agent`, `subagent_type: narrador-tts`), com a
  pasta de saída, a trilha e o nome do completo. Ele roda `narrar.py` até `STATUS: OK`, monta e confere.
- **Música:** `scripts/treinamento/musica.py` (trilha original; nunca baixe música de terceiros).
- **Confira** o retorno do agente e a folha `conferir-<tag>.png`; assista a um módulo inteiro.

## Fase 5: slides

- **Criação:** `Artifact` → `quickstart` (slides) → criar a partir do tipo Slides → `deck.json` →
  slides de 3 em 3 (Passo 9 do doc técnico).
- **Visual:** mesma identidade do deck da AEP (verde `#12372A`, âmbar `#F0B866`, Rubik + Nunito Sans).
- **Vídeos no deck:** em 720p, com no máximo 20 MB, usando `data-video-sound="on"`.
- **Vídeo completo:** fica fora do deck. O deck mostra a videoteca.

## Fase 6: entregar e limpar

1. Copie os arquivos para `Downloads/Treinamento-<Módulo>/`. Escreva `docs/treinamentos/<modulo>.md`.
   Faça commit e PR como no fluxo normal do repositório, se o usuário costuma fazer.
2. Apague o `state.json` e os scripts de dentro do projeto (`.playwright-mcp/`).
3. **Resposta final**, curta:
   - link do deck;
   - tabela de módulos e durações;
   - onde estão os arquivos;
   - o que conferir;
   - lista dos registros de demonstração criados, com a pergunta: "posso mandar para a Lixeira?".
     Nunca apague sem um sim.

## Regras de segurança

- Só a empresa de teste. Nunca dados de cliente real nos vídeos.
- Login feito pelo usuário. O `state.json` é segredo: só na pasta temporária, e apagado ao fim.
- Não altere configurações compartilhadas durante a demonstração: biblioteca, Texto Padrão, matrizes,
  usuários.
- Ferramentas só em pasta temporária. Nada de `package.json` ou dependência nova no projeto.
- A voz é gerada pelo serviço on-line da Microsoft: só o texto das falas sai da máquina.

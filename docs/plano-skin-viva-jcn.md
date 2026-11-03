# Plano — SST-JCN "vivo": azul total, dicas nos campos e skin nova

> Plano para executar no Claude Code (VS Code ou app). **Regra Zero:** uma etapa por vez.
> Em cada etapa: auditar → mostrar o plano da etapa → **esperar aprovação** → codar → validar → commit.
> Nunca começar a etapa seguinte sem o "ok" do João.

## Como rodar

Cole no Claude Code, uma etapa por vez (troque o número):

```
Leia docs/plano-skin-viva-jcn.md e execute a Etapa 0, seguindo as Regras do plano. Antes de codar, me mostre o plano da etapa e espere minha aprovação.
```

Para retomar depois de uma pausa:

```
Leia docs/plano-skin-viva-jcn.md, veja no "Andamento" qual foi a última etapa concluída e me proponha a próxima.
```

## Regras (valem para todas as etapas)

1. **Base = `origin/main`**, nunca a cópia local. A pasta `sst-jcn` local estava em v0.3.136 (branch `docs/treinamento-pipeline-tts`)
   com 15 arquivos alterados sem commit, incluindo `components/layout/SidebarShell.tsx`. **Não descartar nem commitar esse WIP.**
   Trabalhar em worktree/branch nova: `git fetch origin && git worktree add ../sst-jcn-skin -b feat/skin-viva origin/main`.
2. **SST-JCN apenas.** O `painel-sst` é só referência de leitura — nunca alterar.
3. **Bump de versão** no `package.json` em todo commit (sem bump o app desktop não atualiza).
4. **Push na `main` = deploy automático na Vercel.** Não rodar `vercel deploy` na mão. PR por etapa, merge só com aprovação.
5. **Impressão/PDF intocados:** tudo novo de tela leva `print:hidden` ou fica fora do CSS de print. Os templates em
   `components/pdf/templates/` só mudam na Etapa 0b, se aprovada.
6. **Movimento com respeito:** toda animação nova tem fallback em `@media (prefers-reduced-motion: reduce)`.
7. **Modo escuro** conferido em toda etapa (o projeto já tem tokens `--surface-*`, `--text-*`).
8. **Arquivos com CRLF** — preservar o fim de linha nos edits.
9. Validar com `npm run build` (e testes existentes) + olhar a tela no navegador antes de dar a etapa por feita.

## O que a auditoria encontrou (main v0.3.192)

- Cor da marca virou azul (`--color-verde-primary: #0ea5e9`), mas o verde do Painel SST ficou espalhado:
  - sidebar: `linear-gradient(180deg, #0369a1 0%, #112a1a 60%, #0d2016 100%)` em `components/layout/SidebarShell.tsx` (2 lugares);
  - `public/manifest.webmanifest`: `"theme_color": "#006B54"`;
  - tokens ainda verdes: `--color-verde-light: #e8f5e9` e `--color-verde-border: #c8e6c9` em `app/globals.css`
    → todo `bg-verde-light` / `border-verde-border` sai **verde** (1.215 usos de classes `verde-*`);
  - ~1.000 classes `emerald-*`/`green-*` (mais usadas: `emerald-700`, `emerald-50`, `emerald-500`, `emerald-600`),
    concentradas em `components/gestao`, `components/inspecoes`, `app/(psicossocial)`, `app/(app)`, `components/ui`;
  - `#1e4d28` (verde escuro) 61×, a maioria nos templates de PDF.
- **Não existe componente de tooltip** em `components/ui`. Há 849 `<label>` em 186 arquivos (~1.336 campos).
- O JCN tem **1 unidade só** → o "mapa de unidades" vira **mapa de empresas clientes**.
- Dados já disponíveis para a parte "viva": `useHomeStats().atividadeRecente` (9 tabelas), `useVencimentos`,
  `investigacoes_acidente` (`data_acidente`, `houve_afastamento`), `AnimatedNumber`. Sem lib de animação — usar CSS.

## Etapas

### Etapa 0 — Azul total (tela)
Objetivo: nenhuma página do JCN com verde **de marca**.
- Tokens: renomear `--color-verde-*` → `--color-marca-*` (manter aliases `verde-*` apontando para os novos até
  terminar a troca, depois remover). `marca-light` = `#e0f2fe`, `marca-border` = `#bae6fd`, `marca-dark` = `#0369a1`,
  e um `marca-deep` marinho (`#0b1e33`) para a sidebar.
- Sidebar: gradiente só em azul/marinho. `manifest.webmanifest`: `theme_color` azul.
- Varredura de `emerald-*`/`green-*` **módulo por módulo**, com esta regra:
  - **verde de marca** (botão primário, cabeçalho, aba ativa, destaque, link, ícone decorativo) → `sky-*`/`marca-*`;
  - **verde de significado** (status "em dia", "concluído", "aprovado", nível de risco baixo, sucesso em toast)
    → **continua verde**, porque a cor carrega informação. Na dúvida, perguntar.
- Entregar uma lista "antes → depois" por módulo para o João revisar.

### Etapa 0b — PDFs dos laudos (só se aprovado)
Os templates (`DrpsTemplate`, `QpsTemplate`, `AetTemplate`, `AepTemplate`, `shared.tsx`) usam `#1e4d28`.
Mudar afeta o documento entregue ao cliente — confirmar antes. Se aprovado: tela e PDF juntos (regra "tela = PDF").

### Etapa 1 — Dicas nos campos (componente + piloto)
Comportamento: ao passar o mouse (ou focar com Tab, ou tocar no celular) no **nome do campo**, aparece uma caixa
pequena e discreta com 1–2 linhas explicando **como preencher**.
- Componente `components/ui/Dica.tsx` + variante de label: `<CampoLabel dica="...">Nome</CampoLabel>`.
  - Indicação discreta: sublinhado pontilhado fino no rótulo (ou ícone `?` 12px cinza); nada chamativo.
  - Caixa: fundo `surface`, borda fina, texto 12px, `max-width` ~260px, cantos 10px, sombra leve,
    atraso de ~300 ms para abrir, fade curto (sem animação se reduced-motion).
  - Acessível: `role="tooltip"` + `aria-describedby`; fecha com Esc; não cobre o campo; `print:hidden`.
  - Sem lib nova (posicionamento simples acima/abaixo conforme espaço).
- Textos num dicionário central `lib/dicas/<modulo>.ts` (`{ campo: "texto" }`), não espalhados nos JSX — fácil de revisar e corrigir.
- Estilo do texto: imperativo, curto, prático. Ex.: *"CNAE principal da empresa (7 dígitos). Define o grau de risco."*
  Sem inventar exigência legal; citar NR só quando houver certeza.
- **Piloto:** um módulo só (sugestão: cadastro de Empresas). João revisa os textos antes de seguir.

### Etapa 2 — Casca inset
Sidebar marinho integrada ao fundo; conteúdo numa "folha" com cantos ~18px encaixada ao lado.
Manter o modo recolhido (`html[data-sidebar="mini"]`) e a transição de página (View Transitions próprio).
Afeta todas as telas → conferir as principais em claro/escuro e no app desktop.

### Etapa 3 — Visão geral em bento
Blocos de tamanhos diferentes por importância: bloco grande "o que exige ação agora" (vencidos + botão resolver),
contador **dias sem acidente com afastamento** (de `investigacoes_acidente`), números com `AnimatedNumber`.

### Etapa 4 — Pulso de segurança ⚠ decisão do João
Nota 0–100 + linha de batimento animada. **A fórmula precisa ser aprovada antes** (vai aparecer para cliente).
Sugestão inicial: % de documentos em dia, descontando vencidos e ações 5W2H atrasadas. Mostrar a composição
ao passar o mouse (a nota tem que ser explicável).

### Etapa 5 — Partes vivas
- Feed "acontecendo agora" a partir de `atividadeRecente`, atualizando a cada 30 s (`refetchInterval`), itens entrando com animação.
- Radar de riscos: vencimentos e riscos altos como pontos; passar o mouse mostra o quê e onde.
- Mapa de empresas clientes com pontos pulsando conforme a situação; clicar abre o resumo da empresa.

### Etapa 6 — Encantamento
Cards com leve profundidade 3D no hover, comemoração discreta ao concluir inspeção/laudo,
revisão completa do modo escuro e do reduced-motion.

### Etapa 7 — Dicas em todos os módulos
Rolar o padrão da Etapa 1 módulo por módulo (~186 arquivos com campos). Cada módulo = um lote revisado pelo João.
Ordem sugerida: Empresas → Inspeções/Riscos → EPI → AET/AEP → Psicossocial → Máquinas → Gestão → Config.

## Andamento

| Etapa | Status | Versão | Observação |
|---|---|---|---|
| 0 Azul total | concluída | 0.3.201 | 0.1 feita (0.3.194); 0.2 Questionários + DRPS (0.3.195); 0.3 AEP + AET (0.3.196); 0.4 Conformidade + NC (0.3.197); 0.5 Inspeções + componentes (0.3.198); 0.6 Máquinas + Químicos + Equipamentos (0.3.199); 0.7 Frota, EPI e o resto (0.3.200); 0.final troca de nome verde-* → marca-* (0.3.201). Porte ao Painel: traduzir marca-* → verde-* nos MDs |
| 0b PDFs | concluída | 0.3.202 | títulos/faixas/rótulos em azul-marinho #0c4a6e (tela e PDF); verde só de significado; travas de print da 0.1/0.2 removidas |
| 1 Dicas (piloto) | concluída | 0.3.203 | `components/ui/Dica.tsx` + `CampoLabel`; textos em `lib/dicas/empresas.ts` (28 campos do EmpresaForm) |
| 2 Casca inset | concluída | 0.3.204 | `.casca`/`.casca-folha` no globals.css + 22 layouts (21 módulos e Gestão); fundo `app-aurora`/`app-bg` sem verde |
| 3 Bento | pendente | | |
| 4 Pulso | aguardando fórmula | | |
| 5 Vivo | pendente | | |
| 6 Encantamento | pendente | | |
| 7 Dicas em tudo | pendente | | |

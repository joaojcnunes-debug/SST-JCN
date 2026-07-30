# PROMPT CLAUDE CODE — Evolução do módulo Apreciação de Máquinas NR-12 (SST-JCN)

> Ajustado para o **SST-JCN** a partir do prompt original (que era do painel-sst).
> Objetivo: **NÃO recriar o módulo** — ele já existe e é maduro. Vamos **evoluí-lo**
> de *1 máquina por apreciação* para *1 laudo cobrindo VÁRIAS máquinas*.

## ⚠️ REGRA ZERO (ler antes de tudo)

1. **Nenhum código na Rodada 1.** Nesta primeira resposta você entrega SOMENTE: (a) auditoria do estado atual do módulo no JCN, (b) plano escrito por fases, (c) perguntas em aberto. Nada de SQL, nada de `.tsx`.
2. **Aprovação explícita entre fases.** Só avance quando eu escrever `aprovado, fase N`.
3. **Stop-and-wait.** Ao fim de cada fase, pare e aguarde.
4. **Arquivo completo, nunca diff.** Toda entrega de código é o arquivo inteiro.
5. **Migrações idempotentes/reversíveis** (`DROP POLICY IF EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.). Aplicadas via MCP `supabase-sst` (banco JCN `ieesssxgjzywrtiqdvmz`).
6. **Tabelas de evidência/append-only por RLS** quando aplicável.
7. **Não tocar no painel-sst.** É referência de leitura; o alvo é só o `sst-jcn`.

---

## CONTEXTO DO PROJETO (SST-JCN)

- Repo correto: `C:\Users\Usuario\sst-jcn` (Vercel, deploy só via CLI; **não** é o painel-sst).
- Stack: Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4, Supabase (PostgreSQL + Auth + Storage + RLS), TanStack Query v5, Zustand, react-hot-toast, lucide-react.
- Migrações: `supabase/migrations/vNN_*.sql`. **Maior atual = v131 → esta será a v132** (confirmar antes de nomear).
- IDs: **PK é TEXT** no formato `PREFIXO-XXXXXXXX`, gerado no client via `gerarId("PREFIXO")` (`lib/utils`). **NÃO usar UUID nem `codigo` separado** — seguir a convenção das tabelas já existentes do módulo (`id_apreciacao`, `id_risco`, `id_item`…).
- `empresas.id_empresa` é **TEXT** (ex.: `EMP-FA90C5CC`), não CNPJ.
- **RLS deste módulo = isolamento real por empresa** (confirmado em v105/v106). NÃO é `using(true)`. As tabelas usam: escrita `caller_pode_editar() AND caller_pode_ver_empresa(<id_empresa>)`; leitura `caller_pode_ver_empresa(<id_empresa>)`. Tabelas-filhas (como `apreciacao_riscos_hrn`) fazem o join até a empresa via a apreciação-pai: `EXISTS (SELECT 1 FROM apreciacoes_maquinas par WHERE par.id_apreciacao = <filha>.id_apreciacao AND caller_pode_ver_empresa(par.id_empresa))`. **Replicar EXATAMENTE essa forma** nas tabelas novas (a `apreciacao_fichas_maquina` espelha a policy de `apreciacao_riscos_hrn`; as tabelas re-parentadas passam a joinar `ficha → apreciacao → empresa`). **NÃO** inventar `empresa_id::text` nem `using(true)`.
- Tokens de marca **JCN (azul):** `verde-primary` `#0ea5e9`, `verde-accent`/hover `#0284c7`, `verde-dark` `#0369a1`. **Fonte: Inter** (NÃO Calibri). Vermelho de risco alto pode usar os tokens de status já existentes.
- Idioma de toda a saída: **português do Brasil**.
- Assinante: **responsável técnico do JCN** (cert. A1 por usuário no Storage, senha digitada no momento). **NÃO** usar nomes/CREA do painel-sst (nada de "Chabra" ou "Abrahim Elias Neto").

---

## ESTADO ATUAL — O MÓDULO JÁ EXISTE (auditar e confirmar na Rodada 1)

O módulo **Apreciação de Máquinas (NR-12)** já está no ar no JCN. **NÃO recriar nada disto** — reaproveitar:

**Rotas** `app/(apreciacao-maquinas)/apreciacao-maquinas/`: `page.tsx` (lista), `nova/`, `[id]/`, `[id]/laudo/`, `relacao-maquinas/` (= inventário de máquinas), `texto-padrao/`, `ajuda/`.

**Componentes** `components/apreciacao-maquinas/`: `RiscoHrnTable.tsx` (linhas HRN POD×FEP×GPD), `PlanoAcaoTable.tsx` (5W2H), `ItemApreciacaoCard.tsx`.

**Dados/lib**: `lib/apreciacao-maquinas/catalogo-nr12.ts` (checklist NR-12 estático, ~316 linhas), `lib/hooks/useApreciacoesMaquinas.ts`, `useRiscosHrn`, `useInventarioMaquinas`. HRN em `lib/supabase/types.ts` (`PodHrn`/`FepHrn`/`GpdHrn`/`NpeHrn`, `calcularClassificacaoHrn`).

**PDF**: `components/pdf/templates/ApreciacaoTemplate.tsx` + `app/api/pdf/apreciacao/[id]/route.ts` (Puppeteer + `@sparticuz/chromium`) + PAdES via `/api/sign-pdf` → `assinarPdfPades`.

**IA**: edge functions `analisar-foto-apreciacao-ia` e `gerar-parecer-apreciacao-ia` (já existem — reaproveitar por ficha).

**Tabelas** (banco JCN): `apreciacoes_maquinas` (v47 — PK `id_apreciacao text`, **1 máquina** via `id_maquina` FK OU `maquina_descricao` texto), `apreciacoes_maquinas_itens` (v47 — checklist snapshot + `foto_urls[]`), `apreciacao_itens_livres` (v48), matriz 5W2H (v49), `apreciacao_acoes` (v50), textos padrão (v51), `apreciacao_foto_legendas` (v68), `apreciacao_riscos_hrn` (v105 — `id_risco`, `id_apreciacao`, `tipo_perigo`, `origem`, `potenciais_consequencias`, `pod`, `fep`, `gpd`, `npe_item`, `classificacao_risco`, `nivel_acoes`, `medidas_preventivas`, `ordem`). Inventário: `inventario_maquinas` (v46, PK `id_maquina text`).

---

## OBJETIVO DA EVOLUÇÃO

Hoje a hierarquia é **Empresa → Apreciação (1 máquina)**. Evoluir para:

> **Empresa → Apreciação/Laudo (capa) → N Máquinas (fichas) → Perigos HRN + Checklist + Fotos por ficha**

Ou seja, um único laudo NR-12 deve consolidar **várias máquinas** (referência: laudo TERE FRUTAS, 35 máquinas, ~42 páginas), cada máquina como uma **ficha** com seus próprios perigos, checklist, fotos e parecer — reaproveitando o motor HRN, o 5W2H, o PDF, o PAdES e a IA que já existem.

---

## MUDANÇA DE MODELO DE DADOS (proposta — refine no plano da Rodada 1)

**Ideia central:** introduzir um nível de **ficha de máquina** entre a apreciação e os dados que hoje pendem direto da apreciação.

1. **Nova tabela `apreciacao_fichas_maquina`** (filha de `apreciacoes_maquinas`): `id_ficha text PK`, `id_apreciacao` (FK), `numero_ordem int`, vínculo híbrido `id_maquina` (FK opcional a `inventario_maquinas`) OU campos livres (`equipamento`, `tipo`, `modelo`, `fabricante`, `serie`, `ano`, `capacidade`, `setor`), `constatacoes_inspecao`, `parecer_tecnico`, `prioridade_manual bool` (caso elevador: BAIXO mas destaque alto), `foto_urls text[]`, `foto_storage_paths text[]`.
   - Sem placa → default de texto-padrão: *"Placa de identificação não localizada na inspeção; recomenda-se identificação patrimonial interna e complementação documental."*
2. **Re-parentar** `apreciacao_riscos_hrn` e `apreciacoes_maquinas_itens` (e fotos/legendas) de `id_apreciacao` → **`id_ficha`** (adicionar a coluna, com FK; manter a antiga durante a transição).
3. **Backfill obrigatório e reversível:** para cada apreciação existente, criar **1 ficha** (numero_ordem=1) herdando `id_maquina`/`maquina_descricao` e migrando os riscos/itens/fotos para essa ficha. O módulo atual (1 máquina) vira o caso trivial de N=1 — **nada quebra**.
4. **Novo catálogo de perigos reutilizável `apreciacao_perigos_catalogo`** (tabela, não código): `id`, `nome` (ex.: "Choque elétrico"), `origem_consequencias`, `itens_nr12 text[]`, `medidas_eng`, `medidas_adm`, `pod_default`, `fep_default`, `gpd_default`, `pod_residual_default`, `fep_residual_default`, `gpd_residual_default`, `ativo`. Seed com os perigos recorrentes do laudo de referência (perfurocortantes 12.38–12.55, movimento por inércia 12.56–12.63, aprisionamento, corte/lâmina rotativa, prensagem, queimaduras 12.24/12.119, óleo quente, incêndio/explosão GLP NR-20 + 12.132, baixas temperaturas/refrigeração, queda/esmagamento por carga em elevador, choque elétrico 12.14–12.23, projeção de partículas 12.46). Ao adicionar um perigo numa ficha, pré-preenche a linha HRN (o técnico ajusta).
   - Reaproveitar/consolidar com o `catalogo-nr12.ts` existente (checklist) — decidir no plano se o catálogo de perigos convive com o checklist ou os unifica.

> Reutilizar as escalas e o cálculo HRN que **já existem** (`calcularClassificacaoHrn`), não reimplementar.

---

## REGRAS DE NEGÓCIO (reusar o que já existe em `lib/supabase/types.ts`)

**Escalas 1–4 (já implementadas):**
- POD: Remota(1) · Improvável(2) · Provável(3) · Muito provável(4)
- FEP: Anualmente(1) · Mensalmente(2) · Semanalmente(3) · Diariamente(4)
- GPD: Baixa(1) · Moderada(2) · Grave(3) · Catastrófica(4)
- (JCN também tem **NPE** — Número de Pessoas Expostas — como campo informativo, ABNT ISO/TR 14121-2:2018)

**Índice de Risco = POD × FEP × GPD** (já implementado).

**⚠️ PONTO A RECONCILIAR (perguntar na Rodada 1):** as faixas de classificação **divergem**.
| Faixa | JCN atual (ABNT ISO/TR 14121-2) | Prompt original (painel) |
|---|---|---|
| ALTO | índice > 32 | > 36 |
| MÉDIO | 13–32 | 19–36 |
| BAIXO | 5–12 | 9–18 |
| DESPREZÍVEL | ≤ 4 | ≤ 8 |

Manter as faixas do JCN (padrão ABNT já em produção) **salvo instrução explícita em contrário** — mudar as faixas reclassifica laudos existentes.

**Risco residual:** recalculado reduzindo prioritariamente o **POD** (proteções atuam sobre a probabilidade). Aviso/validação se o residual reduzir GPD sem justificativa.

**Conclusão geral automática do laudo:** contar/listar as **fichas** com residual MÉDIO ou superior; permitir `prioridade_manual` para itens BAIXO que exigem destaque (caso elevador). Texto-base parametrizável (reusar `texto-padrao`).

---

## ENTREGÁVEIS POR FASE (proposta — refine no plano da Rodada 1)

- **Fase 1 — Migração SQL (v132):** `apreciacao_fichas_maquina` + `apreciacao_perigos_catalogo` (com seed) + coluna `id_ficha` em `apreciacao_riscos_hrn`/`apreciacoes_maquinas_itens` (+ FKs, índices) + **backfill reversível** (1 ficha por apreciação existente) + RLS no padrão do módulo. Idempotente/reversível, aplicada via MCP.
- **Fase 2 — Camada de dados:** tipos TS, hooks TanStack Query (fichas: list/get/create/update/reordenar/excluir; catálogo de perigos), ajuste de `useRiscosHrn`/itens para pendurar em `id_ficha`, store Zustand do laudo em edição. Reusar `calcularClassificacaoHrn`.
- **Fase 3 — Telas:** tela do laudo `[id]` vira **lista de fichas** (adicionar/reordenar/excluir máquina), cada ficha abre o editor (inventário híbrido + perigos a partir do catálogo + checklist + fotos + parecer IA), Texto Padrão e Visão Geral com **contagem por classe de risco somando todas as fichas**.
- **Fase 4 — Laudo/PDF:** `ApreciacaoTemplate` passa a iterar as fichas; `break-inside: avoid`/`break-after: avoid` por ficha (não fatiar página); folha de assinaturas; **PAdES ICP-Brasil** reusando `/api/sign-pdf` → `assinarPdfPades` (gerar → placeholder → assinar → nada depois).

---

## CONTRATOS DE NÃO-REGRESSÃO (não quebrar)

- Ordem de assinatura: gerar PDF → placeholder → assinar → **nada depois**.
- Certificado A1 .pfx por usuário no Storage; **senha digitada no momento**, nunca persistida.
- `break-inside: avoid` / `break-after: avoid` na paginação (não "fatiar página"). PDF vetorial (Puppeteer) — **nunca** html2canvas.
- RLS de toda tabela nova no **mesmo padrão** das tabelas atuais do módulo (não introduzir modelo novo).
- **Backfill não pode perder dados** das apreciações existentes (riscos/itens/fotos) — cada uma vira uma ficha N=1.
- Reusar o motor HRN, o 5W2H, o PDF e a IA existentes — não duplicar.

---

## COMECE AGORA (Rodada 1)

Entregue **somente**: (a) auditoria do que já existe no JCN relacionado à Apreciação de Máquinas (tabelas, hooks, componentes, PDF, IA, RLS), confirmando/corrigindo o que descrevi acima; (b) plano por fases refinado para a evolução multi-máquina, incluindo a estratégia de **backfill reversível**; (c) perguntas em aberto (a começar pelas **faixas de classificação HRN**). **Sem código.** Aguarde meu `aprovado, fase 1`.

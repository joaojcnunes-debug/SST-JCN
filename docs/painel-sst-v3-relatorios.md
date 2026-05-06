---
title: Painel SST V3 — Configurações Dinâmicas e Sistema de Relatórios
aliases:
  - V3 SST
  - Relatórios Painel SST
  - Matrizes Editáveis SST
  - Relatório Chabra
tags:
  - projeto/painel-sst
  - chabra
  - sst
  - nextjs
  - supabase
  - tipo/feature
status: produção
created: 2026-05-06
updated: 2026-05-06
versao: V3
relacionado: "[[painel-sst-chabra]]"
---

# Painel SST V3 — Configurações Dinâmicas e Sistema de Relatórios

> Continuação técnica de [[painel-sst-chabra]]. Esta nota cobre **V3** (tipos/perguntas/matrizes editáveis) e o sistema de **3 relatórios** que evoluiu durante o projeto.
> Veja a nota mestra pra contexto geral, stack, RBAC e gotchas pré-V3.

## Sumário

- [[#V3 — Por que e o que mudou|V3 — Por que e o que mudou]]
- [[#Tipos de risco editáveis|Tipos de risco editáveis]]
- [[#Perguntas customizadas por tipo|Perguntas customizadas por tipo]]
- [[#Matrizes de risco N×M|Matrizes de risco N×M]]
- [[#Sistema de 3 relatórios|Sistema de 3 relatórios]]
- [[#Padrões de design dos relatórios|Padrões de design dos relatórios]]
- [[#Gotchas V3|Gotchas V3]]
- [[#Roadmap pendente|Roadmap pendente — Escopo expandido]]

---

## V3 — Por que e o que mudou

### Problema que motivou a V3
A V2 tinha 3 itens hardcoded que limitaram o usuário:

1. **Tipos de risco** eram constantes (`TIPOS_RISCO` em `lib/constants.ts`). Cliente pediu pra criar "Radiação Solar" como tipo próprio.
2. **Perguntas específicas** (Q1-Q6 químico, físico_necessita_medicao, etc.) eram colunas fixas. Cliente quis perguntas adicionais por tipo.
3. **Cálculo de nível** seguia uma fórmula SGG fixa em `calcularNivelRisco`. Cliente pediu "criação livre" de matrizes (ABNT NBR 14280, William Fine, customizadas).

### Solução: 3 tabelas novas + função de cálculo dinâmica

| Antes (V2) | Depois (V3) |
|---|---|
| `TIPOS_RISCO` constante (9 itens) | tabela `tipos_risco` (CRUD via UI) |
| Q1-Q6 químico hardcoded | tabela `perguntas_tipo_risco` + coluna `respostas_custom JSONB` |
| `calcularNivelRisco(prob, sev)` com fórmula fixa | tabela `matrizes_risco` + função `calcularNivelComMatriz(prob, sev, matriz)` |

### Princípio de compatibilidade
- Os **9 tipos antigos** ficam como `sistema=true` na tabela — **não podem ser excluídos**, só desativados. Isso preserva riscos antigos cujo `tipo_risco` aponta pra eles.
- A **matriz SGG (5×4)** é seedada como ativa por padrão. Sistema mantém comportamento V2 se o admin não tocar nada.
- Os campos hardcoded (`quim_q1..q6`, `fisico_necessita_medicao`) **continuam existindo**. Perguntas customizadas vão pro `respostas_custom` JSONB e coexistem com os campos legados.

---

## Tipos de risco editáveis

### Schema

```sql
CREATE TABLE public.tipos_risco (
    id_tipo TEXT PRIMARY KEY,        -- slug: 'fisico', 'quimico', 'meu_tipo_custom'
    nome TEXT NOT NULL,              -- "Físico", "Meu Tipo Custom"
    icone TEXT,                      -- emoji: '🌡️'
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    sistema BOOLEAN NOT NULL DEFAULT FALSE  -- protege seeds da exclusão
);
```

### Hook `useTiposRisco({ incluirInativos })`
- Default lista só os ativos (pra dropdown do form)
- Com `incluirInativos: true` lista todos (pra tela de admin em /config)

### Onde é usado
- **`/config` aba "Tipos de Risco"** — CRUD com emoji picker (24 emojis sugeridos), reordenação por setas ↑↓, toggle ativo/inativo
- **RiscoForm** — `<select>` de tipo carrega dinâmico do banco em vez de iterar `TIPOS_RISCO` constante
- **Tipos de "sistema"** mostram badge azul `sistema` e ao clicar excluir, são apenas desativados

### Implementação chave
```typescript
// components/config/TiposRiscoTab.tsx
const { data: tipos = [] } = useTiposRisco({ incluirInativos: true });
const save = useSaveTipoRisco();
const del = useDeleteTipoRisco();  // se sistema=true, faz UPDATE ativo=false em vez de DELETE
```

---

## Perguntas customizadas por tipo

### Schema

```sql
CREATE TABLE public.perguntas_tipo_risco (
    id_pergunta TEXT PRIMARY KEY,
    id_tipo TEXT NOT NULL REFERENCES tipos_risco(id_tipo) ON DELETE CASCADE,
    chave TEXT NOT NULL,                  -- slug: 'usa_protetor_auricular'
    texto TEXT NOT NULL,                  -- "Usa protetor auricular?"
    input_type TEXT DEFAULT 'select',     -- 'select' | 'text' | 'textarea'
    opcoes JSONB DEFAULT '[]',            -- ['Sim','Não','N/A'] (só pra select)
    ordem INTEGER NOT NULL DEFAULT 0,
    obrigatoria BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (id_tipo, chave)
);

ALTER TABLE riscos ADD COLUMN respostas_custom JSONB DEFAULT '{}';
```

### Como o RiscoForm renderiza dinamicamente
```tsx
// Quando o usuário muda o tipo de risco, hook recarrega perguntas:
const { data: perguntasCustom = [] } = usePerguntasPorTipo(
  tiposCustom.find((t) => t.nome === form.tipo_risco)?.id_tipo
);

// Renderiza dinâmico:
{perguntasCustom.map((p) => (
  <DynamicField pergunta={p} valor={form.respostas_custom[p.chave]} ... />
))}

// Salva:
respostas_custom: Object.keys(form.respostas_custom).length > 0
  ? form.respostas_custom
  : null
```

### Tipos de input suportados
- **`select`** — dropdown com `opcoes[]`
- **`text`** — input de uma linha
- **`textarea`** — múltiplas linhas

### Validação
- `chave` deve ser slug `[a-z][a-z0-9_]*` (validação no form)
- `chave` é imutável após criação (disabled no edit) — evita quebrar respostas antigas

### Renderização no relatório
- **Relatório Chabra (`/relatorio`):** bloco azul "Perguntas customizadas" no card de risco
- **PGR (`/pgr`):** seção "Detalhamento Adicional" loop sobre `Object.entries(respostas_custom)`

---

## Matrizes de risco N×M

### Schema com lookup table

```sql
CREATE TABLE public.matrizes_risco (
    id_matriz TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    probabilidades JSONB NOT NULL,   -- ["Improvável", "Remoto", ...]
    severidades JSONB NOT NULL,      -- ["Insignificante", "Marginal", ...]
    lookup JSONB NOT NULL,           -- string[][] — lookup[iP][iS] = nivel
    ativa BOOLEAN NOT NULL DEFAULT FALSE
);

-- Apenas UMA matriz pode estar ativa (índice parcial UNIQUE)
CREATE UNIQUE INDEX idx_matriz_unica_ativa
  ON matrizes_risco ((1)) WHERE ativa = TRUE;
```

### Por que `lookup` em vez de fórmula?
- Fórmula com pesos e regras especiais (`if score > 8 && ...`) não cobria todas as matrizes que o cliente queria usar (ABNT vs SGG vs William Fine têm regras diferentes)
- **Lookup table** é universal: pra cada combinação `[iP][iS]`, o admin escolhe diretamente o nível
- Trade-off: matrizes muito grandes (>10×10) têm muita célula pra preencher manualmente — na prática 5×4 ou 5×5 é o caso comum

### Função de cálculo (substitui `calcularNivelRisco`)
```typescript
// lib/calc.ts
export function calcularNivelComMatriz(
  prob: string | null,
  sev: string | null,
  matriz: MatrizRisco | null
): NivelRisco {
  if (!matriz || !prob || !sev) return "Baixo";
  const iP = matriz.probabilidades.indexOf(prob);
  const iS = matriz.severidades.indexOf(sev);
  if (iP < 0 || iS < 0) return "Baixo";
  return (matriz.lookup[iP]?.[iS] as NivelRisco) ?? "Baixo";
}
```

### Editor visual em `/config → Matrizes de Risco`
- Tabela editável: cabeçalho de severidades inline (renomeáveis), coluna de probabilidades inline
- Cada célula é um `<select>` com `NIVEIS_RISCO` (Trivial/Baixo/Moderado/Alto/Muito Alto)
- Cor da célula reflete o nível selecionado em runtime
- Botões `+ Prob` / `+ Sev` redimensionam a matriz preservando valores existentes (`redimensionarLookup`)
- "Preencher tudo com [nível]" — atalho pra começar de uma cor base

### Switching de matriz ativa
- `useAtivarMatriz(idMatriz)` faz UPDATE em duas etapas:
  1. `UPDATE matrizes_risco SET ativa=false WHERE id != $idMatriz` (zera todas)
  2. `UPDATE matrizes_risco SET ativa=true WHERE id = $idMatriz`
- A constraint `UNIQUE WHERE ativa=TRUE` garante que se algo der errado, o banco não fica em estado inválido

### ⚠ Cuidado com matrizes ativas pequenas
- Se você ativar uma matriz com **menos** probabilidades/severidades que a anterior, riscos antigos podem ter `probabilidade` que **não existe** na matriz nova
- O `calcularNivelComMatriz` retorna "Baixo" como fallback nesses casos — mas o select do RiscoForm vai mostrar a label antiga sem opção válida
- Solução: ao editar um risco antigo, o usuário precisa re-selecionar prob/sev compatíveis

---

## Sistema de 3 relatórios

O painel-sst evoluiu pra ter **3 saídas de relatório** distintas, cada uma pra um propósito específico:

### 1. `/inspecoes/[id]/relatorio` — Executivo (Formato Chabra)

**Propósito:** apresentar ao cliente, layout polido, formato igual ao PDF que a Chabra usa em produção.

**Estrutura:**
1. **Capa** com faixa verde lateral, logo da empresa (configs.logo_url) ou placeholder Chabra, card destacado nome+CNPJ, data
2. **Identificação** + **Resumo Geral** (cards numéricos: Setores | Cargos | Riscos | **Não Conformes** destacado)
3. **Por SETOR** (não por tipo de risco):
   - Status Conforme/Não Conforme (auto-derivado de `setor.nao_conformidade.trim() !== ""`)
   - Descrição + cargos + fotos + cards de risco agrupados por tipo
4. **Cards de risco** estilo PDF Chabra:
   - Border-left colorida pelo nível
   - Fonte geradora destacada (laranja)
   - Grid 4 colunas (Probab/Sev/Meio/Situação...)
   - **Pré-classificação NHO-08** com 7 perguntas qualitativas (químico)
   - **Respostas customizadas V3** em bloco azul
   - Medidas adotadas (verde) + a adotar (âmbar)
   - EPIs com formato `RECOMENDADO + CA + Detalhe`
5. **Final:** Observações + Responsáveis + Assinaturas (Técnico + Empresa)
6. **CSS @print A4 portrait** com `page-break-after` na capa

**Inspirado em:** `Relatorio SPE.pdf` (relatório real da Chabra, abril/2026)

### 2. `/inspecoes/[id]/pgr` — Técnico (NR-1)

**Propósito:** Inventário de Riscos no formato PGR/GRO previsto pela NR-1, pra auditoria SST e fiscalização.

**Estrutura:**
1. Header empresa + grau NR-04
2. Resumo quantitativo por nível
3. **Inventário de Riscos** em tabelão A4 **paisagem**: Setor | Cargo | Tipo | Perigo | Fonte | Tempo Exp | Meio | Téc | Probab | Severid | Nível | Medidas Existentes | EPIs | Medidas Recomendadas
4. Detalhamento adicional (campos específicos + respostas custom)
5. **Plano de Ação** (apenas riscos com `medidas_recomendadas`)
6. Responsáveis + Observações + Rodapé

**CSS:** `@page A4 landscape` com fonte 8pt nas tabelas — caber 14 colunas em paisagem.

### 3. `/empresas/[id]/relatorio` — Consolidado por Empresa

**Propósito:** comparar todas as inspeções de uma mesma empresa ao longo do tempo (revisões), ver evolução dos riscos.

**Estrutura:**
1. Header empresa
2. Tabela comparativa: 1 linha por revisão, contadores por nível em colunas (Trivial/Baixo/Moderado/Alto/Muito Alto + Total)
3. Detalhamento por inspeção: cada revisão expandida com seus riscos

**Quando usar:** após múltiplas inspeções na mesma empresa, pra mostrar progressão das medidas.

### Acessos no editor

```
[Editor de Inspeção topbar]
├── Relatório       → /inspecoes/[id]/relatorio   (Chabra executivo)
├── PGR             → /inspecoes/[id]/pgr         (NR-1 técnico)
└── (Página da empresa) → /empresas/[id]/relatorio (Consolidado)
```

---

## Padrões de design dos relatórios

### Print-friendly via CSS `@media print`

```css
/* Padrão usado em todos os 3 relatórios: */
@media print {
  @page { size: A4 portrait; margin: 0; }   /* PGR usa landscape */
  body { font-size: 10pt; }
  .capa-page { page-break-after: always; min-height: 100vh; }
  .secao-setor { page-break-inside: avoid; }
  .risco-card { page-break-inside: avoid; }
}
```

### Toolbar oculta na impressão
```tsx
<div className="no-print flex items-center justify-between">
  <Link>Voltar</Link>
  <button onClick={() => window.print()}>Imprimir</button>
</div>
```

A classe `no-print` é convenção — qualquer botão/nav/link que não deva sair no PDF leva essa classe.

### Cores em estilo inline (vs Tailwind)
- Cores dinâmicas dos níveis (`NIVEL_CONFIG[nivel].cor/bg/borda`) usam **`style={{ color, backgroundColor }}`** em vez de classes Tailwind
- **Por quê?** Tailwind purga classes não literais (`bg-${cor}` não funciona). Estilo inline garante que a cor renderiza tanto na tela quanto no print.

### `referrerpolicy="no-referrer"` em imagens do Storage
- Supabase Storage exige isso pra imagens carregarem em PDF/print contexts (alguns browsers bloqueiam)
- Padrão em todas as `<img>` que apontam pro Supabase

---

## Gotchas V3

### Lookup `JSONB` chega como `unknown` no TypeScript
- Mesmo com `Database` type definido, o Supabase retorna `valor: JSON` como `unknown` (correto)
- Em `useConfiguracoes` e `useMatrizAtiva`, fazer cast explícito após verificar:
  ```ts
  if (Array.isArray(row.valor)) (out[key] as string[]) = row.valor as string[];
  ```

### `useSearchParams` em Next 15 + componente client + Suspense
- O wizard de Nova Inspeção e o Login usam `useSearchParams`
- Padrão: extrair em `<Inner />` e wrappar em `<Suspense fallback={null}>` no default export

### `as never` virou padrão sistêmico
- **Todo** `insert/update/upsert` no Supabase usa `payload as never` por causa do bug de inferência com `Partial<>`
- Não tente "limpar" — em V3 o cast aparece em ~25 lugares e é intencional

### Perguntas customizadas: chave imutável
- Após criar uma pergunta, o `chave` (slug usado em `respostas_custom` JSONB) **não pode mais mudar**
- Senão respostas antigas ficam órfãs no JSONB
- UI desabilita o input com `disabled={!!editing}`

### Matriz ativa: índice parcial UNIQUE em PostgreSQL
```sql
CREATE UNIQUE INDEX idx_matriz_unica_ativa
  ON matrizes_risco ((1)) WHERE ativa = TRUE;
```
- A sintaxe `((1))` é uma expressão constante — funciona como "qualquer valor único", forçando que **só uma linha** pode ter `ativa=TRUE`
- Truque PostgreSQL específico — não confundir com índice condicional comum

### Tipos de risco com `sistema=true` não podem ser excluídos
- O hook `useDeleteTipoRisco` faz query antes de deletar:
  ```ts
  const { data: existing } = await supabase
    .from("tipos_risco").select("sistema").eq("id_tipo", idTipo).single();
  if (existing.sistema) { /* update ativo=false */ }
  else { /* delete */ }
  ```
- Isso garante que os 9 tipos seedados (Acidente, Físico, etc.) sempre existam mesmo após "exclusão"

### Status "Conforme" do setor é derivado, não persistido
- A tabela `setores` tem `conformidade` e `nao_conformidade` (texto livre)
- O badge "Conforme/Não Conforme" no relatório é derivado em runtime:
  ```ts
  const isConforme = !setor.nao_conformidade?.trim();
  ```
- Não há coluna booleana `conforme` — economiza schema mas obriga lógica no client

---

## Roadmap pendente — Escopo expandido

Foi pulado nesta sessão por escolha do usuário (escopo mínimo). Capturado pra retomar depois:

### 1. PAE — Plano de Atendimento a Emergências
**O que:** lista de pessoas com hierarquia/cargo/telefone (similar ao "Brigadistas" da NR-23).
**Schema:** `CREATE TABLE pae (id, id_inspecao, ordem, nome, cargo, telefone, ...)`
**UI:** nova aba no editor (similar a Responsáveis)
**Render:** seção dedicada no relatório (aparece no PDF da Chabra)

### 2. Máquinas e Equipamentos por setor
**O que:** equipamentos cadastrados em cada setor (Traçador, Furadeira) com Frequência (Diário/Semanal/...) e Operador e Status de Proteção.
**Schema:** `CREATE TABLE maquinas (id, id_setor, nome, frequencia, operador, protecao_status, ...)`
**UI:** sub-aba dentro de Setores ou aba dedicada
**Render:** bloco "Máquinas e Equipamentos" no card de cada setor

### 3. Extintor / Kit Primeiros Socorros como check
**O que:** auditoria de itens de segurança — extintor presente? kit montado?
**Schema:** colunas em `inspecoes`: `tem_extintor BOOLEAN`, `extintor_obs TEXT`, `tem_kit_socorros BOOLEAN`, `kit_obs TEXT`
**UI:** seção em "Observações" ou aba "Itens de Segurança"
**Render:** bloco final do relatório

### 4. Treinamentos NR por setor
**O que:** lista de treinamentos NR exigidos por setor (NR-01, NR-06, NR-12, NR-18)
**Opção A (rápida):** usar tabela `complementos` existente filtrando por `tipo='Treinamento'`
**Opção B (estruturada):** tabela `treinamentos_setor (id, id_setor, codigo_nr, descricao, status)`
**Render:** seção "Treinamentos necessários" no card de cada setor

---

## Como um agente futuro deve pensar sobre V3

### Antes de adicionar feature:
1. **É configuração editável pelo Admin?** → considerar adicionar em `/config` (segue o padrão das 3 tabelas V3)
2. **É campo dinâmico por tipo?** → considerar perguntas customizadas em vez de criar coluna nova
3. **É regra de cálculo?** → considerar tornar tabela editável em vez de hardcoded
4. **É um relatório novo?** → escolher: substituir um existente ou criar um quarto? Cuidado com proliferação.

### Ao mexer no schema:
1. Migration **idempotente** (`ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`)
2. **Sempre habilitar RLS** + criar policies `auth read X` e `auth write X` (padrão do projeto)
3. Atualizar `lib/supabase/types.ts` com novo tipo
4. Adicionar `TableShape<NovoTipo>` no `Database.public.Tables`
5. Inserir `as never` nos insert/update — não tentar tipar corretamente, é inútil com o tipo genérico atual

### Ao adicionar relatório novo:
1. Decidir se substitui ou complementa os 3 existentes
2. Seguir o padrão `no-print` na toolbar
3. CSS `@media print` com `@page` configurado
4. Links cruzados entre os relatórios (botões "Versão PGR", "Consolidado")
5. Usar `referrerpolicy="no-referrer"` em todas as imagens do Storage

---

## Arquivos-chave V3

| Arquivo | Propósito |
|---|---|
| `lib/calc.ts` | `calcularNivelComMatriz`, `matrizVazia`, `redimensionarLookup` |
| `lib/hooks/useV3.ts` | Hooks: tipos, perguntas, matrizes (CRUD + ativação) |
| `components/config/TiposRiscoTab.tsx` | CRUD de tipos com emoji picker |
| `components/config/PerguntasTab.tsx` | CRUD de perguntas selecionando tipo |
| `components/config/MatrizesTab.tsx` | Editor visual N×M com lookup table |
| `components/inspecoes/editor/RiscoForm.tsx` | Form que carrega tipos/matriz/perguntas dinâmicos |
| `app/(app)/inspecoes/[id]/relatorio/page.tsx` | Relatório executivo Chabra (V3+) |
| `app/(app)/inspecoes/[id]/pgr/page.tsx` | Relatório PGR/NR-1 técnico |
| `app/(app)/empresas/[id]/relatorio/page.tsx` | Relatório consolidado por empresa |

---

## Notas relacionadas

- [[painel-sst-chabra]] — nota mestra (V1/V2/V3, stack, RBAC, gotchas gerais)
- [[NR-01]] — base normativa do PGR/GRO
- [[NHO-08]] — pré-classificação química usada nos riscos químicos
- [[Matriz de Risco]] — conceito SST
- [[Supabase RLS]] — pattern de policies do projeto
- [[TanStack Query v5]] — cache strategy

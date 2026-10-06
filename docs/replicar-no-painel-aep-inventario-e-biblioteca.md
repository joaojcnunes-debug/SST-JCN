# Replicar no Painel SST: AEP — triagem na largura toda, inventário de risco e biblioteca como base de opções

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-inventario-e-biblioteca.md`"*.
>
> Origem: JCN (`sst-jcn`), commits de 2026-10-06 (`e6949dc`, `62e3356`, `99b1b00`, PRs #86, #87, #89, #90 e #91), já em produção lá.
> **2 migrations** (v276 e v277, Passo 2). **Sem edge function nova.**
>
> ⚠️ Este arquivo **substitui** o `replicar-no-painel-aep-layout-e-inventario.md`,
> que foi apagado — o modelo do inventário mudou depois dele.

## Pré-requisito

`replicar-no-painel-aep-fases-1-e-2.md` aplicado (biblioteca v272, checklist
de gestão, origem da evidência, `lib/aep/inventario.ts`). Os diffs abaixo
partem do estado do fim da Fase 2.

> A Fase 3 (questionário anônimo por QR Code) foi feita e **removida** no JCN.
> Não há nada dela para replicar.

## O que faz

### 1. Triagem Ergonômica

- Física, Cognitiva e Organizacional ficam **um bloco embaixo do outro**, na
  largura toda.
- Física e Cognitiva: itens em até 3 colunas.
- Organizacional: **um fator por linha**.
- O **nome de cada fator fica em negrito**.
- Ordem dentro do fator:
  1. título com Sim / Não / N/A / N/I;
  2. **roteiro de campo (aberto)**;
  3. **origem da evidência** (se Sim);
  4. observação;
  5. sinais;
  6. matriz AIHA;
  7. **inventário de risco**.

### 2. Biblioteca psicossocial como base de opções (v276)

**Estrutura (`psi_biblioteca_itens`):**
- Uma linha por opção.
- **Por fator:** perigo, fonte geradora (com código), evidência, descrição do
  risco, danos à saúde, medidas de controle **existentes**, medidas de
  controle **recomendadas** (v277), sugestão inicial e ação.
- **Comuns a todos os fatores:** meio de propagação, situação e tempo de
  exposição. O padrão de cada fator continua em `psi_biblioteca_fatores`.
- `padrao` = a opção já vem marcada no inventário.
- Seed com o conteúdo atual de `psi_biblioteca_fatores`.

**Quem inclui:**
- O **Admin inclui direto**.
- O **técnico sugere**: o item entra com status `pendente`, e o Admin
  **aprova ou recusa**.
- O banco garante isso: o não Admin só cria `pendente` sem padrão e não altera
  nem exclui.

**Página `/aep/biblioteca`** (largura toda, um tópico embaixo do outro):
- fila **Sugestões pendentes**;
- por fator, cada tópico: o Admin edita texto/código, marca padrão e exclui;
  todos podem sugerir;
- listas comuns, com a tabela de padrões por fator.

### 3. Inventário de risco do fator "Sim"

- Cada tópico é um **campo de seleção múltipla com criação** (`MultiSelectCriavel`):
  - as escolhidas ficam como etiquetas dentro do campo (× remove);
  - ao clicar abre a lista da biblioteca para marcar **várias**;
  - digitar filtra; texto que não existe vira **item manual** no mesmo campo
    (Enter ou "Incluir «texto»").
- O campo **Evidências é só leitura**: mostra os sinais observados marcados no
  bloco de sinais (em vermelho, contam na matriz) e o que já estava salvo.
- Cada item manual tem **"salvar na biblioteca"** (Admin: vira opção marcada)
  ou **"sugerir"** (técnico: fica pendente).
- **Automáticos do checklist de gestão:**
  - lacunas viram fontes geradoras;
  - itens evidenciados viram medidas existentes.
- Os **sinais do catálogo** contam na matriz; evidências da biblioteca e
  manuais **não contam**.
- Automáticos do checklist de gestão aparecem como **etiquetas fixas** no campo.
- **Probabilidade × Severidade** e **Confiança** são só leitura.
- Botão **Recolher/Expandir**; títulos das linhas em negrito.
- **Onde fica gravado:**
  - em `setor.inventario[fator] = { sel: { tópico: [ids] }, extra: { tópico: [textos] } }`;
  - tópico sem seleção = padrão;
  - opção excluída ou recusada some sozinha;
  - fontes legadas por código (`fontes_geradoras`) ainda valem.
- **Saídas:**
  - laudo, PDF, planilha e IA usam o mesmo `detalhesDoSetor`;
  - a planilha ganhou a coluna **"Medidas de controle recomendadas"**;
  - para a IA, as recomendadas somam-se às ações permitidas.

## Passo 1: conferir o painel

| Usado | Conferir |
|---|---|
| `psi_biblioteca_fatores` (v272) e `caller_eh_admin()` | as migrations dependem deles |
| `lib/aep/inventario.ts`, `lib/aep/biblioteca.ts`, `lib/hooks/useBibliotecaPsi.ts` (Fase 2) | serão **substituídos** |
| `Tristate`, `ChecklistBloco`, `EvidenciaDoFator`, `RoteiroDoFator` em `components/aep/AepSetoresEditor.tsx` | mesmos nomes |
| Os dois normalizadores (`lib/hooks/useAep.ts` e `app/api/pdf/aep/[id]/route.ts`) | precisam conhecer `inventario` |
| `useIsAdmin`, `useCanEdit` em `lib/hooks/useUsuario.ts` | mesmos nomes |

## Passo 2: migrations (banco do painel, nunca no do JCN)

### v276 — `psi_biblioteca_itens` + seed

```sql
-- v276 (2026-10-06): biblioteca psicossocial como BASE DE OPÇÕES.
-- Cada tópico do inventário de risco vira uma lista de opções selecionáveis
-- (decisão do usuário): perigo, fonte geradora, evidência, descrição do
-- risco, danos à saúde, medida de controle, sugestão inicial e ação — por
-- fator; meio de propagação, situação e tempo de exposição — listas COMUNS a
-- todos os fatores (fator null). `padrao` = vem marcado no inventário.
-- Quem inclui: Admin direto (status 'ativo'); técnico SUGERE (status
-- 'pendente', sugerido_por) e o Admin aprova ou recusa.
-- O padrão de meio/situação/tempo de cada fator continua em
-- psi_biblioteca_fatores (meio_propagacao, situacao_padrao,
-- tempo_exposicao_padrao). As demais colunas de texto/lista de
-- psi_biblioteca_fatores ficam como legado (seed desta migration).
-- Já aplicada via MCP. Rollback: scripts/sql/v276_rollback_biblioteca_psi_itens.sql

create table if not exists public.psi_biblioteca_itens (
  id_item text primary key,
  fator text,
  topico text not null check (topico in
    ('perigo','fonte','evidencia','descricao','danos','medida','sugestao','acao','meio','situacao','tempo')),
  texto text not null check (length(trim(texto)) > 0),
  codigo text,
  ordem integer not null default 0,
  padrao boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo','pendente','recusado')),
  sugerido_por text,
  sugerido_em timestamptz,
  revisado_por text,
  revisado_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index if not exists psi_biblioteca_itens_unico
  on public.psi_biblioteca_itens (coalesce(fator, '*'), topico, lower(trim(texto)));
create index if not exists psi_biblioteca_itens_fator_idx on public.psi_biblioteca_itens (fator, topico);

alter table public.psi_biblioteca_itens enable row level security;

drop policy if exists "autenticado le psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "autenticado le psi_biblioteca_itens" on public.psi_biblioteca_itens
  for select to authenticated using (true);

-- Admin inclui em qualquer status; os demais só SUGEREM (pendente).
drop policy if exists "inclui psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "inclui psi_biblioteca_itens" on public.psi_biblioteca_itens
  for insert to authenticated
  with check (public.caller_eh_admin() or (status = 'pendente' and padrao = false));

drop policy if exists "admin altera psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "admin altera psi_biblioteca_itens" on public.psi_biblioteca_itens
  for update to authenticated using (public.caller_eh_admin()) with check (public.caller_eh_admin());

drop policy if exists "admin exclui psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "admin exclui psi_biblioteca_itens" on public.psi_biblioteca_itens
  for delete to authenticated using (public.caller_eh_admin());

-- ── Seed a partir do que a biblioteca já tem (idempotente) ──────────────────
-- id determinístico: BIB- + 8 hex do md5(fator|tópico|texto).
create or replace function pg_temp.bib_id(f text, t text, x text) returns text
  language sql immutable as $$ select 'BIB-' || upper(substr(md5(coalesce(f, '*') || '|' || t || '|' || lower(trim(x))), 1, 8)) $$;

-- Perigo = nome do fator.
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(v.fator, 'perigo', v.nome), v.fator, 'perigo', v.nome, 1, true
  from (values
    ('assedio', 'Assédio de qualquer natureza no trabalho'),
    ('falta_suporte', 'Falta de suporte / apoio no trabalho'),
    ('gestao_mudancas', 'Má gestão de mudanças organizacionais'),
    ('clareza_papel', 'Baixa clareza de papel / função'),
    ('recompensas', 'Baixas recompensas e reconhecimento'),
    ('baixo_controle', 'Baixo controle no trabalho / Falta de autonomia'),
    ('justica_organizacional', 'Baixa justiça organizacional'),
    ('eventos_traumaticos', 'Eventos violentos ou traumáticos'),
    ('subcarga', 'Baixa demanda no trabalho (Subcarga)'),
    ('sobrecarga', 'Excesso de demandas no trabalho (Sobrecarga)'),
    ('maus_relacionamentos', 'Maus relacionamentos no local de trabalho'),
    ('comunicacao_dificil', 'Trabalho em condições de difícil comunicação'),
    ('trabalho_remoto', 'Trabalho remoto e isolado')
  ) v(fator, nome)
on conflict do nothing;

-- Fontes geradoras (com código), não marcadas por padrão.
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, codigo, ordem, padrao)
select pg_temp.bib_id(b.fator, 'fonte', f->>'texto'), b.fator, 'fonte', f->>'texto', f->>'codigo', o::int, false
  from public.psi_biblioteca_fatores b, jsonb_array_elements(b.fontes_geradoras) with ordinality as x(f, o)
 where coalesce(trim(f->>'texto'), '') <> ''
on conflict do nothing;

-- Descrição do risco e danos à saúde: o texto atual, marcado por padrão.
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(fator, 'descricao', descricao_risco), fator, 'descricao', descricao_risco, 1, true
  from public.psi_biblioteca_fatores where trim(descricao_risco) <> ''
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(fator, 'danos', danos_saude), fator, 'danos', danos_saude, 1, true
  from public.psi_biblioteca_fatores where trim(danos_saude) <> ''
on conflict do nothing;

-- Medidas de controle: as "a verificar em campo", uma por item, NÃO marcadas
-- (medida existente é o que se constata em campo).
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(b.fator, 'medida', m.t), b.fator, 'medida', m.t, m.o::int, false
  from public.psi_biblioteca_fatores b,
       lateral (
         select initcap(left(trim(x), 1)) || substr(trim(trailing '.' from trim(x)), 2) as t, o
           from unnest(string_to_array(regexp_replace(b.medidas_controle_verificar, '^\s*A verificar em campo:\s*', '', 'i'), ';'))
                with ordinality as u(x, o)
          where trim(x) <> ''
       ) m
on conflict do nothing;

-- Sugestões iniciais e ações: marcadas por padrão (era o comportamento).
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(b.fator, 'sugestao', s), b.fator, 'sugestao', s, o::int, true
  from public.psi_biblioteca_fatores b, jsonb_array_elements_text(b.sugestoes_iniciais) with ordinality as x(s, o)
 where trim(s) <> ''
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(b.fator, 'acao', s), b.fator, 'acao', s, o::int, true
  from public.psi_biblioteca_fatores b, jsonb_array_elements_text(b.acoes) with ordinality as x(s, o)
 where trim(s) <> ''
on conflict do nothing;

-- Listas comuns: meio de propagação, situação e tempo de exposição (fator null).
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(null, 'meio', v), null, 'meio', v, row_number() over (order by v)::int, false
  from (select distinct trim(meio_propagacao) v from public.psi_biblioteca_fatores where trim(meio_propagacao) <> '') d
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(null, 'situacao', v), null, 'situacao', v, row_number() over (order by v)::int, false
  from (select distinct trim(situacao_padrao) v from public.psi_biblioteca_fatores where trim(situacao_padrao) <> '') d
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(null, 'tempo', v), null, 'tempo', v, row_number() over (order by v)::int, false
  from (select distinct trim(tempo_exposicao_padrao) v from public.psi_biblioteca_fatores where trim(tempo_exposicao_padrao) <> '') d
on conflict do nothing;
```

Rollback: `drop table if exists public.psi_biblioteca_itens;` (⚠️ apaga as opções incluídas depois).

### v277 — tópico "medidas de controle recomendadas"

```sql
-- v277 (2026-10-06): novo tópico "Medidas de controle recomendadas"
-- (topico 'medida_recomendada') na biblioteca psicossocial, separado das
-- medidas EXISTENTES ('medida'). Seed: as mesmas medidas de referência de cada
-- fator, não marcadas — o técnico marca em "existentes" o que constatou e em
-- "recomendadas" o que falta implantar.
-- Já aplicada via MCP. Rollback: scripts/sql/v277_rollback_biblioteca_medida_recomendada.sql
alter table public.psi_biblioteca_itens drop constraint if exists psi_biblioteca_itens_topico_check;
alter table public.psi_biblioteca_itens add constraint psi_biblioteca_itens_topico_check check (topico in
  ('perigo','fonte','evidencia','descricao','danos','medida','medida_recomendada','sugestao','acao','meio','situacao','tempo'));

insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select 'BIB-' || upper(substr(md5(coalesce(fator, '*') || '|medida_recomendada|' || lower(trim(texto))), 1, 8)),
       fator, 'medida_recomendada', texto, ordem, false
  from public.psi_biblioteca_itens
 where topico = 'medida' and status = 'ativo'
on conflict do nothing;
```

Rollback:

```sql
-- Rollback da v277: remove as opções de medida recomendada e o tópico.
delete from public.psi_biblioteca_itens where topico = 'medida_recomendada';
alter table public.psi_biblioteca_itens drop constraint if exists psi_biblioteca_itens_topico_check;
alter table public.psi_biblioteca_itens add constraint psi_biblioteca_itens_topico_check check (topico in
  ('perigo','fonte','evidencia','descricao','danos','medida','sugestao','acao','meio','situacao','tempo'));
```

## Passo 3: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `lib/aep/biblioteca.ts` | **substituir**: modelo de opções (tópicos, itens, padrões) |
| B | `lib/aep/inventario.ts` | **substituir**: seleção por tópico, medidas recomendadas |
| C | `lib/aep/inventario.test.ts` | **substituir**: testes |
| D | `lib/hooks/useBibliotecaPsi.ts` | **substituir**: leitura + incluir/sugerir/aprovar/editar/excluir/padrão |
| E | `app/(aep)/aep/biblioteca/page.tsx` | **substituir**: página da base de opções |
| F | `lib/supabase/types.ts` | `AepSetor.inventario` |
| G | `lib/hooks/useAep.ts` | normalizador |
| H | `app/api/pdf/aep/[id]/route.ts` | normalizador + biblioteca das 2 tabelas |
| I | `components/pdf/templates/AepTemplate.tsx` | tipo + medidas recomendadas |
| J | `app/(aep)/aep/[idRelatorio]/laudo/page.tsx` | medidas recomendadas |
| K | `components/aep/AepSetoresEditor.tsx` | layout, ordem, negrito, inventário com dropdown múltiplo |

### A: `lib/aep/biblioteca.ts` (substituir, completo)

```ts
/**
 * Biblioteca psicossocial — BASE DE OPÇÕES do inventário de risco
 * (2026-10-06; v272 + v276).
 *
 * Cada tópico do inventário é uma lista de opções selecionáveis
 * (`psi_biblioteca_itens`):
 *   • por fator: perigo, fonte geradora, evidência, descrição do risco, danos
 *     à saúde, medida de controle (existente e recomendada — v277), sugestão
 *     inicial e ação;
 *   • comuns a todos os fatores (fator null): meio de propagação, situação e
 *     tempo de exposição — o padrão de cada fator fica em
 *     `psi_biblioteca_fatores` (meio_propagacao, situacao_padrao,
 *     tempo_exposicao_padrao).
 * `padrao` = a opção já vem marcada no inventário.
 *
 * Quem inclui: o Admin, direto; o técnico SUGERE (status 'pendente') e o
 * Admin aprova ou recusa. Só itens 'ativo' aparecem para seleção.
 *
 * Única para o sistema (sem empresa): a AEP usa hoje, o DRPS/QPS podem usar
 * depois. Módulo PURO: tela, laudo, rota do PDF e inventário usam o mesmo.
 */

export type TopicoBib =
  | "perigo"
  | "fonte"
  | "evidencia"
  | "descricao"
  | "danos"
  | "medida"
  | "medida_recomendada"
  | "sugestao"
  | "acao"
  | "meio"
  | "situacao"
  | "tempo";

export const TOPICOS_COMUNS: TopicoBib[] = ["meio", "situacao", "tempo"];

export const ROTULO_TOPICO: Record<TopicoBib, string> = {
  perigo: "Perigo",
  fonte: "Fontes geradoras",
  evidencia: "Evidências",
  descricao: "Descrição do risco",
  danos: "Danos à saúde",
  medida: "Medidas de controle existentes",
  medida_recomendada: "Medidas de controle recomendadas",
  sugestao: "Sugestões iniciais",
  acao: "Ações",
  meio: "Meio de propagação",
  situacao: "Situação",
  tempo: "Tempo de exposição",
};

/** Ordem dos tópicos por fator na tela da biblioteca. */
export const TOPICOS_DO_FATOR: TopicoBib[] = [
  "perigo",
  "fonte",
  "evidencia",
  "descricao",
  "danos",
  "medida",
  "medida_recomendada",
  "sugestao",
  "acao",
];

export type StatusItem = "ativo" | "pendente" | "recusado";

export interface ItemBiblioteca {
  id_item: string;
  fator: string | null;
  topico: TopicoBib;
  texto: string;
  codigo: string | null;
  ordem: number;
  padrao: boolean;
  status: StatusItem;
  sugerido_por?: string | null;
  sugerido_em?: string | null;
  revisado_por?: string | null;
  revisado_em?: string | null;
}

/** Linha de `psi_biblioteca_fatores`: ordem e padrão de meio/situação/tempo. */
export interface FatorBiblioteca {
  fator: string;
  ordem: number;
  meio_propagacao: string;
  situacao_padrao: string;
  tempo_exposicao_padrao: string;
}

export interface Biblioteca {
  fatores: Record<string, FatorBiblioteca>;
  itens: ItemBiblioteca[];
}

const txt = (v: unknown) => (typeof v === "string" ? v : "");
const TOPICOS = Object.keys(ROTULO_TOPICO) as TopicoBib[];

export function normalizarItem(raw: unknown): ItemBiblioteca | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id_item !== "string" || !TOPICOS.includes(r.topico as TopicoBib) || !txt(r.texto).trim()) return null;
  return {
    id_item: r.id_item,
    fator: typeof r.fator === "string" ? r.fator : null,
    topico: r.topico as TopicoBib,
    texto: txt(r.texto),
    codigo: typeof r.codigo === "string" && r.codigo ? r.codigo : null,
    ordem: typeof r.ordem === "number" ? r.ordem : 0,
    padrao: r.padrao === true,
    status: r.status === "pendente" || r.status === "recusado" ? r.status : "ativo",
    sugerido_por: typeof r.sugerido_por === "string" ? r.sugerido_por : null,
    sugerido_em: typeof r.sugerido_em === "string" ? r.sugerido_em : null,
    revisado_por: typeof r.revisado_por === "string" ? r.revisado_por : null,
    revisado_em: typeof r.revisado_em === "string" ? r.revisado_em : null,
  };
}

export function montarBiblioteca(rowsFatores: unknown[] | null | undefined, rowsItens: unknown[] | null | undefined): Biblioteca {
  const fatores: Record<string, FatorBiblioteca> = {};
  for (const r of rowsFatores ?? []) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.fator !== "string") continue;
    fatores[o.fator] = {
      fator: o.fator,
      ordem: typeof o.ordem === "number" ? o.ordem : 0,
      meio_propagacao: txt(o.meio_propagacao),
      situacao_padrao: txt(o.situacao_padrao),
      tempo_exposicao_padrao: txt(o.tempo_exposicao_padrao),
    };
  }
  const itens = (rowsItens ?? []).map(normalizarItem).filter((x): x is ItemBiblioteca => !!x);
  itens.sort((a, b) => a.ordem - b.ordem || a.texto.localeCompare(b.texto, "pt-BR"));
  return { fatores, itens };
}

const ehComum = (t: TopicoBib) => TOPICOS_COMUNS.includes(t);

/** Opções de um tópico (ativas, por padrão) — comuns ignoram o fator. */
export function itensDe(
  b: Biblioteca | null | undefined,
  fator: string,
  topico: TopicoBib,
  status: StatusItem[] = ["ativo"],
): ItemBiblioteca[] {
  return (b?.itens ?? []).filter(
    (i) => i.topico === topico && status.includes(i.status) && (ehComum(topico) ? i.fator === null : i.fator === fator),
  );
}

/** Texto padrão do fator para meio/situação/tempo (em psi_biblioteca_fatores). */
export function padraoComum(b: Biblioteca | null | undefined, fator: string, topico: TopicoBib): string {
  const f = b?.fatores?.[fator];
  if (!f) return "";
  return topico === "meio" ? f.meio_propagacao : topico === "situacao" ? f.situacao_padrao : topico === "tempo" ? f.tempo_exposicao_padrao : "";
}

/** Ids marcados por padrão num tópico do fator. */
export function idsPadrao(b: Biblioteca | null | undefined, fator: string, topico: TopicoBib): string[] {
  const opcoes = itensDe(b, fator, topico);
  if (ehComum(topico)) {
    const alvo = padraoComum(b, fator, topico).trim().toLowerCase();
    return opcoes.filter((i) => i.texto.trim().toLowerCase() === alvo).map((i) => i.id_item);
  }
  return opcoes.filter((i) => i.padrao).map((i) => i.id_item);
}

/** "1.3 — texto" quando a opção tem código (fontes geradoras). */
export const rotuloItem = (i: Pick<ItemBiblioteca, "codigo" | "texto">) => (i.codigo ? `${i.codigo} — ${i.texto}` : i.texto);

/** Já existe opção (qualquer status) com o mesmo texto no tópico? */
export function existeNaBiblioteca(b: Biblioteca | null | undefined, fator: string, topico: TopicoBib, texto: string) {
  const t = texto.trim().toLowerCase();
  return itensDe(b, fator, topico, ["ativo", "pendente", "recusado"]).find((i) => i.texto.trim().toLowerCase() === t) ?? null;
}
```

### B: `lib/aep/inventario.ts` (substituir, completo)

```ts
/**
 * Detalhe de cada fator organizacional "Sim" e o INVENTÁRIO PSICOSSOCIAL da
 * AEP (2026-10-06). Uma linha por setor × fator "Sim", nas colunas do plano —
 * para lançamento no SGG (XLSX e CSV).
 *
 * Cada tópico sai da BIBLIOTECA (lib/aep/biblioteca.ts — base de opções) mais
 * o que é próprio da AEP:
 *   • fontes geradoras  = lacunas do checklist de gestão + opções marcadas;
 *   • evidências        = sinais do catálogo (contam na matriz) + opções de
 *                         evidência marcadas (NÃO contam na matriz);
 *   • medidas de controle existentes = itens evidenciados do checklist de
 *                         gestão + opções marcadas;
 *   • medidas de controle recomendadas (v277) = opções marcadas;
 *   • os demais tópicos = opções marcadas.
 * Mais os itens MANUAIS do técnico em cada tópico.
 *
 * Seleção por fator, no setor (`setor.inventario[fator]`):
 *   sel[tópico]   = ids das opções marcadas (ausente = as marcadas por padrão)
 *   extra[tópico] = textos manuais
 * Matriz AIHA, origem da evidência e confiança vêm de fora (não se editam
 * aqui). Módulo PURO: tela, laudo, PDF e IA usam o mesmo.
 */

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import { idsPadrao, itensDe, rotuloItem, type Biblioteca, type TopicoBib } from "@/lib/aep/biblioteca";
import {
  SEM_MEDIDAS,
  lacunasDoFator,
  medidasExistentesDoFator,
  rotuloLacuna,
  type ChecklistGestao,
} from "@/lib/aep/checklist-gestao";
import { confiancaDoFator, origensEfetivas, rotuloOrigem, type Confianca } from "@/lib/aep/evidencia";
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/** Seleção do inventário de UM fator num setor. */
export interface InventarioFator {
  /** Ids das opções da biblioteca marcadas; tópico ausente = padrão. */
  sel?: Partial<Record<TopicoBib, string[]>>;
  /** Itens manuais por tópico. */
  extra?: Partial<Record<TopicoBib, string[]>>;
}

const listaLimpa = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()))] : null;

/** `{fator: InventarioFator}` limpo (jsonb pode trazer lixo). */
export function normalizarInventario(raw: unknown): Record<string, InventarioFator> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, InventarioFator> = {};
  for (const [fator, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const f: InventarioFator = {};
    for (const campo of ["sel", "extra"] as const) {
      const m = o[campo];
      if (typeof m !== "object" || m === null) continue;
      const limpo: Partial<Record<TopicoBib, string[]>> = {};
      for (const [t, lista] of Object.entries(m as Record<string, unknown>)) {
        const l = listaLimpa(lista);
        if (l) limpo[t as TopicoBib] = l;
      }
      f[campo] = limpo;
    }
    out[fator] = f;
  }
  return out;
}

/** Recorte do setor lido aqui (casa com AepSetor e AepSetorLocal). */
export interface SetorInventario {
  nome_setor?: string | null;
  ghe?: string | null;
  checklist_organizacional?: object | null;
  sinais_organizacional?: Record<string, string[]> | null;
  aiha_organizacional?: Record<string, { probabilidade?: string; severidade?: string; nivel?: string | null } | undefined> | null;
  origem_evidencia?: Record<string, string[]> | null;
  /** Legado (Fase 2): códigos de fonte marcados. Vale quando não há seleção de fontes. */
  fontes_geradoras?: Record<string, string[]> | null;
  inventario?: Record<string, InventarioFator> | null;
}

export interface DetalheFator {
  key: string;
  label: string;
  sinais: string[];
  descricao: string;
  danos: string;
  meio: string;
  situacao: string;
  tempo: string;
  /** Lacunas do checklist de gestão + fontes marcadas + manuais. */
  fontes: string[];
  medidasExistentes: string[];
  /** Medidas de controle recomendadas (v277): opções marcadas + manuais. */
  medidasRecomendadas: string[];
  origens: string[];
  confianca: Confianca | null;
  probabilidade: string;
  severidade: string;
  nivel: string;
  sugestoes: string[];
  acoes: string[];
}

/**
 * Ids marcados no tópico: a seleção do técnico ou o padrão. Só opções que
 * ainda existem e estão ativas (item excluído/recusado some sozinho).
 */
export function idsSelecionados(
  setor: SetorInventario,
  fator: string,
  topico: TopicoBib,
  biblioteca: Biblioteca | null | undefined,
): string[] {
  const opcoes = itensDe(biblioteca, fator, topico);
  const sel = setor.inventario?.[fator]?.sel?.[topico];
  if (sel) return opcoes.filter((i) => sel.includes(i.id_item)).map((i) => i.id_item);
  if (topico === "fonte" && setor.fontes_geradoras?.[fator]?.length) {
    const codigos = setor.fontes_geradoras[fator];
    return opcoes.filter((i) => i.codigo && codigos.includes(i.codigo)).map((i) => i.id_item);
  }
  return idsPadrao(biblioteca, fator, topico);
}

export function detalhesDoSetor(
  setor: SetorInventario,
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): DetalheFator[] {
  const cl = (setor.checklist_organizacional ?? {}) as Record<string, string>;
  return ITENS_ORGANIZACIONAL.filter(({ key }) => cl[key] === "sim").map(({ key, label }) => {
    const lacunas = lacunasDoFator(gestao, key);
    const a = setor.aiha_organizacional?.[key];
    const extra = setor.inventario?.[key]?.extra ?? {};
    const textos = (t: TopicoBib) => {
      const ids = idsSelecionados(setor, key, t, biblioteca);
      const marcadas = itensDe(biblioteca, key, t)
        .filter((i) => ids.includes(i.id_item))
        .map(rotuloItem);
      return [...marcadas, ...(extra[t] ?? [])];
    };
    const perigo = textos("perigo");
    return {
      key,
      label: perigo.length ? perigo.join(" / ") : label,
      sinais: [
        ...rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional ?? undefined),
        ...textos("evidencia"),
      ],
      descricao: textos("descricao").join(" "),
      danos: textos("danos").join("; "),
      meio: textos("meio").join("; "),
      situacao: textos("situacao").join("; "),
      tempo: textos("tempo").join("; "),
      fontes: [...lacunas.map(rotuloLacuna), ...textos("fonte")],
      medidasExistentes: [...medidasExistentesDoFator(gestao, key).map((i) => `${i.codigo} — ${i.label}`), ...textos("medida")],
      medidasRecomendadas: textos("medida_recomendada"),
      origens: origensEfetivas(setor.origem_evidencia?.[key], lacunas.length > 0).map(rotuloOrigem),
      confianca: confiancaDoFator(setor.origem_evidencia?.[key], lacunas.length > 0),
      probabilidade: a?.nivel ? (a.probabilidade ?? "") : "",
      severidade: a?.nivel ? (a.severidade ?? "") : "",
      nivel: a?.nivel ?? "",
      sugestoes: textos("sugestao"),
      acoes: textos("acao"),
    };
  });
}

export const COLUNAS_INVENTARIO = [
  "Setor",
  "GHE",
  "Perigo",
  "Fontes geradoras",
  "Evidências (sinais)",
  "Meio de propagação",
  "Situação",
  "Tempo de exposição",
  "Medidas de controle existentes",
  "Medidas de controle recomendadas",
  "Descrição do risco",
  "Danos à saúde",
  "Probabilidade",
  "Severidade",
  "Nível AIHA",
  "Confiança",
  "Sugestões iniciais",
  "Ações",
] as const;

export function linhasInventario(
  setores: SetorInventario[],
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): string[][] {
  const linhas: string[][] = [];
  for (const s of setores) {
    for (const d of detalhesDoSetor(s, gestao, biblioteca)) {
      linhas.push([
        s.nome_setor || "Setor sem nome",
        s.ghe ?? "",
        d.label,
        d.fontes.join("; "),
        d.sinais.join("; "),
        d.meio,
        d.situacao,
        d.tempo,
        d.medidasExistentes.length ? d.medidasExistentes.join("; ") : SEM_MEDIDAS,
        d.medidasRecomendadas.join("; "),
        d.descricao,
        d.danos,
        d.probabilidade,
        d.severidade,
        d.nivel,
        d.confianca ?? "",
        d.sugestoes.join("; "),
        d.acoes.join("; "),
      ]);
    }
  }
  return linhas;
}

/** CSV com ";" (o Excel em pt-BR abre direto) e BOM para os acentos. */
export function csvInventario(linhas: string[][]): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [COLUNAS_INVENTARIO as readonly string[], ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
}
```

### C: `lib/aep/inventario.test.ts` (substituir, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { COLUNAS_INVENTARIO, csvInventario, detalhesDoSetor, idsSelecionados, linhasInventario, normalizarInventario } from "./inventario";
import { confiancaDoFator, normalizarMapaLista, origensEfetivas } from "./evidencia";
import { ITENS_GESTAO, lacunasDoFator, medidasExistentesDoFator, normalizarChecklistGestao } from "./checklist-gestao";
import { ITENS_ORGANIZACIONAL } from "./checklist-itens";
import { existeNaBiblioteca, idsPadrao, itensDe, montarBiblioteca } from "./biblioteca";

const item = (id: string, fator: string | null, topico: string, texto: string, extra: Record<string, unknown> = {}) => ({
  id_item: id,
  fator,
  topico,
  texto,
  ordem: 0,
  padrao: false,
  status: "ativo",
  ...extra,
});

const BIB = montarBiblioteca(
  [{ fator: "assedio", ordem: 1, meio_propagacao: "Relações interpessoais", situacao_padrao: "Normal", tempo_exposicao_padrao: "Habitual e permanente" }],
  [
    item("P1", "assedio", "perigo", "Assédio de qualquer natureza no trabalho", { padrao: true }),
    item("F1", "assedio", "fonte", "Gestão autoritária", { codigo: "1.4" }),
    item("F2", "assedio", "fonte", "Lideranças sem capacitação", { codigo: "1.5" }),
    item("E1", "assedio", "evidencia", "Relato do cipeiro"),
    item("D1", "assedio", "descricao", "Condutas abusivas", { padrao: true }),
    item("DN1", "assedio", "danos", "Estresse", { padrao: true }),
    item("M1", "assedio", "medida", "Canal de denúncia sigiloso"),
    item("MR1", "assedio", "medida_recomendada", "Canal de denúncia sigiloso"),
    item("S1", "assedio", "sugestao", "Política de prevenção", { padrao: true }),
    item("S2", "assedio", "sugestao", "Pendente", { padrao: true, status: "pendente" }),
    item("A1", "assedio", "acao", "Código de conduta", { padrao: true }),
    item("A2", "assedio", "acao", "Capacitar lideranças", { padrao: true }),
    item("ME1", null, "meio", "Relações interpessoais"),
    item("ME2", null, "meio", "Não Aplicável"),
    item("SI1", null, "situacao", "Normal"),
    item("T1", null, "tempo", "Habitual e permanente"),
    item("X1", "sobrecarga", "acao", "Outro fator", { padrao: true }),
    { id_item: "ruim", topico: "inexistente", texto: "x" },
  ],
);

const GESTAO = normalizarChecklistGestao({
  itens: {
    G01: { resposta: "nao_existe" },
    G02: { resposta: "existe_evidenciado", origem: "documento", evidencia: "Canal X" },
    G03: { resposta: "existe_sem_evidencia" },
    G99: { resposta: "nao_existe" },
  },
});

test("biblioteca: opções por fator, comuns sem fator, só ativas; padrão comum pelo texto do fator", () => {
  assert.deepEqual(itensDe(BIB, "assedio", "sugestao").map((i) => i.id_item), ["S1"]);
  assert.deepEqual(itensDe(BIB, "assedio", "meio").map((i) => i.id_item).sort(), ["ME1", "ME2"]);
  assert.deepEqual(idsPadrao(BIB, "assedio", "meio"), ["ME1"]);
  assert.deepEqual(idsPadrao(BIB, "assedio", "acao"), ["A2", "A1"]); // ordem, depois alfabética
  assert.equal(BIB.itens.some((i) => i.id_item === "ruim"), false);
  assert.equal(existeNaBiblioteca(BIB, "assedio", "sugestao", "  pendente ")?.id_item, "S2");
});

test("confiança: 1 tipo baixa, 2 média, 3+ alta; lacuna de gestão conta como documental", () => {
  assert.equal(confiancaDoFator([], false), null);
  assert.equal(confiancaDoFator(["observacao_direta"], false), "Baixa");
  assert.equal(confiancaDoFator(["observacao_direta"], true), "Média");
  assert.equal(confiancaDoFator(["observacao_direta", "relato_grupo", "documental"], true), "Alta");
  assert.deepEqual(origensEfetivas(["documental", "xx"], true), ["documental"]);
});

test("checklist de gestão: lacunas e medidas por fator; código desconhecido descartado", () => {
  assert.equal(GESTAO.itens?.G99, undefined);
  assert.deepEqual(lacunasDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G01", "G03"]);
  assert.deepEqual(medidasExistentesDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G02"]);
  assert.deepEqual(lacunasDoFator(GESTAO, "sobrecarga"), []);
});

test("todo item de gestão aponta para fatores que existem", () => {
  const chaves = ITENS_ORGANIZACIONAL.map((i) => i.key as string);
  assert.equal(ITENS_GESTAO.length, 26);
  for (const i of ITENS_GESTAO) for (const f of i.fatores) assert.ok(chaves.includes(f), `${i.codigo}:${f}`);
});

test("sem seleção: padrão da biblioteca; fontes legadas (códigos) ainda valem", () => {
  const setor = {
    nome_setor: "Produção",
    ghe: "GHE-1",
    checklist_organizacional: { assedio: "sim", sobrecarga: "nao" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    aiha_organizacional: { assedio: { probabilidade: "Exposição a níveis baixos", severidade: "Irreversíveis", nivel: "Moderado" } },
    origem_evidencia: { assedio: ["observacao_direta"] },
    fontes_geradoras: { assedio: ["1.5"] },
  };
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.label, "Assédio de qualquer natureza no trabalho");
  assert.deepEqual(d.fontes, [
    "G01 — Política de prevenção e enfrentamento ao assédio e demais formas de violência (não existe)",
    "G03 — Procedimento de apuração de denúncias e aplicação de medidas (existe, sem evidência)",
    "1.5 — Lideranças sem capacitação",
  ]);
  assert.equal(d.meio, "Relações interpessoais");
  assert.equal(d.descricao, "Condutas abusivas");
  assert.deepEqual(d.sugestoes, ["Política de prevenção"]);
  assert.deepEqual(d.acoes, ["Capacitar lideranças", "Código de conduta"]);
  assert.deepEqual(d.origens, ["Observação direta", "Documental"]);
  assert.equal(d.confianca, "Média");

  const linhas = linhasInventario([setor], GESTAO, BIB);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].length, COLUNAS_INVENTARIO.length);
  assert.equal(linhas[0][8], "G02 — Canal de denúncia com sigilo e garantia de não retaliação");
  const semMedidas = linhasInventario([setor], normalizarChecklistGestao({}), BIB);
  assert.equal(semMedidas[0][8], "Não evidenciadas medidas de controle específicas");
});

test("com seleção do técnico: opções marcadas + manuais; item que saiu da biblioteca some", () => {
  const setor = {
    checklist_organizacional: { assedio: "sim" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    inventario: normalizarInventario({
      assedio: {
        sel: { meio: ["ME2"], acao: ["A2", "APAGADO"], sugestao: [], evidencia: ["E1"], medida: ["M1"], fonte: ["F1"], medida_recomendada: ["MR1"] },
        extra: { acao: ["Ação manual"], perigo: ["Assédio moral pela supervisão"], fonte: ["Fonte manual"], lixo: 3 },
      },
    }),
  };
  assert.deepEqual(idsSelecionados(setor, "assedio", "acao", BIB), ["A2"]);
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.label, "Assédio de qualquer natureza no trabalho / Assédio moral pela supervisão");
  assert.equal(d.meio, "Não Aplicável");
  assert.deepEqual(d.acoes, ["Capacitar lideranças", "Ação manual"]);
  assert.deepEqual(d.sugestoes, []);
  assert.deepEqual(d.sinais, ["Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras", "Relato do cipeiro"]);
  assert.ok(d.fontes.includes("1.4 — Gestão autoritária") && d.fontes.includes("Fonte manual"));
  assert.deepEqual(d.medidasExistentes, ["G02 — Canal de denúncia com sigilo e garantia de não retaliação", "Canal de denúncia sigiloso"]);
  assert.deepEqual(d.medidasRecomendadas, ["Canal de denúncia sigiloso"]);
});

test("CSV com ponto e vírgula, BOM e aspas quando preciso", () => {
  const csv = csvInventario([["A;B", 'diz "oi"', "ok", ...Array(COLUNAS_INVENTARIO.length - 3).fill("")]]);
  assert.ok(csv.startsWith("﻿Setor;GHE;Perigo"));
  assert.ok(csv.includes('"A;B";"diz ""oi""";ok'));
});

test("normalizarMapaLista tira duplicados e lixo", () => {
  assert.deepEqual(normalizarMapaLista({ a: ["x", "x", 3], b: "y" }), { a: ["x"] });
});
```

### D: `lib/hooks/useBibliotecaPsi.ts` (substituir, completo)

```ts
"use client";

// Biblioteca psicossocial — base de opções do inventário (v272 + v276).
// Todos leem; o Admin inclui/edita/exclui direto; o técnico SUGERE (item
// 'pendente') e o Admin aprova ou recusa. Ver lib/aep/biblioteca.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { mensagemErro } from "@/lib/errors";
import { montarBiblioteca, type ItemBiblioteca, type TopicoBib } from "@/lib/aep/biblioteca";

const KEY = ["psi-biblioteca"] as const;

// As tabelas da v272/v276 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createSupabaseBrowserClient() as any;

const novoId = () =>
  `BIB-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

export function useBibliotecaPsi() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [f, i] = await Promise.all([
        db().from("psi_biblioteca_fatores").select("fator, ordem, meio_propagacao, situacao_padrao, tempo_exposicao_padrao"),
        db().from("psi_biblioteca_itens").select("*"),
      ]);
      if (f.error) throw f.error;
      if (i.error) throw i.error;
      return montarBiblioteca(f.data as unknown[], i.data as unknown[]);
    },
  });
}

/**
 * Inclui uma opção. Admin: entra ativa. Demais: entra como SUGESTÃO
 * (pendente), para o Admin aprovar. Devolve o item criado.
 */
export function useIncluirItemBiblioteca() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  const admin = user?.perfil === "Admin";
  return useMutation({
    mutationFn: async (a: { fator: string | null; topico: TopicoBib; texto: string; codigo?: string | null; padrao?: boolean }) => {
      const quem = user?.nome ?? user?.email ?? null;
      const agora = new Date().toISOString();
      const linha = {
        id_item: novoId(),
        fator: a.fator,
        topico: a.topico,
        texto: a.texto.trim(),
        codigo: a.codigo ?? null,
        ordem: 999,
        padrao: admin ? !!a.padrao : false,
        status: admin ? "ativo" : "pendente",
        sugerido_por: quem,
        sugerido_em: agora,
        ...(admin ? { revisado_por: quem, revisado_em: agora } : {}),
      };
      const { data, error } = await db().from("psi_biblioteca_itens").insert(linha).select("*").single();
      if (error) {
        if (String(error.code) === "23505") throw new Error("Essa opção já existe na biblioteca (ou já foi sugerida).");
        throw error;
      }
      return data as ItemBiblioteca;
    },
    onSuccess: (it) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(it.status === "pendente" ? "Sugestão enviada — aguarda aprovação do Admin" : "Incluído na biblioteca");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao incluir na biblioteca")),
  });
}

/** Admin: altera texto, código, padrão, ordem ou status (aprovar/recusar). */
export function useAtualizarItemBiblioteca() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (a: { id: string; patch: Partial<Pick<ItemBiblioteca, "texto" | "codigo" | "padrao" | "ordem" | "status">> }) => {
      const patch: Record<string, unknown> = { ...a.patch };
      if (a.patch.status) {
        patch.revisado_por = user?.nome ?? user?.email ?? null;
        patch.revisado_em = new Date().toISOString();
      }
      const { data, error } = await db().from("psi_biblioteca_itens").update(patch).eq("id_item", a.id).select("id_item");
      if (error) {
        if (String(error.code) === "23505") throw new Error("Já existe outra opção com esse texto.");
        throw error;
      }
      // RLS barra sem erro (0 linhas) quem não é Admin.
      if (!data?.length) throw new Error("Só o perfil Admin pode alterar a biblioteca.");
      return a.patch.status;
    },
    onSuccess: (status) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (status === "ativo") toast.success("Sugestão aprovada");
      else if (status === "recusado") toast.success("Sugestão recusada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao alterar a biblioteca")),
  });
}

/** Admin: exclui a opção (quem já marcou perde a marcação dela). */
export function useExcluirItemBiblioteca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db().from("psi_biblioteca_itens").delete().eq("id_item", id).select("id_item");
      if (error) throw error;
      if (!data?.length) throw new Error("Só o perfil Admin pode excluir da biblioteca.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Opção excluída");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao excluir")),
  });
}

/** Admin: padrão do fator para meio de propagação / situação / tempo de exposição. */
export function useDefinirPadraoComum() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (a: { fator: string; topico: "meio" | "situacao" | "tempo"; texto: string }) => {
      const coluna = a.topico === "meio" ? "meio_propagacao" : a.topico === "situacao" ? "situacao_padrao" : "tempo_exposicao_padrao";
      const { data, error } = await db()
        .from("psi_biblioteca_fatores")
        .update({ [coluna]: a.texto, atualizado_em: new Date().toISOString(), atualizado_por: user?.nome ?? user?.email ?? null })
        .eq("fator", a.fator)
        .select("fator");
      if (error) throw error;
      if (!data?.length) throw new Error("Só o perfil Admin pode alterar a biblioteca.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao definir o padrão")),
  });
}
```

### E: `app/(aep)/aep/biblioteca/page.tsx` (substituir, completo)

```tsx
"use client";

// Biblioteca psicossocial — BASE DE OPÇÕES do inventário de risco (v276).
// Cada tópico de cada fator é uma lista de opções; meio de propagação,
// situação e tempo de exposição são listas comuns a todos os fatores, com um
// padrão por fator. Admin inclui/edita/exclui e aprova sugestões; os demais
// SUGEREM (ficam pendentes). "Padrão" = a opção já vem marcada no inventário.
// Lida pelo editor da AEP, laudo, PDF, planilha e IA (lib/aep/biblioteca.ts).

import { useMemo, useState } from "react";
import { BookMarked, Check, ChevronDown, Inbox, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  useAtualizarItemBiblioteca,
  useBibliotecaPsi,
  useDefinirPadraoComum,
  useExcluirItemBiblioteca,
  useIncluirItemBiblioteca,
} from "@/lib/hooks/useBibliotecaPsi";
import { useIsAdmin, useCanEdit } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import {
  ROTULO_TOPICO,
  TOPICOS_COMUNS,
  TOPICOS_DO_FATOR,
  itensDe,
  padraoComum,
  type Biblioteca,
  type ItemBiblioteca,
  type TopicoBib,
} from "@/lib/aep/biblioteca";
import { cn, fmtData } from "@/lib/utils";

const rotuloFator = (k: string | null) => (k ? ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k : "Comum a todos");

/** Uma opção: texto (e código) editáveis pelo Admin, padrão e excluir. */
function LinhaItem({ item, isAdmin, mostrarPadrao }: { item: ItemBiblioteca; isAdmin: boolean; mostrarPadrao: boolean }) {
  const atualizar = useAtualizarItemBiblioteca();
  const excluir = useExcluirItemBiblioteca();
  const [texto, setTexto] = useState(item.texto);
  const [codigo, setCodigo] = useState(item.codigo ?? "");
  const salvarTexto = () => {
    const t = texto.trim();
    if (!t || t === item.texto) return setTexto(item.texto);
    atualizar.mutate({ id: item.id_item, patch: { texto: t } }, { onError: () => setTexto(item.texto) });
  };
  return (
    <div className="flex items-start gap-2 py-1">
      {item.topico === "fonte" &&
        (isAdmin ? (
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onBlur={() => codigo.trim() !== (item.codigo ?? "") && atualizar.mutate({ id: item.id_item, patch: { codigo: codigo.trim() || null } })}
            placeholder="cód."
            className="w-14 shrink-0 rounded border border-gray-200 px-1.5 py-1 font-mono text-[11px]"
          />
        ) : (
          <span className="w-14 shrink-0 pt-1 font-mono text-[11px] text-gray-500">{item.codigo}</span>
        ))}
      {isAdmin ? (
        <textarea
          rows={item.texto.length > 110 ? 3 : 1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvarTexto}
          className="min-w-0 flex-1 resize-y rounded border border-gray-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
        />
      ) : (
        <p className="min-w-0 flex-1 py-1 text-sm text-gray-800">{item.texto}</p>
      )}
      {mostrarPadrao && (
        <label className={cn("flex shrink-0 items-center gap-1 pt-1.5 text-[11px] text-gray-600", isAdmin && "cursor-pointer")} title="Já vem marcada no inventário">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={item.padrao}
            onChange={(e) => atualizar.mutate({ id: item.id_item, patch: { padrao: e.target.checked } })}
            className="size-3 accent-emerald-600"
          />
          padrão
        </label>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => window.confirm(`Excluir "${item.texto.slice(0, 80)}"? Quem já marcou esta opção perde a marcação.`) && excluir.mutate(item.id_item)}
          className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Excluir"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Lista de um tópico + campo para incluir (Admin) ou sugerir (técnico). */
function ListaTopico({
  b,
  fator,
  topico,
  isAdmin,
  podeSugerir,
}: {
  b: Biblioteca;
  fator: string | null;
  topico: TopicoBib;
  isAdmin: boolean;
  podeSugerir: boolean;
}) {
  const incluir = useIncluirItemBiblioteca();
  const [novo, setNovo] = useState("");
  const comum = TOPICOS_COMUNS.includes(topico);
  const itens = itensDe(b, fator ?? "", topico);
  const enviar = () => {
    const t = novo.trim();
    if (!t) return;
    incluir.mutate({ fator: comum ? null : fator, topico, texto: t, padrao: false }, { onSuccess: () => setNovo("") });
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
        {ROTULO_TOPICO[topico]} <span className="font-normal normal-case text-gray-400">({itens.length})</span>
      </p>
      <div className="divide-y divide-gray-100">
        {itens.map((i) => (
          <LinhaItem key={i.id_item} item={i} isAdmin={isAdmin} mostrarPadrao={!comum} />
        ))}
        {itens.length === 0 && <p className="py-1 text-sm text-gray-400">Nenhuma opção ainda.</p>}
      </div>
      {(isAdmin || podeSugerir) && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), enviar())}
            placeholder={isAdmin ? `Incluir em ${ROTULO_TOPICO[topico].toLowerCase()}…` : `Sugerir opção de ${ROTULO_TOPICO[topico].toLowerCase()}…`}
            className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={incluir.isPending || !novo.trim()}
            onClick={enviar}
            className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {incluir.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {isAdmin ? "Incluir" : "Sugerir"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Padrão de meio/situação/tempo por fator (Admin escolhe na lista comum). */
function PadroesComuns({ b, isAdmin }: { b: Biblioteca; isAdmin: boolean }) {
  const definir = useDefinirPadraoComum();
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs text-gray-600">
            <th className="px-3 py-2">Fator</th>
            {TOPICOS_COMUNS.map((t) => (
              <th key={t} className="px-3 py-2">
                {ROTULO_TOPICO[t]} (padrão)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ITENS_ORGANIZACIONAL.map(({ key, label }) => (
            <tr key={key} className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-gray-800">{label}</td>
              {TOPICOS_COMUNS.map((t) => {
                const atual = padraoComum(b, key, t);
                const opcoes = itensDe(b, key, t);
                return (
                  <td key={t} className="px-3 py-1.5">
                    {isAdmin ? (
                      <select
                        value={atual}
                        onChange={(e) => definir.mutate({ fator: key, topico: t as "meio" | "situacao" | "tempo", texto: e.target.value })}
                        className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                      >
                        {!opcoes.some((o) => o.texto === atual) && <option value={atual}>{atual || "—"}</option>}
                        {opcoes.map((o) => (
                          <option key={o.id_item} value={o.texto}>
                            {o.texto}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-600">{atual || "—"}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fila de sugestões: Admin aprova/recusa; técnico vê as próprias. */
function Sugestoes({ b, isAdmin }: { b: Biblioteca; isAdmin: boolean }) {
  const atualizar = useAtualizarItemBiblioteca();
  const user = useUserStore((s) => s.user);
  const quem = user?.nome ?? user?.email ?? "";
  const lista = isAdmin
    ? b.itens.filter((i) => i.status === "pendente")
    : b.itens.filter((i) => i.sugerido_por === quem && i.status !== "ativo");
  if (lista.length === 0 && !isAdmin) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <Inbox className="size-4" />
        {isAdmin ? `Sugestões pendentes (${lista.length})` : "Suas sugestões"}
      </p>
      {lista.length === 0 && <p className="text-sm text-amber-800">Nenhuma sugestão aguardando aprovação.</p>}
      <div className="space-y-1.5">
        {lista.map((i) => (
          <div key={i.id_item} className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-gray-900">{i.texto}</p>
              <p className="text-[11px] text-gray-500">
                {rotuloFator(i.fator)} · {ROTULO_TOPICO[i.topico]}
                {i.sugerido_por && ` · sugerido por ${i.sugerido_por}`}
                {i.sugerido_em && ` em ${fmtData(i.sugerido_em)}`}
              </p>
            </div>
            {isAdmin ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={atualizar.isPending}
                  onClick={() => atualizar.mutate({ id: i.id_item, patch: { status: "ativo" } })}
                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Check className="size-3.5" /> Aprovar
                </button>
                <button
                  type="button"
                  disabled={atualizar.isPending}
                  onClick={() => atualizar.mutate({ id: i.id_item, patch: { status: "recusado" } })}
                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <X className="size-3.5" /> Recusar
                </button>
              </div>
            ) : (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", i.status === "pendente" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600")}>
                {i.status === "pendente" ? "aguardando" : "recusada"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BibliotecaPsiPage() {
  const { data: b, isLoading } = useBibliotecaPsi();
  const isAdmin = useIsAdmin();
  const podeSugerir = useCanEdit();
  const [aberto, setAberto] = useState<string | null>(null);
  const totais = useMemo(() => {
    const ativos = b?.itens.filter((i) => i.status === "ativo") ?? [];
    return { ativos: ativos.length, pendentes: b?.itens.filter((i) => i.status === "pendente").length ?? 0 };
  }, [b]);

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BookMarked className="size-5 text-emerald-600" /> Biblioteca psicossocial
        </h1>
        <p className="mt-1 max-w-4xl text-sm text-gray-500">
          Base de opções do inventário de risco da AEP: em cada tópico de cada fator, o técnico marca as opções daqui e
          inclui o que faltar. <strong>Padrão</strong> = a opção já vem marcada. Meio de propagação, situação e tempo de
          exposição são listas comuns, com um padrão por fator.{" "}
          {isAdmin
            ? "Como Admin, você inclui, edita e exclui direto e aprova as sugestões dos técnicos."
            : "Você pode sugerir opções; elas entram depois que um Admin aprovar."}
        </p>
        {b && (
          <p className="mt-1 text-xs text-gray-400">
            {totais.ativos} opções ativas{totais.pendentes > 0 && ` · ${totais.pendentes} sugestão(ões) pendente(s)`}
          </p>
        )}
      </div>

      {isLoading && <div className="h-40 animate-pulse rounded-xl bg-gray-100" />}

      {b && (
        <>
          <Sugestoes b={b} isAdmin={isAdmin} />

          {[
            {
              id: "__comuns",
              titulo: "Listas comuns a todos os fatores",
              sub: "Meio de propagação, situação e tempo de exposição — e o padrão de cada fator",
              corpo: (
                <div className="space-y-3">
                  <div className="space-y-3">
                    {TOPICOS_COMUNS.map((t) => (
                      <ListaTopico key={t} b={b} fator={null} topico={t} isAdmin={isAdmin} podeSugerir={podeSugerir} />
                    ))}
                  </div>
                  <PadroesComuns b={b} isAdmin={isAdmin} />
                </div>
              ),
            },
            ...ITENS_ORGANIZACIONAL.map(({ key, label }, idx) => ({
              id: key,
              titulo: `${idx + 1}. ${label}`,
              sub: TOPICOS_DO_FATOR.map((t) => `${itensDe(b, key, t).length} ${ROTULO_TOPICO[t].toLowerCase()}`).join(" · "),
              corpo: (
                <div className="space-y-3">
                  {TOPICOS_DO_FATOR.map((t) => (
                    <ListaTopico key={t} b={b} fator={key} topico={t} isAdmin={isAdmin} podeSugerir={podeSugerir} />
                  ))}
                </div>
              ),
            })),
          ].map((sec) => {
            const open = aberto === sec.id;
            return (
              <div key={sec.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setAberto(open ? null : sec.id)}
                  className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{sec.titulo}</p>
                    <p className="truncate text-xs text-gray-500">{sec.sub}</p>
                  </div>
                  <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition", open && "rotate-180")} />
                </button>
                {open && <div className="border-t border-gray-100 p-4">{sec.corpo}</div>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
```

### F: diff de `lib/supabase/types.ts`

```diff
@@ -2466,6 +2466,8 @@ export interface AepSetor {
   origem_evidencia?: Record<string, string[]>;
   /** Fontes geradoras da biblioteca marcadas por fator (códigos, ex. "1.3"). */
   fontes_geradoras?: Record<string, string[]>;
+  /** Ajustes do inventário de risco por fator (2026-10-06). Ver lib/aep/inventario.ts. */
+  inventario?: Record<string, import("@/lib/aep/inventario").InventarioFator>;
   parecer_tecnico: string;
   recomendacoes: string;
   necessita_aet: boolean;
```

### G: diff de `lib/hooks/useAep.ts`

```diff
@@ -4,6 +4,7 @@ import { sinaisValidos } from "@/lib/aep/sinais-organizacional";
 import { normalizarCondicoesColeta, normalizarMotivoNi } from "@/lib/aep/coleta";
 import { normalizarMapaLista } from "@/lib/aep/evidencia";
 import { normalizarChecklistGestao } from "@/lib/aep/checklist-gestao";
+import { normalizarInventario } from "@/lib/aep/inventario";
 import { situacaoQuestionario, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
 import { montarCatalogoSetores } from "@/lib/aep/catalogo-setores";
 import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
@@ -137,6 +138,7 @@ function normalizarSetor(s: unknown): AepSetor {
     // Origem da evidência e fontes geradoras marcadas (2026-10-06).
     origem_evidencia: normalizarMapaLista(setor.origem_evidencia),
     fontes_geradoras: normalizarMapaLista(setor.fontes_geradoras),
+    inventario: normalizarInventario(setor.inventario),
     // ⚠️ Mesmo cuidado dos sinais: campo fora daqui some em toda leitura.
     aiha_organizacional:
       typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
```

### H: diff de `app/api/pdf/aep/[id]/route.ts`

```diff
@@ -3,6 +3,7 @@ import { normalizarCondicoesColeta, normalizarMotivoNi } from "@/lib/aep/coleta"
 import { normalizarMapaLista } from "@/lib/aep/evidencia";
 import { normalizarChecklistGestao } from "@/lib/aep/checklist-gestao";
 import { montarBiblioteca } from "@/lib/aep/biblioteca";
+import { normalizarInventario } from "@/lib/aep/inventario";
 import { cookies } from "next/headers";
 import { createSupabaseServerClient } from "@/lib/supabase/client";
 import type { AepRelatorioLocal, AepSetorLocal } from "@/components/pdf/templates/AepTemplate";
@@ -113,6 +114,7 @@ function normalizarSetor(s: unknown): AepSetorLocal {
     condicoes_coleta: normalizarCondicoesColeta(setor.condicoes_coleta),
     origem_evidencia: normalizarMapaLista(setor.origem_evidencia),
     fontes_geradoras: normalizarMapaLista(setor.fontes_geradoras),
+    inventario: normalizarInventario(setor.inventario),
     // Matriz AIHA dos fatores organizacionais (2026-10-02) — mesmo cuidado dos sinais.
     aiha_organizacional:
       typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
@@ -188,8 +190,12 @@ export async function GET(
   }
 
   // Biblioteca psicossocial (v272): descrição, danos e fontes dos fatores "Sim".
-  const { data: rawBib } = await supabase.from("psi_biblioteca_fatores").select("*");
-  const biblioteca = montarBiblioteca((rawBib ?? []) as unknown[]);
+  // Biblioteca = base de opções (v276): fatores (padrões) + itens.
+  const [{ data: rawBibF }, { data: rawBibI }] = await Promise.all([
+    supabase.from("psi_biblioteca_fatores").select("fator, ordem, meio_propagacao, situacao_padrao, tempo_exposicao_padrao"),
+    supabase.from("psi_biblioteca_itens").select("*"),
+  ]);
+  const biblioteca = montarBiblioteca((rawBibF ?? []) as unknown[], (rawBibI ?? []) as unknown[]);
 
   // Busca capítulos editáveis (textos_padrao modulo=aep, ativos, ordenados)
   const { data: caps, error: capsError } = await supabase
```

### I: diff de `components/pdf/templates/AepTemplate.tsx`

```diff
@@ -15,7 +15,7 @@ import { classeQuebraFixoNova, numerarCapitulos, numLabel } from "@/components/p
 // Módulo puro (sem "use client", sem hook) — pode entrar no template do Puppeteer.
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
 import { fraseCondicoesColeta, limitacoesDaAvaliacao, type CondicoesColeta, type MotivoNiFator } from "@/lib/aep/coleta";
-import { detalhesDoSetor } from "@/lib/aep/inventario";
+import { detalhesDoSetor, type InventarioFator } from "@/lib/aep/inventario";
 import { COR_CONFIANCA } from "@/lib/aep/evidencia";
 import type { ChecklistGestao } from "@/lib/aep/checklist-gestao";
 import type { Biblioteca } from "@/lib/aep/biblioteca";
@@ -101,6 +101,7 @@ export interface AepSetorLocal {
   condicoes_coleta?: CondicoesColeta;
   origem_evidencia?: Record<string, string[]>;
   fontes_geradoras?: Record<string, string[]>;
+  inventario?: Record<string, InventarioFator>;
   cargos?: { id: string; cargo: string; descricao: string; quantidade: number }[];
   riscos: AepRisco[];
   checklist_fisica: AepChecklistFisica;
@@ -762,6 +763,11 @@ function SetorBlock({
                   <strong>Medidas de controle existentes:</strong>{" "}
                   {d.medidasExistentes.length ? d.medidasExistentes.join("; ") : "Não evidenciadas medidas de controle específicas"}
                 </p>
+                {d.medidasRecomendadas.length > 0 && (
+                  <p style={{ margin: "2px 0 0" }}>
+                    <strong>Medidas de controle recomendadas:</strong> {d.medidasRecomendadas.join("; ")}
+                  </p>
+                )}
                 {d.origens.length > 0 && <p style={{ margin: "2px 0 0" }}><strong>Origem das evidências:</strong> {d.origens.join(", ")}</p>}
               </div>
             ))}
```

### J: diff de `app/(aep)/aep/[idRelatorio]/laudo/page.tsx`

```diff
@@ -327,6 +327,11 @@ function SetorBlock({
                   <strong>Medidas de controle existentes:</strong>{" "}
                   {d.medidasExistentes.length ? d.medidasExistentes.join("; ") : "Não evidenciadas medidas de controle específicas"}
                 </p>
+                {d.medidasRecomendadas.length > 0 && (
+                  <p>
+                    <strong>Medidas de controle recomendadas:</strong> {d.medidasRecomendadas.join("; ")}
+                  </p>
+                )}
                 {d.origens.length > 0 && <p><strong>Origem das evidências:</strong> {d.origens.join(", ")}</p>}
               </div>
             ))}
```

### K: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -18,9 +18,18 @@ import {
 import { ROTEIRO_CAMPO, type RoteiroFator } from "@/lib/aep/roteiro-campo";
 import { ORIGENS_EVIDENCIA, COR_CONFIANCA, confiancaDoFator } from "@/lib/aep/evidencia";
 import { lacunasDoFator, rotuloLacuna, type ChecklistGestao } from "@/lib/aep/checklist-gestao";
-import type { Biblioteca } from "@/lib/aep/biblioteca";
-import { detalhesDoSetor } from "@/lib/aep/inventario";
-import { useBibliotecaPsi } from "@/lib/hooks/useBibliotecaPsi";
+import { detalhesDoSetor, idsSelecionados, type DetalheFator } from "@/lib/aep/inventario";
+import { medidasExistentesDoFator } from "@/lib/aep/checklist-gestao";
+import {
+  ROTULO_TOPICO,
+  existeNaBiblioteca,
+  itensDe,
+  type Biblioteca,
+  rotuloItem,
+  type TopicoBib,
+} from "@/lib/aep/biblioteca";
+import { useBibliotecaPsi, useIncluirItemBiblioteca } from "@/lib/hooks/useBibliotecaPsi";
+import { useIsAdmin } from "@/lib/hooks/useUsuario";
 import { registrarAuditoria } from "@/lib/auditoria/registrar";
 import { chaveNome, type CargoCatalogo, type SetorCatalogo } from "@/lib/aep/catalogo-setores";
 import SituacaoSinalizacaoAep from "@/components/aep/SituacaoSinalizacaoAep";
@@ -30,15 +39,18 @@ import { useEffect, useRef, useState } from "react";
 import Link from "next/link";
 import {
   AlertTriangle,
+  BookPlus,
   ChevronDown,
   Compass,
   ChevronUp,
+  Check,
   ExternalLink,
   Loader2,
   Plus,
   Save,
   Sparkles,
   Trash2,
+  X,
 } from "lucide-react";
 import {
   useAepRelatorio,
@@ -127,6 +139,7 @@ function Tristate({
   onObservacaoChange,
   disabled,
   children,
+  topo,
 }: {
   label: string;
   value: RespostaChecklistAep;
@@ -138,11 +151,13 @@ function Tristate({
   disabled?: boolean;
   /** Conteúdo extra do item — usado pelos sinais da Ergonomia Organizacional. */
   children?: React.ReactNode;
+  /** Entre o título e a observação (roteiro de campo e origem da evidência). */
+  topo?: React.ReactNode;
 }) {
   return (
     <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
       <div className="flex items-center justify-between gap-2">
-        <span className="text-xs text-gray-700">{label}</span>
+        <span className="text-sm font-bold text-gray-900">{label}</span>
         <div className="flex gap-1 shrink-0">
           {opcoes.map((opt) => (
             <button
@@ -165,6 +180,7 @@ function Tristate({
           ))}
         </div>
       </div>
+      {topo}
       <textarea
         disabled={disabled}
         value={observacao ?? ""}
@@ -412,7 +428,7 @@ function MotivoNiCampo({
 
 function RoteiroDoFator({ roteiro }: { roteiro: RoteiroFator }) {
   return (
-    <details className="group rounded-md border border-teal-100 bg-teal-50/40 px-2 py-1">
+    <details open className="group rounded-md border border-teal-100 bg-teal-50/40 px-2 py-1">
       <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold text-teal-800">
         <Compass className="size-3" /> Roteiro de campo
         <ChevronDown className="size-3 transition group-open:rotate-180" />
@@ -569,24 +585,17 @@ function EvidenciaDoFator({
   fator,
   origens,
   onOrigens,
-  fontes,
-  onFontes,
   gestao,
-  biblioteca,
   disabled,
 }: {
   fator: string;
   origens: string[];
   onOrigens: (v: string[]) => void;
-  fontes: string[];
-  onFontes: (v: string[]) => void;
   gestao: ChecklistGestao | undefined;
-  biblioteca: Biblioteca | undefined;
   disabled?: boolean;
 }) {
   const lacunas = lacunasDoFator(gestao, fator);
   const conf = confiancaDoFator(origens, lacunas.length > 0);
-  const doFator = biblioteca?.[fator]?.fontes_geradoras ?? [];
   const alternar = (lista: string[], k: string) => (lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]);
   return (
     <div className="rounded-md border border-sky-200 bg-sky-50/50 p-2 space-y-2">
@@ -626,35 +635,409 @@ function EvidenciaDoFator({
           );
         })}
       </div>
-      {(lacunas.length > 0 || doFator.length > 0) && (
-        <details className="group">
-          <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
-            Fontes geradoras ({lacunas.length + fontes.filter((c) => doFator.some((f) => f.codigo === c)).length})
-            <ChevronDown className="size-3 transition group-open:rotate-180" />
-          </summary>
-          <div className="mt-1 space-y-1 text-[11px] leading-snug text-gray-700">
-            {lacunas.map((l) => (
-              <p key={l.codigo} className="flex items-start gap-1.5">
-                <span className="mt-0.5 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">gestão</span>
-                {rotuloLacuna(l)}
-              </p>
-            ))}
-            {doFator.map((f) => (
-              <label key={f.codigo} className={cn("flex items-start gap-1.5", disabled ? "opacity-60" : "cursor-pointer")}>
-                <input
-                  type="checkbox"
-                  disabled={disabled}
-                  checked={fontes.includes(f.codigo)}
-                  onChange={() => onFontes(alternar(fontes, f.codigo))}
-                  className="mt-0.5 size-3 shrink-0 accent-sky-600"
-                />
-                <span>
-                  <span className="font-mono text-[10px] text-gray-500">{f.codigo}</span> {f.texto}
-                </span>
-              </label>
-            ))}
-          </div>
-        </details>
+    </div>
+  );
+}
+
+// ─── Inventário de risco do fator "Sim" (2026-10-06) ─────────────────────────
+// As mesmas colunas do inventário psicossocial exportado (lib/aep/inventario.ts),
+// só leitura: vêm da biblioteca, do checklist de gestão, dos sinais, da matriz
+// e da origem da evidência. Muda conforme o técnico preenche o resto.
+
+/** Opção do campo de seleção múltipla (biblioteca ou sinal do catálogo). */
+interface OpcaoMulti {
+  id: string;
+  rotulo: string;
+  marcado: boolean;
+  alternar: () => void;
+  /** "sinal" = sinal do catálogo (conta na matriz), em vermelho. */
+  tom?: "sinal";
+}
+
+/**
+ * Campo de seleção múltipla com criação (2026-10-06): as escolhidas ficam
+ * como etiquetas dentro do campo; ao clicar abre a lista para marcar várias;
+ * digitar filtra; texto que não existe vira item MANUAL no mesmo campo
+ * (Enter ou "Incluir"). Itens fixos (checklist de gestão) aparecem como
+ * etiquetas sem remover.
+ */
+function MultiSelectCriavel({
+  opcoes,
+  fixos = [],
+  manuais,
+  onManuais,
+  acaoItem,
+  placeholder,
+  disabled,
+}: {
+  opcoes: OpcaoMulti[];
+  fixos?: { key: string; rotulo: string; cor: "amber" | "emerald" }[];
+  manuais: string[];
+  onManuais: (v: string[]) => void;
+  /** Ação extra por item manual (salvar/sugerir na biblioteca). */
+  acaoItem?: (texto: string) => React.ReactNode;
+  placeholder: string;
+  disabled?: boolean;
+}) {
+  const [aberto, setAberto] = useState(false);
+  const [busca, setBusca] = useState("");
+  const ref = useRef<HTMLDivElement>(null);
+  const inputRef = useRef<HTMLInputElement>(null);
+
+  useEffect(() => {
+    if (!aberto) return;
+    const fora = (e: MouseEvent) => {
+      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
+    };
+    document.addEventListener("mousedown", fora);
+    return () => document.removeEventListener("mousedown", fora);
+  }, [aberto]);
+
+  const q = busca.trim().toLowerCase();
+  const filtradas = q ? opcoes.filter((o) => o.rotulo.toLowerCase().includes(q)) : opcoes;
+  const exata = q ? opcoes.find((o) => o.rotulo.toLowerCase() === q) : undefined;
+  const jaManual = q ? manuais.some((m) => m.trim().toLowerCase() === q) : false;
+  const podeCriar = !!q && !exata && !jaManual;
+
+  const incluir = () => {
+    const t = busca.trim();
+    if (!t) return;
+    if (exata) {
+      if (!exata.marcado) exata.alternar();
+    } else if (!jaManual) {
+      onManuais([...manuais, t]);
+    }
+    setBusca("");
+  };
+
+  const marcadas = opcoes.filter((o) => o.marcado);
+  const vazio = fixos.length === 0 && marcadas.length === 0 && manuais.length === 0;
+
+  return (
+    <div ref={ref} className="relative">
+      <div
+        onClick={() => {
+          if (disabled) return;
+          setAberto(true);
+          inputRef.current?.focus();
+        }}
+        className={cn(
+          "flex min-h-[30px] flex-wrap items-center gap-1 rounded border bg-white px-1.5 py-1",
+          aberto ? "border-emerald-500 ring-1 ring-emerald-200" : "border-gray-200",
+          disabled ? "bg-gray-50" : "cursor-text",
+        )}
+      >
+        {fixos.map((f) => (
+          <span
+            key={f.key}
+            title="Automático do checklist de gestão"
+            className={cn(
+              "inline-flex items-start gap-1 rounded px-1.5 py-0.5 text-[10px]",
+              f.cor === "amber" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900",
+            )}
+          >
+            <span className={cn("rounded px-1 text-[9px] font-semibold", f.cor === "amber" ? "bg-amber-200" : "bg-emerald-200")}>gestão</span>
+            {f.rotulo}
+          </span>
+        ))}
+        {marcadas.map((o) => (
+          <span
+            key={o.id}
+            className={cn(
+              "inline-flex items-start gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
+              o.tom === "sinal" ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
+            )}
+            title={o.tom === "sinal" ? "Sinal do catálogo — conta na matriz" : undefined}
+          >
+            {o.rotulo}
+            {!disabled && (
+              <button
+                type="button"
+                onClick={(e) => {
+                  e.stopPropagation();
+                  o.alternar();
+                }}
+                className="text-gray-400 hover:text-red-500"
+                title="Remover"
+              >
+                <X className="size-3" />
+              </button>
+            )}
+          </span>
+        ))}
+        {manuais.map((m) => (
+          <span key={m} className="inline-flex items-start gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-900 ring-1 ring-violet-200">
+            <span className="rounded bg-violet-200 px-1 text-[9px] font-semibold">manual</span>
+            {m}
+            <span onClick={(e) => e.stopPropagation()}>{acaoItem?.(m)}</span>
+            {!disabled && (
+              <button
+                type="button"
+                onClick={(e) => {
+                  e.stopPropagation();
+                  onManuais(manuais.filter((x) => x !== m));
+                }}
+                className="text-gray-400 hover:text-red-500"
+                title="Remover"
+              >
+                <X className="size-3" />
+              </button>
+            )}
+          </span>
+        ))}
+        {disabled ? (
+          vazio && <span className="text-[10px] text-gray-400">—</span>
+        ) : (
+          <input
+            ref={inputRef}
+            value={busca}
+            onChange={(e) => {
+              setBusca(e.target.value);
+              setAberto(true);
+            }}
+            onFocus={() => setAberto(true)}
+            onKeyDown={(e) => {
+              if (e.key === "Enter") {
+                e.preventDefault();
+                incluir();
+              } else if (e.key === "Escape") {
+                setAberto(false);
+              } else if (e.key === "Backspace" && !busca && manuais.length) {
+                onManuais(manuais.slice(0, -1));
+              }
+            }}
+            placeholder={vazio ? placeholder : "Selecionar ou digitar…"}
+            className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-[11px] focus:outline-none focus:ring-0"
+          />
+        )}
+        {!disabled && <ChevronDown className={cn("ml-auto size-3 shrink-0 text-gray-400 transition", aberto && "rotate-180")} />}
+      </div>
+      {aberto && !disabled && (
+        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
+          {podeCriar && (
+            <button
+              type="button"
+              onClick={incluir}
+              className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
+            >
+              <Plus className="size-3" /> Incluir «{busca.trim()}»
+            </button>
+          )}
+          {filtradas.map((o) => (
+            <button
+              key={o.id}
+              type="button"
+              onClick={() => o.alternar()}
+              className={cn(
+                "flex w-full items-start gap-1.5 px-2 py-1 text-left text-[11px] hover:bg-gray-50",
+                o.marcado && "bg-emerald-50/60",
+              )}
+            >
+              <span
+                className={cn(
+                  "mt-0.5 flex size-3 shrink-0 items-center justify-center rounded-sm border",
+                  o.marcado ? (o.tom === "sinal" ? "border-red-600 bg-red-600 text-white" : "border-emerald-600 bg-emerald-600 text-white") : "border-gray-300",
+                )}
+              >
+                {o.marcado && <Check className="size-2.5" />}
+              </span>
+              <span className="flex-1">
+                {o.rotulo}
+                {o.tom === "sinal" && <span className="ml-1 text-[9px] text-red-700">(sinal — conta na matriz)</span>}
+              </span>
+            </button>
+          ))}
+          {filtradas.length === 0 && !podeCriar && (
+            <p className="px-2 py-1 text-[11px] text-gray-400">{q ? "Já incluído." : "Sem opções na biblioteca — digite para incluir."}</p>
+          )}
+        </div>
+      )}
+    </div>
+  );
+}
+
+/**
+ * Inventário de risco do fator "Sim" (2026-10-06): cada tópico é uma lista de
+ * opções da BIBLIOTECA para marcar, mais itens manuais. Item manual pode ir
+ * para a biblioteca: o Admin salva direto (vira opção marcada); o técnico
+ * SUGERE (fica pendente até o Admin aprovar). A seleção fica em
+ * `setor.inventario[fator]` e segue para laudo, PDF, planilha e IA.
+ */
+function InventarioDoFator({
+  d,
+  fator,
+  biblioteca,
+  marcados,
+  extra,
+  onSel,
+  onExtra,
+  sinaisCatalogo,
+  sinaisMarcados,
+  onSinais,
+  gestao,
+  isAdmin,
+  onIncluirBiblioteca,
+  disabled,
+}: {
+  d: DetalheFator;
+  fator: string;
+  biblioteca: Biblioteca | undefined;
+  /** Ids marcados por tópico (seleção do técnico ou padrão). */
+  marcados: (t: TopicoBib) => string[];
+  extra: Partial<Record<TopicoBib, string[]>>;
+  onSel: (t: TopicoBib, ids: string[]) => void;
+  onExtra: (t: TopicoBib, itens: string[]) => void;
+  sinaisCatalogo: SinalOrganizacional[];
+  sinaisMarcados: string[];
+  onSinais: (keys: string[]) => void;
+  gestao: ChecklistGestao | undefined;
+  isAdmin: boolean;
+  onIncluirBiblioteca: (t: TopicoBib, texto: string) => void;
+  disabled?: boolean;
+}) {
+  const [aberto, setAberto] = useState(true);
+  const lacunas = lacunasDoFator(gestao, fator);
+  const medidasGestao = medidasExistentesDoFator(gestao, fator);
+
+  const acaoBiblioteca = (t: TopicoBib) =>
+    function AcaoBiblioteca(texto: string) {
+    if (disabled) return null;
+    const ja = existeNaBiblioteca(biblioteca, fator, t, texto);
+    if (ja?.status === "pendente") return <span className="text-[9px] font-semibold text-amber-700">sugerido</span>;
+    if (ja?.status === "ativo") return <span className="text-[9px] text-gray-400">já na biblioteca</span>;
+    return (
+      <button
+        type="button"
+        onClick={() => onIncluirBiblioteca(t, texto)}
+        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-700 hover:underline"
+        title={isAdmin ? "Incluir esta opção na biblioteca (fica disponível para todas as AEPs)" : "Sugerir ao Admin incluir esta opção na biblioteca"}
+      >
+        <BookPlus className="size-3" /> {isAdmin ? "salvar na biblioteca" : "sugerir"}
+      </button>
+    );
+    };
+
+  const topico = (
+    t: TopicoBib,
+    placeholder: string,
+    opts: {
+      fixos?: { key: string; rotulo: string; cor: "amber" | "emerald" }[];
+      antes?: OpcaoMulti[];
+      dica?: string;
+      /** Só leitura (evidências: vêm dos sinais marcados acima). */
+      leitura?: boolean;
+    } = {},
+  ) => {
+    const ids = marcados(t);
+    const opcoes: OpcaoMulti[] = [
+      ...(opts.antes ?? []),
+      ...itensDe(biblioteca, fator, t).map((i) => ({
+        id: i.id_item,
+        rotulo: rotuloItem(i),
+        marcado: ids.includes(i.id_item),
+        alternar: () => onSel(t, ids.includes(i.id_item) ? ids.filter((x) => x !== i.id_item) : [...ids, i.id_item]),
+      })),
+    ];
+    return (
+      <>
+        <MultiSelectCriavel
+          opcoes={opcoes}
+          fixos={opts.fixos}
+          manuais={extra[t] ?? []}
+          onManuais={(v) => onExtra(t, v)}
+          acaoItem={acaoBiblioteca(t)}
+          placeholder={placeholder}
+          disabled={disabled || opts.leitura}
+        />
+        {opts.dica && <p className="mt-0.5 text-[10px] text-gray-400">{opts.dica}</p>}
+      </>
+    );
+  };
+
+  const linhas: [string, React.ReactNode][] = [
+    [ROTULO_TOPICO.perigo, topico("perigo", "Selecione ou digite o perigo…")],
+    [
+      ROTULO_TOPICO.fonte,
+      topico("fonte", "Selecione ou digite uma fonte geradora…", {
+        fixos: lacunas.map((l) => ({ key: l.codigo, rotulo: rotuloLacuna(l), cor: "amber" as const })),
+      }),
+    ],
+    [
+      "Evidências (sinais)",
+      topico("evidencia", "Selecione ou digite uma evidência…", {
+        antes: sinaisCatalogo.map((s) => ({
+          id: `sinal:${s.key}`,
+          rotulo: s.label,
+          tom: "sinal" as const,
+          marcado: sinaisMarcados.includes(s.key),
+          alternar: () => onSinais(sinaisMarcados.includes(s.key) ? sinaisMarcados.filter((k) => k !== s.key) : [...sinaisMarcados, s.key]),
+        })),
+        dica: "Preenchido pelos sinais observados marcados acima (em vermelho, contam na matriz). Não se edita aqui.",
+        leitura: true,
+      }),
+    ],
+    [ROTULO_TOPICO.meio, topico("meio", "Selecione ou digite o meio de propagação…")],
+    [ROTULO_TOPICO.situacao, topico("situacao", "Selecione ou digite a situação…")],
+    [ROTULO_TOPICO.tempo, topico("tempo", "Selecione ou digite o tempo de exposição…")],
+    [
+      "Medidas de controle existentes",
+      topico("medida", "Selecione ou digite uma medida existente…", {
+        fixos: medidasGestao.map((m) => ({ key: m.codigo, rotulo: `${m.codigo} — ${m.label}`, cor: "emerald" as const })),
+        dica: "Só as medidas constatadas em campo.",
+      }),
+    ],
+    [
+      ROTULO_TOPICO.medida_recomendada,
+      topico("medida_recomendada", "Selecione ou digite uma medida recomendada…", {
+        dica: "O que a empresa ainda precisa implantar.",
+      }),
+    ],
+    [ROTULO_TOPICO.descricao, topico("descricao", "Selecione ou digite a descrição do risco…")],
+    [ROTULO_TOPICO.danos, topico("danos", "Selecione ou digite um dano à saúde…")],
+    [
+      "Probabilidade × Severidade",
+      <span key="pxs">
+        {d.nivel ? `${d.probabilidade} × ${d.severidade} → ${d.nivel}` : "sem nível (marque os sinais observados)"}
+        <span className="ml-1 text-gray-400">· ajuste na Matriz de risco AIHA acima</span>
+      </span>,
+    ],
+    [
+      "Confiança",
+      <span key="conf">
+        {d.confianca ?? "—"} <span className="text-gray-400">· pela origem da evidência</span>
+      </span>,
+    ],
+    [ROTULO_TOPICO.sugestao, topico("sugestao", "Selecione ou digite uma sugestão…")],
+    [ROTULO_TOPICO.acao, topico("acao", "Selecione ou digite uma ação…")],
+  ];
+  return (
+    <div className="rounded-md border border-gray-300 bg-white">
+      <button
+        type="button"
+        onClick={() => setAberto((v) => !v)}
+        className="flex w-full items-center gap-2 bg-gray-50 px-2 py-1.5 text-left hover:bg-gray-100"
+        aria-expanded={aberto}
+      >
+        <span className="text-xs font-bold uppercase tracking-wide text-gray-900">Inventário de risco</span>
+        <span className="hidden text-[10px] text-gray-400 sm:inline">
+          marque as opções da biblioteca ou inclua; vale para laudo, PDF, planilha e IA
+        </span>
+        <span className="ml-auto inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700">
+          {aberto ? "Recolher" : "Expandir"}
+          <ChevronDown className={cn("size-3 transition", aberto && "rotate-180")} />
+        </span>
+      </button>
+      {aberto && (
+      <table className="w-full border-t border-gray-100 text-[11px] leading-snug text-gray-700">
+        <tbody>
+          {linhas.map(([rotulo, valor]) => (
+            <tr key={rotulo} className="border-b border-gray-100 last:border-0 align-top">
+              <th className="w-52 bg-gray-50 px-2 py-1 text-left font-bold text-gray-900">{rotulo}</th>
+              <td className="space-y-0.5 px-2 py-1">{valor}</td>
+            </tr>
+          ))}
+        </tbody>
+      </table>
       )}
     </div>
   );
@@ -673,6 +1056,7 @@ function ChecklistBloco({
   disabled,
   opcoes,
   legenda,
+  colunasItens = "md:grid-cols-2 xl:grid-cols-3",
   sinais,
   sinaisMarcados,
   onSinaisChange,
@@ -683,6 +1067,7 @@ function ChecklistBloco({
   onMotivoNiChange,
   roteiro,
   extraSim,
+  inventarioSim,
 }: {
   titulo: string;
   cor: string;
@@ -696,6 +1081,8 @@ function ChecklistBloco({
   opcoes?: RespostaChecklistAep[];
   /** Siglas explicadas no pé do bloco, na ordem dada. */
   legenda?: RespostaChecklistAep[];
+  /** Colunas dos itens dentro do bloco (blocos empilhados na largura toda, 2026-10-06). */
+  colunasItens?: string;
   /** Só a Ergonomia Organizacional passa isto; física e cognitiva ignoram. */
   sinais?: Record<string, SinalOrganizacional[]>;
   sinaisMarcados?: Record<string, string[]>;
@@ -710,6 +1097,8 @@ function ChecklistBloco({
   roteiro?: Record<string, RoteiroFator>;
   /** Conteúdo extra do fator marcado "Sim" (origem da evidência, fontes). */
   extraSim?: (fator: string) => React.ReactNode;
+  /** Inventário de risco do fator "Sim" (por último, depois do roteiro). */
+  inventarioSim?: (fator: string) => React.ReactNode;
 }) {
   const positivos = itens.filter((i) => valores[i.key] === "sim").length;
   return (
@@ -722,7 +1111,7 @@ function ChecklistBloco({
           </span>
         )}
       </div>
-      <div className="divide-y divide-gray-100 p-2 space-y-1">
+      <div className={cn("grid items-start gap-2 p-2", colunasItens)}>
         {itens.map(({ key, label }) => {
           const doFator = sinais?.[key];
           return (
@@ -735,6 +1124,14 @@ function ChecklistBloco({
               onChange={(v) => onChange({ [key]: v })}
               onObservacaoChange={(text) => onObservacaoChange(key, text)}
               disabled={disabled}
+              topo={
+                roteiro?.[key] || valores[key] === "sim" ? (
+                  <>
+                    {roteiro?.[key] && <RoteiroDoFator roteiro={roteiro[key]} />}
+                    {valores[key] === "sim" && extraSim?.(key)}
+                  </>
+                ) : undefined
+              }
             >
               {valores[key] === "sim" && doFator && doFator.length > 0 && (
                 <SinaisDoFator
@@ -755,7 +1152,6 @@ function ChecklistBloco({
                   disabled={disabled}
                 />
               )}
-              {valores[key] === "sim" && extraSim?.(key)}
               {valores[key] === "nao_identificado" && onMotivoNiChange && (
                 <MotivoNiCampo
                   valor={motivosNi?.[key]}
@@ -763,7 +1159,7 @@ function ChecklistBloco({
                   disabled={disabled}
                 />
               )}
-              {roteiro?.[key] && <RoteiroDoFator roteiro={roteiro[key]} />}
+              {valores[key] === "sim" && inventarioSim?.(key)}
             </Tristate>
           );
         })}
@@ -814,6 +1210,9 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
   // Biblioteca psicossocial e checklist de gestão (Fase 2, 2026-10-06).
   const { data: biblioteca } = useBibliotecaPsi();
   const gestao = rel?.checklist_gestao;
+  // Inclusão na biblioteca a partir do inventário: Admin salva, técnico sugere.
+  const incluirBiblioteca = useIncluirItemBiblioteca();
+  const isAdmin = useIsAdmin();
   // Setores e cargos que a empresa já tem no sistema (das inspeções) — o
   // editor sugere, e o técnico continua podendo digitar à mão (2026-10-05).
   const { data: catalogo = [] } = useCatalogoSetoresEmpresa(
@@ -1064,7 +1463,8 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
             origens: d.origens,
             confianca: d.confianca,
             sugestoes: d.sugestoes,
-            acoes: d.acoes,
+            // Medidas recomendadas (v277) também valem como ações escolhidas.
+            acoes: [...d.acoes, ...d.medidasRecomendadas],
           })),
         },
       });
@@ -1451,7 +1851,10 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                   <p className="mb-2 text-[11px] text-gray-500">
                     Ao marcar <strong>Sim</strong>, um campo de observação aparece para registrar o que foi observado.
                   </p>
-                  <div className="grid gap-3 lg:grid-cols-3">
+                  {/* Um bloco embaixo do outro, cada um na largura toda, com os
+                      itens em colunas (2026-10-06): lado a lado, a Organizacional
+                      (sinais + matriz) ficava espremida. */}
+                  <div className="space-y-3">
                     <ChecklistBloco
                       titulo="Ergonomia Física"
                       cor="bg-blue-50 text-blue-800"
@@ -1491,11 +1894,13 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                         // E a origem da evidência / fontes de quem deixou de ser Sim.
                         const origens = { ...(setor.origem_evidencia ?? {}) };
                         const fontes = { ...(setor.fontes_geradoras ?? {}) };
+                        const inventario = { ...(setor.inventario ?? {}) };
                         for (const [k, v] of Object.entries(p)) {
                           if (v !== "sim") {
                             delete sinais[k];
                             delete origens[k];
                             delete fontes[k];
+                            delete inventario[k];
                           }
                           if (v !== "nao_identificado") delete motivos[k];
                         }
@@ -1505,6 +1910,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                           motivo_ni: motivos,
                           origem_evidencia: origens,
                           fontes_geradoras: fontes,
+                          inventario,
                         });
                       }}
                       onObservacaoChange={(key, text) =>
@@ -1512,6 +1918,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                       }
                       disabled={!canEdit}
                       opcoes={OPCOES_COM_NI}
+                      colunasItens=""
                       legenda={["nao_aplica", "nao_identificado"]}
                       sinais={SINAIS_ORGANIZACIONAL}
                       sinaisMarcados={setor.sinais_organizacional ?? {}}
@@ -1532,15 +1939,61 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                           onOrigens={(v) =>
                             updateSetor(setor.id, { origem_evidencia: { ...(setor.origem_evidencia ?? {}), [fator]: v } })
                           }
-                          fontes={setor.fontes_geradoras?.[fator] ?? []}
-                          onFontes={(v) =>
-                            updateSetor(setor.id, { fontes_geradoras: { ...(setor.fontes_geradoras ?? {}), [fator]: v } })
-                          }
                           gestao={gestao}
-                          biblioteca={biblioteca}
                           disabled={!canEdit}
                         />
                       )}
+                      inventarioSim={(fator) => {
+                        const d = detalhesDoSetor(setor, gestao, biblioteca).find((x) => x.key === fator);
+                        if (!d) return null;
+                        const inv = setor.inventario?.[fator] ?? {};
+                        const salvarInv = (patch: { sel?: Partial<Record<TopicoBib, string[]>>; extra?: Partial<Record<TopicoBib, string[]>> }) =>
+                          updateSetor(setor.id, {
+                            inventario: {
+                              ...(setor.inventario ?? {}),
+                              [fator]: {
+                                sel: { ...(inv.sel ?? {}), ...(patch.sel ?? {}) },
+                                extra: { ...(inv.extra ?? {}), ...(patch.extra ?? {}) },
+                              },
+                            },
+                          });
+                        return (
+                          <InventarioDoFator
+                            d={d}
+                            fator={fator}
+                            biblioteca={biblioteca}
+                            marcados={(t) => idsSelecionados(setor, fator, t, biblioteca)}
+                            extra={inv.extra ?? {}}
+                            onSel={(t, ids) => salvarInv({ sel: { [t]: ids } })}
+                            onExtra={(t, itens) => salvarInv({ extra: { [t]: itens } })}
+                            sinaisCatalogo={SINAIS_ORGANIZACIONAL[fator as FatorOrganizacional] ?? []}
+                            sinaisMarcados={setor.sinais_organizacional?.[fator] ?? []}
+                            onSinais={(keys) =>
+                              updateSetor(setor.id, {
+                                sinais_organizacional: { ...(setor.sinais_organizacional ?? {}), [fator]: keys },
+                              })
+                            }
+                            gestao={gestao}
+                            isAdmin={isAdmin}
+                            onIncluirBiblioteca={(t, texto) =>
+                              incluirBiblioteca.mutate(
+                                { fator: ["meio", "situacao", "tempo"].includes(t) ? null : fator, topico: t, texto },
+                                {
+                                  // Admin: vira opção marcada e sai dos manuais.
+                                  onSuccess: (item) => {
+                                    if (item.status !== "ativo") return;
+                                    salvarInv({
+                                      sel: { [t]: [...idsSelecionados(setor, fator, t, biblioteca), item.id_item] },
+                                      extra: { [t]: (inv.extra?.[t] ?? []).filter((x) => x !== texto) },
+                                    });
+                                  },
+                                },
+                              )
+                            }
+                            disabled={!canEdit}
+                          />
+                        );
+                      }}
                       matriz={matriz}
                       aiha={setor.aiha_organizacional}
                       onAihaChange={(fator, patch) => {
```

## Passo 4: verificar

1. `npm test`, `npx tsc --noEmit -p .` e `npx next build` sem erros.
2. **Biblioteca (Admin):**
   - em `/aep/biblioteca`, abra um fator: os tópicos aparecem com as opções do seed;
   - edite um texto, marque/desmarque "padrão", inclua e exclua uma opção;
   - nas listas comuns, troque o padrão de meio de propagação de um fator.
3. **Biblioteca (técnico):**
   - sugira uma opção: ela aparece em "Suas sugestões" como "aguardando";
   - como Admin, aprove: ela passa a aparecer para seleção.
4. **Biblioteca:** página na largura toda, tópicos empilhados.
5. **Triagem:** blocos empilhados, fatores organizacionais um por linha, nome do fator em negrito, roteiro aberto acima da observação.
6. **Inventário:**
   - clique num tópico: abre a lista; marque várias; digite um texto novo e tecle Enter (vira etiqueta "manual");
   - o campo Evidências não abre nem aceita digitação; marque um sinal no bloco de sinais e ele aparece ali em vermelho;
   - inclua um item manual; "salvar na biblioteca" (Admin) o transforma em opção marcada; "sugerir" (técnico) deixa pendente;
   - marque uma medida recomendada;
   - "Recolher/Expandir" funciona;
   - salve e recarregue: tudo continua.
7. **Saídas:** o laudo/PDF mostra "Medidas de controle recomendadas"; a planilha tem a coluna nova; "Gerar IA" nas Recomendações usa as ações e medidas marcadas.
8. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

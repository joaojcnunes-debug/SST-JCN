# Replicar no Painel SST: Certificados e Riscos Psicossociais

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-certificados-e-riscos.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `8b0c95c` de 2026-09-25, já em produção lá.
> O código completo está no fim deste arquivo.

## O que foi feito no JCN

Duas páginas novas no menu lateral do **Painel SST**, logo abaixo de
**Relatórios**. As duas ficam escondidas para o perfil **Cliente**: no menu e
com uma trava dentro da própria página.

### 1. Certificados (`/certificados`)
Controle dos **certificados de treinamento** (NR-35, NR-10…) emitidos aos
trabalhadores das empresas, com foco em **quem emitiu**.
- Cadastro: empresa, trabalhador, CPF, setor, cargo, NR, treinamento, carga
  horária, data de realização, data de emissão, validade, nº, instrutor,
  **emitido por** (usuário Admin/Técnico ativo; o padrão é quem está logado) e
  observações.
- Quadro **Por emissor**: quantos cada pessoa emitiu. Clicar num nome filtra a
  lista.
- Cartões: total, emitidos no mês, vencem em 30 dias e vencidos (os dois
  últimos também filtram).
- Busca, filtro por empresa e por situação, editar e excluir. Só Admin e Técnico
  escrevem.
- Banco: tabela nova `certificados_treinamento` (seção A).

### 2. Riscos Psicossociais (`/riscos-psicossociais`)
Risco **por empresa e por setor**, vindo do **DRPS** e do **Questionário (QPS)**.
- Só entram avaliações na coluna **Concluídos** ou que já passaram dela:
  `status IN ('CONCLUIDO','ENVIADO_CLIENTE')` em `drps_relatorios` e em
  `qps_aplicacoes`.
- **Primeira tela:** só a lista das empresas com avaliação concluída (nome,
  CNPJ, município, fontes DRPS/Questionário, nº de setores, data da conclusão),
  com busca.
- **Clicar na empresa abre `/riscos-psicossociais/[idEmpresa]`:** dados
  cadastrais (razão social, fantasia, CNPJ, CNAE, grau de risco, endereço,
  telefone, e-mail) e, para cada avaliação, um cartão por **setor** com cada
  risco e **só o resultado final** (Baixo/Médio/Alto/Crítico). Gravidade,
  probabilidade e perguntas não aparecem.
- **Regra fixa: esta área NUNCA leva para as telas de Análise do DRPS ou do
  Questionário.** Não há link "Abrir análise" em lugar nenhum.
- O cálculo usa **as mesmas funções das telas de Análise**
  (`montarBlocosPorSetor` no DRPS e `calcularAnaliseSetor` no QPS), então os
  níveis batem com o laudo. Categoria do QPS sem resposta no setor fica sem
  nível; não conta como "Baixo".
- **Não precisa de nada no banco.** Só lê `drps_*`, `qps_*` e `empresas`.

## Passo 1: conferir o painel antes de copiar

O painel pode divergir do JCN. Confira cada dependência e **adapte em vez de
duplicar**:

| Usado pelo código | Se não existir no painel |
|---|---|
| `lib/drps/blocos.ts` → `montarBlocosPorSetor`; `lib/drps/calculos.ts` → `CORES_MATRIZ`; `lib/drps/types.ts` | usar o que a tela `psicossocial/[idRelatorio]/analise` usa |
| `lib/qps/gravidade.ts` → `calcularAnaliseSetor`, `listarSetoresQps` | usar o que a tela `questionarios-psicossociais/[id]/analise` usa. Se só houver `lib/qps/matriz.ts` (BAIXO/MODERADO/ALTO), ajustar os níveis |
| `lib/busca/texto.ts` → `buscar()` | filtro simples com `includes()` sem acento |
| `lib/supabase/fetchAllRows.ts` | copiar da seção F |
| `EmpresaSelect`, `Modal`, `confirmar`/`ConfirmHost`, `LoadingSkeleton`, `useCanEdit`, `useUserStore`, `fmtData`/`formatCPF`/`formatCNPJ`/`cn` | usar os equivalentes do painel |
| classe `verde-primary` | a cor primária do painel |
| status `ENVIADO_CLIENTE` | se não existir, filtrar só `CONCLUIDO` |
| SQL `caller_pode_editar()` e `caller_pode_ver_empresa(text)` | trocar pelo helper de permissão que o painel já usa nas policies |

## Passo 2: banco (só para Certificados)

1. Use o **próximo número de migration do painel** e a convenção dele (pasta,
   rollback). Não reuse o `v258` do JCN se colidir com algo.
2. Confira os helpers:
   ```sql
   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname in ('caller_pode_editar','caller_pode_ver_empresa');
   ```
3. Confira se `empresas.id_empresa` e `usuarios.id_usuario` são `text`, como no
   JCN. Se forem `uuid`, ajuste as FKs.
4. Aplique **no banco do painel**, nunca no do JCN (`ieesssxgjzywrtiqdvmz`).

## Passo 3: código

| Arquivo | O quê |
|---|---|
| `lib/hooks/useRiscosPsicossociais.ts` | novo (seção C) |
| `app/(app)/riscos-psicossociais/page.tsx` | novo: lista de empresas (seção D) |
| `app/(app)/riscos-psicossociais/[idEmpresa]/page.tsx` | novo: página da empresa (seção G) |
| `app/(app)/certificados/page.tsx` | novo (seção E) |
| `components/layout/Sidebar.tsx` | editar (diff abaixo) |

`app/(app)/` é o grupo de rotas do Painel SST (onde ficam `/dashboard` e
`/inspecoes`). O layout dele já exige o módulo `painel`.

Alteração no menu (`components/layout/Sidebar.tsx`):

```diff
@@ -10,6 +10,8 @@ import {
   FileEdit,
   Settings,
   Trash2,
+  Award,
+  Brain,
 } from "lucide-react";
 import { useUserStore } from "@/lib/store";
 import SidebarShell, { type NavItem, type NavSection } from "./SidebarShell";
@@ -20,6 +22,12 @@ const PRINCIPAL: NavItem[] = [
   { href: "/relatorios", label: "Relatórios", icon: BarChart3, variant: "report" },
 ];
 
+// Cliente não vê: as duas telas cruzam TODAS as empresas atendidas.
+const CONTROLE: NavItem[] = [
+  { href: "/certificados", label: "Certificados", icon: Award },
+  { href: "/riscos-psicossociais", label: "Riscos Psicossociais", icon: Brain, variant: "report" },
+];
+
 const ACOES: NavItem[] = [
   { href: "/inspecoes/nova", label: "Nova Inspeção", icon: PlusCircle, variant: "action" },
   { href: "/inspecoes/ficha", label: "Ficha em Branco", icon: ClipboardEdit, variant: "action" },
@@ -44,7 +52,10 @@ export default function Sidebar() {
   const isAdmin = user?.perfil === "Admin";
 
   const sections: NavSection[] = [
-    { label: "Principal", items: PRINCIPAL },
+    {
+      label: "Principal",
+      items: user && user.perfil !== "Cliente" ? [...PRINCIPAL, ...CONTROLE] : PRINCIPAL,
+    },
   ];
   if (canEdit) sections.push({ label: "Ações", items: ACOES });
 
```

## Passo 4: verificar

1. `npx tsc --noEmit -p .` e `npx next build`, sem erros. As rotas
   `/certificados` e `/riscos-psicossociais` aparecem no build.
2. Veja o que a página de riscos vai mostrar:
   ```sql
   select 'drps' f, status, count(*) from drps_relatorios group by status
   union all select 'qps', status, count(*) from qps_aplicacoes group by status;
   ```
   Abra um DRPS concluído na tela de Análise e confira se o nível de cada risco
   de um setor é o mesmo que aparece na página da empresa. Confira também que
   nenhuma tela de Riscos Psicossociais tem link para a Análise.
3. Em Certificados, cadastre, edite e exclua um certificado de teste. Confira que
   o Visualizador não vê "Novo certificado" e que o Cliente não vê os itens no
   menu.
4. Publique pelo fluxo de release do painel.

---

## A: `supabase/historico/v258_certificados_treinamento.sql`

```sql
-- v258 — Certificados de treinamento: controle de quem está emitindo.
--
-- Pedido em 2026-09-25: página "Certificados" no menu do Painel SST para
-- registrar os certificados de treinamento (NR-35, NR-10…) emitidos aos
-- trabalhadores das empresas atendidas, e saber QUEM emitiu cada um.
--
-- Até aqui o sistema não tinha nada disso: `treinamentos_nr` é o treinamento
-- RECOMENDADO no laudo de inspeção, não o certificado entregue.
--
-- Quem emitiu fica em duas colunas: `emitido_por_id` (FK para o usuário, que é
-- o que a tela filtra) e `emitido_por_nome` (retrato do nome no dia — o
-- certificado continua dizendo quem assinou mesmo se o usuário for renomeado
-- ou excluído, e por isso a FK é ON DELETE SET NULL).
--
-- Escopo de leitura segue o das empresas (`caller_pode_ver_empresa`, por
-- unidade); escrita exige perfil Admin/Técnico (`caller_pode_editar`).
--
-- Rollback: scripts/sql/v258_rollback_certificados_treinamento.sql

begin;

do $$ begin
  if current_user <> 'postgres' then
    raise exception 'aplicar como postgres';
  end if;
end $$;

create table if not exists public.certificados_treinamento (
  id_certificado     uuid primary key default gen_random_uuid(),
  id_empresa         text not null references public.empresas(id_empresa) on delete restrict,
  trabalhador_nome   text not null check (length(trim(trabalhador_nome)) > 0),
  trabalhador_cpf    text,
  setor              text,
  cargo              text,
  nr                 text,
  treinamento        text not null check (length(trim(treinamento)) > 0),
  carga_horaria      numeric(6,2) check (carga_horaria is null or carga_horaria > 0),
  data_realizacao    date,
  data_emissao       date not null default current_date,
  validade           date,
  numero             text,
  instrutor          text,
  emitido_por_id     text references public.usuarios(id_usuario) on delete set null,
  emitido_por_nome   text not null,
  observacoes        text,
  criado_por_email   text default lower(auth.jwt() ->> 'email'),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  constraint certificados_validade_depois_emissao
    check (validade is null or validade >= data_emissao)
);

comment on table public.certificados_treinamento is
  'Certificados de treinamento emitidos aos trabalhadores das empresas. emitido_por_* = quem emitiu (v258).';

create index if not exists certificados_treinamento_empresa_idx
  on public.certificados_treinamento (id_empresa);
create index if not exists certificados_treinamento_emissor_idx
  on public.certificados_treinamento (emitido_por_id);
create index if not exists certificados_treinamento_emissao_idx
  on public.certificados_treinamento (data_emissao desc);

create or replace function public.certificados_treinamento_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_certificados_treinamento_touch on public.certificados_treinamento;
create trigger trg_certificados_treinamento_touch
  before update on public.certificados_treinamento
  for each row execute function public.certificados_treinamento_touch();

alter table public.certificados_treinamento enable row level security;

drop policy if exists certificados_ler on public.certificados_treinamento;
create policy certificados_ler on public.certificados_treinamento
  for select to authenticated
  using (public.caller_pode_ver_empresa(id_empresa));

drop policy if exists certificados_inserir on public.certificados_treinamento;
create policy certificados_inserir on public.certificados_treinamento
  for insert to authenticated
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

drop policy if exists certificados_alterar on public.certificados_treinamento;
create policy certificados_alterar on public.certificados_treinamento
  for update to authenticated
  using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa))
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

drop policy if exists certificados_excluir on public.certificados_treinamento;
create policy certificados_excluir on public.certificados_treinamento
  for delete to authenticated
  using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

grant select, insert, update, delete on public.certificados_treinamento to authenticated;

-- ── Prova dentro da própria transação ───────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'certificados_treinamento' and c.relrowsecurity
  ) then
    raise exception 'certificados_treinamento sem RLS';
  end if;
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'certificados_treinamento') <> 4 then
    raise exception 'certificados_treinamento: esperava 4 policies';
  end if;
end $$;

commit;
```

## B: `scripts/sql/v258_rollback_certificados_treinamento.sql`

```sql
-- Rollback da v258 — apaga a tabela de certificados de treinamento.
-- ⚠️ Apaga também os certificados cadastrados. Exporte antes se houver dados.
begin;
drop table if exists public.certificados_treinamento;
drop function if exists public.certificados_treinamento_touch();
commit;
```

## C: `lib/hooks/useRiscosPsicossociais.ts`

```ts
"use client";

// Riscos Psicossociais por empresa, setorizados — a visão consolidada do
// Painel SST sobre o que o DRPS e o Questionário (QPS) já concluíram.
//
// Regra do pedido (2026-09-25): só entra avaliação que chegou à coluna
// "Concluídos" do quadro — status CONCLUIDO, ou ENVIADO_CLIENTE, que é a
// coluna seguinte (passou por Concluídos). Rascunho e em andamento ficam de
// fora porque a probabilidade ainda pode mudar.
//
// Nada é recalculado de um jeito novo: cada setor passa pelas MESMAS funções
// das telas de Análise (`montarBlocosPorSetor` no DRPS, `calcularAnaliseSetor`
// no QPS), então o nível mostrado aqui é o que está no laudo.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { montarBlocosPorSetor } from "@/lib/drps/blocos";
import { calcularAnaliseSetor, listarSetoresQps } from "@/lib/qps/gravidade";
import type { DrpsProbabilidade, DrpsRespondente, NivelMatriz } from "@/lib/drps/types";
import type {
  QpsAplicacao,
  QpsCategoria,
  QpsPergunta,
  QpsProbabilidade,
  QpsRespondente,
  QpsTipo,
} from "@/lib/supabase/types";

// drps_* e qps_* não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

export const STATUS_CONCLUIDOS = ["CONCLUIDO", "ENVIADO_CLIENTE"] as const;

/** Do menor para o maior — o índice serve de peso para achar o pior. */
export const NIVEIS: NivelMatriz[] = ["Baixo", "Médio", "Alto", "Crítico"];

export interface FatorRisco {
  nome: string;
  nivel: NivelMatriz;
}

export interface SetorRisco {
  setor: string;
  respondentes: number;
  fatores: FatorRisco[];
  contagem: Record<NivelMatriz, number>;
  pior: NivelMatriz | null;
}

export interface AvaliacaoRisco {
  fonte: "DRPS" | "Questionário";
  id: string;
  titulo: string;
  status: string;
  /** Data de referência para ordenar (conclusão, elaboração ou última edição). */
  data: string | null;
  responsavel: string | null;
  setores: SetorRisco[];
}

export interface EmpresaRisco {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  avaliacoes: AvaliacaoRisco[];
}

interface EmpresaMin {
  id_empresa: string;
  nome_empresa: string | null;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
}

/** `.in()` com centenas de ids estoura a URL — busca em lotes. */
async function porLotes<T>(
  ids: string[],
  busca: (lote: string[]) => Promise<T[]>,
  tamanho = 100
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += tamanho) {
    out.push(...(await busca(ids.slice(i, i + tamanho))));
  }
  return out;
}

function todasAsLinhas<T>(tabela: string, coluna: string, ids: string[], select = "*") {
  return porLotes(ids, (lote) =>
    fetchAllRows<T>((de, ate) => db().from(tabela).select(select).in(coluna, lote).range(de, ate))
  );
}

function resumirSetor(setor: string, respondentes: number, fatores: FatorRisco[]): SetorRisco {
  const contagem: Record<NivelMatriz, number> = { Baixo: 0, Médio: 0, Alto: 0, Crítico: 0 };
  let pior: NivelMatriz | null = null;
  for (const f of fatores) {
    contagem[f.nivel]++;
    if (!pior || NIVEIS.indexOf(f.nivel) > NIVEIS.indexOf(pior)) pior = f.nivel;
  }
  return { setor, respondentes, fatores, contagem, pior };
}

async function carregarDrps(): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; empresas: EmpresaMin[] }> {
  const { data, error } = await db()
    .from("drps_relatorios")
    .select(
      "id_relatorio, id_empresa, revisao, status, data_elaboracao, data_conclusao, responsavel_tecnico, updated_at, empresas(id_empresa, nome_empresa, cnpj, municipio, uf)"
    )
    .in("status", STATUS_CONCLUIDOS);
  if (error) throw error;
  const relatorios = (data ?? []) as Array<{
    id_relatorio: string;
    id_empresa: string;
    revisao: number | string | null;
    status: string;
    data_elaboracao: string | null;
    data_conclusao: string | null;
    responsavel_tecnico: string | null;
    updated_at: string | null;
    empresas: EmpresaMin | null;
  }>;
  const ids = relatorios.map((r) => r.id_relatorio);
  if (ids.length === 0) return { avaliacoes: [], empresas: [] };

  const [respondentes, probabilidades] = await Promise.all([
    todasAsLinhas<DrpsRespondente>("drps_respondentes", "id_relatorio", ids),
    todasAsLinhas<DrpsProbabilidade>("drps_probabilidades", "id_relatorio", ids),
  ]);

  const avaliacoes = relatorios.map((r) => {
    const resp = respondentes.filter((x) => x.id_relatorio === r.id_relatorio);
    const probs = probabilidades.filter((x) => x.id_relatorio === r.id_relatorio);
    const setores = montarBlocosPorSetor(resp, probs).map((b) =>
      resumirSetor(
        b.setor,
        b.totalRespondentes,
        b.topicos.map((t) => ({ nome: t.nome, nivel: t.matriz }))
      )
    );
    return {
      idEmpresa: r.id_empresa,
      fonte: "DRPS" as const,
      id: r.id_relatorio,
      titulo: `DRPS · Revisão ${r.revisao ?? 0}`,
      status: r.status,
      data: r.data_conclusao ?? r.data_elaboracao ?? r.updated_at,
      responsavel: r.responsavel_tecnico,
      setores,
    };
  });
  const empresas = relatorios.map((r) => r.empresas).filter((e): e is EmpresaMin => !!e);
  return { avaliacoes, empresas };
}

async function carregarQps(): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; idsEmpresa: string[] }> {
  const { data, error } = await db()
    .from("qps_aplicacoes")
    .select("*")
    .in("status", STATUS_CONCLUIDOS);
  if (error) throw error;
  const aplicacoes = (data ?? []) as QpsAplicacao[];
  const ids = aplicacoes.map((a) => a.id_aplicacao);
  if (ids.length === 0) return { avaliacoes: [], idsEmpresa: [] };

  const [tiposRes, catsRes, pergsRes, respondentes, probabilidades] = await Promise.all([
    db().from("qps_tipos").select("*"),
    db().from("qps_categorias").select("*").order("ordem"),
    fetchAllRows<QpsPergunta>((de, ate) =>
      db().from("qps_perguntas").select("*").eq("ativo", true).order("ordem").range(de, ate)
    ),
    todasAsLinhas<QpsRespondente>("qps_respondentes", "id_aplicacao", ids),
    todasAsLinhas<QpsProbabilidade>("qps_probabilidades", "id_aplicacao", ids),
  ]);
  if (tiposRes.error) throw tiposRes.error;
  if (catsRes.error) throw catsRes.error;
  const tipos = new Map(((tiposRes.data ?? []) as QpsTipo[]).map((t) => [t.id_tipo, t]));
  const categorias = (catsRes.data ?? []) as QpsCategoria[];
  const perguntas = pergsRes;

  const avaliacoes = aplicacoes.map((ap) => {
    const tipo = tipos.get(ap.id_tipo);
    const cats = categorias.filter((c) => c.id_tipo === ap.id_tipo);
    const resp = respondentes
      .filter((r) => r.id_aplicacao === ap.id_aplicacao)
      .map((r) => ({ setor: r.setor, respostas: r.respostas ?? {} }));
    const probs = probabilidades.filter((p) => p.id_aplicacao === ap.id_aplicacao);
    const setores = tipo
      ? listarSetoresQps(resp).map((s) => {
          const analise = calcularAnaliseSetor(s, cats, perguntas, resp, probs, tipo.escala_min, tipo.escala_max);
          const n = resp.filter((r) => (r.setor ?? "").trim() === s).length;
          return resumirSetor(
            s,
            n,
            // Categoria sem resposta no setor não tem nível — não vira "Baixo".
            analise.filter((c) => c.matriz).map((c) => ({ nome: c.nome, nivel: c.matriz! }))
          );
        })
      : [];
    return {
      idEmpresa: ap.id_empresa,
      fonte: "Questionário" as const,
      id: ap.id_aplicacao,
      titulo: ap.titulo || "Questionário",
      status: ap.status,
      data: ap.data_elaboracao ?? ap.atualizado_em ?? ap.criado_em,
      responsavel: ap.responsavel ?? ap.usuario_nome,
      setores,
    };
  });
  return { avaliacoes, idsEmpresa: [...new Set(aplicacoes.map((a) => a.id_empresa))] };
}

export function useRiscosPsicossociais() {
  return useQuery({
    queryKey: ["riscos-psicossociais"],
    staleTime: 60_000,
    queryFn: async (): Promise<EmpresaRisco[]> => {
      const [drps, qps] = await Promise.all([carregarDrps(), carregarQps()]);

      const empresaPorId = new Map(drps.empresas.map((e) => [e.id_empresa, e]));
      const faltando = qps.idsEmpresa.filter((id) => id && !empresaPorId.has(id));
      if (faltando.length > 0) {
        const emps = await porLotes(faltando, async (lote) => {
          const { data, error } = await db()
            .from("empresas")
            .select("id_empresa, nome_empresa, cnpj, municipio, uf")
            .in("id_empresa", lote);
          if (error) throw error;
          return (data ?? []) as EmpresaMin[];
        });
        for (const e of emps) empresaPorId.set(e.id_empresa, e);
      }

      const porEmpresa = new Map<string, EmpresaRisco>();
      for (const av of [...drps.avaliacoes, ...qps.avaliacoes]) {
        const { idEmpresa, ...avaliacao } = av;
        let alvo = porEmpresa.get(idEmpresa);
        if (!alvo) {
          const e = empresaPorId.get(idEmpresa);
          alvo = {
            idEmpresa,
            nome: e?.nome_empresa ?? "Empresa sem cadastro",
            cnpj: e?.cnpj ?? null,
            municipio: e?.municipio ?? null,
            uf: e?.uf ?? null,
            avaliacoes: [],
          };
          porEmpresa.set(idEmpresa, alvo);
        }
        alvo.avaliacoes.push(avaliacao);
      }
      const lista = [...porEmpresa.values()];
      for (const e of lista) {
        e.avaliacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
      }
      return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
```

## D: `app/(app)/riscos-psicossociais/page.tsx`

```tsx
"use client";

// Riscos Psicossociais — lista das empresas que têm avaliação do DRPS ou do
// Questionário na coluna "Concluídos" (ou já enviada ao cliente). Clicar abre
// a página da empresa, com os riscos por setor.
//
// Esta área NUNCA leva para as telas de Análise dos módulos: é a visão de
// resultado, não de trabalho (pedido do usuário em 2026-09-25).

import { useMemo, useState } from "react";
import Link from "next/link";
import { Brain, Building2, ChevronRight, Search } from "lucide-react";
import { useRiscosPsicossociais } from "@/lib/hooks/useRiscosPsicossociais";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { useUserStore } from "@/lib/store";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

export default function RiscosPsicossociaisPage() {
  const user = useUserStore((s) => s.user);
  const { data: empresas = [], isLoading, error } = useRiscosPsicossociais();
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(
    () =>
      busca.trim()
        ? buscar(empresas, busca, (e) => [e.nome, e.cnpj ?? "", e.municipio ?? ""]).itens
        : empresas,
    [empresas, busca]
  );

  // O menu já esconde de Cliente; isto cobre quem digitar a URL.
  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          Riscos Psicossociais
        </h1>
        <p className="text-sm text-gray-500">
          Empresas com avaliação do DRPS ou do Questionário concluída. Clique na empresa para ver os riscos
          por setor.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ ou município..."
            className={cn(inputCls, "pl-8")}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as empresas: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {empresas.length === 0
            ? "Nenhuma avaliação do DRPS ou do Questionário está na coluna Concluídos ainda."
            : "Nenhuma empresa encontrada."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {filtradas.map((e) => {
              const fontes = [...new Set(e.avaliacoes.map((a) => a.fonte))];
              const setores = e.avaliacoes.reduce((n, a) => n + a.setores.length, 0);
              const ultima = e.avaliacoes[0]?.data ?? null;
              return (
                <li key={e.idEmpresa}>
                  <Link
                    href={`/riscos-psicossociais/${encodeURIComponent(e.idEmpresa)}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50"
                  >
                    <Building2 className="size-5 shrink-0 text-verde-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-gray-900">{e.nome}</div>
                      <div className="text-xs text-gray-500">
                        {[e.cnpj ? formatCNPJ(e.cnpj) : null, e.municipio && e.uf ? `${e.municipio}/${e.uf}` : e.municipio]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="hidden items-center gap-1.5 sm:flex">
                      {fontes.map((f) => (
                        <span
                          key={f}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold",
                            f === "DRPS" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                          )}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="hidden w-24 text-right text-sm text-gray-600 md:block">
                      {setores} setor{setores !== 1 ? "es" : ""}
                    </div>
                    <div className="hidden w-28 text-right text-xs text-gray-500 md:block">
                      {ultima ? `Concluído ${fmtData(ultima)}` : ""}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-gray-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## E: `app/(app)/certificados/page.tsx`

```tsx
"use client";

// Certificados de treinamento (v258) — controle de QUEM está emitindo.
//
// Cada linha é um certificado entregue a um trabalhador de uma empresa
// atendida. O ponto da tela é o emissor: o quadro "Por emissor" mostra quanto
// cada um emitiu e serve de filtro para a tabela.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Award,
  CalendarClock,
  CalendarX,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { useUserStore } from "@/lib/store";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import Modal from "@/components/ui/Modal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCPF } from "@/lib/utils";

// A tabela é nova (v258) e ainda não está no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function certDb() { return createSupabaseBrowserClient() as any; }

interface Certificado {
  id_certificado: string;
  id_empresa: string;
  trabalhador_nome: string;
  trabalhador_cpf: string | null;
  setor: string | null;
  cargo: string | null;
  nr: string | null;
  treinamento: string;
  carga_horaria: number | null;
  data_realizacao: string | null;
  data_emissao: string;
  validade: string | null;
  numero: string | null;
  instrutor: string | null;
  emitido_por_id: string | null;
  emitido_por_nome: string;
  observacoes: string | null;
  empresas: { nome_empresa: string | null } | null;
}

interface Emissor {
  id_usuario: string;
  nome: string;
}

type Situacao = "valido" | "vence" | "vencido" | "sem";

const SITUACAO: Record<Situacao, { rotulo: string; cls: string }> = {
  valido: { rotulo: "Válido", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  vence: { rotulo: "Vence em 30 dias", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  vencido: { rotulo: "Vencido", cls: "bg-red-50 text-red-700 ring-red-200" },
  sem: { rotulo: "Sem validade", cls: "bg-gray-50 text-gray-600 ring-gray-200" },
};

const NRS = ["NR-05", "NR-06", "NR-10", "NR-11", "NR-12", "NR-17", "NR-18", "NR-20", "NR-23", "NR-33", "NR-35"];

/** Data de hoje em yyyy-mm-dd no fuso do navegador — compara direto com `date` do banco. */
function hojeIso(deslocDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function situacaoDe(validade: string | null): Situacao {
  if (!validade) return "sem";
  if (validade < hojeIso()) return "vencido";
  if (validade <= hojeIso(30)) return "vence";
  return "valido";
}

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

interface Form {
  id_empresa: string | null;
  trabalhador_nome: string;
  trabalhador_cpf: string;
  setor: string;
  cargo: string;
  nr: string;
  treinamento: string;
  carga_horaria: string;
  data_realizacao: string;
  data_emissao: string;
  validade: string;
  numero: string;
  instrutor: string;
  emitido_por_id: string;
  observacoes: string;
}

function formVazio(emissorId: string): Form {
  return {
    id_empresa: null,
    trabalhador_nome: "",
    trabalhador_cpf: "",
    setor: "",
    cargo: "",
    nr: "",
    treinamento: "",
    carga_horaria: "",
    data_realizacao: "",
    data_emissao: hojeIso(),
    validade: "",
    numero: "",
    instrutor: "",
    emitido_por_id: emissorId,
    observacoes: "",
  };
}

function formDe(c: Certificado): Form {
  return {
    id_empresa: c.id_empresa,
    trabalhador_nome: c.trabalhador_nome,
    trabalhador_cpf: c.trabalhador_cpf ?? "",
    setor: c.setor ?? "",
    cargo: c.cargo ?? "",
    nr: c.nr ?? "",
    treinamento: c.treinamento,
    carga_horaria: c.carga_horaria != null ? String(c.carga_horaria) : "",
    data_realizacao: c.data_realizacao ?? "",
    data_emissao: c.data_emissao,
    validade: c.validade ?? "",
    numero: c.numero ?? "",
    instrutor: c.instrutor ?? "",
    emitido_por_id: c.emitido_por_id ?? "",
    observacoes: c.observacoes ?? "",
  };
}

export default function CertificadosPage() {
  const user = useUserStore((s) => s.user);
  const canEdit = useCanEdit();
  const qc = useQueryClient();

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ["certificados-treinamento"],
    queryFn: () =>
      fetchAllRows<Certificado>((de, ate) =>
        certDb()
          .from("certificados_treinamento")
          .select("*, empresas(nome_empresa)")
          .order("data_emissao", { ascending: false })
          .range(de, ate)
      ),
  });

  const { data: emissores = [] } = useQuery({
    queryKey: ["certificados-emissores"],
    queryFn: async (): Promise<Emissor[]> => {
      const { data, error } = await createSupabaseBrowserClient()
        .from("usuarios")
        .select("id_usuario, nome")
        .in("perfil", ["Admin", "Tecnico"])
        .eq("ativo_sistema", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Emissor[];
    },
  });

  const [busca, setBusca] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState<string | null>(null);
  const [emissorFiltro, setEmissorFiltro] = useState<string | null>(null);
  const [situacaoFiltro, setSituacaoFiltro] = useState<Situacao | "">("");
  const [editando, setEditando] = useState<Certificado | "novo" | null>(null);

  // Ranking de quem emite — a pergunta principal da tela.
  const porEmissor = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of certificados) m.set(c.emitido_por_nome, (m.get(c.emitido_por_nome) ?? 0) + 1);
    return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [certificados]);

  const totais = useMemo(() => {
    const mes = hojeIso().slice(0, 7);
    let noMes = 0, vence = 0, vencido = 0;
    for (const c of certificados) {
      if (c.data_emissao.startsWith(mes)) noMes++;
      const s = situacaoDe(c.validade);
      if (s === "vence") vence++;
      if (s === "vencido") vencido++;
    }
    return { total: certificados.length, noMes, vence, vencido };
  }, [certificados]);

  const filtrados = useMemo(() => {
    let lista = certificados;
    if (empresaFiltro) lista = lista.filter((c) => c.id_empresa === empresaFiltro);
    if (emissorFiltro) lista = lista.filter((c) => c.emitido_por_nome === emissorFiltro);
    if (situacaoFiltro) lista = lista.filter((c) => situacaoDe(c.validade) === situacaoFiltro);
    if (busca.trim()) {
      lista = buscar(lista, busca, (c) => [
        c.trabalhador_nome,
        c.trabalhador_cpf ?? "",
        c.treinamento,
        c.nr ?? "",
        c.empresas?.nome_empresa ?? "",
        c.numero ?? "",
      ]).itens;
    }
    return lista;
  }, [certificados, empresaFiltro, emissorFiltro, situacaoFiltro, busca]);

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await certDb().from("certificados_treinamento").delete().eq("id_certificado", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado excluído");
      qc.invalidateQueries({ queryKey: ["certificados-treinamento"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao excluir"),
  });

  const temFiltro = !!(busca || empresaFiltro || emissorFiltro || situacaoFiltro);

  // O menu já esconde de Cliente; isto cobre quem digitar a URL.
  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

  return (
    <div className="space-y-5">
      <ConfirmHost />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Award className="size-5 text-verde-primary" />
            Certificados
          </h1>
          <p className="text-sm text-gray-500">
            Certificados de treinamento emitidos aos trabalhadores e quem emitiu cada um.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditando("novo")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <Plus className="size-4" /> Novo certificado
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo="Total emitidos" valor={totais.total} icone={Award} cor="text-sky-600" />
        <Cartao rotulo="Emitidos este mês" valor={totais.noMes} icone={UserCheck} cor="text-emerald-600" />
        <Cartao
          rotulo="Vencem em 30 dias"
          valor={totais.vence}
          icone={CalendarClock}
          cor="text-amber-600"
          onClick={() => setSituacaoFiltro((s) => (s === "vence" ? "" : "vence"))}
          ativo={situacaoFiltro === "vence"}
        />
        <Cartao
          rotulo="Vencidos"
          valor={totais.vencido}
          icone={CalendarX}
          cor="text-red-600"
          onClick={() => setSituacaoFiltro((s) => (s === "vencido" ? "" : "vencido"))}
          ativo={situacaoFiltro === "vencido"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Por emissor */}
        <div className="h-fit rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <UserCheck className="size-4 text-verde-primary" /> Por emissor
          </h2>
          <p className="mb-3 text-xs text-gray-400">Clique para filtrar a lista</p>
          {isLoading ? (
            <LoadingSkeleton rows={3} />
          ) : porEmissor.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">Nenhum certificado ainda.</p>
          ) : (
            <ul className="space-y-1">
              {porEmissor.map((e) => (
                <li key={e.nome}>
                  <button
                    type="button"
                    onClick={() => setEmissorFiltro((f) => (f === e.nome ? null : e.nome))}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50",
                      emissorFiltro === e.nome && "bg-sky-50 ring-1 ring-sky-200"
                    )}
                  >
                    <span className="truncate text-gray-700">{e.nome}</span>
                    <span className="font-bold text-gray-900">{e.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lista */}
        <div className="min-w-0 space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid gap-2 md:grid-cols-[1fr_260px_180px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar trabalhador, CPF, treinamento, NR..."
                className={cn(inputCls, "pl-8")}
              />
            </div>
            <EmpresaSelect value={empresaFiltro} onChange={setEmpresaFiltro} placeholder="Todas as empresas" allowAll />
            <select
              value={situacaoFiltro}
              onChange={(e) => setSituacaoFiltro(e.target.value as Situacao | "")}
              className={inputCls}
            >
              <option value="">Todas as situações</option>
              {(Object.keys(SITUACAO) as Situacao[]).map((s) => (
                <option key={s} value={s}>{SITUACAO[s].rotulo}</option>
              ))}
            </select>
          </div>
          {temFiltro && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {filtrados.length} de {certificados.length} certificados
              {emissorFiltro && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">Emissor: {emissorFiltro}</span>}
              <button
                type="button"
                onClick={() => { setBusca(""); setEmpresaFiltro(null); setEmissorFiltro(null); setSituacaoFiltro(""); }}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
              >
                <X className="size-3" /> Limpar filtros
              </button>
            </div>
          )}

          {isLoading ? (
            <LoadingSkeleton rows={6} />
          ) : filtrados.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {certificados.length === 0
                ? "Nenhum certificado cadastrado. Use \"Novo certificado\" para registrar o primeiro."
                : "Nenhum certificado com esses filtros."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-medium">Trabalhador</th>
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 pr-3 font-medium">Treinamento</th>
                    <th className="py-2 pr-3 font-medium">Emissão</th>
                    <th className="py-2 pr-3 font-medium">Validade</th>
                    <th className="py-2 pr-3 font-medium">Emitido por</th>
                    {canEdit && <th className="py-2 font-medium" />}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => {
                    const s = situacaoDe(c.validade);
                    return (
                      <tr key={c.id_certificado} className="border-b border-gray-50 align-top hover:bg-gray-50/60">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-gray-900">{c.trabalhador_nome}</div>
                          <div className="text-xs text-gray-500">
                            {[c.trabalhador_cpf ? formatCPF(c.trabalhador_cpf) : null, c.setor, c.cargo].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700">{c.empresas?.nome_empresa ?? "—"}</td>
                        <td className="py-2.5 pr-3">
                          <div className="text-gray-900">{c.treinamento}</div>
                          <div className="text-xs text-gray-500">
                            {[c.nr, c.carga_horaria ? `${c.carga_horaria}h` : null, c.numero ? `nº ${c.numero}` : null].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-gray-700">{fmtData(c.data_emissao)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="whitespace-nowrap text-gray-700">{fmtData(c.validade)}</div>
                          <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", SITUACAO[s].cls)}>
                            {SITUACAO[s].rotulo}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700">{c.emitido_por_nome}</td>
                        {canEdit && (
                          <td className="whitespace-nowrap py-2.5 text-right">
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => setEditando(c)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="Excluir"
                              onClick={async () => {
                                const ok = await confirmar({
                                  title: "Excluir certificado?",
                                  description: `${c.treinamento} — ${c.trabalhador_nome}. Esta ação não pode ser desfeita.`,
                                  confirmLabel: "Excluir",
                                  variant: "danger",
                                });
                                if (ok) excluir.mutate(c.id_certificado);
                              }}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editando && (
        <CertificadoModal
          certificado={editando === "novo" ? null : editando}
          emissores={emissores}
          emissorPadrao={user?.id_usuario ?? ""}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  icone: Icone,
  cor,
  onClick,
  ativo,
}: {
  rotulo: string;
  valor: number;
  icone: typeof Award;
  cor: string;
  onClick?: () => void;
  ativo?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm",
        onClick && "hover:border-gray-200",
        ativo && "ring-2 ring-sky-300"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{rotulo}</span>
        <Icone className={cn("size-4", cor)} />
      </div>
      <div className={cn("mt-1 text-2xl font-bold", cor)}>{valor}</div>
    </Tag>
  );
}

function CertificadoModal({
  certificado,
  emissores,
  emissorPadrao,
  onClose,
}: {
  certificado: Certificado | null;
  emissores: Emissor[];
  emissorPadrao: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(() =>
    certificado ? formDe(certificado) : formVazio(emissorPadrao)
  );
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.id_empresa) throw new Error("Selecione a empresa");
      if (!form.trabalhador_nome.trim()) throw new Error("Informe o nome do trabalhador");
      if (!form.treinamento.trim()) throw new Error("Informe o treinamento");
      if (!form.data_emissao) throw new Error("Informe a data de emissão");
      if (form.validade && form.validade < form.data_emissao) {
        throw new Error("A validade não pode ser anterior à emissão");
      }
      const emissor = emissores.find((e) => e.id_usuario === form.emitido_por_id);
      // Mantém o nome gravado se o emissor original já não está na lista (inativo).
      const emissorNome = emissor?.nome ?? certificado?.emitido_por_nome;
      if (!emissorNome) throw new Error("Selecione quem emitiu o certificado");

      const n = (s: string) => (s.trim() ? s.trim() : null);
      const linha = {
        id_empresa: form.id_empresa,
        trabalhador_nome: form.trabalhador_nome.trim(),
        trabalhador_cpf: n(form.trabalhador_cpf.replace(/\D/g, "")),
        setor: n(form.setor),
        cargo: n(form.cargo),
        nr: n(form.nr),
        treinamento: form.treinamento.trim(),
        carga_horaria: form.carga_horaria ? Number(form.carga_horaria.replace(",", ".")) : null,
        data_realizacao: form.data_realizacao || null,
        data_emissao: form.data_emissao,
        validade: form.validade || null,
        numero: n(form.numero),
        instrutor: n(form.instrutor),
        emitido_por_id: emissor?.id_usuario ?? certificado?.emitido_por_id ?? null,
        emitido_por_nome: emissorNome,
        observacoes: n(form.observacoes),
      };
      const tabela = certDb().from("certificados_treinamento");
      const { error } = certificado
        ? await tabela.update(linha).eq("id_certificado", certificado.id_certificado)
        : await tabela.insert(linha);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(certificado ? "Certificado atualizado" : "Certificado registrado");
      qc.invalidateQueries({ queryKey: ["certificados-treinamento"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={certificado ? "Editar certificado" : "Novo certificado"}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate()}
            className="rounded-lg bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Empresa *" className="sm:col-span-2">
          <EmpresaSelect value={form.id_empresa} onChange={(v) => set("id_empresa", v)} allowAll />
        </Campo>
        <Campo rotulo="Trabalhador *">
          <input className={inputCls} value={form.trabalhador_nome} onChange={(e) => set("trabalhador_nome", e.target.value)} />
        </Campo>
        <Campo rotulo="CPF">
          <input className={inputCls} value={form.trabalhador_cpf} onChange={(e) => set("trabalhador_cpf", e.target.value)} placeholder="000.000.000-00" />
        </Campo>
        <Campo rotulo="Setor">
          <input className={inputCls} value={form.setor} onChange={(e) => set("setor", e.target.value)} />
        </Campo>
        <Campo rotulo="Cargo / função">
          <input className={inputCls} value={form.cargo} onChange={(e) => set("cargo", e.target.value)} />
        </Campo>
        <Campo rotulo="NR">
          <input className={inputCls} list="certificados-nrs" value={form.nr} onChange={(e) => set("nr", e.target.value)} placeholder="Ex.: NR-35" />
          <datalist id="certificados-nrs">
            {NRS.map((nr) => <option key={nr} value={nr} />)}
          </datalist>
        </Campo>
        <Campo rotulo="Treinamento *">
          <input className={inputCls} value={form.treinamento} onChange={(e) => set("treinamento", e.target.value)} placeholder="Ex.: Trabalho em Altura" />
        </Campo>
        <Campo rotulo="Carga horária (h)">
          <input className={inputCls} inputMode="decimal" value={form.carga_horaria} onChange={(e) => set("carga_horaria", e.target.value)} />
        </Campo>
        <Campo rotulo="Data de realização">
          <input type="date" className={inputCls} value={form.data_realizacao} onChange={(e) => set("data_realizacao", e.target.value)} />
        </Campo>
        <Campo rotulo="Data de emissão *">
          <input type="date" className={inputCls} value={form.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} />
        </Campo>
        <Campo rotulo="Validade">
          <input type="date" className={inputCls} value={form.validade} onChange={(e) => set("validade", e.target.value)} />
        </Campo>
        <Campo rotulo="Nº do certificado">
          <input className={inputCls} value={form.numero} onChange={(e) => set("numero", e.target.value)} />
        </Campo>
        <Campo rotulo="Instrutor">
          <input className={inputCls} value={form.instrutor} onChange={(e) => set("instrutor", e.target.value)} />
        </Campo>
        <Campo rotulo="Emitido por *" className="sm:col-span-2">
          <select className={inputCls} value={form.emitido_por_id} onChange={(e) => set("emitido_por_id", e.target.value)}>
            <option value="">Selecione...</option>
            {certificado?.emitido_por_id &&
              !emissores.some((e) => e.id_usuario === certificado.emitido_por_id) && (
                <option value={certificado.emitido_por_id}>{certificado.emitido_por_nome} (inativo)</option>
              )}
            {emissores.map((e) => (
              <option key={e.id_usuario} value={e.id_usuario}>{e.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Observações" className="sm:col-span-2">
          <textarea rows={2} className={inputCls} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-sm font-medium text-gray-700">{rotulo}</span>
      {children}
    </label>
  );
}
```

## F: `lib/supabase/fetchAllRows.ts`

```ts
/**
 * Busca TODAS as linhas de uma query paginando de 1000 em 1000.
 *
 * O PostgREST devolve no máximo ~1000 linhas por requisição (teto padrão). Sem
 * paginar, gráficos que varrem tabelas inteiras (dashboard) passam a subcontar
 * em silêncio quando a base cresce além de 1000 registros. Este helper repete a
 * query com `.range()` até esgotar.
 *
 * Uso:
 *   const linhas = await fetchAllRows<{ status: string }>(
 *     (de, ate) => sb.from("inspecoes").select("status").neq("status","DELETADA").range(de, ate),
 *   );
 */
export async function fetchAllRows<T>(
  page: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const TAMANHO = 1000;
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO) {
    const { data, error } = await page(de, de + TAMANHO - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < TAMANHO) break;
  }
  return todas;
}
```

## G: `app/(app)/riscos-psicossociais/[idEmpresa]/page.tsx`

```tsx
"use client";

// Riscos Psicossociais de UMA empresa: dados cadastrais + o resultado final de
// cada risco, por setor. Só o nível final (matriz) — gravidade, probabilidade
// e perguntas ficam no laudo. Sem link para as telas de Análise, de propósito.

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Layers, Users } from "lucide-react";
import { useRiscosPsicossociais } from "@/lib/hooks/useRiscosPsicossociais";
import { CORES_MATRIZ } from "@/lib/drps/calculos";
import type { NivelMatriz } from "@/lib/drps/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useUserStore } from "@/lib/store";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const STATUS_ROTULO: Record<string, string> = {
  CONCLUIDO: "Concluído",
  ENVIADO_CLIENTE: "Enviado ao cliente",
};

interface EmpresaCadastro {
  nome_empresa: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  grau_risco: number | string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
}

function SeloNivel({ nivel }: { nivel: NivelMatriz }) {
  return (
    <span
      className="inline-block min-w-[64px] rounded-full px-2.5 py-0.5 text-center text-xs font-semibold text-white"
      style={{ backgroundColor: CORES_MATRIZ[nivel] }}
    >
      {nivel}
    </span>
  );
}

function Info({ rotulo, valor, className }: { rotulo: string; valor: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className="text-sm text-gray-900">{valor && valor.trim() ? valor : "—"}</div>
    </div>
  );
}

export default function RiscosEmpresaPage() {
  const user = useUserStore((s) => s.user);
  const { idEmpresa: bruto } = useParams<{ idEmpresa: string }>();
  const idEmpresa = decodeURIComponent(bruto);
  const { data: empresas = [], isLoading } = useRiscosPsicossociais();
  const riscos = empresas.find((e) => e.idEmpresa === idEmpresa) ?? null;

  const { data: cadastro } = useQuery({
    queryKey: ["riscos-psicossociais-empresa", idEmpresa],
    queryFn: async (): Promise<EmpresaCadastro | null> => {
      const { data, error } = await createSupabaseBrowserClient()
        .from("empresas")
        .select(
          "nome_empresa, razao_social, nome_fantasia, cnpj, cnae_principal, cnae_descricao, grau_risco, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email"
        )
        .eq("id_empresa", idEmpresa)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaCadastro | null;
    },
  });

  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

  const endereco = cadastro
    ? [
        [cadastro.logradouro, cadastro.numero].filter(Boolean).join(", "),
        cadastro.complemento,
        cadastro.bairro,
        cadastro.municipio && cadastro.uf ? `${cadastro.municipio}/${cadastro.uf}` : cadastro.municipio,
        cadastro.cep ? `CEP ${cadastro.cep}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/riscos-psicossociais"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary"
        >
          <ArrowLeft className="size-4" /> Voltar às empresas
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-verde-primary" />
          {cadastro?.nome_empresa ?? riscos?.nome ?? "Empresa"}
        </h1>
        <p className="text-sm text-gray-500">Riscos psicossociais por setor — resultado final de cada risco.</p>
      </div>

      {/* Dados da empresa */}
      <div className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info rotulo="Razão social" valor={cadastro?.razao_social} className="sm:col-span-2" />
        <Info rotulo="Nome fantasia" valor={cadastro?.nome_fantasia} />
        <Info rotulo="CNPJ" valor={cadastro?.cnpj ? formatCNPJ(cadastro.cnpj) : null} />
        <Info
          rotulo="CNAE principal"
          valor={[cadastro?.cnae_principal, cadastro?.cnae_descricao].filter(Boolean).join(" — ")}
          className="sm:col-span-2"
        />
        <Info rotulo="Grau de risco" valor={cadastro?.grau_risco != null ? String(cadastro.grau_risco) : null} />
        <Info rotulo="Telefone" valor={cadastro?.telefone} />
        <Info rotulo="Endereço" valor={endereco} className="sm:col-span-2 lg:col-span-3" />
        <Info rotulo="E-mail" valor={cadastro?.email} />
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : !riscos ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          Esta empresa não tem avaliação do DRPS ou do Questionário concluída.
        </p>
      ) : (
        riscos.avaliacoes.map((a) => (
          <section key={a.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold",
                  a.fonte === "DRPS" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                )}
              >
                {a.fonte}
              </span>
              <h2 className="text-base font-semibold text-gray-900">{a.titulo}</h2>
              <span className="text-xs text-gray-500">
                {STATUS_ROTULO[a.status] ?? a.status}
                {a.data ? ` · ${fmtData(a.data)}` : ""}
                {a.responsavel ? ` · ${a.responsavel}` : ""}
              </span>
            </div>

            {a.setores.length === 0 ? (
              <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500 shadow-sm">
                Sem respondentes importados nesta avaliação.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {a.setores.map((s) => (
                  <div key={s.setor} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                        <Layers className="size-4 text-verde-primary" /> {s.setor}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Users className="size-3.5" /> {s.respondentes} respondente{s.respondentes !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {s.fatores.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum risco com resposta neste setor.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                            <th className="py-1.5 font-medium">Risco</th>
                            <th className="py-1.5 text-right font-medium">Resultado final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.fatores.map((f) => (
                            <tr key={f.nome} className="border-b border-gray-50 last:border-0">
                              <td className="py-2 pr-3 text-gray-700">{f.nome}</td>
                              <td className="py-2 text-right"><SeloNivel nivel={f.nivel} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
```


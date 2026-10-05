# Replicar no Painel SST: módulo Comercial (oportunidades de AET e DRPS/Questionário)

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-modulo-comercial.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `3c3b1bc` e `50ee5e2` de 2026-10-05, já em produção lá.
> **Tem 1 migration** (v267, seção A): uma função de leitura e a liberação do módulo para os Admins.

## Pré-requisitos

Este módulo reaproveita a regra da Sinalização. Aplique antes, se o painel
ainda não tiver:

1. `replicar-no-painel-aep-entrega-e-setores-da-empresa.md`: a regra de "AEP
   entregue ao cliente" e a coluna `aep_relatorios.concluido_em` (v265).
2. `replicar-no-painel-sinalizacao-filtros-e-status-aep.md`:
   `montarSinalizacao` com `recomendaQuestionario`, unidade/região e
   `opcoesDistintas`.
3. `replicar-no-painel-explicacao-matriz-aiha.md`: o componente
   `ExplicacaoMatrizAiha`, usado na página Matriz AIHA do módulo.

## O que faz

Um **módulo Comercial** para quem vende. Ele aparece como **card próprio na
tela principal de Módulos**, ao lado de Empresas, com "N oportunidades em
aberto". A página transforma as **AEPs já entregues ao cliente** em
**oportunidades** de serviço vendido à parte:

| Produto | Vira oportunidade quando |
|---|---|
| **AET** | algum setor da AEP tem "Necessita AET" (vale também quando só a ergonomia física/cognitiva indicou) |
| **DRPS / Questionário Psicossocial** | a AEP tem **3+ alertas organizacionais** (`recomendaQuestionario`) |

**Situação**, pelo que a empresa já tem no sistema (`situacaoPorDocs`):

- **aberta:** nenhum documento do serviço existe; é para vender.
- **em andamento:** existe AET, DRPS ou QPS em rascunho ou andamento.
- **realizada:** existe um concluído ou enviado.

A base é a AEP entregue mais recente de cada empresa.

**Página Oportunidades (`/comercial`):**

- **Contadores:** AET em aberto, trabalhadores expostos nos setores das AETs em
  aberto (base do orçamento), DRPS/Questionário em aberto e em andamento.
  Clicar num contador filtra a lista.
- **Filtros:** produto, situação (abre em **aberta**), unidade, nível AIHA e
  busca por empresa, CNPJ, unidade ou município.
- **Cartão por empresa:**
  - CNPJ, unidade · região, telefone e e-mail clicáveis;
  - nível AIHA e data de entrega da AEP;
  - um bloco por oportunidade, com setores e expostos;
  - quem realizou e quem enviou a AEP.
- **Exportar (Excel):** CSV com `;` e BOM, uma linha por oportunidade.
- **Menu do módulo:** Oportunidades e **Matriz AIHA** (`/comercial-matriz-aiha`).

**Acesso:** o comercial **não precisa** dos módulos AEP, AET ou DRPS, que no
JCN têm a trava `rls_modulo` em modo restritivo. Os dados vêm da RPC
`comercial_dados()`:

- é `SECURITY DEFINER` e só lê;
- confere se quem chama é Admin, tem `modulos_permitidos` nulo ou tem `comercial` na lista; senão devolve o erro 42501;
- devolve as AEPs entregues (com a empresa e o contato) e o status de AET, DRPS e QPS por empresa.

A tela também exige o módulo `comercial`, pelo `useRequireModule`. A v267 liga
o módulo para os Admins ativos; os demais usuários recebem por Sistema ›
Usuários.

## Passo 1: conferir o painel

| Usado pelo código | Conferir no painel |
|---|---|
| `ModuloPermitido`, `TODOS_MODULOS` e `ROTULO_MODULO` em `lib/supabase/types.ts` | é onde o módulo novo é registrado; a tela de usuários lista por `TODOS_MODULOS` |
| `usuarios` com `email`, `perfil`, `modulos_permitidos` (text[]) e `ativo_sistema` | a RPC identifica o usuário pelo e-mail do JWT, igual a `rls_modulo_ok` |
| `aep_relatorios` (`id_inspecao`, `concluido_em`), `inspecoes` (`elaboracao_status`, `elaboracao_concluida_em`, `elaboracao_responsavel`, `status`), `empresas` (`telefone`, `email`, `municipio`, `uf`, `id_unidade`), `drps_relatorios`, `qps_aplicacoes` e `aet_relatorios` (`id_empresa`, `status`) | mesmos nomes; ajuste a RPC se algum for diferente |
| Tela de Módulos em `app/(hub)/modulos/page.tsx`, com os cartões diretos (`EmpresaDirectCard`, `GestaoGerencialDirectCard`…) e `totalCards` | o card Comercial segue o mesmo molde |
| `normalizarRelatorio` em `lib/hooks/useAep.ts` | passa a ser exportado (seção E) |
| `SidebarShell`, `ModuleTopbar`, `useAuth`, `useRequireModule`, `useUnidades`, `buscar`, `SeloNivelAiha` | mesmos nomes |

## Passo 2: migration v267 (banco do painel)

Rode a seção **A** no **banco do painel**, nunca no do JCN. Depois:

1. Teste como Admin: `select public.comercial_dados();` deve devolver `{aeps, docs}`.
2. Teste com um usuário sem o módulo: deve dar o erro 42501.

Rollback:

```sql
drop function if exists public.comercial_dados();
update public.usuarios set modulos_permitidos = array_remove(modulos_permitidos, 'comercial')
 where 'comercial' = any(modulos_permitidos);
```

## Passo 3: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `supabase/historico/v267_comercial_dados.sql` | **migration**: RPC + módulo para Admins |
| B | `lib/supabase/types.ts` | módulo `comercial` |
| C, D | `lib/comercial/oportunidades.ts` + teste | **novo**: regra das oportunidades e o CSV |
| E | `lib/hooks/useAep.ts` | exporta `normalizarRelatorio` |
| F | `lib/hooks/useComercial.ts` | **novo**: chama a RPC e monta as oportunidades |
| G | `app/(comercial)/layout.tsx` | **novo**: menu do módulo |
| H | `app/(comercial)/comercial/page.tsx` | **novo**: página Oportunidades |
| I | `app/(comercial)/comercial-matriz-aiha/page.tsx` | **novo**: Matriz AIHA |
| J | `app/(hub)/modulos/page.tsx` | card **Comercial** na tela principal |

Na seção J o diff mostra só o resultado final: o card direto
(`ComercialDirectCard`) entra ao lado de `EmpresaDirectCard`, e
`totalCards` conta +1 para quem tem o módulo. No JCN o card passou antes por
dentro de "JCN Sistema Interno" e depois saiu de lá; no painel, crie direto o
card da tela principal.

### A: `supabase/historico/v267_comercial_dados.sql` (novo, completo)

```sql
-- v267 (2026-10-05): módulo Comercial. Uma função só de leitura entrega ao
-- comercial o que ele precisa (AEPs entregues ao cliente + situação de
-- AET/DRPS/QPS por empresa) sem dar acesso aos módulos AEP/AET/DRPS
-- (rls_modulo). Quem chama precisa ser Admin ou ter 'comercial' em
-- modulos_permitidos. Liga o módulo para os Admins ativos.
-- Já aplicada via MCP. Rollback: scripts/sql/v267_rollback_comercial_dados.sql
create or replace function public.comercial_dados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_ok boolean;
begin
  select (u.perfil = 'Admin' or u.modulos_permitidos is null or 'comercial' = any(u.modulos_permitidos))
    into v_ok
    from public.usuarios u
   where lower(u.email) = v_email and u.ativo_sistema = true
   limit 1;
  if not coalesce(v_ok, false) then
    raise exception 'Sem permissão para o módulo Comercial' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'aeps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_relatorio', a.id_relatorio,
        'id_empresa', a.id_empresa,
        'status', a.status,
        'setores', a.setores,
        'responsavel_elaboracao', a.responsavel_elaboracao,
        'data_elaboracao', a.data_elaboracao,
        'id_inspecao', a.id_inspecao,
        'entregue_em', case when a.id_inspecao is not null then i.elaboracao_concluida_em else a.concluido_em end,
        'enviado_por', i.elaboracao_responsavel,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.aep_relatorios a
        join public.empresas e on e.id_empresa = a.id_empresa
        left join public.inspecoes i on i.id_inspecao = a.id_inspecao
       where (a.id_inspecao is not null and i.elaboracao_status = 'CONCLUIDO' and i.status <> 'DELETADA')
          or (a.id_inspecao is null and a.status = 'CONCLUIDO')
    ), '[]'::jsonb),
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object('id_empresa', d.id_empresa, 'tipo', d.tipo, 'status', d.status))
        from (
          select id_empresa, 'DRPS'::text as tipo, status from public.drps_relatorios
          union all select id_empresa, 'QPS', status from public.qps_aplicacoes
          union all select id_empresa, 'AET', status from public.aet_relatorios
        ) d
       where d.id_empresa in (select id_empresa from public.aep_relatorios)
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.comercial_dados() from public, anon;
grant execute on function public.comercial_dados() to authenticated;

update public.usuarios
   set modulos_permitidos = array_append(modulos_permitidos, 'comercial')
 where perfil = 'Admin' and ativo_sistema = true
   and modulos_permitidos is not null
   and not ('comercial' = any(modulos_permitidos));
```

### B: diff de `lib/supabase/types.ts`

```diff
@@ -53,7 +53,8 @@ export type ModuloPermitido =
   | "equipamentos"
   | "frota"
   | "escala_supervisores"
-  | "dimensionamento";
+  | "dimensionamento"
+  | "comercial";
 
 export const TODOS_MODULOS: ModuloPermitido[] = [
   "painel",
@@ -73,6 +74,7 @@ export const TODOS_MODULOS: ModuloPermitido[] = [
   "frota",
   "escala_supervisores",
   "dimensionamento",
+  "comercial",
 ];
 
 export const ROTULO_MODULO: Record<ModuloPermitido, string> = {
@@ -93,6 +95,7 @@ export const ROTULO_MODULO: Record<ModuloPermitido, string> = {
   frota: "Frota JCN Consultoria – Checklist de Veículos",
   escala_supervisores: "Escala de Supervisores",
   dimensionamento: "Dimensionamento de Quadro (SST)",
+  comercial: "Comercial – Oportunidades de venda",
 };
 
 // ─── Investigação de Acidente de Trabalho ────────────────────────────────────
```

### C: `lib/comercial/oportunidades.ts` (novo, completo)

```ts
// Módulo Comercial (2026-10-05): transforma as AEPs entregues ao cliente em
// OPORTUNIDADES de venda — serviços que a AEP indicou e que a empresa ainda
// não contratou. Puro (sem tela, sem banco) para testar.
//
//   • AET (vendida à parte): algum setor da AEP com "Necessita AET".
//   • DRPS / Questionário Psicossocial: AEP com 3+ alertas organizacionais
//     (`recomendaQuestionario`, a mesma regra do editor e da Sinalização).
//
// Situação de cada uma, pelo que a empresa já tem no sistema:
//   aberta    → indicada e nenhum documento do serviço existe (vender);
//   andamento → já existe um em rascunho/andamento (provavelmente vendido);
//   realizada → já existe um concluído/enviado.
// Os dados vêm da RPC `comercial_dados` (v267). Base: a AEP entregue mais
// recente de cada empresa, igual à Sinalização.

import { montarSinalizacao, type AepEntregue, type EmpresaSinalizada } from "@/lib/aep/sinalizacao";

export type SituacaoOportunidade = "aberta" | "andamento" | "realizada";
export type Produto = "AET" | "DRPS/Questionário";

export interface DocEmpresa {
  id_empresa: string;
  tipo: "AET" | "DRPS" | "QPS";
  status: string | null;
}

export interface SetorAet {
  nome: string;
  expostos: number;
  cargos: number;
}

export interface Oportunidade {
  produto: Produto;
  situacao: SituacaoOportunidade;
  /** Para AET: setores indicados. */
  setores: SetorAet[];
}

export interface EmpresaComercial {
  empresa: EmpresaSinalizada;
  telefone: string | null;
  email: string | null;
  oportunidades: Oportunidade[];
  /** Trabalhadores expostos nos setores indicados para AET (base do orçamento). */
  expostosAet: number;
}

const FASE: Record<string, "realizada" | "andamento"> = {
  CONCLUIDO: "realizada",
  ENVIADO_CLIENTE: "realizada",
  RASCUNHO: "andamento",
  EM_ANDAMENTO: "andamento",
};

/** Melhor situação entre os documentos: realizada > andamento > aberta. */
export function situacaoPorDocs(status: (string | null)[]): SituacaoOportunidade {
  const fases = status.map((s) => FASE[s ?? ""]).filter(Boolean);
  if (fases.includes("realizada")) return "realizada";
  if (fases.includes("andamento")) return "andamento";
  return "aberta";
}

export function montarComercial(aeps: (AepEntregue & { empresas?: unknown })[], docs: DocEmpresa[]): EmpresaComercial[] {
  const empresas = montarSinalizacao(aeps);
  // A sinalização só traz empresa com fator organizacional "Sim". Para o
  // comercial a AET pode vir só da física/cognitiva — inclui as demais.
  const comFator = new Set(empresas.map((e) => e.idEmpresa));
  const ultimaPorEmpresa = new Map<string, AepEntregue>();
  for (const a of aeps) {
    const atual = ultimaPorEmpresa.get(a.id_empresa);
    const data = (x: AepEntregue) => x.entregue_em ?? x.data_elaboracao ?? "";
    if (!atual || data(a) > data(atual)) ultimaPorEmpresa.set(a.id_empresa, a);
  }
  for (const [id, a] of ultimaPorEmpresa) {
    if (comFator.has(id)) continue;
    if (!(a.setores ?? []).some((s) => s.necessita_aet)) continue;
    const cad = (a.empresas ?? {}) as { nome_empresa?: string; cnpj?: string | null; id_unidade?: string | null; municipio?: string | null; uf?: string | null };
    empresas.push({
      idEmpresa: id,
      nome: cad.nome_empresa ?? "Empresa sem cadastro",
      cnpj: cad.cnpj ?? null,
      avaliacoes: [],
      totalSetores: 0,
      totalAlertas: 0,
      totalAltos: 0,
      pior: null,
      ultimaData: a.entregue_em ?? a.data_elaboracao ?? null,
      precisaAet: true,
      precisaQuestionario: false,
      realizadaPor: a.responsavel_elaboracao || null,
      enviadoPor: a.enviado_por?.trim() || null,
      temInspecao: !!(a as { id_inspecao?: string | null }).id_inspecao,
      idUnidade: cad.id_unidade ?? null,
      municipio: cad.municipio ?? null,
      uf: cad.uf ?? null,
    });
  }

  return empresas
    .map((e) => {
      const ultima = ultimaPorEmpresa.get(e.idEmpresa);
      const cad = (ultima?.empresas ?? {}) as { telefone?: string | null; email?: string | null };
      const docsDa = docs.filter((d) => d.id_empresa === e.idEmpresa);
      const oportunidades: Oportunidade[] = [];
      const setoresAet: SetorAet[] = (ultima?.setores ?? [])
        .filter((s) => s.necessita_aet)
        .map((s) => ({
          nome: s.nome_setor || "Setor sem nome",
          expostos: Number(s.qtd_expostos) || 0,
          cargos: (s.cargos ?? []).filter((c) => c.cargo).length,
        }));
      if (e.precisaAet) {
        oportunidades.push({
          produto: "AET",
          situacao: situacaoPorDocs(docsDa.filter((d) => d.tipo === "AET").map((d) => d.status)),
          setores: setoresAet,
        });
      }
      if (e.precisaQuestionario) {
        oportunidades.push({
          produto: "DRPS/Questionário",
          situacao: situacaoPorDocs(docsDa.filter((d) => d.tipo !== "AET").map((d) => d.status)),
          setores: [],
        });
      }
      return {
        empresa: e,
        telefone: cad.telefone?.trim() || null,
        email: cad.email?.trim() || null,
        oportunidades,
        expostosAet: setoresAet.reduce((n, s) => n + s.expostos, 0),
      };
    })
    .filter((c) => c.oportunidades.length > 0)
    .sort(
      (a, b) =>
        b.oportunidades.filter((o) => o.situacao === "aberta").length -
          a.oportunidades.filter((o) => o.situacao === "aberta").length ||
        a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"),
    );
}

/** Uma linha por oportunidade, para exportar (CSV/Excel). */
export function linhasCsv(lista: EmpresaComercial[], nomeUnidade: (id: string | null) => string): string[][] {
  const cab = [
    "Empresa", "CNPJ", "Unidade", "Município/UF", "Telefone", "E-mail", "Produto", "Situação",
    "Setores indicados (AET)", "Trabalhadores expostos (AET)", "Nível AIHA", "Realizada por", "Enviada por", "Entregue em",
  ];
  const rot: Record<SituacaoOportunidade, string> = { aberta: "Aberta", andamento: "Em andamento", realizada: "Realizada" };
  const linhas = lista.flatMap((c) =>
    c.oportunidades.map((o) => [
      c.empresa.nome,
      c.empresa.cnpj ?? "",
      nomeUnidade(c.empresa.idUnidade),
      [c.empresa.municipio, c.empresa.uf].filter(Boolean).join("/"),
      c.telefone ?? "",
      c.email ?? "",
      o.produto,
      rot[o.situacao],
      o.setores.map((s) => s.nome).join(", "),
      o.produto === "AET" ? String(c.expostosAet) : "",
      c.empresa.pior ?? "",
      c.empresa.realizadaPor ?? "",
      c.empresa.enviadoPor ?? "",
      c.empresa.ultimaData ? c.empresa.ultimaData.slice(0, 10) : "",
    ]),
  );
  return [cab, ...linhas];
}
```

### D: `lib/comercial/oportunidades.test.ts` (novo, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasCsv, montarComercial, situacaoPorDocs } from "./oportunidades";

const empresa = (nome: string) => ({ nome_empresa: nome, cnpj: null, municipio: "Teresópolis", uf: "RJ", id_unidade: "U1", telefone: "21 9999", email: "a@b.c" });

const setorAet = {
  id: "s1",
  nome_setor: "Produção",
  qtd_expostos: 12,
  necessita_aet: true,
  cargos: [{ cargo: "Operador" }, { cargo: "" }],
  checklist_organizacional: { assedio: "sim", sobrecarga: "sim", baixo_controle: "sim" },
  sinais_organizacional: {},
  aiha_organizacional: { assedio: { probabilidade: "x", severidade: "y", nivel: "Alto" } },
};
const setorSoFisico = { id: "s2", nome_setor: "Expedição", qtd_expostos: 5, necessita_aet: true, cargos: [], checklist_organizacional: {} };

function aep(id: string, idEmpresa: string, setores: unknown[], extra: Record<string, unknown> = {}) {
  return {
    id_relatorio: id,
    id_empresa: idEmpresa,
    status: "CONCLUIDO",
    setores,
    responsavel_elaboracao: "Ana",
    data_elaboracao: "2026-10-01",
    entregue_em: "2026-10-05",
    enviado_por: null,
    empresas: empresa("Empresa " + idEmpresa),
    ...extra,
  } as never;
}

test("situação pelos documentos", () => {
  assert.equal(situacaoPorDocs([]), "aberta");
  assert.equal(situacaoPorDocs(["RASCUNHO"]), "andamento");
  assert.equal(situacaoPorDocs(["RASCUNHO", "CONCLUIDO"]), "realizada");
  assert.equal(situacaoPorDocs(["DELETADO"]), "aberta");
});

test("AET e DRPS/Questionário viram oportunidades, com a situação pelo que a empresa já tem", () => {
  const r = montarComercial([aep("A1", "E1", [setorAet])], [{ id_empresa: "E1", tipo: "QPS", status: "RASCUNHO" }]);
  assert.equal(r.length, 1);
  const [c] = r;
  assert.deepEqual(
    c.oportunidades.map((o) => [o.produto, o.situacao]),
    [["AET", "aberta"], ["DRPS/Questionário", "andamento"]],
  );
  assert.deepEqual(c.oportunidades[0].setores, [{ nome: "Produção", expostos: 12, cargos: 1 }]);
  assert.equal(c.expostosAet, 12);
  assert.equal(c.telefone, "21 9999");
});

test("AET indicada só pela ergonomia física também entra; sem indicação nenhuma não entra", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [{ id: "x", nome_setor: "ADM", necessita_aet: false, checklist_organizacional: {} }])],
    [],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E1"]);
  assert.equal(r[0].oportunidades[0].produto, "AET");
  assert.equal(r[0].expostosAet, 5);
});

test("AET já concluída fica como realizada; abertas vêm primeiro", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [setorSoFisico])],
    [{ id_empresa: "E1", tipo: "AET", status: "CONCLUIDO" }],
  );
  assert.deepEqual(r.map((c) => [c.empresa.idEmpresa, c.oportunidades[0].situacao]), [["E2", "aberta"], ["E1", "realizada"]]);
});

test("CSV: cabeçalho + uma linha por oportunidade", () => {
  const r = montarComercial([aep("A1", "E1", [setorAet])], []);
  const csv = linhasCsv(r, () => "Serra");
  assert.equal(csv.length, 3);
  assert.equal(csv[1][2], "Serra");
  assert.equal(csv[1][6], "AET");
  assert.equal(csv[1][9], "12");
});
```

### E: diff de `lib/hooks/useAep.ts`

```diff
@@ -136,7 +136,7 @@ function normalizarSetor(s: unknown): AepSetor {
   };
 }
 
-function normalizarRelatorio(data: unknown): AepRelatorio {
+export function normalizarRelatorio(data: unknown): AepRelatorio {
   const rel = data as Record<string, unknown>;
   return {
     ...rel,
```

### F: `lib/hooks/useComercial.ts` (novo, completo)

```ts
"use client";

// Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
// que só devolve AEPs entregues ao cliente e a situação dos documentos de cada
// empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizarRelatorio } from "@/lib/hooks/useAep";
import { montarComercial, type DocEmpresa } from "@/lib/comercial/oportunidades";

export function useComercial() {
  return useQuery({
    queryKey: ["comercial-dados"],
    queryFn: async () => {
      const { data, error } = await createSupabaseBrowserClient().rpc("comercial_dados" as never);
      if (error) throw error;
      const r = (data ?? {}) as { aeps?: unknown[]; docs?: DocEmpresa[] };
      const aeps = (r.aeps ?? []).map((a) => {
        const x = a as { entregue_em?: string | null; enviado_por?: string | null };
        return { ...normalizarRelatorio(a), entregue_em: x.entregue_em ?? null, enviado_por: x.enviado_por ?? null };
      });
      return montarComercial(aeps, r.docs ?? []);
    },
  });
}
```

### G: `app/(comercial)/layout.tsx` (novo, completo)

```tsx
"use client";

// Módulo Comercial (2026-10-05): oportunidades de venda que as AEPs entregues
// indicaram (AET, DRPS/Questionário). Precisa do módulo "comercial" na conta;
// os dados vêm da RPC `comercial_dados`, que confere a mesma permissão.

import { type ReactNode } from "react";
import { Grid3x3, Handshake, Home } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const SECTIONS: NavSection[] = [
  {
    label: "Comercial",
    items: [
      { href: "/comercial", label: "Oportunidades", icon: Handshake },
      { href: "/comercial-matriz-aiha", label: "Matriz AIHA", icon: Grid3x3 },
    ],
  },
  {
    label: "Navegação",
    items: [{ href: "/inicio", label: "Início", icon: Home }],
  },
];

export default function ComercialLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("comercial");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Comercial"
        subtitle="Oportunidades"
        logoHref="/comercial"
        sections={SECTIONS}
        backHref="/modulos"
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

### H: `app/(comercial)/comercial/page.tsx` (novo, completo)

```tsx
"use client";

// Comercial › Oportunidades (2026-10-05). Para quem vende: cada empresa cuja
// AEP entregue indicou um serviço vendido à parte (AET) ou o DRPS/Questionário
// Psicossocial, com a situação (aberta / em andamento / realizada), os setores
// indicados, trabalhadores expostos (base do orçamento) e o contato da empresa.
// Regra em lib/comercial/oportunidades.ts.

import { useMemo, useState, type ReactNode } from "react";
import { Building2, Download, FilterX, Handshake, Mail, MapPin, Phone, Search } from "lucide-react";
import { useComercial } from "@/lib/hooks/useComercial";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { linhasCsv, type EmpresaComercial, type Produto, type SituacaoOportunidade } from "@/lib/comercial/oportunidades";
import { opcoesDistintas } from "@/lib/aep/sinalizacao-filtros";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const selectCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

const SITUACAO: Record<SituacaoOportunidade, { rotulo: string; cls: string; dica: string }> = {
  aberta: { rotulo: "Oportunidade aberta", cls: "border-amber-300 bg-amber-50 text-amber-900", dica: "Indicada na AEP e a empresa ainda não tem" },
  andamento: { rotulo: "Em andamento", cls: "border-sky-200 bg-sky-50 text-sky-900", dica: "Já existe um documento em elaboração" },
  realizada: { rotulo: "Realizada", cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dica: "Já existe um documento concluído" },
};

function Contador({ rotulo, valor, cor, ativo, onClick }: { rotulo: string; valor: ReactNode; cor: string; ativo?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn("rounded-xl border p-3 text-left transition", cor, onClick && "hover:shadow-sm", ativo && "ring-2 ring-verde-primary ring-offset-1")}
    >
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs font-medium">{rotulo}</div>
    </button>
  );
}

function baixarCsv(linhas: string[][]) {
  const esc = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // BOM para o Excel abrir com acento; separador ";".
  const csv = "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `oportunidades-comerciais-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ComercialPage() {
  const { data: lista = [], isLoading, error } = useComercial();
  const { data: unidades = [] } = useUnidades();
  const nomeUnidade = useMemo(() => new Map(unidades.map((u) => [u.id_unidade, u.nome])), [unidades]);
  const unidadeDe = (id: string | null) => (id && nomeUnidade.get(id)) || "";

  const [busca, setBusca] = useState("");
  const [produto, setProduto] = useState<"" | Produto>("");
  const [situacao, setSituacao] = useState<"" | SituacaoOportunidade>("aberta");
  const [unidade, setUnidade] = useState("");
  const [nivel, setNivel] = useState("");

  const opcoesUnidade = useMemo(
    () =>
      opcoesDistintas(lista.map((c) => c.empresa.idUnidade))
        .map((id) => ({ id, nome: nomeUnidade.get(id) ?? id }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [lista, nomeUnidade]
  );

  // Filtra as OPORTUNIDADES dentro de cada empresa; empresa sem nenhuma sai.
  const filtradas = useMemo(() => {
    const porBusca = busca.trim()
      ? buscar(lista, busca, (c) => [
          c.empresa.nome,
          c.empresa.cnpj ?? "",
          unidadeDe(c.empresa.idUnidade),
          c.empresa.municipio ?? "",
        ]).itens
      : lista;
    return porBusca
      .filter((c) => (!unidade || c.empresa.idUnidade === unidade))
      .filter((c) => {
        if (!nivel) return true;
        if (nivel === "altos") return c.empresa.pior === "Alto" || c.empresa.pior === "Muito Alto";
        return c.empresa.pior === nivel;
      })
      .map((c) => ({
        ...c,
        oportunidades: c.oportunidades.filter((o) => (!produto || o.produto === produto) && (!situacao || o.situacao === situacao)),
      }))
      .filter((c) => c.oportunidades.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, busca, produto, situacao, unidade, nivel, nomeUnidade]);

  const todas = lista.flatMap((c) => c.oportunidades.map((o) => ({ c, o })));
  const abertas = (p: Produto) => todas.filter(({ o }) => o.produto === p && o.situacao === "aberta");
  const kpi = {
    aet: abertas("AET").length,
    drps: abertas("DRPS/Questionário").length,
    expostos: abertas("AET").reduce((n, { c }) => n + c.expostosAet, 0),
    andamento: todas.filter(({ o }) => o.situacao === "andamento").length,
  };
  const nAtivos = [busca.trim(), produto, situacao !== "aberta" ? situacao || "todas" : "", unidade, nivel].filter(Boolean).length;
  const limpar = () => {
    setBusca("");
    setProduto("");
    setSituacao("aberta");
    setUnidade("");
    setNivel("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Handshake className="size-5 text-amber-700" /> Oportunidades comerciais
          </h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Serviços que as AEPs <strong>já entregues ao cliente</strong> indicaram e que a empresa ainda não contratou:
            a <strong>AET</strong> (vendida à parte), quando algum setor tem indicação de análise completa (NR-17), e o{" "}
            <strong>DRPS / Questionário Psicossocial</strong>, quando a AEP aponta 3 ou mais fatores organizacionais
            (NR-01).
          </p>
        </div>
        <button
          type="button"
          disabled={filtradas.length === 0}
          onClick={() => baixarCsv(linhasCsv(filtradas, unidadeDe))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="size-4" /> Exportar (Excel)
        </button>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Contador
          rotulo="AET em aberto"
          valor={kpi.aet}
          cor="border-amber-300 bg-amber-50 text-amber-900"
          ativo={produto === "AET" && situacao === "aberta"}
          onClick={() => {
            setProduto("AET");
            setSituacao("aberta");
          }}
        />
        <Contador
          rotulo="Trabalhadores expostos (AET em aberto)"
          valor={kpi.expostos}
          cor="border-orange-200 bg-orange-50 text-orange-900"
        />
        <Contador
          rotulo="DRPS/Questionário em aberto"
          valor={kpi.drps}
          cor="border-violet-200 bg-violet-50 text-violet-900"
          ativo={produto === "DRPS/Questionário" && situacao === "aberta"}
          onClick={() => {
            setProduto("DRPS/Questionário");
            setSituacao("aberta");
          }}
        />
        <Contador
          rotulo="Em andamento"
          valor={kpi.andamento}
          cor="border-sky-200 bg-sky-50 text-sky-900"
          ativo={!produto && situacao === "andamento"}
          onClick={() => {
            setProduto("");
            setSituacao("andamento");
          }}
        />
      </div>

      {/* Busca + filtros */}
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ, unidade ou município..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-8 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] font-medium text-gray-500">
            Produto
            <select value={produto} onChange={(e) => setProduto(e.target.value as "" | Produto)} className={selectCls}>
              <option value="">Todos</option>
              <option value="AET">AET</option>
              <option value="DRPS/Questionário">DRPS/Questionário</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Situação
            <select value={situacao} onChange={(e) => setSituacao(e.target.value as "" | SituacaoOportunidade)} className={selectCls}>
              <option value="">Todas</option>
              <option value="aberta">Oportunidade aberta</option>
              <option value="andamento">Em andamento</option>
              <option value="realizada">Realizada</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Unidade
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className={selectCls}>
              <option value="">Todas</option>
              {opcoesUnidade.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Nível AIHA
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              <option value="altos">Alto ou Muito Alto</option>
              {["Muito Alto", "Alto", "Moderado", "Baixo", "Trivial"].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filtradas.length} empresa{filtradas.length !== 1 ? "s" : ""} ·{" "}
            {filtradas.reduce((n, c) => n + c.oportunidades.length, 0)} oportunidade(s)
          </span>
          {nAtivos > 0 && (
            <button type="button" onClick={limpar} className="inline-flex items-center gap-1 font-semibold text-verde-primary hover:underline">
              <FilterX className="size-3.5" /> Voltar ao padrão (abertas)
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as oportunidades: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {lista.length === 0
            ? "Nenhuma AEP entregue indicou AET ou DRPS/Questionário até agora."
            : "Nenhuma oportunidade com esses filtros."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtradas.map((c) => (
            <CartaoEmpresa key={c.empresa.idEmpresa} c={c} unidade={unidadeDe(c.empresa.idUnidade)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoEmpresa({ c, unidade }: { c: EmpresaComercial; unidade: string }) {
  const e = c.empresa;
  const regiao = [e.municipio, e.uf].filter(Boolean).join("/");
  return (
    <li className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <Building2 className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-gray-900">{e.nome}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span>{e.cnpj ? formatCNPJ(e.cnpj) : "—"}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              <span className="font-medium text-gray-700">{unidade || "Sem unidade"}</span>
              {regiao && <span className="text-gray-400">· {regiao}</span>}
            </span>
            {c.telefone && (
              <a href={`tel:${c.telefone}`} className="inline-flex items-center gap-1 hover:text-verde-primary">
                <Phone className="size-3" /> {c.telefone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-verde-primary">
                <Mail className="size-3" /> {c.email}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {e.pior && <SeloNivelAiha nivel={e.pior} />}
          <span>AEP entregue {e.ultimaData ? fmtData(e.ultimaData) : "—"}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {c.oportunidades.map((o) => {
          const s = SITUACAO[o.situacao];
          return (
            <div key={o.produto} className={cn("rounded-xl border p-3", s.cls)} title={s.dica}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{o.produto === "AET" ? "AET – Análise Ergonômica do Trabalho" : "DRPS / Questionário Psicossocial"}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{s.rotulo}</span>
              </div>
              {o.produto === "AET" ? (
                <div className="mt-1 text-xs">
                  <div>
                    <strong>{o.setores.length}</strong> setor{o.setores.length !== 1 ? "es" : ""} indicado{o.setores.length !== 1 ? "s" : ""} ·{" "}
                    <strong>{c.expostosAet}</strong> trabalhador{c.expostosAet !== 1 ? "es" : ""} exposto{c.expostosAet !== 1 ? "s" : ""}
                  </div>
                  <div className="mt-0.5 opacity-80">
                    {o.setores.map((st) => `${st.nome}${st.expostos ? ` (${st.expostos})` : ""}`).join(" · ")}
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-xs">
                  A AEP apontou <strong>{e.totalAlertas}</strong> fator{e.totalAlertas !== 1 ? "es" : ""} organizacional
                  {e.totalAlertas !== 1 ? "is" : ""} em {e.totalSetores} setor{e.totalSetores !== 1 ? "es" : ""}.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        AEP realizada por <strong className="text-gray-700">{e.realizadaPor ?? "—"}</strong>
        {e.temInspecao ? (
          <>
            {" "}· enviada por <strong className="text-gray-700">{e.enviadoPor ?? "—"}</strong>
          </>
        ) : (
          " · sem inspeção"
        )}
      </div>
    </li>
  );
}
```

### I: `app/(comercial)/comercial-matriz-aiha/page.tsx` (novo, completo)

```tsx
"use client";

// Matriz AIHA no módulo Comercial: a mesma explicação técnica e normativa, para
// o vendedor saber explicar ao cliente de onde vem a indicação de AET.

import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function ComercialMatrizAihaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ExplicacaoMatrizAiha fixo />
    </div>
  );
}
```

### J: diff de `app/(hub)/modulos/page.tsx`

```diff
@@ -31,11 +31,13 @@ import {
   KanbanSquare,
   Radio,
   Gauge,
+  Handshake,
 } from "lucide-react";
 import toast from "react-hot-toast";
 import { useUserStore } from "@/lib/store";
 import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
 import { useHomeStats, type ModuloStats } from "@/lib/hooks/useHomeStats";
+import { useComercial } from "@/lib/hooks/useComercial";
 import { useMeuPapelGestao } from "@/lib/hooks/useGestaoAcesso";
 import { vePresencaAuditoria } from "@/lib/hooks/useUsuario";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
@@ -504,7 +506,7 @@ function InicioContent() {
             // +1 Empresa (todos internos) + Gestão Gerencial (quem tem o módulo)
             // + PDFs (admin) + Gestão Chabra (quem está no roster) + Presença (admin ou gerência, v231).
             const totalCards =
-              visibleCats.length + 1 + (modulosPermitidos.has("gestao_gerencial") ? 1 : 0) + (isAdmin ? 1 : 0) + (vePresenca ? 1 : 0) + (temGestaoChabra ? 1 : 0);
+              visibleCats.length + 1 + (modulosPermitidos.has("gestao_gerencial") ? 1 : 0) + (modulosPermitidos.has("comercial") ? 1 : 0) + (isAdmin ? 1 : 0) + (vePresenca ? 1 : 0) + (temGestaoChabra ? 1 : 0);
             return (
               <div
                 className={cn(
@@ -540,6 +542,7 @@ function InicioContent() {
                   );
                 })}
                 <EmpresaDirectCard />
+                {modulosPermitidos.has("comercial") && <ComercialDirectCard />}
                 {modulosPermitidos.has("gestao_gerencial") && <GestaoGerencialDirectCard />}
                 {isAdmin && <PdfDirectCard />}
                 {temGestaoChabra && <GestaoChabraDirectCard />}
@@ -698,6 +701,57 @@ function EmpresaDirectCard() {
   );
 }
 
+/**
+ * Comercial (2026-10-05) direto na tela principal, como Empresas: o que as
+ * AEPs entregues indicaram e a empresa ainda não contratou (AET, DRPS/
+ * Questionário). Mostra quantas oportunidades estão em aberto.
+ */
+function ComercialDirectCard() {
+  const accent = "#B45309";
+  const { data: lista, isLoading } = useComercial();
+  const abertas = (lista ?? []).reduce(
+    (n, c) => n + c.oportunidades.filter((o) => o.situacao === "aberta").length,
+    0,
+  );
+  return (
+    <Link
+      href="/comercial"
+      className="group flex w-full flex-col gap-4 glass tilt-3d sheen reveal-up rounded-2xl p-6 text-left"
+    >
+      <div className="flex items-start gap-4">
+        <div
+          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
+          style={{ backgroundColor: accent }}
+        >
+          <Handshake className="size-12" />
+        </div>
+        <div className="min-w-0 flex-1">
+          <h2 className="text-lg font-bold text-gray-900">Comercial</h2>
+          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
+            Oportunidades de venda das AEPs entregues: AET e DRPS/Questionário
+          </p>
+        </div>
+      </div>
+      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
+        <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ backgroundColor: accent }}>
+          Vendas
+        </span>
+        <span className={abertas > 0 ? "font-medium text-amber-700" : "text-gray-500"}>
+          {isLoading
+            ? "Carregando..."
+            : abertas > 0
+              ? `${abertas} oportunidade${abertas !== 1 ? "s" : ""} em aberto`
+              : "Nenhuma em aberto"}
+        </span>
+        <ArrowRight
+          className="ml-auto size-4 transition-transform group-hover:translate-x-1"
+          style={{ color: accent }}
+        />
+      </div>
+    </Link>
+  );
+}
+
 function GestaoGerencialDirectCard() {
   const accent = "#00432F";
   return (
```

## Passo 4: verificar

1. Rode `npm test` (os 5 testes de `lib/comercial/oportunidades.test.ts` passam), `npx tsc --noEmit -p .` e `npx next build`; todos devem terminar sem erros.
2. **Admin:**
   - saia e entre de novo, para recarregar a permissão;
   - a tela de Módulos mostra o card **Comercial** ao lado de Empresas, com "N oportunidades em aberto";
   - clicar abre `/comercial`.
3. **Com uma AEP entregue ao cliente:**
   - a AEP tem um setor com Necessita AET e 3+ fatores organizacionais;
   - a empresa aparece com as duas oportunidades em **aberta**;
   - crie uma AET em rascunho para a empresa: a oportunidade de AET passa a **em andamento**;
   - conclua a AET: ela passa a **realizada**.
4. **Filtros e exportação:** os contadores e os filtros reduzem a lista, e **Exportar (Excel)** baixa um CSV que abre no Excel com acentos.
5. **Permissão:**
   - um usuário com só o módulo Comercial, sem AEP, AET ou DRPS, vê a página com os dados;
   - um usuário sem o módulo não vê o card, e na URL `/comercial` é redirecionado para Módulos.
6. Libere o módulo para o time de vendas em Sistema › Usuários ("Comercial – Oportunidades de venda").
7. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

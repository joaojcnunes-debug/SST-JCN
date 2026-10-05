# Replicar no Painel SST: Sinalização com cartões e filtros, e status "Em andamento" da AEP

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-sinalizacao-filtros-e-status-aep.md`"*.
>
> Origem: JCN (`sst-jcn`), commits de 2026-10-05 posteriores ao `ca93388`, já em produção lá.
> **Tem 1 migration** (v266, seção A). O código está nas seções A a M.

## Pré-requisito

Aplique antes o MD `replicar-no-painel-aep-entrega-e-setores-da-empresa.md`
(e os que ele pede). Este MD continua de onde aquele parou: os diffs são contra
o estado depois dele.

## O que faz

### 1. Status "Em andamento" da AEP (v266)

- **Fluxo:** Rascunho → **Em andamento** → Concluído (= enviado ao cliente).
- **Dados / Conclusão:** os três botões, com as cores cinza, amarelo e verde.
- **Constantes novas:** `STATUS_LABEL_AEP`, `STATUS_COR_AEP` e `STATUS_ORDEM_AEP` em `useAep.ts`.
- **Dashboard AEP:** cartões Análises · Rascunho · Em andamento · Concluídas ·
  Requer AET · Riscos. Clicar num cartão de status filtra a lista; clicar de
  novo limpa.
- **Lista de Análises:** o selo de cada análise tem a cor do status.
- A Sinalização continua exigindo **Concluído** para AEP sem inspeção.

### 2. Sinalização: o que a empresa precisa e quem fez

Cada empresa mostra, da AEP entregue mais recente:

| Informação | Regra |
|---|---|
| **DRPS/Questionário** | "Necessário" quando a AEP tem **3+ alertas organizacionais**. É a regra `recomendaQuestionario`, a mesma do aviso do editor, que passa a usá-la também. Embaixo vem o que a empresa **já tem**, por `situacaoQuestionario` sobre `drps_relatorios` e `qps_aplicacoes`: "DRPS concluído", "Questionário em andamento" ou "Nenhum feito". Concluído/enviado vence andamento, e no empate o DRPS vem antes. |
| **AET** | "Necessário" se algum setor tem Necessita AET. |
| **Realizada por** | `responsavel_elaboracao` da AEP. |
| **Enviada por** | `inspecoes.elaboracao_responsavel`: o associado que concluiu o documento. Sem inspeção, mostra "Sem inspeção". |
| **Unidade · Região** | `empresas.id_unidade` → `unidades.nome` (a "Região" do SGG), e o município/UF do cadastro. |

A página da empresa repete isso por AEP e mostra Unidade e Região no cadastro.

### 3. Sinalização: cartões, contadores e filtros

- **Cartões:**
  - cada empresa vira um cartão;
  - linha 1: nome, CNPJ, unidade · região e o selo do nível;
  - linha 2: os blocos DRPS/Questionário, AET, Realizada por, Enviada por, Alertas, Setores e Entregue em;
  - DRPS pendente e AET necessária ficam em **âmbar**.
- **Contadores clicáveis no topo:** Empresas sinalizadas (limpa os filtros),
  Nível Alto/Muito Alto, **DRPS/Questionário pendente** (necessário e sem
  nenhum concluído) e AET necessária.
- **Filtros embaixo da busca** (`lib/aep/sinalizacao-filtros.ts`, testado):
  - Unidade;
  - Nível AIHA, incluindo "Alto ou Muito Alto";
  - DRPS/Questionário: necessário / necessário e não concluído / não necessário;
  - AET;
  - Entrega: com ou sem inspeção;
  - Realizada por;
  - Enviada por.

  Junto vêm a contagem "N de M empresas" e o botão "Limpar filtros". A busca
  procura também por unidade e município.

## Passo 1: conferir o painel

| Usado pelo código | Conferir no painel |
|---|---|
| CHECK de `aep_relatorios.status` | a v266 o recria com `RASCUNHO`, `EM_ANDAMENTO` e `CONCLUIDO`; se o painel tiver outro status, inclua-o |
| `drps_relatorios` e `qps_aplicacoes` com `id_empresa` e `status` (`RASCUNHO`, `EM_ANDAMENTO`, `CONCLUIDO`, `ENVIADO_CLIENTE`) | mesmos nomes; ajuste `FASE_DOC` em `sinalizacao.ts` se os status forem outros |
| `inspecoes.elaboracao_responsavel` | o nome gravado ao concluir o documento |
| `empresas.id_unidade`, `municipio`, `uf`, e `useUnidades()` em `lib/hooks/useUnidades.ts` | se o painel tiver um campo de região próprio, use-o no lugar de município/UF |
| Home/Início contando AEP por status (`useHomeStats`) | no JCN já tratava `EM_ANDAMENTO`; confira no painel |

## Passo 2: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `supabase/historico/v266_aep_status_em_andamento.sql` | migration (rodar no banco do **painel**) |
| B | `lib/supabase/types.ts` | `StatusAEP` com `EM_ANDAMENTO` |
| C, D | `lib/aep/sinalizacao.ts` + teste | `recomendaQuestionario`, `situacaoQuestionario`, campos novos da empresa |
| E, F | `lib/aep/sinalizacao-filtros.ts` + teste | **novo**: filtros |
| G | `lib/hooks/useAep.ts` | status, `useSituacaoQuestionarioEmpresas`, dados extras em `useAepsEntregues` |
| H | `components/aep/SinalizacaoEmpresasLista.tsx` | **substituir**: cartões, contadores e filtros |
| I | `components/aep/SinalizacaoEmpresaDetalhe.tsx` | informações por AEP, unidade e região |
| J | `components/aep/AepSetoresEditor.tsx` | aviso do questionário usa a regra compartilhada |
| K | `components/aep/AepDadosEditor.tsx` | 3 botões de status |
| L, M | Dashboard e lista de Análises da AEP | cartões por status e selos |

Rollback da v266:

```sql
update public.aep_relatorios set status = 'RASCUNHO' where status = 'EM_ANDAMENTO';
alter table public.aep_relatorios drop constraint if exists aep_relatorios_status_check;
alter table public.aep_relatorios add constraint aep_relatorios_status_check
  check (status = any (array['RASCUNHO'::text, 'CONCLUIDO'::text]));
```

### A: `supabase/historico/v266_aep_status_em_andamento.sql` (novo, completo)

```sql
-- v266 (2026-10-05): AEP ganha o status EM_ANDAMENTO
-- (Rascunho → Em andamento → Concluído), para o dashboard separar o que está
-- sendo feito do que só foi aberto. Já aplicada via MCP.
-- Rollback: scripts/sql/v266_rollback_aep_status_em_andamento.sql
alter table public.aep_relatorios drop constraint if exists aep_relatorios_status_check;
alter table public.aep_relatorios add constraint aep_relatorios_status_check
  check (status = any (array['RASCUNHO'::text, 'EM_ANDAMENTO'::text, 'CONCLUIDO'::text]));
```

### B: diff de `lib/supabase/types.ts`

```diff
@@ -2357,7 +2357,7 @@ export interface AuditoriaTabela {
 
 // ─── AEP – Análise Ergonômica Preliminar ─────────────────────────────────────
 
-export type StatusAEP = "RASCUNHO" | "CONCLUIDO";
+export type StatusAEP = "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDO";
 
 export interface AepRisco {
   id: string;
```

### C: diff de `lib/aep/sinalizacao.ts`

```diff
@@ -40,6 +40,12 @@ export interface AvaliacaoSinalizada {
   data: string | null;
   idInspecao: string | null;
   responsavel: string | null;
+  /** Associado que enviou (concluiu o documento da inspeção); null sem inspeção. */
+  enviadoPor: string | null;
+  /** Algum setor com "Necessita AET". */
+  precisaAet: boolean;
+  /** 3+ alertas organizacionais: recomenda DRPS/Questionário. */
+  precisaQuestionario: boolean;
   status: string;
   setores: SetorSinalizado[];
 }
@@ -54,6 +60,65 @@ export interface EmpresaSinalizada {
   totalAltos: number;
   pior: string | null;
   ultimaData: string | null;
+  /** Da AEP entregue mais recente da empresa. */
+  precisaAet: boolean;
+  precisaQuestionario: boolean;
+  realizadaPor: string | null;
+  enviadoPor: string | null;
+  temInspecao: boolean;
+  /** Cadastro da empresa: unidade (= região no SGG) e município/UF. */
+  idUnidade: string | null;
+  municipio: string | null;
+  uf: string | null;
+}
+
+/** Mínimo de alertas organizacionais ("Sim") na AEP para recomendar DRPS/Questionário. */
+export const MIN_ALERTAS_QUESTIONARIO = 3;
+
+/** Total de fatores organizacionais marcados "Sim" em todos os setores da AEP. */
+export function totalAlertasOrganizacionais(setores: AepRelatorio["setores"]): number {
+  return (setores ?? []).reduce(
+    (n, s) =>
+      n + Object.values((s.checklist_organizacional ?? {}) as unknown as Record<string, string>).filter((v) => v === "sim").length,
+    0,
+  );
+}
+
+/**
+ * A AEP recomenda aprofundar com DRPS/Questionário Psicossocial (NR-01) quando
+ * há 3+ alertas organizacionais — a mesma regra do aviso do editor da AEP.
+ */
+export function recomendaQuestionario(setores: AepRelatorio["setores"]): boolean {
+  return totalAlertasOrganizacionais(setores) >= MIN_ALERTAS_QUESTIONARIO;
+}
+
+/** Situação do DRPS/Questionário Psicossocial que a empresa JÁ TEM. */
+export interface SituacaoQuestionario {
+  /** "concluido" = concluído ou enviado ao cliente; "andamento" = rascunho/em andamento. */
+  fase: "concluido" | "andamento" | null;
+  /** Qual documento define a frase: DRPS ou Questionário. */
+  doc: "DRPS" | "Questionário" | null;
+}
+
+const FASE_DOC: Record<string, "concluido" | "andamento"> = {
+  CONCLUIDO: "concluido",
+  ENVIADO_CLIENTE: "concluido",
+  RASCUNHO: "andamento",
+  EM_ANDAMENTO: "andamento",
+};
+
+/**
+ * O melhor estado entre os DRPS e Questionários (QPS) da empresa: concluído
+ * vence andamento; DRPS vem antes do Questionário no empate. Deletados e
+ * outros status não contam (mesma régua do quadro Documentos da empresa).
+ */
+export function situacaoQuestionario(statusDrps: (string | null)[], statusQps: (string | null)[]): SituacaoQuestionario {
+  const fase = (lista: (string | null)[], f: "concluido" | "andamento") => lista.some((s) => FASE_DOC[s ?? ""] === f);
+  for (const f of ["concluido", "andamento"] as const) {
+    if (fase(statusDrps, f)) return { fase: f, doc: "DRPS" };
+    if (fase(statusQps, f)) return { fase: f, doc: "Questionário" };
+  }
+  return { fase: null, doc: null };
 }
 
 export function piorNivel(niveis: (string | null | undefined)[]): string | null {
@@ -65,7 +130,11 @@ export function piorNivel(niveis: (string | null | undefined)[]): string | null
 }
 
 /** AEP com a data em que o documento da inspeção foi entregue ao cliente. */
-export type AepEntregue = AepRelatorio & { entregue_em?: string | null };
+export type AepEntregue = AepRelatorio & {
+  entregue_em?: string | null;
+  /** Associado que concluiu (enviou) o documento da inspeção; null sem inspeção. */
+  enviado_por?: string | null;
+};
 
 export function montarSinalizacao(relatorios: AepEntregue[]): EmpresaSinalizada[] {
   const porEmpresa = new Map<string, EmpresaSinalizada>();
@@ -100,18 +169,27 @@ export function montarSinalizacao(relatorios: AepEntregue[]): EmpresaSinalizada[
     if (setores.length === 0) continue;
 
     const id = rel.id_empresa;
+    const cad = rel.empresas as { id_unidade?: string | null; municipio?: string | null; uf?: string | null } | null;
     let alvo = porEmpresa.get(id);
     if (!alvo) {
       alvo = {
         idEmpresa: id,
         nome: rel.empresas?.nome_empresa ?? "Empresa sem cadastro",
         cnpj: rel.empresas?.cnpj ?? null,
+        idUnidade: cad?.id_unidade ?? null,
+        municipio: cad?.municipio ?? null,
+        uf: cad?.uf ?? null,
         avaliacoes: [],
         totalSetores: 0,
         totalAlertas: 0,
         totalAltos: 0,
         pior: null,
         ultimaData: null,
+        precisaAet: false,
+        precisaQuestionario: false,
+        realizadaPor: null,
+        enviadoPor: null,
+        temInspecao: false,
       };
       porEmpresa.set(id, alvo);
     }
@@ -120,6 +198,9 @@ export function montarSinalizacao(relatorios: AepEntregue[]): EmpresaSinalizada[
       data: rel.entregue_em ?? rel.data_elaboracao,
       idInspecao: (rel as { id_inspecao?: string | null }).id_inspecao ?? null,
       responsavel: rel.responsavel_elaboracao || null,
+      enviadoPor: rel.enviado_por?.trim() || null,
+      precisaAet: (rel.setores ?? []).some((s) => s.necessita_aet),
+      precisaQuestionario: recomendaQuestionario(rel.setores),
       status: rel.status,
       setores,
     });
@@ -137,6 +218,12 @@ export function montarSinalizacao(relatorios: AepEntregue[]): EmpresaSinalizada[
     );
     e.pior = piorNivel(todos.map((s) => s.pior));
     e.ultimaData = e.avaliacoes[0]?.data ?? null;
+    const ultima = e.avaliacoes[0];
+    e.precisaAet = ultima?.precisaAet ?? false;
+    e.precisaQuestionario = ultima?.precisaQuestionario ?? false;
+    e.realizadaPor = ultima?.responsavel ?? null;
+    e.enviadoPor = ultima?.enviadoPor ?? null;
+    e.temInspecao = !!ultima?.idInspecao;
   }
   // Mais grave primeiro; empate pelo nome.
   return lista.sort(
```

### D: diff de `lib/aep/sinalizacao.test.ts`

```diff
@@ -1,7 +1,7 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 
-import { montarSinalizacao, piorNivel } from "./sinalizacao";
+import { montarSinalizacao, piorNivel, recomendaQuestionario, situacaoQuestionario } from "./sinalizacao";
 import type { AepRelatorio } from "@/lib/supabase/types";
 
 function rel(id: string, empresa: string, data: string, setores: unknown[]): AepRelatorio {
@@ -63,3 +63,26 @@ test("pior nível", () => {
   assert.equal(piorNivel(["Baixo", null, "Alto", "Moderado"]), "Alto");
   assert.equal(piorNivel([null, undefined]), null);
 });
+
+test("DRPS/Questionário a partir de 3 alertas organizacionais; AET e quem enviou vêm da AEP mais recente", () => {
+  const tres = { ...setorComAssedio, checklist_organizacional: { assedio: "sim", sobrecarga: "sim", baixo_controle: "sim" }, necessita_aet: true };
+  assert.equal(recomendaQuestionario([setorComAssedio] as never), false);
+  assert.equal(recomendaQuestionario([tres] as never), true);
+  const [e] = montarSinalizacao([
+    { ...rel("A1", "E1", "2026-01-01", [setorComAssedio]), entregue_em: "2026-01-05", enviado_por: "Ana" },
+    { ...rel("A2", "E1", "2026-02-01", [tres]), entregue_em: "2026-02-05", enviado_por: null, id_inspecao: "INS-1" } as never,
+  ]);
+  assert.equal(e.precisaQuestionario, true);
+  assert.equal(e.precisaAet, true);
+  assert.equal(e.realizadaPor, "Fulano");
+  assert.equal(e.enviadoPor, null);
+  assert.equal(e.temInspecao, true);
+});
+
+test("situação do DRPS/Questionário: concluído vence andamento; DRPS antes do Questionário", () => {
+  assert.deepEqual(situacaoQuestionario([], []), { fase: null, doc: null });
+  assert.deepEqual(situacaoQuestionario(["DELETADO"], [null]), { fase: null, doc: null });
+  assert.deepEqual(situacaoQuestionario(["RASCUNHO"], ["ENVIADO_CLIENTE"]), { fase: "concluido", doc: "Questionário" });
+  assert.deepEqual(situacaoQuestionario(["EM_ANDAMENTO"], ["RASCUNHO"]), { fase: "andamento", doc: "DRPS" });
+  assert.deepEqual(situacaoQuestionario(["CONCLUIDO"], ["CONCLUIDO"]), { fase: "concluido", doc: "DRPS" });
+});
```

### E: `lib/aep/sinalizacao-filtros.ts` (novo, completo)

```ts
// Filtros da lista da Sinalização Psicossocial (2026-10-05). Puro, para testar
// sem tela: recebe as empresas montadas por `montarSinalizacao` e a situação do
// DRPS/Questionário de cada uma (`useSituacaoQuestionarioEmpresas`).

import type { EmpresaSinalizada, SituacaoQuestionario } from "@/lib/aep/sinalizacao";

export type FiltroQuestionario = "" | "necessario" | "pendente" | "nao";
export type FiltroSimNao = "" | "sim" | "nao";
export type FiltroEntrega = "" | "com" | "sem";

export interface FiltrosSinalizacao {
  unidade: string; // id_unidade; "" = todas
  nivel: string; // nível AIHA mais grave; "altos" = Alto ou Muito Alto
  questionario: FiltroQuestionario;
  aet: FiltroSimNao;
  entrega: FiltroEntrega;
  realizadaPor: string;
  enviadaPor: string;
}

export const FILTROS_VAZIOS: FiltrosSinalizacao = {
  unidade: "",
  nivel: "",
  questionario: "",
  aet: "",
  entrega: "",
  realizadaPor: "",
  enviadaPor: "",
};

export function filtrosAtivos(f: FiltrosSinalizacao): number {
  return Object.values(f).filter(Boolean).length;
}

/**
 * Pendência de DRPS/Questionário: a AEP recomenda e a empresa ainda não tem
 * nenhum CONCLUÍDO (nenhum feito ou só em andamento).
 */
export function questionarioPendente(e: EmpresaSinalizada, s: SituacaoQuestionario | undefined): boolean {
  return e.precisaQuestionario && s?.fase !== "concluido";
}

export function filtrarSinalizacao(
  empresas: EmpresaSinalizada[],
  f: FiltrosSinalizacao,
  questionarios: Record<string, SituacaoQuestionario> | undefined,
): EmpresaSinalizada[] {
  return empresas.filter((e) => {
    if (f.unidade && e.idUnidade !== f.unidade) return false;
    if (f.nivel === "altos") {
      if (e.pior !== "Alto" && e.pior !== "Muito Alto") return false;
    } else if (f.nivel && e.pior !== f.nivel) return false;
    if (f.questionario === "necessario" && !e.precisaQuestionario) return false;
    if (f.questionario === "nao" && e.precisaQuestionario) return false;
    if (f.questionario === "pendente" && !questionarioPendente(e, questionarios?.[e.idEmpresa])) return false;
    if (f.aet === "sim" && !e.precisaAet) return false;
    if (f.aet === "nao" && e.precisaAet) return false;
    if (f.entrega === "com" && !e.temInspecao) return false;
    if (f.entrega === "sem" && e.temInspecao) return false;
    if (f.realizadaPor && e.realizadaPor !== f.realizadaPor) return false;
    if (f.enviadaPor && e.enviadoPor !== f.enviadaPor) return false;
    return true;
  });
}

/** Nomes distintos (sem vazios), em ordem alfabética — para as listas dos filtros. */
export function opcoesDistintas(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.map((v) => v?.trim()).filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}
```

### F: `lib/aep/sinalizacao-filtros.test.ts` (novo, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { FILTROS_VAZIOS, filtrarSinalizacao, filtrosAtivos, opcoesDistintas, questionarioPendente } from "./sinalizacao-filtros";
import type { EmpresaSinalizada } from "./sinalizacao";

function emp(id: string, p: Partial<EmpresaSinalizada>): EmpresaSinalizada {
  return {
    idEmpresa: id,
    nome: id,
    cnpj: null,
    avaliacoes: [],
    totalSetores: 1,
    totalAlertas: 1,
    totalAltos: 0,
    pior: "Moderado",
    ultimaData: null,
    precisaAet: false,
    precisaQuestionario: false,
    realizadaPor: "Ana",
    enviadoPor: null,
    temInspecao: false,
    idUnidade: null,
    municipio: null,
    uf: null,
    ...p,
  };
}

const lista = [
  emp("A", { pior: "Muito Alto", precisaAet: true, precisaQuestionario: true, idUnidade: "U1", temInspecao: true, enviadoPor: "Bia" }),
  emp("B", { pior: "Alto", precisaQuestionario: true, idUnidade: "U2" }),
  emp("C", { pior: "Baixo", idUnidade: "U1", realizadaPor: "Caio" }),
];
const quest = { A: { fase: "concluido" as const, doc: "DRPS" as const }, B: { fase: "andamento" as const, doc: "DRPS" as const } };
const ids = (r: EmpresaSinalizada[]) => r.map((e) => e.idEmpresa);

test("sem filtro devolve tudo", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, FILTROS_VAZIOS, quest)), ["A", "B", "C"]);
  assert.equal(filtrosAtivos(FILTROS_VAZIOS), 0);
});

test("unidade, nível e altos", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, unidade: "U1" }, quest)), ["A", "C"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, nivel: "altos" }, quest)), ["A", "B"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, nivel: "Baixo" }, quest)), ["C"]);
});

test("DRPS/Questionário: necessário, pendente (sem concluído) e não", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, questionario: "necessario" }, quest)), ["A", "B"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, questionario: "pendente" }, quest)), ["B"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, questionario: "nao" }, quest)), ["C"]);
  assert.equal(questionarioPendente(lista[1], undefined), true);
});

test("AET, entrega e pessoas", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, aet: "sim" }, quest)), ["A"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, entrega: "sem" }, quest)), ["B", "C"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, realizadaPor: "Caio" }, quest)), ["C"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, enviadaPor: "Bia", aet: "sim" }, quest)), ["A"]);
});

test("opções distintas", () => {
  assert.deepEqual(opcoesDistintas(["b", " a", null, "", "b"]), ["a", "b"]);
});
```

### G: diff de `lib/hooks/useAep.ts`

```diff
@@ -1,5 +1,6 @@
 "use client";
 
+import { situacaoQuestionario, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
 import { montarCatalogoSetores } from "@/lib/aep/catalogo-setores";
 import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
@@ -301,7 +302,7 @@ export function useAepsEntregues(empresaId?: string | null) {
       let q = supabase
         .from("aep_relatorios")
         .select(
-          "*, empresas(nome_empresa, cnpj), inspecoes!inner(id_inspecao, status, elaboracao_status, elaboracao_concluida_em)"
+          "*, empresas(nome_empresa, cnpj, municipio, uf, id_unidade), inspecoes!inner(id_inspecao, status, elaboracao_status, elaboracao_concluida_em, elaboracao_responsavel)"
         )
         .eq("inspecoes.elaboracao_status", "CONCLUIDO")
         .neq("inspecoes.status", "DELETADA")
@@ -314,7 +315,7 @@ export function useAepsEntregues(empresaId?: string | null) {
       }
       let q2 = supabase
         .from("aep_relatorios")
-        .select("*, empresas(nome_empresa, cnpj)")
+        .select("*, empresas(nome_empresa, cnpj, municipio, uf, id_unidade)")
         .is("id_inspecao", null)
         .eq("status", "CONCLUIDO")
         .order("created_at", { ascending: false });
@@ -328,12 +329,21 @@ export function useAepsEntregues(empresaId?: string | null) {
       if (semInsp.error) throw semInsp.error;
       return [
         ...(comInsp.data ?? []).map((r) => {
-          const insp = (r as { inspecoes?: { elaboracao_concluida_em?: string | null } | null }).inspecoes;
-          return { ...normalizarRelatorio(r), entregue_em: insp?.elaboracao_concluida_em ?? null };
+          const insp = (
+            r as {
+              inspecoes?: { elaboracao_concluida_em?: string | null; elaboracao_responsavel?: string | null } | null;
+            }
+          ).inspecoes;
+          return {
+            ...normalizarRelatorio(r),
+            entregue_em: insp?.elaboracao_concluida_em ?? null,
+            enviado_por: insp?.elaboracao_responsavel ?? null,
+          };
         }),
         ...(semInsp.data ?? []).map((r) => ({
           ...normalizarRelatorio(r),
           entregue_em: (r as { concluido_em?: string | null }).concluido_em ?? null,
+          enviado_por: null,
         })),
       ];
     },
@@ -341,6 +351,39 @@ export function useAepsEntregues(empresaId?: string | null) {
   });
 }
 
+/**
+ * Situação do DRPS e do Questionário Psicossocial (QPS) de cada empresa — para
+ * a Sinalização dizer se o que a AEP recomenda já foi feito.
+ */
+export function useSituacaoQuestionarioEmpresas(idsEmpresas: string[]) {
+  const ids = [...new Set(idsEmpresas)].sort();
+  return useQuery({
+    queryKey: ["situacao-questionario-empresas", ids],
+    enabled: ids.length > 0,
+    staleTime: 60_000,
+    queryFn: async (): Promise<Record<string, SituacaoQuestionario>> => {
+      // drps_* e qps_* não estão (todas) no tipo `Database`.
+      // eslint-disable-next-line @typescript-eslint/no-explicit-any
+      const sb = createSupabaseBrowserClient() as any;
+      const [d, q] = await Promise.all([
+        sb.from("drps_relatorios").select("id_empresa, status").in("id_empresa", ids),
+        sb.from("qps_aplicacoes").select("id_empresa, status").in("id_empresa", ids),
+      ]);
+      if (d.error) throw d.error;
+      if (q.error) throw q.error;
+      type Linha = { id_empresa: string; status: string | null };
+      const out: Record<string, SituacaoQuestionario> = {};
+      for (const id of ids) {
+        out[id] = situacaoQuestionario(
+          ((d.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => r.status),
+          ((q.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => r.status),
+        );
+      }
+      return out;
+    },
+  });
+}
+
 /**
  * Em que pé a AEP está em relação à Sinalização Psicossocial — para a faixa
  * do editor explicar por que ela aparece ou não.
@@ -670,5 +713,14 @@ export const CLASSIFICACOES_AEP: ClassificacaoRiscoAET[] = ["Trivial", "De Aten
 
 export const STATUS_LABEL_AEP: Record<StatusAEP, string> = {
   RASCUNHO: "Rascunho",
+  EM_ANDAMENTO: "Em andamento",
   CONCLUIDO: "Concluído",
 };
+
+/** Ordem do fluxo e cor do selo de cada status (v266). */
+export const STATUS_ORDEM_AEP: StatusAEP[] = ["RASCUNHO", "EM_ANDAMENTO", "CONCLUIDO"];
+export const STATUS_COR_AEP: Record<StatusAEP, string> = {
+  RASCUNHO: "bg-gray-100 text-gray-700",
+  EM_ANDAMENTO: "bg-yellow-100 text-yellow-700",
+  CONCLUIDO: "bg-emerald-100 text-emerald-700",
+};
```

### H: `components/aep/SinalizacaoEmpresasLista.tsx` (substituir, completo)

```tsx
"use client";

// Lista das empresas com fatores organizacionais marcados "Sim" nas triagens
// AEP. Mesma organização da página Riscos Psicossociais (2026-10-02): clicar
// abre a página da empresa, com os setores e o nível de cada fator na matriz
// AIHA. Sem link para o editor da AEP. Usada em /sinalizacao-psicossocial
// (módulo AEP) e em /aep-psicossocial (menu do Painel SST); `basePath` diz
// para onde vai o clique na empresa.
//
// 2026-10-05: cada empresa vira um cartão com as informações em destaque
// (DRPS/Questionário, AET, quem realizou, quem enviou, alertas, setores,
// entrega); contadores clicáveis no topo e filtros embaixo da busca.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Brain, Building2, ChevronRight, FilterX, MapPin, Search } from "lucide-react";
import { useAepsEntregues, useSituacaoQuestionarioEmpresas } from "@/lib/hooks/useAep";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { montarSinalizacao, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
import {
  FILTROS_VAZIOS,
  filtrarSinalizacao,
  filtrosAtivos,
  opcoesDistintas,
  questionarioPendente,
  type FiltrosSinalizacao,
} from "@/lib/aep/sinalizacao-filtros";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";
const selectCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

/** Bloco de informação do cartão: rótulo pequeno + valor em destaque. */
function Bloco({
  rotulo,
  destaque = false,
  title,
  children,
}: {
  rotulo: string;
  destaque?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      title={title}
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2",
        destaque ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{rotulo}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900">{children}</div>
    </div>
  );
}

function Necessario({ sim }: { sim: boolean }) {
  return sim ? <span className="text-amber-800">Necessário</span> : <span className="font-normal text-gray-500">Não</span>;
}

/** O que a empresa já tem de DRPS/Questionário. */
function JaTem({ s }: { s: SituacaoQuestionario | undefined }) {
  if (!s) return null;
  if (s.fase === "concluido") return <div className="text-[11px] font-medium text-emerald-700">{s.doc} concluído</div>;
  if (s.fase === "andamento") return <div className="text-[11px] font-medium text-sky-700">{s.doc} em andamento</div>;
  return <div className="text-[11px] font-medium text-red-600">Nenhum feito</div>;
}

/** Contador do topo; clicar aplica o filtro correspondente. */
function Contador({
  rotulo,
  valor,
  cor,
  ativo,
  onClick,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition hover:shadow-sm",
        cor,
        ativo && "ring-2 ring-verde-primary ring-offset-1"
      )}
    >
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs font-medium">{rotulo}</div>
    </button>
  );
}

export default function SinalizacaoEmpresasLista({
  basePath,
  titulo = "Sinalização de Fatores Psicossociais",
  extra,
}: {
  basePath: string;
  titulo?: string;
  /** Bloco opcional entre o cabeçalho e a busca (ex.: explicação da matriz). */
  extra?: ReactNode;
}) {
  const { data: relatorios = [], isLoading, error } = useAepsEntregues(null);
  const [busca, setBusca] = useState("");
  const [f, setF] = useState<FiltrosSinalizacao>(FILTROS_VAZIOS);
  const set = (patch: Partial<FiltrosSinalizacao>) => setF((atual) => ({ ...atual, ...patch }));

  const empresas = useMemo(() => montarSinalizacao(relatorios), [relatorios]);
  const { data: unidades = [] } = useUnidades();
  const nomeUnidade = useMemo(() => new Map(unidades.map((u) => [u.id_unidade, u.nome])), [unidades]);
  const { data: questionarios } = useSituacaoQuestionarioEmpresas(empresas.map((e) => e.idEmpresa));
  const regiao = (e: { municipio: string | null; uf: string | null }) =>
    [e.municipio, e.uf].filter(Boolean).join("/") || null;

  // Opções dos filtros: só o que existe na lista.
  const opcoesUnidade = useMemo(
    () =>
      opcoesDistintas(empresas.map((e) => e.idUnidade))
        .map((id) => ({ id, nome: nomeUnidade.get(id) ?? id }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [empresas, nomeUnidade]
  );
  const opcoesRealizada = useMemo(() => opcoesDistintas(empresas.map((e) => e.realizadaPor)), [empresas]);
  const opcoesEnviada = useMemo(() => opcoesDistintas(empresas.map((e) => e.enviadoPor)), [empresas]);

  const filtradas = useMemo(() => {
    const porBusca = busca.trim()
      ? buscar(empresas, busca, (e) => [
          e.nome,
          e.cnpj ?? "",
          (e.idUnidade && nomeUnidade.get(e.idUnidade)) || "",
          e.municipio ?? "",
          e.uf ?? "",
        ]).itens
      : empresas;
    return filtrarSinalizacao(porBusca, f, questionarios);
  }, [empresas, busca, nomeUnidade, f, questionarios]);

  const kpi = {
    altos: empresas.filter((e) => e.pior === "Alto" || e.pior === "Muito Alto").length,
    pendentes: empresas.filter((e) => questionarioPendente(e, questionarios?.[e.idEmpresa])).length,
    aet: empresas.filter((e) => e.precisaAet).length,
  };
  const nAtivos = filtrosAtivos(f) + (busca.trim() ? 1 : 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          {titulo}
        </h1>
        <p className="text-sm text-gray-500">
          Empresas com fatores organizacionais identificados nas AEPs já entregues ao cliente, com o nível na matriz
          AIHA. Clique na empresa para ver os fatores por setor.
        </p>
      </div>

      {extra}

      {/* Contadores — clicar filtra a lista */}
      {empresas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Contador
            rotulo="Empresas sinalizadas"
            valor={empresas.length}
            cor="border-emerald-200 bg-emerald-50 text-emerald-800"
            ativo={false}
            onClick={() => {
              setF(FILTROS_VAZIOS);
              setBusca("");
            }}
          />
          <Contador
            rotulo="Nível Alto / Muito Alto"
            valor={kpi.altos}
            cor="border-red-200 bg-red-50 text-red-800"
            ativo={f.nivel === "altos"}
            onClick={() => set({ nivel: f.nivel === "altos" ? "" : "altos" })}
          />
          <Contador
            rotulo="DRPS/Questionário pendente"
            valor={kpi.pendentes}
            cor="border-amber-200 bg-amber-50 text-amber-800"
            ativo={f.questionario === "pendente"}
            onClick={() => set({ questionario: f.questionario === "pendente" ? "" : "pendente" })}
          />
          <Contador
            rotulo="AET necessária"
            valor={kpi.aet}
            cor="border-orange-200 bg-orange-50 text-orange-800"
            ativo={f.aet === "sim"}
            onClick={() => set({ aet: f.aet === "sim" ? "" : "sim" })}
          />
        </div>
      )}

      {/* Busca + filtros */}
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ, unidade ou município..."
            className={cn(inputCls, "pl-8")}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <label className="text-[11px] font-medium text-gray-500">
            Unidade
            <select value={f.unidade} onChange={(e) => set({ unidade: e.target.value })} className={selectCls}>
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
            <select value={f.nivel} onChange={(e) => set({ nivel: e.target.value })} className={selectCls}>
              <option value="">Todos</option>
              <option value="altos">Alto ou Muito Alto</option>
              {["Muito Alto", "Alto", "Moderado", "Baixo", "Trivial"].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            DRPS/Questionário
            <select
              value={f.questionario}
              onChange={(e) => set({ questionario: e.target.value as FiltrosSinalizacao["questionario"] })}
              className={selectCls}
            >
              <option value="">Todos</option>
              <option value="necessario">Necessário</option>
              <option value="pendente">Necessário e ainda não concluído</option>
              <option value="nao">Não necessário</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            AET
            <select
              value={f.aet}
              onChange={(e) => set({ aet: e.target.value as FiltrosSinalizacao["aet"] })}
              className={selectCls}
            >
              <option value="">Todas</option>
              <option value="sim">Necessária</option>
              <option value="nao">Não necessária</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Entrega
            <select
              value={f.entrega}
              onChange={(e) => set({ entrega: e.target.value as FiltrosSinalizacao["entrega"] })}
              className={selectCls}
            >
              <option value="">Todas</option>
              <option value="com">Com inspeção</option>
              <option value="sem">Sem inspeção</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Realizada por
            <select value={f.realizadaPor} onChange={(e) => set({ realizadaPor: e.target.value })} className={selectCls}>
              <option value="">Todos</option>
              {opcoesRealizada.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Enviada por
            <select value={f.enviadaPor} onChange={(e) => set({ enviadaPor: e.target.value })} className={selectCls}>
              <option value="">Todos</option>
              {opcoesEnviada.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filtradas.length} de {empresas.length} empresa{empresas.length !== 1 ? "s" : ""}
          </span>
          {nAtivos > 0 && (
            <button
              type="button"
              onClick={() => {
                setF(FILTROS_VAZIOS);
                setBusca("");
              }}
              className="inline-flex items-center gap-1 font-semibold text-verde-primary hover:underline"
            >
              <FilterX className="size-3.5" /> Limpar filtros ({nAtivos})
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as análises: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {empresas.length === 0 ? "Nenhum fator psicossocial sinalizado em AEP entregue ao cliente." : "Nenhuma empresa encontrada com esses filtros."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtradas.map((e) => {
            const quest = questionarios?.[e.idEmpresa];
            return (
              <li key={e.idEmpresa}>
                <Link
                  href={`${basePath}/${encodeURIComponent(e.idEmpresa)}`}
                  className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-verde-primary/40 hover:shadow-md"
                >
                  {/* Linha 1: empresa, unidade/região, nível */}
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 size-5 shrink-0 text-verde-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-gray-900">{e.nome}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        <span>{e.cnpj ? formatCNPJ(e.cnpj) : "—"}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          <span className="font-medium text-gray-700">
                            {(e.idUnidade && nomeUnidade.get(e.idUnidade)) || "Sem unidade"}
                          </span>
                          <span className="text-gray-400">· {regiao(e) ?? "região não informada"}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" title="Maior nível AIHA entre os fatores da empresa">
                      <SeloNivelAiha nivel={e.pior} />
                      <ChevronRight className="size-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Linha 2: blocos em destaque */}
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                    <Bloco
                      rotulo="DRPS/Questionário"
                      destaque={questionarioPendente(e, quest)}
                      title="3+ alertas organizacionais na AEP recomendam DRPS/Questionário Psicossocial (NR-01)"
                    >
                      <Necessario sim={e.precisaQuestionario} />
                      <JaTem s={quest} />
                    </Bloco>
                    <Bloco rotulo="AET" destaque={e.precisaAet} title="Algum setor com indicação de Análise Ergonômica do Trabalho">
                      <Necessario sim={e.precisaAet} />
                    </Bloco>
                    <Bloco rotulo="Realizada por">
                      <div className="truncate" title={e.realizadaPor ?? undefined}>
                        {e.realizadaPor ?? "—"}
                      </div>
                    </Bloco>
                    <Bloco rotulo="Enviada por">
                      <div className="truncate" title={e.enviadoPor ?? undefined}>
                        {e.temInspecao ? (e.enviadoPor ?? "—") : <span className="font-normal text-gray-500">Sem inspeção</span>}
                      </div>
                    </Bloco>
                    <Bloco rotulo="Alertas">{e.totalAlertas}</Bloco>
                    <Bloco rotulo="Setores">{e.totalSetores}</Bloco>
                    <Bloco rotulo="Entregue em">{e.ultimaData ? fmtData(e.ultimaData) : "—"}</Bloco>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

### I: diff de `components/aep/SinalizacaoEmpresaDetalhe.tsx`

```diff
@@ -12,13 +12,14 @@ import Link from "next/link";
 import { useQuery } from "@tanstack/react-query";
 import { ArrowLeft, Building2, Layers } from "lucide-react";
 import { useAepsEntregues } from "@/lib/hooks/useAep";
+import { useUnidades } from "@/lib/hooks/useUnidades";
 import { montarSinalizacao } from "@/lib/aep/sinalizacao";
 import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
 import { fmtData, formatCNPJ } from "@/lib/utils";
 
-const STATUS_ROTULO: Record<string, string> = { RASCUNHO: "Rascunho", CONCLUIDO: "Concluída" };
+const STATUS_ROTULO: Record<string, string> = { RASCUNHO: "Rascunho", EM_ANDAMENTO: "Em andamento", CONCLUIDO: "Concluída" };
 
 interface EmpresaCadastro {
   nome_empresa: string | null;
@@ -37,6 +38,7 @@ interface EmpresaCadastro {
   cep: string | null;
   telefone: string | null;
   email: string | null;
+  id_unidade: string | null;
 }
 
 function Info({ rotulo, valor, className }: { rotulo: string; valor: string | null | undefined; className?: string }) {
@@ -64,7 +66,7 @@ export default function SinalizacaoEmpresaDetalhe({
       const { data, error } = await createSupabaseBrowserClient()
         .from("empresas")
         .select(
-          "nome_empresa, razao_social, nome_fantasia, cnpj, cnae_principal, cnae_descricao, grau_risco, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email"
+          "nome_empresa, razao_social, nome_fantasia, cnpj, cnae_principal, cnae_descricao, grau_risco, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email, id_unidade"
         )
         .eq("id_empresa", idEmpresa)
         .maybeSingle();
@@ -73,6 +75,10 @@ export default function SinalizacaoEmpresaDetalhe({
     },
   });
 
+  const { data: unidades = [] } = useUnidades();
+  const unidade = cadastro?.id_unidade ? (unidades.find((u) => u.id_unidade === cadastro.id_unidade)?.nome ?? null) : null;
+  const regiao = [cadastro?.municipio, cadastro?.uf].filter(Boolean).join("/") || null;
+
   const endereco = cadastro
     ? [
         [cadastro.logradouro, cadastro.numero].filter(Boolean).join(", "),
@@ -115,6 +121,8 @@ export default function SinalizacaoEmpresaDetalhe({
         />
         <Info rotulo="Grau de risco" valor={cadastro?.grau_risco != null ? String(cadastro.grau_risco) : null} />
         <Info rotulo="Telefone" valor={cadastro?.telefone} />
+        <Info rotulo="Unidade" valor={unidade} />
+        <Info rotulo="Região (município/UF)" valor={regiao} />
         <Info rotulo="Endereço" valor={endereco} className="sm:col-span-2 lg:col-span-3" />
         <Info rotulo="E-mail" valor={cadastro?.email} />
       </div>
@@ -133,9 +141,20 @@ export default function SinalizacaoEmpresaDetalhe({
               <h2 className="text-base font-semibold text-gray-900">Análise Ergonômica Preliminar</h2>
               <span className="text-xs text-gray-500">
                 {a.data ? `Entregue ao cliente em ${fmtData(a.data)}` : STATUS_ROTULO[a.status] ?? a.status}
-                {a.idInspecao ? ` · ${a.idInspecao}` : ""}
-                {a.responsavel ? ` · ${a.responsavel}` : ""}
+                {a.idInspecao ? ` · ${a.idInspecao}` : " · sem inspeção"}
+                {a.responsavel ? ` · Realizada por ${a.responsavel}` : ""}
+                {a.enviadoPor ? ` · Enviada por ${a.enviadoPor}` : ""}
               </span>
+              {a.precisaQuestionario && (
+                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
+                  DRPS/Questionário necessário
+                </span>
+              )}
+              {a.precisaAet && (
+                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
+                  AET necessária
+                </span>
+              )}
             </div>
 
             <div className="space-y-4">
```

### J: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -1,5 +1,6 @@
 "use client";
 
+import { MIN_ALERTAS_QUESTIONARIO, totalAlertasOrganizacionais } from "@/lib/aep/sinalizacao";
 import { chaveNome, type CargoCatalogo, type SetorCatalogo } from "@/lib/aep/catalogo-setores";
 import SituacaoSinalizacaoAep from "@/components/aep/SituacaoSinalizacaoAep";
 import { EditorSkeleton } from "@/components/ui/PageSkeletons";
@@ -1226,12 +1227,8 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
 
       {/* Banner AEP → QPS */}
       {(() => {
-        const totalAlertasOrg = setores.reduce(
-          (acc, s) =>
-            acc + Object.values(s.checklist_organizacional).filter((v) => v === "sim").length,
-          0
-        );
-        if (totalAlertasOrg < 3) return null;
+        const totalAlertasOrg = totalAlertasOrganizacionais(setores);
+        if (totalAlertasOrg < MIN_ALERTAS_QUESTIONARIO) return null;
         return (
           <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
             <AlertTriangle className="size-5 shrink-0 text-indigo-600 mt-0.5" />
```

### K: diff de `components/aep/AepDadosEditor.tsx`

```diff
@@ -114,7 +114,7 @@ export default function AepDadosPage({ idRelatorio, embutido = false }: { idRela
         <div>
           <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
           <div className="flex gap-2">
-            {(["RASCUNHO", "CONCLUIDO"] as StatusAEP[]).map((s) => (
+            {(["RASCUNHO", "EM_ANDAMENTO", "CONCLUIDO"] as StatusAEP[]).map((s) => (
               <button
                 key={s}
                 type="button"
@@ -125,16 +125,18 @@ export default function AepDadosPage({ idRelatorio, embutido = false }: { idRela
                   status === s
                     ? s === "CONCLUIDO"
                       ? "border-emerald-500 bg-emerald-600 text-white"
-                      : "border-yellow-400 bg-yellow-50 text-yellow-800"
+                      : s === "EM_ANDAMENTO"
+                        ? "border-yellow-400 bg-yellow-50 text-yellow-800"
+                        : "border-gray-400 bg-gray-100 text-gray-800"
                     : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50",
                 ].join(" ")}
               >
-                {s === "RASCUNHO" ? "Rascunho" : "Concluído"}
+                {s === "RASCUNHO" ? "Rascunho" : s === "EM_ANDAMENTO" ? "Em andamento" : "Concluído"}
               </button>
             ))}
           </div>
           <p className="mt-1 text-[11px] text-gray-500">
-            Concluído = enviado ao cliente. AEP sem inspeção entra na Sinalização Psicossocial ao ser concluída; com
+            Rascunho = aberta; Em andamento = em elaboração; Concluído = enviado ao cliente. AEP sem inspeção entra na Sinalização Psicossocial ao ser concluída; com
             inspeção, quando o documento da inspeção for concluído pelo associado.
           </p>
         </div>
```

### L: diff de `app/(aep)/aep/dashboard/page.tsx`

```diff
@@ -3,10 +3,10 @@
 import { useState } from "react";
 import { useRouter } from "next/navigation";
 import { AlertTriangle, Printer } from "lucide-react";
-import { useAepRelatorios, riscoMaximoRelatorio, CLASS_COLOR_AEP, STATUS_LABEL_AEP } from "@/lib/hooks/useAep";
+import { useAepRelatorios, riscoMaximoRelatorio, CLASS_COLOR_AEP, STATUS_LABEL_AEP, STATUS_COR_AEP } from "@/lib/hooks/useAep";
 import EmpresaSelect from "@/components/empresas/EmpresaSelect";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
-import type { ClassificacaoRiscoAET } from "@/lib/supabase/types";
+import type { ClassificacaoRiscoAET, StatusAEP } from "@/lib/supabase/types";
 
 const RISCO_DOT: Record<ClassificacaoRiscoAET, string> = {
   Trivial: "bg-green-400",
@@ -19,12 +19,15 @@ const RISCO_DOT: Record<ClassificacaoRiscoAET, string> = {
 export default function AepDashboardPage() {
   const router = useRouter();
   const [empresaId, setEmpresaId] = useState<string | null>(null);
-  const { data: relatorios = [], isLoading } = useAepRelatorios(empresaId);
+  const { data: todos = [], isLoading } = useAepRelatorios(empresaId);
+  // Clique num cartão de status filtra a lista abaixo (clicar de novo limpa).
+  const [filtroStatus, setFiltroStatus] = useState<StatusAEP | null>(null);
+  const relatorios = filtroStatus ? todos.filter((r) => r.status === filtroStatus) : todos;
 
-  const totalAnalises = relatorios.length;
-  const comAet = relatorios.filter((r) => r.setores.some((s) => s.necessita_aet)).length;
-  const concluidos = relatorios.filter((r) => r.status === "CONCLUIDO").length;
-  const totalRiscos = relatorios.reduce((a, r) => a + r.setores.reduce((b, s) => b + s.riscos.length, 0), 0);
+  const totalAnalises = todos.length;
+  const porStatus = (s: StatusAEP) => todos.filter((r) => r.status === s).length;
+  const comAet = todos.filter((r) => r.setores.some((s) => s.necessita_aet)).length;
+  const totalRiscos = todos.reduce((a, r) => a + r.setores.reduce((b, s) => b + s.riscos.length, 0), 0);
 
   return (
     <div className="space-y-6">
@@ -39,19 +42,42 @@ export default function AepDashboardPage() {
       </div>
 
       {/* Stats */}
-      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
-        {[
-          { label: "Análises",     value: totalAnalises, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
-          { label: "Concluídas",   value: concluidos,    color: "bg-blue-50 border-blue-200 text-blue-700" },
-          { label: "Requer AET",   value: comAet,        color: "bg-orange-50 border-orange-200 text-orange-700" },
-          { label: "Riscos Ident.", value: totalRiscos,  color: "bg-gray-50 border-gray-200 text-gray-700" },
-        ].map(({ label, value, color }) => (
-          <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
-            <p className="text-3xl font-bold">{value}</p>
-            <p className="text-xs font-medium mt-1">{label}</p>
-          </div>
-        ))}
+      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
+        {(
+          [
+            { label: "Análises",      value: totalAnalises,               color: "bg-emerald-50 border-emerald-200 text-emerald-700", status: null },
+            { label: "Rascunho",      value: porStatus("RASCUNHO"),       color: "bg-gray-50 border-gray-200 text-gray-700",          status: "RASCUNHO" },
+            { label: "Em andamento",  value: porStatus("EM_ANDAMENTO"),   color: "bg-yellow-50 border-yellow-200 text-yellow-700",    status: "EM_ANDAMENTO" },
+            { label: "Concluídas",    value: porStatus("CONCLUIDO"),      color: "bg-blue-50 border-blue-200 text-blue-700",          status: "CONCLUIDO" },
+            { label: "Requer AET",    value: comAet,                      color: "bg-orange-50 border-orange-200 text-orange-700",    status: undefined },
+            { label: "Riscos Ident.", value: totalRiscos,                 color: "bg-gray-50 border-gray-200 text-gray-700",          status: undefined },
+          ] as { label: string; value: number; color: string; status: StatusAEP | null | undefined }[]
+        ).map(({ label, value, color, status }) => {
+          const clicavel = status !== undefined;
+          const ativo = clicavel && filtroStatus === status && status !== null;
+          return (
+            <button
+              key={label}
+              type="button"
+              disabled={!clicavel}
+              onClick={() => setFiltroStatus(status === null || filtroStatus === status ? null : (status as StatusAEP))}
+              title={clicavel ? (status ? `Mostrar só "${label}"` : "Mostrar todas") : undefined}
+              className={`rounded-xl border p-4 text-center ${color} ${clicavel ? "cursor-pointer hover:shadow-sm" : "cursor-default"} ${ativo ? "ring-2 ring-offset-1 ring-emerald-500" : ""}`}
+            >
+              <p className="text-3xl font-bold">{value}</p>
+              <p className="text-xs font-medium mt-1">{label}</p>
+            </button>
+          );
+        })}
       </div>
+      {filtroStatus && (
+        <p className="text-xs text-gray-500">
+          Mostrando só as análises com status <strong>{STATUS_LABEL_AEP[filtroStatus]}</strong>.{" "}
+          <button type="button" onClick={() => setFiltroStatus(null)} className="font-semibold text-emerald-700 underline">
+            Mostrar todas
+          </button>
+        </p>
+      )}
 
       {isLoading && <LoadingSkeleton rows={4} />}
 
@@ -84,7 +110,7 @@ export default function AepDashboardPage() {
                       {rMax}
                     </span>
                   )}
-                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rel.status === "CONCLUIDO" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
+                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COR_AEP[rel.status] ?? STATUS_COR_AEP.RASCUNHO}`}>
                     {STATUS_LABEL_AEP[rel.status]}
                   </span>
                 </div>
```

### M: diff de `app/(aep)/aep/page.tsx`

```diff
@@ -3,7 +3,7 @@
 import { useState, useMemo } from "react";
 import { useRouter } from "next/navigation";
 import { Plus, Printer, Trash2, AlertTriangle } from "lucide-react";
-import { useAepRelatorios, useExcluirAep, riscoMaximoRelatorio, CLASS_COLOR_AEP, STATUS_LABEL_AEP } from "@/lib/hooks/useAep";
+import { useAepRelatorios, useExcluirAep, riscoMaximoRelatorio, CLASS_COLOR_AEP, STATUS_LABEL_AEP, STATUS_COR_AEP } from "@/lib/hooks/useAep";
 import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
 import { useUnidadeFiltro } from "@/lib/hooks/useUnidadeFiltro";
 import EmpresaSelect from "@/components/empresas/EmpresaSelect";
@@ -105,7 +105,7 @@ export default function AepListaPage() {
                       {rMax}
                     </span>
                   )}
-                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rel.status === "CONCLUIDO" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
+                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COR_AEP[rel.status] ?? STATUS_COR_AEP.RASCUNHO}`}>
                     {STATUS_LABEL_AEP[rel.status]}
                   </span>
                 </div>
```

## Passo 3: verificar

1. Rode `npm test` (os testes de `sinalizacao` e `sinalizacao-filtros` passam), `npx tsc --noEmit -p .` e `npx next build`; todos devem terminar sem erros.
2. **Status:**
   - em Dados / Conclusão, marque **Em andamento** e salve;
   - no Dashboard AEP, o cartão "Em andamento" conta a AEP e, ao ser clicado, filtra a lista;
   - o selo da AEP fica amarelo.
3. **Sinalização:**
   - cada empresa aparece como cartão, com unidade · região e os blocos;
   - uma AEP com 3+ alertas organizacionais mostra DRPS/Questionário "Necessário", e embaixo o que a empresa tem ("Nenhum feito" fica vermelho, e o bloco fica âmbar);
   - os contadores do topo filtram e o "Empresas sinalizadas" limpa;
   - cada filtro reduz a lista, a contagem "N de M" acompanha e "Limpar filtros" volta tudo.
4. **Página da empresa:** Unidade e Região no cadastro; em cada AEP, "Realizada por", "Enviada por" e os selos de DRPS/Questionário e AET.
5. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

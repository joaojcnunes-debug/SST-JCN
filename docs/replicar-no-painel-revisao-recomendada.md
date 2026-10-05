# Replicar no Painel SST: "Revisão recomendada" na Sinalização e no Comercial

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-revisao-recomendada.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `c1a392b` e `a7b31fe` de 2026-10-05, já em produção lá.
> **Tem 1 migration** (v269, seção A): substitui a função `comercial_dados()` para trazer a data dos documentos.

## Pré-requisitos

Aplique antes, nesta ordem, se o painel ainda não tiver:

1. `replicar-no-painel-sinalizacao-filtros-e-status-aep.md`
2. `replicar-no-painel-sinalizacao-destaque-empresa.md`
3. `replicar-no-painel-modulo-comercial.md`
4. `replicar-no-painel-comercial-pela-inspecao.md` (v268)

Os diffs abaixo são contra o estado depois deles.

## O que faz

### Sinalização: o DRPS/Questionário diz se atende ou precisa de revisão

Antes aparecia "Necessário" junto com "DRPS concluído", o que confundia. Agora
o bloco DRPS/Questionário (lista e página da empresa) compara a **data do
documento** com a **data da AEP** (`leituraQuestionario` em
`lib/aep/sinalizacao.ts`, testada):

| Situação | O que aparece |
|---|---|
| A AEP não recomenda | **Não** (e o que a empresa tiver, só informativo) |
| Recomenda, nada feito | **Necessário** · "Nenhum DRPS/Questionário feito" (vermelho) |
| Recomenda, em andamento | **Necessário** · "DRPS em andamento desde dd/mm/aaaa" |
| Recomenda, concluído **antes** da AEP | **Revisão recomendada** · "DRPS concluído em dd/mm/aaaa, antes da AEP de dd/mm/aaaa" (laranja) |
| Recomenda, concluído na data da AEP ou depois | **Atendido** · "DRPS concluído em dd/mm/aaaa" (verde) |

Datas usadas:

- **DRPS:** `data_envio_cliente` > `data_conclusao` > `data_elaboracao` > `updated_at`.
- **QPS:** `data_elaboracao` > `atualizado_em`.

O filtro e o contador "DRPS/Questionário pendente" incluem os casos de revisão.

### Comercial: situação "Revisão recomendada"

Um documento que já existe mas foi concluído **antes** da indicação mais nova
vira a situação **revisao** ("vender a revisão"), com a frase "X concluído em
dd/mm/aaaa, antes da indicação de dd/mm/aaaa":

| Serviço | Indicação comparada |
|---|---|
| AET | data da AEP entregue |
| DRPS/Questionário | a mais nova entre a AEP entregue e a inspeção concluída |
| AEP, Apreciação NR-12 e Análise de Químicos | data da inspeção concluída |

Medição quantitativa (sem módulo) e Treinamentos (decidido por certificado)
não entram nessa regra.

Mudanças na tela do Comercial:

- abre em **"A vender" (aberta + revisão)**;
- o contador e os chips contam as duas situações;
- o filtro Situação ganha "A vender" e "Revisão recomendada";
- o card da tela Módulos diz "N oportunidades a vender".

A RPC (v269) passa a devolver `data` em cada item de `docs`.

## Passo 1: conferir o painel

| Usado | Conferir no painel |
|---|---|
| `drps_relatorios` (`data_envio_cliente`, `data_conclusao`, `data_elaboracao`, `updated_at`) e `qps_aplicacoes` (`data_elaboracao`, `atualizado_em`) | mesmos nomes; ajuste o hook (seção E) e a v269 se for diferente |
| `aet_relatorios`, `analises_quimicos` (`updated_at`, `created_at`), `apreciacoes_maquinas` (`finalizado_em`), `aep_relatorios` (`concluido_em`, da v265) | mesmos nomes |

## Passo 2: migration v269 (banco do painel)

Rode a seção **A** no **banco do painel**, nunca no do JCN. Rollback: reaplicar
a função da v268 (seção A do MD `replicar-no-painel-comercial-pela-inspecao.md`).

## Passo 3: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `supabase/historico/v269_comercial_dados_datas.sql` | migration |
| B | `lib/aep/sinalizacao.ts` | `situacaoQuestionario` com data, `dataBR`, `leituraQuestionario` |
| C | `lib/aep/sinalizacao.test.ts` | testes da leitura |
| D | `lib/aep/sinalizacao-filtros.ts` | pendente = `leituraQuestionario(...).pendente` |
| E | `lib/hooks/useAep.ts` | datas do DRPS/QPS em `useSituacaoQuestionarioEmpresas` |
| F | `components/aep/SinalizacaoEmpresasLista.tsx` | bloco com a leitura |
| G | `components/aep/SinalizacaoEmpresaDetalhe.tsx` | bloco do cabeçalho da AEP com a leitura |
| H | `lib/comercial/oportunidades.ts` | **substituir**: situação `revisao` em todos os serviços com data |
| I | `lib/comercial/oportunidades.test.ts` | **substituir**: 9 testes |
| J | `app/(comercial)/comercial/page.tsx` | "A vender", revisão no filtro e no estilo |
| K | `app/(hub)/modulos/page.tsx` | card "a vender" |

### A: `supabase/historico/v269_comercial_dados_datas.sql` (novo, completo)

```sql
-- v269 (2026-10-05): `docs` do comercial_dados() passa a trazer a DATA de cada
-- documento (DRPS: envio ao cliente > conclusão > elaboração > edição; QPS:
-- elaboração > edição; AEP: concluido_em; Apreciação: finalizado_em; demais:
-- edição). Usada para marcar "Revisão recomendada" quando o DRPS/Questionário
-- foi concluído ANTES da AEP/inspeção que o indicou. Já aplicada via MCP.
-- Rollback: reaplicar supabase/historico/v268_comercial_dados_inspecao.sql.
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
    -- AEPs entregues ao cliente (regra da Sinalização)
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

    -- Última inspeção CONCLUÍDA de cada empresa e o que ela indica
    'inspecoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_inspecao', i.id_inspecao,
        'id_empresa', i.id_empresa,
        'concluida_em', coalesce(i.concluida_em, i.updated_at),
        'responsavel', i.responsavel,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email),
        'maquinas', coalesce((
          select jsonb_agg(jsonb_build_object('nome', m.nome, 'grau_risco', m.grau_risco, 'adequacao', m.necessita_adequacao_nr12))
            from public.inspecao_maquinas m
           where m.id_inspecao = i.id_inspecao and m.ativo is not false
             and (m.necessita_adequacao_nr12 or m.grau_risco in ('ALTO', 'CRITICO'))), '[]'::jsonb),
        'medicoes', coalesce((
          select jsonb_agg(jsonb_build_object('agente', r.agente, 'qual', r.fisico_qual_medicao, 'setor', s.setor_ghe))
            from public.riscos r left join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Físico' and r.fisico_necessita_medicao = 'Sim'), '[]'::jsonb),
        'quimicos', coalesce((
          select jsonb_agg(distinct coalesce(nullif(trim(r.agente), ''), 'Agente químico'))
            from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Químico'), '[]'::jsonb),
        'ergonomicos', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Ergonômico'),
        'psicossociais', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Psicossocial'),
        'treinamentos', coalesce((
          select jsonb_agg(jsonb_build_object('nr', t.nr, 'titulo', t.titulo) order by t.ordem)
            from public.treinamentos_nr t where t.id_inspecao = i.id_inspecao and t.ativo is not false), '[]'::jsonb)))
        from (
          select distinct on (x.id_empresa) x.*
            from public.inspecoes x
           where x.status = 'CONCLUIDA'
           order by x.id_empresa, coalesce(x.concluida_em, x.updated_at) desc nulls last
        ) i
        join public.empresas e on e.id_empresa = i.id_empresa
    ), '[]'::jsonb),

    -- Situação dos serviços que a empresa já tem
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object('id_empresa', d.id_empresa, 'tipo', d.tipo, 'status', d.status, 'data', d.data))
        from (
          select id_empresa, 'DRPS'::text as tipo, status,
                 coalesce(data_envio_cliente::timestamptz, data_conclusao::timestamptz, data_elaboracao::timestamptz, updated_at) as data
            from public.drps_relatorios
          union all select id_empresa, 'QPS', status, coalesce(data_elaboracao::timestamptz, atualizado_em) from public.qps_aplicacoes
          union all select id_empresa, 'AET', status, coalesce(updated_at, created_at) from public.aet_relatorios
          union all select id_empresa, 'AEP', status, coalesce(concluido_em, updated_at, created_at) from public.aep_relatorios
          union all select id_empresa, 'APRECIACAO', status, coalesce(finalizado_em, updated_at, created_at) from public.apreciacoes_maquinas
          union all select id_empresa, 'QUIMICOS', 'CONCLUIDO', coalesce(updated_at, created_at) from public.analises_quimicos
        ) d
       where d.id_empresa is not null
    ), '[]'::jsonb),

    -- Certificados de treinamento emitidos (empresa + NR)
    'certificados', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id_empresa', c.id_empresa, 'nr', c.nr))
        from public.certificados_treinamento c where c.id_empresa is not null
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.comercial_dados() from public, anon;
grant execute on function public.comercial_dados() to authenticated;
```

### B: diff de `lib/aep/sinalizacao.ts`

```diff
@@ -98,8 +98,13 @@ export interface SituacaoQuestionario {
   fase: "concluido" | "andamento" | null;
   /** Qual documento define a frase: DRPS ou Questionário. */
   doc: "DRPS" | "Questionário" | null;
+  /** Data do documento mais recente dessa fase (envio/conclusão/elaboração). */
+  data?: string | null;
 }
 
+/** Um DRPS/QPS: só o status (legado) ou status + data. */
+export type DocQuestionario = string | null | { status: string | null; data?: string | null };
+
 const FASE_DOC: Record<string, "concluido" | "andamento"> = {
   CONCLUIDO: "concluido",
   ENVIADO_CLIENTE: "concluido",
@@ -112,13 +117,80 @@ const FASE_DOC: Record<string, "concluido" | "andamento"> = {
  * vence andamento; DRPS vem antes do Questionário no empate. Deletados e
  * outros status não contam (mesma régua do quadro Documentos da empresa).
  */
-export function situacaoQuestionario(statusDrps: (string | null)[], statusQps: (string | null)[]): SituacaoQuestionario {
-  const fase = (lista: (string | null)[], f: "concluido" | "andamento") => lista.some((s) => FASE_DOC[s ?? ""] === f);
+export function situacaoQuestionario(drps: DocQuestionario[], qps: DocQuestionario[]): SituacaoQuestionario {
+  const norm = (l: DocQuestionario[]) =>
+    l.map((d) => (d && typeof d === "object" ? { status: d.status, data: d.data ?? null } : { status: d, data: null }));
+  const D = norm(drps);
+  const Q = norm(qps);
+  // Data mais recente entre os documentos daquela fase.
+  const achar = (lista: { status: string | null; data: string | null }[], f: "concluido" | "andamento") => {
+    const da = lista.filter((x) => FASE_DOC[x.status ?? ""] === f);
+    if (da.length === 0) return undefined;
+    return da.map((x) => x.data).filter((x): x is string => !!x).sort().pop() ?? null;
+  };
   for (const f of ["concluido", "andamento"] as const) {
-    if (fase(statusDrps, f)) return { fase: f, doc: "DRPS" };
-    if (fase(statusQps, f)) return { fase: f, doc: "Questionário" };
+    const dD = achar(D, f);
+    if (dD !== undefined) return { fase: f, doc: "DRPS", data: dD };
+    const dQ = achar(Q, f);
+    if (dQ !== undefined) return { fase: f, doc: "Questionário", data: dQ };
+  }
+  return { fase: null, doc: null, data: null };
+}
+
+/** "2026-10-05..." → "05/10/2026" (puro, sem fuso). */
+export function dataBR(iso: string | null | undefined): string {
+  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
+  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
+}
+
+export type TomLeitura = "ok" | "alerta" | "info" | "perigo" | "neutro";
+
+export interface LeituraQuestionario {
+  /** Frase curta: Não / Necessário / Revisão recomendada / Atendido. */
+  rotulo: string;
+  /** Explicação embaixo, com o documento e a data. */
+  detalhe: string | null;
+  tom: TomLeitura;
+  /** Ainda falta algo para atender a recomendação da AEP. */
+  pendente: boolean;
+}
+
+/**
+ * O que dizer sobre DRPS/Questionário diante da AEP (2026-10-05): "Necessário"
+ * + "concluído" confundia. Agora:
+ *   • não recomendado           → "Não" (e o que a empresa tiver, só informativo);
+ *   • recomendado, nenhum feito → "Necessário" · "Nenhum DRPS/Questionário feito";
+ *   • recomendado, em andamento → "Necessário" · "DRPS em andamento desde …";
+ *   • recomendado, concluído ANTES da AEP → "Revisão recomendada" · "DRPS
+ *     concluído em …, antes da AEP de …" — a AEP trouxe fatores novos;
+ *   • recomendado, concluído na data da AEP ou depois → "Atendido".
+ */
+export function leituraQuestionario(
+  precisa: boolean,
+  s: SituacaoQuestionario | undefined,
+  dataAep: string | null | undefined,
+): LeituraQuestionario {
+  const doc = s?.doc ?? "DRPS/Questionário";
+  const quando = s?.data ? dataBR(s.data) : "";
+  if (!precisa) {
+    const detalhe =
+      s?.fase === "concluido" ? `${doc} concluído${quando ? ` em ${quando}` : ""}` : s?.fase === "andamento" ? `${doc} em andamento` : null;
+    return { rotulo: "Não", detalhe, tom: "neutro", pendente: false };
+  }
+  if (!s?.fase) return { rotulo: "Necessário", detalhe: "Nenhum DRPS/Questionário feito", tom: "perigo", pendente: true };
+  if (s.fase === "andamento") {
+    return { rotulo: "Necessário", detalhe: `${doc} em andamento${quando ? ` desde ${quando}` : ""}`, tom: "info", pendente: true };
+  }
+  const dia = (x: string | null | undefined) => (x ?? "").slice(0, 10);
+  if (s.data && dataAep && dia(s.data) < dia(dataAep)) {
+    return {
+      rotulo: "Revisão recomendada",
+      detalhe: `${doc} concluído em ${quando}, antes da AEP de ${dataBR(dataAep)}`,
+      tom: "alerta",
+      pendente: true,
+    };
   }
-  return { fase: null, doc: null };
+  return { rotulo: "Atendido", detalhe: `${doc} concluído${quando ? ` em ${quando}` : ""}`, tom: "ok", pendente: false };
 }
 
 export function piorNivel(niveis: (string | null | undefined)[]): string | null {
```

### C: diff de `lib/aep/sinalizacao.test.ts`

```diff
@@ -1,7 +1,7 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 
-import { montarSinalizacao, piorNivel, recomendaQuestionario, situacaoQuestionario } from "./sinalizacao";
+import { dataBR, leituraQuestionario, montarSinalizacao, piorNivel, recomendaQuestionario, situacaoQuestionario } from "./sinalizacao";
 import type { AepRelatorio } from "@/lib/supabase/types";
 
 function rel(id: string, empresa: string, data: string, setores: unknown[]): AepRelatorio {
@@ -80,9 +80,33 @@ test("DRPS/Questionário a partir de 3 alertas organizacionais; AET e quem envio
 });
 
 test("situação do DRPS/Questionário: concluído vence andamento; DRPS antes do Questionário", () => {
-  assert.deepEqual(situacaoQuestionario([], []), { fase: null, doc: null });
-  assert.deepEqual(situacaoQuestionario(["DELETADO"], [null]), { fase: null, doc: null });
-  assert.deepEqual(situacaoQuestionario(["RASCUNHO"], ["ENVIADO_CLIENTE"]), { fase: "concluido", doc: "Questionário" });
-  assert.deepEqual(situacaoQuestionario(["EM_ANDAMENTO"], ["RASCUNHO"]), { fase: "andamento", doc: "DRPS" });
-  assert.deepEqual(situacaoQuestionario(["CONCLUIDO"], ["CONCLUIDO"]), { fase: "concluido", doc: "DRPS" });
+  assert.deepEqual(situacaoQuestionario([], []), { fase: null, doc: null, data: null });
+  assert.deepEqual(situacaoQuestionario(["DELETADO"], [null]), { fase: null, doc: null, data: null });
+  assert.deepEqual(situacaoQuestionario(["RASCUNHO"], ["ENVIADO_CLIENTE"]), { fase: "concluido", doc: "Questionário", data: null });
+  assert.deepEqual(situacaoQuestionario(["EM_ANDAMENTO"], ["RASCUNHO"]), { fase: "andamento", doc: "DRPS", data: null });
+  assert.deepEqual(situacaoQuestionario(["CONCLUIDO"], ["CONCLUIDO"]), { fase: "concluido", doc: "DRPS", data: null });
+});
+
+test("situação com data: pega a data mais recente da fase", () => {
+  assert.deepEqual(
+    situacaoQuestionario([{ status: "CONCLUIDO", data: "2026-03-01" }, { status: "CONCLUIDO", data: "2026-05-02" }], []),
+    { fase: "concluido", doc: "DRPS", data: "2026-05-02" },
+  );
+  assert.equal(dataBR("2026-05-02T10:00:00Z"), "02/05/2026");
+});
+
+test("leitura do DRPS/Questionário diante da AEP: necessário, em andamento, revisão e atendido", () => {
+  const aep = "2026-10-05";
+  assert.deepEqual(leituraQuestionario(true, { fase: null, doc: null }, aep), {
+    rotulo: "Necessário", detalhe: "Nenhum DRPS/Questionário feito", tom: "perigo", pendente: true,
+  });
+  assert.equal(leituraQuestionario(true, { fase: "andamento", doc: "Questionário", data: "2026-09-01" }, aep).detalhe, "Questionário em andamento desde 01/09/2026");
+  const rev = leituraQuestionario(true, { fase: "concluido", doc: "DRPS", data: "2026-09-25" }, aep);
+  assert.equal(rev.rotulo, "Revisão recomendada");
+  assert.equal(rev.detalhe, "DRPS concluído em 25/09/2026, antes da AEP de 05/10/2026");
+  assert.equal(rev.pendente, true);
+  const ok = leituraQuestionario(true, { fase: "concluido", doc: "DRPS", data: "2026-10-05T15:00:00Z" }, aep);
+  assert.equal(ok.rotulo, "Atendido");
+  assert.equal(ok.pendente, false);
+  assert.equal(leituraQuestionario(false, { fase: "concluido", doc: "DRPS", data: "2026-01-02" }, aep).rotulo, "Não");
 });
```

### D: diff de `lib/aep/sinalizacao-filtros.ts`

```diff
@@ -2,7 +2,7 @@
 // sem tela: recebe as empresas montadas por `montarSinalizacao` e a situação do
 // DRPS/Questionário de cada uma (`useSituacaoQuestionarioEmpresas`).
 
-import type { EmpresaSinalizada, SituacaoQuestionario } from "@/lib/aep/sinalizacao";
+import { leituraQuestionario, type EmpresaSinalizada, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
 
 export type FiltroQuestionario = "" | "necessario" | "pendente" | "nao";
 export type FiltroSimNao = "" | "sim" | "nao";
@@ -33,11 +33,11 @@ export function filtrosAtivos(f: FiltrosSinalizacao): number {
 }
 
 /**
- * Pendência de DRPS/Questionário: a AEP recomenda e a empresa ainda não tem
- * nenhum CONCLUÍDO (nenhum feito ou só em andamento).
+ * Pendência de DRPS/Questionário: a AEP recomenda e ainda não está atendido —
+ * nenhum feito, só em andamento, ou concluído ANTES da AEP (revisão).
  */
 export function questionarioPendente(e: EmpresaSinalizada, s: SituacaoQuestionario | undefined): boolean {
-  return e.precisaQuestionario && s?.fase !== "concluido";
+  return leituraQuestionario(e.precisaQuestionario, s, e.ultimaData).pendente;
 }
 
 export function filtrarSinalizacao(
```

### E: diff de `lib/hooks/useAep.ts`

```diff
@@ -366,17 +366,23 @@ export function useSituacaoQuestionarioEmpresas(idsEmpresas: string[]) {
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       const sb = createSupabaseBrowserClient() as any;
       const [d, q] = await Promise.all([
-        sb.from("drps_relatorios").select("id_empresa, status").in("id_empresa", ids),
-        sb.from("qps_aplicacoes").select("id_empresa, status").in("id_empresa", ids),
+        sb
+          .from("drps_relatorios")
+          .select("id_empresa, status, data_envio_cliente, data_conclusao, data_elaboracao, updated_at")
+          .in("id_empresa", ids),
+        sb.from("qps_aplicacoes").select("id_empresa, status, data_elaboracao, atualizado_em").in("id_empresa", ids),
       ]);
       if (d.error) throw d.error;
       if (q.error) throw q.error;
-      type Linha = { id_empresa: string; status: string | null };
+      type Linha = { id_empresa: string; status: string | null; [k: string]: string | null };
+      // Data do documento: envio ao cliente > conclusão > elaboração > última edição.
+      const dataDrps = (r: Linha) => r.data_envio_cliente ?? r.data_conclusao ?? r.data_elaboracao ?? r.updated_at ?? null;
+      const dataQps = (r: Linha) => r.data_elaboracao ?? r.atualizado_em ?? null;
       const out: Record<string, SituacaoQuestionario> = {};
       for (const id of ids) {
         out[id] = situacaoQuestionario(
-          ((d.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => r.status),
-          ((q.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => r.status),
+          ((d.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => ({ status: r.status, data: dataDrps(r) })),
+          ((q.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => ({ status: r.status, data: dataQps(r) })),
         );
       }
       return out;
```

### F: diff de `components/aep/SinalizacaoEmpresasLista.tsx`

```diff
@@ -16,7 +16,7 @@ import Link from "next/link";
 import { Brain, Building2, ChevronRight, FilterX, MapPin, Search } from "lucide-react";
 import { useAepsEntregues, useSituacaoQuestionarioEmpresas } from "@/lib/hooks/useAep";
 import { useUnidades } from "@/lib/hooks/useUnidades";
-import { montarSinalizacao, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
+import { leituraQuestionario, montarSinalizacao, type TomLeitura } from "@/lib/aep/sinalizacao";
 import {
   FILTROS_VAZIOS,
   filtrarSinalizacao,
@@ -65,13 +65,14 @@ function Necessario({ sim }: { sim: boolean }) {
   return sim ? <span className="text-amber-800">Necessário</span> : <span className="font-normal text-gray-500">Não</span>;
 }
 
-/** O que a empresa já tem de DRPS/Questionário. */
-function JaTem({ s }: { s: SituacaoQuestionario | undefined }) {
-  if (!s) return null;
-  if (s.fase === "concluido") return <div className="text-[11px] font-medium text-emerald-700">{s.doc} concluído</div>;
-  if (s.fase === "andamento") return <div className="text-[11px] font-medium text-sky-700">{s.doc} em andamento</div>;
-  return <div className="text-[11px] font-medium text-red-600">Nenhum feito</div>;
-}
+/** Cores da leitura do DRPS/Questionário (rótulo, detalhe). */
+const COR_TOM: Record<TomLeitura, [string, string]> = {
+  ok: ["text-emerald-800", "text-emerald-700"],
+  alerta: ["text-orange-800", "text-orange-700"],
+  info: ["text-amber-800", "text-sky-700"],
+  perigo: ["text-amber-800", "text-red-600"],
+  neutro: ["font-normal text-gray-500", "text-gray-500"],
+};
 
 /** Contador do topo; clicar aplica o filtro correspondente. */
 function Contador({
@@ -252,7 +253,7 @@ export default function SinalizacaoEmpresasLista({
             >
               <option value="">Todos</option>
               <option value="necessario">Necessário</option>
-              <option value="pendente">Necessário e ainda não concluído</option>
+              <option value="pendente">Necessário e não atendido (inclui revisão)</option>
               <option value="nao">Não necessário</option>
             </select>
           </label>
@@ -366,14 +367,19 @@ export default function SinalizacaoEmpresasLista({
 
                   {/* Linha 2: blocos em destaque */}
                   <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
-                    <Bloco
-                      rotulo="DRPS/Questionário"
-                      destaque={questionarioPendente(e, quest)}
-                      title="3+ alertas organizacionais na AEP recomendam DRPS/Questionário Psicossocial (NR-01)"
-                    >
-                      <Necessario sim={e.precisaQuestionario} />
-                      <JaTem s={quest} />
-                    </Bloco>
+                    {(() => {
+                      const l = leituraQuestionario(e.precisaQuestionario, quest, e.ultimaData);
+                      return (
+                        <Bloco
+                          rotulo="DRPS/Questionário"
+                          destaque={l.pendente}
+                          title="3+ alertas organizacionais na AEP recomendam DRPS/Questionário Psicossocial (NR-01). Concluído antes da AEP = revisão recomendada."
+                        >
+                          <span className={COR_TOM[l.tom][0]}>{l.rotulo}</span>
+                          {l.detalhe && <div className={cn("text-[11px] font-medium", COR_TOM[l.tom][1])}>{l.detalhe}</div>}
+                        </Bloco>
+                      );
+                    })()}
                     <Bloco rotulo="AET" destaque={e.precisaAet} title="Algum setor com indicação de Análise Ergonômica do Trabalho">
                       <Necessario sim={e.precisaAet} />
                     </Bloco>
```

### G: diff de `components/aep/SinalizacaoEmpresaDetalhe.tsx`

```diff
@@ -11,9 +11,9 @@ import { useMemo } from "react";
 import Link from "next/link";
 import { useQuery } from "@tanstack/react-query";
 import { ArrowLeft, Building2, Layers } from "lucide-react";
-import { useAepsEntregues } from "@/lib/hooks/useAep";
+import { useAepsEntregues, useSituacaoQuestionarioEmpresas } from "@/lib/hooks/useAep";
 import { useUnidades } from "@/lib/hooks/useUnidades";
-import { montarSinalizacao, piorNivel } from "@/lib/aep/sinalizacao";
+import { leituraQuestionario, montarSinalizacao, piorNivel } from "@/lib/aep/sinalizacao";
 import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
 import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
@@ -75,6 +75,7 @@ export default function SinalizacaoEmpresaDetalhe({
   basePath: string;
 }) {
   const { data: relatorios = [], isLoading } = useAepsEntregues(idEmpresa);
+  const { data: questionarios } = useSituacaoQuestionarioEmpresas([idEmpresa]);
   const sinal = useMemo(() => montarSinalizacao(relatorios)[0] ?? null, [relatorios]);
 
   const { data: cadastro } = useQuery({
@@ -169,9 +170,20 @@ export default function SinalizacaoEmpresaDetalhe({
                 <BlocoAep rotulo="Enviada por">
                   {a.idInspecao ? (a.enviadoPor ?? "—") : <span className="font-normal text-gray-500">Sem inspeção</span>}
                 </BlocoAep>
-                <BlocoAep rotulo="DRPS/Questionário" alerta={a.precisaQuestionario}>
-                  {a.precisaQuestionario ? "Necessário" : <span className="font-normal text-gray-500">Não</span>}
-                </BlocoAep>
+                {(() => {
+                  // Concluído antes desta AEP = revisão recomendada (2026-10-05).
+                  const l = leituraQuestionario(a.precisaQuestionario, questionarios?.[idEmpresa], a.data);
+                  return (
+                    <BlocoAep rotulo="DRPS/Questionário" alerta={l.pendente}>
+                      {l.tom === "neutro" ? <span className="font-normal text-gray-500">{l.rotulo}</span> : l.rotulo}
+                      {l.detalhe && (
+                        <div className="truncate text-[11px] font-medium opacity-80" title={l.detalhe}>
+                          {l.detalhe}
+                        </div>
+                      )}
+                    </BlocoAep>
+                  );
+                })()}
                 <BlocoAep rotulo="AET" alerta={a.precisaAet}>
                   {a.precisaAet ? "Necessária" : <span className="font-normal text-gray-500">Não</span>}
                 </BlocoAep>
```

### H: `lib/comercial/oportunidades.ts` (substituir, completo)

```ts
// Módulo Comercial (2026-10-05): transforma o que a JCN já levantou no cliente
// em OPORTUNIDADES de venda — serviços indicados e que a empresa ainda não
// contratou. Puro (sem tela, sem banco) para testar. Dados da RPC
// `comercial_dados` (v267/v268).
//
// Da AEP ENTREGUE mais recente (regra da Sinalização):
//   • AET (vendida à parte): algum setor com "Necessita AET".
//   • DRPS / Questionário: 3+ alertas organizacionais (`recomendaQuestionario`).
// Da última INSPEÇÃO CONCLUÍDA (v268, escolha do usuário em 2026-10-05):
//   • Apreciação NR-12: máquina com "Necessita adequação NR-12" ou grau Alto/Crítico.
//   • Medição quantitativa: risco físico com "Necessita medição".
//   • Análise de Químicos: risco químico registrado.
//   • AEP: risco ergonômico registrado.
//   • DRPS / Questionário: risco psicossocial registrado.
//   • Treinamentos NR: treinamentos indicados na aba Treinamentos.
//
// Situação, pelo que a empresa já tem no sistema:
//   aberta    → indicada e nenhum documento do serviço existe (vender);
//   revisao   → o documento existente foi concluído ANTES da AEP/inspeção que
//               indicou o serviço (v269): vender a revisão. Vale para AET,
//               DRPS/Questionário, AEP, Apreciação NR-12 e Análise de Químicos;
//   andamento → já existe um em rascunho/andamento (provavelmente vendido);
//   realizada → já existe um concluído/enviado depois da indicação.
// Medição quantitativa não tem módulo no sistema: fica sempre "aberta".
// Treinamentos: realizada quando TODA NR indicada já tem certificado emitido
// para a empresa; andamento quando só parte tem.

import { montarSinalizacao, type AepEntregue, type EmpresaSinalizada } from "@/lib/aep/sinalizacao";

export type SituacaoOportunidade = "aberta" | "revisao" | "andamento" | "realizada";

/** Situações que o comercial ainda pode vender. */
export const A_VENDER: SituacaoOportunidade[] = ["aberta", "revisao"];
export type Produto =
  | "AET"
  | "DRPS/Questionário"
  | "Apreciação NR-12"
  | "Medição quantitativa"
  | "Análise de Químicos"
  | "AEP"
  | "Treinamentos NR";
export type Origem = "AEP" | "Inspeção";

/** Ordem de exibição dos produtos. */
export const PRODUTOS: Produto[] = [
  "AET",
  "AEP",
  "DRPS/Questionário",
  "Apreciação NR-12",
  "Medição quantitativa",
  "Análise de Químicos",
  "Treinamentos NR",
];

export const NOME_PRODUTO: Record<Produto, string> = {
  AET: "AET – Análise Ergonômica do Trabalho",
  AEP: "AEP – Análise Ergonômica Preliminar",
  "DRPS/Questionário": "DRPS / Questionário Psicossocial",
  "Apreciação NR-12": "Apreciação de Máquinas (NR-12)",
  "Medição quantitativa": "Avaliação quantitativa (medição)",
  "Análise de Químicos": "Análise de Químicos",
  "Treinamentos NR": "Treinamentos NR",
};

export interface DocEmpresa {
  id_empresa: string;
  tipo: "AET" | "DRPS" | "QPS" | "AEP" | "APRECIACAO" | "QUIMICOS";
  status: string | null;
  /** Data do documento (v269): envio/conclusão/elaboração. */
  data?: string | null;
}

export interface CertificadoEmpresa {
  id_empresa: string;
  nr: string | null;
}

export interface InspecaoComercial {
  id_inspecao: string;
  id_empresa: string;
  concluida_em: string | null;
  responsavel: string | null;
  empresas?: unknown;
  maquinas: { nome: string | null; grau_risco: string | null; adequacao: boolean | null }[];
  medicoes: { agente: string | null; qual: string | null; setor: string | null }[];
  quimicos: string[];
  ergonomicos: number;
  psicossociais: number;
  treinamentos: { nr: string | null; titulo: string | null }[];
}

export interface SetorAet {
  nome: string;
  expostos: number;
  cargos: number;
}

export interface Oportunidade {
  produto: Produto;
  situacao: SituacaoOportunidade;
  /** De onde veio a indicação (pode ser das duas). */
  origens: Origem[];
  /** Itens que justificam: setores, máquinas, agentes, treinamentos… */
  detalhes: string[];
  /** Para AET: setores indicados (com expostos). */
  setores: SetorAet[];
}

export interface InfoInspecao {
  idInspecao: string;
  concluidaEm: string | null;
  responsavel: string | null;
}

export interface EmpresaComercial {
  empresa: EmpresaSinalizada;
  telefone: string | null;
  email: string | null;
  oportunidades: Oportunidade[];
  /** Trabalhadores expostos nos setores indicados para AET (base do orçamento). */
  expostosAet: number;
  /** A empresa tem AEP entregue (a base das oportunidades de AEP). */
  temAep: boolean;
  /** Última inspeção concluída usada. */
  inspecao: InfoInspecao | null;
}

const FASE: Record<string, "realizada" | "andamento"> = {
  CONCLUIDO: "realizada",
  FINALIZADO: "realizada",
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

/**
 * Como `situacaoPorDocs`, mas um documento concluído ANTES da indicação
 * (data da AEP entregue / inspeção concluída) vira "revisao": a indicação é
 * mais nova que o documento. Sem data em algum dos lados, fica "realizada".
 */
export function situacaoComRevisao(lista: DocEmpresa[], dataIndicacao: string | null | undefined): SituacaoOportunidade {
  const sit = situacaoPorDocs(lista.map((d) => d.status));
  if (sit !== "realizada" || !dataIndicacao) return sit;
  const ultimaConcluida = lista
    .filter((d) => FASE[d.status ?? ""] === "realizada")
    .map((d) => d.data)
    .filter((x): x is string => !!x)
    .sort()
    .pop();
  if (ultimaConcluida && ultimaConcluida.slice(0, 10) < dataIndicacao.slice(0, 10)) return "revisao";
  return sit;
}

/** Nome do documento na frase da revisão. */
const NOME_DOC: Record<DocEmpresa["tipo"], string> = {
  AET: "AET",
  DRPS: "DRPS",
  QPS: "Questionário",
  AEP: "AEP",
  APRECIACAO: "Apreciação de Máquinas",
  QUIMICOS: "Análise de Químicos",
};

/** "2026-06-30..." → "30/06/2026". */
function dataBr(x: string | null | undefined): string {
  return x ? x.slice(0, 10).split("-").reverse().join("/") : "";
}

/** "NR-06", "NR 6" e "6" viram "6" — para casar treinamento com certificado. */
export function numeroNr(nr: string | null | undefined): string {
  const m = (nr ?? "").match(/\d+/);
  return m ? String(Number(m[0])) : (nr ?? "").trim().toLowerCase();
}

type Cad = {
  nome_empresa?: string;
  cnpj?: string | null;
  id_unidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
};

function empresaBase(id: string, cad: Cad): EmpresaSinalizada {
  return {
    idEmpresa: id,
    nome: cad.nome_empresa ?? "Empresa sem cadastro",
    cnpj: cad.cnpj ?? null,
    avaliacoes: [],
    totalSetores: 0,
    totalAlertas: 0,
    totalAltos: 0,
    pior: null,
    ultimaData: null,
    precisaAet: false,
    precisaQuestionario: false,
    realizadaPor: null,
    enviadoPor: null,
    temInspecao: false,
    idUnidade: cad.id_unidade ?? null,
    municipio: cad.municipio ?? null,
    uf: cad.uf ?? null,
  };
}

export function montarComercial(
  aeps: (AepEntregue & { empresas?: unknown })[],
  docs: DocEmpresa[],
  inspecoes: InspecaoComercial[] = [],
  certificados: CertificadoEmpresa[] = [],
): EmpresaComercial[] {
  // ── Base das AEPs: Sinalização (empresas com fator organizacional) + as que
  // só têm AET indicada pela ergonomia física/cognitiva.
  const sinal = new Map(montarSinalizacao(aeps).map((e) => [e.idEmpresa, e]));
  const ultimaAep = new Map<string, AepEntregue & { empresas?: unknown }>();
  for (const a of aeps) {
    const atual = ultimaAep.get(a.id_empresa);
    const data = (x: AepEntregue) => x.entregue_em ?? x.data_elaboracao ?? "";
    if (!atual || data(a) > data(atual)) ultimaAep.set(a.id_empresa, a);
  }
  const inspPorEmpresa = new Map(inspecoes.map((i) => [i.id_empresa, i]));
  const ids = new Set([...ultimaAep.keys(), ...inspPorEmpresa.keys()]);

  const resultado: EmpresaComercial[] = [];
  for (const id of ids) {
    const aep = ultimaAep.get(id);
    const insp = inspPorEmpresa.get(id);
    const cad = ((aep?.empresas ?? insp?.empresas) ?? {}) as Cad;

    let empresa = sinal.get(id);
    if (!empresa) {
      empresa = empresaBase(id, cad);
      if (aep) {
        empresa.precisaAet = (aep.setores ?? []).some((s) => s.necessita_aet);
        empresa.ultimaData = aep.entregue_em ?? aep.data_elaboracao ?? null;
        empresa.realizadaPor = aep.responsavel_elaboracao || null;
        empresa.enviadoPor = aep.enviado_por?.trim() || null;
        empresa.temInspecao = !!(aep as { id_inspecao?: string | null }).id_inspecao;
      }
    }

    const docsDa = docs.filter((d) => d.id_empresa === id);
    /**
     * Situação de um serviço diante da indicação mais nova (2026-10-05): com
     * documento concluído ANTES dela, "revisao" + a frase com as duas datas.
     */
    const avaliar = (
      tipos: DocEmpresa["tipo"][],
      datasIndicacao: (string | null | undefined)[],
    ): { situacao: SituacaoOportunidade; nota: string[] } => {
      const lista = docsDa.filter((d) => tipos.includes(d.tipo));
      const dataInd = datasIndicacao.filter((x): x is string => !!x).sort().pop();
      const situacao = situacaoComRevisao(lista, dataInd);
      if (situacao !== "revisao") return { situacao, nota: [] };
      const ult = lista
        .filter((d) => FASE[d.status ?? ""] === "realizada")
        .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""))
        .pop();
      return ult
        ? { situacao, nota: [`${NOME_DOC[ult.tipo]} concluído em ${dataBr(ult.data)}, antes da indicação de ${dataBr(dataInd)}`] }
        : { situacao, nota: [] };
    };
    const ops = new Map<Produto, Oportunidade>();
    const add = (produto: Produto, situacao: SituacaoOportunidade, origem: Origem, detalhes: string[], setores: SetorAet[] = []) => {
      const ja = ops.get(produto);
      if (ja) {
        if (!ja.origens.includes(origem)) ja.origens.push(origem);
        ja.detalhes.push(...detalhes.filter((d) => !ja.detalhes.includes(d)));
        return;
      }
      ops.set(produto, { produto, situacao, origens: [origem], detalhes: [...detalhes], setores });
    };

    // ── Da AEP entregue
    const setoresAet: SetorAet[] = (aep?.setores ?? [])
      .filter((s) => s.necessita_aet)
      .map((s) => ({
        nome: s.nome_setor || "Setor sem nome",
        expostos: Number(s.qtd_expostos) || 0,
        cargos: (s.cargos ?? []).filter((c) => c.cargo).length,
      }));
    const dataAep = aep ? (aep.entregue_em ?? aep.data_elaboracao) : null;
    const dataInsp = insp?.concluida_em ?? null;
    if (aep && empresa.precisaAet) {
      const r = avaliar(["AET"], [dataAep]);
      add("AET", r.situacao, "AEP", [...setoresAet.map((s) => s.nome), ...r.nota], setoresAet);
    }
    // DRPS/Questionário: a indicação mais nova (AEP ou inspeção) decide.
    const quest = avaliar(
      ["DRPS", "QPS"],
      [aep && empresa.precisaQuestionario ? dataAep : null, insp && insp.psicossociais > 0 ? dataInsp : null],
    );
    if (aep && empresa.precisaQuestionario) {
      add("DRPS/Questionário", quest.situacao, "AEP", [
        `${empresa.totalAlertas} fator(es) organizacional(is) na AEP`,
        ...quest.nota,
      ]);
    }

    // ── Da inspeção concluída
    if (insp) {
      if (insp.maquinas.length > 0) {
        const r = avaliar(["APRECIACAO"], [dataInsp]);
        add("Apreciação NR-12", r.situacao, "Inspeção", [
          ...insp.maquinas.map(
            (m) =>
              `${m.nome || "Máquina"}${m.grau_risco ? ` (grau ${m.grau_risco.toLowerCase()})` : ""}${m.adequacao ? " · necessita adequação" : ""}`,
          ),
          ...r.nota,
        ]);
      }
      if (insp.medicoes.length > 0) {
        add(
          "Medição quantitativa",
          "aberta",
          "Inspeção",
          insp.medicoes.map((m) => [m.qual || m.agente || "Agente físico", m.setor].filter(Boolean).join(" · ")),
        );
      }
      if (insp.quimicos.length > 0) {
        const r = avaliar(["QUIMICOS"], [dataInsp]);
        add("Análise de Químicos", r.situacao, "Inspeção", [...insp.quimicos, ...r.nota]);
      }
      if (insp.ergonomicos > 0) {
        const r = avaliar(["AEP"], [dataInsp]);
        add("AEP", r.situacao, "Inspeção", [`${insp.ergonomicos} risco(s) ergonômico(s) na inspeção`, ...r.nota]);
      }
      if (insp.psicossociais > 0) {
        add("DRPS/Questionário", quest.situacao, "Inspeção", [
          `${insp.psicossociais} risco(s) psicossocial(is) na inspeção`,
          ...quest.nota,
        ]);
      }
      if (insp.treinamentos.length > 0) {
        const certs = new Set(certificados.filter((c) => c.id_empresa === id).map((c) => numeroNr(c.nr)));
        const comCert = insp.treinamentos.filter((t) => certs.has(numeroNr(t.nr)));
        const situacao: SituacaoOportunidade =
          comCert.length === insp.treinamentos.length ? "realizada" : comCert.length > 0 ? "andamento" : "aberta";
        add(
          "Treinamentos NR",
          situacao,
          "Inspeção",
          insp.treinamentos.map(
            (t) => `${[t.nr, t.titulo].filter(Boolean).join(" – ")}${certs.has(numeroNr(t.nr)) ? " · certificado emitido" : ""}`,
          ),
        );
      }
    }

    const oportunidades = PRODUTOS.map((p) => ops.get(p)).filter((o): o is Oportunidade => !!o);
    if (oportunidades.length === 0) continue;
    resultado.push({
      empresa,
      telefone: cad.telefone?.trim() || null,
      email: cad.email?.trim() || null,
      oportunidades,
      expostosAet: setoresAet.reduce((n, s) => n + s.expostos, 0),
      temAep: !!aep,
      inspecao: insp ? { idInspecao: insp.id_inspecao, concluidaEm: insp.concluida_em, responsavel: insp.responsavel } : null,
    });
  }

  const abertas = (c: EmpresaComercial) => c.oportunidades.filter((o) => A_VENDER.includes(o.situacao)).length;
  return resultado.sort((a, b) => abertas(b) - abertas(a) || a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"));
}

/** Uma linha por oportunidade, para exportar (CSV/Excel). */
export function linhasCsv(lista: EmpresaComercial[], nomeUnidade: (id: string | null) => string): string[][] {
  const cab = [
    "Empresa", "CNPJ", "Unidade", "Município/UF", "Telefone", "E-mail", "Produto", "Situação", "Origem",
    "Detalhes", "Trabalhadores expostos (AET)", "Nível AIHA", "AEP realizada por", "AEP enviada por", "AEP entregue em",
    "Inspeção", "Inspeção concluída em",
  ];
  const rot: Record<SituacaoOportunidade, string> = {
    aberta: "Aberta",
    revisao: "Revisão recomendada",
    andamento: "Em andamento",
    realizada: "Realizada",
  };
  const linhas = lista.flatMap((c) =>
    c.oportunidades.map((o) => [
      c.empresa.nome,
      c.empresa.cnpj ?? "",
      nomeUnidade(c.empresa.idUnidade),
      [c.empresa.municipio, c.empresa.uf].filter(Boolean).join("/"),
      c.telefone ?? "",
      c.email ?? "",
      NOME_PRODUTO[o.produto],
      rot[o.situacao],
      o.origens.join(" + "),
      o.detalhes.join(" | "),
      o.produto === "AET" ? String(c.expostosAet) : "",
      c.empresa.pior ?? "",
      c.temAep ? (c.empresa.realizadaPor ?? "") : "",
      c.temAep ? (c.empresa.enviadoPor ?? "") : "",
      c.temAep && c.empresa.ultimaData ? c.empresa.ultimaData.slice(0, 10) : "",
      c.inspecao?.idInspecao ?? "",
      c.inspecao?.concluidaEm ? c.inspecao.concluidaEm.slice(0, 10) : "",
    ]),
  );
  return [cab, ...linhas];
}
```

### I: `lib/comercial/oportunidades.test.ts` (substituir, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasCsv, montarComercial, numeroNr, situacaoComRevisao, situacaoPorDocs, type InspecaoComercial } from "./oportunidades";

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

function insp(idEmpresa: string, p: Partial<InspecaoComercial> = {}): InspecaoComercial {
  return {
    id_inspecao: "INS-" + idEmpresa,
    id_empresa: idEmpresa,
    concluida_em: "2026-10-03",
    responsavel: "Caio",
    empresas: empresa("Empresa " + idEmpresa),
    maquinas: [],
    medicoes: [],
    quimicos: [],
    ergonomicos: 0,
    psicossociais: 0,
    treinamentos: [],
    ...p,
  };
}

const produtos = (r: ReturnType<typeof montarComercial>[number]) => r.oportunidades.map((o) => [o.produto, o.situacao]);

test("situação pelos documentos e número da NR", () => {
  assert.equal(situacaoPorDocs([]), "aberta");
  assert.equal(situacaoPorDocs(["RASCUNHO"]), "andamento");
  assert.equal(situacaoPorDocs(["RASCUNHO", "CONCLUIDO"]), "realizada");
  assert.equal(situacaoPorDocs(["FINALIZADO"]), "realizada");
  assert.equal(situacaoPorDocs(["DELETADO"]), "aberta");
  assert.equal(numeroNr("NR-06"), "6");
  assert.equal(numeroNr("NR 35"), "35");
});

test("AEP: AET e DRPS/Questionário, com a situação pelo que a empresa já tem", () => {
  const [c] = montarComercial([aep("A1", "E1", [setorAet])], [{ id_empresa: "E1", tipo: "QPS", status: "RASCUNHO" }]);
  assert.deepEqual(produtos(c), [["AET", "aberta"], ["DRPS/Questionário", "andamento"]]);
  assert.deepEqual(c.oportunidades[0].setores, [{ nome: "Produção", expostos: 12, cargos: 1 }]);
  assert.equal(c.expostosAet, 12);
  assert.equal(c.telefone, "21 9999");
  assert.equal(c.temAep, true);
});

test("AEP: AET só pela ergonomia física entra; sem indicação não entra", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [{ id: "x", nome_setor: "ADM", necessita_aet: false, checklist_organizacional: {} }])],
    [],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E1"]);
  assert.equal(r[0].expostosAet, 5);
});

test("Inspeção: NR-12, medição, químicos, AEP, psicossocial e treinamentos", () => {
  const [c] = montarComercial(
    [],
    [
      { id_empresa: "E1", tipo: "APRECIACAO", status: "RASCUNHO" },
      { id_empresa: "E1", tipo: "QUIMICOS", status: "CONCLUIDO" },
    ],
    [
      insp("E1", {
        maquinas: [{ nome: "Serra", grau_risco: "ALTO", adequacao: true }],
        medicoes: [{ agente: "Ruído", qual: "Dosimetria", setor: "Produção" }],
        quimicos: ["Tolueno"],
        ergonomicos: 2,
        psicossociais: 1,
        treinamentos: [{ nr: "NR-06", titulo: "EPI" }, { nr: "NR-35", titulo: "Altura" }],
      }),
    ],
    [{ id_empresa: "E1", nr: "NR 6" }],
  );
  assert.deepEqual(produtos(c), [
    ["AEP", "aberta"],
    ["DRPS/Questionário", "aberta"],
    ["Apreciação NR-12", "andamento"],
    ["Medição quantitativa", "aberta"],
    ["Análise de Químicos", "realizada"],
    ["Treinamentos NR", "andamento"],
  ]);
  assert.deepEqual(c.oportunidades[2].detalhes, ["Serra (grau alto) · necessita adequação"]);
  assert.deepEqual(c.oportunidades[3].detalhes, ["Dosimetria · Produção"]);
  assert.match(c.oportunidades[5].detalhes[0], /certificado emitido/);
  assert.equal(c.inspecao?.idInspecao, "INS-E1");
  assert.equal(c.temAep, false);
});

test("DRPS/Questionário pela AEP e pela inspeção vira uma oportunidade só, com as duas origens", () => {
  const [c] = montarComercial([aep("A1", "E1", [setorAet])], [], [insp("E1", { psicossociais: 2 })]);
  const drps = c.oportunidades.filter((o) => o.produto === "DRPS/Questionário");
  assert.equal(drps.length, 1);
  assert.deepEqual(drps[0].origens, ["AEP", "Inspeção"]);
  assert.equal(drps[0].detalhes.length, 2);
});

test("treinamentos todos com certificado = realizada; empresa sem nada indicado não entra", () => {
  const r = montarComercial([], [], [
    insp("E1", { treinamentos: [{ nr: "NR-01", titulo: "GRO" }] }),
    insp("E2"),
  ], [{ id_empresa: "E1", nr: "NR-01" }]);
  assert.deepEqual(r.map((c) => [c.empresa.idEmpresa, c.oportunidades[0].situacao]), [["E1", "realizada"]]);
});

test("abertas primeiro; CSV com uma linha por oportunidade", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [setorSoFisico])],
    [{ id_empresa: "E1", tipo: "AET", status: "CONCLUIDO" }],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E2", "E1"]);
  const csv = linhasCsv(r, () => "Serra");
  assert.equal(csv.length, 3);
  assert.equal(csv[1][2], "Serra");
  assert.equal(csv[1][6], "AET – Análise Ergonômica do Trabalho");
  assert.equal(csv[1][8], "AEP");
  assert.equal(csv[1][10], "5");
});

test("DRPS concluído antes da AEP vira revisão recomendada; depois, realizada", () => {
  assert.equal(situacaoComRevisao([{ id_empresa: "E", tipo: "DRPS", status: "CONCLUIDO", data: "2026-06-30" }], "2026-10-05"), "revisao");
  assert.equal(situacaoComRevisao([{ id_empresa: "E", tipo: "DRPS", status: "CONCLUIDO", data: "2026-10-05T10:00:00Z" }], "2026-10-05"), "realizada");
  assert.equal(situacaoComRevisao([{ id_empresa: "E", tipo: "DRPS", status: "CONCLUIDO" }], "2026-10-05"), "realizada");
  const [c] = montarComercial(
    [aep("A1", "E1", [setorAet])],
    [{ id_empresa: "E1", tipo: "DRPS", status: "CONCLUIDO", data: "2026-06-30" }],
  );
  const drps = c.oportunidades.find((o) => o.produto === "DRPS/Questionário");
  assert.equal(drps?.situacao, "revisao");
  assert.match(drps?.detalhes.join(" ") ?? "", /DRPS concluído em 30\/06\/2026, antes da indicação de 05\/10\/2026/);
});

test("revisão também para AET, AEP, Apreciação NR-12 e Químicos concluídos antes da indicação", () => {
  const [c] = montarComercial(
    [aep("A1", "E1", [setorSoFisico])],
    [
      { id_empresa: "E1", tipo: "AET", status: "CONCLUIDO", data: "2026-01-10" },
      { id_empresa: "E1", tipo: "APRECIACAO", status: "FINALIZADO", data: "2026-02-01" },
      { id_empresa: "E1", tipo: "QUIMICOS", status: "CONCLUIDO", data: "2026-12-01" },
      { id_empresa: "E1", tipo: "AEP", status: "CONCLUIDO", data: "2026-03-01" },
    ],
    [insp("E1", { concluida_em: "2026-10-03", maquinas: [{ nome: "Serra", grau_risco: "ALTO", adequacao: true }], quimicos: ["Tolueno"], ergonomicos: 1 })],
  );
  const s = Object.fromEntries(c.oportunidades.map((o) => [o.produto, o.situacao]));
  assert.equal(s["AET"], "revisao");
  assert.equal(s["Apreciação NR-12"], "revisao");
  assert.equal(s["AEP"], "revisao");
  assert.equal(s["Análise de Químicos"], "realizada");
  const nr12 = c.oportunidades.find((o) => o.produto === "Apreciação NR-12");
  assert.match(nr12?.detalhes.join(" ") ?? "", /Apreciação de Máquinas concluído em 01\/02\/2026, antes da indicação de 03\/10\/2026/);
});
```

### J: diff de `app/(comercial)/comercial/page.tsx`

```diff
@@ -11,6 +11,7 @@ import { Building2, ClipboardCheck, Download, FilterX, Handshake, Mail, MapPin,
 import { useComercial } from "@/lib/hooks/useComercial";
 import { useUnidades } from "@/lib/hooks/useUnidades";
 import {
+  A_VENDER,
   linhasCsv,
   NOME_PRODUTO,
   PRODUTOS,
@@ -28,7 +29,12 @@ const selectCls =
   "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";
 
 const SITUACAO: Record<SituacaoOportunidade, { rotulo: string; cls: string; dica: string }> = {
-  aberta: { rotulo: "Oportunidade aberta", cls: "border-amber-300 bg-amber-50 text-amber-900", dica: "Indicada na AEP e a empresa ainda não tem" },
+  aberta: { rotulo: "Oportunidade aberta", cls: "border-amber-300 bg-amber-50 text-amber-900", dica: "Indicada e a empresa ainda não tem" },
+  revisao: {
+    rotulo: "Revisão recomendada",
+    cls: "border-orange-300 bg-orange-50 text-orange-900",
+    dica: "A empresa já tem, mas foi concluído antes da AEP/inspeção que indicou — vender a revisão",
+  },
   andamento: { rotulo: "Em andamento", cls: "border-sky-200 bg-sky-50 text-sky-900", dica: "Já existe um documento em elaboração" },
   realizada: { rotulo: "Realizada", cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dica: "Já existe um documento concluído" },
 };
@@ -67,7 +73,10 @@ export default function ComercialPage() {
 
   const [busca, setBusca] = useState("");
   const [produto, setProduto] = useState<"" | Produto>("");
-  const [situacao, setSituacao] = useState<"" | SituacaoOportunidade>("aberta");
+  // "vender" = aberta + revisão recomendada (o padrão da tela).
+  const [situacao, setSituacao] = useState<"" | "vender" | SituacaoOportunidade>("vender");
+  const casaSituacao = (s: SituacaoOportunidade) =>
+    !situacao || (situacao === "vender" ? A_VENDER.includes(s) : s === situacao);
   const [unidade, setUnidade] = useState("");
   const [nivel, setNivel] = useState("");
 
@@ -98,27 +107,27 @@ export default function ComercialPage() {
       })
       .map((c) => ({
         ...c,
-        oportunidades: c.oportunidades.filter((o) => (!produto || o.produto === produto) && (!situacao || o.situacao === situacao)),
+        oportunidades: c.oportunidades.filter((o) => (!produto || o.produto === produto) && casaSituacao(o.situacao)),
       }))
       .filter((c) => c.oportunidades.length > 0);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [lista, busca, produto, situacao, unidade, nivel, nomeUnidade]);
 
   const todas = lista.flatMap((c) => c.oportunidades.map((o) => ({ c, o })));
-  const abertas = (p: Produto) => todas.filter(({ o }) => o.produto === p && o.situacao === "aberta");
+  const abertas = (p: Produto) => todas.filter(({ o }) => o.produto === p && A_VENDER.includes(o.situacao));
   const kpi = {
-    abertas: todas.filter(({ o }) => o.situacao === "aberta").length,
+    abertas: todas.filter(({ o }) => A_VENDER.includes(o.situacao)).length,
     aet: abertas("AET").length,
     expostos: abertas("AET").reduce((n, { c }) => n + c.expostosAet, 0),
     andamento: todas.filter(({ o }) => o.situacao === "andamento").length,
   };
   // Abertas por produto — os chips embaixo dos contadores.
   const porProduto = PRODUTOS.map((p) => ({ p, n: abertas(p).length })).filter((x) => x.n > 0);
-  const nAtivos = [busca.trim(), produto, situacao !== "aberta" ? situacao || "todas" : "", unidade, nivel].filter(Boolean).length;
+  const nAtivos = [busca.trim(), produto, situacao !== "vender" ? situacao || "todas" : "", unidade, nivel].filter(Boolean).length;
   const limpar = () => {
     setBusca("");
     setProduto("");
-    setSituacao("aberta");
+    setSituacao("vender");
     setUnidade("");
     setNivel("");
   };
@@ -149,23 +158,23 @@ export default function ComercialPage() {
       {/* Contadores */}
       <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
         <Contador
-          rotulo="Oportunidades em aberto"
+          rotulo="A vender (abertas + revisões)"
           valor={kpi.abertas}
           cor="border-amber-300 bg-amber-50 text-amber-900"
-          ativo={!produto && situacao === "aberta"}
+          ativo={!produto && situacao === "vender"}
           onClick={() => {
             setProduto("");
-            setSituacao("aberta");
+            setSituacao("vender");
           }}
         />
         <Contador
           rotulo="AET em aberto"
           valor={kpi.aet}
           cor="border-amber-300 bg-amber-50 text-amber-900"
-          ativo={produto === "AET" && situacao === "aberta"}
+          ativo={produto === "AET" && situacao === "vender"}
           onClick={() => {
             setProduto("AET");
-            setSituacao("aberta");
+            setSituacao("vender");
           }}
         />
         <Contador
@@ -193,7 +202,7 @@ export default function ComercialPage() {
               type="button"
               onClick={() => {
                 setProduto(produto === p ? "" : p);
-                setSituacao("aberta");
+                setSituacao("vender");
               }}
               className={cn(
                 "rounded-full border px-3 py-1 text-xs font-semibold transition",
@@ -231,9 +240,15 @@ export default function ComercialPage() {
           </label>
           <label className="text-[11px] font-medium text-gray-500">
             Situação
-            <select value={situacao} onChange={(e) => setSituacao(e.target.value as "" | SituacaoOportunidade)} className={selectCls}>
+            <select
+              value={situacao}
+              onChange={(e) => setSituacao(e.target.value as "" | "vender" | SituacaoOportunidade)}
+              className={selectCls}
+            >
               <option value="">Todas</option>
+              <option value="vender">A vender (aberta + revisão)</option>
               <option value="aberta">Oportunidade aberta</option>
+              <option value="revisao">Revisão recomendada</option>
               <option value="andamento">Em andamento</option>
               <option value="realizada">Realizada</option>
             </select>
@@ -269,7 +284,7 @@ export default function ComercialPage() {
           </span>
           {nAtivos > 0 && (
             <button type="button" onClick={limpar} className="inline-flex items-center gap-1 font-semibold text-verde-primary hover:underline">
-              <FilterX className="size-3.5" /> Voltar ao padrão (abertas)
+              <FilterX className="size-3.5" /> Voltar ao padrão (a vender)
             </button>
           )}
         </div>
```

### K: diff de `app/(hub)/modulos/page.tsx`

```diff
@@ -710,7 +710,7 @@ function ComercialDirectCard() {
   const accent = "#B45309";
   const { data: lista, isLoading } = useComercial();
   const abertas = (lista ?? []).reduce(
-    (n, c) => n + c.oportunidades.filter((o) => o.situacao === "aberta").length,
+    (n, c) => n + c.oportunidades.filter((o) => o.situacao === "aberta" || o.situacao === "revisao").length,
     0,
   );
   return (
@@ -740,8 +740,8 @@ function ComercialDirectCard() {
           {isLoading
             ? "Carregando..."
             : abertas > 0
-              ? `${abertas} oportunidade${abertas !== 1 ? "s" : ""} em aberto`
-              : "Nenhuma em aberto"}
+              ? `${abertas} oportunidade${abertas !== 1 ? "s" : ""} a vender`
+              : "Nenhuma a vender"}
         </span>
         <ArrowRight
           className="ml-auto size-4 transition-transform group-hover:translate-x-1"
```

## Passo 4: verificar

1. Rode `npm test` (os testes de `sinalizacao`, `sinalizacao-filtros` e `oportunidades` passam), `npx tsc --noEmit -p .` e `npx next build`; todos devem terminar sem erros.
2. **Sinalização:**
   - uma empresa com DRPS concluído antes da AEP entregue mostra **Revisão recomendada**, com as duas datas, e entra no filtro "pendente";
   - com o DRPS concluído depois da AEP, mostra **Atendido**;
   - sem DRPS, mostra **Necessário · Nenhum DRPS/Questionário feito**.
3. **Comercial:**
   - a tela abre em "A vender";
   - a mesma empresa aparece com DRPS/Questionário em **Revisão recomendada**;
   - finalize uma Apreciação de Máquinas com data anterior à última inspeção concluída: NR-12 também vira revisão;
   - o card da tela Módulos conta "a vender".
4. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

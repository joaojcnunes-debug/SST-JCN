# Replicar no Painel SST: liberação para o Comercial e rascunho esquecido

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-liberacao-comercial.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `a3dfcbc` (liberação) e `80b3490` (rascunho esquecido) de 2026-10-05, já em produção lá.
> **Tem 1 migration** (v270, seção A): colunas, trigger e a nova versão de `comercial_dados()`.

## Pré-requisitos

Aplique antes, nesta ordem, se o painel ainda não tiver:

1. `replicar-no-painel-modulo-comercial.md` (v267)
2. `replicar-no-painel-comercial-pela-inspecao.md` (v268)
3. `replicar-no-painel-revisao-recomendada.md` (v269)

Os diffs são contra o estado depois deles. A AEP também usa a faixa
`SituacaoSinalizacaoAep` (do MD `replicar-no-painel-aep-entrega-e-setores-da-empresa.md`).

## O que faz

### 1. Liberação para o Comercial (v270)

Nada que a inspeção ou a AEP indica vai para o Comercial sem a **validação da
equipe**:

- **Inspeção:**
  - quando está **concluída**, o topo ganha o botão laranja **"Liberar para o
    Comercial"**, que pede confirmação;
  - depois de liberada, aparece o selo **"No Comercial desde dd/mm · Fulano"** e
    o botão **"Retirar do Comercial"**.
- **AEP:**
  - a faixa do editor (Setores / Triagem) ganha a linha **"Comercial"**, com o
    mesmo par de botões;
  - ela aparece depois que a AEP é **entregue ao cliente**.
- **Quem pode:** quem pode editar o documento (`useCanEdit`). Decisão da JCN.
- **Onde fica gravado:** `liberado_comercial_em` e `liberado_comercial_por`, em `inspecoes` e em
  `aep_relatorios` (componente `components/comercial/LiberacaoComercial.tsx`).
- **Retirada automática:** **reabrir a inspeção** (sair de `CONCLUIDA`) a retira
  do Comercial sozinha; o mesmo vale para a AEP **sem inspeção** que volta de
  `CONCLUIDO` para outro status (trigger `fn_retira_do_comercial`).
- **`comercial_dados()`:** só usa as AEPs liberadas e a **última inspeção
  concluída liberada** de cada empresa.
- **Cartões do Comercial:** mostram quem liberou e quando, e o texto da página
  avisa que só entra o que foi liberado.

### 2. Rascunho esquecido não conta como "em andamento"

Um documento em rascunho ou andamento (AET, AEP, DRPS/QPS, Apreciação) cuja
**última edição é anterior** à indicação (AEP entregue ou inspeção concluída)
não conta mais como "em andamento". A oportunidade fica **aberta**, com o aviso:

> "Há N rascunho(s) de X parado(s) desde dd/mm/aaaa, antes da indicação de
> dd/mm/aaaa — não conta como em andamento"

Rascunho sem data continua contando. A regra fica em `rascunhoAntigo` e
`situacaoComRevisao`, em `lib/comercial/oportunidades.ts`, e está testada.

## Passo 1: conferir o painel

| Usado | Conferir no painel |
|---|---|
| `inspecoes.status` com `CONCLUIDA` e "Reabrir" voltando para outro status | o trigger compara `old.status = 'CONCLUIDA'` |
| `aep_relatorios.status` com `CONCLUIDO` e `id_inspecao` | idem para AEP sem inspeção |
| Cabeçalho da inspeção em `app/(app)/inspecoes/[id]/page.tsx`, com `canEdit`, `isConcluida` e a query `["inspecao", id]` | o botão entra depois de "Reabrir" |
| `useSituacaoSinalizacaoAep` em `lib/hooks/useAep.ts` | ganha as colunas da liberação |
| `ConfirmHost` / `confirmar` em `components/ui/confirm.tsx` e `mensagemErro` em `lib/errors.ts` | mesmos nomes |
| RLS de `update` em `inspecoes` e `aep_relatorios` para quem edita | a liberação é um `update` comum, sem RPC |

## Passo 2: migration v270 (banco do painel)

Rode a seção **A** no **banco do painel**, nunca no do JCN.

- Ela recria `comercial_dados()`. Se o painel já tiver diferenças na função,
  aplique só os quatro pontos da liberação: os dois `liberado_comercial_*` no
  JSON de `aeps` e de `inspecoes`, `a.liberado_comercial_em is not null` no
  `where` das AEPs e `x.liberado_comercial_em is not null` na escolha da
  última inspeção.
- **Depois da migration o Comercial fica vazio** até alguém liberar.

Rollback: reaplicar a função da v269 e depois:

```sql
drop trigger if exists trg_inspecoes_retira_comercial on public.inspecoes;
drop trigger if exists trg_aep_retira_comercial on public.aep_relatorios;
drop function if exists public.fn_retira_do_comercial();
alter table public.inspecoes drop column if exists liberado_comercial_em, drop column if exists liberado_comercial_por;
alter table public.aep_relatorios drop column if exists liberado_comercial_em, drop column if exists liberado_comercial_por;
```

## Passo 3: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `supabase/historico/v270_liberacao_comercial.sql` | migration |
| B | `components/comercial/LiberacaoComercial.tsx` | **novo**: botões, selo e mutation |
| C | `lib/supabase/types.ts` | campos `liberado_comercial_*` em `Inspecao` e `AepRelatorio` |
| D | `app/(app)/inspecoes/[id]/page.tsx` | botão no topo da inspeção |
| E | `lib/hooks/useAep.ts` | a situação da AEP traz a liberação |
| F | `components/aep/SituacaoSinalizacaoAep.tsx` | linha "Comercial" na faixa da AEP |
| G | `lib/comercial/oportunidades.ts` | **substituir**: liberação nos dados + `rascunhoAntigo` |
| H | `lib/comercial/oportunidades.test.ts` | **substituir**: 10 testes |
| I | `lib/hooks/useComercial.ts` | comentário |
| J | `app/(comercial)/comercial/page.tsx` | quem liberou e aviso no topo |

### A: `supabase/historico/v270_liberacao_comercial.sql` (novo, completo)

```sql
-- v270 (2026-10-05): liberação para o Comercial. A equipe valida antes de o
-- vendedor ver: inspeção e AEP ganham liberado_comercial_em/_por (botões
-- "Liberar para o Comercial" / "Retirar do Comercial"). Reabrir a inspeção
-- (sair de CONCLUIDA) ou voltar a AEP de CONCLUIDO para outro status retira do
-- Comercial sozinho (triggers). comercial_dados() só usa inspeções e AEPs
-- liberadas. Já aplicada via MCP.
-- Rollback: scripts/sql/v270_rollback_liberacao_comercial.sql
alter table public.inspecoes add column if not exists liberado_comercial_em timestamptz;
alter table public.inspecoes add column if not exists liberado_comercial_por text;
alter table public.aep_relatorios add column if not exists liberado_comercial_em timestamptz;
alter table public.aep_relatorios add column if not exists liberado_comercial_por text;

create or replace function public.fn_retira_do_comercial()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'inspecoes' then
    if old.status = 'CONCLUIDA' and new.status is distinct from 'CONCLUIDA' then
      new.liberado_comercial_em := null;
      new.liberado_comercial_por := null;
    end if;
  elsif old.status = 'CONCLUIDO' and new.status is distinct from 'CONCLUIDO' and new.id_inspecao is null then
    -- AEP sem inspeção voltou para rascunho/andamento.
    new.liberado_comercial_em := null;
    new.liberado_comercial_por := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_inspecoes_retira_comercial on public.inspecoes;
create trigger trg_inspecoes_retira_comercial
  before update of status on public.inspecoes
  for each row execute function public.fn_retira_do_comercial();

drop trigger if exists trg_aep_retira_comercial on public.aep_relatorios;
create trigger trg_aep_retira_comercial
  before update of status on public.aep_relatorios
  for each row execute function public.fn_retira_do_comercial();

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
        'liberado_comercial_em', a.liberado_comercial_em,
        'liberado_comercial_por', a.liberado_comercial_por,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.aep_relatorios a
        join public.empresas e on e.id_empresa = a.id_empresa
        left join public.inspecoes i on i.id_inspecao = a.id_inspecao
       where a.liberado_comercial_em is not null
         and ((a.id_inspecao is not null and i.elaboracao_status = 'CONCLUIDO' and i.status <> 'DELETADA')
           or (a.id_inspecao is null and a.status = 'CONCLUIDO'))
    ), '[]'::jsonb),

    -- Última inspeção CONCLUÍDA de cada empresa e o que ela indica
    'inspecoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_inspecao', i.id_inspecao,
        'id_empresa', i.id_empresa,
        'concluida_em', coalesce(i.concluida_em, i.updated_at),
        'responsavel', i.responsavel,
        'liberado_comercial_em', i.liberado_comercial_em,
        'liberado_comercial_por', i.liberado_comercial_por,
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
           where x.status = 'CONCLUIDA' and x.liberado_comercial_em is not null
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

### B: `components/comercial/LiberacaoComercial.tsx` (novo, completo)

```tsx
"use client";

// Liberação para o Comercial (2026-10-05, v270). O que a inspeção e a AEP
// indicam só vira oportunidade no Comercial depois que a equipe valida:
//   • "Liberar para o Comercial"  → grava liberado_comercial_em/_por;
//   • "Retirar do Comercial"      → limpa (para ajustar algo e liberar de novo).
// Reabrir a inspeção (ou voltar a AEP sem inspeção para rascunho) retira
// sozinho — trigger fn_retira_do_comercial. Quem pode: quem edita o documento.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Handshake, Loader2, Undo2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { mensagemErro } from "@/lib/errors";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { cn, fmtData } from "@/lib/utils";

type Alvo = { tabela: "inspecoes"; id: string } | { tabela: "aep_relatorios"; id: string };

export function useLiberacaoComercial(alvo: Alvo, invalidar: unknown[][] = []) {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (liberar: boolean) => {
      const chave = alvo.tabela === "inspecoes" ? "id_inspecao" : "id_relatorio";
      const patch = liberar
        ? { liberado_comercial_em: new Date().toISOString(), liberado_comercial_por: user?.nome ?? user?.email ?? null }
        : { liberado_comercial_em: null, liberado_comercial_por: null };
      // As colunas da v270 ainda não estão no tipo `Database`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (createSupabaseBrowserClient() as any).from(alvo.tabela).update(patch).eq(chave, alvo.id);
      if (error) throw error;
      return liberar;
    },
    onSuccess: (liberar) => {
      for (const k of invalidar) qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: ["comercial-dados"] });
      toast.success(liberar ? "Liberado para o Comercial" : "Retirado do Comercial");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao alterar a liberação para o Comercial")),
  });
}

/**
 * Botão + selo. `pronto` diz se o documento já pode ser liberado (inspeção
 * concluída / AEP entregue); sem isso o botão não aparece.
 */
export default function LiberacaoComercial({
  alvo,
  liberadoEm,
  liberadoPor,
  pronto,
  podeEditar,
  invalidar,
  compacto = false,
}: {
  alvo: Alvo;
  liberadoEm: string | null | undefined;
  liberadoPor: string | null | undefined;
  pronto: boolean;
  podeEditar: boolean;
  invalidar?: unknown[][];
  compacto?: boolean;
}) {
  const mut = useLiberacaoComercial(alvo, invalidar);
  const nome = alvo.tabela === "inspecoes" ? "inspeção" : "AEP";

  if (liberadoEm) {
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        <ConfirmHost />
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800",
            compacto ? "text-[11px]" : "text-xs"
          )}
          title="O que esta indicação aponta já aparece no módulo Comercial"
        >
          <Handshake className="size-3.5" />
          No Comercial desde {fmtData(liberadoEm)}
          {liberadoPor ? ` · ${liberadoPor}` : ""}
        </span>
        {podeEditar && (
          <button
            type="button"
            disabled={mut.isPending}
            onClick={async () => {
              const ok = await confirmar({
                title: "Retirar do Comercial?",
                description: `As oportunidades desta ${nome} deixam de aparecer para o time comercial até ela ser liberada de novo.`,
                confirmLabel: "Retirar",
                variant: "danger",
              });
              if (ok) mut.mutate(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            Retirar do Comercial
          </button>
        )}
      </div>
    );
  }

  if (!pronto || !podeEditar) return null;
  return (
    <>
      <ConfirmHost />
      <button
        type="button"
        disabled={mut.isPending}
        onClick={async () => {
          const ok = await confirmar({
            title: "Liberar para o Comercial?",
            description: `Os serviços que esta ${nome} indica passam a aparecer como oportunidades no módulo Comercial. Confira o preenchimento antes.`,
            confirmLabel: "Liberar",
            variant: "primary",
          });
          if (ok) mut.mutate(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        title="Validar e mandar as oportunidades desta análise para o time comercial"
      >
        {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />}
        Liberar para o Comercial
      </button>
    </>
  );
}
```

### C: diff de `lib/supabase/types.ts`

```diff
@@ -555,6 +555,9 @@ export interface Unidade {
 }
 
 export interface Inspecao {
+  /** v270: liberação para o Comercial. */
+  liberado_comercial_em?: string | null;
+  liberado_comercial_por?: string | null;
   id_inspecao: string;
   id_empresa: string;
   data_inspecao: string | null;
@@ -2458,6 +2461,9 @@ export interface AepSetor {
 }
 
 export interface AepRelatorio {
+  /** v270: liberação para o Comercial. */
+  liberado_comercial_em?: string | null;
+  liberado_comercial_por?: string | null;
   id_relatorio: string;
   id_empresa: string;
   status: StatusAEP;
```

### D: diff de `app/(app)/inspecoes/[id]/page.tsx`

```diff
@@ -1,5 +1,6 @@
 "use client";
 
+import LiberacaoComercial from "@/components/comercial/LiberacaoComercial";
 import { use, useCallback, useState } from "react";
 import Link from "next/link";
 import { useRouter, useSearchParams } from "next/navigation";
@@ -458,6 +459,15 @@ export default function InspecaoEditorPage({ params }: Props) {
                 Reabrir
               </button>
             )}
+            {/* Liberação para o Comercial (v270): só concluída; reabrir retira. */}
+            <LiberacaoComercial
+              alvo={{ tabela: "inspecoes", id }}
+              liberadoEm={inspecao.liberado_comercial_em}
+              liberadoPor={inspecao.liberado_comercial_por}
+              pronto={isConcluida}
+              podeEditar={canEdit}
+              invalidar={[["inspecao", id]]}
+            />
           </div>
         </div>
       </div>
```

### E: diff de `lib/hooks/useAep.ts`

```diff
@@ -402,7 +402,9 @@ export function useSituacaoSinalizacaoAep(idRelatorio: string) {
       const supabase = createSupabaseBrowserClient();
       const { data, error } = await supabase
         .from("aep_relatorios")
-        .select("id_empresa, id_inspecao, status, concluido_em, inspecoes(id_inspecao, status, elaboracao_status, elaboracao_concluida_em)")
+        .select(
+          "id_empresa, id_inspecao, status, concluido_em, liberado_comercial_em, liberado_comercial_por, inspecoes(id_inspecao, status, elaboracao_status, elaboracao_concluida_em)"
+        )
         .eq("id_relatorio", idRelatorio)
         .maybeSingle();
       if (error) throw error;
@@ -411,6 +413,8 @@ export function useSituacaoSinalizacaoAep(idRelatorio: string) {
         id_inspecao: string | null;
         status: string;
         concluido_em: string | null;
+        liberado_comercial_em: string | null;
+        liberado_comercial_por: string | null;
         inspecoes: {
           id_inspecao: string;
           status: string;
@@ -425,6 +429,8 @@ export function useSituacaoSinalizacaoAep(idRelatorio: string) {
           ? r?.inspecoes?.elaboracao_status === "CONCLUIDO" && r?.inspecoes?.status !== "DELETADA"
           : r?.status === "CONCLUIDO",
         entregueEm: r?.id_inspecao ? (r?.inspecoes?.elaboracao_concluida_em ?? null) : (r?.concluido_em ?? null),
+        liberadoComercialEm: r?.liberado_comercial_em ?? null,
+        liberadoComercialPor: r?.liberado_comercial_por ?? null,
       };
     },
   });
```

### F: diff de `components/aep/SituacaoSinalizacaoAep.tsx`

```diff
@@ -18,6 +18,8 @@ import {
   type VinculoInspecao,
 } from "@/lib/hooks/useErgonomiaInspecao";
 import { cn, fmtData } from "@/lib/utils";
+import LiberacaoComercial from "@/components/comercial/LiberacaoComercial";
+import { useCanEdit } from "@/lib/hooks/useUsuario";
 
 function AlterarInspecao({
   idRelatorio,
@@ -130,6 +132,7 @@ function AlterarInspecao({
 export default function SituacaoSinalizacaoAep({ idRelatorio }: { idRelatorio: string }) {
   const { data } = useSituacaoSinalizacaoAep(idRelatorio);
   const [editando, setEditando] = useState(false);
+  const canEdit = useCanEdit();
   if (!data) return null;
 
   const link = data.idInspecao ? (
@@ -192,6 +195,24 @@ export default function SituacaoSinalizacaoAep({ idRelatorio }: { idRelatorio: s
           </button>
         )}
       </div>
+      {/* Comercial (v270): só depois de entregue; a equipe libera ou retira. */}
+      {(data.entregue || data.liberadoComercialEm) && (
+        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-current/10 pt-2">
+          <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Comercial</span>
+          <LiberacaoComercial
+            alvo={{ tabela: "aep_relatorios", id: idRelatorio }}
+            liberadoEm={data.liberadoComercialEm}
+            liberadoPor={data.liberadoComercialPor}
+            pronto={data.entregue}
+            podeEditar={canEdit}
+            invalidar={[["aep-situacao-sinalizacao", idRelatorio]]}
+            compacto
+          />
+          {!data.liberadoComercialEm && !canEdit && (
+            <span className="text-[11px] opacity-70">Ainda não liberada para o Comercial.</span>
+          )}
+        </div>
+      )}
       {editando && data.idEmpresa && (
         <AlterarInspecao
           idRelatorio={idRelatorio}
```

### G: `lib/comercial/oportunidades.ts` (substituir, completo)

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
//   andamento → já existe um em rascunho/andamento (provavelmente vendido).
//               Rascunho cuja ÚLTIMA EDIÇÃO é anterior à indicação não conta
//               (rascunho esquecido): a oportunidade fica aberta, com aviso;
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
  /** v270: quem liberou para o Comercial e quando. */
  liberado_comercial_em?: string | null;
  liberado_comercial_por?: string | null;
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
  liberadoEm: string | null;
  liberadoPor: string | null;
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
  /** v270: liberação da AEP para o Comercial. */
  aepLiberadaEm: string | null;
  aepLiberadaPor: string | null;
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
  // Rascunho/andamento parado desde antes da indicação não vale como "em
  // andamento" (2026-10-05): sai da conta. Sem data, continua valendo.
  const valida = dataIndicacao ? lista.filter((d) => !rascunhoAntigo(d, dataIndicacao)) : lista;
  const sit = situacaoPorDocs(valida.map((d) => d.status));
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

/** Rascunho/andamento cuja última edição é anterior à indicação. */
export function rascunhoAntigo(d: DocEmpresa, dataIndicacao: string | null | undefined): boolean {
  return (
    FASE[d.status ?? ""] === "andamento" && !!d.data && !!dataIndicacao && d.data.slice(0, 10) < dataIndicacao.slice(0, 10)
  );
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
      // Rascunhos esquecidos: não contam, mas o vendedor fica sabendo.
      const antigos = lista.filter((d) => rascunhoAntigo(d, dataInd));
      const notaAntigos =
        antigos.length > 0 && situacao === "aberta"
          ? [
              `${antigos.length === 1 ? "Há 1 rascunho" : `Há ${antigos.length} rascunhos`} de ${NOME_DOC[antigos[0].tipo]} parado${antigos.length === 1 ? "" : "s"} desde ${dataBr(
                antigos.map((d) => d.data ?? "").sort().pop(),
              )}, antes da indicação de ${dataBr(dataInd)} — não conta como em andamento`,
            ]
          : [];
      if (situacao !== "revisao") return { situacao, nota: notaAntigos };
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
      inspecao: insp
        ? {
            idInspecao: insp.id_inspecao,
            concluidaEm: insp.concluida_em,
            responsavel: insp.responsavel,
            liberadoEm: insp.liberado_comercial_em ?? null,
            liberadoPor: insp.liberado_comercial_por ?? null,
          }
        : null,
      aepLiberadaEm: (aep as { liberado_comercial_em?: string | null } | undefined)?.liberado_comercial_em ?? null,
      aepLiberadaPor: (aep as { liberado_comercial_por?: string | null } | undefined)?.liberado_comercial_por ?? null,
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

### H: `lib/comercial/oportunidades.test.ts` (substituir, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasCsv, montarComercial, numeroNr, rascunhoAntigo, situacaoComRevisao, situacaoPorDocs, type InspecaoComercial } from "./oportunidades";

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

test("rascunho parado desde antes da indicação não conta como em andamento", () => {
  const velho = { id_empresa: "E1", tipo: "APRECIACAO" as const, status: "RASCUNHO", data: "2026-07-31" };
  const novoRasc = { id_empresa: "E1", tipo: "APRECIACAO" as const, status: "RASCUNHO", data: "2026-10-04" };
  assert.equal(rascunhoAntigo(velho, "2026-10-03"), true);
  assert.equal(situacaoComRevisao([velho], "2026-10-03"), "aberta");
  assert.equal(situacaoComRevisao([velho, novoRasc], "2026-10-03"), "andamento");
  assert.equal(situacaoComRevisao([{ ...velho, data: null }], "2026-10-03"), "andamento");
  const [c] = montarComercial(
    [],
    [velho, { ...velho, data: "2026-08-04" }],
    [insp("E1", { concluida_em: "2026-10-03", maquinas: [{ nome: "Serra", grau_risco: "ALTO", adequacao: true }] })],
  );
  const nr12 = c.oportunidades.find((o) => o.produto === "Apreciação NR-12");
  assert.equal(nr12?.situacao, "aberta");
  assert.match(nr12?.detalhes.join(" ") ?? "", /Há 2 rascunhos de Apreciação de Máquinas parados desde 04\/08\/2026/);
});
```

### I: diff de `lib/hooks/useComercial.ts`

```diff
@@ -28,6 +28,7 @@ export function useComercial() {
       };
       const aeps = (r.aeps ?? []).map((a) => {
         const x = a as { entregue_em?: string | null; enviado_por?: string | null };
+        // normalizarRelatorio mantém os demais campos (inclusive liberado_comercial_*).
         return { ...normalizarRelatorio(a), entregue_em: x.entregue_em ?? null, enviado_por: x.enviado_por ?? null };
       });
       return montarComercial(aeps, r.docs ?? [], r.inspecoes ?? [], r.certificados ?? []);
```

### J: diff de `app/(comercial)/comercial/page.tsx`

```diff
@@ -140,7 +140,8 @@ export default function ComercialPage() {
             <Handshake className="size-5 text-amber-700" /> Oportunidades comerciais
           </h1>
           <p className="max-w-3xl text-sm text-gray-500">
-            Serviços que a JCN já identificou no cliente e que a empresa ainda não contratou: pela{" "}
+            Só entram inspeções e AEPs <strong>liberadas para o Comercial</strong> pela equipe. Serviços que a JCN já
+            identificou no cliente e que a empresa ainda não contratou: pela{" "}
             <strong>AEP entregue</strong> (AET e DRPS/Questionário) e pela <strong>última inspeção concluída</strong>{" "}
             (Apreciação NR-12, medição quantitativa, Análise de Químicos, AEP, DRPS/Questionário e treinamentos NR).
           </p>
@@ -406,6 +407,18 @@ function CartaoEmpresa({ c, unidade }: { c: EmpresaComercial; unidade: string })
             Inspeção feita por <strong className="text-gray-700">{c.inspecao.responsavel ?? "—"}</strong>
           </span>
         )}
+        {c.inspecao?.liberadoEm && (
+          <span>
+            Inspeção liberada para o Comercial em {fmtData(c.inspecao.liberadoEm)}
+            {c.inspecao.liberadoPor ? ` por ${c.inspecao.liberadoPor}` : ""}
+          </span>
+        )}
+        {c.temAep && c.aepLiberadaEm && (
+          <span>
+            AEP liberada em {fmtData(c.aepLiberadaEm)}
+            {c.aepLiberadaPor ? ` por ${c.aepLiberadaPor}` : ""}
+          </span>
+        )}
       </div>
     </li>
   );
```

## Passo 4: verificar

1. Rode `npm test` (os 10 testes de `oportunidades.test.ts` passam), `npx tsc --noEmit -p .` e `npx next build`; todos devem terminar sem erros.
2. **Depois da migration:** o Comercial fica vazio.
3. **Liberar a inspeção:**
   - numa inspeção **concluída**, clique em **"Liberar para o Comercial"**;
   - aparece o selo "No Comercial desde…", e a empresa volta ao Comercial com "Inspeção liberada para o Comercial em … por …".
4. **Reabrir:** reabra a inspeção; o selo some e a empresa sai do Comercial (sem AEP liberada). Conclua e libere de novo.
5. **AEP:** numa AEP entregue, a faixa mostra "Comercial · Liberar para o Comercial"; liberada, as oportunidades de AET/DRPS aparecem.
6. **Retirar do Comercial:** pede confirmação e tira a oportunidade da lista.
7. **Rascunho esquecido:** uma Apreciação em rascunho editada pela última vez antes da inspeção concluída deixa a NR-12 como **Oportunidade aberta**, com o aviso "Há 1 rascunho… parado desde…".
8. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

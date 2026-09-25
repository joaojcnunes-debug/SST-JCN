# Replicar no Painel SST: abas AEP/AET na inspeção e quadro "Documentos da empresa"

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-aet-e-documentos.md`"*.
>
> Continua o `replicar-no-painel-certificados-e-riscos.md`. Cobre o que foi
> feito no JCN (`sst-jcn`) depois dele, até o commit `07bba07` de 2026-09-25.
> O código novo está completo no fim deste arquivo.

## O que entra e o que não entra

| Mudança no JCN | Replicar no painel? |
|---|---|
| **Abas AEP e AET na inspeção** + "Enviar para o módulo" (v259) | **Sim**: parte 1 |
| **Quadro "Documentos da empresa"** na inspeção | **Sim**: parte 2 |
| Rotas `/api/usuarios/*` usando funções do banco quando falta `SUPABASE_SERVICE_ROLE_KEY` | **Não**. O JCN roda na Vercel sem a chave; o painel fala com o GoTrue self-hosted e não tem esse problema |
| v260: colunas de token NULL em `auth.users` (função `criar_usuario_admin`) | **Não**. Efeito colateral do item acima, só no JCN. Se um dia o painel usar essa função, grave `''` em `confirmation_token`, `recovery_token`, `email_change_token_new` e `email_change` |
| v261: imagens do OWAS apontando para storage de outro projeto | **Não**. Os links quebrados vieram da cópia do painel para o JCN |
| PDF da AET usando a origem da requisição sem `AUTH_INTERNAL_URL` | **Não**. O painel tem `AUTH_INTERNAL_URL` |
| v65 `usuarios.cpf`, e-mail do admin na tela de Módulos | **Não**. Só faltavam no JCN / marca do JCN |

---

## Parte 1: abas AEP e AET na inspeção

### O que faz
- Na tela da inspeção (`/inspecoes/[id]`), duas abas novas, **AEP** e **AET**,
  entre **Máquinas** e **Complementos**. Só aparecem para quem tem o módulo
  `aep` / `aet` (Admin sempre vê).
- Aba vazia: botão **"Iniciar AEP/AET desta inspeção"**. O laudo nasce já com:
  - os **setores** da inspeção (`setor_ghe` → `nome_setor`, `descricao` →
    `descricao_atividade`);
  - os **cargos** de cada setor;
  - na AET, também as **máquinas** de cada setor (`maquinas_equipamentos`);
  - responsável, cargo e registro do usuário logado, endereço da empresa e a
    data de hoje.
- Dentro da aba ficam **as mesmas telas dos módulos**, completas:
  - AEP: Setores/Triagem e Dados/Conclusão;
  - AET: Setores (com OWAS e checklist), Análise, Psicossocial (13 fatores),
    Plano de Ação e Dados Gerais;
  - mais um link "Laudo / Imprimir".
- **"Enviar para o módulo AEP/AET"**: até clicar, o laudo aparece como
  "Só nesta inspeção" e **não** aparece nas listas, no dashboard nem na tela
  inicial do módulo. Depois de enviado, aparece normalmente.
- **É o mesmo registro nos dois lados**, não uma cópia: editar na inspeção ou
  no módulo vale para os dois.
- Uma AEP e uma AET por inspeção (índice único).

### Como foi feito (4 passos)

**1.1. Banco (seção A).** `aep_relatorios` e `aet_relatorios` ganham
`id_inspecao` (FK para `inspecoes`, `on delete set null`) e
`enviado_modulo_em`, mais um índice único parcial em `id_inspecao`. Laudos
antigos ficam com `id_inspecao` NULL e continuam visíveis.
- Use o **próximo número de migration do painel**, não o `v259`.
- Confira que `inspecoes.id_inspecao` é `text`, como no JCN.
- Aplique no banco do painel, **nunca** no do JCN (`ieesssxgjzywrtiqdvmz`).

**1.2. Esconder os não enviados nos módulos.** Filtro PostgREST
`.or("id_inspecao.is.null,enviado_modulo_em.not.is.null")` em:
- `useAepRelatorios` (`lib/hooks/useAep.ts`), onde nasce a constante
  exportada `FILTRO_VISIVEL_NO_MODULO`;
- `useAetRelatorios` (`lib/hooks/useAet.ts`);
- as consultas `home-stats-aep` e `home-stats-aet` (`lib/hooks/useHomeStats.ts`).

Procure no painel **toda** consulta de lista a `aep_relatorios` e
`aet_relatorios`. As que buscam **por id** (laudo, PDF, editor) **não** levam o
filtro. Diff na seção B.

**1.3. Transformar as telas dos módulos em componentes.** Cada página abaixo
recebe `params` e faz `const { idRelatorio } = use(params)`. O corpo foi movido
**sem alteração** para um componente que recebe `idRelatorio` por prop, e a
página virou um invólucro de 10 linhas:

| Página (vira invólucro) | Componente novo |
|---|---|
| `app/(aep)/aep/[idRelatorio]/setores/page.tsx` | `components/aep/AepSetoresEditor.tsx` |
| `app/(aep)/aep/[idRelatorio]/dados/page.tsx` | `components/aep/AepDadosEditor.tsx` |
| `app/(aet)/aet/[idRelatorio]/setores/page.tsx` | `components/aet/AetSetoresEditor.tsx` |
| `app/(aet)/aet/[idRelatorio]/analise/page.tsx` | `components/aet/AetAnaliseEditor.tsx` |
| `app/(aet)/aet/[idRelatorio]/psicossocial/page.tsx` | `components/aet/AetPsicossocialEditor.tsx` |
| `app/(aet)/aet/[idRelatorio]/plano-acao/page.tsx` | `components/aet/AetPlanoAcaoEditor.tsx` |
| `app/(aet)/aet/[idRelatorio]/dados/page.tsx` | `components/aet/AetDadosEditor.tsx` |

Receita, igual para as 7 páginas:
1. Copie o arquivo da página para o componente.
2. No componente, troque a assinatura
   `export default function X({ params }: { params: Promise<{ idRelatorio: string }> }) {`
   + `const { idRelatorio } = use(params);`
   por `export default function X({ idRelatorio }: { idRelatorio: string }) {`,
   e tire `use` do import de `react` se sobrar sem uso.
3. Substitua a página pelo invólucro:
   ```tsx
   "use client";

   import { use } from "react";
   import AepSetoresEditor from "@/components/aep/AepSetoresEditor";

   // O editor mora em `components/aep/AepSetoresEditor.tsx` para ser usado
   // também na aba AEP da inspeção.
   export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
     const { idRelatorio } = use(params);
     return <AepSetoresEditor idRelatorio={idRelatorio} />;
   }
   ```

Se no painel essas páginas tiverem outros nomes ou já forem componentes, adapte:
o que importa é cada editor aceitar `idRelatorio` por prop.

Único ajuste de conteúdo: `AepDadosEditor` ganhou a prop opcional
`embutido`, que esconde o botão "voltar para /aep" (diff na seção C).

**1.4. A aba na inspeção.**
- `lib/hooks/useErgonomiaInspecao.ts` (seção D): consultar, iniciar e enviar
  o laudo. Depende de `setorVazioAep` (`useAep.ts`), `setorVazio`
  (`useAet.ts`) e `montarEnderecoEmpresa` (`lib/textos-padrao/variaveis.ts`).
  Confira os nomes no painel.
- `components/inspecoes/editor/tabs/ErgonomiaTab.tsx` (seção E): a aba.
- `app/(app)/inspecoes/[id]/page.tsx` (diff na seção F): `"aep"` e `"aet"`
  em `TAB_KEYS`, as duas entradas em `TABS` (ícones `PersonStanding` e
  `Accessibility`), o filtro por módulo e a renderização da `ErgonomiaTab`.

---

## Parte 2: quadro "Documentos da empresa" na inspeção

### O que faz
Na tela da inspeção, entre o painel com os dados da empresa e o "Levar para o
campo", um quadro com quatro cartões: **DRPS**, **QPS** (Questionário
Psicossocial), **AEP** e **AET**. Cada cartão mostra quantos documentos a
empresa tem em cada situação:
- **Em andamento**: `RASCUNHO` e `EM_ANDAMENTO`;
- **Concluído**: `CONCLUIDO`;
- **Enviado ao cliente**: `ENVIADO_CLIENTE`, só DRPS e QPS;
- ou "Nenhum para esta empresa". `DELETADO` não conta.

É só leitura e **todos os perfis veem**.

### Como foi feito
- `components/empresas/DocumentosEmpresaPainel.tsx` (seção G): uma consulta
  `select("status").eq("id_empresa", …)` em `drps_relatorios`,
  `qps_aplicacoes`, `aep_relatorios` e `aet_relatorios`.
- Na página da inspeção, logo depois do `<EmpresaInfoPanel …/>` (diff na
  seção F):
  ```tsx
  <DocumentosEmpresaPainel
    idEmpresa={inspecao.id_empresa}
    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
  />
  ```
- Se o painel não tiver o status `ENVIADO_CLIENTE` em algum desses módulos, a
  contagem de "Enviado" só fica zerada. Não quebra.

---

## Verificar antes de publicar

1. `npx tsc --noEmit -p .` e `npx next build`, sem erros.
2. As páginas dos módulos AEP/AET continuam abrindo e salvando como antes: as
   mesmas telas, agora via componente.
3. Numa inspeção de teste, na aba AEP:
   - "Iniciar" cria o laudo com os setores e cargos;
   - ele **não** aparece em `/aep` nem no dashboard da AEP;
   - "Enviar para o módulo" o faz aparecer;
   - editar dos dois lados reflete nos dois.
   Repita na aba AET.
4. Um usuário **sem** o módulo AEP não vê a aba AEP.
5. O quadro "Documentos da empresa" bate com o banco:
   ```sql
   select 'DRPS', status, count(*) from drps_relatorios where id_empresa = '<id>' group by 2
   union all select 'QPS', status, count(*) from qps_aplicacoes where id_empresa = '<id>' group by 2
   union all select 'AEP', status, count(*) from aep_relatorios where id_empresa = '<id>' group by 2
   union all select 'AET', status, count(*) from aet_relatorios where id_empresa = '<id>' group by 2;
   ```
6. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

---

## A: `supabase/historico/v259_aep_aet_da_inspecao.sql`

```sql
-- v259 — AEP e AET preenchidas dentro da inspeção (abas AEP / AET).
--
-- Pedido em 2026-09-25: preencher a AEP e a AET completas na tela da inspeção
-- e, com o botão "Enviar para o módulo", deixá-las disponíveis nos módulos
-- AEP e AET que já existem.
--
-- Desenho: o laudo nasce na PRÓPRIA tabela do módulo (aep_relatorios /
-- aet_relatorios), com `id_inspecao` apontando para a inspeção. Assim as
-- mesmas telas dos módulos editam o laudo dentro da aba, e as tabelas-satélite
-- do AET (ações, 13 fatores, QPS do laudo) funcionam sem cópia.
--   · enviado_modulo_em NULL  → só aparece na inspeção (as listas dos módulos
--                                filtram `id_inspecao is null or enviado_modulo_em is not null`);
--   · enviado_modulo_em preenchido → aparece no módulo; continua o MESMO laudo.
-- Laudos antigos têm id_inspecao NULL e seguem visíveis como sempre.
--
-- Uma AEP e uma AET por inspeção (índice único parcial).
-- Rollback: scripts/sql/v259_rollback_aep_aet_da_inspecao.sql

begin;

alter table public.aep_relatorios
  add column if not exists id_inspecao text references public.inspecoes(id_inspecao) on delete set null,
  add column if not exists enviado_modulo_em timestamptz;
alter table public.aet_relatorios
  add column if not exists id_inspecao text references public.inspecoes(id_inspecao) on delete set null,
  add column if not exists enviado_modulo_em timestamptz;

create unique index if not exists aep_relatorios_id_inspecao_uq
  on public.aep_relatorios (id_inspecao) where id_inspecao is not null;
create unique index if not exists aet_relatorios_id_inspecao_uq
  on public.aet_relatorios (id_inspecao) where id_inspecao is not null;

comment on column public.aep_relatorios.id_inspecao is
  'Inspeção onde a AEP foi preenchida (aba AEP). NULL = criada no próprio módulo (v259).';
comment on column public.aep_relatorios.enviado_modulo_em is
  'Quando a AEP da inspeção foi liberada no módulo. NULL com id_inspecao = só na inspeção (v259).';
comment on column public.aet_relatorios.id_inspecao is
  'Inspeção onde a AET foi preenchida (aba AET). NULL = criada no próprio módulo (v259).';
comment on column public.aet_relatorios.enviado_modulo_em is
  'Quando a AET da inspeção foi liberada no módulo. NULL com id_inspecao = só na inspeção (v259).';

commit;
```

Rollback (`scripts/sql/v259_rollback_aep_aet_da_inspecao.sql`):

```sql
-- Rollback da v259. Os laudos criados pela inspeção CONTINUAM existindo e
-- passam a aparecer nos módulos (perdem só o vínculo com a inspeção).
begin;
drop index if exists public.aep_relatorios_id_inspecao_uq;
drop index if exists public.aet_relatorios_id_inspecao_uq;
alter table public.aep_relatorios drop column if exists enviado_modulo_em, drop column if exists id_inspecao;
alter table public.aet_relatorios drop column if exists enviado_modulo_em, drop column if exists id_inspecao;
commit;
```

## B: diffs de `useAep.ts`, `useAet.ts` e `useHomeStats.ts`

```diff
diff --git a/lib/hooks/useAep.ts b/lib/hooks/useAep.ts
index 0911031..a77ff13 100644
--- a/lib/hooks/useAep.ts
+++ b/lib/hooks/useAep.ts
@@ -242,6 +242,10 @@ export function riscoMaximoRelatorio(rel: AepRelatorio): ClassificacaoRiscoAET |
 
 // ─── Relatórios ───────────────────────────────────────────────────────────────
 
+// v259: AEP/AET preenchida na aba da inspeção só aparece no módulo depois
+// do "Enviar para o módulo".
+export const FILTRO_VISIVEL_NO_MODULO = "id_inspecao.is.null,enviado_modulo_em.not.is.null";
+
 export function useAepRelatorios(empresaId?: string | null) {
   const user = useUserStore((s) => s.user);
 
@@ -252,6 +256,7 @@ export function useAepRelatorios(empresaId?: string | null) {
       let q = supabase
         .from("aep_relatorios")
         .select("*, empresas(nome_empresa, cnpj)")
+        .or(FILTRO_VISIVEL_NO_MODULO)
         .order("created_at", { ascending: false });
 
       if (empresaId) {
diff --git a/lib/hooks/useAet.ts b/lib/hooks/useAet.ts
index fa41733..dc8f44a 100644
--- a/lib/hooks/useAet.ts
+++ b/lib/hooks/useAet.ts
@@ -12,6 +12,7 @@ import type { Aet13FatorConfig, Aet13FatorPergunta, Aet13FatorSemaforo, AetCargo
 import { gravar, type ImagemPendente } from "@/lib/offline/gravar";
 import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
 import { ehErroDeRede } from "@/lib/offline/rede";
+import { FILTRO_VISIVEL_NO_MODULO } from "@/lib/hooks/useAep";
 
 function normalizarCargos(raw: unknown): AetCargo[] {
   if (Array.isArray(raw))
@@ -77,6 +78,7 @@ export function useAetRelatorios(empresaId?: string | null) {
       let q = supabase
         .from("aet_relatorios")
         .select("*, empresas(nome_empresa, cnpj)")
+        .or(FILTRO_VISIVEL_NO_MODULO)
         .order("created_at", { ascending: false });
 
       if (empresaId) {
diff --git a/lib/hooks/useHomeStats.ts b/lib/hooks/useHomeStats.ts
index aab0006..6797dfc 100644
--- a/lib/hooks/useHomeStats.ts
+++ b/lib/hooks/useHomeStats.ts
@@ -13,6 +13,7 @@ import type {
 } from "@/lib/supabase/types";
 import type { DrpsRelatorio } from "@/lib/drps/types";
 import { ehSemNR } from "@/lib/conformidade/checklists";
+import { FILTRO_VISIVEL_NO_MODULO } from "@/lib/hooks/useAep";
 
 // ===================================================
 // Tipos
@@ -245,6 +246,7 @@ export function useHomeStats(): HomeStatsData {
       let q = supabase
         .from("aet_relatorios")
         .select("id_relatorio, id_empresa, status, created_at, updated_at")
+        .or(FILTRO_VISIVEL_NO_MODULO)
         .order("updated_at", { ascending: false, nullsFirst: false })
         .limit(200);
       if (empresasVinculadas) {
@@ -265,6 +267,7 @@ export function useHomeStats(): HomeStatsData {
       let q = supabase
         .from("aep_relatorios")
         .select("id_relatorio, id_empresa, status, created_at, updated_at")
+        .or(FILTRO_VISIVEL_NO_MODULO)
         .order("updated_at", { ascending: false, nullsFirst: false })
         .limit(200);
       if (empresasVinculadas) {
```

## C: diff de `AepDadosEditor` em relação à página original

```diff
@@ -2,7 +2,7 @@
 
 import { EditorSkeleton } from "@/components/ui/PageSkeletons";
 
-import { use, useEffect, useState } from "react";
+import { useEffect, useState } from "react";
 import { useRouter } from "next/navigation";
 import { ArrowLeft, Loader2, Save } from "lucide-react";
 import { useAepRelatorio, useSalvarAep } from "@/lib/hooks/useAep";
@@ -14,12 +14,8 @@
 import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";
 import type { StatusAEP } from "@/lib/supabase/types";
 
-export default function AepDadosPage({
-  params,
-}: {
-  params: Promise<{ idRelatorio: string }>;
-}) {
-  const { idRelatorio } = use(params);
+/** `embutido`: dentro da aba AEP da inspeção — sem o "voltar para a lista do módulo". */
+export default function AepDadosPage({ idRelatorio, embutido = false }: { idRelatorio: string; embutido?: boolean }) {
   const router = useRouter();
   const { data: rel, isLoading } = useAepRelatorio(idRelatorio);
   const salvar  = useSalvarAep();
@@ -83,12 +79,14 @@
   return (
     <div className="mx-auto max-w-2xl space-y-6">
       <div className="flex items-center gap-3">
-        <button
-          onClick={() => router.push("/aep")}
-          className="rounded-lg p-2 hover:bg-gray-100"
-        >
-          <ArrowLeft className="size-4 text-gray-600" />
-        </button>
+        {!embutido && (
+          <button
+            onClick={() => router.push("/aep")}
+            className="rounded-lg p-2 hover:bg-gray-100"
+          >
+            <ArrowLeft className="size-4 text-gray-600" />
+          </button>
+        )}
         <div>
           <h1 className="text-xl font-bold text-gray-900">Dados da Análise</h1>
           <p className="text-sm text-gray-500">{empresa?.nome_empresa ?? "—"}</p>
```

## D: `lib/hooks/useErgonomiaInspecao.ts`

```ts
"use client";

// AEP e AET preenchidas dentro da inspeção (v259).
//
// O laudo nasce na tabela do próprio módulo (aep_relatorios / aet_relatorios)
// com `id_inspecao`, e as abas da inspeção usam os MESMOS editores do módulo.
// Enquanto `enviado_modulo_em` for NULL, o laudo só aparece na inspeção; o
// botão "Enviar para o módulo" o libera nas listas do AEP/AET. É o mesmo
// registro dos dois lados — editar em um reflete no outro na hora.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { setorVazioAep } from "@/lib/hooks/useAep";
import { setorVazio as setorVazioAet } from "@/lib/hooks/useAet";
import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";
import type { Cargo, Empresa, InspecaoMaquina, Setor } from "@/lib/supabase/types";

export type TipoErgo = "aep" | "aet";

export const ROTULO_ERGO: Record<TipoErgo, string> = { aep: "AEP", aet: "AET" };
export const NOME_ERGO: Record<TipoErgo, string> = {
  aep: "Análise Ergonômica Preliminar",
  aet: "Análise Ergonômica do Trabalho",
};

export interface LaudoErgoDaInspecao {
  id_relatorio: string;
  status: string;
  enviado_modulo_em: string | null;
  updated_at: string | null;
}

const tabela = (t: TipoErgo) => `${t}_relatorios` as const;

// As colunas da v259 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

export function useLaudoErgoDaInspecao(tipo: TipoErgo, idInspecao: string) {
  return useQuery({
    queryKey: ["ergo-inspecao", tipo, idInspecao],
    queryFn: async (): Promise<LaudoErgoDaInspecao | null> => {
      const { data, error } = await db()
        .from(tabela(tipo))
        .select("id_relatorio, status, enviado_modulo_em, updated_at")
        .eq("id_inspecao", idInspecao)
        .maybeSingle();
      if (error) throw error;
      return (data as LaudoErgoDaInspecao | null) ?? null;
    },
    enabled: !!idInspecao,
  });
}

/** Setores do laudo já preenchidos com o que a inspeção levantou. */
function setoresIniciais(
  tipo: TipoErgo,
  setores: Setor[],
  cargos: Cargo[],
  maquinas: InspecaoMaquina[]
) {
  return setores.map((s) => {
    const doSetor = cargos.filter((c) => c.id_setor === s.id_setor);
    if (tipo === "aep") {
      return {
        ...setorVazioAep(),
        nome_setor: s.setor_ghe,
        descricao_atividade: s.descricao ?? "",
        cargo: doSetor.map((c) => c.cargo).join(", "),
        cargos: doSetor.map((c) => ({
          id: crypto.randomUUID(),
          cargo: c.cargo,
          descricao: c.descricao ?? "",
          quantidade: 0,
        })),
      };
    }
    const maqs = maquinas
      .filter((m) => (m.ids_setores ?? []).includes(s.id_setor) || m.id_setor === s.id_setor)
      .map((m) => m.nome)
      .filter(Boolean);
    return {
      ...setorVazioAet(),
      nome_setor: s.setor_ghe,
      descricao_atividade: s.descricao ?? "",
      funcao: doSetor.map((c) => c.cargo).join(", "),
      maquinas_equipamentos: maqs.join(", "),
      cargos: doSetor.map((c) => ({ nome: c.cargo, descricao: c.descricao ?? "", quantidade: 0 })),
    };
  });
}

export function useIniciarLaudoErgo(tipo: TipoErgo) {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (args: {
      idInspecao: string;
      idEmpresa: string;
      empresa: Empresa | null | undefined;
      setores: Setor[];
      cargos: Cargo[];
      maquinas: InspecaoMaquina[];
    }) => {
      const sb = db();
      const { data: auth } = await sb.auth.getUser();
      const hoje = new Date().toISOString().slice(0, 10);
      const linha: Record<string, unknown> = {
        id_empresa: args.idEmpresa,
        id_inspecao: args.idInspecao,
        responsavel_elaboracao: user?.nome ?? "",
        titulo_profissional: user?.cargo ?? "",
        registro_profissional: user?.registro_mte ?? "",
        endereco_empresa: montarEnderecoEmpresa(args.empresa) || null,
        data_elaboracao: hoje,
        status: "RASCUNHO",
        setores: setoresIniciais(tipo, args.setores, args.cargos, args.maquinas),
        usuario: auth?.user?.id ?? null,
      };
      if (tipo === "aet") linha.consideracoes_finais = "";
      const { data, error } = await sb.from(tabela(tipo)).insert(linha).select("id_relatorio").single();
      if (error) {
        if (String(error.code) === "23505") {
          throw new Error(`Esta inspeção já tem uma ${ROTULO_ERGO[tipo]}. Recarregue a página.`);
        }
        throw error;
      }
      return data as { id_relatorio: string };
    },
    onSuccess: (_d, args) => {
      qc.invalidateQueries({ queryKey: ["ergo-inspecao", tipo, args.idInspecao] });
      toast.success(`${ROTULO_ERGO[tipo]} iniciada com os setores e cargos da inspeção`);
    },
    onError: (e: Error) => toast.error(e.message || `Falha ao iniciar a ${ROTULO_ERGO[tipo]}`),
  });
}

export function useEnviarLaudoErgoModulo(tipo: TipoErgo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { idRelatorio: string; idInspecao: string }) => {
      const { error } = await db()
        .from(tabela(tipo))
        .update({ enviado_modulo_em: new Date().toISOString() })
        .eq("id_relatorio", args.idRelatorio);
      if (error) throw error;
    },
    onSuccess: (_d, args) => {
      qc.invalidateQueries({ queryKey: ["ergo-inspecao", tipo, args.idInspecao] });
      qc.invalidateQueries({ queryKey: [`${tipo}-relatorios`] });
      qc.invalidateQueries({ queryKey: [`home-stats-${tipo}`] });
      toast.success(`${ROTULO_ERGO[tipo]} enviada — já está disponível no módulo ${ROTULO_ERGO[tipo]}`);
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao enviar para o módulo"),
  });
}
```

## E: `components/inspecoes/editor/tabs/ErgonomiaTab.tsx`

```tsx
"use client";

// Abas AEP e AET da inspeção (v259). O conteúdo é o editor do próprio módulo
// — mesmo laudo, mesmas telas — e o botão "Enviar para o módulo" o libera nas
// listas do AEP/AET. Ver `lib/hooks/useErgonomiaInspecao.ts`.

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Printer, Send, Sparkles } from "lucide-react";
import {
  NOME_ERGO,
  ROTULO_ERGO,
  useEnviarLaudoErgoModulo,
  useIniciarLaudoErgo,
  useLaudoErgoDaInspecao,
  type TipoErgo,
} from "@/lib/hooks/useErgonomiaInspecao";
import AepSetoresEditor from "@/components/aep/AepSetoresEditor";
import AepDadosEditor from "@/components/aep/AepDadosEditor";
import AetSetoresEditor from "@/components/aet/AetSetoresEditor";
import AetAnaliseEditor from "@/components/aet/AetAnaliseEditor";
import AetPsicossocialEditor from "@/components/aet/AetPsicossocialEditor";
import AetPlanoAcaoEditor from "@/components/aet/AetPlanoAcaoEditor";
import AetDadosEditor from "@/components/aet/AetDadosEditor";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { cn, fmtData } from "@/lib/utils";
import type { Cargo, Empresa, InspecaoMaquina, Setor } from "@/lib/supabase/types";

type Sub = { key: string; label: string; render: (id: string) => React.ReactNode };

const SUBABAS: Record<TipoErgo, Sub[]> = {
  aep: [
    { key: "setores", label: "Setores / Triagem", render: (id) => <AepSetoresEditor idRelatorio={id} /> },
    { key: "dados", label: "Dados / Conclusão", render: (id) => <AepDadosEditor idRelatorio={id} embutido /> },
  ],
  aet: [
    { key: "setores", label: "Setores", render: (id) => <AetSetoresEditor idRelatorio={id} /> },
    { key: "analise", label: "Análise", render: (id) => <AetAnaliseEditor idRelatorio={id} /> },
    { key: "psicossocial", label: "Psicossocial", render: (id) => <AetPsicossocialEditor idRelatorio={id} /> },
    { key: "plano", label: "Plano de Ação", render: (id) => <AetPlanoAcaoEditor idRelatorio={id} /> },
    { key: "dados", label: "Dados Gerais", render: (id) => <AetDadosEditor idRelatorio={id} /> },
  ],
};

interface Props {
  tipo: TipoErgo;
  idInspecao: string;
  idEmpresa: string;
  empresa: Empresa | null | undefined;
  setores: Setor[];
  cargos: Cargo[];
  maquinas: InspecaoMaquina[];
  readOnly: boolean;
}

export default function ErgonomiaTab({ tipo, idInspecao, idEmpresa, empresa, setores, cargos, maquinas, readOnly }: Props) {
  const { data: laudo, isLoading } = useLaudoErgoDaInspecao(tipo, idInspecao);
  const iniciar = useIniciarLaudoErgo(tipo);
  const enviar = useEnviarLaudoErgoModulo(tipo);
  const [sub, setSub] = useState(SUBABAS[tipo][0].key);
  const rotulo = ROTULO_ERGO[tipo];

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
  }

  if (!laudo) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <Sparkles className="mx-auto size-8 text-sky-500" />
        <h3 className="mt-3 text-base font-semibold text-gray-900">
          {NOME_ERGO[tipo]} ({rotulo})
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Preencha a {rotulo} completa aqui, durante a inspeção. Ela já começa com{" "}
          <strong>{setores.length} setor{setores.length !== 1 ? "es" : ""}</strong> e{" "}
          <strong>{cargos.length} cargo{cargos.length !== 1 ? "s" : ""}</strong> desta inspeção. Quando terminar,
          use &quot;Enviar para o módulo {rotulo}&quot; para ela aparecer no módulo.
        </p>
        {readOnly ? (
          <p className="mt-4 text-xs text-gray-400">Seu perfil não pode iniciar a {rotulo}.</p>
        ) : (
          <button
            type="button"
            disabled={iniciar.isPending}
            onClick={() => iniciar.mutate({ idInspecao, idEmpresa, empresa, setores, cargos, maquinas })}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {iniciar.isPending ? "Criando..." : `Iniciar ${rotulo} desta inspeção`}
          </button>
        )}
      </div>
    );
  }

  const enviado = !!laudo.enviado_modulo_em;
  const subAtual = SUBABAS[tipo].find((s) => s.key === sub) ?? SUBABAS[tipo][0];

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">{rotulo}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">
            {laudo.status === "CONCLUIDO" ? "Concluída" : "Rascunho"}
          </span>
          {enviado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="size-3.5" /> No módulo {rotulo} desde {fmtData(laudo.enviado_modulo_em)}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Só nesta inspeção
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${tipo}/${laudo.id_relatorio}/laudo`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="size-3.5" /> Laudo / Imprimir
          </Link>
          {enviado ? (
            <Link
              href={`/${tipo}/${laudo.id_relatorio}/setores`}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="size-3.5" /> Abrir no módulo {rotulo}
            </Link>
          ) : (
            !readOnly && (
              <button
                type="button"
                disabled={enviar.isPending}
                onClick={async () => {
                  const ok = await confirmar({
                    title: `Enviar para o módulo ${rotulo}?`,
                    description: `A ${rotulo} passa a aparecer na lista do módulo ${rotulo}. Continua sendo o mesmo laudo: o que for editado aqui ou lá vale para os dois.`,
                    confirmLabel: "Enviar",
                    variant: "primary",
                  });
                  if (ok) enviar.mutate({ idRelatorio: laudo.id_relatorio, idInspecao });
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              >
                <Send className="size-3.5" /> {enviar.isPending ? "Enviando..." : `Enviar para o módulo ${rotulo}`}
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {SUBABAS[tipo].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSub(s.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              subAtual.key === s.key
                ? "border-sky-500 text-sky-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div key={subAtual.key}>{subAtual.render(laudo.id_relatorio)}</div>
    </div>
  );
}
```

## F: diff de `app/(app)/inspecoes/[id]/page.tsx`

```diff
@@ -23,6 +23,8 @@ import {
   ClipboardEdit,
   Flame,
   Wrench,
+  PersonStanding,
+  Accessibility,
   RefreshCw,
 } from "lucide-react";
 import { useMutation, useQueryClient } from "@tanstack/react-query";
@@ -31,6 +33,7 @@ import { useInspecao, type InspecaoFull } from "@/lib/hooks/useInspecao";
 import { gravar } from "@/lib/offline/gravar";
 import { useEmpresa } from "@/lib/hooks/useEmpresas";
 import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
+import DocumentosEmpresaPainel from "@/components/empresas/DocumentosEmpresaPainel";
 import { useCanEdit, useCurrentUser, useIsSupervisor } from "@/lib/hooks/useUsuario";
 import StatusBadge from "@/components/inspecoes/StatusBadge";
 import { DetalheSkeleton } from "@/components/ui/PageSkeletons";
@@ -47,6 +50,8 @@ import PaeTab from "@/components/inspecoes/editor/tabs/PaeTab";
 import TreinamentosTab from "@/components/inspecoes/editor/tabs/TreinamentosTab";
 import ExtintoresTab from "@/components/inspecoes/editor/tabs/ExtintoresTab";
 import MaquinasTab from "@/components/inspecoes/editor/tabs/MaquinasTab";
+import ErgonomiaTab from "@/components/inspecoes/editor/tabs/ErgonomiaTab";
+import { useLaudoErgoDaInspecao } from "@/lib/hooks/useErgonomiaInspecao";
 import CopiarParaEmpresaModal from "@/components/inspecoes/editor/CopiarParaEmpresaModal";
 import { LevarParaCampo } from "@/components/ui/LevarParaCampo";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
@@ -69,6 +74,8 @@ const TAB_KEYS = [
   "treinamentos",
   "extintores",
   "maquinas",
+  "aep",
+  "aet",
   "complementos",
   "observacoes",
 ] as const;
@@ -91,6 +98,9 @@ export default function InspecaoEditorPage({ params }: Props) {
   const currentUser = useCurrentUser();
 
   const { data, isLoading, error } = useInspecao(id);
+  // v259: só para o número da aba (1 = já tem AEP/AET nesta inspeção).
+  const { data: aepDaInspecao } = useLaudoErgoDaInspecao("aep", id);
+  const { data: aetDaInspecao } = useLaudoErgoDaInspecao("aet", id);
   const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);
 
   // A aba ativa mora na URL (`?aba=riscos`), não em useState. Com useState,
@@ -295,7 +305,11 @@ export default function InspecaoEditorPage({ params }: Props) {
   // V2: usuários podem editar inspeções concluídas (spec exige).
   const readOnly = !canEdit;
 
-  const TABS: { key: TabKey; label: string; icon: typeof Layers; count: number }[] = [
+  // v259: as abas AEP/AET usam as tabelas dos módulos — só para quem tem o módulo.
+  const temModulo = (m: "aep" | "aet") =>
+    currentUser?.perfil === "Admin" || (currentUser?.modulos_permitidos ?? []).includes(m);
+
+  const TABS_TODAS: { key: TabKey; label: string; icon: typeof Layers; count: number }[] = [
     { key: "setores", label: "Setores", icon: Layers, count: setores.length },
     { key: "cargos", label: "Cargos", icon: Briefcase, count: cargos.length },
     { key: "riscos", label: "Riscos", icon: AlertTriangle, count: riscos.length },
@@ -306,9 +320,12 @@ export default function InspecaoEditorPage({ params }: Props) {
     { key: "treinamentos", label: "Treinamentos", icon: GraduationCap, count: treinamentos.length },
     { key: "extintores", label: "Extintores", icon: Flame, count: extintores.length },
     { key: "maquinas", label: "Máquinas", icon: Wrench, count: maquinas.length },
+    { key: "aep", label: "AEP", icon: PersonStanding, count: aepDaInspecao ? 1 : 0 },
+    { key: "aet", label: "AET", icon: Accessibility, count: aetDaInspecao ? 1 : 0 },
     { key: "complementos", label: "Complementos", icon: Sticker, count: complementos.length },
     { key: "observacoes", label: "Observações", icon: FileText, count: inspecao.observacoes ? 1 : 0 },
   ];
+  const TABS = TABS_TODAS.filter((t) => (t.key !== "aep" && t.key !== "aet") || temModulo(t.key));
 
   return (
     <div className="space-y-4">
@@ -476,6 +493,12 @@ export default function InspecaoEditorPage({ params }: Props) {
         className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
       />
 
+      {/* Situação do DRPS, QPS, AEP e AET da empresa — visível para todos. */}
+      <DocumentosEmpresaPainel
+        idEmpresa={inspecao.id_empresa}
+        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
+      />
+
       {/* Levar para o campo: acima das abas de propósito. A decisão de copiar a
           inspeção para o aparelho é tomada ANTES de sair da base, e não no meio
           do preenchimento de uma aba — se estivesse lá dentro, o técnico só
@@ -621,6 +644,19 @@ export default function InspecaoEditorPage({ params }: Props) {
               readOnly={readOnly}
             />
           )}
+          {(tab === "aep" || tab === "aet") && temModulo(tab) && (
+            <ErgonomiaTab
+              key={tab}
+              tipo={tab}
+              idInspecao={id}
+              idEmpresa={inspecao.id_empresa}
+              empresa={empresa}
+              setores={setores}
+              cargos={cargos}
+              maquinas={maquinas}
+              readOnly={readOnly}
+            />
+          )}
           {tab === "complementos" && (
             <ComplementosTab
               idInspecao={id}
```

## G: `components/empresas/DocumentosEmpresaPainel.tsx`

```tsx
"use client";

// Situação dos documentos da empresa (DRPS, Questionário, AEP e AET) — para os
// administradores saberem, de dentro da inspeção, o que já existe para a
// empresa e em que pé está. Só leitura: conta por status, sem abrir nada.

import { useQuery } from "@tanstack/react-query";
import { FileStack } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Fase = "andamento" | "concluido" | "enviado";

interface Doc {
  chave: string;
  rotulo: string;
  nome: string;
  tabela: string;
  /** AEP e AET não têm "enviado ao cliente" no quadro de status. */
  temEnvio: boolean;
}

const DOCS: Doc[] = [
  { chave: "drps", rotulo: "DRPS", nome: "Diagnóstico de Riscos Psicossociais", tabela: "drps_relatorios", temEnvio: true },
  { chave: "qps", rotulo: "QPS", nome: "Questionário Psicossocial", tabela: "qps_aplicacoes", temEnvio: true },
  { chave: "aep", rotulo: "AEP", nome: "Análise Ergonômica Preliminar", tabela: "aep_relatorios", temEnvio: false },
  { chave: "aet", rotulo: "AET", nome: "Análise Ergonômica do Trabalho", tabela: "aet_relatorios", temEnvio: false },
];

const FASE: Record<Fase, { rotulo: string; cls: string }> = {
  andamento: { rotulo: "Em andamento", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  concluido: { rotulo: "Concluído", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  enviado: { rotulo: "Enviado ao cliente", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
};

function faseDe(status: string | null): Fase | null {
  switch (status) {
    case "RASCUNHO":
    case "EM_ANDAMENTO":
      return "andamento";
    case "CONCLUIDO":
      return "concluido";
    case "ENVIADO_CLIENTE":
      return "enviado";
    default:
      return null; // DELETADO e afins não contam
  }
}

type Contagem = Record<Fase, number>;

// drps_*, qps_*, aep_* e aet_* não estão (todas) no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

function useDocumentosEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["documentos-empresa", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, Contagem>> => {
      const resultados = await Promise.all(
        DOCS.map((d) => db().from(d.tabela).select("status").eq("id_empresa", idEmpresa))
      );
      const out: Record<string, Contagem> = {};
      DOCS.forEach((d, i) => {
        const { data, error } = resultados[i];
        if (error) throw error;
        const c: Contagem = { andamento: 0, concluido: 0, enviado: 0 };
        for (const r of (data ?? []) as { status: string | null }[]) {
          const f = faseDe(r.status);
          if (f) c[f]++;
        }
        out[d.chave] = c;
      });
      return out;
    },
  });
}

export default function DocumentosEmpresaPainel({
  idEmpresa,
  className,
}: {
  idEmpresa: string | null | undefined;
  className?: string;
}) {
  const { data, isLoading, error } = useDocumentosEmpresa(idEmpresa);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <FileStack className="size-4 text-sky-600" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-600">Documentos da empresa</h2>
      </div>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
      ) : error ? (
        <p className="text-sm text-red-600">Não foi possível carregar os documentos da empresa.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DOCS.map((d) => {
            const c = data?.[d.chave] ?? { andamento: 0, concluido: 0, enviado: 0 };
            const fases: Fase[] = d.temEnvio ? ["andamento", "concluido", "enviado"] : ["andamento", "concluido"];
            const total = fases.reduce((n, f) => n + c[f], 0);
            return (
              <div key={d.chave} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900">{d.rotulo}</span>
                  <span className="truncate text-[11px] text-gray-500" title={d.nome}>{d.nome}</span>
                </div>
                {total === 0 ? (
                  <p className="mt-2 text-xs text-gray-400">Nenhum para esta empresa</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {fases
                      .filter((f) => c[f] > 0)
                      .map((f) => (
                        <span
                          key={f}
                          className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", FASE[f].cls)}
                        >
                          {FASE[f].rotulo}: {c[f]}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```


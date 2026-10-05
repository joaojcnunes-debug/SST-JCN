# Replicar no Painel SST: registrar a AEP numa inspeção ao criar

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-registrar-em-inspecao.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `5801ced` de 2026-10-05, já em produção lá.
> **Não mexe no schema do banco.** Usa colunas que já existem.

## O que faz

Na tela **Nova Análise AEP** (`/aep/novo`), depois de escolher a empresa,
aparece o campo **Registrar em inspeção** com 3 opções:

| Opção | O que acontece |
|---|---|
| **Não vincular** | Como antes: a AEP fica só no módulo. |
| **Inspeção realizada** | Lista as inspeções da empresa, menos as deletadas, com número, revisão, data e situação. A AEP é gravada com o `id_inspecao` escolhido e já nasce com os **setores e cargos** daquela inspeção. Inspeções que já têm AEP aparecem como "já tem AEP" e não podem ser escolhidas, porque uma inspeção só tem uma AEP. |
| **Criar nova inspeção** | Cria na hora uma inspeção em branco (`tipo_criacao = BRANCO`, status `EM_ANDAMENTO`, próxima revisão da empresa, data = data de elaboração, observação "Criada a partir do módulo AEP") e grava a AEP nela. |

Com vínculo, a AEP já nasce com `enviado_modulo_em` preenchido: como foi criada
pelo módulo, ela aparece nas listas do módulo AEP e também na **aba AEP da
inspeção**. É o mesmo registro nos dois lados.

A regra fica no hook novo `useCriarAepNoModulo`, em
`lib/hooks/useErgonomiaInspecao.ts`, que reaproveita `setoresIniciais` (o mesmo
pré-preenchimento do botão "Iniciar AEP desta inspeção"). O `useCriarAep` antigo
fica sem uso na tela, mas não foi removido.

## Passo 1: conferir o painel

Este MD depende das **abas AEP/AET na inspeção**, que vieram no MD
`replicar-no-painel-aep-aet-e-documentos.md`. Se o painel ainda não tiver essa
parte, aplique aquele MD antes.

| Usado pelo código | Conferir no painel |
|---|---|
| Colunas `aep_relatorios.id_inspecao` e `aep_relatorios.enviado_modulo_em`, com índice único em `id_inspecao` | vêm da migration das abas AEP/AET (v259 no JCN) |
| `lib/hooks/useErgonomiaInspecao.ts` com `setoresIniciais`, `db()`, `tabela()` e `useLaudoErgoDaInspecao` | idem |
| Filtro do módulo `FILTRO_VISIVEL_NO_MODULO` (`id_inspecao.is.null,enviado_modulo_em.not.is.null`) em `lib/hooks/useAep.ts` | idem |
| `useInspecoesByEmpresa` em `lib/hooks/useInspecao.ts`; `gerarId`, `cn` e `fmtData` em `lib/utils.ts` | mesmos nomes |
| Tabela `inspecoes` com `id_inspecao, id_empresa, data_inspecao, status, revisao, responsavel, observacoes, tipo_criacao, id_inspecao_base, usuario, created_at, updated_at`, e o status `DELETADA` | mesmas colunas; compare com o insert da tela Nova Inspeção do painel |
| Tabelas `setores` e `cargos` com `id_inspecao` | mesmos nomes |

## Passo 2: código

| Arquivo | O quê | Seção |
|---|---|---|
| `lib/hooks/useErgonomiaInspecao.ts` | `useCriarAepNoModulo`, `useInspecoesComAep` e o tipo `VinculoInspecao` | A |
| `app/(aep)/aep/novo/page.tsx` | campo **Registrar em inspeção** e troca do hook de criação | B |

### A: diff de `lib/hooks/useErgonomiaInspecao.ts`

```diff
@@ -15,6 +15,7 @@ import { useUserStore } from "@/lib/store";
 import { setorVazioAep } from "@/lib/hooks/useAep";
 import { setorVazio as setorVazioAet } from "@/lib/hooks/useAet";
 import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";
+import { gerarId } from "@/lib/utils";
 import type { Cargo, Empresa, InspecaoMaquina, Setor } from "@/lib/supabase/types";
 
 export type TipoErgo = "aep" | "aet";
@@ -137,6 +138,126 @@ export function useIniciarLaudoErgo(tipo: TipoErgo) {
   });
 }
 
+export type VinculoInspecao = "nenhum" | "existente" | "nova";
+
+/**
+ * Nova AEP criada pelo MÓDULO (2026-10-05), opcionalmente registrada numa
+ * inspeção: uma já realizada (a AEP nasce com os setores e cargos dela) ou uma
+ * inspeção nova em branco criada na hora para a empresa. Como foi criada no
+ * próprio módulo, já nasce com `enviado_modulo_em` — aparece nas listas do
+ * módulo e também na aba AEP da inspeção. Uma inspeção só tem uma AEP.
+ */
+export function useCriarAepNoModulo() {
+  const qc = useQueryClient();
+  const user = useUserStore((s) => s.user);
+  return useMutation({
+    mutationFn: async (args: {
+      id_empresa: string;
+      responsavel_elaboracao: string;
+      titulo_profissional: string;
+      registro_profissional: string;
+      endereco_empresa: string | null;
+      data_elaboracao: string | null;
+      vinculo: VinculoInspecao;
+      /** Obrigatório quando `vinculo === "existente"`. */
+      id_inspecao?: string | null;
+      /** Próxima revisão da empresa, para a inspeção nova. */
+      revisao_nova?: number;
+    }) => {
+      const sb = db();
+      const agora = new Date().toISOString();
+      let idInspecao: string | null = null;
+      let setores: unknown[] = [];
+
+      if (args.vinculo === "existente") {
+        if (!args.id_inspecao) throw new Error("Selecione a inspeção.");
+        idInspecao = args.id_inspecao;
+        const [s, c] = await Promise.all([
+          sb.from("setores").select("*").eq("id_inspecao", idInspecao).order("setor_ghe"),
+          sb.from("cargos").select("*").eq("id_inspecao", idInspecao).order("cargo"),
+        ]);
+        if (s.error) throw s.error;
+        if (c.error) throw c.error;
+        setores = setoresIniciais("aep", (s.data ?? []) as Setor[], (c.data ?? []) as Cargo[], []);
+      } else if (args.vinculo === "nova") {
+        idInspecao = gerarId("INS");
+        const { error } = await sb.from("inspecoes").insert({
+          id_inspecao: idInspecao,
+          id_empresa: args.id_empresa,
+          data_inspecao: args.data_elaboracao ?? agora.slice(0, 10),
+          status: "EM_ANDAMENTO",
+          revisao: args.revisao_nova ?? 1,
+          responsavel: user?.nome ?? null,
+          observacoes: "Criada a partir do módulo AEP.",
+          tipo_criacao: "BRANCO",
+          id_inspecao_base: null,
+          usuario: user?.email ?? null,
+          created_at: agora,
+          updated_at: agora,
+        });
+        if (error) throw error;
+      }
+
+      const { data: auth } = await sb.auth.getUser();
+      const linha: Record<string, unknown> = {
+        id_empresa: args.id_empresa,
+        responsavel_elaboracao: args.responsavel_elaboracao,
+        titulo_profissional: args.titulo_profissional,
+        registro_profissional: args.registro_profissional,
+        endereco_empresa: args.endereco_empresa,
+        data_elaboracao: args.data_elaboracao,
+        usuario: auth?.user?.id ?? null,
+      };
+      if (idInspecao) {
+        linha.id_inspecao = idInspecao;
+        linha.enviado_modulo_em = agora;
+        linha.status = "RASCUNHO";
+        linha.setores = setores;
+      }
+      const { data, error } = await sb.from("aep_relatorios").insert(linha).select("id_relatorio").single();
+      if (error) {
+        if (String(error.code) === "23505") throw new Error("Esta inspeção já tem uma AEP. Escolha outra inspeção.");
+        if (args.vinculo === "nova") {
+          throw new Error(`A inspeção ${idInspecao} foi criada, mas a AEP não: ${error.message}`);
+        }
+        throw error;
+      }
+      return { id_relatorio: (data as { id_relatorio: string }).id_relatorio, id_inspecao: idInspecao };
+    },
+    onSuccess: (r, args) => {
+      qc.invalidateQueries({ queryKey: ["aep-relatorios"] });
+      qc.invalidateQueries({ queryKey: ["inspecoes", args.id_empresa] });
+      qc.invalidateQueries({ queryKey: ["aeps-com-inspecao", args.id_empresa] });
+      if (r.id_inspecao) qc.invalidateQueries({ queryKey: ["ergo-inspecao", "aep", r.id_inspecao] });
+      toast.success(
+        args.vinculo === "nova"
+          ? `AEP criada e registrada na nova inspeção ${r.id_inspecao}`
+          : args.vinculo === "existente"
+            ? `AEP criada na inspeção ${r.id_inspecao}, com os setores e cargos dela`
+            : "AEP criada com sucesso!"
+      );
+    },
+    onError: (e: Error) => toast.error(e.message || "Falha ao criar a AEP"),
+  });
+}
+
+/** Inspeções da empresa que já têm AEP (uma inspeção só pode ter uma). */
+export function useInspecoesComAep(idEmpresa: string | null) {
+  return useQuery({
+    queryKey: ["aeps-com-inspecao", idEmpresa],
+    enabled: !!idEmpresa,
+    queryFn: async (): Promise<Set<string>> => {
+      const { data, error } = await db()
+        .from("aep_relatorios")
+        .select("id_inspecao")
+        .eq("id_empresa", idEmpresa)
+        .not("id_inspecao", "is", null);
+      if (error) throw error;
+      return new Set(((data ?? []) as { id_inspecao: string }[]).map((r) => r.id_inspecao));
+    },
+  });
+}
+
 export function useEnviarLaudoErgoModulo(tipo: TipoErgo) {
   const qc = useQueryClient();
   return useMutation({
```

### B: diff de `app/(aep)/aep/novo/page.tsx`

```diff
@@ -1,9 +1,15 @@
 "use client";
 
-import { useEffect, useRef, useState } from "react";
+import { useEffect, useMemo, useRef, useState } from "react";
 import { useRouter } from "next/navigation";
 import { ArrowLeft, Save } from "lucide-react";
-import { useCriarAep } from "@/lib/hooks/useAep";
+import {
+  useCriarAepNoModulo,
+  useInspecoesComAep,
+  type VinculoInspecao,
+} from "@/lib/hooks/useErgonomiaInspecao";
+import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
+import { cn, fmtData } from "@/lib/utils";
 import EmpresaSelect from "@/components/empresas/EmpresaSelect";
 import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
 import { useEmpresa } from "@/lib/hooks/useEmpresas";
@@ -11,7 +17,7 @@ import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";
 
 export default function AepNovoPage() {
   const router = useRouter();
-  const criar = useCriarAep();
+  const criar = useCriarAepNoModulo();
 
   const [empresaId, setEmpresaId] = useState<string | null>(null);
   const { data: empresa } = useEmpresa(empresaId);
@@ -21,6 +27,18 @@ export default function AepNovoPage() {
   const [registro, setRegistro] = useState("");
   const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
 
+  // Onde a AEP fica registrada (2026-10-05): solta no módulo, numa inspeção
+  // já realizada ou numa inspeção nova criada agora.
+  const [vinculo, setVinculo] = useState<VinculoInspecao>("nenhum");
+  const [idInspecao, setIdInspecao] = useState("");
+  const { data: inspecoes = [] } = useInspecoesByEmpresa(empresaId);
+  const { data: comAep } = useInspecoesComAep(empresaId);
+  const inspecoesAtivas = useMemo(() => inspecoes.filter((i) => i.status !== "DELETADA"), [inspecoes]);
+  const proximaRevisao = useMemo(
+    () => Math.max(0, ...inspecoes.map((i) => i.revisao ?? 0)) + 1,
+    [inspecoes],
+  );
+
   // O endereço mora no cadastro da empresa em campos separados (logradouro,
   // número, bairro, município, UF, CEP). A caixa aqui é uma linha só, então
   // monta com o MESMO formatador que o PDF e a AET usam — senão o laudo sairia
@@ -40,12 +58,17 @@ export default function AepNovoPage() {
   function handleEmpresaChange(id: string | null) {
     enderecoEditado.current = false;
     setEmpresaId(id);
+    setIdInspecao("");
   }
 
   async function handleSubmit(e: React.FormEvent) {
     e.preventDefault();
     if (!empresaId || !responsavel.trim()) return;
+    if (vinculo === "existente" && !idInspecao) return;
     const result = await criar.mutateAsync({
+      vinculo,
+      id_inspecao: vinculo === "existente" ? idInspecao : null,
+      revisao_nova: proximaRevisao,
       id_empresa: empresaId,
       responsavel_elaboracao: responsavel.trim(),
       titulo_profissional: titulo.trim(),
@@ -154,9 +177,78 @@ export default function AepNovoPage() {
           />
         </div>
 
+        {empresaId && (
+          <div>
+            <label className="mb-1 block text-sm font-medium text-gray-700">Registrar em inspeção</label>
+            <div className="grid gap-2 sm:grid-cols-3">
+              {(
+                [
+                  ["nenhum", "Não vincular", "AEP só no módulo"],
+                  ["existente", "Inspeção realizada", "Usa os setores e cargos dela"],
+                  ["nova", "Criar nova inspeção", `Inspeção em branco, Rev. ${proximaRevisao}`],
+                ] as [VinculoInspecao, string, string][]
+              ).map(([v, rotulo, dica]) => (
+                <button
+                  key={v}
+                  type="button"
+                  onClick={() => setVinculo(v)}
+                  className={cn(
+                    "rounded-lg border px-3 py-2 text-left text-sm",
+                    vinculo === v
+                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500"
+                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
+                  )}
+                >
+                  <div className="font-medium">{rotulo}</div>
+                  <div className="text-[11px] text-gray-500">{dica}</div>
+                </button>
+              ))}
+            </div>
+
+            {vinculo === "existente" && (
+              <div className="mt-2">
+                {inspecoesAtivas.length === 0 ? (
+                  <p className="text-[11px] text-amber-700">
+                    Esta empresa não tem inspeção. Escolha &quot;Criar nova inspeção&quot;.
+                  </p>
+                ) : (
+                  <select
+                    value={idInspecao}
+                    onChange={(e) => setIdInspecao(e.target.value)}
+                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
+                  >
+                    <option value="">Selecione a inspeção...</option>
+                    {inspecoesAtivas.map((i) => {
+                      const temAep = comAep?.has(i.id_inspecao) ?? false;
+                      return (
+                        <option key={i.id_inspecao} value={i.id_inspecao} disabled={temAep}>
+                          {i.id_inspecao} · Rev. {i.revisao ?? 0} · {fmtData(i.data_inspecao)}
+                          {i.status === "CONCLUIDA" ? " · Concluída" : i.status === "RASCUNHO" ? " · Rascunho" : " · Em andamento"}
+                          {temAep ? " · já tem AEP" : ""}
+                        </option>
+                      );
+                    })}
+                  </select>
+                )}
+                <p className="mt-1 text-[11px] text-gray-500">
+                  A AEP fica na aba AEP da inspeção e já começa com os setores e cargos dela. Uma inspeção só tem uma AEP.
+                </p>
+              </div>
+            )}
+            {vinculo === "nova" && (
+              <p className="mt-2 text-[11px] text-gray-500">
+                Será criada a inspeção em branco Rev. {proximaRevisao} desta empresa, com a data de elaboração acima, e
+                a AEP fica registrada nela (aba AEP).
+              </p>
+            )}
+          </div>
+        )}
+
         <button
           type="submit"
-          disabled={!empresaId || !responsavel.trim() || criar.isPending}
+          disabled={
+            !empresaId || !responsavel.trim() || (vinculo === "existente" && !idInspecao) || criar.isPending
+          }
           className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
         >
           <Save className="size-4" />
```

## Passo 3: verificar

1. Rode `npx tsc --noEmit -p .`, `npx eslint` nos dois arquivos e `npx next build`; todos devem terminar sem erros.
2. **Não vincular:** a AEP é criada como antes e aparece só no módulo.
3. **Inspeção realizada:**
   - a AEP abre já com os setores e cargos da inspeção;
   - na inspeção, a aba AEP mostra essa AEP como "No módulo desde…";
   - a mesma inspeção passa a aparecer como "já tem AEP" na lista.
4. **Criar nova inspeção:** a inspeção em branco aparece em Inspeções com a
   próxima revisão, e a AEP aparece na aba AEP dela.
5. Empresa sem inspeção: a opção "Inspeção realizada" avisa para usar "Criar nova inspeção".
6. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

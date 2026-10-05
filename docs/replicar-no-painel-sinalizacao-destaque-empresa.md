# Replicar no Painel SST: destaque no cabeçalho da AEP e no resumo do setor (Sinalização)

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-sinalizacao-destaque-empresa.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `764b56c` de 2026-10-05, já em produção lá.
> **Não mexe no banco.** Só um arquivo muda.

## Pré-requisito

Aplique antes o MD `replicar-no-painel-sinalizacao-filtros-e-status-aep.md`.
Este MD usa os campos `precisaAet`, `precisaQuestionario`, `enviadoPor` e
`idInspecao` da avaliação, e o `piorNivel`, que vêm de lá.

## O que faz

Na página da empresa da Sinalização Psicossocial
(`/sinalizacao-psicossocial/[idEmpresa]` e `/aep-psicossocial/[idEmpresa]`):

1. **Cabeçalho de cada AEP em destaque:**
   - cartão com fundo âmbar claro, título maior e o selo do **maior nível AIHA** da AEP;
   - 6 blocos: **Entregue ao cliente** · **Inspeção** · **Realizada por** ·
     **Enviada por** · **DRPS/Questionário** · **AET**;
   - DRPS/Questionário e AET ficam em **âmbar forte** quando são necessários, e cinza com "Não" quando não são.
2. **Resumo de cada setor:**
   - o antigo "6 fatores · Alto" vira um quadro com o **número de fatores** grande e o **maior nível** ao lado;
   - o quadro inteiro ganha a cor do nível (`COR_NIVEL_AIHA`).

## Código: diff de `components/aep/SinalizacaoEmpresaDetalhe.tsx`

Dois componentes novos no topo do arquivo (`estiloNivel` e `BlocoAep`) e a
troca dos dois trechos de JSX.

```diff
@@ -13,11 +13,28 @@ import { useQuery } from "@tanstack/react-query";
 import { ArrowLeft, Building2, Layers } from "lucide-react";
 import { useAepsEntregues } from "@/lib/hooks/useAep";
 import { useUnidades } from "@/lib/hooks/useUnidades";
-import { montarSinalizacao } from "@/lib/aep/sinalizacao";
+import { montarSinalizacao, piorNivel } from "@/lib/aep/sinalizacao";
+import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
 import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
-import { fmtData, formatCNPJ } from "@/lib/utils";
+import { cn, fmtData, formatCNPJ } from "@/lib/utils";
+
+/** Cores do nível AIHA para o resumo do setor. */
+function estiloNivel(nivel: string | null) {
+  const c = nivel ? COR_NIVEL_AIHA[nivel as keyof typeof COR_NIVEL_AIHA] : undefined;
+  return c ? { backgroundColor: c.bg, color: c.cor, borderColor: c.borda } : { backgroundColor: "#f9fafb", color: "#4b5563", borderColor: "#e5e7eb" };
+}
+
+/** Bloco do cabeçalho da AEP; `alerta` pinta de âmbar o que é necessário. */
+function BlocoAep({ rotulo, alerta = false, children }: { rotulo: string; alerta?: boolean; children: React.ReactNode }) {
+  return (
+    <div className={cn("min-w-0 rounded-lg border px-3 py-2", alerta ? "border-amber-300 bg-amber-100" : "border-gray-100 bg-white")}>
+      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{rotulo}</div>
+      <div className={cn("mt-0.5 truncate text-sm font-semibold", alerta ? "text-amber-900" : "text-gray-900")}>{children}</div>
+    </div>
+  );
+}
 
 const STATUS_ROTULO: Record<string, string> = { RASCUNHO: "Rascunho", EM_ANDAMENTO: "Em andamento", CONCLUIDO: "Concluída" };
 
@@ -136,25 +153,29 @@ export default function SinalizacaoEmpresaDetalhe({
       ) : (
         sinal.avaliacoes.map((a) => (
           <section key={a.idRelatorio} className="space-y-3">
-            <div className="flex flex-wrap items-center gap-2">
-              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">AEP</span>
-              <h2 className="text-base font-semibold text-gray-900">Análise Ergonômica Preliminar</h2>
-              <span className="text-xs text-gray-500">
-                {a.data ? `Entregue ao cliente em ${fmtData(a.data)}` : STATUS_ROTULO[a.status] ?? a.status}
-                {a.idInspecao ? ` · ${a.idInspecao}` : " · sem inspeção"}
-                {a.responsavel ? ` · Realizada por ${a.responsavel}` : ""}
-                {a.enviadoPor ? ` · Enviada por ${a.enviadoPor}` : ""}
-              </span>
-              {a.precisaQuestionario && (
-                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
-                  DRPS/Questionário necessário
-                </span>
-              )}
-              {a.precisaAet && (
-                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
-                  AET necessária
-                </span>
-              )}
+            {/* Cabeçalho da AEP em destaque: entrega, quem fez/enviou e o que é necessário */}
+            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm">
+              <div className="flex flex-wrap items-center gap-2">
+                <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">AEP</span>
+                <h2 className="text-lg font-bold text-gray-900">Análise Ergonômica Preliminar</h2>
+                <SeloNivelAiha nivel={piorNivel(a.setores.map((s) => s.pior))} className="text-xs" />
+              </div>
+              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
+                <BlocoAep rotulo="Entregue ao cliente">
+                  {a.data ? fmtData(a.data) : STATUS_ROTULO[a.status] ?? a.status}
+                </BlocoAep>
+                <BlocoAep rotulo="Inspeção">{a.idInspecao ?? <span className="font-normal text-gray-500">Sem inspeção</span>}</BlocoAep>
+                <BlocoAep rotulo="Realizada por">{a.responsavel ?? "—"}</BlocoAep>
+                <BlocoAep rotulo="Enviada por">
+                  {a.idInspecao ? (a.enviadoPor ?? "—") : <span className="font-normal text-gray-500">Sem inspeção</span>}
+                </BlocoAep>
+                <BlocoAep rotulo="DRPS/Questionário" alerta={a.precisaQuestionario}>
+                  {a.precisaQuestionario ? "Necessário" : <span className="font-normal text-gray-500">Não</span>}
+                </BlocoAep>
+                <BlocoAep rotulo="AET" alerta={a.precisaAet}>
+                  {a.precisaAet ? "Necessária" : <span className="font-normal text-gray-500">Não</span>}
+                </BlocoAep>
+              </div>
             </div>
 
             <div className="space-y-4">
@@ -164,9 +185,22 @@ export default function SinalizacaoEmpresaDetalhe({
                     <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                       <Layers className="size-4 text-verde-primary" /> {s.nome}
                     </h3>
-                    <span className="inline-flex items-center gap-2 text-xs text-gray-500">
-                      {s.fatores.length} fator{s.fatores.length !== 1 ? "es" : ""}
-                      <SeloNivelAiha nivel={s.pior} />
+                    <span
+                      className="inline-flex items-center gap-3 rounded-xl border px-3 py-1.5"
+                      style={estiloNivel(s.pior)}
+                      title="Fatores organizacionais marcados neste setor e o maior nível AIHA entre eles"
+                    >
+                      <span className="text-center leading-tight">
+                        <span className="block text-lg font-bold">{s.fatores.length}</span>
+                        <span className="block text-[10px] font-semibold uppercase tracking-wide">
+                          fator{s.fatores.length !== 1 ? "es" : ""}
+                        </span>
+                      </span>
+                      <span className="h-8 w-px bg-current opacity-20" />
+                      <span className="text-center leading-tight">
+                        <span className="block text-sm font-bold">{s.pior ?? "—"}</span>
+                        <span className="block text-[10px] font-semibold uppercase tracking-wide">maior nível</span>
+                      </span>
                     </span>
                   </div>
                   <div className="overflow-x-auto">
```

## Verificar

1. Rode `npx tsc --noEmit -p .` e `npx next build`; os dois devem terminar sem erros.
2. Abra a página de uma empresa na Sinalização:
   - o cabeçalho de cada AEP aparece em cartão, com os 6 blocos;
   - "Necessário/Necessária" aparece em âmbar e "Não" em cinza;
   - AEP sem inspeção mostra "Sem inspeção" em Inspeção e em Enviada por.
3. O resumo de cada setor fica colorido pelo nível (Alto vermelho, Moderado âmbar…).
4. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

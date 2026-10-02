# Replicar no Painel SST: Documentos da empresa no relatório da inspeção

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-relatorio-documentos-empresa.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `febb844` de 2026-10-02, já em produção lá.
> **Não mexe no banco.** Só uma página muda.

## O que faz

Na página **Relatório de Inspeção** (`/inspecoes/[id]/relatorio`), o card
**Resumo Geral** ganha no fim, abaixo dos números (Setores · Cargos · Riscos ·
Não Conformes) e de "Por nível" / "Por categoria", o quadro **Documentos da
empresa**: DRPS, QPS, AEP e AET da empresa da inspeção, com a contagem por
status (Em andamento / Concluído / Enviado ao cliente).

É o mesmo componente que já aparece na página da inspeção
(`components/empresas/DocumentosEmpresaPainel.tsx`). No relatório ele entra
sem borda própria, separado por uma linha do resto do resumo. Como o PDF do
relatório é uma captura da página (`BotaoGerarPdf`), o quadro vai junto para o PDF.

## Passo 1: conferir o painel

| Conferir | Se não tiver |
|---|---|
| `components/empresas/DocumentosEmpresaPainel.tsx` existe (veio no MD `replicar-no-painel-aep-aet-e-documentos.md`) | crie com o código da seção B |
| As tabelas `drps_relatorios`, `qps_aplicacoes`, `aep_relatorios` e `aet_relatorios` têm `id_empresa` e `status` | ajuste `DOCS` no componente para os nomes do painel |
| O relatório está em `app/(app)/inspecoes/[id]/relatorio/page.tsx`, com o card "Resumo Geral" e `inspecao.id_empresa` | aplique a mudança onde o card estiver |

## Passo 2: código

### A: diff de `app/(app)/inspecoes/[id]/relatorio/page.tsx`

Duas mudanças: o import ao lado do `EmpresaInfoPanel` e o componente no fim
do card Resumo Geral, logo depois do bloco "Por categoria".

```diff
@@ -37,6 +37,7 @@ import { situacaoDocumento } from "@/lib/inspecoes/documento";
 import { FileSignature } from "lucide-react";
 import { useEmpresa } from "@/lib/hooks/useEmpresas";
 import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
+import DocumentosEmpresaPainel from "@/components/empresas/DocumentosEmpresaPainel";
 import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
 import NivelBadge from "@/components/riscos/NivelBadge";
@@ -744,6 +745,13 @@ export default function RelatorioChabraPage({ params }: Props) {
                 </div>
               </>
             )}
+
+            {/* Situação do DRPS, QPS, AEP e AET da empresa — o mesmo quadro da
+                página da inspeção. */}
+            <DocumentosEmpresaPainel
+              idEmpresa={inspecao.id_empresa}
+              className="mt-4 border-t border-gray-100 pt-4"
+            />
           </div>
         </section>
 
```

### B: `components/empresas/DocumentosEmpresaPainel.tsx` (só se não existir no painel)

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

## Passo 3: verificar

1. Rode `npx tsc --noEmit -p .` e `npx next build`; os dois devem terminar sem erros.
2. Abra o relatório de uma inspeção cuja empresa tenha DRPS/QPS/AEP/AET. O
   quadro aparece no fim do Resumo Geral, com as mesmas contagens da página
   da inspeção.
3. Numa empresa sem nenhum desses documentos, cada card mostra "Nenhum para
   esta empresa".
4. Gere o PDF do relatório e confira que o quadro sai nele.
5. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

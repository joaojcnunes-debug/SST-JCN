"use client";

// Liberação para o Comercial (2026-10-05, v270). O que a inspeção e a AEP
// indicam só vira oportunidade no Comercial depois que a equipe valida:
//   • "Enviar para o Comercial"   → grava liberado_comercial_em/_por;
//   • "Retirar do Comercial"      → limpa (para ajustar algo e enviar de novo).
// Desde a v321 (0.3.233) o envio põe os serviços na fila de Comercial › Liberar
// serviços; o vendedor só vê o que for liberado lá.
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
      toast.success(liberar ? "Enviado para a fila do Comercial" : "Retirado do Comercial");
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
          title="Os serviços que este documento indica estão em Comercial › Liberar serviços"
        >
          <Handshake className="size-3.5" />
          Enviado ao Comercial em {fmtData(liberadoEm)}
          {liberadoPor ? ` · ${liberadoPor}` : ""}
        </span>
        {podeEditar && (
          <button
            type="button"
            disabled={mut.isPending}
            onClick={async () => {
              const ok = await confirmar({
                title: "Retirar do Comercial?",
                description: `Os serviços desta ${nome} saem da fila e do time comercial até ela ser enviada de novo.`,
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
            title: "Enviar para o Comercial?",
            description: `Os serviços que esta ${nome} indica vão para a fila de Comercial › Liberar serviços. O vendedor só vê o que for liberado lá. Confira o preenchimento antes.`,
            confirmLabel: "Enviar",
            variant: "primary",
          });
          if (ok) mut.mutate(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        title="Mandar os serviços desta análise para a fila de liberação do Comercial"
      >
        {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />}
        Enviar para o Comercial
      </button>
    </>
  );
}

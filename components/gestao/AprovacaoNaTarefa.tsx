"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, ShieldQuestion, X } from "lucide-react";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import { useAprovacoesPendentes, useDecidirAprovacao } from "@/lib/hooks/useGestao";

/**
 * Aprovação pendente dentro da janela da tarefa (10/11/2026). Antes só existia na Caixa de entrada e só para a
 * aprovadora escolhida na automação. Aparece para quem o banco deixa decidir (gestao_decidir_aprovacao): a
 * aprovadora designada, ou quem edita o quadro (supervisora/admin da Gestão). O banco confere de novo.
 * Depois de decidir, a janela fecha: a automação muda o cartão de coluna e a janela aberta ficaria com o status
 * antigo (um "Salvar" depois o desfaria).
 */
export default function AprovacaoNaTarefa({
  idTarefa,
  podeEditarQuadro,
  onDecidido,
}: {
  idTarefa: string;
  podeEditarQuadro: boolean;
  onDecidido: () => void;
}) {
  const meuEmail = (useUserStore((s) => s.user?.email ?? null) ?? "").toLowerCase();
  const { data: aprovacoes = [] } = useAprovacoesPendentes();
  const decidir = useDecidirAprovacao();
  const [motivo, setMotivo] = useState("");

  const pendente = aprovacoes.find((a) => a.id_tarefa === idTarefa);
  if (!pendente) return null;
  const designada = (pendente.aprovador_email ?? "").toLowerCase();
  const podeDecidir = podeEditarQuadro || (!!designada && designada === meuEmail);
  const ocupado = decidir.isPending;

  const decide = (decisao: "aprovada" | "rejeitada") =>
    decidir.mutate(
      { id: pendente.id, decisao, motivo: motivo.trim() || null },
      {
        onSuccess: () => {
          toast.success(decisao === "aprovada" ? "Tarefa aprovada." : "Aprovação recusada.");
          onDecidido();
        },
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
        <ShieldQuestion className="size-4 shrink-0 text-amber-600" />
        Aguardando aprovação{designada ? ` de ${pendente.aprovador_email}` : ""}
      </div>
      {podeDecidir ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            disabled={ocupado}
            aria-label="Motivo da decisão"
            className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-marca-primary focus:outline-none"
          />
          <button
            type="button"
            disabled={ocupado}
            onClick={() => decide("aprovada")}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Aprovar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => decide("rejeitada")}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <X className="size-3.5" /> Recusar
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-amber-700">Só a aprovadora ou quem edita este quadro pode decidir.</p>
      )}
    </div>
  );
}

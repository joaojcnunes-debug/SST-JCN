"use client";

import { Zap } from "lucide-react";
import { useAutomacoes, useExecutarAutomacaoManual } from "@/lib/hooks/useGestao";

// v300 (Pacote C): as automações com gatilho "manual" (ativas) do quadro viram um menu ⚡ — na tarefa
// e nas ações em massa. O banco confere quem pode editar cada tarefa (gestao_automacao_executar_manual).

export default function BotaoAutomacoes({
  idQuadro, ids, escuro = false, onFeito,
}: {
  idQuadro: string;
  ids: string[];
  escuro?: boolean;
  onFeito?: () => void;
}) {
  const { data: automacoes = [] } = useAutomacoes(idQuadro);
  const executar = useExecutarAutomacaoManual();
  const manuais = automacoes.filter((a) => a.gatilho === "manual" && a.ativo);
  if (manuais.length === 0 || ids.length === 0) return null;

  const cls = escuro
    ? "rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white focus:outline-none [&>option]:text-gray-800"
    : "rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-800 focus:outline-none";

  return (
    <label className="inline-flex items-center gap-1" title="Rodar uma automação manual">
      <Zap className={`size-4 ${escuro ? "text-amber-300" : "text-amber-600"}`} />
      <select
        value=""
        disabled={executar.isPending}
        onChange={(e) => {
          const id = e.target.value;
          if (id) executar.mutate({ id, ids }, { onSuccess: () => onFeito?.() });
        }}
        className={cls}
        aria-label="Rodar automação"
      >
        <option value="">{executar.isPending ? "Rodando…" : "Rodar automação…"}</option>
        {manuais.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>
    </label>
  );
}

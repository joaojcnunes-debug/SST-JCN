"use client";

import { useState } from "react";
import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useHistoricoAutomacoes } from "@/lib/hooks/useGestao";

// v298: o que as automações do quadro fizeram (gestao_automacao_log, só quem vê o quadro). Atualiza
// sozinho a cada 15 s enquanto a aba está aberta.

const ICONE = {
  ok: <CheckCircle2 className="size-4 text-emerald-600" />,
  skip: <CircleSlash className="size-4 text-gray-400" />,
  erro: <XCircle className="size-4 text-red-600" />,
} as const;

const ROTULO_RES: Record<string, string> = { ok: "Rodou", skip: "Pulou", erro: "Falhou" };

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export default function AutomacoesHistorico({ idQuadro }: { idQuadro: string }) {
  const { data = [], isLoading, error } = useHistoricoAutomacoes(idQuadro, true);
  const [filtro, setFiltro] = useState<"" | "ok" | "skip" | "erro">("");
  const linhas = filtro ? data.filter((l) => l.resultado === filtro) : data;

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (error) return <p className="text-sm text-red-600">Não foi possível carregar o histórico.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["", "ok", "skip", "erro"] as const).map((k) => (
          <button key={k || "todos"} type="button" onClick={() => setFiltro(k)}
            className={`rounded-full px-2.5 py-1 font-medium ${filtro === k ? "bg-verde-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {k ? `${ROTULO_RES[k]} (${data.filter((l) => l.resultado === k).length})` : `Todas (${data.length})`}
          </button>
        ))}
        <span className="ml-auto text-gray-400">últimas 200 execuções</span>
      </div>
      {linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Nenhuma execução registrada{filtro ? " com este resultado" : ""}.</p>
      ) : (
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {linhas.map((l, i) => (
            <li key={`${l.created_at}-${i}`} className="rounded-md border border-gray-100 bg-white px-2.5 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {ICONE[l.resultado as keyof typeof ICONE] ?? ICONE.skip}
                <strong className="text-gray-800">{l.automacao}</strong>
                <span className="text-gray-400">· {quando(l.created_at)}</span>
                {l.tarefa && <span className="truncate text-gray-600">· {l.tarefa}</span>}
              </div>
              {l.detalhe && <p className="mt-1 whitespace-pre-wrap pl-5 text-gray-500">{l.detalhe.split(" · ").join("\n")}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { usePortalPlanoAcao } from "@/lib/hooks/usePortalCliente";

const STATUS_COR: Record<string, string> = {
  Aberta:       "bg-amber-100 text-amber-800",
  "Em andamento": "bg-blue-100 text-blue-800",
  Concluída:    "bg-green-100 text-green-800",
  Cancelada:    "bg-gray-100 text-gray-600",
};

const PRIORIDADE_COR: Record<string, string> = {
  Alta:  "bg-red-100 text-red-700",
  Média: "bg-yellow-100 text-yellow-800",
  Baixa: "bg-gray-100 text-gray-600",
};

type FiltroStatus = "todos" | "Aberta" | "Em andamento" | "Concluída" | "Cancelada";

export default function PlanoAcaoCliente() {
  const { data: acoes, isLoading, error } = usePortalPlanoAcao();
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");

  const hoje = new Date().toISOString().slice(0, 10);

  const acoesFiltradas =
    filtro === "todos" ? acoes : acoes?.filter((a) => a.status === filtro);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plano de Ação</h1>
        <p className="mt-1 text-sm text-gray-500">Ações 5W2H associadas à sua empresa</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(["todos", "Aberta", "Em andamento", "Concluída", "Cancelada"] as FiltroStatus[]).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filtro === f
                  ? "bg-teal-700 text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {f === "todos" ? "Todos" : f}
            </button>
          )
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Erro ao carregar plano de ação.</p>
      )}

      {!isLoading && !error && acoesFiltradas?.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <ListChecks className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">Nenhuma ação encontrada</p>
        </div>
      )}

      {acoesFiltradas && acoesFiltradas.length > 0 && (
        <div className="space-y-3">
          {acoesFiltradas.map((a) => {
            const vencida =
              a.when_prazo && a.status !== "Concluída" && a.status !== "Cancelada"
                ? a.when_prazo < hoje
                : false;

            return (
              <div
                key={a.id_acao}
                className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${
                  vencida ? "ring-red-300" : "ring-black/5"
                }`}
              >
                <div className="flex flex-wrap items-start gap-2 mb-2">
                  <p className="flex-1 font-semibold text-gray-900 min-w-0">{a.what_acao}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      STATUS_COR[a.status ?? ""] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {a.status}
                  </span>
                  {a.prioridade && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        PRIORIDADE_COR[a.prioridade] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {a.prioridade}
                    </span>
                  )}
                  {vencida && (
                    <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
                      VENCIDA
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 sm:grid-cols-3">
                  {a.why_justificativa && (
                    <span className="col-span-full">Por quê: {a.why_justificativa}</span>
                  )}
                  {a.who_responsavel && <span>Responsável: {a.who_responsavel}</span>}
                  {a.where_local && <span>Local: {a.where_local}</span>}
                  {a.when_prazo && (
                    <span className={vencida ? "font-semibold text-red-700" : ""}>
                      Prazo: {a.when_prazo}
                    </span>
                  )}
                  {a.how_much_custo && <span>Custo: R$ {a.how_much_custo}</span>}
                  {a.data_conclusao && <span>Concluído: {a.data_conclusao}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

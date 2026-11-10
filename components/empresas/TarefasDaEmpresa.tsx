"use client";

import { useState } from "react";
import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { useTarefasDaEmpresa } from "@/lib/hooks/useGestao";
import { fmtData } from "@/lib/utils";

/**
 * Ficha da empresa › Tarefas (v338, item 11 — como a relação entre bases do Notion): as tarefas da Gestão ligadas a
 * esta empresa. Cada um vê só as tarefas que a Gestão já deixa ver (quadro, equipe, unidade, Financeiro sigiloso).
 */
export default function TarefasDaEmpresa({ idEmpresa }: { idEmpresa: string }) {
  const { data = [], isLoading, error } = useTarefasDaEmpresa(idEmpresa);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const abertas = data.filter((t) => !t.concluida);
  const lista = verConcluidas ? data : abertas;
  const hoje = new Date().toLocaleDateString("sv-SE");

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Tarefas na Gestão ({abertas.length} {abertas.length === 1 ? "aberta" : "abertas"}
          {data.length > abertas.length && <> · {data.length - abertas.length} concluídas</>})
        </h2>
        {data.length > abertas.length && (
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={verConcluidas} onChange={(e) => setVerConcluidas(e.target.checked)} className="size-4 accent-marca-primary" />
            Mostrar concluídas
          </label>
        )}
      </div>
      {isLoading ? (
        <p className="p-6 text-sm text-gray-400">Carregando…</p>
      ) : error ? (
        <p className="p-6 text-sm text-red-600">Não foi possível carregar as tarefas.</p>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center p-8 text-center text-sm text-gray-500">
          <KanbanSquare className="size-8 text-gray-400" />
          <p className="mt-2">{data.length ? "Nenhuma tarefa aberta." : "Nenhuma tarefa ligada a esta empresa que você possa ver."}</p>
          {!data.length && <p className="mt-1 text-xs text-gray-400">Na tarefa, o campo Empresa fica no painel da direita.</p>}
        </div>
      ) : (
        <ul>
          {lista.map((t) => {
            const atrasada = !t.concluida && !!t.prazo && t.prazo < hoje;
            return (
              <li key={t.id_tarefa} className="border-t border-gray-100 first:border-t-0">
                <Link href={`/gestao?quadro=${encodeURIComponent(t.id_quadro)}&tarefa=${encodeURIComponent(t.id_tarefa)}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${t.concluida ? "text-gray-400 line-through" : "text-gray-900"}`}>{t.titulo}</p>
                    <p className="truncate text-xs text-gray-500">
                      {t.quadro ?? "Quadro"} · #{t.id_tarefa}{t.responsavel ? ` · ${t.responsavel}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {t.prazo && <span className={atrasada ? "font-semibold text-red-600" : "text-gray-500"}>{atrasada ? "Atrasada · " : ""}{fmtData(t.prazo)}</span>}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                      <span className="size-2 rounded-full" style={{ background: t.status_cor || "#9ca3af" }} aria-hidden />
                      {t.status_nome ?? t.status}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {data.length >= 300 && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Mostrando as 300 primeiras.</p>}
    </div>
  );
}

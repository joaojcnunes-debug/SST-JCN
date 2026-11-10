"use client";

import { useRef, useState } from "react";
import { Plus, X, Square, CheckSquare } from "lucide-react";
import { useChecklist, useAddChecklist, useAtualizarChecklist, useExcluirChecklist, type GestaoChecklistItem } from "@/lib/hooks/useGestao";

const EMPTY: GestaoChecklistItem[] = [];

/**
 * Checklist da tarefa (v351, item 5 da comparação — como no Runrun, Trello e ClickUp): itens simples de marcar,
 * separados das subtarefas (sem responsável, sem janela própria). Na tarefa que já existe, marcar, editar e
 * excluir gravam NA HORA; na Nova tarefa os itens ficam em rascunho e entram quando a tarefa é criada.
 * Colar uma lista (um item por linha) cria um item por linha.
 */
export default function ChecklistTarefa({ idTarefa, podeEditar, rascunho, setRascunho, nomeDe }: {
  idTarefa: string | null;
  podeEditar: boolean;
  rascunho: string[];
  setRascunho: (f: (s: string[]) => string[]) => void;
  nomeDe: (email: string | null) => string | null;
}) {
  const nova = !idTarefa;
  const { data: itens = EMPTY, isLoading } = useChecklist(idTarefa);
  const add = useAddChecklist();
  const atualizar = useAtualizarChecklist();
  const excluir = useExcluirChecklist();
  const [novo, setNovo] = useState("");
  const novoRef = useRef<HTMLInputElement>(null);

  const total = nova ? rascunho.length : itens.length;
  const feitos = nova ? 0 : itens.filter((i) => i.feito).length;
  const pct = total ? Math.round((feitos / total) * 100) : 0;

  function adicionar(textos: string[]) {
    const limpos = textos.map((t) => t.trim()).filter(Boolean);
    if (!limpos.length) return;
    if (nova) setRascunho((s) => [...s, ...limpos]);
    else add.mutate({ id_tarefa: idTarefa, textos: limpos, ordemInicial: itens.reduce((m, i) => Math.max(m, i.ordem), -1) + 1 });
    setNovo("");
    requestAnimationFrame(() => novoRef.current?.focus());
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="shrink-0 text-xs text-gray-500">
          {total === 0 ? "Nenhum item ainda." : nova ? `${total} item(ns) — entram quando a tarefa for criada` : `${feitos} de ${total} feito(s)`}
        </span>
        {!nova && total > 0 && (
          <span className="h-1.5 flex-1 rounded-full bg-gray-100" aria-hidden>
            <span className="block h-full rounded-full bg-marca-primary transition-all" style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>

      <div className="space-y-1">
        {nova
          ? rascunho.map((t, i) => (
              <div key={`${i}:${t}`} className="group flex items-center gap-2">
                <Square className="size-4 shrink-0 text-gray-300" aria-hidden />
                <span className="min-w-0 flex-1 px-1.5 py-1 text-sm text-gray-700">{t}</span>
                <button type="button" onClick={() => setRascunho((s) => s.filter((_, j) => j !== i))} aria-label={`Tirar ${t}`} className="text-gray-300 hover:text-red-600">
                  <X className="size-4" />
                </button>
              </div>
            ))
          : itens.map((i) => {
              const quem = i.feito && i.feito_por ? nomeDe(i.feito_por) ?? i.feito_por : null;
              const quando = i.feito_em ? new Date(i.feito_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
              return (
                <div key={i.id} className="group flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!podeEditar}
                    onClick={() => atualizar.mutate({ id: i.id, id_tarefa: i.id_tarefa, patch: { feito: !i.feito } })}
                    aria-label={i.feito ? `Desmarcar ${i.texto}` : `Marcar ${i.texto}`}
                    className="shrink-0 text-gray-400 hover:text-marca-primary disabled:hover:text-gray-400"
                  >
                    {i.feito ? <CheckSquare className="size-4 text-marca-primary" /> : <Square className="size-4" />}
                  </button>
                  <input
                    // a chave inclui o texto: quando o banco devolve outro texto, a caixa recomeça com ele
                    key={`${i.id}:${i.texto}`}
                    defaultValue={i.texto}
                    disabled={!podeEditar}
                    aria-label={`Texto do item ${i.texto}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                      else if (e.key === "Escape") { e.preventDefault(); e.currentTarget.value = i.texto; e.currentTarget.blur(); }
                    }}
                    onBlur={(e) => {
                      const t = e.currentTarget.value.trim();
                      if (!t) { e.currentTarget.value = i.texto; return; }
                      if (t !== i.texto) atualizar.mutate({ id: i.id, id_tarefa: i.id_tarefa, patch: { texto: t } });
                    }}
                    className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-gray-200 focus:border-marca-primary focus:outline-none disabled:hover:border-transparent ${i.feito ? "text-gray-400 line-through" : "text-gray-700"}`}
                  />
                  {quem && (
                    <span className="hidden shrink-0 text-[11px] text-gray-400 sm:inline" title={`Marcado por ${quem}${quando ? ` em ${quando}` : ""}`}>
                      {quem.split(" ")[0]}{quando ? ` · ${quando}` : ""}
                    </span>
                  )}
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => excluir.mutate({ id: i.id, id_tarefa: i.id_tarefa })}
                      aria-label={`Excluir ${i.texto}`}
                      className="shrink-0 text-gray-300 opacity-0 transition hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
        {!nova && isLoading && <p className="text-xs text-gray-400">Carregando…</p>}

        {podeEditar && (
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={() => adicionar([novo])} disabled={!novo.trim() || add.isPending} aria-label="Adicionar item" className="shrink-0 text-gray-400 hover:text-marca-primary disabled:text-gray-300">
              <Plus className="size-4" />
            </button>
            <input
              ref={novoRef}
              // checklist vazio: o cursor já vai para cá (veio do "Adicionar" ou da aba)
              autoFocus={total === 0}
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar([novo]); } }}
              onPaste={(e) => {
                const txt = e.clipboardData.getData("text");
                if (/\r?\n/.test(txt.trim())) { e.preventDefault(); adicionar(txt.split(/\r?\n/)); }
              }}
              placeholder="Adicionar item (Enter) — colar uma lista cria um item por linha"
              aria-label="Novo item do checklist"
              className="min-w-0 flex-1 rounded border border-gray-200 bg-transparent px-1.5 py-1 text-sm focus:border-marca-primary focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Send, X, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { iniciais, corAvatar, type GestaoStatus } from "@/lib/hooks/useGestao";
import { useTarefaHistorico, descreverMovimentacao } from "@/lib/hooks/useTarefaHistorico";

function quando(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

/**
 * Sidebar do TarefaModal (G1.2): linha do tempo unificada (comentários + movimentações do
 * histórico, ordenada por created_at) + campo de novo comentário no rodapé. Coluna à direita
 * em telas largas; colapsável em telas estreitas. Render 100% TEXTO (React-escaped) — R1: nada
 * de dangerouslySetInnerHTML.
 */
export default function TarefaSidebar({
  idTarefa,
  ro,
  statuses,
  novoComentario,
  setNovoComentario,
  onEnviar,
  enviando,
  onExcluirComentario,
}: {
  idTarefa: string;
  ro: boolean;
  statuses: GestaoStatus[];
  novoComentario: string;
  setNovoComentario: (v: string) => void;
  onEnviar: () => void;
  enviando: boolean;
  onExcluirComentario: (idComentario: string) => void;
}) {
  const { data: itens = [], isLoading } = useTarefaHistorico(idTarefa);
  const [aberta, setAberta] = useState(true);

  const nomeStatus = useMemo(() => {
    const m = new Map(statuses.map((s) => [s.slug, s.nome]));
    return (slug: string | null) => (slug ? m.get(slug) ?? slug : "—");
  }, [statuses]);

  const nComentarios = itens.filter((i) => i.kind === "comentario").length;

  return (
    <aside className="flex shrink-0 flex-col lg:w-80 lg:border-l lg:border-gray-100 lg:pl-4">
      <button
        type="button"
        onClick={() => setAberta((o) => !o)}
        aria-expanded={aberta}
        className="mb-2 flex items-center justify-between rounded-lg px-1 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:cursor-default lg:hover:bg-transparent"
      >
        <span className="flex items-center gap-2">
          <MessageSquare className="size-4 text-gray-400" />
          Comentários e histórico
          {nComentarios > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-500">
              {nComentarios}
            </span>
          )}
        </span>
        <span className="lg:hidden">
          {aberta ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
        </span>
      </button>

      <div className={aberta ? "flex min-h-0 flex-1 flex-col" : "hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"}>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 lg:max-h-[52vh]">
          {isLoading && <p className="text-xs text-gray-400">Carregando…</p>}
          {!isLoading && itens.length === 0 && (
            <p className="text-xs text-gray-400">Sem comentários nem movimentações ainda.</p>
          )}
          {itens.map((item) => {
            const ator = item.ator || "—";
            if (item.kind === "comentario") {
              const idComentario = item.key.slice("cmt:".length);
              return (
                <div key={item.key} className="group flex gap-2">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: corAvatar(item.ator ?? "?") }}
                  >
                    {iniciais(item.ator ?? "?")}
                  </span>
                  <div className="flex-1 rounded-lg bg-gray-50 px-3 py-1.5">
                    <p className="text-[11px] text-gray-400">
                      {item.ator ?? "—"} · {quando(item.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{item.texto}</p>
                  </div>
                  {!ro && (
                    <button
                      type="button"
                      aria-label="Excluir comentário"
                      onClick={() => onExcluirComentario(idComentario)}
                      className="self-start text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            }
            return (
              <div key={item.key} className="flex items-start gap-2 py-0.5 text-sm">
                <span className="mt-1 flex size-1.5 shrink-0 rounded-full bg-gray-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-600">
                    <span className="font-medium text-gray-800">{ator}</span>{" "}
                    {descreverMovimentacao(item, nomeStatus)}
                  </p>
                  <p className="text-[11px] text-gray-400">{quando(item.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {!ro && (
          <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
            <input
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novoComentario.trim()) {
                  e.preventDefault();
                  onEnviar();
                }
              }}
              placeholder="Escrever um comentário…"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={onEnviar}
              disabled={!novoComentario.trim() || enviando}
              className="rounded-lg bg-verde-primary px-3 py-2 text-white disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

"use client";

import { Send, X } from "lucide-react";
import { useTarefaHistorico } from "@/lib/hooks/useTarefaHistorico";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";

function quando(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

/**
 * Aba "Comentários" do TarefaModal: só os comentários (as movimentações foram para a aba
 * Histórico) + campo de novo comentário no rodapé. Substitui a antiga coluna da direita
 * (TarefaSidebar). Render 100% TEXTO (React-escaped) — nada de dangerouslySetInnerHTML.
 */
export default function ComentariosTarefa({
  idTarefa,
  ro,
  podeComentar = !ro,
  novoComentario,
  setNovoComentario,
  onEnviar,
  enviando,
  onExcluirComentario,
}: {
  idTarefa: string;
  ro: boolean;
  /** Caixa de comentário: também para o nível "ver e comentar", que não edita (ro). Excluir segue em !ro. */
  podeComentar?: boolean;
  novoComentario: string;
  setNovoComentario: (v: string) => void;
  onEnviar: () => void;
  enviando: boolean;
  onExcluirComentario: (idComentario: string) => void;
}) {
  const { data: itens = [], isLoading } = useTarefaHistorico(idTarefa);
  const comentarios = itens.filter((i) => i.kind === "comentario");

  return (
    <div className="flex flex-col">
      <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-gray-400">Carregando…</p>}
        {!isLoading && comentarios.length === 0 && <p className="text-xs text-gray-400">Nenhum comentário ainda.</p>}
        {comentarios.map((item) => {
          if (item.kind !== "comentario") return null;
          const idComentario = item.key.slice("cmt:".length);
          return (
            <div key={item.key} className="group flex gap-2">
              <AvatarPessoa nome={item.ator ?? "?"} className="size-7 text-[10px]" />
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
        })}
      </div>

      {podeComentar && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
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
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-marca-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={onEnviar}
            disabled={!novoComentario.trim() || enviando}
            aria-label="Enviar comentário"
            className="rounded-lg bg-marca-primary px-3 py-2 text-white disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

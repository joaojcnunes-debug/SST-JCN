"use client";

import { Send, X, CheckCircle2, CircleDot, UserRound } from "lucide-react";
import { useTarefaHistorico } from "@/lib/hooks/useTarefaHistorico";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";

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
 * v341 (Painel v353, item 10, como no ClickUp): o comentário pode ser ATRIBUÍDO a alguém — vira pendência dela até
 * alguém marcar "Resolver" (quem recebeu ou quem edita o quadro).
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
  usuarios = [],
  meuEmail = null,
  podeResolverTodos = false,
  atribuirA = "",
  setAtribuirA,
  onResolver,
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
  usuarios?: { nome: string; email: string }[];
  meuEmail?: string | null;
  /** Quem edita o quadro resolve qualquer comentário atribuído. */
  podeResolverTodos?: boolean;
  atribuirA?: string;
  setAtribuirA?: (email: string) => void;
  onResolver?: (idComentario: string, resolvido: boolean) => void;
}) {
  const { data: itens = [], isLoading } = useTarefaHistorico(idTarefa);
  const comentarios = itens.filter((i) => i.kind === "comentario");
  const nomeDe = (email: string | null | undefined) =>
    email ? usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase())?.nome ?? email : "—";
  const pendentes = comentarios.filter((i) => i.kind === "comentario" && i.atribuido_a && !i.resolvido_em).length;

  return (
    <div className="flex flex-col">
      {pendentes > 0 && (
        <p className="mb-2 inline-flex items-center gap-1.5 self-start rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <CircleDot className="size-3.5" /> {pendentes} comentário(s) atribuído(s) esperando resolução
        </p>
      )}
      <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-gray-400">Carregando…</p>}
        {!isLoading && comentarios.length === 0 && <p className="text-xs text-gray-400">Nenhum comentário ainda.</p>}
        {comentarios.map((item) => {
          if (item.kind !== "comentario") return null;
          const idComentario = item.key.slice("cmt:".length);
          const atribuido = item.atribuido_a ?? null;
          const resolvido = !!item.resolvido_em;
          const souEu = !!atribuido && !!meuEmail && atribuido.toLowerCase() === meuEmail.toLowerCase();
          const podeResolver = !!atribuido && !!onResolver && (souEu || podeResolverTodos);
          return (
            <div key={item.key} className="group flex gap-2">
              <AvatarPessoa nome={item.ator ?? "?"} className="size-7 text-[10px]" />
              <div className={`flex-1 rounded-lg px-3 py-1.5 ${atribuido && !resolvido ? "bg-amber-50 ring-1 ring-amber-200" : "bg-gray-50"}`}>
                <p className="text-[11px] text-gray-400">
                  {item.ator ?? "—"} · {quando(item.created_at)}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{item.texto}</p>
                {atribuido && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-medium text-gray-600">
                      <UserRound className="size-3.5" /> Para {souEu ? "você" : nomeDe(atribuido)}
                    </span>
                    {resolvido ? (
                      <span className="inline-flex items-center gap-1 text-marca-primary">
                        <CheckCircle2 className="size-3.5" /> resolvido por {nomeDe(item.resolvido_por)} em {quando(item.resolvido_em!)}
                      </span>
                    ) : (
                      <span className="font-medium text-amber-700">pendente</span>
                    )}
                    {podeResolver && (
                      <button
                        type="button"
                        onClick={() => onResolver!(idComentario, !resolvido)}
                        className={`rounded-md px-2 py-0.5 font-semibold ${resolvido ? "text-gray-500 hover:bg-gray-100" : "bg-marca-primary text-white hover:bg-marca-accent"}`}
                      >
                        {resolvido ? "Reabrir" : "Resolver"}
                      </button>
                    )}
                  </div>
                )}
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
        <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center">
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
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-marca-primary focus:outline-none"
          />
          <div className="flex items-center gap-2">
            {setAtribuirA && (
              <div className="w-44" title="Atribuir: o comentário vira pendência da pessoa até ser resolvido">
                <UsuarioCombobox
                  usuarios={usuarios}
                  value={atribuirA}
                  onChange={(em) => setAtribuirA(em)}
                  incluirVazio
                  vazioLabel="Não atribuir"
                  placeholder="Atribuir a…"
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-marca-primary focus:outline-none"
                />
              </div>
            )}
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
        </div>
      )}
    </div>
  );
}

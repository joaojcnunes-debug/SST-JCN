"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Send, X, CheckCircle2, CircleDot, UserRound, Sparkles, Loader2 } from "lucide-react";
import { mensagemErro } from "@/lib/errors";
import { resumirComentariosIa } from "@/lib/hooks/useGestao";
import { MIN_COMENTARIOS_RESUMO, type ResumoIa } from "@/lib/gestao/ia-resumo";
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
 * 0.3.275 (= Painel 0.3.925): "Resumir com IA" — situação, o que já foi decidido, o que falta e o próximo passo. A IA lê
 * os comentários com o login da pessoa (só o que ela já vê). O resumo não fica salvo.
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
  const [resumo, setResumo] = useState<{ resumo: ResumoIa; usados: number; total: number } | null>(null);
  const [resumindo, setResumindo] = useState(false);
  useEffect(() => setResumo(null), [idTarefa]);
  async function resumir() {
    setResumindo(true);
    try {
      setResumo(await resumirComentariosIa(idTarefa));
    } catch (e) {
      toast.error(mensagemErro(e, "IA indisponível no momento."));
    } finally {
      setResumindo(false);
    }
  }

  return (
    <div className="flex flex-col">
      {comentarios.length >= MIN_COMENTARIOS_RESUMO && !resumo && (
        <button type="button" onClick={resumir} disabled={resumindo} className="mb-2 inline-flex items-center gap-1 self-end rounded-md px-1.5 py-0.5 text-xs font-medium text-marca-primary hover:bg-marca-light/50 disabled:opacity-50">
          {resumindo ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {resumindo ? "Resumindo…" : "Resumir com IA"}
        </button>
      )}
      {resumo && (
        <div className="mb-3 rounded-lg border border-marca-primary/30 bg-marca-light/30 p-3 text-sm" aria-live="polite">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-marca-primary"><Sparkles className="size-3.5" /> Resumo da conversa (IA)</p>
            <button type="button" onClick={() => setResumo(null)} aria-label="Fechar o resumo" className="text-gray-400 hover:text-gray-700"><X className="size-4" /></button>
          </div>
          {resumo.resumo.situacao && <p className="text-gray-800">{resumo.resumo.situacao}</p>}
          {resumo.resumo.decisoes.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-gray-600">Já decidido</p>
              <ul className="list-disc space-y-0.5 pl-5 text-gray-700">{resumo.resumo.decisoes.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
          {resumo.resumo.pendencias.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-gray-600">Falta</p>
              <ul className="list-disc space-y-0.5 pl-5 text-gray-700">{resumo.resumo.pendencias.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
          {resumo.resumo.proximo_passo && <p className="mt-2 text-gray-700"><span className="font-semibold">Próximo passo:</span> {resumo.resumo.proximo_passo}</p>}
          <p className="mt-2 text-[11px] text-gray-500">
            Gerado por IA a partir de {resumo.usados === resumo.total ? `${resumo.total} comentários` : `${resumo.usados} dos ${resumo.total} comentários (os mais novos)`}. Confira nos comentários; o resumo não fica salvo.
          </p>
        </div>
      )}
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

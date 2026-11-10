"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus, X, Loader2 } from "lucide-react";
import { useUserStore } from "@/lib/store";
import { useSalvarTarefa, useRegistrarAtividade, type PrioridadeTarefa, type StatusTarefa } from "@/lib/hooks/useGestao";

/**
 * "+ Adicionar tarefa" no pé da coluna do quadro (como no Trello): escreve o título, Enter cria a tarefa
 * ali mesmo, sem abrir a janela, e a caixa continua aberta para a próxima. Esc ou X fecha.
 * Grava do mesmo jeito que a janela "Nova tarefa" (useSalvarTarefa + "criada" no histórico), então as
 * automações de tarefa criada rodam no banco igual. Os outros campos ficam para quando abrir a tarefa.
 */
export default function NovaTarefaRapida({ idQuadro, status, prioridade, ordem }: {
  idQuadro: string;
  status: StatusTarefa;
  /** Quadro agrupado por prioridade: a tarefa nasce com a prioridade da coluna. */
  prioridade?: PrioridadeTarefa;
  /** Posição no fim da coluna (perto da caixa), para a pessoa ver a tarefa que acabou de criar. */
  ordem?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const salvar = useSalvarTarefa();
  const registrarAtiv = useRegistrarAtividade();
  const userNome = useUserStore((s) => s.user?.nome ?? null);
  const caixaRef = useRef<HTMLTextAreaElement>(null);

  function fechar() {
    setTitulo("");
    setAberto(false);
  }

  async function criar() {
    const t = titulo.trim();
    if (!t || salvar.isPending) return;
    try {
      const id = await salvar.mutateAsync({ id_quadro: idQuadro, titulo: t, status, prioridade: prioridade ?? "Media", ordem });
      registrarAtiv.mutate({ id_tarefa: id, ator: userNome, eventos: [{ acao: "criada" }] });
      setTitulo("");
      toast.success("Tarefa criada");
    } catch {
      // useSalvarTarefa já avisou o erro; o título continua na caixa para tentar de novo.
    } finally {
      requestAnimationFrame(() => caixaRef.current?.focus());
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <Plus className="size-4" /> Adicionar tarefa
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        ref={caixaRef}
        autoFocus
        rows={2}
        value={titulo}
        disabled={salvar.isPending}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); criar(); }
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); }
        }}
        // Clicou fora sem escrever nada: fecha, como no Trello. Com texto, a caixa fica (nada se perde).
        onBlur={() => { if (!titulo.trim() && !salvar.isPending) setAberto(false); }}
        placeholder="Título da tarefa…"
        aria-label="Título da nova tarefa"
        className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm focus:border-marca-primary focus:outline-none focus:ring-1 focus:ring-marca-primary/30 disabled:opacity-60"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={criar}
          disabled={!titulo.trim() || salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-marca-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-marca-accent disabled:opacity-50"
        >
          {salvar.isPending && <Loader2 className="size-3.5 animate-spin" />} Adicionar
        </button>
        <button type="button" onClick={fechar} aria-label="Cancelar" title="Cancelar (Esc)" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <X className="size-4" />
        </button>
        <span className="ml-auto text-[11px] text-gray-400">Enter cria</span>
      </div>
    </div>
  );
}

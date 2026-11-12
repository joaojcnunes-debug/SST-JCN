"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { KanbanSquare, Loader2, RotateCcw, Search, SquareCheckBig, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useLixeira, useRestaurarLixeira, DIAS_LIXEIRA, type ItemLixeira } from "@/lib/hooks/useGestao";
import { normalizarTexto, tokenizar } from "@/lib/busca/texto";

type Filtro = "tudo" | "tarefa" | "quadro";

const FMT = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function diasAte(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Por que não dá para restaurar (o banco confere de novo na hora). */
function motivoBloqueio(i: ItemLixeira): string | null {
  if (i.pode_restaurar) return null;
  if (i.tipo === "tarefa" && !i.quadro_existe) return `A lista "${i.nome_quadro ?? "?"}" não existe mais — restaure a lista primeiro.`;
  if (i.tipo === "tarefa" && !i.mae_existe) return "A tarefa-mãe desta subtarefa não existe mais — restaure a tarefa-mãe primeiro.";
  if (i.tipo === "quadro") return "Já existe uma lista com o mesmo código.";
  return "Você não pode mais editar esta lista. Peça a um gestor para restaurar.";
}

/**
 * Lixeira da Gestão (v361, 11/11/2026): cartões e listas excluídos, por 180 dias. "Restaurar" devolve tudo como estava
 * (comentários, checklist, anexos, subtarefas, histórico, responsáveis; na lista, status, campos, automações,
 * formulários e acessos), sem avisar ninguém de novo. Não há "excluir de vez": sai restaurando ou no prazo.
 */
export default function LixeiraModal({
  open,
  onClose,
  onAbrirQuadro,
}: {
  open: boolean;
  onClose: () => void;
  /** Depois de restaurar: abrir a lista do item. */
  onAbrirQuadro: (idQuadro: string) => void;
}) {
  const { data: itens = [], isLoading, error } = useLixeira(open);
  const restaurar = useRestaurarLixeira();
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [busca, setBusca] = useState("");
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const visiveis = useMemo(() => {
    const termos = tokenizar(busca);
    return itens.filter((i) => {
      if (filtro !== "tudo" && i.tipo !== filtro) return false;
      if (!termos.length) return true;
      const alvo = normalizarTexto(`${i.titulo} ${i.nome_quadro ?? ""} ${i.excluida_por_nome}`);
      return termos.every((t) => alvo.includes(t));
    });
  }, [itens, filtro, busca]);
  const nTarefas = itens.filter((i) => i.tipo === "tarefa").length;
  const nListas = itens.length - nTarefas;

  function fazerRestaurar(i: ItemLixeira) {
    setRestaurando(i.id);
    restaurar.mutate(i.id, {
      onSuccess: (r) => {
        toast.success(
          (t) => (
            <span className="flex items-center gap-2">
              {r.tipo === "quadro" ? `Lista "${r.titulo}" restaurada` : `"${r.titulo}" restaurada`}
              <button type="button" className="rounded bg-marca-primary px-2 py-0.5 text-xs font-semibold text-white"
                onClick={() => { toast.dismiss(t.id); onAbrirQuadro(r.id_quadro); onClose(); }}>
                Abrir lista
              </button>
            </span>
          ),
          { duration: 6000 },
        );
      },
      onSettled: () => setRestaurando(null),
    });
  }

  const chip = (f: Filtro, rotulo: string, n: number) => (
    <button type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${filtro === f ? "bg-marca-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
      {rotulo} <span className={filtro === f ? "text-white/80" : "text-gray-400"}>{n}</span>
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title="Lixeira" size="xl">
      <p className="text-sm text-gray-500">
        Cartões e listas excluídos ficam aqui por {DIAS_LIXEIRA} dias. Restaurar devolve tudo como estava — comentários,
        checklist, anexos, subtarefas, histórico e responsáveis — sem avisar ninguém de novo. Você vê o que excluiu; os
        gestores veem tudo.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chip("tudo", "Tudo", itens.length)}
        {chip("tarefa", "Cartões", nTarefas)}
        {chip("quadro", "Listas", nListas)}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na Lixeira…" aria-label="Buscar na Lixeira"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-marca-primary focus:outline-none" />
        </div>
      </div>

      <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200">
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600">Não foi possível abrir a Lixeira. Tente de novo.</p>
        ) : visiveis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-gray-400">
            <Trash2 className="size-8 text-gray-300" aria-hidden />
            {itens.length === 0 ? "A Lixeira está vazia." : "Nada encontrado com esse filtro."}
          </div>
        ) : (
          <ul>
            {visiveis.map((i) => {
              const bloqueio = motivoBloqueio(i);
              const dias = diasAte(i.expira_em);
              const detalhes = i.tipo === "quadro"
                ? [i.n_tarefas > 0 && `${i.n_tarefas} tarefa(s)`].filter(Boolean)
                : [i.n_subtarefas > 0 && `${i.n_subtarefas} subtarefa(s)`, i.n_comentarios > 0 && `${i.n_comentarios} comentário(s)`, i.n_anexos > 0 && `${i.n_anexos} anexo(s)`].filter(Boolean);
              return (
                <li key={i.id} className="flex items-start gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
                  <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${i.tipo === "quadro" ? "bg-blue-50 text-blue-600" : "bg-marca-light text-marca-primary"}`}
                    title={i.tipo === "quadro" ? "Lista" : "Cartão"}>
                    {i.tipo === "quadro" ? <KanbanSquare className="size-4" /> : <SquareCheckBig className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800" title={i.titulo}>{i.titulo}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {i.tipo === "quadro" ? "Lista" : <>Lista: <span className="font-medium text-gray-600">{i.nome_quadro ?? "—"}</span></>}
                      {detalhes.length > 0 && <> · {detalhes.join(" · ")}</>}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Excluída por {i.excluida_por_nome} em {FMT.format(new Date(i.excluida_em))} · {dias === 0 ? "sai hoje" : `sai em ${dias} dia${dias === 1 ? "" : "s"}`}
                    </p>
                    {bloqueio && <p className="mt-1 text-xs text-amber-700">{bloqueio}</p>}
                  </div>
                  <button type="button" onClick={() => fazerRestaurar(i)} disabled={!!bloqueio || restaurando !== null}
                    title={bloqueio ?? "Devolver para a lista, como estava"}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-marca-primary/40 bg-white px-2.5 py-1.5 text-sm font-medium text-marca-primary hover:bg-marca-light disabled:cursor-not-allowed disabled:opacity-40">
                    {restaurando === i.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restaurar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Loader2, Package, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { useProdutosGestao, useCriarProduto, useRenomearProduto, useExcluirProduto, type ProdutoGestao } from "@/lib/hooks/useGestao";
import { normalizarTexto, tokenizar } from "@/lib/busca/texto";

const N = new Intl.NumberFormat("pt-BR");
const plural = (n: number, um: string, varios: string) => `${N.format(n)} ${n === 1 ? um : varios}`;
const ordenar = (a: ProdutoGestao, b: ProdutoGestao) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true, sensitivity: "base" });

function uso(p: ProdutoGestao): string {
  const partes = [plural(p.cartoes, "cartão", "cartões")];
  if (p.automacoes) partes.push(plural(p.automacoes, "automação", "automações"));
  if (p.na_lista) partes.push(p.formularios ? `em ${plural(p.formularios, "formulário", "formulários")}` : "em nenhum formulário");
  return partes.join(" · ");
}

/**
 * Produtos da Gestão (v363, 11/11/2026): a lista que aparece na tarefa de todas as listas, no filtro e nos formulários
 * com a pergunta Produtos. Só gestores. Renomear muda em tudo;
 * excluir tira da lista e dos formulários, e os cartões que já tinham continuam com o produto.
 */
export default function ProdutosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: produtos = [], isLoading, error } = useProdutosGestao(open);
  const criar = useCriarProduto();
  const renomear = useRenomearProduto();
  const excluir = useExcluirProduto();
  const [novo, setNovo] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const ocupado = criar.isPending || renomear.isPending || excluir.isPending;

  const { naLista, fora } = useMemo(() => {
    const termos = tokenizar(busca);
    const passa = (p: ProdutoGestao) => !termos.length || termos.every((t) => normalizarTexto(`${p.nome} ${p.apelidos.join(" ")}`).includes(t));
    const vis = produtos.filter(passa);
    return { naLista: vis.filter((p) => p.na_lista).sort(ordenar), fora: vis.filter((p) => !p.na_lista).sort(ordenar) };
  }, [produtos, busca]);
  const total = produtos.filter((p) => p.na_lista).length;

  function adicionar(nome = novo) {
    const v = nome.trim();
    if (!v) return;
    criar.mutate(v, {
      onSuccess: (r) => {
        toast.success(`"${String(r.nome)}" adicionado à lista e a ${plural(Number(r.formularios) || 0, "formulário", "formulários")}`);
        if (nome === novo) setNovo("");
      },
    });
  }

  async function salvarNome(p: ProdutoGestao) {
    const para = nomeEdit.trim().replace(/\s+/g, " ");
    if (!para || para === p.nome) { setEditando(null); return; }
    const ok = await confirmar({
      title: `Renomear "${p.nome}" para "${para}"?`,
      description: `Muda também em ${uso(p)}, nos responsáveis por produto e nos filtros salvos. Cartão que chegar depois com o nome antigo (ex.: do Runrun) fica com o novo.`,
      confirmLabel: "Renomear",
      variant: "primary",
    });
    if (!ok) return;
    renomear.mutate({ de: p.nome, para }, {
      onSuccess: (r) => {
        setEditando(null);
        if (r.sem_mudanca) return;
        toast.success(`Renomeado: ${plural(Number(r.cartoes) || 0, "cartão", "cartões")}, ${plural(Number(r.automacoes) || 0, "automação", "automações")} e ${plural(Number(r.formularios) || 0, "formulário", "formulários")}`);
      },
    });
  }

  async function apagar(p: ProdutoGestao) {
    const ok = await confirmar({
      title: `Excluir "${p.nome}" da lista?`,
      description:
        `Sai da lista, do filtro e dos formulários. ` +
        (p.cartoes ? `Os ${plural(p.cartoes, "cartão", "cartões")} que já têm o produto continuam com ele. ` : "") +
        (p.automacoes ? `${plural(p.automacoes, "automação usa", "automações usam")} este produto e ficam como estão. ` : "") +
        `Dá para pôr de volta depois.`,
    });
    if (!ok) return;
    excluir.mutate(p.nome, { onSuccess: () => toast.success(`"${p.nome}" saiu da lista`) });
  }

  return (
    <Modal open={open} onClose={onClose} title="Produtos" size="xl">
      <p className="text-sm text-gray-500">
        Os produtos que aparecem na tarefa de todas as listas, no filtro e nos formulários com a pergunta Produtos.
        Renomear muda também nos cartões, nas automações e nos responsáveis por produto.
        Excluir tira da lista e dos formulários; os cartões que já tinham continuam com o produto.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); adicionar(); }} className="mt-3 flex gap-2">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo produto…" aria-label="Nome do novo produto" maxLength={80}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-marca-primary focus:outline-none" />
        <button type="submit" disabled={!novo.trim() || ocupado}
          className="inline-flex items-center gap-1 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50">
          {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">{plural(total, "produto na lista", "produtos na lista")}</span>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…" aria-label="Buscar produto"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-marca-primary focus:outline-none" />
        </div>
      </div>

      <div className="mt-2 max-h-[55vh] overflow-y-auto rounded-xl border border-gray-200">
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600">Não foi possível abrir os produtos. Tente de novo.</p>
        ) : naLista.length === 0 && fora.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-gray-400">
            <Package className="size-8 text-gray-300" aria-hidden />
            {produtos.length ? "Nada encontrado." : "Nenhum produto ainda."}
          </div>
        ) : (
          <ul>
            {naLista.map((p) => (
              <li key={p.nome} className="flex items-center gap-3 border-t border-gray-100 px-4 py-2.5 first:border-t-0">
                {editando === p.nome ? (
                  <form onSubmit={(e) => { e.preventDefault(); void salvarNome(p); }} className="flex min-w-0 flex-1 items-center gap-2">
                    <input autoFocus value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} maxLength={80} aria-label={`Novo nome de ${p.nome}`}
                      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditando(null); } }}
                      className="min-w-0 flex-1 rounded-md border border-marca-primary bg-white px-2 py-1 text-sm focus:outline-none" />
                    <button type="submit" disabled={ocupado} title="Salvar" aria-label="Salvar" className="rounded p-1 text-marca-primary hover:bg-marca-light disabled:opacity-50">
                      {renomear.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    </button>
                    <button type="button" onClick={() => setEditando(null)} title="Cancelar" aria-label="Cancelar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="size-4" /></button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800" title={p.nome}>{p.nome}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {uso(p)}
                        {p.apelidos.length > 0 && <span className="text-gray-400"> · antes: {p.apelidos.join(", ")}</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => { setEditando(p.nome); setNomeEdit(p.nome); }} disabled={ocupado} title="Renomear" aria-label={`Renomear ${p.nome}`}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"><Pencil className="size-4" /></button>
                    <button type="button" onClick={() => void apagar(p)} disabled={ocupado} title="Excluir da lista" aria-label={`Excluir ${p.nome}`}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="size-4" /></button>
                  </>
                )}
              </li>
            ))}
            {fora.length > 0 && (
              <>
                <li className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Fora da lista — ainda marcados em cartões
                </li>
                {fora.map((p) => (
                  <li key={`fora-${p.nome}`} className="flex items-center gap-3 border-t border-gray-100 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-600" title={p.nome}>{p.nome}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{uso(p)}</p>
                    </div>
                    <button type="button" onClick={() => adicionar(p.nome)} disabled={ocupado} title="Pôr de volta na lista e nos formulários"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-marca-primary/40 bg-white px-2.5 py-1 text-xs font-medium text-marca-primary hover:bg-marca-light disabled:opacity-40">
                      <RotateCcw className="size-3.5" /> Pôr de volta
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
    </Modal>
  );
}

"use client";

// Comercial › Orçamentos › Catálogo de preços (0.3.339, banco v375): serviços, treinamentos e exames com o valor padrão.
// Começa vazio (decisão do João: os valores variam por cliente); em cada orçamento o valor pode ser trocado.

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCatalogoPrecos, useExcluirPreco, useSalvarPreco } from "@/lib/hooks/useOrcamentos";
import { buscar } from "@/lib/busca/texto";
import { ROTULO_TIPO_PRECO, fmtBRL, type PrecoCatalogo, type TipoPreco } from "@/lib/orcamentos/modelo";
import { confirmar, ConfirmHost } from "@/components/ui/confirm";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";

const inp = "w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-marca-primary focus:outline-none";
const UNIDADE_PADRAO: Record<TipoPreco, string> = { servico: "unidade", treinamento: "por participante", exame: "por exame" };
type Forma = Partial<PrecoCatalogo> & { tipo: TipoPreco; nome: string; unidade: string; valor: number };

export default function CatalogoPrecos() {
  const { data: precos = [], isLoading } = useCatalogoPrecos();
  const salvar = useSalvarPreco();
  const excluir = useExcluirPreco();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"" | TipoPreco>("");
  const [forma, setForma] = useState<Forma | null>(null);

  const visiveis = useMemo(() => {
    const base = precos.filter((p) => !tipo || p.tipo === tipo);
    return busca.trim() ? buscar(base, busca, (p) => [p.nome, p.descricao ?? ""]).itens : base;
  }, [precos, busca, tipo]);

  const gravar = async () => {
    if (!forma || !forma.nome.trim()) return;
    await salvar.mutateAsync(forma).then(() => setForma(null)).catch(() => undefined);
  };

  if (isLoading) return <LoadingSkeleton />;
  return (
    <div className="space-y-3">
      <ConfirmHost />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no catálogo…" aria-label="Buscar no catálogo" className={cn(inp, "py-2 pl-8")} />
        </label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm" aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {(Object.keys(ROTULO_TIPO_PRECO) as TipoPreco[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_PRECO[t]}</option>)}
        </select>
        <button type="button" onClick={() => setForma({ tipo: tipo || "servico", nome: "", unidade: UNIDADE_PADRAO[tipo || "servico"], valor: 0, descricao: "" })}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-marca-primary px-3 py-2 text-sm font-medium text-marca-primary hover:bg-marca-light">
          <Plus className="size-4" /> Novo item
        </button>
      </div>

      {forma && (
        <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 md:grid-cols-6">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Tipo</span>
            <select value={forma.tipo} onChange={(e) => { const t = e.target.value as TipoPreco; setForma({ ...forma, tipo: t, unidade: forma.unidade === UNIDADE_PADRAO[forma.tipo] ? UNIDADE_PADRAO[t] : forma.unidade }); }} className={cn(inp, "mt-1")}>
              {(Object.keys(ROTULO_TIPO_PRECO) as TipoPreco[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_PRECO[t]}</option>)}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-gray-600">Nome</span>
            <input autoFocus value={forma.nome} onChange={(e) => setForma({ ...forma, nome: e.target.value })} placeholder="Ex.: NR-35 Trabalho em Altura" className={cn(inp, "mt-1")} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Unidade</span>
            <input value={forma.unidade} onChange={(e) => setForma({ ...forma, unidade: e.target.value })} className={cn(inp, "mt-1")} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Valor padrão (R$)</span>
            <input type="number" min={0} step="0.01" value={forma.valor} onChange={(e) => setForma({ ...forma, valor: Number(e.target.value) })} className={cn(inp, "mt-1")} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
            <input type="checkbox" checked={forma.ativo ?? true} onChange={(e) => setForma({ ...forma, ativo: e.target.checked })} /> Ativo
          </label>
          <label className="block md:col-span-6">
            <span className="text-xs font-semibold text-gray-600">Descrição (opcional, sai como detalhe no orçamento)</span>
            <input value={forma.descricao ?? ""} onChange={(e) => setForma({ ...forma, descricao: e.target.value })} className={cn(inp, "mt-1")} />
          </label>
          <div className="flex gap-2 md:col-span-6">
            <button type="button" onClick={gravar} disabled={salvar.isPending || !forma.nome.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-marca-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
            </button>
            <button type="button" onClick={() => setForma(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}

      {precos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          O catálogo está vazio. Cadastre os serviços, treinamentos e exames com o valor padrão — em cada orçamento dá para trocar o valor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2 text-right">Valor padrão</th><th className="w-20" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visiveis.map((p) => (
                <tr key={p.id_preco} className={cn(!p.ativo && "opacity-50")}>
                  <td className="px-3 py-2 text-gray-600">{ROTULO_TIPO_PRECO[p.tipo]}</td>
                  <td className="px-3 py-2"><span className="font-medium text-gray-900">{p.nome}</span>{p.descricao && <span className="block text-xs text-gray-500">{p.descricao}</span>}{!p.ativo && <span className="text-xs text-gray-500"> · inativo</span>}</td>
                  <td className="px-3 py-2 text-gray-600">{p.unidade}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtBRL(p.valor)}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => setForma({ ...p })} aria-label={`Editar ${p.nome}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-800"><Pencil className="size-4" /></button>
                    <button type="button" aria-label={`Excluir ${p.nome}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"
                      onClick={async () => { if (await confirmar({ title: "Excluir do catálogo?", description: `"${p.nome}" sai do catálogo. Os orçamentos já feitos não mudam.`, confirmLabel: "Excluir", variant: "danger" })) excluir.mutate(p.id_preco); }}>
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

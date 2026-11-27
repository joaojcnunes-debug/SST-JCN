"use client";

// Comercial › Orçamentos (0.3.339, pedido do João, banco v375): a lista dos orçamentos (busca, situação e marca) e o
// catálogo de preços. Novo orçamento: botão aqui ou "Gerar orçamento" no cartão da empresa em Oportunidades.

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileDown, FileText, Plus, Search } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import CatalogoPrecos from "@/components/orcamentos/CatalogoPrecos";
import { COR_SITUACAO } from "@/components/orcamentos/estilos";
import { useOrcamentos } from "@/lib/hooks/useOrcamentos";
import { buscar } from "@/lib/busca/texto";
import { LISTA_MARCAS, MARCAS, type MarcaOrcamento } from "@/lib/orcamentos/marcas";
import { ROTULO_MODELO, ROTULO_SITUACAO, dataCurta, fmtBRL, rotuloNumero, type SituacaoOrcamento } from "@/lib/orcamentos/modelo";
import { cn } from "@/lib/utils";


export default function OrcamentosPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const aba = params.get("aba") === "catalogo" ? "catalogo" : "lista";
  const trocar = (a: string) => router.replace(a === "lista" ? pathname : `${pathname}?aba=${a}`, { scroll: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <FileText className="size-5 text-amber-700" />
            Orçamentos
          </h1>
          <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
            Plano Essencial, treinamentos e serviços avulsos no padrão de cada marca (Chabra, Holos e JCN). Os preços vêm do catálogo e podem ser
            trocados em cada orçamento; o que já foi enviado não muda — alterar cria uma versão nova.
          </p>
        </div>
        <Link href="/comercial-orcamentos/novo" className="inline-flex items-center gap-1.5 rounded-md bg-marca-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90">
          <Plus className="size-4" /> Novo orçamento
        </Link>
      </div>
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm font-medium" role="tablist">
        {([["lista", "Orçamentos"], ["catalogo", "Catálogo de preços"]] as const).map(([k, r]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => trocar(k)}
            className={cn("rounded-md px-3 py-1.5", aba === k ? "bg-white text-marca-primary shadow-sm" : "text-gray-600 hover:text-gray-900")}>
            {r}
          </button>
        ))}
      </div>
      {aba === "lista" ? <Lista /> : <CatalogoPrecos />}
    </div>
  );
}

function Lista() {
  const { data: orcamentos = [], isLoading, error } = useOrcamentos();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<"" | SituacaoOrcamento>("");
  const [marca, setMarca] = useState<"" | MarcaOrcamento>("");
  const visiveis = useMemo(() => {
    const base = orcamentos.filter((o) => (!situacao || o.situacao === situacao) && (!marca || o.marca === marca));
    return busca.trim() ? buscar(base, busca, (o) => [o.cliente_nome, o.cliente_cnpj ?? "", String(o.numero)]).itens : base;
  }, [orcamentos, busca, situacao, marca]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar: {(error as Error).message}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, CNPJ ou número…" aria-label="Buscar orçamento"
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm shadow-sm" />
        </label>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm" aria-label="Situação">
          <option value="">Todas as situações</option>
          {(Object.keys(ROTULO_SITUACAO) as SituacaoOrcamento[]).map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
        </select>
        <select value={marca} onChange={(e) => setMarca(e.target.value as typeof marca)} className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm" aria-label="Marca">
          <option value="">Todas as marcas</option>
          {LISTA_MARCAS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-500">{visiveis.length} de {orcamentos.length}</span>
      </div>
      {orcamentos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum orçamento ainda. Use <strong>Novo orçamento</strong> ou <strong>Gerar orçamento</strong> no cartão da empresa em Oportunidades.
        </div>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nada com esses filtros.</p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((o) => (
            <li key={o.id_orcamento} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md">
              <Link href={`/comercial-orcamentos/${encodeURIComponent(o.id_orcamento)}`} className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">{o.cliente_nome}</span>
                <span className="text-xs text-gray-500">
                  {rotuloNumero(o)} · {ROTULO_MODELO[o.modelo]} · {MARCAS[o.marca]?.nome ?? o.marca} · {dataCurta(o.dados.data ?? o.criado_em)}
                  {o.criado_por ? ` · ${o.criado_por}` : ""}
                </span>
              </Link>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{fmtBRL(o.total)}{o.modelo === "essencial" ? <span className="text-xs font-normal text-gray-500">/mês</span> : null}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", COR_SITUACAO[o.situacao])}>{ROTULO_SITUACAO[o.situacao]}</span>
              <a href={`/api/pdf/orcamento/${encodeURIComponent(o.id_orcamento)}`} target="_blank" rel="noreferrer" aria-label={`PDF do orçamento ${rotuloNumero(o)}`}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><FileDown className="size-4" /></a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

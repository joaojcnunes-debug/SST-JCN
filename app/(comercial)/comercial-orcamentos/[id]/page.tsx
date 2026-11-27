"use client";

// Comercial › Orçamentos › um orçamento (0.3.339, banco v375): editar o rascunho, mudar a situação (enviado, aprovado,
// recusado), criar uma versão nova do que já saiu, ver as outras versões e, ao aprovar, registrar a venda no Comercial.

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, CopyPlus, Send, ThumbsDown, ThumbsUp, Trash2, Undo2 } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import OrcamentoEditor from "@/components/orcamentos/OrcamentoEditor";
import { COR_SITUACAO } from "@/components/orcamentos/estilos";
import { confirmar, ConfirmHost } from "@/components/ui/confirm";
import { useExcluirOrcamento, useMudarSituacao, useNovaVersao, useOrcamento, useOrcamentos } from "@/lib/hooks/useOrcamentos";
import { useComercial, useRegistrarVenda } from "@/lib/hooks/useComercial";
import { MARCAS } from "@/lib/orcamentos/marcas";
import { ROTULO_MODELO, ROTULO_SITUACAO, dataCurta, fmtBRL, produtosDosItens, rotuloNumero } from "@/lib/orcamentos/modelo";
import { cn, fmtData } from "@/lib/utils";

export default function OrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent(use(params).id);
  const router = useRouter();
  const { data: o, isLoading } = useOrcamento(id);
  const { data: todos = [] } = useOrcamentos();
  const situacao = useMudarSituacao();
  const novaVersao = useNovaVersao();
  const excluir = useExcluirOrcamento();
  const registrar = useRegistrarVenda();
  const { data: comercial = [] } = useComercial();

  if (isLoading) return <LoadingSkeleton />;
  if (!o) return <p className="text-sm text-gray-500">Orçamento não encontrado.</p>;

  const versoes = todos.filter((x) => x.numero === o.numero).sort((a, b) => b.versao - a.versao);
  const maisNova = versoes[0]?.id_orcamento === o.id_orcamento;
  // Ao aprovar: os serviços do Comercial nos itens que ainda não têm venda registrada.
  const empresaComercial = o.id_empresa ? comercial.find((c) => c.empresa.idEmpresa === o.id_empresa) : undefined;
  const vendas = o.situacao === "aprovado" && o.id_empresa
    ? produtosDosItens(o.dados.itens ?? []).filter(({ produto, idItens }) => {
        const op = empresaComercial?.oportunidades.find((x) => x.produto === produto);
        if (!op) return false;
        if (idItens.length) return idItens.some((idItem) => !op.intervencoes?.find((i) => i.idItem === idItem)?.venda);
        return !op.venda;
      })
    : [];

  const registrarVendas = async (produto: string, idItens: string[]) => {
    const obs = `Orçamento ${rotuloNumero(o)} aprovado (${fmtBRL(o.total)})`;
    if (idItens.length) for (const idItem of idItens) await registrar.mutateAsync({ idEmpresa: o.id_empresa!, produto, observacao: obs, idItem }).catch(() => undefined);
    else await registrar.mutateAsync({ idEmpresa: o.id_empresa!, produto, observacao: obs }).catch(() => undefined);
  };

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <Link href="/comercial-orcamentos" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline"><ArrowLeft className="size-4" /> Orçamentos</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{o.cliente_nome}</h1>
          <p className="text-sm text-gray-500">
            {rotuloNumero(o)} · {ROTULO_MODELO[o.modelo]} · {MARCAS[o.marca]?.nome} · {dataCurta(o.dados.data)}
            {o.criado_por ? ` · por ${o.criado_por}` : ""}
            {o.enviado_em ? ` · enviado em ${fmtData(o.enviado_em)}` : ""}
            {o.decidido_em ? ` · ${o.situacao} em ${fmtData(o.decidido_em)}` : ""}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", COR_SITUACAO[o.situacao])}>{ROTULO_SITUACAO[o.situacao]}</span>
      </div>

      {/* Situação e versões */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        {o.situacao === "rascunho" && (
          <>
            <button type="button" onClick={() => situacao.mutate({ id: o.id_orcamento, situacao: "enviado" })} className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
              <Send className="size-4" /> Marcar como enviado
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              onClick={async () => { if (await confirmar({ title: "Excluir este rascunho?", description: "O rascunho é apagado de vez.", confirmLabel: "Excluir", variant: "danger" })) excluir.mutate(o.id_orcamento, { onSuccess: () => router.replace("/comercial-orcamentos") }); }}>
              <Trash2 className="size-4" /> Excluir rascunho
            </button>
          </>
        )}
        {o.situacao === "enviado" && (
          <>
            <button type="button" onClick={() => situacao.mutate({ id: o.id_orcamento, situacao: "aprovado" })} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
              <ThumbsUp className="size-4" /> Cliente aprovou
            </button>
            <button type="button" onClick={() => situacao.mutate({ id: o.id_orcamento, situacao: "recusado" })} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
              <ThumbsDown className="size-4" /> Cliente recusou
            </button>
            <button type="button" onClick={() => situacao.mutate({ id: o.id_orcamento, situacao: "rascunho" })} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <Undo2 className="size-4" /> Voltar a rascunho
            </button>
          </>
        )}
        {(o.situacao === "aprovado" || o.situacao === "recusado") && (
          <button type="button" onClick={() => situacao.mutate({ id: o.id_orcamento, situacao: "enviado" })} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            <Undo2 className="size-4" /> Desfazer a decisão
          </button>
        )}
        {o.situacao !== "rascunho" && maisNova && (
          <button type="button" onClick={() => novaVersao.mutate(o, { onSuccess: (novo) => router.push(`/comercial-orcamentos/${encodeURIComponent(novo)}`) })}
            className="inline-flex items-center gap-1.5 rounded-md border border-marca-primary px-3 py-1.5 text-sm font-medium text-marca-primary hover:bg-marca-light">
            <CopyPlus className="size-4" /> Criar versão nova para alterar
          </button>
        )}
        {versoes.length > 1 && (
          <span className="ml-auto flex flex-wrap items-center gap-1 text-xs text-gray-500">
            Versões:
            {versoes.map((v) => (
              <Link key={v.id_orcamento} href={`/comercial-orcamentos/${encodeURIComponent(v.id_orcamento)}`}
                className={cn("rounded-full px-2 py-0.5 ring-1", v.id_orcamento === o.id_orcamento ? "bg-gray-900 text-white ring-gray-900" : "ring-gray-200 hover:bg-gray-50")}>
                v{v.versao} · {ROTULO_SITUACAO[v.situacao].toLowerCase()}
              </Link>
            ))}
          </span>
        )}
      </div>

      {vendas.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 text-sm font-semibold text-emerald-900">Aprovado: registrar a venda no Comercial?</p>
          <div className="flex flex-wrap gap-2">
            {vendas.map((v) => (
              <button key={v.produto} type="button" disabled={registrar.isPending} onClick={() => registrarVendas(v.produto, v.idItens)}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <BadgeCheck className="size-4" /> Registrar venda: {v.produto}{v.idItens.length ? ` (${v.idItens.length})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <OrcamentoEditor key={`${o.id_orcamento}:${o.situacao}`} existente={o} />
    </div>
  );
}

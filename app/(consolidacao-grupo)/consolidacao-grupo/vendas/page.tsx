"use client";

// Consolidação › Vendas (0.3.236, banco v323): o que o Comercial marcou como vendido. Só leitura.
// É o aviso aos setores do slide "Comercial avisa da venda": o sino atual é só da Gestão.
// 0.3.245: cada venda mostra o que foi vendido (o mesmo que o vendedor via na oportunidade); em
// Intervenções psicossociais, a tabela da etapa Intervenções da Conciliação e o parecer da equipe.

import { Fragment, useMemo, useState } from "react";
import { BadgeCheck, ChevronDown, ChevronRight, Search } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useVendasComercial, type VendaComDetalhe } from "@/lib/hooks/useComercial";
import { NOME_PRODUTO } from "@/lib/comercial/oportunidades";
import { buscar } from "@/lib/busca/texto";
import { fmtData, formatCNPJ } from "@/lib/utils";

export default function VendasPage() {
  const { data: vendas = [], isLoading, error } = useVendasComercial();
  const [busca, setBusca] = useState("");
  // Abertas por padrão: guarda só as que a pessoa recolheu.
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const alternar = (k: string) =>
    setRecolhidas((r) => {
      const n = new Set(r);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const linhas = useMemo(
    () => (busca.trim() ? buscar(vendas, busca, (v) => [v.nome_empresa, v.cnpj, v.municipio, v.vendido_por, NOME_PRODUTO[v.produto], ...(v.detalhe?.intervencoes.map((i) => i.nome) ?? [])]).itens : vendas),
    [vendas, busca],
  );

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar as vendas. Tente de novo.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BadgeCheck className="size-5 text-marca-primary" /> Vendas
        </h1>
        <p className="max-w-3xl text-sm text-gray-500">Serviços que o Comercial marcou como vendidos, do mais recente para o mais antigo.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2 size-4 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresa, serviço ou vendedor"
          aria-label="Buscar empresa, serviço ou vendedor"
          className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20"
        />
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">Nenhuma venda registrada.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Serviço</th>
                <th className="px-3 py-2">Vendido por</th>
                <th className="w-28 px-3 py-2">Em</th>
                <th className="px-3 py-2">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((v) => {
                const k = `${v.id_empresa}|${v.produto}|${v.id_item ?? ""}`;
                // 0.3.247: venda de uma intervenção só mostra o nome dela embaixo do serviço.
                const item = v.id_item ? v.detalhe?.intervencoes[0]?.nome : null;
                const aberta = !recolhidas.has(k);
                return (
                <Fragment key={k}>
                <tr className={aberta ? "bg-gray-50/60" : undefined}>
                  <td className="px-2 py-2.5 align-top">
                    <button
                      type="button"
                      onClick={() => alternar(k)}
                      aria-expanded={aberta}
                      aria-label={aberta ? "Recolher o que foi vendido" : "Ver o que foi vendido"}
                      className="rounded p-0.5 text-gray-500 hover:bg-gray-200"
                    >
                      {aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-gray-900">{v.nome_empresa ?? "Empresa sem cadastro"}</span>
                    <span className="block text-xs text-gray-500">
                      {v.cnpj ? formatCNPJ(v.cnpj) : "—"}
                      {v.municipio ? ` · ${v.municipio}${v.uf ? `/${v.uf}` : ""}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {NOME_PRODUTO[v.produto] ?? v.produto}
                    {v.id_item && <span className="block text-xs font-semibold text-gray-900">{item ?? "Intervenção que saiu da Conciliação"}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{v.vendido_por}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{fmtData(v.vendido_em)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{v.observacao || "—"}</td>
                </tr>
                {aberta && (
                  <tr className="bg-gray-50/60">
                    <td />
                    <td colSpan={5} className="px-3 pb-4 pt-0">
                      <DetalheDaVenda v={v} />
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** O que foi vendido: em Intervenções psicossociais, a tabela da Conciliação; nos demais, os itens da oportunidade. */
function DetalheDaVenda({ v }: { v: VendaComDetalhe }) {
  const d = v.detalhe;
  if (!d) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-xs text-gray-500">
        O detalhe não está disponível agora: a oportunidade saiu da tela do vendedor (por exemplo, a conciliação ou o atendimento foi reaberto).
      </p>
    );
  }
  const intervencoes = [...d.intervencoes].sort(
    (a, b) => a.setor_nome.localeCompare(b.setor_nome, "pt-BR") || a.fator_nome.localeCompare(b.fator_nome, "pt-BR"),
  );
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        O que foi vendido{d.origens.length > 0 ? ` · origem: ${d.origens.join(", ")}` : ""}
      </p>
      {intervencoes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-xs">
            <thead className="text-left font-semibold text-gray-500">
              <tr>
                <th className="py-1 pr-3">Setor</th>
                <th className="py-1 pr-3">Risco</th>
                <th className="py-1 pr-3">Intervenção</th>
                <th className="py-1 pr-3">Modalidade</th>
                <th className="py-1 pr-3">Responsável</th>
                <th className="py-1">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {intervencoes.map((i, n) => {
                const novoSetor = n === 0 || intervencoes[n - 1].setor_nome !== i.setor_nome;
                const novoRisco = novoSetor || intervencoes[n - 1].fator_nome !== i.fator_nome;
                return (
                <tr key={i.id_item}>
                  <td className="py-1.5 pr-3 font-medium text-gray-900">{novoSetor ? i.setor_nome : ""}</td>
                  <td className="py-1.5 pr-3">{novoRisco ? i.fator_nome : ""}</td>
                  <td className="py-1.5 pr-3">{i.nome}</td>
                  <td className="py-1.5 pr-3">{i.modalidade ?? "—"}</td>
                  <td className="py-1.5 pr-3">{i.responsavel ?? "—"}</td>
                  <td className="py-1.5">{i.prazo_dias ? `${i.prazo_dias} ${i.prazo_dias === 1 ? "dia" : "dias"}` : "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : d.detalhes.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-gray-700">
          {d.detalhes.map((t, n) => (
            <li key={n}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">Sem itens detalhados nesta oportunidade.</p>
      )}
      {d.setoresAet.length > 0 && (
        <p className="text-xs text-gray-700">
          <span className="font-semibold">Setores para AET:</span>{" "}
          {d.setoresAet.map((s) => `${s.nome} (${s.expostos} exposto${s.expostos === 1 ? "" : "s"})`).join(", ")}
        </p>
      )}
      {d.parecer && (
        <div className="text-xs text-gray-700">
          <p className="font-semibold">Parecer da equipe</p>
          <p className="mt-0.5 whitespace-pre-line">{d.parecer}</p>
        </div>
      )}
    </div>
  );
}

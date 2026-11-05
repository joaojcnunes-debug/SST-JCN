"use client";

// Consolidação › Vendas (0.3.236, banco v323): o que o Comercial marcou como vendido. Só leitura.
// É o aviso aos setores do slide "Comercial avisa da venda": o sino atual é só da Gestão.

import { useMemo, useState } from "react";
import { BadgeCheck, Search } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useVendasComercial } from "@/lib/hooks/useComercial";
import { NOME_PRODUTO } from "@/lib/comercial/oportunidades";
import { buscar } from "@/lib/busca/texto";
import { fmtData, formatCNPJ } from "@/lib/utils";

export default function VendasPage() {
  const { data: vendas = [], isLoading, error } = useVendasComercial();
  const [busca, setBusca] = useState("");

  const linhas = useMemo(
    () => (busca.trim() ? buscar(vendas, busca, (v) => [v.nome_empresa, v.cnpj, v.municipio, v.vendido_por, NOME_PRODUTO[v.produto]]).itens : vendas),
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
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Serviço</th>
                <th className="px-3 py-2">Vendido por</th>
                <th className="w-28 px-3 py-2">Em</th>
                <th className="px-3 py-2">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((v) => (
                <tr key={`${v.id_empresa}|${v.produto}`}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-gray-900">{v.nome_empresa ?? "Empresa sem cadastro"}</span>
                    <span className="block text-xs text-gray-500">
                      {v.cnpj ? formatCNPJ(v.cnpj) : "—"}
                      {v.municipio ? ` · ${v.municipio}${v.uf ? `/${v.uf}` : ""}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{NOME_PRODUTO[v.produto] ?? v.produto}</td>
                  <td className="px-3 py-2.5 text-gray-700">{v.vendido_por}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{fmtData(v.vendido_em)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{v.observacao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

// Riscos Psicossociais — lista das empresas que têm avaliação do DRPS ou do
// Questionário na coluna "Concluídos" (ou já enviada ao cliente). Clicar abre
// a página da empresa, com os riscos por setor.
//
// Esta área NUNCA leva para as telas de Análise dos módulos: é a visão de
// resultado, não de trabalho (pedido do usuário em 2026-09-25).

import { useMemo, useState } from "react";
import Link from "next/link";
import { Brain, Building2, ChevronRight, Search } from "lucide-react";
import { useRiscosPsicossociais } from "@/lib/hooks/useRiscosPsicossociais";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { useUserStore } from "@/lib/store";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

export default function RiscosPsicossociaisPage() {
  const user = useUserStore((s) => s.user);
  const { data: empresas = [], isLoading, error } = useRiscosPsicossociais();
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(
    () =>
      busca.trim()
        ? buscar(empresas, busca, (e) => [e.nome, e.cnpj ?? "", e.municipio ?? ""]).itens
        : empresas,
    [empresas, busca]
  );

  // O menu já esconde de Cliente; isto cobre quem digitar a URL.
  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          Riscos Psicossociais
        </h1>
        <p className="text-sm text-gray-500">
          Empresas com avaliação do DRPS ou do Questionário concluída. Clique na empresa para ver os riscos
          por setor.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ ou município..."
            className={cn(inputCls, "pl-8")}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as empresas: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {empresas.length === 0
            ? "Nenhuma avaliação do DRPS ou do Questionário está na coluna Concluídos ainda."
            : "Nenhuma empresa encontrada."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {filtradas.map((e) => {
              const fontes = [...new Set(e.avaliacoes.map((a) => a.fonte))];
              const setores = e.avaliacoes.reduce((n, a) => n + a.setores.length, 0);
              const ultima = e.avaliacoes[0]?.data ?? null;
              return (
                <li key={e.idEmpresa}>
                  <Link
                    href={`/riscos-psicossociais/${encodeURIComponent(e.idEmpresa)}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50"
                  >
                    <Building2 className="size-5 shrink-0 text-verde-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-gray-900">{e.nome}</div>
                      <div className="text-xs text-gray-500">
                        {[e.cnpj ? formatCNPJ(e.cnpj) : null, e.municipio && e.uf ? `${e.municipio}/${e.uf}` : e.municipio]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="hidden items-center gap-1.5 sm:flex">
                      {fontes.map((f) => (
                        <span
                          key={f}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold",
                            f === "DRPS" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                          )}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="hidden w-24 text-right text-sm text-gray-600 md:block">
                      {setores} setor{setores !== 1 ? "es" : ""}
                    </div>
                    <div className="hidden w-28 text-right text-xs text-gray-500 md:block">
                      {ultima ? `Concluído ${fmtData(ultima)}` : ""}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-gray-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

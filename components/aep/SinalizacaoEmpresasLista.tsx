"use client";

// Lista das empresas com fatores organizacionais marcados "Sim" nas triagens
// AEP. Mesma organização da página Riscos Psicossociais (2026-10-02): clicar
// abre a página da empresa, com os setores e o nível de cada fator na matriz
// AIHA. Sem link para o editor da AEP. Usada em /sinalizacao-psicossocial
// (módulo AEP) e em /aep-psicossocial (menu do Painel SST); `basePath` diz
// para onde vai o clique na empresa.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Brain, Building2, ChevronRight, Search } from "lucide-react";
import { useAepRelatorios } from "@/lib/hooks/useAep";
import { montarSinalizacao } from "@/lib/aep/sinalizacao";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

export default function SinalizacaoEmpresasLista({
  basePath,
  titulo = "Sinalização de Fatores Psicossociais",
  extra,
}: {
  basePath: string;
  titulo?: string;
  /** Bloco opcional entre o cabeçalho e a busca (ex.: explicação da matriz). */
  extra?: ReactNode;
}) {
  const { data: relatorios = [], isLoading, error } = useAepRelatorios(null);
  const [busca, setBusca] = useState("");

  const empresas = useMemo(() => montarSinalizacao(relatorios), [relatorios]);
  const filtradas = useMemo(
    () => (busca.trim() ? buscar(empresas, busca, (e) => [e.nome, e.cnpj ?? ""]).itens : empresas),
    [empresas, busca],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          {titulo}
        </h1>
        <p className="text-sm text-gray-500">
          Empresas com fatores organizacionais identificados nas triagens AEP, com o nível na matriz AIHA. Clique na
          empresa para ver os fatores por setor.
        </p>
      </div>

      {extra}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa ou CNPJ..."
            className={cn(inputCls, "pl-8")}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as análises: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {empresas.length === 0 ? "Nenhum fator psicossocial sinalizado nas análises AEP." : "Nenhuma empresa encontrada."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {filtradas.map((e) => (
              <li key={e.idEmpresa}>
                <Link
                  href={`${basePath}/${encodeURIComponent(e.idEmpresa)}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50"
                >
                  <Building2 className="size-5 shrink-0 text-verde-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-gray-900">{e.nome}</div>
                    <div className="text-xs text-gray-500">{e.cnpj ? formatCNPJ(e.cnpj) : "—"}</div>
                  </div>
                  <div className="hidden sm:block" title="Maior nível AIHA entre os fatores da empresa">
                    <SeloNivelAiha nivel={e.pior} />
                  </div>
                  <div className="hidden w-24 text-right text-sm text-gray-600 md:block">
                    {e.totalAlertas} alerta{e.totalAlertas !== 1 ? "s" : ""}
                  </div>
                  <div className="hidden w-24 text-right text-sm text-gray-600 md:block">
                    {e.totalSetores} setor{e.totalSetores !== 1 ? "es" : ""}
                  </div>
                  <div className="hidden w-28 text-right text-xs text-gray-500 md:block">
                    {e.ultimaData ? `AEP ${fmtData(e.ultimaData)}` : ""}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

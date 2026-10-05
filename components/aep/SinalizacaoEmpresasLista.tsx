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
import { useAepsEntregues, useSituacaoQuestionarioEmpresas } from "@/lib/hooks/useAep";
import { useUnidades } from "@/lib/hooks/useUnidades";
import type { SituacaoQuestionario } from "@/lib/aep/sinalizacao";
import { montarSinalizacao } from "@/lib/aep/sinalizacao";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

/** O que a empresa já tem de DRPS/Questionário, embaixo do "Necessário". */
function JaTem({ s }: { s: SituacaoQuestionario | undefined }) {
  if (!s) return null;
  if (s.fase === "concluido")
    return <div className="mt-0.5 text-[10px] font-medium text-emerald-700">{s.doc} concluído</div>;
  if (s.fase === "andamento")
    return <div className="mt-0.5 text-[10px] font-medium text-sky-700">{s.doc} em andamento</div>;
  return <div className="mt-0.5 text-[10px] text-gray-400">Nenhum feito</div>;
}

/** "Necessário" (âmbar) ou "Não" (cinza). */
function Indicacao({ sim }: { sim: boolean }) {
  return sim ? (
    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      Necessário
    </span>
  ) : (
    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">Não</span>
  );
}

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
  const { data: relatorios = [], isLoading, error } = useAepsEntregues(null);
  const [busca, setBusca] = useState("");

  const empresas = useMemo(() => montarSinalizacao(relatorios), [relatorios]);
  const { data: unidades = [] } = useUnidades();
  const nomeUnidade = useMemo(() => new Map(unidades.map((u) => [u.id_unidade, u.nome])), [unidades]);
  const { data: questionarios } = useSituacaoQuestionarioEmpresas(empresas.map((e) => e.idEmpresa));
  const regiao = (e: { municipio: string | null; uf: string | null }) =>
    [e.municipio, e.uf].filter(Boolean).join("/") || null;
  const filtradas = useMemo(
    () =>
      busca.trim()
        ? buscar(empresas, busca, (e) => [
            e.nome,
            e.cnpj ?? "",
            (e.idUnidade && nomeUnidade.get(e.idUnidade)) || "",
            e.municipio ?? "",
            e.uf ?? "",
          ]).itens
        : empresas,
    [empresas, busca, nomeUnidade],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          {titulo}
        </h1>
        <p className="text-sm text-gray-500">
          Empresas com fatores organizacionais identificados nas AEPs já entregues ao cliente (documento da inspeção
          concluído pelo associado), com o nível na matriz AIHA. Clique na empresa para ver os fatores por setor.
        </p>
      </div>

      {extra}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ, unidade ou município..."
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
          {empresas.length === 0 ? "Nenhum fator psicossocial sinalizado em AEP entregue ao cliente." : "Nenhuma empresa encontrada."}
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
                    <div className="truncate text-[11px] text-gray-500">
                      <span className="font-medium text-gray-600">Unidade:</span>{" "}
                      {(e.idUnidade && nomeUnidade.get(e.idUnidade)) || "—"}
                      <span className="mx-1 text-gray-300">·</span>
                      <span className="font-medium text-gray-600">Região:</span> {regiao(e) ?? "—"}
                    </div>
                  </div>
                  <div className="hidden w-28 lg:block" title="3+ alertas organizacionais na AEP recomendam DRPS/Questionário Psicossocial (NR-01)">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">DRPS/Questionário</div>
                    <Indicacao sim={e.precisaQuestionario} />
                    <JaTem s={questionarios?.[e.idEmpresa]} />
                  </div>
                  <div className="hidden w-20 lg:block" title="Algum setor com indicação de Análise Ergonômica do Trabalho">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">AET</div>
                    <Indicacao sim={e.precisaAet} />
                  </div>
                  <div className="hidden w-36 lg:block">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Realizada por</div>
                    <div className="truncate text-xs text-gray-700" title={e.realizadaPor ?? undefined}>
                      {e.realizadaPor ?? "—"}
                    </div>
                  </div>
                  <div className="hidden w-36 lg:block">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Enviada por</div>
                    <div className="truncate text-xs text-gray-700" title={e.enviadoPor ?? undefined}>
                      {e.temInspecao ? (e.enviadoPor ?? "—") : <span className="text-gray-400">Sem inspeção</span>}
                    </div>
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
                    {e.ultimaData ? `Entregue ${fmtData(e.ultimaData)}` : ""}
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

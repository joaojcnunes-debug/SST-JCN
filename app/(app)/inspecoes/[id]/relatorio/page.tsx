"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Shield } from "lucide-react";
import { useInspecao } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import NivelBadge from "@/components/riscos/NivelBadge";
import { fmtData, fmtDataHora, formatCNPJ } from "@/lib/utils";
import {
  CATEGORIAS_FOTO,
  CATEGORIA_FOTO_ICONE,
  NIVEIS_RISCO,
  NIVEL_CONFIG,
  TIPOS_RISCO,
  TIPO_ICONE,
} from "@/lib/constants";
import type {
  CategoriaFoto,
  Foto,
  NivelRisco,
  Risco,
  TipoRisco,
} from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RelatorioPage({ params }: Props) {
  const { id } = use(params);
  const { data, isLoading } = useInspecao(id);
  const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);

  const contagem = useMemo(() => {
    const acc: Record<string, number> = {
      Trivial: 0,
      Baixo: 0,
      Moderado: 0,
      Alto: 0,
      "Muito Alto": 0,
    };
    for (const r of data?.riscos ?? []) {
      const n = r.nivel_risco ?? "Baixo";
      acc[n] = (acc[n] ?? 0) + 1;
    }
    return acc;
  }, [data]);

  const riscosPorTipo = useMemo(() => {
    const acc = new Map<TipoRisco, Risco[]>();
    for (const r of data?.riscos ?? []) {
      const arr = acc.get(r.tipo_risco) ?? [];
      arr.push(r);
      acc.set(r.tipo_risco, arr);
    }
    return acc;
  }, [data]);

  const fotosPorCategoria = useMemo(() => {
    const acc = new Map<CategoriaFoto, Foto[]>();
    for (const f of data?.fotos ?? []) {
      const arr = acc.get(f.categoria) ?? [];
      arr.push(f);
      acc.set(f.categoria, arr);
    }
    return acc;
  }, [data]);

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (!data) return null;

  const { inspecao, setores, cargos, riscos, epis, responsaveis } = data;
  const setorMap = new Map(setores.map((s) => [s.id_setor, s.setor_ghe]));
  const cargoMap = new Map(cargos.map((c) => [c.id_cargo, c.cargo]));

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/inspecoes/${id}`}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Voltar ao editor
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          <Printer className="size-4" />
          Imprimir / Exportar PDF
        </button>
      </div>

      <article className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <header className="flex flex-col items-start justify-between gap-3 border-b border-gray-200 pb-4 md:flex-row">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-verde-primary text-white">
              <Shield className="size-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Relatório de Inspeção SST
              </p>
              <h1 className="text-2xl font-bold text-gray-900">
                {empresa?.nome_empresa ?? "—"}
              </h1>
              <p className="text-sm text-gray-600">
                {empresa?.razao_social && <>{empresa.razao_social} · </>}
                CNPJ: {formatCNPJ(empresa?.cnpj)}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>
              <span className="text-gray-500">ID: </span>
              <span className="font-mono">{inspecao.id_inspecao}</span>
            </p>
            <p>
              <span className="text-gray-500">Revisão: </span>
              <strong>{inspecao.revisao}</strong>
            </p>
            <p>
              <span className="text-gray-500">Data: </span>
              {fmtData(inspecao.data_inspecao)}
            </p>
            <p>
              <span className="text-gray-500">Status: </span>
              {inspecao.status}
            </p>
          </div>
        </header>

        {/* Resumo de riscos */}
        <section className="print-avoid-break">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Resumo dos Riscos Identificados
          </h2>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {NIVEIS_RISCO.map((n) => (
              <div
                key={n}
                className="rounded-lg border p-3 text-center"
                style={{
                  borderColor: NIVEL_CONFIG[n].borda,
                  backgroundColor: NIVEL_CONFIG[n].bg,
                }}
              >
                <p
                  className="text-xs font-medium"
                  style={{ color: NIVEL_CONFIG[n].cor }}
                >
                  {n}
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: NIVEL_CONFIG[n].cor }}
                >
                  {contagem[n] ?? 0}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Total de riscos avaliados: <strong>{riscos.length}</strong> ·
            Setores: <strong>{setores.length}</strong> · Cargos:{" "}
            <strong>{cargos.length}</strong>
          </p>
        </section>

        {/* Riscos por tipo */}
        {TIPOS_RISCO.filter((t) => riscosPorTipo.has(t)).map((tipo) => {
          const lista = riscosPorTipo.get(tipo) ?? [];
          return (
            <section key={tipo} className="print-avoid-break">
              <h2 className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">
                <span>{TIPO_ICONE[tipo] ?? "•"}</span>
                Riscos {tipo} ({lista.length})
              </h2>
              <div className="space-y-3">
                {lista.map((r) => (
                  <div
                    key={r.id_risco}
                    className="rounded-lg border border-gray-200 p-3 print-avoid-break"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {r.agente ?? "—"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {r.id_setor ? setorMap.get(r.id_setor) : "—"}
                          {r.id_cargo && (
                            <>
                              {" · "}
                              {cargoMap.get(r.id_cargo) ?? ""}
                            </>
                          )}
                        </p>
                      </div>
                      <NivelBadge nivel={(r.nivel_risco as NivelRisco) ?? "Baixo"} />
                    </div>
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      {r.fonte_geradora && (
                        <Pair label="Fonte geradora" value={r.fonte_geradora} />
                      )}
                      {r.probabilidade && (
                        <Pair label="Probabilidade" value={r.probabilidade} />
                      )}
                      {r.severidade && (
                        <Pair label="Severidade" value={r.severidade} />
                      )}
                      {r.tempo_exposicao && (
                        <Pair
                          label="Tempo de exposição"
                          value={r.tempo_exposicao}
                        />
                      )}
                    </dl>
                    {r.medidas_adotadas && (
                      <p className="mt-2 text-xs">
                        <span className="font-medium text-gray-700">
                          Medidas adotadas:
                        </span>{" "}
                        {r.medidas_adotadas}
                      </p>
                    )}
                    {r.medidas_recomendadas && (
                      <p className="mt-1 text-xs">
                        <span className="font-medium text-gray-700">
                          Medidas recomendadas:
                        </span>{" "}
                        {r.medidas_recomendadas}
                      </p>
                    )}
                    {(() => {
                      const eps = epis.filter((e) => e.id_risco === r.id_risco);
                      if (eps.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700">
                            EPIs/EPCs:
                          </p>
                          <ul className="mt-1 list-disc pl-5 text-xs text-gray-700">
                            {eps.map((e) => (
                              <li key={e.id_protecao}>
                                <span className="font-medium">{e.tipo}</span> ·{" "}
                                {e.descricao}
                                {e.ca && <> · CA: {e.ca}</>}
                                {e.recomendado && <> · {e.recomendado}</>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Fotos */}
        {data.fotos.length > 0 && (
          <section className="print-avoid-break">
            <h2 className="mb-3 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">
              Registro Fotográfico
            </h2>
            {CATEGORIAS_FOTO.filter((c) => fotosPorCategoria.has(c)).map((cat) => {
              const lista = fotosPorCategoria.get(cat) ?? [];
              return (
                <div key={cat} className="mb-4 print-avoid-break">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    {CATEGORIA_FOTO_ICONE[cat]} {cat} ({lista.length})
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {lista.map((f) => (
                      <figure
                        key={f.id_foto}
                        className="overflow-hidden rounded-lg border border-gray-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.arquivo_foto}
                          alt={f.legenda ?? cat}
                          className="aspect-square w-full object-cover"
                        />
                        {f.legenda && (
                          <figcaption className="p-1.5 text-[11px] text-gray-700">
                            {f.legenda}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Responsáveis */}
        {responsaveis.length > 0 && (
          <section className="print-avoid-break">
            <h2 className="mb-3 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">
              Responsáveis
            </h2>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Técnico SST</th>
                  <th className="px-2 py-1.5 text-left font-medium">
                    Recepcionado por
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium">Cargo</th>
                  <th className="px-2 py-1.5 text-left font-medium">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {responsaveis.map((r) => (
                  <tr key={r.id_responsavel}>
                    <td className="px-2 py-1.5">{r.tecnico_responsavel ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.recepcionado_por ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.cargo ?? "—"}</td>
                    <td className="px-2 py-1.5">{fmtDataHora(r.data_hora)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {inspecao.observacoes && (
          <section className="print-avoid-break">
            <h2 className="mb-2 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">
              Observações Gerais
            </h2>
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {inspecao.observacoes}
            </p>
          </section>
        )}
      </article>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}

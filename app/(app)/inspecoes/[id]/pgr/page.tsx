"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Shield } from "lucide-react";
import { useInspecao } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import NivelBadge from "@/components/riscos/NivelBadge";
import { fmtData, fmtDataHora, formatCNPJ } from "@/lib/utils";
import { NIVEIS_RISCO, NIVEL_CONFIG } from "@/lib/constants";
import type { EpiEpc, NivelRisco } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PgrPage({ params }: Props) {
  const { id } = use(params);
  const { data, isLoading } = useInspecao(id);
  const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);
  const { data: configs } = useConfiguracoes();

  const setorMap = useMemo(
    () => new Map((data?.setores ?? []).map((s) => [s.id_setor, s])),
    [data]
  );
  const cargoMap = useMemo(
    () => new Map((data?.cargos ?? []).map((c) => [c.id_cargo, c])),
    [data]
  );

  const episPorRisco = useMemo(() => {
    const m = new Map<string, EpiEpc[]>();
    for (const e of data?.epis ?? []) {
      const arr = m.get(e.id_risco) ?? [];
      arr.push(e);
      m.set(e.id_risco, arr);
    }
    return m;
  }, [data]);

  // Inventário ordenado por Setor → Cargo → Tipo de Risco.
  const inventario = useMemo(() => {
    return [...(data?.riscos ?? [])].sort((a, b) => {
      const sA = a.id_setor ? setorMap.get(a.id_setor)?.setor_ghe ?? "" : "";
      const sB = b.id_setor ? setorMap.get(b.id_setor)?.setor_ghe ?? "" : "";
      if (sA !== sB) return sA.localeCompare(sB);
      const cA = a.id_cargo ? cargoMap.get(a.id_cargo)?.cargo ?? "" : "";
      const cB = b.id_cargo ? cargoMap.get(b.id_cargo)?.cargo ?? "" : "";
      if (cA !== cB) return cA.localeCompare(cB);
      return a.tipo_risco.localeCompare(b.tipo_risco);
    });
  }, [data, setorMap, cargoMap]);

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

  // Plano de Ação: apenas riscos com medidas recomendadas.
  const planoAcao = useMemo(
    () => inventario.filter((r) => (r.medidas_recomendadas ?? "").trim() !== ""),
    [inventario]
  );

  if (isLoading) return <LoadingSkeleton rows={10} />;
  if (!data) return null;

  const { inspecao, responsaveis } = data;

  return (
    <div className="space-y-4">
      {/* Toolbar (não imprime) */}
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/inspecoes/${id}`}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Voltar ao editor
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/inspecoes/${id}/relatorio`}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Relatório resumido
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
      </div>

      {/* CSS de impressão paisagem A4 */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
          body { font-size: 9pt; }
          .pgr-table { font-size: 8pt; }
          .pgr-table th, .pgr-table td { padding: 4px 6px !important; }
        }
      `}</style>

      <article className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 print:border-0 print:p-0 print:shadow-none">
        {/* HEADER PGR */}
        <header className="flex items-start justify-between gap-3 border-b-2 border-verde-primary pb-3">
          <div className="flex items-start gap-3">
            {configs?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={configs.logo_url}
                alt="Logo"
                className="max-h-16 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-xl bg-verde-primary text-white">
                <Shield className="size-7" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-verde-primary">
                PGR — Programa de Gerenciamento de Riscos
              </p>
              <p className="text-xs text-gray-500">
                Inventário de Riscos Ocupacionais (NR-01 / GRO)
              </p>
              <h1 className="mt-1 text-xl font-bold text-gray-900">
                {empresa?.nome_empresa ?? "—"}
              </h1>
              <p className="text-xs text-gray-600">
                {empresa?.razao_social && <>{empresa.razao_social} · </>}
                CNPJ: {formatCNPJ(empresa?.cnpj)} · Grau de Risco (NR-04):{" "}
                <strong>{empresa?.grau_risco ?? "—"}</strong>
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-700">
            <p>
              <span className="text-gray-500">Documento:</span>{" "}
              <span className="font-mono">{inspecao.id_inspecao}</span>
            </p>
            <p>
              <span className="text-gray-500">Revisão:</span>{" "}
              <strong>{inspecao.revisao}</strong>
            </p>
            <p>
              <span className="text-gray-500">Data:</span>{" "}
              {fmtData(inspecao.data_inspecao)}
            </p>
            <p>
              <span className="text-gray-500">Status:</span> {inspecao.status}
            </p>
          </div>
        </header>

        {/* RESUMO POR NÍVEL */}
        <section className="print-avoid-break">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700">
            1. Resumo Quantitativo
          </h2>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {NIVEIS_RISCO.map((n) => (
              <div
                key={n}
                className="rounded-md border p-2 text-center"
                style={{
                  borderColor: NIVEL_CONFIG[n].borda,
                  backgroundColor: NIVEL_CONFIG[n].bg,
                }}
              >
                <p
                  className="text-[10px] font-medium uppercase"
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
          <p className="mt-2 text-xs text-gray-600">
            Total: <strong>{inventario.length}</strong> riscos identificados em{" "}
            <strong>{data.setores.length}</strong> setor(es) e{" "}
            <strong>{data.cargos.length}</strong> cargo(s).
          </p>
        </section>

        {/* INVENTÁRIO DE RISCOS — tabelão NR-01 */}
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700">
            2. Inventário de Riscos
          </h2>
          {inventario.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
              Nenhum risco registrado neste inventário.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-300">
              <table className="pgr-table w-full text-xs">
                <thead className="bg-verde-primary text-white">
                  <tr>
                    <Th>Setor / GHE</Th>
                    <Th>Cargo / Função</Th>
                    <Th>Tipo</Th>
                    <Th>Perigo / Agente</Th>
                    <Th>Fonte Geradora</Th>
                    <Th>Tempo Exp.</Th>
                    <Th>Meio</Th>
                    <Th>Téc.</Th>
                    <Th>Probab.</Th>
                    <Th>Severid.</Th>
                    <Th>Nível</Th>
                    <Th>Medidas Existentes</Th>
                    <Th>EPIs / EPCs</Th>
                    <Th>Medidas Recomendadas</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventario.map((r, idx) => {
                    const setor = r.id_setor ? setorMap.get(r.id_setor) : null;
                    const cargo = r.id_cargo ? cargoMap.get(r.id_cargo) : null;
                    const eps = episPorRisco.get(r.id_risco) ?? [];
                    return (
                      <tr
                        key={r.id_risco}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <Td className="font-medium">
                          {setor?.setor_ghe ?? "—"}
                        </Td>
                        <Td>{cargo?.cargo ?? "—"}</Td>
                        <Td>{r.tipo_risco}</Td>
                        <Td className="font-medium">{r.agente ?? "—"}</Td>
                        <Td>{r.fonte_geradora ?? "—"}</Td>
                        <Td>{r.tempo_exposicao ?? "—"}</Td>
                        <Td>{r.meio_propagacao ?? "—"}</Td>
                        <Td>{r.tecnica_utilizada ?? "—"}</Td>
                        <Td>{r.probabilidade ?? "—"}</Td>
                        <Td>{r.severidade ?? "—"}</Td>
                        <Td>
                          <NivelBadge
                            nivel={(r.nivel_risco as NivelRisco) ?? "Baixo"}
                          />
                        </Td>
                        <Td>{r.medidas_adotadas ?? "—"}</Td>
                        <Td>
                          {eps.length === 0 ? (
                            "—"
                          ) : (
                            <ul className="list-disc pl-3">
                              {eps.map((e) => (
                                <li key={e.id_protecao}>
                                  <strong>{e.tipo}</strong> · {e.descricao}
                                  {e.ca && <> · CA {e.ca}</>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </Td>
                        <Td>{r.medidas_recomendadas ?? "—"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* DETALHAMENTO POR RISCO (campos específicos + perguntas custom) */}
        {inventario.length > 0 && (
          <section className="print-break">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700">
              3. Detalhamento Adicional por Risco
            </h2>
            <div className="space-y-2">
              {inventario.map((r) => {
                const setor = r.id_setor ? setorMap.get(r.id_setor) : null;
                const cargo = r.id_cargo ? cargoMap.get(r.id_cargo) : null;
                // Filtra campos específicos não vazios.
                const detalhes: Array<[string, string]> = [];
                if (r.tipo_risco === "Físico") {
                  if (r.fisico_necessita_medicao)
                    detalhes.push([
                      "Necessita medição",
                      r.fisico_necessita_medicao,
                    ]);
                  if (r.fisico_qual_medicao)
                    detalhes.push(["Qual medição", r.fisico_qual_medicao]);
                  if (r.fisico_motivo_medicao)
                    detalhes.push(["Motivo", r.fisico_motivo_medicao]);
                  if (r.concentracao_exposicao)
                    detalhes.push([
                      "Concentração / Nível medido",
                      r.concentracao_exposicao,
                    ]);
                  if (r.limite_tolerancia)
                    detalhes.push(["LT", r.limite_tolerancia]);
                  if (r.insalubridade)
                    detalhes.push(["Insalubridade", r.insalubridade]);
                }
                if (r.tipo_risco === "Químico") {
                  if (r.numero_cas)
                    detalhes.push(["Número CAS", r.numero_cas]);
                  if (r.via_absorcao)
                    detalhes.push(["Via de absorção", r.via_absorcao]);
                  if (r.uso_processo)
                    detalhes.push(["Uso / Processo", r.uso_processo]);
                  if (r.periculosidade)
                    detalhes.push(["Periculosidade", r.periculosidade]);
                  for (let i = 1; i <= 6; i++) {
                    const k = `quim_q${i}` as keyof typeof r;
                    const v = r[k];
                    if (v) detalhes.push([`Q${i}`, String(v)]);
                  }
                }
                if (r.tipo_risco === "Biológico" && r.tipo_agente_biologico)
                  detalhes.push(["Agente biológico", r.tipo_agente_biologico]);
                if (r.tipo_risco === "Ergonômico" && r.fator_ergonomico)
                  detalhes.push(["Fator ergonômico", r.fator_ergonomico]);
                if (r.tipo_risco === "Psicossocial" && r.fator_psicossocial)
                  detalhes.push(["Fator psicossocial", r.fator_psicossocial]);
                if (r.tipo_risco.startsWith("IAPAT") && r.pontuacao_iapat)
                  detalhes.push(["Pontuação IAPAT", r.pontuacao_iapat]);

                // V3: respostas customizadas (perguntas configuráveis pelo Admin)
                const customs = r.respostas_custom ?? {};
                for (const [k, v] of Object.entries(customs)) {
                  if (v) detalhes.push([k, String(v)]);
                }

                if (
                  detalhes.length === 0 &&
                  !r.observacoes_risco &&
                  !r.foto_quim_url
                )
                  return null;

                return (
                  <div
                    key={r.id_risco}
                    className="rounded-md border border-gray-200 bg-white p-2.5 print-avoid-break"
                  >
                    <p className="mb-1.5 text-xs font-semibold text-gray-900">
                      {r.tipo_risco} · {r.agente ?? "—"}{" "}
                      <span className="font-normal text-gray-500">
                        ({setor?.setor_ghe ?? "—"}
                        {cargo && ` · ${cargo.cargo}`})
                      </span>
                    </p>
                    {detalhes.length > 0 && (
                      <dl className="grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-2">
                        {detalhes.map(([k, v]) => (
                          <div key={k}>
                            <span className="text-gray-500">{k}:</span>{" "}
                            <span className="text-gray-800">{v}</span>
                          </div>
                        ))}
                      </dl>
                    )}
                    {r.foto_quim_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.foto_quim_url}
                        alt="FDS"
                        className="mt-1.5 max-h-24 rounded border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {r.observacoes_risco && (
                      <p className="mt-1.5 text-xs italic text-gray-600">
                        Obs.: {r.observacoes_risco}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PLANO DE AÇÃO */}
        <section className="print-avoid-break">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700">
            4. Plano de Ação (Medidas Recomendadas)
          </h2>
          {planoAcao.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-center text-xs text-gray-500">
              Nenhuma medida recomendada cadastrada.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-300">
              <table className="w-full text-xs">
                <thead className="bg-amber-50 text-amber-900">
                  <tr>
                    <Th className="text-amber-900">Setor</Th>
                    <Th className="text-amber-900">Cargo</Th>
                    <Th className="text-amber-900">Risco</Th>
                    <Th className="text-amber-900">Nível</Th>
                    <Th className="text-amber-900">Medida Recomendada</Th>
                    <Th className="text-amber-900">Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {planoAcao.map((r, idx) => (
                    <tr
                      key={r.id_risco}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <Td>
                        {r.id_setor
                          ? setorMap.get(r.id_setor)?.setor_ghe ?? "—"
                          : "—"}
                      </Td>
                      <Td>
                        {r.id_cargo
                          ? cargoMap.get(r.id_cargo)?.cargo ?? "—"
                          : "—"}
                      </Td>
                      <Td className="font-medium">
                        {r.tipo_risco} · {r.agente ?? "—"}
                      </Td>
                      <Td>
                        <NivelBadge
                          nivel={(r.nivel_risco as NivelRisco) ?? "Baixo"}
                        />
                      </Td>
                      <Td>{r.medidas_recomendadas}</Td>
                      <Td>{r.situacao ?? "Pendente"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* RESPONSÁVEIS */}
        {responsaveis.length > 0 && (
          <section className="print-avoid-break">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700">
              5. Responsáveis
            </h2>
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <Th>Técnico SST</Th>
                  <Th>Recepcionado por</Th>
                  <Th>Cargo</Th>
                  <Th>Data/Hora</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {responsaveis.map((r) => (
                  <tr key={r.id_responsavel}>
                    <Td>{r.tecnico_responsavel ?? "—"}</Td>
                    <Td>{r.recepcionado_por ?? "—"}</Td>
                    <Td>{r.cargo ?? "—"}</Td>
                    <Td>{fmtDataHora(r.data_hora)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* OBSERVAÇÕES */}
        {inspecao.observacoes && (
          <section className="print-avoid-break">
            <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wider text-gray-700">
              6. Observações Gerais
            </h2>
            <p className="whitespace-pre-wrap text-xs text-gray-700">
              {inspecao.observacoes}
            </p>
          </section>
        )}

        {/* RODAPÉ */}
        <footer className="border-t border-gray-200 pt-2 text-center text-[10px] text-gray-500 print-avoid-break">
          Documento gerado em {fmtDataHora(new Date())} pelo Painel SST Chabra
          · NR-01 / GRO · Inventário de Riscos
        </footer>
      </article>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider ${
        className ?? ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-2 py-1.5 align-top text-gray-700 ${className ?? ""}`}>
      {children}
    </td>
  );
}

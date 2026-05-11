"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Camera,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Clock,
  Wrench,
  ListChecks,
} from "lucide-react";
import { useInspecao } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import NivelBadge from "@/components/riscos/NivelBadge";
import {
  fmtData,
  fmtDataHora,
  formatCNPJ,
  parseMedidas,
} from "@/lib/utils";
import { NIVEL_CONFIG } from "@/lib/constants";
import { useTipoIcone } from "@/lib/hooks/useV3";
import type {
  EpiEpc,
  Foto,
  NivelRisco,
  PaeContato,
  Risco,
  Setor,
  Cargo,
} from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RelatorioChabraPage({ params }: Props) {
  const { id } = use(params);
  const { data, isLoading } = useInspecao(id);
  const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);
  const { data: configs } = useConfiguracoes();
  const iconeDe = useTipoIcone();

  const ctx = useMemo(() => {
    if (!data) return null;
    const setoresOrdenados = [...data.setores].sort((a, b) =>
      a.setor_ghe.localeCompare(b.setor_ghe)
    );
    const naoConformes = data.setores.filter(
      (s) => (s.nao_conformidade ?? "").trim() !== ""
    ).length;

    // Contagens globais
    const porNivel: Record<string, number> = {
      Trivial: 0,
      Baixo: 0,
      Moderado: 0,
      Alto: 0,
      "Muito Alto": 0,
    };
    const porTipo: Record<string, number> = {};
    for (const r of data.riscos) {
      const n = r.nivel_risco ?? "Baixo";
      porNivel[n] = (porNivel[n] ?? 0) + 1;
      porTipo[r.tipo_risco] = (porTipo[r.tipo_risco] ?? 0) + 1;
    }

    // EPIs por risco (acesso O(1))
    const episPorRisco = new Map<string, EpiEpc[]>();
    for (const e of data.epis) {
      const arr = episPorRisco.get(e.id_risco) ?? [];
      arr.push(e);
      episPorRisco.set(e.id_risco, arr);
    }

    // Riscos por setor → tipo
    const riscosPorSetor = new Map<string, Map<string, Risco[]>>();
    for (const r of data.riscos) {
      const idSet = r.id_setor ?? "_sem_setor";
      const porTipoMap =
        riscosPorSetor.get(idSet) ?? new Map<string, Risco[]>();
      const lista = porTipoMap.get(r.tipo_risco) ?? [];
      lista.push(r);
      porTipoMap.set(r.tipo_risco, lista);
      riscosPorSetor.set(idSet, porTipoMap);
    }

    // Cargos por setor
    const cargosPorSetor = new Map<string, Cargo[]>();
    for (const c of data.cargos) {
      const arr = cargosPorSetor.get(c.id_setor) ?? [];
      arr.push(c);
      cargosPorSetor.set(c.id_setor, arr);
    }

    // Fotos por setor
    const fotosPorSetor = new Map<string, Foto[]>();
    const fotosGerais: Foto[] = [];
    for (const f of data.fotos) {
      if (f.id_setor) {
        const arr = fotosPorSetor.get(f.id_setor) ?? [];
        arr.push(f);
        fotosPorSetor.set(f.id_setor, arr);
      } else {
        fotosGerais.push(f);
      }
    }

    return {
      setores: setoresOrdenados,
      naoConformes,
      porNivel,
      porTipo,
      episPorRisco,
      riscosPorSetor,
      cargosPorSetor,
      fotosPorSetor,
      fotosGerais,
    };
  }, [data]);

  if (isLoading) return <LoadingSkeleton rows={10} />;
  if (!data || !ctx) return null;

  const { inspecao, responsaveis, paeContatos } = data;
  const dataInspFmt = fmtData(inspecao.data_inspecao);

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
            href={`/inspecoes/${id}/pgr`}
            className="rounded-md border border-amber-warning bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-warning hover:bg-amber-100"
          >
            Versão PGR (NR-1)
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

      {/* CSS de impressão */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { font-size: 10pt; }
          .capa-page { page-break-after: always; min-height: 100vh; }
          .secao-setor { page-break-inside: avoid; }
          .risco-card { page-break-inside: avoid; }
        }
      `}</style>

      <article className="rounded-xl border border-gray-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* ============================================================
            CAPA (página 1)
        ============================================================ */}
        <section className="capa-page relative overflow-hidden">
          {/* Faixa verde lateral */}
          <div className="absolute left-0 top-0 h-full w-3 bg-verde-dark print:w-4" />
          <div className="absolute left-3 top-0 h-full w-1 bg-verde-primary print:left-4" />

          <div className="grid min-h-[800px] grid-cols-2 gap-8 p-12 pl-16 md:p-16 md:pl-20">
            {/* Esquerda */}
            <div className="flex flex-col justify-center">
              <h1 className="text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
                RELATÓRIO DE INSPEÇÃO
                <span className="block text-verde-primary">SST</span>
              </h1>
              <p className="mt-4 text-base text-gray-600">
                Saúde e Segurança do Trabalho
              </p>

              <div className="mt-8 rounded-lg border-2 border-verde-border bg-verde-light/50 p-5">
                <p className="text-sm font-bold uppercase tracking-wide text-verde-dark">
                  {empresa?.nome_empresa ?? "—"}
                </p>
                <p className="mt-1 text-xs text-gray-700">
                  CNPJ: {formatCNPJ(empresa?.cnpj)}
                </p>
              </div>

              <p className="mt-6 text-sm text-gray-700">
                Data da inspeção:{" "}
                <strong className="text-gray-900">{dataInspFmt}</strong>
              </p>
            </div>

            {/* Direita: logo */}
            <div className="flex flex-col items-end justify-center">
              {configs?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={configs.logo_url}
                  alt="Logo Chabra"
                  className="max-h-44 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex size-32 items-center justify-center rounded-3xl bg-red-alert text-white shadow-lg">
                    <ShieldCheck className="size-16" strokeWidth={1.5} />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold tracking-tight text-red-alert">
                    Chabra
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-600">
                    Segurança e Medicina do Trabalho
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé da capa */}
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[10px] text-gray-500">
            Documento gerado em {fmtDataHora(new Date())} · Chabra Saúde e
            Segurança do Trabalho
          </p>
        </section>

        {/* ============================================================
            PÁGINA 2: Identificação + Resumo Geral
        ============================================================ */}
        <section className="border-t border-gray-200 px-8 py-8 md:px-12">
          {/* Header verde compacto repetido */}
          <header className="mb-6 border-b-2 border-verde-primary pb-3">
            <h2 className="text-base font-bold tracking-tight text-verde-primary">
              RELATÓRIO DE INSPEÇÃO SST
            </h2>
            <p className="text-[11px] text-gray-600">
              <strong>{empresa?.nome_empresa}</strong> · CNPJ{" "}
              {formatCNPJ(empresa?.cnpj)} · Inspeção de {dataInspFmt}
            </p>
          </header>

          {/* Identificação da Empresa */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <span className="text-base">🏢</span>
              Identificação da Empresa
            </h3>
            <dl className="grid gap-y-2 text-sm md:grid-cols-2">
              {empresa?.razao_social && (
                <Item label="Razão Social" value={empresa.razao_social} />
              )}
              <Item label="CNPJ" value={formatCNPJ(empresa?.cnpj)} />
              <Item
                label="Data da Inspeção"
                value={`${dataInspFmt}${
                  inspecao.created_at
                    ? ` às ${new Date(inspecao.created_at).toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" }
                      )}`
                    : ""
                }`}
              />
              {inspecao.usuario && (
                <Item label="Cadastrado por" value={inspecao.usuario} />
              )}
              {empresa?.grau_risco && (
                <Item
                  label="Grau de Risco (NR-04)"
                  value={`Grau ${empresa.grau_risco}`}
                />
              )}
              <Item label="Revisão" value={`Rev. ${inspecao.revisao}`} />
            </dl>
          </div>

          {/* Resumo Geral */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <span className="text-base">📊</span>
              Resumo Geral
            </h3>

            {/* 4 cards numéricos */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <CardNumero
                label="Setores"
                valor={data.setores.length}
                cor="#475569"
                bg="#f1f5f9"
              />
              <CardNumero
                label="Cargos"
                valor={data.cargos.length}
                cor="#475569"
                bg="#f1f5f9"
              />
              <CardNumero
                label="Riscos"
                valor={data.riscos.length}
                cor="#475569"
                bg="#f1f5f9"
              />
              <CardNumero
                label="Não Conformes"
                valor={ctx.naoConformes}
                cor={ctx.naoConformes > 0 ? "#ffffff" : "#ffffff"}
                bg={ctx.naoConformes > 0 ? "#D32F2F" : "#006B54"}
                destacado
              />
            </div>

            {/* Por nível */}
            {data.riscos.length > 0 && (
              <>
                <p className="mt-4 mb-1.5 text-xs font-bold text-gray-700">
                  Por nível
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ctx.porNivel)
                    .filter(([, v]) => v > 0)
                    .map(([nivel, count]) => {
                      const cfg =
                        NIVEL_CONFIG[nivel as NivelRisco] ?? NIVEL_CONFIG.Baixo;
                      return (
                        <span
                          key={nivel}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                          style={{
                            color: cfg.cor,
                            backgroundColor: cfg.bg,
                            borderColor: cfg.borda,
                          }}
                        >
                          {nivel}: <strong>{count}</strong>
                        </span>
                      );
                    })}
                </div>
              </>
            )}

            {/* Por categoria */}
            {Object.keys(ctx.porTipo).length > 0 && (
              <>
                <p className="mt-3 mb-1.5 text-xs font-bold text-gray-700">
                  Por categoria
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ctx.porTipo).map(([tipo, count]) => (
                    <span
                      key={tipo}
                      className="inline-flex items-center gap-1 rounded-full border border-verde-border bg-verde-light px-2 py-0.5 text-xs font-medium text-verde-dark"
                    >
                      <span>{iconeDe(tipo)}</span>
                      {tipo}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ============================================================
            POR SETOR
        ============================================================ */}
        {ctx.setores.map((setor) => (
          <SetorBlock
            key={setor.id_setor}
            setor={setor}
            cargos={ctx.cargosPorSetor.get(setor.id_setor) ?? []}
            riscosPorTipo={ctx.riscosPorSetor.get(setor.id_setor) ?? new Map()}
            fotos={ctx.fotosPorSetor.get(setor.id_setor) ?? []}
            episPorRisco={ctx.episPorRisco}
          />
        ))}

        {/* Riscos sem setor (caso existam) */}
        {(ctx.riscosPorSetor.get("_sem_setor")?.size ?? 0) > 0 && (
          <SetorBlock
            setor={
              {
                id_setor: "_sem_setor",
                id_inspecao: id,
                id_empresa: inspecao.id_empresa,
                setor_ghe: "Riscos sem setor associado",
                descricao: null,
                conformidade: null,
                nao_conformidade: null,
              } as Setor
            }
            cargos={[]}
            riscosPorTipo={ctx.riscosPorSetor.get("_sem_setor") ?? new Map()}
            fotos={[]}
            episPorRisco={ctx.episPorRisco}
          />
        )}

        {/* ============================================================
            FOTOS GERAIS (não associadas a setor)
        ============================================================ */}
        {ctx.fotosGerais.length > 0 && (
          <section className="secao-setor border-t border-gray-200 px-8 py-6 md:px-12">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Camera className="size-4 text-verde-primary" />
              Fotos Gerais
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {ctx.fotosGerais.map((f) => (
                <FotoCard key={f.id_foto} foto={f} />
              ))}
            </div>
          </section>
        )}

        {/* ============================================================
            OBSERVAÇÕES + RESPONSÁVEIS + ASSINATURAS
        ============================================================ */}
        <section className="border-t border-gray-200 px-8 py-6 md:px-12">
          {inspecao.observacoes && (
            <div className="mb-6 overflow-hidden rounded-md border-l-4 border-slate-400 bg-slate-50/40">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white/60 px-3 py-2">
                <span className="text-base">📝</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Observações Gerais
                </h3>
              </div>
              <p className="whitespace-pre-wrap p-3 text-sm text-gray-700">
                {inspecao.observacoes}
              </p>
            </div>
          )}

          {/* PAE — Plano de Ação e Emergência (hierárquico) */}
          {paeContatos.length > 0 && (
            <div className="mb-8 overflow-hidden rounded-md border-l-4 border-red-500 bg-red-50/30">
              <div className="flex items-center gap-2 border-b border-red-200 bg-white/60 px-3 py-2">
                <span className="text-base">🚨</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-700">
                  Plano de Ação e Emergência (PAE)
                </h3>
                <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  {paeContatos.length} contato(s)
                </span>
              </div>
              <div className="p-3">
                <PaeArvore contatos={paeContatos} />
              </div>
            </div>
          )}

          {responsaveis.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                <span className="text-base">👥</span>
                Responsáveis
              </h3>
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">
                      Técnico SST
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      Recepcionado por
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">Cargo</th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      Data/Hora
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {responsaveis.map((r) => (
                    <tr key={r.id_responsavel}>
                      <td className="px-2 py-1.5">
                        {r.tecnico_responsavel ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.recepcionado_por ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">{r.cargo ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {fmtDataHora(r.data_hora)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Assinaturas */}
          {responsaveis.length > 0 && (
            <div className="grid grid-cols-2 gap-8 pt-12 print:pt-16">
              {responsaveis.slice(0, 1).map((r) => (
                <div key={r.id_responsavel} className="text-center">
                  <div className="border-t-2 border-gray-700 pt-2">
                    <p className="text-sm font-bold text-gray-900">
                      {r.tecnico_responsavel ?? "Nathan Ferreira"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                      Técnico Responsável
                    </p>
                  </div>
                </div>
              ))}
              {responsaveis.slice(0, 1).map((r) => (
                <div key={`emp-${r.id_responsavel}`} className="text-center">
                  <div className="border-t-2 border-gray-700 pt-2">
                    <p className="text-sm font-bold text-gray-900">
                      {r.recepcionado_por ?? "—"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                      Responsável da Empresa
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-8 text-center text-[10px] text-gray-400">
            Documento gerado em {fmtDataHora(new Date())} · Painel SST Chabra
          </p>
        </section>
      </article>
    </div>
  );
}

// =========================================================================
// SETOR BLOCK
// =========================================================================

function SetorBlock({
  setor,
  cargos,
  riscosPorTipo,
  fotos,
  episPorRisco,
}: {
  setor: Setor;
  cargos: Cargo[];
  riscosPorTipo: Map<string, Risco[]>;
  fotos: Foto[];
  episPorRisco: Map<string, EpiEpc[]>;
}) {
  const isConforme = !setor.nao_conformidade?.trim();
  const iconeDe = useTipoIcone();

  return (
    <section className="secao-setor border-t border-gray-200 px-8 py-6 md:px-12">
      {/* Header do setor */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: isConforme ? "#16a34a" : "#dc2626" }}
        />
        <h2 className="text-base font-bold uppercase tracking-wide text-gray-900">
          {setor.setor_ghe}
        </h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
            isConforme
              ? "border-green-300 bg-green-50 text-green-700"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {isConforme ? (
            <>
              <CheckCircle2 className="size-3" />
              Conforme
            </>
          ) : (
            <>
              <AlertCircle className="size-3" />
              Não Conforme
            </>
          )}
        </span>
      </div>

      {/* Descrição + conformidades */}
      {(setor.descricao || setor.conformidade || setor.nao_conformidade) && (
        <div className="mb-3 space-y-1 text-sm">
          {setor.descricao && (
            <p>
              <strong className="text-gray-700">Descrição do ambiente:</strong>{" "}
              <span className="text-gray-700">{setor.descricao}</span>
            </p>
          )}
          {setor.conformidade && (
            <p className="rounded border-l-2 border-green-400 bg-green-50/50 px-2 py-1 text-xs text-green-800">
              <strong>Conformidades:</strong> {setor.conformidade}
            </p>
          )}
          {setor.nao_conformidade && (
            <p className="rounded border-l-2 border-red-400 bg-red-50/50 px-2 py-1 text-xs text-red-800">
              <strong>Não conformidades:</strong> {setor.nao_conformidade}
            </p>
          )}
        </div>
      )}

      {/* Registro fotográfico */}
      {fotos.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <Camera className="size-3.5 text-verde-primary" />
            Registro Fotográfico ({fotos.length})
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {fotos.map((f) => (
              <FotoCard key={f.id_foto} foto={f} />
            ))}
          </div>
        </div>
      )}

      {/* Cargos do setor */}
      {cargos.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <Briefcase className="size-3.5 text-verde-primary" />
            Cargos do setor ({cargos.length})
          </h3>
          <div className="space-y-1.5">
            {cargos.map((c) => (
              <div
                key={c.id_cargo}
                className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs"
              >
                <p className="font-bold uppercase text-gray-900">{c.cargo}</p>
                {c.descricao && (
                  <p className="mt-0.5 text-gray-700">{c.descricao}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Riscos identificados */}
      {riscosPorTipo.size > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <AlertTriangle className="size-3.5 text-amber-warning" />
            Riscos Identificados (
            {Array.from(riscosPorTipo.values()).reduce(
              (acc, arr) => acc + arr.length,
              0
            )}
            )
          </h3>
          <div className="space-y-3">
            {Array.from(riscosPorTipo.entries()).map(([tipo, lista]) => (
              <div key={tipo}>
                {/* Header do tipo */}
                <div className="mb-1.5 flex items-center justify-between border-b border-gray-200 pb-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    {iconeDe(tipo)} {tipo}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {lista.length}{" "}
                    {lista.length === 1 ? "item" : "itens"}
                  </p>
                </div>
                {/* Cards de risco */}
                <div className="space-y-2">
                  {lista.map((r) => (
                    <RiscoCard
                      key={r.id_risco}
                      risco={r}
                      epis={episPorRisco.get(r.id_risco) ?? []}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// =========================================================================
// RISCO CARD (estilo PDF Chabra)
// =========================================================================

function RiscoCard({ risco, epis }: { risco: Risco; epis: EpiEpc[] }) {
  const nivel = (risco.nivel_risco ?? "Baixo") as NivelRisco;
  const cfg = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG.Baixo;
  const isIapat = risco.tipo_risco.startsWith("IAPAT");

  // Coleta perguntas qualitativas (Q1-Q6 químico) preenchidas
  const perguntasQuim: Array<[string, string]> = [];
  if (risco.tipo_risco === "Químico") {
    const labels = [
      "Durante o uso normal, gera vapores, gases, névoas ou aerodispersóides perceptíveis?",
      "O ambiente possui ventilação adequada (natural e/ou mecânica)?",
      "Processo é manual, sem pulverização/atomização/pressurização?",
      "Produto é utilizado diluído?",
      "Há queixas de cheiro forte, mal-estar, ardência ocular ou desconforto respiratório?",
      "Produto é aquecido ou submetido a processo que aumente sua volatilização?",
    ];
    for (let i = 1; i <= 6; i++) {
      const v = risco[`quim_q${i}` as keyof Risco] as string | null;
      if (v) perguntasQuim.push([labels[i - 1], v]);
    }
    if (risco.uso_processo) {
      perguntasQuim.push([
        "Como o produto é utilizado no processo?",
        risco.uso_processo,
      ]);
    }
  }

  // Respostas customizadas (V3)
  const respostasCustom = risco.respostas_custom ?? {};

  return (
    <div
      className="risco-card relative overflow-hidden rounded-lg border bg-white"
      style={{
        borderColor: cfg.borda,
        borderLeftWidth: 4,
        borderLeftColor: cfg.cor,
      }}
    >
      {/* Header com agente + nível */}
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 bg-gray-50/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-alert">
            Risco
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {risco.agente ?? "—"}
          </p>
        </div>
        <NivelBadge nivel={nivel} />
      </div>

      <div className="space-y-1.5 px-3 py-2">
        {/* Fonte geradora — V6: pode ser lista (JSON) ou texto legado */}
        {(() => {
          const fontes = parseMedidas(risco.fonte_geradora);
          if (fontes.length === 0) return null;
          return (
            <p className="rounded border-l-4 border-amber-warning bg-amber-50/40 px-2 py-1 text-xs">
              <strong className="text-amber-warning">
                ⚡ FONTE GERADORA{fontes.length > 1 ? "S" : ""}:
              </strong>{" "}
              <span className="text-gray-800">{fontes.join("; ")}</span>
            </p>
          );
        })()}

        {/* Grid principal de avaliação */}
        {!isIapat && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] md:grid-cols-4">
            <Campo label="Probabilidade" valor={risco.probabilidade} />
            <Campo label="Severidade" valor={risco.severidade} />
            <Campo label="Meio de Propagação" valor={risco.meio_propagacao?.join(", ")} />
            <Campo label="Situação" valor={risco.situacao} />
            <Campo label="Tempo de Exposição" valor={risco.tempo_exposicao} />
            <Campo
              label="Técnica Utilizada"
              valor={risco.tecnica_utilizada}
            />
            {risco.tipo_risco === "Químico" && (
              <Campo label="Forma do agente" valor="Poeira" />
            )}
            {(risco.tipo_risco === "Físico" ||
              risco.tipo_risco === "Químico") &&
              risco.fisico_necessita_medicao && (
                <Campo
                  label="Precisa medição"
                  valor={
                    risco.fisico_necessita_medicao === "Sim"
                      ? "Adicionar ao plano de ação"
                      : risco.fisico_necessita_medicao
                  }
                />
              )}
          </div>
        )}

        {/* IAPAT: pontuação + características */}
        {isIapat && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] md:grid-cols-3">
            <Campo label="Probabilidade" valor={risco.probabilidade} />
            <Campo label="Severidade" valor={risco.severidade} />
            <Campo label="Pontuação IAPAT" valor={risco.pontuacao_iapat} />
          </div>
        )}

        {/* Detalhes específicos por tipo */}
        {risco.tipo_risco === "Biológico" && risco.tipo_agente_biologico && (
          <Campo
            label="Tipo de agente biológico"
            valor={risco.tipo_agente_biologico}
          />
        )}
        {risco.tipo_risco === "Ergonômico" && risco.fator_ergonomico && (
          <Campo label="Fator ergonômico" valor={risco.fator_ergonomico} />
        )}
        {risco.tipo_risco === "Psicossocial" && risco.fator_psicossocial && (
          <Campo label="Fator psicossocial" valor={risco.fator_psicossocial} />
        )}

        {/* Pré-classificação NHO-08 (químico) */}
        {perguntasQuim.length > 0 && (
          <div className="rounded border border-gray-200 bg-gray-50 p-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">
              Pré-classificação NHO-08 ({perguntasQuim.length} perguntas)
            </p>
            <ul className="space-y-0.5 text-[11px]">
              {perguntasQuim.map(([q, a]) => (
                <li key={q} className="flex gap-2">
                  <span className="text-gray-400">▸</span>
                  <span className="flex-1 text-gray-700">{q}</span>
                  <strong className="shrink-0 text-gray-900">{a}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Respostas customizadas (V3) */}
        {Object.keys(respostasCustom).length > 0 && (
          <div className="rounded border border-blue-200 bg-blue-50/40 p-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Perguntas customizadas
            </p>
            <ul className="space-y-0.5 text-[11px]">
              {Object.entries(respostasCustom).map(([k, v]) => (
                <li key={k} className="flex gap-2">
                  <span className="text-gray-400">▸</span>
                  <span className="flex-1 text-gray-700">{k}</span>
                  <strong className="shrink-0 text-gray-900">{String(v)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Foto FDS química */}
        {risco.foto_quim_url && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={risco.foto_quim_url}
              alt="FDS"
              className="max-h-24 rounded border border-gray-200"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Medidas adotadas */}
        <div className="rounded border-l-4 border-green-400 bg-green-50/40 px-2 py-1 text-[11px]">
          <p className="font-bold text-green-700">✓ MEDIDAS JÁ ADOTADAS</p>
          <ListaMedidasRelatorio
            raw={risco.medidas_adotadas}
            fallback="Nenhuma"
          />
        </div>

        {/* Medidas a adotar */}
        <div className="rounded border-l-4 border-amber-warning bg-amber-50/40 px-2 py-1 text-[11px]">
          <p className="font-bold text-amber-warning">
            ⚠ MEDIDAS A SEREM ADOTADAS
          </p>
          <ListaMedidasRelatorio
            raw={risco.medidas_recomendadas}
            fallback="Monitoramento do risco e implementação de controle"
          />
        </div>

        {/* EPIs */}
        {epis.length > 0 && (
          <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px]">
            <p className="mb-1 flex items-center gap-1 font-bold text-gray-700">
              <ShieldCheck className="size-3 text-verde-primary" />
              EPIs vinculados a este risco ({epis.length})
            </p>
            <ul className="space-y-1">
              {epis.map((e) => (
                <li
                  key={e.id_protecao}
                  className="grid grid-cols-[60px_1fr] gap-x-2"
                >
                  <span className="text-gray-500">
                    {e.recomendado === "Sim" || !e.recomendado
                      ? "RECOMENDADO"
                      : "—"}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {e.tipo} — {e.descricao || "não especificado"}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      CA: {e.ca || "não informado"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Observações */}
        {risco.observacoes_risco && (
          <p className="text-[11px] italic text-gray-600">
            Obs.: {risco.observacoes_risco}
          </p>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// AUXILIARES
// =========================================================================

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

function CardNumero({
  label,
  valor,
  cor,
  bg,
  destacado,
}: {
  label: string;
  valor: number;
  cor: string;
  bg: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${
        destacado ? "shadow-md" : ""
      }`}
      style={{
        backgroundColor: bg,
        borderColor: destacado ? bg : "#e5e7eb",
      }}
    >
      <p
        className="text-2xl font-bold leading-none"
        style={{ color: cor }}
      >
        {valor}
      </p>
      <p
        className="mt-1 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: cor, opacity: 0.85 }}
      >
        {label}
      </p>
    </div>
  );
}

function Campo({
  label,
  valor,
}: {
  label: string;
  valor: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="text-gray-800">{valor ?? "—"}</p>
    </div>
  );
}

function FotoCard({ foto }: { foto: Foto }) {
  return (
    <div className="overflow-hidden rounded border border-gray-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.arquivo_foto}
        alt={foto.legenda ?? foto.categoria}
        className="aspect-square w-full object-cover"
        referrerPolicy="no-referrer"
      />
      {foto.legenda && (
        <p className="truncate p-1 text-[10px] text-gray-700">{foto.legenda}</p>
      )}
    </div>
  );
}

/** Renderiza medidas (JSON array ou texto livre legado) com bullets se >1. */
function ListaMedidasRelatorio({
  raw,
  fallback,
}: {
  raw: string | null | undefined;
  fallback: string;
}) {
  const items = parseMedidas(raw);
  if (items.length === 0) {
    return <p className="text-gray-700">{fallback}</p>;
  }
  if (items.length === 1) {
    return <p className="text-gray-700">{items[0]}</p>;
  }
  return (
    <ul className="ml-3 list-disc space-y-0.5 text-gray-700">
      {items.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}

// =============================================================
// PAE — árvore hierárquica de contatos (print-friendly)
// =============================================================

function PaeArvore({ contatos }: { contatos: PaeContato[] }) {
  const childrenOf = new Map<string | null, PaeContato[]>();
  for (const c of contatos) {
    const key = c.id_parent ?? null;
    const arr = childrenOf.get(key) ?? [];
    arr.push(c);
    childrenOf.set(key, arr);
  }

  // Flatten da árvore em ordem (DFS) preservando o nível pra mostrar
  // a hierarquia através de indent na coluna Nome.
  const linhas: Array<{ contato: PaeContato; nivel: number }> = [];
  function visitar(parent: string | null, nivel: number) {
    const filhos = childrenOf.get(parent) ?? [];
    for (const c of filhos) {
      linhas.push({ contato: c, nivel });
      visitar(c.id_contato, nivel + 1);
    }
  }
  visitar(null, 0);

  return (
    <table className="w-full border-collapse overflow-hidden rounded-md border border-gray-200 bg-white text-sm">
      <thead className="bg-red-50 text-red-800">
        <tr>
          <th className="border-b border-red-200 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
            Nome
          </th>
          <th className="border-b border-red-200 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
            Cargo
          </th>
          <th className="border-b border-red-200 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
            Telefone
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(({ contato, nivel }) => {
          const indent = Math.min(nivel, 6) * 12;
          return (
            <tr
              key={contato.id_contato}
              className="border-b border-gray-100 last:border-b-0"
            >
              <td className="px-3 py-2 text-center align-middle">
                <span
                  className="inline-flex items-center gap-1.5 font-semibold text-gray-900"
                  style={{ paddingLeft: indent }}
                >
                  {nivel > 0 && (
                    <span className="text-red-400">└─</span>
                  )}
                  {contato.nome}
                </span>
              </td>
              <td className="px-3 py-2 text-center align-middle text-gray-700">
                {contato.cargo ?? "—"}
              </td>
              <td className="px-3 py-2 text-center align-middle">
                {contato.telefone ? (
                  <span className="inline-flex items-center gap-1 font-mono text-gray-800">
                    <span className="text-[10px]">📞</span>
                    {contato.telefone}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

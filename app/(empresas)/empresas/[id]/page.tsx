"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, ClipboardList, Building2, ChartBar,
  FileText, Download, BadgeCheck, MapPin, ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import { usePdfsPorEmpresa } from "@/lib/hooks/usePdfsGerados";
import { useRegistrosEmpresa } from "@/lib/hooks/useRegistrosEmpresa";
import { useUnidades } from "@/lib/hooks/useUnidades";
import EmpresaForm from "@/components/empresas/EmpresaForm";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { fmtData, cn } from "@/lib/utils";
import { useCanEdit } from "@/lib/hooks/useUsuario";

const MODULO_LABEL: Record<string, string> = {
  inspecoes: "Inspeção SST",
  conformidade: "Conformidade",
  nao_conformidade: "Não Conformidade",
  analise_quimicos: "Análise de Químicos",
  apreciacao: "Apreciação NR-12",
  apreciacao_maquinas: "Apreciação NR-12",
  aet: "AET — Ergonomia",
  aep: "AEP — Ergonomia",
  psicossocial: "DRPS — Psicossocial",
  questionarios_psicossociais: "Questionários",
  inventario_maquinas: "Inventário",
};
const moduloLabel = (m: string) => MODULO_LABEL[m] ?? m;

type Aba = "geral" | "dados" | "registros" | "documentos" | "inspecoes";

const ABAS: { id: Aba; label: string }[] = [
  { id: "geral", label: "Visão geral" },
  { id: "dados", label: "Dados cadastrais" },
  { id: "registros", label: "Registros por módulo" },
  { id: "documentos", label: "Documentos & Laudos" },
  { id: "inspecoes", label: "Inspeções" },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default function EmpresaDetalhePage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const canEdit = useCanEdit();
  const [editOpen, setEditOpen] = useState(false);
  const [aba, setAba] = useState<Aba>("geral");
  const [filtroMod, setFiltroMod] = useState<string>("");

  const { data: empresa, isLoading } = useEmpresa(id);
  const { data: inspecoes = [] } = useInspecoesByEmpresa(id);
  const { data: pdfs = [], isLoading: loadingPdfs } = usePdfsPorEmpresa(id);
  const { data: grupos = [], isLoading: loadingRegistros } = useRegistrosEmpresa(id);
  const { data: unidades = [] } = useUnidades();

  const totalRegistros = useMemo(() => grupos.reduce((s, g) => s + g.registros.length, 0), [grupos]);
  const gruposComRegistros = grupos.filter((g) => g.registros.length > 0);

  const unidadeNome = useMemo(
    () => unidades.find((u) => u.id_unidade === empresa?.id_unidade)?.nome ?? null,
    [unidades, empresa?.id_unidade],
  );

  // KPIs
  const inspAndamento = inspecoes.filter((i) => i.status === "EM_ANDAMENTO").length;
  const inspConcluidas = inspecoes.filter((i) => i.status === "CONCLUIDA").length;
  const docsAssinados = pdfs.filter((p) => p.assinado).length;

  // Documentos por módulo (para KPI e filtro)
  const porModulo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pdfs) m.set(p.modulo, (m.get(p.modulo) ?? 0) + 1);
    return Array.from(m.entries()).map(([modulo, total]) => ({ modulo, total })).sort((a, b) => b.total - a.total);
  }, [pdfs]);

  const pdfsFiltrados = filtroMod ? pdfs.filter((p) => p.modulo === filtroMod) : pdfs;

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (!empresa) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Empresa não encontrada.{" "}
        <Link href="/empresas" className="font-medium hover:underline">Voltar</Link>
      </div>
    );
  }

  const localTxt = [empresa.municipio, empresa.uf].filter(Boolean).join(" / ");

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => router.push("/empresas")}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Voltar
      </button>

      {/* Cabeçalho rico */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-verde-light text-verde-primary">
              <Building2 className="size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{empresa.nome_empresa}</h1>
              {empresa.razao_social && <p className="text-sm text-gray-600">{empresa.razao_social}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                {unidadeNome && (
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {unidadeNome}</span>
                )}
                {localTxt && <span>{localTxt}</span>}
                {empresa.grau_risco != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                    <ShieldAlert className="size-3" /> Grau de risco {empresa.grau_risco}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Link
              href={`/empresas/${empresa.id_empresa}/relatorio`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title="Relatório consolidado"
            >
              <ChartBar className="size-3.5" /> Consolidado
            </Link>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="size-3.5" /> Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition-colors",
              aba === a.id ? "text-verde-primary" : "text-gray-500 hover:text-gray-800",
            )}
          >
            {a.label}
            {aba === a.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-verde-primary" />}
          </button>
        ))}
      </div>

      {/* ── Visão geral ── */}
      {aba === "geral" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Inspeções" valor={inspecoes.length} sub={`${inspAndamento} em andamento`} />
            <Kpi label="Registros (módulos)" valor={totalRegistros} sub={`${gruposComRegistros.length} módulo${gruposComRegistros.length !== 1 ? "s" : ""}`} />
            <Kpi label="Documentos emitidos" valor={pdfs.length} sub={`${docsAssinados} assinado${docsAssinados !== 1 ? "s" : ""}`} />
            <Kpi label="Inspeções concluídas" valor={inspConcluidas} sub={`de ${inspecoes.length}`} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Registros por módulo</h3>
            {loadingRegistros ? (
              <p className="text-sm text-gray-400">Carregando…</p>
            ) : gruposComRegistros.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum registro de módulos para esta empresa ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {gruposComRegistros.map((g) => (
                  <button
                    key={g.modulo}
                    type="button"
                    onClick={() => setAba("registros")}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-700">{g.label}</span>
                    <span className="rounded-full bg-verde-light px-1.5 py-0.5 font-semibold text-verde-primary">{g.registros.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Registros por módulo (nativos de cada módulo) ── */}
      {aba === "registros" && (
        <div className="space-y-4">
          {loadingRegistros ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><LoadingSkeleton rows={4} /></div>
          ) : gruposComRegistros.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
              <FileText className="size-8 text-gray-400" />
              <p className="mt-2">Nenhum registro de módulos para esta empresa ainda.</p>
            </div>
          ) : (
            gruposComRegistros.map((g) => (
              <div key={g.modulo} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">{g.label}</h3>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{g.registros.length}</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {g.registros.slice(0, 50).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-800">
                          {r.titulo?.trim() || <span className="font-mono text-xs text-gray-500">{r.id}</span>}
                        </p>
                        <p className="text-xs text-gray-400">
                          {r.data ? fmtData(r.data) : "—"}
                          {r.status ? ` · ${r.status}` : ""}
                        </p>
                      </div>
                      <Link href={g.rota(r.id)} className="shrink-0 text-xs font-medium text-verde-primary hover:underline">
                        Abrir →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Dados cadastrais ── */}
      {aba === "dados" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <EmpresaInfoPanel empresa={empresa} />
          {empresa.observacao && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Observação</p>
              {empresa.observacao}
            </div>
          )}
        </div>
      )}

      {/* ── Documentos & Laudos (unificado via pdfs_gerados) ── */}
      {aba === "documentos" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Documentos & Laudos ({pdfsFiltrados.length})</h2>
            <select
              value={filtroMod}
              onChange={(e) => setFiltroMod(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              <option value="">Todos os módulos</option>
              {porModulo.map((m) => (
                <option key={m.modulo} value={m.modulo}>{moduloLabel(m.modulo)} ({m.total})</option>
              ))}
            </select>
          </div>
          {loadingPdfs ? (
            <div className="p-5"><LoadingSkeleton rows={5} /></div>
          ) : pdfsFiltrados.length === 0 ? (
            <div className="flex flex-col items-center p-8 text-center text-sm text-gray-500">
              <FileText className="size-8 text-gray-400" />
              <p className="mt-2">Nenhum documento gerado{filtroMod ? " neste módulo" : ""} para esta empresa.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pdfsFiltrados.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {p.tipo_documento || moduloLabel(p.modulo)}
                    </p>
                    <p className="text-xs text-gray-500">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">{moduloLabel(p.modulo)}</span>
                      {" · "}{fmtData(p.data_geracao)}
                      {p.responsavel_tecnico ? ` · ${p.responsavel_tecnico}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {p.assinado && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <BadgeCheck className="size-3" /> Assinado
                      </span>
                    )}
                    {(p.pdf_assinado_url || p.pdf_url) ? (
                      <a
                        href={(p.pdf_assinado_url || p.pdf_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-verde-primary hover:underline"
                      >
                        <Download className="size-3.5" /> Abrir
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Inspeções ── */}
      {aba === "inspecoes" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Inspeções ({inspecoes.length})</h2>
            <Link
              href={`/inspecoes/nova?empresa=${empresa.id_empresa}`}
              className="rounded-md bg-verde-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-verde-accent"
            >
              + Nova
            </Link>
          </div>
          {inspecoes.length === 0 ? (
            <div className="flex flex-col items-center p-8 text-center text-sm text-gray-500">
              <ClipboardList className="size-8 text-gray-400" />
              <p className="mt-2">Nenhuma inspeção registrada para esta empresa.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {inspecoes.map((i) => (
                <li key={i.id_inspecao} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Rev. {i.revisao} ·{" "}
                      <span className="font-mono text-xs text-gray-500">{i.id_inspecao}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {fmtData(i.data_inspecao)} · {i.responsavel ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={i.status} />
                    <Link
                      href={`/inspecoes/${i.id_inspecao}`}
                      className="text-xs font-medium text-verde-primary hover:underline"
                    >
                      Abrir →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EmpresaForm open={editOpen} onClose={() => setEditOpen(false)} empresa={empresa} />
    </div>
  );
}

function Kpi({ label, valor, sub }: { label: string; valor: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

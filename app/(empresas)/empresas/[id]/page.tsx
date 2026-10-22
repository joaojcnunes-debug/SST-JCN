"use client";

import { use, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeft, Pencil, ClipboardList, Building2, ChartBar,
  MapPin, ShieldAlert, Copy,
} from "lucide-react";
import Link from "next/link";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import { useDocumentosEmpresa } from "@/lib/hooks/useDocumentosEmpresa";
import DocumentosEmpresaLista from "@/components/empresas/DocumentosEmpresaLista";
import { useUnidades } from "@/lib/hooks/useUnidades";
import EmpresaForm from "@/components/empresas/EmpresaForm";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import GrupoDaEmpresaResumo from "@/components/empresas/GrupoDaEmpresaResumo";
import { EmpresaDetalheSkeleton } from "@/components/empresas/EmpresaSkeletons";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { fmtData, cn } from "@/lib/utils";
import { useCanEdit } from "@/lib/hooks/useUsuario";


type Aba = "geral" | "dados" | "documentos" | "inspecoes";

const ABAS: { id: Aba; label: string }[] = [
  { id: "geral", label: "Visão geral" },
  { id: "dados", label: "Dados cadastrais" },
  { id: "documentos", label: "Documentos & Laudos" },
  { id: "inspecoes", label: "Inspeções" },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default function EmpresaDetalhePage({ params }: Props) {
  const { id } = use(params);
  const canEdit = useCanEdit();
  const [editOpen, setEditOpen] = useState(false);
  // `?aba=documentos` vem do botão Documentos do card em /empresas (08/10).
  const abaUrl = useSearchParams().get("aba");
  const [aba, setAba] = useState<Aba>(
    ABAS.some((a) => a.id === abaUrl) ? (abaUrl as Aba) : "geral",
  );

  const { data: empresa, isLoading } = useEmpresa(id);
  const { data: inspecoes = [] } = useInspecoesByEmpresa(id);
  const { data: docs, isLoading: loadingDocs } = useDocumentosEmpresa(id);
  const { data: unidades = [] } = useUnidades();


  const unidadeNome = useMemo(
    () => unidades.find((u) => u.id_unidade === empresa?.id_unidade)?.nome ?? null,
    [unidades, empresa?.id_unidade],
  );

  // KPIs
  const inspAndamento = inspecoes.filter((i) => i.status === "EM_ANDAMENTO").length;
  const inspConcluidas = inspecoes.filter((i) => i.status === "CONCLUIDA").length;
  const totalDocs = docs?.documentos.length ?? 0;
  const docsComPdf = docs?.documentos.filter((d) => d.pdfUrl).length ?? 0;

  if (isLoading) return <EmpresaDetalheSkeleton />;
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
      <Link
        href="/empresas"
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

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
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(empresa.id_empresa);
                    toast.success("ID copiado");
                  } catch {
                    toast.error("Não foi possível copiar");
                  }
                }}
                title="Copiar o ID da empresa"
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-700 hover:bg-gray-100"
              >
                ID {empresa.id_empresa} <Copy className="size-3" />
              </button>
              <GrupoDaEmpresaResumo idEmpresa={empresa.id_empresa} />
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Inspeções" valor={inspecoes.length} sub={`${inspAndamento} em andamento`} />
            <Kpi label="Documentos & Laudos" valor={totalDocs} sub={`${docsComPdf} com PDF`} />
            <Kpi label="Inspeções concluídas" valor={inspConcluidas} sub={`de ${inspecoes.length}`} />
          </div>

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

      {/* ── Documentos & Laudos: TODOS os documentos da empresa, em sequência (08/10) ── */}
      {aba === "documentos" && <DocumentosEmpresaLista data={docs} carregando={loadingDocs} />}

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

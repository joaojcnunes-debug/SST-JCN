"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  Loader2,
  ListChecks,
  BarChart2,
  ClipboardCheck,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useQpsAplicacao,
  useUpdateQpsAplicacao,
  useDeleteQpsAplicacao,
  useQpsTipos,
} from "@/lib/hooks/useQuestionarios";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import type { StatusQpsAplicacao } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const STATUS_LABEL: Record<StatusQpsAplicacao, string> = {
  RASCUNHO: "Rascunho",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  DELETADO: "Deletado",
};

const STATUS_COR: Record<StatusQpsAplicacao, string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  DELETADO: "bg-red-100 text-red-600",
};

const PROXIMOS_STATUS: Record<StatusQpsAplicacao, StatusQpsAplicacao | null> = {
  RASCUNHO: "EM_ANDAMENTO",
  EM_ANDAMENTO: "CONCLUIDO",
  CONCLUIDO: null,
  DELETADO: null,
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function QpsDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: ap, isLoading, isError } = useQpsAplicacao(id);
  const { data: tipos = [] } = useQpsTipos();
  const { data: empresa } = useEmpresa(ap?.id_empresa ?? null);
  const atualizar = useUpdateQpsAplicacao();
  const deletar = useDeleteQpsAplicacao();

  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [editandoResponsavel, setEditandoResponsavel] = useState(false);
  const [novoResponsavel, setNovoResponsavel] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-500">
        <Loader2 className="size-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  if (isError || !ap) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-sm text-gray-500">
        <AlertTriangle className="size-8 text-red-400" />
        <p>Aplicação não encontrada.</p>
        <Link href="/questionarios-psicossociais" className="text-indigo-600 underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  const tipoNome = tipos.find((t) => t.id_tipo === ap.id_tipo)?.nome ?? "—";
  const proximoStatus = PROXIMOS_STATUS[ap.status];
  // Capture narrowed reference so closures don't re-evaluate the possibly-undefined type
  const apDef = ap;

  async function avancarStatus() {
    if (!proximoStatus) return;
    try {
      await atualizar.mutateAsync({
        id: apDef.id_aplicacao,
        idEmpresa: apDef.id_empresa,
        input: { status: proximoStatus },
      });
      toast.success(`Status atualizado para ${STATUS_LABEL[proximoStatus]}`);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  async function salvarTitulo() {
    if (!novoTitulo.trim()) return;
    try {
      await atualizar.mutateAsync({
        id: apDef.id_aplicacao,
        idEmpresa: apDef.id_empresa,
        input: { titulo: novoTitulo.trim() },
      });
      toast.success("Título atualizado");
      setEditandoTitulo(false);
    } catch {
      toast.error("Erro ao salvar título");
    }
  }

  async function salvarResponsavel() {
    try {
      await atualizar.mutateAsync({
        id: apDef.id_aplicacao,
        idEmpresa: apDef.id_empresa,
        input: { responsavel: novoResponsavel.trim() || null },
      });
      toast.success("Responsável atualizado");
      setEditandoResponsavel(false);
    } catch {
      toast.error("Erro ao salvar responsável");
    }
  }

  async function handleDeletar() {
    if (
      !confirm(
        "Remover esta aplicação? Todos os respondentes e dados serão perdidos."
      )
    )
      return;
    try {
      await deletar.mutateAsync({ id: apDef.id_aplicacao, idEmpresa: apDef.id_empresa });
      toast.success("Aplicação removida");
      router.push("/questionarios-psicossociais");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Navegação topo */}
      <div className="flex items-center gap-3">
        <Link
          href="/questionarios-psicossociais"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="size-4" /> Aplicações
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen className="size-5 text-indigo-600 shrink-0" />
            {editandoTitulo ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  autoFocus
                  className="rounded border border-gray-300 px-2 py-1 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={salvarTitulo} className="text-green-600">
                  <Check className="size-5" />
                </button>
                <button
                  onClick={() => setEditandoTitulo(false)}
                  className="text-gray-400"
                >
                  <X className="size-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{ap.titulo}</h1>
                <button
                  onClick={() => { setNovoTitulo(ap.titulo); setEditandoTitulo(true); }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                STATUS_COR[ap.status]
              )}
            >
              {STATUS_LABEL[ap.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {empresa?.nome_empresa ?? "—"} · {tipoNome}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          {proximoStatus && (
            <button
              onClick={avancarStatus}
              disabled={atualizar.isPending}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {atualizar.isPending && <Loader2 className="size-4 animate-spin" />}
              → {STATUS_LABEL[proximoStatus]}
            </button>
          )}
          <button
            onClick={handleDeletar}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="size-4" /> Remover
          </button>
        </div>
      </div>

      {/* Detalhes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Responsável">
          {editandoResponsavel ? (
            <div className="flex items-center gap-1">
              <input
                value={novoResponsavel}
                onChange={(e) => setNovoResponsavel(e.target.value)}
                autoFocus
                className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={salvarResponsavel} className="text-green-600"><Check className="size-3.5" /></button>
              <button onClick={() => setEditandoResponsavel(false)} className="text-gray-400"><X className="size-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span>{ap.responsavel ?? "—"}</span>
              <button
                onClick={() => { setNovoResponsavel(ap.responsavel ?? ""); setEditandoResponsavel(true); }}
                className="ml-1 text-gray-300 hover:text-gray-500"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
        </InfoCard>
        <InfoCard label="Período Início">{fmtData(ap.periodo_inicio)}</InfoCard>
        <InfoCard label="Período Fim">{fmtData(ap.periodo_fim)}</InfoCard>
        <InfoCard label="Criado em">{fmtData(ap.criado_em)}</InfoCard>
      </div>

      {/* Navegação das sub-páginas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SubPageCard
          href={`/questionarios-psicossociais/${id}/respondentes`}
          icon={<ListChecks className="size-6 text-indigo-600" />}
          title="Respondentes"
          description="Adicione ou importe respostas dos colaboradores por setor"
        />
        <SubPageCard
          href={`/questionarios-psicossociais/${id}/resultados`}
          icon={<BarChart2 className="size-6 text-indigo-600" />}
          title="Resultados / Matriz"
          description="Visualize scores, probabilidade e severidade por dimensão"
        />
        <SubPageCard
          href={`/questionarios-psicossociais/${id}/planos`}
          icon={<ClipboardCheck className="size-6 text-indigo-600" />}
          title="Planos de Ação"
          description="Gerencie ações corretivas e preventivas para os riscos identificados"
        />
      </div>
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div className="text-sm font-medium text-gray-800">{children}</div>
    </div>
  );
}

function SubPageCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 transition-colors group-hover:bg-indigo-100">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

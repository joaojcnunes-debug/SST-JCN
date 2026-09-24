"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  Loader2,
  ListChecks,
  BarChart2,
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
  ENVIADO_CLIENTE: "Enviado p/ cliente",
  DELETADO: "Deletado",
};

const STATUS_COR: Record<StatusQpsAplicacao, string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  ENVIADO_CLIENTE: "bg-indigo-100 text-indigo-700",
  DELETADO: "bg-red-100 text-red-600",
};

/**
 * A fila do botão "avançar". `ENVIADO_CLIENTE` (v206) fecha a fila: entregue ao
 * cliente é o último passo. Quem precisar voltar atrás usa o quadro de status
 * do Resumo, arrastando o cartão — a fila daqui é só de ida.
 */
const PROXIMOS_STATUS: Record<StatusQpsAplicacao, StatusQpsAplicacao | null> = {
  RASCUNHO: "EM_ANDAMENTO",
  EM_ANDAMENTO: "CONCLUIDO",
  CONCLUIDO: "ENVIADO_CLIENTE",
  ENVIADO_CLIENTE: null,
  DELETADO: null,
};

function fmtData(iso: string | null | undefined) {
  if (!iso) return "—";
  // Data sem hora ("2026-05-23") é lida como UTC e cairia no dia anterior em -03:00.
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("pt-BR");
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
  const [editandoUnidade, setEditandoUnidade] = useState(false);
  const [novaUnidade, setNovaUnidade] = useState("");
  const [editandoPrevistos, setEditandoPrevistos] = useState(false);
  const [novosPrevistos, setNovosPrevistos] = useState("");
  // v226 — os dois campos que o laudo imprime no cabeçalho e na assinatura.
  const [editandoCrp, setEditandoCrp] = useState(false);
  const [novoCrp, setNovoCrp] = useState("");
  const [editandoElab, setEditandoElab] = useState(false);
  const [novaElab, setNovaElab] = useState("");
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

  async function salvarUnidade() {
    try {
      await atualizar.mutateAsync({
        id: apDef.id_aplicacao,
        idEmpresa: apDef.id_empresa,
        input: { unidade_cliente: novaUnidade.trim() || null },
      });
      toast.success("Unidade do cliente atualizada");
      setEditandoUnidade(false);
    } catch {
      toast.error("Erro ao salvar unidade");
    }
  }

  // Em branco vira NULL, não 0 — "não informado" e "ninguém deveria responder"
  // são coisas diferentes, e o CHECK da v201 recusa 0 e negativo.
  async function salvarPrevistos() {
    const n = novosPrevistos.trim() === "" ? null : Number(novosPrevistos);
    if (n !== null && (!Number.isFinite(n) || n <= 0)) {
      toast.error("Informe um número maior que zero, ou deixe em branco");
      return;
    }
    try {
      await atualizar.mutateAsync({
        id: apDef.id_aplicacao,
        idEmpresa: apDef.id_empresa,
        input: { trabalhadores_previstos: n },
      });
      toast.success("Trabalhadores previstos atualizado");
      setEditandoPrevistos(false);
    } catch {
      toast.error("Erro ao salvar trabalhadores previstos");
    }
  }

  async function salvarCrp() {
    try {
      await atualizar.mutateAsync({
        id: apDef.id_aplicacao,
        idEmpresa: apDef.id_empresa,
        input: { crp: novoCrp.trim() || null },
      });
      toast.success("CRP atualizado");
      setEditandoCrp(false);
    } catch {
      toast.error("Erro ao salvar CRP");
    }
  }

  async function salvarElaboracao() {
    try {
      await atualizar.mutateAsync({
        id: apDef.id_aplicacao,
        idEmpresa: apDef.id_empresa,
        input: { data_elaboracao: novaElab || null },
      });
      toast.success("Data de elaboração atualizada");
      setEditandoElab(false);
    } catch {
      toast.error("Erro ao salvar a data de elaboração");
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
        <InfoCard label="Tipo de Questionário" destaque>
          {tipoNome}
        </InfoCard>
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
        <InfoCard label="Unidade / Filial do cliente">
          {editandoUnidade ? (
            <div className="flex items-center gap-1">
              <input
                value={novaUnidade}
                onChange={(e) => setNovaUnidade(e.target.value)}
                autoFocus
                placeholder="Ex: Loja 28"
                className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={salvarUnidade} className="text-green-600"><Check className="size-3.5" /></button>
              <button onClick={() => setEditandoUnidade(false)} className="text-gray-400"><X className="size-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span>{ap.unidade_cliente ?? "—"}</span>
              <button
                onClick={() => { setNovaUnidade(ap.unidade_cliente ?? ""); setEditandoUnidade(true); }}
                className="ml-1 text-gray-300 hover:text-gray-500"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
        </InfoCard>
        <InfoCard label="Trabalhadores previstos">
          {editandoPrevistos ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                step={1}
                value={novosPrevistos}
                onChange={(e) => setNovosPrevistos(e.target.value)}
                autoFocus
                className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={salvarPrevistos} className="text-green-600"><Check className="size-3.5" /></button>
              <button onClick={() => setEditandoPrevistos(false)} className="text-gray-400"><X className="size-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span>{ap.trabalhadores_previstos ?? "—"}</span>
              <button
                onClick={() => { setNovosPrevistos(String(ap.trabalhadores_previstos ?? "")); setEditandoPrevistos(true); }}
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
        <InfoCard label="CRP do responsável (laudo)">
          {editandoCrp ? (
            <div className="flex items-center gap-1">
              <input
                value={novoCrp}
                onChange={(e) => setNovoCrp(e.target.value)}
                autoFocus
                placeholder="Ex: 05/12345"
                className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={salvarCrp} className="text-green-600"><Check className="size-3.5" /></button>
              <button onClick={() => setEditandoCrp(false)} className="text-gray-400"><X className="size-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span title="Em branco, o laudo usa o CRP do cadastro do profissional com este nome">
                {ap.crp ?? "— (usa o do cadastro)"}
              </span>
              <button
                onClick={() => { setNovoCrp(ap.crp ?? ""); setEditandoCrp(true); }}
                className="ml-1 text-gray-300 hover:text-gray-500"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
        </InfoCard>
        <InfoCard label="Data de elaboração (laudo)">
          {editandoElab ? (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={novaElab}
                onChange={(e) => setNovaElab(e.target.value)}
                autoFocus
                className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={salvarElaboracao} className="text-green-600"><Check className="size-3.5" /></button>
              <button onClick={() => setEditandoElab(false)} className="text-gray-400"><X className="size-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span>{fmtData(ap.data_elaboracao)}</span>
              <button
                onClick={() => { setNovaElab(ap.data_elaboracao ?? ""); setEditandoElab(true); }}
                className="ml-1 text-gray-300 hover:text-gray-500"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
        </InfoCard>
      </div>

      {/* Navegação das sub-páginas.
          v0.3.637 — o card "Plano de Ação 5W2H" saiu daqui junto com o item do
          menu: a QAP não usa mais o plano de ação (pedido do João Marcos em
          18/09). A tela continua existindo em /plano-acao. */}
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </div>
  );
}

function InfoCard({
  label,
  destaque,
  children,
}: {
  label: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        destaque
          ? "border-indigo-200 bg-indigo-50"
          : "border-gray-200 bg-white"
      )}
    >
      <p
        className={cn(
          "mb-1 text-xs font-semibold uppercase tracking-wide",
          destaque ? "text-indigo-400" : "text-gray-400"
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          "text-sm font-medium",
          destaque ? "text-indigo-800" : "text-gray-800"
        )}
      >
        {children}
      </div>
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

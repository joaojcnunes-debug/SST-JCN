"use client";

import { use, useState, useMemo } from "react";
import {
  ClipboardCheck,
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import {
  useQpsPlanos,
  useCreateQpsPlano,
  useUpdateQpsPlano,
  useDeleteQpsPlano,
  useQpsAplicacao,
  useQpsCategorias,
  useQpsRespondentes,
} from "@/lib/hooks/useQuestionarios";
import type { QpsPlanoAcao, StatusQpsPlano } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<StatusQpsPlano, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const STATUS_COR: Record<StatusQpsPlano, string> = {
  PENDENTE: "bg-gray-100 text-gray-600",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-600",
};

const PROXIMO_STATUS: Record<StatusQpsPlano, StatusQpsPlano | null> = {
  PENDENTE: "EM_ANDAMENTO",
  EM_ANDAMENTO: "CONCLUIDO",
  CONCLUIDO: null,
  CANCELADO: null,
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function isPrazoVencido(prazo: string | null) {
  if (!prazo) return false;
  return new Date(prazo) < new Date();
}

export default function PlanosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<StatusQpsPlano | "TODOS">("TODOS");

  const { data: ap } = useQpsAplicacao(id);
  const { data: planos = [], isLoading } = useQpsPlanos(id);
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: respondentes = [] } = useQpsRespondentes(id);
  const atualizar = useUpdateQpsPlano();
  const deletar = useDeleteQpsPlano();

  const setores = useMemo(
    () => [...new Set(respondentes.map((r) => r.setor))].sort(),
    [respondentes]
  );

  const planosFiltrados = useMemo(
    () => (filtroStatus === "TODOS" ? planos : planos.filter((p) => p.status === filtroStatus)),
    [planos, filtroStatus]
  );

  const contadores = useMemo(() => {
    const c: Record<StatusQpsPlano | "TODOS", number> = {
      TODOS: planos.length,
      PENDENTE: 0,
      EM_ANDAMENTO: 0,
      CONCLUIDO: 0,
      CANCELADO: 0,
    };
    for (const p of planos) c[p.status]++;
    return c;
  }, [planos]);

  async function avancarStatus(plano: QpsPlanoAcao) {
    const prox = PROXIMO_STATUS[plano.status];
    if (!prox) return;
    try {
      await atualizar.mutateAsync({
        id: plano.id_plano,
        idAplicacao: id,
        input: { status: prox },
      });
      toast.success(`Status → ${STATUS_LABEL[prox]}`);
    } catch {
      toast.error("Erro ao atualizar");
    }
  }

  async function handleDeletar(plano: QpsPlanoAcao) {
    if (!confirm("Remover este plano de ação?")) return;
    try {
      await deletar.mutateAsync({ id: plano.id_plano, idAplicacao: id });
      toast.success("Plano removido");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  const categoriasMap = Object.fromEntries(categorias.map((c) => [c.id_categoria, c.nome]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/questionarios-psicossociais/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="size-4" /> Voltar
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ClipboardCheck className="size-5 text-indigo-600" /> Planos de Ação
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{ap?.titulo}</p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="size-4" /> Novo Plano
        </button>
      </div>

      {/* Filtros por status */}
      <div className="flex flex-wrap gap-2">
        {(["TODOS", "PENDENTE", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              filtroStatus === s
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {s === "TODOS" ? "Todos" : STATUS_LABEL[s]} ({contadores[s]})
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando...
        </div>
      ) : planosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center text-sm text-gray-400">
          {filtroStatus === "TODOS"
            ? "Nenhum plano de ação ainda. Crie o primeiro."
            : `Nenhum plano com status "${STATUS_LABEL[filtroStatus as StatusQpsPlano]}".`}
        </div>
      ) : (
        <div className="space-y-3">
          {planosFiltrados.map((plano) => (
            <PlanoCard
              key={plano.id_plano}
              plano={plano}
              categoriasMap={categoriasMap}
              onAvancar={() => avancarStatus(plano)}
              onDeletar={() => handleDeletar(plano)}
              salvando={atualizar.isPending}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <NovoPlanoModal
          idAplicacao={id}
          categorias={categorias}
          setores={setores}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}

// ─── Card de plano ─────────────────────────────────────────────────────────────

function PlanoCard({
  plano,
  categoriasMap,
  onAvancar,
  onDeletar,
  salvando,
}: {
  plano: QpsPlanoAcao;
  categoriasMap: Record<string, string>;
  onAvancar: () => void;
  onDeletar: () => void;
  salvando: boolean;
}) {
  const [expandido, setExpandido] = useState(false);
  const vencido = isPrazoVencido(plano.prazo) && plano.status !== "CONCLUIDO" && plano.status !== "CANCELADO";
  const proximo = PROXIMO_STATUS[plano.status];

  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm",
        vencido && "border-red-200"
      )}
    >
      <div
        className="flex cursor-pointer items-start gap-3 p-4"
        onClick={() => setExpandido((v) => !v)}
      >
        <span
          className={cn(
            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
            STATUS_COR[plano.status]
          )}
        >
          {STATUS_LABEL[plano.status]}
        </span>

        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium text-gray-900", !expandido && "line-clamp-2")}>
            {plano.descricao}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {plano.setor && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
                {plano.setor}
              </span>
            )}
            {plano.id_categoria && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-600">
                {categoriasMap[plano.id_categoria] ?? "—"}
              </span>
            )}
            {plano.responsavel && <span>→ {plano.responsavel}</span>}
            {plano.prazo && (
              <span className={cn(vencido && "font-semibold text-red-600")}>
                Prazo: {fmtData(plano.prazo)} {vencido && "⚠ Vencido"}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-gray-400 transition-transform mt-0.5",
            expandido && "rotate-180"
          )}
        />
      </div>

      {expandido && (
        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
          {proximo && (
            <button
              onClick={(e) => { e.stopPropagation(); onAvancar(); }}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {salvando && <Loader2 className="size-3 animate-spin" />}
              → {STATUS_LABEL[proximo]}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDeletar(); }}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
          >
            <Trash2 className="size-3.5" /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Modal de novo plano ──────────────────────────────────────────────────────

function NovoPlanoModal({
  idAplicacao,
  categorias,
  setores,
  onClose,
}: {
  idAplicacao: string;
  categorias: { id_categoria: string; nome: string }[];
  setores: string[];
  onClose: () => void;
}) {
  const criar = useCreateQpsPlano();
  const [descricao, setDescricao] = useState("");
  const [setor, setSetor] = useState("");
  const [idCategoria, setIdCategoria] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) { toast.error("Descrição é obrigatória"); return; }
    try {
      await criar.mutateAsync({
        id_aplicacao: idAplicacao,
        descricao: descricao.trim(),
        setor: setor.trim() || null,
        id_categoria: idCategoria || null,
        responsavel: responsavel.trim() || null,
        prazo: prazo || null,
      });
      toast.success("Plano criado");
      onClose();
    } catch {
      toast.error("Erro ao criar plano");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Novo Plano de Ação"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            form="form-plano"
            type="submit"
            disabled={criar.isPending}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar Plano
          </button>
        </div>
      }
    >
      <form id="form-plano" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Descrição / Ação <span className="text-red-500">*</span>
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
            rows={3}
            placeholder="Descreva a ação corretiva ou preventiva..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Setor</label>
            <input
              list="setores-plano"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="Setor afetado"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="setores-plano">
              {setores.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Dimensão</label>
            <select
              value={idCategoria}
              onChange={(e) => setIdCategoria(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Nenhuma</option>
              {categorias.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Responsável</label>
            <input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Prazo</label>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

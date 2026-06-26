"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, ClipboardList, FileText, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRequireAdmin } from "@/lib/hooks/useRequireAdmin";
import { StatusPendBadge, StatusSolBadge, PrioridadeBadge } from "@/components/portal-cliente/StatusBadgeCliente";
import LiberarParaPortalBtn from "@/components/portal-cliente/LiberarParaPortalBtn";
import { useCriarPendencia, useAtualizarStatusPendencia } from "@/lib/hooks/usePendenciasCliente";
import { useAtualizarStatusSolicitacao } from "@/lib/hooks/useSolicitacoesCliente";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import type { PortalPendenciaCliente, PortalSolicitacaoCliente, PortalDocumentoCliente, PrioridadePortal, StatusPendenciaPortal, StatusSolicitacaoPortal } from "@/lib/supabase/types";

type Aba = "pendencias" | "solicitacoes" | "documentos";

function useTodosPendencias() {
  return useQuery<PortalPendenciaCliente[]>({
    queryKey: ["sst", "portal", "pendencias"],
    staleTime: 30_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_pendencias_cliente")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalPendenciaCliente[];
    },
  });
}

function useTodosSolicitacoes() {
  return useQuery<PortalSolicitacaoCliente[]>({
    queryKey: ["sst", "portal", "solicitacoes"],
    staleTime: 30_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_solicitacoes_cliente")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalSolicitacaoCliente[];
    },
  });
}

function useTodosDocumentos() {
  return useQuery<PortalDocumentoCliente[]>({
    queryKey: ["sst", "portal", "documentos"],
    staleTime: 30_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_documentos_cliente")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalDocumentoCliente[];
    },
  });
}

// ── Aba Pendências ───────────────────────────────────────────
function AbaPendencias() {
  const { data: pendencias, isLoading, error } = useTodosPendencias();
  const { data: empresas } = useEmpresas();
  const atualizarStatus = useAtualizarStatusPendencia();
  const criarPendencia = useCriarPendencia();
  const user = useCurrentUser();
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    empresa_id: "",
    titulo: "",
    descricao: "",
    prioridade: "media" as PrioridadePortal,
    prazo: "",
  });

  function nomeEmpresa(id: string) {
    return empresas?.find((e) => e.id_empresa === id)?.nome_empresa ?? id;
  }

  async function submitNova(e: React.FormEvent) {
    e.preventDefault();
    await criarPendencia.mutateAsync({ ...form, descricao: form.descricao || undefined, prazo: form.prazo || undefined });
    setForm({ empresa_id: "", titulo: "", descricao: "", prioridade: "media", prazo: "" });
    setCriando(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCriando((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus className="size-4" /> Nova pendência
        </button>
      </div>

      {criando && (
        <form onSubmit={submitNova} className="rounded-xl bg-white p-5 ring-1 ring-black/5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Empresa *</label>
              <select
                required
                value={form.empresa_id}
                onChange={(e) => setForm((f) => ({ ...f, empresa_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Selecione…</option>
                {empresas?.map((e) => (
                  <option key={e.id_empresa} value={e.id_empresa}>{e.nome_empresa}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Prioridade</label>
              <select
                value={form.prioridade}
                onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as PrioridadePortal }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Título *</label>
            <input
              required
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
            <textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Prazo</label>
            <input
              type="date"
              value={form.prazo}
              onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCriando(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
            <button type="submit" disabled={criarPendencia.isPending} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
              {criarPendencia.isPending ? <Loader2 className="size-4 animate-spin" /> : "Criar"}
            </button>
          </div>
        </form>
      )}

      {isLoading && <Loader2 className="size-5 animate-spin text-gray-400" />}
      {error && <p className="text-sm text-red-600">Erro ao carregar.</p>}

      <div className="space-y-2">
        {pendencias?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-black/5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-400">{nomeEmpresa(p.empresa_id)}</span>
                <span className="font-semibold text-gray-900 text-sm">{p.titulo}</span>
                <StatusPendBadge status={p.status} />
                <PrioridadeBadge prioridade={p.prioridade} />
                {p.prazo && <span className="text-xs text-gray-400">Prazo: {p.prazo}</span>}
              </div>
            </div>
            <select
              value={p.status}
              onChange={(e) =>
                atualizarStatus.mutate({ id: p.id, status: e.target.value as StatusPendenciaPortal, empresa_id: p.empresa_id })
              }
              className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs focus:outline-none"
            >
              <option value="pendente">Pendente</option>
              <option value="recebido">Recebido</option>
              <option value="em_analise">Em análise</option>
              <option value="resolvido">Resolvido</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Aba Solicitações ─────────────────────────────────────────
function AbaSolicitacoes() {
  const { data: sols, isLoading, error } = useTodosSolicitacoes();
  const { data: empresas } = useEmpresas();
  const atualizarStatus = useAtualizarStatusSolicitacao();

  function nomeEmpresa(id: string) {
    return empresas?.find((e) => e.id_empresa === id)?.nome_empresa ?? id;
  }

  const TIPO_LABEL: Record<string, string> = {
    visita_tecnica: "Visita técnica",
    atualizacao_documento: "Atualização de doc.",
    treinamento: "Treinamento",
    inclusao_setor: "Inclusão de setor",
    inclusao_maquina: "Inclusão de máquina",
    duvida: "Dúvida",
    outro: "Outro",
  };

  return (
    <div className="space-y-2">
      {isLoading && <Loader2 className="size-5 animate-spin text-gray-400" />}
      {error && <p className="text-sm text-red-600">Erro ao carregar.</p>}
      {!isLoading && !error && sols?.length === 0 && (
        <p className="text-sm text-gray-400 italic">Nenhuma solicitação.</p>
      )}
      {sols?.map((s) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-black/5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-400">{nomeEmpresa(s.empresa_id)}</span>
              <span className="font-semibold text-gray-900 text-sm">
                {TIPO_LABEL[s.tipo_solicitacao] ?? s.tipo_solicitacao}
              </span>
              <StatusSolBadge status={s.status} />
              <PrioridadeBadge prioridade={s.prioridade} />
            </div>
            {s.descricao && (
              <p className="mt-1 line-clamp-1 text-xs text-gray-500">{s.descricao}</p>
            )}
          </div>
          <select
            value={s.status}
            onChange={(e) =>
              atualizarStatus.mutate({ id: s.id, status: e.target.value as StatusSolicitacaoPortal, empresa_id: s.empresa_id })
            }
            className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs focus:outline-none"
          >
            <option value="aberta">Aberta</option>
            <option value="em_analise">Em análise</option>
            <option value="em_execucao">Em execução</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      ))}
    </div>
  );
}

// ── Aba Documentos ───────────────────────────────────────────
function AbaDocumentos() {
  const { data: docs, isLoading, error } = useTodosDocumentos();
  const { data: empresas } = useEmpresas();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [empresaId, setEmpresaId] = useState("");

  function nomeEmpresa(id: string) {
    return empresas?.find((e) => e.id_empresa === id)?.nome_empresa ?? id;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Selecione empresa para liberar…</option>
          {empresas?.map((e) => (
            <option key={e.id_empresa} value={e.id_empresa}>{e.nome_empresa}</option>
          ))}
        </select>
        {empresaId && (
          <LiberarParaPortalBtn empresaId={empresaId} size="md" />
        )}
      </div>

      {isLoading && <Loader2 className="size-5 animate-spin text-gray-400" />}
      {error && <p className="text-sm text-red-600">Erro ao carregar.</p>}
      {!isLoading && !error && docs?.length === 0 && (
        <p className="text-sm text-gray-400 italic">Nenhum documento liberado ainda.</p>
      )}

      <div className="space-y-2">
        {docs?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-black/5">
            <FileText className="size-4 shrink-0 text-teal-600" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-400">{nomeEmpresa(d.empresa_id)}</span>
                <span className="font-semibold text-sm text-gray-900">{d.titulo}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{d.tipo_documento}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.status === "liberado" ? "bg-blue-100 text-blue-700" : d.status === "assinado" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {d.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                {d.data_emissao ?? d.criado_em.slice(0, 10)} · v{d.versao}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function PortalSstPage() {
  useRequireAdmin();
  const [aba, setAba] = useState<Aba>("pendencias");

  const ABAS: { id: Aba; label: string; icon: React.ElementType }[] = [
    { id: "pendencias",   label: "Pendências",   icon: ClipboardList },
    { id: "solicitacoes", label: "Solicitações",  icon: MessageSquarePlus },
    { id: "documentos",   label: "Documentos",    icon: FileText },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Portal do Cliente — Gestão</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie pendências, solicitações e documentos do portal
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              aba === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {aba === "pendencias" && <AbaPendencias />}
      {aba === "solicitacoes" && <AbaSolicitacoes />}
      {aba === "documentos" && <AbaDocumentos />}
    </div>
  );
}

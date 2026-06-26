"use client";

import { useState } from "react";
import { MessageSquarePlus, ChevronDown, ChevronUp, Loader2, Send, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useSolicitacoesCliente,
  useSolicitacaoComentarios,
  useSolicitacaoAnexos,
  useCriarSolicitacao,
  useAdicionarComentarioSolicitacao,
} from "@/lib/hooks/useSolicitacoesCliente";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import { StatusSolBadge, PrioridadeBadge } from "./StatusBadgeCliente";
import UploadAnexoCliente, { AnexoItem } from "./UploadAnexoCliente";
import type { PortalSolicitacaoCliente, TipoSolicitacaoPortal, PrioridadePortal } from "@/lib/supabase/types";

const TIPOS: { value: TipoSolicitacaoPortal; label: string }[] = [
  { value: "visita_tecnica",      label: "Visita técnica" },
  { value: "atualizacao_documento", label: "Atualização de documento" },
  { value: "treinamento",         label: "Treinamento" },
  { value: "inclusao_setor",      label: "Inclusão de setor" },
  { value: "inclusao_maquina",    label: "Inclusão de máquina" },
  { value: "duvida",              label: "Dúvida" },
  { value: "outro",               label: "Outro" },
];

function SolDetalhe({ sol, empresaId }: { sol: PortalSolicitacaoCliente; empresaId: string }) {
  const { data: comentarios, isLoading: loadCom, refetch: refCom } = useSolicitacaoComentarios(sol.id);
  const { data: anexos, refetch: refAnx } = useSolicitacaoAnexos(sol.id);
  const addComentario = useAdicionarComentarioSolicitacao();
  const [texto, setTexto] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    await addComentario.mutateAsync({ solicitacaoId: sol.id, empresaId, texto: texto.trim() });
    setTexto("");
    refCom();
  }

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{sol.descricao}</p>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Mensagens</p>
        {loadCom && <Loader2 className="size-4 animate-spin text-gray-400" />}
        {comentarios?.length === 0 && (
          <p className="text-xs italic text-gray-400">Nenhuma mensagem ainda.</p>
        )}
        <div className="space-y-2">
          {comentarios?.map((c) => (
            <div key={c.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">
                {format(new Date(c.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
              <p className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap">{c.texto}</p>
            </div>
          ))}
        </div>
        {sol.status !== "concluida" && sol.status !== "cancelada" && (
          <form onSubmit={enviar} className="mt-3 flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Adicionar mensagem…"
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={!texto.trim() || addComentario.isPending}
              className="self-end rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-50 hover:bg-teal-800"
            >
              {addComentario.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Anexos</p>
        <div className="flex flex-wrap gap-2">
          {anexos?.map((a) => (
            <AnexoItem key={a.id} nome={a.nome_arquivo} storagePath={a.storage_path} />
          ))}
        </div>
        {sol.status !== "concluida" && sol.status !== "cancelada" && (
          <div className="mt-2">
            <UploadAnexoCliente
              empresaId={empresaId}
              referenciaId={sol.id}
              referenciaTipo="solicitacao"
              onUploaded={() => refAnx()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function NovaSolicitacaoForm({
  empresaId,
  onCriado,
}: {
  empresaId: string;
  onCriado: () => void;
}) {
  const criar = useCriarSolicitacao();
  const [tipo, setTipo] = useState<TipoSolicitacaoPortal>("visita_tecnica");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadePortal>("media");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return;
    await criar.mutateAsync({ empresa_id: empresaId, tipo_solicitacao: tipo, descricao: descricao.trim(), prioridade });
    setDescricao("");
    onCriado();
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 space-y-4">
      <h2 className="font-semibold text-gray-900">Nova solicitação</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoSolicitacaoPortal)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Prioridade</label>
          <select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as PrioridadePortal)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          required
          placeholder="Descreva sua solicitação…"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <button
        type="submit"
        disabled={!descricao.trim() || criar.isPending}
        className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Enviar solicitação
      </button>
    </form>
  );
}

export default function SolicitacoesCliente() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? "";
  const { data: sols, isLoading, error } = useSolicitacoesCliente();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [criando, setCriando] = useState(false);

  function toggle(id: string) {
    setAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitações</h1>
          <p className="mt-1 text-sm text-gray-500">Envie solicitações para a equipe técnica</p>
        </div>
        <button
          type="button"
          onClick={() => setCriando((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus className="size-4" />
          Nova solicitação
        </button>
      </div>

      {criando && (
        <NovaSolicitacaoForm empresaId={empresaId} onCriado={() => setCriando(false)} />
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Erro ao carregar solicitações.</p>
      )}
      {!isLoading && !error && sols?.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <MessageSquarePlus className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">Nenhuma solicitação ainda</p>
        </div>
      )}

      {sols && sols.length > 0 && (
        <div className="space-y-3">
          {sols.map((s) => (
            <div key={s.id} className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {TIPOS.find((t) => t.value === s.tipo_solicitacao)?.label ?? s.tipo_solicitacao}
                    </span>
                    <StatusSolBadge status={s.status} />
                    <PrioridadeBadge prioridade={s.prioridade} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {format(new Date(s.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {abertos.has(s.id) ? (
                  <ChevronUp className="size-4 shrink-0 text-gray-400 mt-1" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-gray-400 mt-1" />
                )}
              </button>
              {abertos.has(s.id) && (
                <div className="px-4 pb-4">
                  <SolDetalhe sol={s} empresaId={empresaId} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

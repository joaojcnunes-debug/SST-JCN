"use client";

import { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  usePendenciasCliente,
  usePendenciaComentarios,
  usePendenciaAnexos,
  useResponderPendencia,
} from "@/lib/hooks/usePendenciasCliente";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import { StatusPendBadge, PrioridadeBadge } from "./StatusBadgeCliente";
import UploadAnexoCliente, { AnexoItem } from "./UploadAnexoCliente";
import type { PortalPendenciaCliente } from "@/lib/supabase/types";

function PendenciaDetalhe({ pend, empresaId }: { pend: PortalPendenciaCliente; empresaId: string }) {
  const { data: comentarios, isLoading: loadCom, refetch: refCom } = usePendenciaComentarios(pend.id);
  const { data: anexos, isLoading: loadAnx, refetch: refAnx } = usePendenciaAnexos(pend.id);
  const responder = useResponderPendencia();
  const [texto, setTexto] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    await responder.mutateAsync({ pendenciaId: pend.id, empresaId, texto: texto.trim() });
    setTexto("");
    refCom();
  }

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      {/* Descrição */}
      {pend.descricao && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{pend.descricao}</p>
      )}

      {/* Comentários */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Mensagens
        </p>
        {loadCom && <Loader2 className="size-4 animate-spin text-gray-400" />}
        {comentarios?.length === 0 && (
          <p className="text-xs text-gray-400 italic">Nenhuma mensagem ainda.</p>
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

        {/* Formulário de resposta */}
        {pend.status !== "resolvido" && (
          <form onSubmit={enviar} className="mt-3 flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Escreva sua resposta…"
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={!texto.trim() || responder.isPending}
              className="self-end rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-50 hover:bg-teal-800"
            >
              {responder.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </form>
        )}
      </div>

      {/* Anexos */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Anexos</p>
        {loadAnx && <Loader2 className="size-4 animate-spin text-gray-400" />}
        <div className="flex flex-wrap gap-2">
          {anexos?.map((a) => (
            <AnexoItem key={a.id} nome={a.nome_arquivo} storagePath={a.storage_path} />
          ))}
        </div>
        {pend.status !== "resolvido" && (
          <div className="mt-2">
            <UploadAnexoCliente
              empresaId={empresaId}
              referenciaId={pend.id}
              referenciaTipo="pendencia"
              onUploaded={() => refAnx()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PendenciasCliente() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? "";
  const { data: pendencias, isLoading, error } = usePendenciasCliente();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  function toggleAberto(id: string) {
    setAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pendências</h1>
        <p className="mt-1 text-sm text-gray-500">Itens aguardando sua atenção ou resposta</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Erro ao carregar pendências.</p>
      )}
      {!isLoading && !error && pendencias?.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <MessageSquare className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">Nenhuma pendência no momento</p>
        </div>
      )}

      {pendencias && pendencias.length > 0 && (
        <div className="space-y-3">
          {pendencias.map((p) => {
            const isAberto = abertos.has(p.id);
            return (
              <div key={p.id} className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={() => toggleAberto(p.id)}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{p.titulo}</span>
                      <StatusPendBadge status={p.status} />
                      <PrioridadeBadge prioridade={p.prioridade} />
                    </div>
                    <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
                      <span>{format(new Date(p.criado_em), "dd/MM/yyyy", { locale: ptBR })}</span>
                      {p.prazo && <span>Prazo: {p.prazo}</span>}
                    </div>
                  </div>
                  {isAberto ? (
                    <ChevronUp className="size-4 shrink-0 text-gray-400 mt-1" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-gray-400 mt-1" />
                  )}
                </button>
                {isAberto && (
                  <div className="px-4 pb-4">
                    <PendenciaDetalhe pend={p} empresaId={empresaId} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

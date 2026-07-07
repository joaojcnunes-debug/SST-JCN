"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { iniciais, corAvatar } from "@/lib/hooks/useGestao";
import {
  useInspecaoAssociados,
  useAssociarUsuario,
  useDesassociarUsuario,
  useUsuariosParaAssociar,
} from "@/lib/hooks/useInspecaoAssociados";
import type { Usuario } from "@/lib/supabase/types";

/** Bloco de "Associados" da elaboração (Documento SGG). Vários usuários podem se
 *  associar; admin pode associar/remover qualquer um. Convive com o fluxo de status. */
export default function AssociadosElaboracao({
  idInspecao,
  user,
  isAdmin,
  responsavelNome,
}: {
  idInspecao: string;
  user: Usuario | null;
  isAdmin: boolean;
  /** Quem assumiu a elaboração pelo fluxo de status (elaboracao_responsavel). */
  responsavelNome?: string | null;
}) {
  const { data: associados = [] } = useInspecaoAssociados(idInspecao);
  const { data: usuarios = [] } = useUsuariosParaAssociar();
  const associar = useAssociarUsuario();
  const desassociar = useDesassociarUsuario();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const jaAssociados = new Set(associados.map((a) => a.id_usuario));
  const disponiveis = usuarios.filter((u) => !jaAssociados.has(u.id_usuario));
  const podeRemover = (idUsuario: string) => isAdmin || idUsuario === user?.id_usuario;

  // Quem assumiu pelo fluxo de status, se ainda não estiver na tabela de associados.
  const respTrim = responsavelNome?.trim() || "";
  const respImplicito =
    respTrim && !associados.some((a) => a.nome.trim().toLowerCase() === respTrim.toLowerCase())
      ? respTrim
      : "";

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Associados</span>

        {associados.length === 0 && !respImplicito && (
          <span className="text-xs text-gray-400">Ninguém associado à elaboração.</span>
        )}

        {respImplicito && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2 text-xs"
            title="Assumiu a elaboração (fluxo de status)"
          >
            <span
              className="flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: corAvatar(respImplicito) }}
            >
              {iniciais(respImplicito)}
            </span>
            <span className="text-gray-700">{respImplicito}</span>
          </span>
        )}

        {associados.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2 text-xs"
          >
            <span
              className="flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: corAvatar(a.nome) }}
            >
              {iniciais(a.nome)}
            </span>
            <span className="text-gray-700">{a.nome}</span>
            {podeRemover(a.id_usuario) && (
              <button
                type="button"
                onClick={() => desassociar.mutate({ id_inspecao: idInspecao, id: a.id })}
                disabled={desassociar.isPending}
                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                title="Remover associado"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}

        {isAdmin && disponiveis.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-verde-primary/50 px-2 py-1 text-xs font-medium text-verde-primary hover:bg-verde-primary/5"
            >
              <UserPlus className="size-3" /> Associar usuário
            </button>
            {aberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setAberto(false); setBusca(""); }} />
                <div className="absolute z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="border-b border-gray-100 p-1.5">
                    <input
                      autoFocus
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar usuário..."
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                    />
                  </div>
                  <div className="max-h-52 overflow-auto py-1">
                    {(() => {
                      const filtrados = disponiveis.filter((u) =>
                        u.nome.toLowerCase().includes(busca.trim().toLowerCase()),
                      );
                      if (filtrados.length === 0) {
                        return <p className="px-3 py-2 text-xs text-gray-400">Nenhum usuário encontrado.</p>;
                      }
                      return filtrados.map((u) => (
                        <button
                          key={u.id_usuario}
                          type="button"
                          onClick={() => {
                            associar.mutate({
                              id_inspecao: idInspecao,
                              id_usuario: u.id_usuario,
                              nome: u.nome,
                              created_by: user?.nome ?? null,
                            });
                            setAberto(false);
                            setBusca("");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{ backgroundColor: corAvatar(u.nome) }}
                          >
                            {iniciais(u.nome)}
                          </span>
                          <span className="min-w-0 truncate">{u.nome}</span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

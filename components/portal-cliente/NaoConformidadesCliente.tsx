"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { usePortalNaoConformidades } from "@/lib/hooks/usePortalCliente";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import UploadAnexoCliente, { AnexoItem } from "./UploadAnexoCliente";
import StorageImg from "@/components/ui/StorageImg";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PortalAnexo } from "@/lib/supabase/types";

const CRITICA_COR: Record<string, string> = {
  ALTA:  "text-red-700 bg-red-50",
  MEDIA: "text-yellow-800 bg-yellow-50",
  BAIXA: "text-gray-700 bg-gray-50",
};

const TRAT_COR: Record<string, string> = {
  ABERTA:         "bg-red-100 text-red-800",
  EM_TRATAMENTO:  "bg-yellow-100 text-yellow-800",
  ENCERRADA:      "bg-green-100 text-green-800",
};

function AnexosNc({ itemId, empresaId }: { itemId: string; empresaId: string }) {
  const { data: anexos, refetch } = useQuery<PortalAnexo[]>({
    queryKey: ["portal", "anexos", "nao_conformidade", itemId],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data } = await sb
        .from("portal_anexos")
        .select("*")
        .eq("referencia_tipo", "nao_conformidade")
        .eq("referencia_id", itemId);
      return (data ?? []) as PortalAnexo[];
    },
  });

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Evidências enviadas pelo cliente
      </p>
      <div className="flex flex-wrap gap-2">
        {anexos?.map((a) => (
          <AnexoItem key={a.id} nome={a.nome_arquivo} storagePath={a.storage_path} />
        ))}
      </div>
      <div className="mt-2">
        <UploadAnexoCliente
          empresaId={empresaId}
          referenciaId={itemId}
          referenciaTipo="nao_conformidade"
          onUploaded={() => refetch()}
        />
      </div>
    </div>
  );
}

export default function NaoConformidadesCliente() {
  const { data: relatorios, isLoading, error } = usePortalNaoConformidades();
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? "";
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Não Conformidades</h1>
        <p className="mt-1 text-sm text-gray-500">
          Itens identificados nas inspeções técnicas da sua empresa
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Erro ao carregar dados.</p>
      )}

      {!isLoading && !error && relatorios?.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <AlertTriangle className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">Nenhuma não conformidade registrada</p>
        </div>
      )}

      {relatorios?.map((rel) => {
        const itens = (rel as {
          relatorios_nao_conformidade_itens?: {
            id_item: string;
            descricao: string;
            norma_violada: string | null;
            responsavel_tratativa: string | null;
            criticidade: string | null;
            status_tratativa: string | null;
            prazo: string | null;
            foto_urls: string[] | null;
          }[];
        }).relatorios_nao_conformidade_itens ?? [];

        return (
          <div key={rel.id_relatorio} className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <button
              type="button"
              onClick={() => toggle(rel.id_relatorio)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <p className="font-semibold text-gray-900">{rel.titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {rel.data_inspecao} · {itens.length} item(ns)
                </p>
              </div>
              {abertos.has(rel.id_relatorio) ? (
                <ChevronUp className="size-4 text-gray-400" />
              ) : (
                <ChevronDown className="size-4 text-gray-400" />
              )}
            </button>

            {abertos.has(rel.id_relatorio) && (
              <div className="divide-y px-5 pb-5">
                {itens.map((item) => (
                  <div key={item.id_item} className="py-4 space-y-3">
                    <div className="flex flex-wrap items-start gap-2">
                      {item.criticidade && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            CRITICA_COR[item.criticidade] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.criticidade}
                        </span>
                      )}
                      {item.status_tratativa && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            TRAT_COR[item.status_tratativa] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.status_tratativa.replace("_", " ")}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-800">{item.descricao}</p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                      {item.norma_violada && <span>NR: {item.norma_violada}</span>}
                      {item.responsavel_tratativa && <span>Responsável: {item.responsavel_tratativa}</span>}
                      {item.prazo && <span>Prazo: {item.prazo}</span>}
                    </div>

                    {/* Fotos técnicas */}
                    {item.foto_urls && item.foto_urls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.foto_urls.map((url, i) => (
                          <StorageImg
                            key={i}
                            stored={url}
                            alt={`Foto ${i + 1}`}
                            className="h-20 w-20 rounded-md object-cover ring-1 ring-gray-200"
                          />
                        ))}
                      </div>
                    )}

                    <AnexosNc itemId={item.id_item} empresaId={empresaId} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

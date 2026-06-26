"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { gerarId } from "@/lib/utils";
import {
  BASE_REFERENCIA,
  type AgenteReferencia,
} from "@/lib/quimicos/base_referencia";

/**
 * Linha persistida em `base_referencia_quimicos`. Espelha `AgenteReferencia`
 * + id (chave primária no banco).
 */
export interface AgenteReferenciaRow extends AgenteReferencia {
  id: string;
}

const QUERY_KEY = ["base-referencia-quimicos"] as const;

async function fetchBase(): Promise<AgenteReferenciaRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("base_referencia_quimicos")
    .select("*")
    .order("agente", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AgenteReferenciaRow[];
}

/**
 * Carrega a base de referência do Supabase. Se a tabela estiver vazia
 * (primeira execução), faz fallback pro `BASE_REFERENCIA` estático com
 * IDs sintéticos — assim o lookup determinístico continua funcionando
 * mesmo antes do Admin clicar em "Inicializar".
 */
export function useBaseReferenciaQuimicos() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchBase,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * Variante "merge": sempre devolve alguma coisa. Prioriza Supabase; cai
 * pro estático se a tabela estiver vazia. Use isto em consumidores de
 * lookup (AnaliseForm, etc) que NÃO querem ver lista vazia.
 */
export function useBaseReferenciaQuimicosMerged(): AgenteReferenciaRow[] {
  const { data } = useBaseReferenciaQuimicos();
  if (data && data.length > 0) return data;
  return BASE_REFERENCIA.map((a, idx) => ({
    ...a,
    id: `static:${a.cas ?? idx}:${a.agente}`.slice(0, 200),
  }));
}

export function useInicializarBaseQuimicos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      // Verifica se já tem dados — não sobrescreve
      const { count } = await supabase
        .from("base_referencia_quimicos")
        .select("id", { count: "exact", head: true });
      if ((count ?? 0) > 0) {
        throw new Error(
          "A base já contém registros. Apague-os antes de inicializar."
        );
      }
      const rows = BASE_REFERENCIA.map((a) => ({
        id: gerarId(),
        ...a,
      }));
      // Insere em lotes pra não estourar limite do PostgREST
      const lote = 100;
      for (let i = 0; i < rows.length; i += lote) {
        const { error } = await supabase
          .from("base_referencia_quimicos")
          .insert(rows.slice(i, i + lote) as never);
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(`Erro ao inicializar base: ${e.message}`),
  });
}

export function useUpsertAgenteReferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: AgenteReferenciaRow) => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        ...row,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("base_referencia_quimicos")
        .upsert(payload as never, { onConflict: "id" });
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeleteAgenteReferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await excluirComLixeiraPorId({
        tabela: "base_referencia_quimicos",
        chave: "id",
        id,
        modulo: "config",
        rotuloCol: "agente",
      });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

export function useCriarAgenteReferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novo: AgenteReferencia) => {
      const supabase = createSupabaseBrowserClient();
      const row: AgenteReferenciaRow = { id: gerarId(), ...novo };
      const { error } = await supabase
        .from("base_referencia_quimicos")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(`Erro ao criar: ${e.message}`),
  });
}

export function useApagarTudoBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("base_referencia_quimicos")
        .delete()
        .not("id", "is", null); // delete all
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(`Erro ao apagar base: ${e.message}`),
  });
}

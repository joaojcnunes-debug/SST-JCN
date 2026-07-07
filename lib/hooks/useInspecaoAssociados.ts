"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import type { InspecaoAssociado } from "@/lib/supabase/types";

const KEY = (id: string) => ["inspecao-associados", id];
const KEY_LOTE = "inspecao-associados-lote";

/** Associados da elaboração de UMA inspeção. */
export function useInspecaoAssociados(idInspecao: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idInspecao ?? ""),
    enabled: !!idInspecao,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("inspecao_associados")
        .select("*")
        .eq("id_inspecao", idInspecao!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InspecaoAssociado[];
    },
  });
}

/** Associados de VÁRIAS inspeções (coluna da lista) → Map id_inspecao → associados. */
export function useAssociadosPorInspecao(ids: string[]) {
  const chave = [...ids].sort().join(",");
  return useQuery({
    queryKey: [KEY_LOTE, chave],
    enabled: ids.length > 0,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("inspecao_associados")
        .select("*")
        .in("id_inspecao", ids)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, InspecaoAssociado[]>();
      for (const a of (data ?? []) as unknown as InspecaoAssociado[]) {
        const arr = map.get(a.id_inspecao) ?? [];
        arr.push(a);
        map.set(a.id_inspecao, arr);
      }
      return map;
    },
  });
}

export function useAssociarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_inspecao: string;
      id_usuario: string;
      nome: string;
      created_by?: string | null;
    }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("inspecao_associados").insert({
        id: gerarId("IAS"),
        id_inspecao: p.id_inspecao,
        id_usuario: p.id_usuario,
        nome: p.nome,
        created_by: p.created_by ?? null,
        created_at: new Date().toISOString(),
      } as never);
      // Já associado (unique id_inspecao+id_usuario) → no-op silencioso.
      if (error && !/duplicate key|unique/i.test(error.message ?? "")) throw error;
      return p;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: KEY(p.id_inspecao) });
      qc.invalidateQueries({ queryKey: [KEY_LOTE] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível associar o usuário.")),
  });
}

export function useDesassociarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_inspecao: string; id: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("inspecao_associados").delete().eq("id", p.id);
      if (error) throw error;
      return p;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: KEY(p.id_inspecao) });
      qc.invalidateQueries({ queryKey: [KEY_LOTE] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível remover o associado.")),
  });
}

/** Usuários internos (não-Cliente) para o seletor de "Associar usuário". */
export function useUsuariosParaAssociar() {
  return useQuery({
    queryKey: ["usuarios-associar"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("usuarios")
        .select("id_usuario,nome,email")
        .neq("perfil", "Cliente")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as { id_usuario: string; nome: string; email: string }[];
    },
  });
}

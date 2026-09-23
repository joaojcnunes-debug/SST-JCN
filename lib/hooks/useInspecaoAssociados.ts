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

/**
 * Marca "limpe o responsável" para a RPC `set_elaboracao_documento`: no ramo
 * CONCLUIDO ela preserva o nome quando recebe null (guarda do "Reabrir"), então
 * o pedido explícito vai como string vazia — a v237 converte em null; antes
 * dela fica '' gravado, que toda tela já trata como "sem responsável".
 */
const LIMPAR_RESPONSAVEL = "";

export function useDesassociarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_inspecao: string;
      /** Linha de `inspecao_associados`; null = só o responsável implícito (sem linha). */
      id: string | null;
      /**
       * Quando quem sai é o RESPONSÁVEL da elaboração, apaga o nome do
       * documento também (decisão dele, 21/09: "apague mesmo, caso queira
       * alocar outro usuário"). Até então só a linha de associado sumia e o
       * documento seguia "Em elaboração por X", X seguia no gráfico e o chip
       * voltava — caso vivo INS-219C22EE, 17/09.
       */
      limparResponsavel?: { status: "PENDENTE" | "EM_ELABORACAO" | "CONCLUIDO" | null; concluidaEm: string | null } | null;
    }) => {
      const sb = createSupabaseBrowserClient();
      if (p.id) {
        const { error } = await sb.from("inspecao_associados").delete().eq("id", p.id);
        if (error) throw error;
      }
      if (p.limparResponsavel) {
        const { status, concluidaEm } = p.limparResponsavel;
        // Entregue: fica entregue, na mesma data, sem nome. Em elaboração:
        // volta a Pendente (o mesmo que "Liberar"), para outro poder assumir.
        const args =
          status === "CONCLUIDO"
            ? { p_status: "CONCLUIDO", p_responsavel: LIMPAR_RESPONSAVEL, p_concluida_em: concluidaEm }
            : { p_status: "PENDENTE", p_responsavel: null, p_concluida_em: null };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: e2 } = await (sb as any).rpc("set_elaboracao_documento", { p_id_inspecao: p.id_inspecao, ...args });
        if (e2) throw e2;
      }
      return p;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: KEY(p.id_inspecao) });
      qc.invalidateQueries({ queryKey: [KEY_LOTE] });
      if (p.limparResponsavel) {
        qc.invalidateQueries({ queryKey: ["inspecao", p.id_inspecao] });
        qc.invalidateQueries({ queryKey: ["dashboard-documentos-adm"] });
      }
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

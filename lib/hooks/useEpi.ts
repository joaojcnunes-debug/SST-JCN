"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type {
  EpiColaborador,
  EpiCatalogoItem,
  EpiMovimentacao,
  EpiSaldo,
  EpiTipoMovimentacao,
} from "@/lib/epi/types";

function emailAtual(): string | null {
  return useUserStore.getState().user?.email ?? null;
}

// ============================================================
// COLABORADORES (roster da empresa)
// ============================================================
export function useEpiColaboradores(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-colaboradores", empresaId],
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_colaboradores")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EpiColaborador[];
    },
  });
}

export function useSalvarColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      c: Partial<EpiColaborador> & { empresa_id: string }
    ) => {
      const sb = createSupabaseBrowserClient();
      if (c.id) {
        const { id, ...rest } = c;
        const { error } = await sb
          .from("epi_colaboradores")
          .update({ ...rest, updated_at: new Date().toISOString() } as never)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const id = gerarId("COL");
      const { error } = await sb
        .from("epi_colaboradores")
        .insert({ ...c, id, criado_por: emailAtual() } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-colaboradores", vars.empresa_id] });
      toast.success("Colaborador salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; empresa_id: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("epi_colaboradores")
        .delete()
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-colaboradores", vars.empresa_id] });
      toast.success("Colaborador removido");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// CATÁLOGO DE EPI
// ============================================================
export function useEpiCatalogo(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-catalogo", empresaId],
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_catalogo")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EpiCatalogoItem[];
    },
  });
}

export function useSalvarEpiItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      c: Partial<EpiCatalogoItem> & { empresa_id: string }
    ) => {
      const sb = createSupabaseBrowserClient();
      if (c.id) {
        const { id, ...rest } = c;
        const { error } = await sb
          .from("epi_catalogo")
          .update({ ...rest, updated_at: new Date().toISOString() } as never)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const id = gerarId("EPI");
      const { error } = await sb
        .from("epi_catalogo")
        .insert({ ...c, id, criado_por: emailAtual() } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-catalogo", vars.empresa_id] });
      toast.success("EPI salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirEpiItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; empresa_id: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("epi_catalogo").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-catalogo", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-saldo", vars.empresa_id] });
      toast.success("EPI removido");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// MOVIMENTAÇÕES (append-only) + SALDO
// ============================================================
export function useEpiMovimentacoes(
  empresaId: string | null | undefined,
  idCatalogo?: string | null
) {
  return useQuery({
    queryKey: ["epi-movimentacoes", empresaId, idCatalogo ?? null],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      let q = sb
        .from("epi_movimentacoes")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false })
        .limit(500);
      if (idCatalogo) q = q.eq("id_catalogo", idCatalogo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EpiMovimentacao[];
    },
  });
}

export interface RegistrarMovArgs {
  empresa_id: string;
  id_catalogo: string;
  tipo: EpiTipoMovimentacao;
  quantidade: number;
  origem?: string;
  ref_id?: string | null;
  motivo?: string | null;
  responsavel?: string | null;
}

export function useRegistrarMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RegistrarMovArgs) => {
      const sb = createSupabaseBrowserClient();
      const id = gerarId("MOV");
      const { error } = await sb.from("epi_movimentacoes").insert({
        id,
        empresa_id: args.empresa_id,
        id_catalogo: args.id_catalogo,
        tipo: args.tipo,
        quantidade: args.quantidade,
        origem: args.origem ?? "manual",
        ref_id: args.ref_id ?? null,
        motivo: args.motivo ?? null,
        responsavel: args.responsavel ?? null,
        criado_por: emailAtual(),
      } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-movimentacoes", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-saldo", vars.empresa_id] });
      toast.success("Movimentação registrada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Saldo por item (Map id_catalogo -> saldo), derivado da view v_epi_saldo. */
export function useEpiSaldo(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-saldo", empresaId],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("v_epi_saldo")
        .select("*")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as EpiSaldo[];
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.id_catalogo, Number(r.saldo) || 0);
      return map;
    },
  });
}

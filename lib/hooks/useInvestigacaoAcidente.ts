"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import type { InvestigacaoAcidente } from "@/lib/supabase/types";

export interface InvestigacaoListItem {
  id_investigacao: string;
  id_empresa: string;
  empresaNome: string;
  acidentado_nome: string | null;
  data_acidente: string | null;
  gravidade: string | null;
  status: string;
  data_validade: string | null;
  updated_at: string | null;
  created_at: string;
}

const COLS_LISTA =
  "id_investigacao,id_empresa,acidentado_nome,data_acidente,gravidade,status,data_validade,updated_at,created_at,empresas(nome_empresa)";

export function useInvestigacoesAcidente() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" && user.empresas_vinculadas?.length
      ? user.empresas_vinculadas
      : null;

  return useQuery({
    queryKey: ["investigacoes-acidente", vinculos],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      let q = sb
        .from("investigacoes_acidente")
        .select(COLS_LISTA)
        .neq("status", "DELETADA")
        .order("created_at", { ascending: false });
      if (vinculos) q = q.in("id_empresa", vinculos);
      const { data, error } = await q;
      if (error) throw error;
      type Raw = Omit<InvestigacaoListItem, "empresaNome"> & {
        empresas: { nome_empresa: string } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        ...r,
        empresaNome: r.empresas?.nome_empresa ?? "—",
      })) as InvestigacaoListItem[];
    },
  });
}

export function useInvestigacaoAcidente(id: string | null | undefined) {
  return useQuery({
    queryKey: ["investigacao-acidente", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("investigacoes_acidente")
        .select("*")
        .eq("id_investigacao", id!)
        .single();
      if (error) throw error;
      return data as unknown as InvestigacaoAcidente;
    },
  });
}

export function useCriarInvestigacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_empresa: string) => {
      const sb = createSupabaseBrowserClient();
      const id = gerarId("INV");
      const now = new Date().toISOString();
      const { error } = await sb.from("investigacoes_acidente").insert({
        id_investigacao: id,
        id_empresa,
        status: "RASCUNHO",
        houve_afastamento: false,
        testemunhas: [],
        cinco_porques: [],
        foto_urls: [],
        foto_legendas: [],
        data_investigacao: now.slice(0, 10),
        created_at: now,
        updated_at: now,
      } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investigacoes-acidente"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível criar a investigação.")),
  });
}

export function useSalvarInvestigacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: { id_investigacao: string } & Partial<InvestigacaoAcidente>,
    ) => {
      const { id_investigacao, ...patch } = payload;
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("investigacoes_acidente")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id_investigacao", id_investigacao);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["investigacao-acidente", v.id_investigacao] });
      qc.invalidateQueries({ queryKey: ["investigacoes-acidente"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar.")),
  });
}

/** Cria uma ação 5W2H no Plano de Ação central a partir das medidas da investigação. */
export function useEnviarMedidasParaPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inv: InvestigacaoAcidente) => {
      if (!inv.medidas?.trim()) throw new Error("Não há medidas para enviar.");
      const sb = createSupabaseBrowserClient();
      const prioridade =
        inv.gravidade === "FATAL" ? "Critica" : inv.gravidade === "GRAVE" ? "Alta" : "Media";
      const now = new Date().toISOString();
      const { error } = await sb.from("acoes_5w2h").insert({
        id_acao: gerarId("ACA"),
        id_empresa: inv.id_empresa,
        what_acao: inv.medidas,
        why_justificativa: `Medida corretiva da investigação de acidente${inv.acidentado_nome ? ` — ${inv.acidentado_nome}` : ""}`,
        where_local: inv.local_acidente,
        who_responsavel: inv.responsavel_tecnico,
        status: "Pendente",
        prioridade,
        observacoes: `Origem: Investigação de Acidente de Trabalho (${inv.id_investigacao})`,
        created_at: now,
        updated_at: now,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
      toast.success("Ação criada no Plano de Ação");
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível enviar ao Plano de Ação.")),
  });
}

export function useExcluirInvestigacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("investigacoes_acidente")
        .update({ status: "DELETADA", updated_at: new Date().toISOString() } as never)
        .eq("id_investigacao", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investigacoes-acidente"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type { AetRelatorio, AetSetor, StatusAET } from "@/lib/supabase/types";

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useAetRelatorios(empresaId?: string | null) {
  const user = useUserStore((s) => s.user);

  return useQuery({
    queryKey: ["aet-relatorios", empresaId ?? "todos"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("aet_relatorios")
        .select("*, empresas(nome_empresa, cnpj)")
        .order("created_at", { ascending: false });

      if (empresaId) {
        q = q.eq("id_empresa", empresaId);
      } else if (user?.perfil === "Tecnico" && user.empresas_vinculadas?.length) {
        q = q.in("id_empresa", user.empresas_vinculadas);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AetRelatorio[];
    },
  });
}

export function useAetRelatorio(id: string | null | undefined) {
  return useQuery({
    queryKey: ["aet-relatorio", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_relatorios")
        .select("*, empresas(nome_empresa, cnpj)")
        .eq("id_relatorio", id!)
        .single();
      if (error) throw error;
      return data as unknown as AetRelatorio;
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCriarAet() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (payload: {
      id_empresa: string;
      responsavel_elaboracao: string;
      titulo_profissional: string;
      registro_profissional: string;
      data_elaboracao: string | null;
    }): Promise<AetRelatorio> => {
      const supabase = createSupabaseBrowserClient();
      const row = {
        ...payload,
        status: "RASCUNHO" as StatusAET,
        setores: [],
        consideracoes_finais: "",
        usuario: user?.id_usuario ?? null,
      };
      const { data, error } = await supabase
        .from("aet_relatorios")
        .insert(row as never)
        .select("*, empresas(nome_empresa, cnpj)")
        .single();
      if (error) throw error;
      return data as unknown as AetRelatorio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-relatorios"] });
    },
  });
}

export function useSalvarAet() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Omit<AetRelatorio, "id_relatorio" | "created_at" | "empresas">>;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_relatorios")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id_relatorio", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["aet-relatorio", id] });
      qc.invalidateQueries({ queryKey: ["aet-relatorios"] });
    },
  });
}

export function useExcluirAet() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_relatorios")
        .delete()
        .eq("id_relatorio", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-relatorios"] });
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function setorVazio(): AetSetor {
  return {
    id: crypto.randomUUID(),
    nome_setor: "",
    maquinas_equipamentos: "",
    cargos: "",
    descricao_atividade: "",
    riscos: [],
    owas: { posturas_costas: [], posturas_bracos: [], posturas_pernas: [], esforco: [] },
    checklist: {
      levantamento_acima_limite: false,
      posturas_forcadas_tipo: "Ocasionais",
      trabalho_predominante: "Em pé",
      pausas_descanso: true,
      uso_cadeira: false,
      cadeira_adequada: false,
      monitor: false,
      exigencia_levantamento: false,
      ritmo_por_demanda: true,
      pausas_formais: true,
      rodizios_sistematizados: false,
    },
    fotos: [],
    parecer_tecnico: "",
    recomendacoes: "",
  };
}

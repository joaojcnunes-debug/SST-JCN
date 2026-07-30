"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { CATALOGO_NR12 } from "@/lib/apreciacao-maquinas/catalogo-nr12";
import type { FichaMaquina } from "@/lib/supabase/types";

const KEY = (idApreciacao: string | null | undefined) =>
  ["fichas-maquina", idApreciacao] as const;

/** Fichas de máquina de um laudo (ordenadas). */
export function useFichasMaquina(idApreciacao: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idApreciacao),
    enabled: !!idApreciacao,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("apreciacao_fichas_maquina")
        .select("*")
        .eq("id_apreciacao", idApreciacao!)
        .order("numero_ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FichaMaquina[];
    },
  });
}

export interface FichaMaquinaInput {
  id_maquina?: string | null;
  maquina_descricao?: string | null;
  equipamento?: string | null;
  tipo?: string | null;
  modelo?: string | null;
  fabricante?: string | null;
  serie?: string | null;
  ano?: string | null;
  capacidade?: string | null;
  setor?: string | null;
  componentes_maquina?: string[] | null;
  limite_uso?: string | null;
  limite_espaco?: string | null;
  limite_tempo?: string | null;
  limite_produtividade?: string | null;
  npe?: string | null;
  sistemas_atual?: string[] | null;
  sistemas_necessario?: string[] | null;
  constatacoes_inspecao?: string | null;
  parecer_tecnico?: string | null;
  operadores?: string | null;
  prioridade_manual?: boolean;
}

export function useCriarFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FichaMaquinaInput): Promise<FichaMaquina> => {
      const supabase = createSupabaseBrowserClient();

      // Próximo número de ordem (maior existente + 1).
      const { data: ultima } = await supabase
        .from("apreciacao_fichas_maquina")
        .select("numero_ordem")
        .eq("id_apreciacao", idApreciacao)
        .order("numero_ordem", { ascending: false })
        .limit(1);
      const numero_ordem =
        (((ultima?.[0] as { numero_ordem?: number } | undefined)?.numero_ordem) ?? 0) + 1;

      const row: FichaMaquina = {
        id_ficha: gerarId("APF"),
        id_apreciacao: idApreciacao,
        numero_ordem,
        id_maquina: input.id_maquina ?? null,
        maquina_descricao: input.maquina_descricao ?? null,
        equipamento: input.equipamento ?? null,
        tipo: input.tipo ?? null,
        modelo: input.modelo ?? null,
        fabricante: input.fabricante ?? null,
        serie: input.serie ?? null,
        ano: input.ano ?? null,
        capacidade: input.capacidade ?? null,
        setor: input.setor ?? null,
        componentes_maquina: input.componentes_maquina ?? null,
        limite_uso: input.limite_uso ?? null,
        limite_espaco: input.limite_espaco ?? null,
        limite_tempo: input.limite_tempo ?? null,
        limite_produtividade: input.limite_produtividade ?? null,
        npe: input.npe ?? null,
        sistemas_atual: input.sistemas_atual ?? null,
        sistemas_necessario: input.sistemas_necessario ?? null,
        constatacoes_inspecao: input.constatacoes_inspecao ?? null,
        parecer_tecnico: input.parecer_tecnico ?? null,
        operadores: input.operadores ?? null,
        prioridade_manual: input.prioridade_manual ?? false,
        foto_urls: [],
        foto_storage_paths: [],
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const { error } = await supabase
        .from("apreciacao_fichas_maquina")
        .insert(row as never);
      if (error) throw error;

      // Snapshot do checklist NR-12 para ESTA máquina (por ficha).
      const itens = CATALOGO_NR12.map((it, idx) => ({
        id_item: gerarId("APRI"),
        id_apreciacao: idApreciacao,
        id_ficha: row.id_ficha,
        item_codigo: it.codigo,
        item_categoria: it.categoria,
        item_titulo: it.titulo,
        item_descricao: it.descricao ?? null,
        item_origem: null,
        ordem: idx,
        situacao: "PENDENTE",
        observacao: null,
        recomendacao: null,
        probabilidade: null,
        severidade: null,
        nivel_risco_calculado: null,
        id_matriz: null,
        foto_urls: [] as string[],
        foto_storage_paths: [] as string[],
        foto_legendas: [] as string[],
        created_at: new Date().toISOString(),
        updated_at: null,
      }));
      const { error: eItens } = await supabase
        .from("apreciacoes_maquinas_itens")
        .insert(itens as never);
      if (eItens) throw eItens;

      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
      // o editor lê o checklist via useApreciacaoMaquina (KEY_DETALHE)
      qc.invalidateQueries({ queryKey: ["apreciacao-maquina", idApreciacao] });
    },
    onError: (e: Error) => toast.error(`Erro ao adicionar máquina: ${e.message}`),
  });
}

export function useAtualizarFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: { id_ficha: string } & Partial<FichaMaquinaInput>
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { id_ficha, ...patch } = params;
      const { error } = await supabase
        .from("apreciacao_fichas_maquina")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id_ficha", id_ficha);
      if (error) throw error;
      return params;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(idApreciacao) }),
    onError: (e: Error) => toast.error(`Erro ao atualizar máquina: ${e.message}`),
  });
}

export function useExcluirFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_ficha: string) => {
      const supabase = createSupabaseBrowserClient();

      // Remove as fotos da própria ficha do Storage (as filhas caem por cascade).
      const { data: ficha } = await supabase
        .from("apreciacao_fichas_maquina")
        .select("foto_storage_paths")
        .eq("id_ficha", id_ficha)
        .maybeSingle();
      const paths =
        (ficha as { foto_storage_paths?: string[] } | null)?.foto_storage_paths ?? [];
      if (paths.length > 0) {
        await supabase.storage.from("fotos").remove(paths);
      }

      const { error } = await supabase
        .from("apreciacao_fichas_maquina")
        .delete()
        .eq("id_ficha", id_ficha);
      if (error) throw error;
      return id_ficha;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
      // As linhas HRN/itens da ficha somem por cascade — invalida as visões.
      qc.invalidateQueries({ queryKey: ["riscos-hrn"] });
      qc.invalidateQueries({ queryKey: ["riscos-hrn-ficha"] });
    },
    onError: (e: Error) => toast.error(`Erro ao excluir máquina: ${e.message}`),
  });
}

export interface ApreciacaoDashboard {
  /** nº de máquinas (fichas) por laudo */
  fichasCount: Record<string, number>;
  /** classificação de cada linha HRN (residual quando houver, senão inicial) */
  riscos: { id_apreciacao: string; classe: string | null }[];
}

/** Resumo p/ a Visão Geral: contagem de máquinas por laudo + classes de risco. */
export function useApreciacaoDashboard() {
  return useQuery({
    queryKey: ["apreciacao-dashboard"],
    queryFn: async (): Promise<ApreciacaoDashboard> => {
      const supabase = createSupabaseBrowserClient();
      const [fichasRes, riscosRes] = await Promise.all([
        supabase.from("apreciacao_fichas_maquina").select("id_apreciacao"),
        supabase
          .from("apreciacao_riscos_hrn")
          .select("id_apreciacao, classificacao_risco, classificacao_residual"),
      ]);
      if (fichasRes.error) throw fichasRes.error;
      if (riscosRes.error) throw riscosRes.error;

      const fichasCount: Record<string, number> = {};
      for (const f of (fichasRes.data ?? []) as { id_apreciacao: string }[]) {
        fichasCount[f.id_apreciacao] = (fichasCount[f.id_apreciacao] ?? 0) + 1;
      }
      const riscos = (
        (riscosRes.data ?? []) as {
          id_apreciacao: string;
          classificacao_risco: string | null;
          classificacao_residual: string | null;
        }[]
      ).map((r) => ({
        id_apreciacao: r.id_apreciacao,
        classe: r.classificacao_residual || r.classificacao_risco,
      }));

      return { fichasCount, riscos };
    },
    staleTime: 30 * 1000,
  });
}

/** Reordena as fichas: recebe os id_ficha na ordem desejada. */
export function useReordenarFichas(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idsNaOrdem: string[]) => {
      const supabase = createSupabaseBrowserClient();
      await Promise.all(
        idsNaOrdem.map((id_ficha, idx) =>
          supabase
            .from("apreciacao_fichas_maquina")
            .update({ numero_ordem: idx + 1 } as never)
            .eq("id_ficha", id_ficha)
        )
      );
      return idsNaOrdem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(idApreciacao) }),
    onError: (e: Error) => toast.error(`Erro ao reordenar: ${e.message}`),
  });
}

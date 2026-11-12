"use client";

// 11/11/2026 — leituras para a página Automações e para os resumos em português da janela de Automações:
// todas as regras, etapas, campos e modelos de TODOS os quadros (a RLS decide o que cada um vê; a página
// só abre para a função TI, que é gestor da Gestão e vê tudo).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GestaoAutomacao } from "@/lib/hooks/useGestao";
import type { Nomes } from "@/lib/gestao/automacao-descricao";

export function useTodasAutomacoes(ativo = true) {
  return useQuery({
    queryKey: ["gestao-automacoes", "todas"],
    enabled: ativo,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_automacoes").select("*").order("id_quadro").order("ordem", { ascending: true }).limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as GestaoAutomacao[];
    },
  });
}

interface EtapaMin { id_quadro: string; slug: string; nome: string; ordem: number }
interface CampoMin { id: string; nome: string }
interface ModeloMin { id_quadro: string; slug: string; titulo: string }

/** Nomes de todas as etapas, campos e modelos — para escrever as regras em português. */
export function useNomesAutomacao(ativo = true) {
  return useQuery({
    queryKey: ["gestao-automacoes", "nomes"],
    enabled: ativo,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const [et, ca, mo] = await Promise.all([
        sb.from("gestao_status").select("id_quadro,slug,nome,ordem").order("ordem").limit(5000),
        sb.from("gestao_campos").select("id,nome").limit(5000),
        sb.from("gestao_subtarefa_modelos").select("id_quadro,slug,titulo").limit(5000),
      ]);
      if (et.error) throw et.error;
      if (ca.error) throw ca.error;
      if (mo.error) throw mo.error;
      const etapasDeQuadro: Record<string, Record<string, string>> = {};
      for (const e of (et.data ?? []) as EtapaMin[]) (etapasDeQuadro[e.id_quadro] ??= {})[e.slug] = e.nome;
      const campos: Record<string, string> = {};
      for (const c of (ca.data ?? []) as CampoMin[]) campos[c.id] = c.nome;
      const modelosDeQuadro: Record<string, Record<string, string>> = {};
      for (const m of (mo.data ?? []) as ModeloMin[]) (modelosDeQuadro[m.id_quadro] ??= {})[m.slug] = m.titulo;
      return { etapasDeQuadro, campos, modelosDeQuadro };
    },
  });
}

/** Monta os nomes de UMA regra (as etapas e modelos do quadro dela). */
export function nomesDoQuadro(
  idQuadro: string,
  base: { etapasDeQuadro: Record<string, Record<string, string>>; campos: Record<string, string>; modelosDeQuadro: Record<string, Record<string, string>> } | undefined,
  quadros: Record<string, string>,
  pessoas: Record<string, string>,
): Nomes {
  return {
    etapas: base?.etapasDeQuadro[idQuadro] ?? {},
    etapasDeQuadro: base?.etapasDeQuadro ?? {},
    campos: base?.campos ?? {},
    modelos: base?.modelosDeQuadro[idQuadro] ?? {},
    quadros,
    pessoas,
  };
}

/** Grava a ordem nova (10, 20, 30…) só das regras que mudaram de posição. */
export function useReordenarAutomacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itens: { id: string; ordem: number }[]) => {
      const sb = createSupabaseBrowserClient();
      for (const it of itens) {
        const { error } = await sb.from("gestao_automacoes").update({ ordem: it.ordem } as never).eq("id", it.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-automacoes"] }),
  });
}

"use client";

/**
 * Padrão semanal — o que alimenta a grade mensal.
 *
 * Vigência: mudar a escala de alguém NÃO reescreve mês já fechado. Ao gravar um
 * padrão novo para o mesmo (supervisor, dia), o padrão anterior é FECHADO na
 * véspera em vez de sobrescrito, e o histórico continua explicável.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { dataPura, paraDataLocal } from "@/lib/escala/datas";
import {
  alocacaoParaColunas,
  type Alocacao,
  type DiaUtilSemana,
  type EscalaPadraoSemanal,
} from "@/lib/escala/tipos";

export const CHAVE_PADRAO = ["escala", "padrao"] as const;

/**
 * Padrões vigentes numa data (default: hoje). Passe `todas: true` para trazer
 * também os já encerrados — é o que a tela de histórico precisa.
 */
export function useEscalaPadrao(opts: { emData?: string; todas?: boolean } = {}) {
  const emData = opts.emData ?? hojeIso();
  const todas = opts.todas ?? false;
  return useQuery({
    queryKey: [...CHAVE_PADRAO, todas ? "todas" : emData],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase.from("escala_padrao_semanal").select("*");
      if (!todas) {
        q = q.lte("vigencia_inicio", emData).or(`vigencia_fim.is.null,vigencia_fim.gte.${emData}`);
      }
      const { data, error } = await q
        .order("id_supervisor", { ascending: true })
        .order("dia_semana", { ascending: true })
        .order("vigencia_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaPadraoSemanal[];
    },
  });
}

function hojeIso(): string {
  const d = new Date();
  return dataPura(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** A véspera de uma data pura, sem passar por fuso. */
function vespera(iso: string): string {
  const d = paraDataLocal(iso);
  d.setDate(d.getDate() - 1);
  return dataPura(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export interface PadraoForm {
  id_supervisor: string;
  dia_semana: DiaUtilSemana;
  alocacao: Alocacao;
  /** Quando o padrão novo passa a valer. Default: hoje. */
  vigencia_inicio?: string;
}

/**
 * Grava o padrão de um (supervisor, dia da semana).
 *
 * Duas gravações, nesta ordem:
 *   1. fecha o padrão vigente na véspera do início do novo;
 *   2. insere o novo, aberto.
 *
 * Se já existir padrão começando EXATAMENTE na mesma data, ele é atualizado no
 * lugar — senão o índice único (id_supervisor, dia_semana, vigencia_inicio)
 * recusaria a linha.
 */
export function useSalvarPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: PadraoForm) => {
      const supabase = createSupabaseBrowserClient();
      const inicio = form.vigencia_inicio ?? hojeIso();
      const colunas = alocacaoParaColunas(form.alocacao);

      const { data: existentes, error: erroLer } = await supabase
        .from("escala_padrao_semanal")
        .select("*")
        .eq("id_supervisor", form.id_supervisor)
        .eq("dia_semana", form.dia_semana);
      if (erroLer) throw erroLer;
      const linhas = (existentes ?? []) as unknown as EscalaPadraoSemanal[];

      const mesmoInicio = linhas.find((l) => l.vigencia_inicio === inicio);
      if (mesmoInicio) {
        const { error } = await supabase
          .from("escala_padrao_semanal")
          .update({ ...colunas, updated_at: new Date().toISOString() } as never)
          .eq("id_padrao", mesmoInicio.id_padrao);
        if (error) throw error;
        return mesmoInicio.id_padrao;
      }

      // Fecha os abertos que começaram antes. Sem isto, duas vigências ficariam
      // válidas ao mesmo tempo — o banco não impede (exigiria btree_gist).
      const abertosAnteriores = linhas.filter(
        (l) => l.vigencia_fim === null && l.vigencia_inicio < inicio
      );
      for (const l of abertosAnteriores) {
        const { error } = await supabase
          .from("escala_padrao_semanal")
          .update({ vigencia_fim: vespera(inicio), updated_at: new Date().toISOString() } as never)
          .eq("id_padrao", l.id_padrao);
        if (error) throw error;
      }

      const id_padrao = gerarId("EPAD");
      const { error } = await supabase.from("escala_padrao_semanal").insert({
        id_padrao,
        id_supervisor: form.id_supervisor,
        dia_semana: form.dia_semana,
        ...colunas,
        vigencia_inicio: inicio,
        vigencia_fim: null,
        created_at: new Date().toISOString(),
      } as never);
      if (error) throw error;
      return id_padrao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_PADRAO });
      toast.success("Padrão salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Encerra o padrão numa data, sem colocar outro no lugar. */
export function useEncerrarPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_padrao, em }: { id_padrao: string; em?: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("escala_padrao_semanal")
        .update({ vigencia_fim: em ?? hojeIso(), updated_at: new Date().toISOString() } as never)
        .eq("id_padrao", id_padrao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_PADRAO });
      toast.success("Padrão encerrado");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Indexa o padrão por `${id_supervisor}|${dia_semana}` — o formato da grade. */
export function indexarPadrao(linhas: EscalaPadraoSemanal[]): Map<string, EscalaPadraoSemanal> {
  const m = new Map<string, EscalaPadraoSemanal>();
  for (const l of linhas) {
    const chave = `${l.id_supervisor}|${l.dia_semana}`;
    const atual = m.get(chave);
    // A consulta já vem com vigencia_inicio desc, mas não confie na ordem:
    // quem chamar com uma lista própria receberia o padrão errado em silêncio.
    if (!atual || l.vigencia_inicio > atual.vigencia_inicio) m.set(chave, l);
  }
  return m;
}

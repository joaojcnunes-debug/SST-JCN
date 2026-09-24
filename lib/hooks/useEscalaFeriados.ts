"use client";

/**
 * Feriados da escala. Não existia nenhuma noção de feriado no painel antes da
 * v190 — esta é a primeira.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { intervaloDoMes } from "@/lib/escala/datas";
import type { AbrangenciaFeriado, EscalaFeriado, TipoFeriado } from "@/lib/escala/tipos";

export const CHAVE_FERIADOS = ["escala", "feriados"] as const;

/** Feriados do ano, em ordem de data. */
export function useEscalaFeriados(ano: number) {
  return useQuery({
    queryKey: [...CHAVE_FERIADOS, ano],
    // Feriado praticamente não muda dentro de uma sessão: 5 min de cache poupa
    // uma ida ao servidor a cada troca de mês na grade.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("escala_feriados")
        .select("*")
        .gte("data", `${ano}-01-01`)
        .lte("data", `${ano}-12-31`)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaFeriado[];
    },
  });
}

/** Feriados de um mês só. `mes` é 1..12. */
export function useEscalaFeriadosDoMes(ano: number, mes: number) {
  const { inicio, fim } = intervaloDoMes(ano, mes);
  return useQuery({
    queryKey: [...CHAVE_FERIADOS, "mes", inicio],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("escala_feriados")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaFeriado[];
    },
  });
}

export interface FeriadoForm {
  id_feriado?: string;
  data: string;
  descricao: string;
  abrangencia: AbrangenciaFeriado;
  municipio?: string | null;
  tipo?: TipoFeriado;
}

export function useSalvarFeriado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FeriadoForm) => {
      const supabase = createSupabaseBrowserClient();
      const municipio = form.municipio?.trim() || null;
      // O banco recusa municipal sem município (CHECK). Barrar aqui dá uma
      // mensagem que a pessoa entende, em vez do 400 cru do PostgREST.
      if (form.abrangencia === "municipal" && !municipio) {
        throw new Error("Feriado municipal precisa do município.");
      }
      const base = {
        data: form.data,
        descricao: form.descricao.trim(),
        abrangencia: form.abrangencia,
        municipio,
        tipo: form.tipo ?? "feriado",
      };
      if (form.id_feriado) {
        const { error } = await supabase
          .from("escala_feriados")
          .update(base as never)
          .eq("id_feriado", form.id_feriado);
        if (error) throw error;
        return form.id_feriado;
      }
      const id_feriado = gerarId("EFER");
      const { error } = await supabase
        .from("escala_feriados")
        .insert({ id_feriado, ...base, created_at: new Date().toISOString() } as never);
      if (error) throw error;
      return id_feriado;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_FERIADOS });
      toast.success("Feriado salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/**
 * Apaga um feriado. Diferente de supervisor, aqui excluir é seguro: feriado não
 * tem filho e o semeador (`escala_semear_feriados`) recria os oficiais.
 */
export function useExcluirFeriado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_feriado: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("escala_feriados").delete().eq("id_feriado", id_feriado);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_FERIADOS });
      toast.success("Feriado excluído");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/**
 * Semeia os feriados oficiais de um ano chamando a função do banco
 * (`escala_semear_feriados`), que deriva Carnaval, Sexta-feira da Paixão e
 * Corpus Christi da Páscoa. Idempotente: não duplica nem sobrescreve correção
 * feita à mão. Devolve quantos entraram.
 */
export function useSemearFeriados() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ano: number) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await (
        supabase as unknown as {
          rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T; error: { message: string } | null }>;
        }
      ).rpc<number>("escala_semear_feriados", { p_ano: ano });
      if (error) throw error;
      return data ?? 0;
    },
    onSuccess: (quantos, ano) => {
      qc.invalidateQueries({ queryKey: CHAVE_FERIADOS });
      toast.success(
        quantos > 0
          ? `${quantos} feriado(s) de ${ano} adicionados`
          : `Os feriados de ${ano} já estavam cadastrados`
      );
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

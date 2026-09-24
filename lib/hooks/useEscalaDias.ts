"use client";

/**
 * Grade mensal (`escala_dias`) e a trilha de alterações (`escala_log`).
 *
 * A REGRA DE OURO do módulo mora aqui: um dia com `origem = "manual"` nunca é
 * sobrescrito por uma regeração. Quem grava à mão pela tela vira `manual`; a
 * geração pelo padrão (Fase 5) só toca `padrao`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { intervaloDoMes } from "@/lib/escala/datas";
import { alocacaoParaColunas, type Alocacao, type EscalaDia, type EscalaLog } from "@/lib/escala/tipos";

export const CHAVE_DIAS = ["escala", "dias"] as const;
export const CHAVE_LOG = ["escala", "log"] as const;

/** Todos os dias do mês, de todos os supervisores. `mes` é 1..12. */
export function useEscalaDias(ano: number, mes: number) {
  const { inicio, fim } = intervaloDoMes(ano, mes);
  return useQuery({
    queryKey: [...CHAVE_DIAS, inicio],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("escala_dias")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaDia[];
    },
  });
}

/** Indexa por `${id_supervisor}|${data}` — como a grade lê célula a célula. */
export function indexarDias(linhas: EscalaDia[]): Map<string, EscalaDia> {
  return new Map(linhas.map((l) => [`${l.id_supervisor}|${l.data}`, l]));
}

export interface DiaForm {
  id_supervisor: string;
  data: string;
  alocacao: Alocacao;
  observacao?: string | null;
  /**
   * Default "manual" — o caminho normal deste hook é a edição pela tela, e o que
   * a pessoa digitou tem que sobreviver a uma regeração. A geração da Fase 5
   * passa "padrao" explicitamente.
   */
  origem?: EscalaDia["origem"];
}

/**
 * Grava um dia. Upsert por (id_supervisor, data), que é o único do banco.
 *
 * Registra em `escala_log` o antes e o depois. O log é best-effort: se ele
 * falhar, a gravação NÃO é desfeita — perder a escala porque a auditoria falhou
 * seria pior que perder a linha de auditoria. A falha aparece no console.
 */
export function useSalvarDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: DiaForm) => {
      const supabase = createSupabaseBrowserClient();
      const colunas = alocacaoParaColunas(form.alocacao);
      const origem = form.origem ?? "manual";

      const { data: antes } = await supabase
        .from("escala_dias")
        .select("*")
        .eq("id_supervisor", form.id_supervisor)
        .eq("data", form.data)
        .maybeSingle();
      const anterior = (antes ?? null) as unknown as EscalaDia | null;

      const linha = {
        id_dia: anterior?.id_dia ?? gerarId("EDIA"),
        id_supervisor: form.id_supervisor,
        data: form.data,
        ...colunas,
        origem,
        observacao: form.observacao?.trim() || null,
        [anterior ? "updated_at" : "created_at"]: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("escala_dias")
        .upsert(linha as never, { onConflict: "id_supervisor,data" });
      if (error) throw error;

      const { data: sessao } = await supabase.auth.getUser();
      const ator = sessao?.user?.email ?? "desconhecido";
      const { error: erroLog } = await supabase.from("escala_log").insert({
        id_log: gerarId("ELOG"),
        id_dia: linha.id_dia,
        id_supervisor: form.id_supervisor,
        data: form.data,
        ator_email: ator,
        valor_anterior: anterior
          ? { unidade_ids: anterior.unidade_ids, situacao: anterior.situacao, origem: anterior.origem }
          : null,
        valor_novo: { ...colunas, origem },
        criado_em: new Date().toISOString(),
      } as never);
      if (erroLog) console.error("escala_log nao gravou:", erroLog.message);

      return linha.id_dia;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_DIAS });
      qc.invalidateQueries({ queryKey: CHAVE_LOG });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/**
 * Apaga um dia da grade. NÃO apaga o log: `escala_log` não tem FK para
 * `escala_dias`, justamente para a trilha sobreviver.
 */
export function useLimparDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_supervisor, data }: { id_supervisor: string; data: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("escala_dias")
        .delete()
        .eq("id_supervisor", id_supervisor)
        .eq("data", data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_DIAS });
      toast.success("Dia limpo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Trilha de alterações de um dia, mais recente primeiro. */
export function useEscalaLog(id_dia: string | null | undefined) {
  return useQuery({
    queryKey: [...CHAVE_LOG, id_dia],
    enabled: !!id_dia,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("escala_log")
        .select("*")
        .eq("id_dia", id_dia!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaLog[];
    },
  });
}

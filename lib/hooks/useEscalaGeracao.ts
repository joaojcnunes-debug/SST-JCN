"use client";

/**
 * Aplica a geração da grade mensal (Fase 5).
 *
 * O CÁLCULO mora em `lib/escala/gerar.ts`, puro e testado. Aqui só a ida ao
 * banco — separados porque a regra é a mais perigosa do módulo e precisa ser
 * exercitável sem servidor.
 *
 * ─── POR QUE NÃO É UM UPSERT SÓ ────────────────────────────────────────────
 *
 * Entre o momento em que a tela leu o mês e o momento em que grava, alguém pode
 * ter marcado um dia à mão. Um `upsert` cru passaria por cima. Então:
 *
 *  - o que NÃO existe entra com `ignoreDuplicates` — se a linha nasceu no meio
 *    do caminho, o insert a ignora em vez de sobrescrever;
 *  - o que já existe é atualizado com a trava `origem = "padrao"` na cláusula,
 *    então uma linha que virou `manual` nesse intervalo simplesmente não é
 *    alcançada pelo UPDATE.
 *
 * A proteção é redundante de propósito: `gerarMes` já exclui os manuais do
 * cálculo, e o banco recusa de novo na gravação. Dia mexido à mão é a única
 * coisa neste módulo que representa decisão de uma pessoa.
 *
 * ─── POR QUE UM LOG SÓ ─────────────────────────────────────────────────────
 *
 * Gerar um mês são ~110 linhas. Cem entradas de auditoria idênticas afogariam a
 * trilha do que interessa, que é a edição manual. A geração é UM evento e vira
 * UMA linha em `escala_log`, com o resumo — e por isso `id_dia` vai nulo ali.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { gerarMes, linhaParaBanco, type EntradaGeracao, type ResultadoGeracao } from "@/lib/escala/gerar";
import { rotuloMes } from "@/lib/escala/datas";
import { alocacaoParaColunas } from "@/lib/escala/tipos";
import { CHAVE_DIAS, CHAVE_LOG } from "@/lib/hooks/useEscalaDias";

export interface ResumoAplicado extends ResultadoGeracao {
  criados: number;
  atualizados: number;
}

export function useGerarMes() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (entrada: EntradaGeracao): Promise<ResumoAplicado> => {
      const supabase = createSupabaseBrowserClient();
      const plano = gerarMes(entrada);
      const agora = new Date().toISOString();

      let criados = 0;
      if (plano.aCriar.length > 0) {
        const linhas = plano.aCriar.map((l) => ({
          ...linhaParaBanco(l, gerarId("EDIA")),
          created_at: agora,
        }));
        const { error } = await supabase
          .from("escala_dias")
          .upsert(linhas as never, {
            onConflict: "id_supervisor,data",
            ignoreDuplicates: true,
          });
        if (error) throw error;
        criados = linhas.length;
      }

      let atualizados = 0;
      for (const l of plano.aAtualizar) {
        const { error } = await supabase
          .from("escala_dias")
          .update({
            ...alocacaoParaColunas(l.alocacao),
            origem: "padrao",
            updated_at: agora,
          } as never)
          .eq("id_supervisor", l.id_supervisor)
          .eq("data", l.data)
          // A trava que impede a corrida: se virou manual no meio, não alcança.
          .eq("origem", "padrao");
        if (error) throw error;
        atualizados++;
      }

      const { data: sessao } = await supabase.auth.getUser();
      const { error: erroLog } = await supabase.from("escala_log").insert({
        id_log: gerarId("ELOG"),
        id_dia: null,
        id_supervisor: null,
        data: null,
        ator_email: sessao?.user?.email ?? "desconhecido",
        valor_anterior: null,
        valor_novo: {
          acao: "geracao_do_mes",
          mes: rotuloMes(entrada.ano, entrada.mes),
          criados,
          atualizados,
          preservados_manuais: plano.preservados,
          ja_corretos: plano.jaCorretos,
        },
        criado_em: agora,
      } as never);
      // Best-effort, mesma régua do useSalvarDia: perder a escala porque a
      // auditoria falhou seria pior que perder a linha de auditoria.
      if (erroLog) console.error("escala_log nao gravou a geracao:", erroLog.message);

      return { ...plano, criados, atualizados };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: CHAVE_DIAS });
      qc.invalidateQueries({ queryKey: CHAVE_LOG });

      const partes: string[] = [];
      if (r.criados) partes.push(`${r.criados} dia(s) criados`);
      if (r.atualizados) partes.push(`${r.atualizados} atualizados`);
      if (r.preservados) partes.push(`${r.preservados} manual(is) preservados`);
      toast.success(partes.length ? partes.join(" · ") : "O mês já estava em dia");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

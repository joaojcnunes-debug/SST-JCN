"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { funcaoParaLinha, colaboradorParaLinha } from "@/lib/dimensionamento/mapear";
import type { ColaboradorCadastro, Funcao, Porte } from "@/lib/dimensionamento/mapear";

/**
 * Escrita do Dimensionamento (DIM-01).
 *
 * Duas coisas valem ser ditas aqui:
 *
 *  1. **Nada de `service_role`.** Toda gravação passa pela sessão do usuário, então a
 *     RLS `dim_admin` e as guardas `caller_eh_admin()` das RPCs valem. Um não-Admin que
 *     chame isto pelo console não grava — e não porque a tela escondeu o botão.
 *
 *  2. **As alocações e a demanda anual vão por RPC**, não por DML solto: `definir_alocacoes`
 *     apaga e regrava numa transação (senão um erro no meio deixaria o colaborador com
 *     metade das unidades), e `substituir_demanda_ano` troca o ano inteiro de uma vez.
 *
 * Toda mutação invalida o cadastro — o motor recalcula com o conjunto completo, nunca com
 * um pedaço atualizado e o resto velho.
 */

const CHAVE = ["dimensionamento", "cadastro"];

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST sem tipos gerados para as dim_*
  return createSupabaseBrowserClient() as any;
}

function erro(e: unknown, fallback: string): never {
  const msg = (e as { message?: string })?.message ?? "";
  // 42501 = a RLS/guarda recusou. Dizer "sem permissão" é mais útil que repassar o código.
  if (/42501|permission denied|row-level security/i.test(msg)) {
    throw new Error("Sem permissão para esta alteração (o Dimensionamento é restrito a administradores).");
  }
  if (/23505|duplicate key/i.test(msg)) throw new Error("Já existe um registro com esse nome.");
  if (/23503|foreign key/i.test(msg)) throw new Error("Há registros dependentes: remova-os antes.");
  throw new Error(msg || fallback);
}

/** Opções comuns: avisa, invalida o cadastro e mostra o erro tratado.
 *  Função de MÓDULO de propósito — `useMutation` dentro de um helper local quebraria a
 *  regra dos hooks (e o next build reprova). */
function opcoes<TVars>(
  fn: (v: TVars) => Promise<unknown>,
  sucesso: string,
  aoTerminar: () => void,
) {
  return {
    mutationFn: fn,
    onSuccess: () => {
      toast.success(sucesso);
      aoTerminar();
    },
    onError: (e: Error) => toast.error(e.message),
  };
}

export function useMutacoesDimensionamento() {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: CHAVE });

  return {
    /* ---------- funções ---------- */
    salvarFuncao: useMutation(opcoes(async (f: Partial<Funcao> & { nome: string; id?: string }) => {
      const linha = funcaoParaLinha(f);
      const q = f.id
        ? await sb().from("dim_funcoes").update(linha).eq("id", f.id)
        : await sb().from("dim_funcoes").insert(linha);
      if (q.error) erro(q.error, "Não foi possível salvar a função.");
    }, "Função salva", invalidar)),

    excluirFuncao: useMutation(opcoes(async (id: string) => {
      const q = await sb().from("dim_funcoes").delete().eq("id", id);
      if (q.error) erro(q.error, "Não foi possível excluir a função.");
    }, "Função excluída", invalidar)),

    /* ---------- unidades ---------- */
    salvarUnidade: useMutation(opcoes(async (u: { id?: string; nome: string; codigoApi?: string | null }) => {
      const linha = { nome: u.nome.trim(), codigo_api: u.codigoApi?.trim() || null };
      const q = u.id
        ? await sb().from("dim_unidades").update(linha).eq("id", u.id)
        : await sb().from("dim_unidades").insert(linha);
      if (q.error) erro(q.error, "Não foi possível salvar a unidade.");
    }, "Unidade salva", invalidar)),

    excluirUnidade: useMutation(opcoes(async (id: string) => {
      const q = await sb().from("dim_unidades").delete().eq("id", id);
      if (q.error) erro(q.error, "Não foi possível excluir a unidade.");
    }, "Unidade excluída", invalidar)),

    /* ---------- colaboradores ---------- */
    salvarColaborador: useMutation(opcoes(async (c: Partial<ColaboradorCadastro> & { nome: string; id?: string }) => {
      const linha = colaboradorParaLinha(c);
      const q = c.id
        ? await sb().from("dim_colaboradores").update(linha).eq("id", c.id).select("id").single()
        : await sb().from("dim_colaboradores").insert(linha).select("id").single();
      if (q.error) erro(q.error, "Não foi possível salvar o colaborador.");

      // As alocações vão por RPC: apagar + regravar numa transação. Em DML solto, um erro
      // no meio deixaria a pessoa alocada em metade das unidades — e o cálculo mentiria.
      if (c.alocacoes) {
        const r = await sb().rpc("dim_definir_alocacoes", {
          p_colaborador: c.id ?? q.data?.id,
          p_alocacoes: c.alocacoes.filter((a) => a.percentual > 0),
        });
        if (r.error) erro(r.error, "Colaborador salvo, mas as alocações não foram gravadas.");
      }
    }, "Colaborador salvo", invalidar)),

    excluirColaborador: useMutation(opcoes(async (id: string) => {
      const q = await sb().from("dim_colaboradores").delete().eq("id", id);
      if (q.error) erro(q.error, "Não foi possível excluir o colaborador.");
    }, "Colaborador excluído", invalidar)),

    /* ---------- parâmetros (linha única) ---------- */
    salvarParametros: useMutation(opcoes(async (p: { diasUteis: number[]; ocupacaoAlvo: number; prazoDias: number; rampup: number[] }) => {
      const q = await sb()
        .from("dim_parametros")
        .update({
          dias_uteis: p.diasUteis,
          ocupacao_alvo: p.ocupacaoAlvo,
          prazo_dias: p.prazoDias,
          rampup: p.rampup,
        })
        .eq("id", 1);
      if (q.error) erro(q.error, "Não foi possível salvar os parâmetros.");
    }, "Parâmetros salvos", invalidar)),

    salvarPorte: useMutation(opcoes(async (p: Porte) => {
      const q = await sb()
        .from("dim_portes")
        .update({ nome: p.nome, peso: p.peso, ordem: p.ordem })
        .eq("codigo", p.codigo);
      if (q.error) erro(q.error, "Não foi possível salvar o porte.");
    }, "Porte salvo", invalidar)),

    /* ---------- demanda mensal ---------- */
    /** Um lançamento (unidade × ano × mês × condição × porte). Zero apaga a linha. */
    definirDemanda: useMutation(opcoes(async (d: {
      unidadeId: string; ano: number; mes: number; condicao: string; porte: string; quantidade: number;
    }) => {
      const chave = { unidade_id: d.unidadeId, ano: d.ano, mes: d.mes, condicao: d.condicao, porte: d.porte };
      const q = d.quantidade > 0
        ? await sb().from("dim_demanda_mensal").upsert({ ...chave, quantidade: Math.round(d.quantidade) },
            { onConflict: "unidade_id,ano,mes,condicao,porte" })
        : await sb().from("dim_demanda_mensal").delete().match(chave);
      if (q.error) erro(q.error, "Não foi possível salvar o lançamento.");
    }, "Lançamento salvo", invalidar)),

    /** Clientes ativos e atendidas do mês (informativos + o que sai da fila). */
    definirUnidadeMes: useMutation(opcoes(async (m: {
      unidadeId: string; ano: number; mes: number;
      clientesAtivos?: number; atendidas?: number; atendidasPorte?: Record<string, number>;
    }) => {
      const q = await sb().from("dim_unidade_mes").upsert(
        {
          unidade_id: m.unidadeId, ano: m.ano, mes: m.mes,
          clientes_ativos: Math.max(0, Math.round(m.clientesAtivos ?? 0)),
          atendidas: Math.max(0, Math.round(m.atendidas ?? 0)),
          atendidas_porte: m.atendidasPorte ?? {},
        },
        { onConflict: "unidade_id,ano,mes" },
      );
      if (q.error) erro(q.error, "Não foi possível salvar o mês da unidade.");
    }, "Mês salvo", invalidar)),

    /** Substitui o ANO inteiro de uma condição (usado pela importação de planilha). */
    substituirDemandaAno: useMutation(opcoes(async (v: { ano: number; linhas: unknown[]; condicao?: string | null }) => {
      const r = await sb().rpc("dim_substituir_demanda_ano", {
        p_ano: v.ano, p_linhas: v.linhas, p_condicao: v.condicao ?? null,
      });
      if (r.error) erro(r.error, "Não foi possível substituir os lançamentos do ano.");
      return r.data;
    }, "Lançamentos do ano substituídos", invalidar)),
  };
}

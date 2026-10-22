"use client";

// Consolidação Psicossocial de Grupo (v295) — leituras e gravações da fase 3:
// catálogo de fatores, documentos do grupo, setores padronizados e de-para.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { carregarFontesDoGrupo } from "@/lib/psico-consolidacao/carregar-grupo";
import { chaveSetor } from "@/lib/psico-consolidacao/setores";
import type { OrigemFonte, PsicoFator, PsicoFatorDepara } from "@/lib/psico-consolidacao/fatores";
import type { PapelEconomico, PsicoSetorCanonico, PsicoSetorDepara } from "@/lib/supabase/types";
import { CHAVE_GRUPOS } from "@/lib/hooks/useGruposEmpresas";
import type { Decisao, ExecucaoLinha, ValidacaoLinha, montarRegistro } from "@/lib/psico-consolidacao/registro";

const sb = () => createSupabaseBrowserClient();

function mensagemErro(e: { message?: string; code?: string }): string {
  const msg = e.message ?? "";
  if (e.code === "42501" || msg.includes("row-level security")) return "Você não tem permissão para isso.";
  if (msg.includes("ux_psico_setor_canonico_nome")) return "Já existe um setor com esse nome no grupo.";
  return msg || "Não foi possível salvar.";
}

export function usePsicoCatalogo() {
  return useQuery({
    queryKey: ["psico-catalogo"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [f, d] = await Promise.all([
        sb().from("psico_fatores" as never).select("*").order("ordem"),
        sb().from("psico_fator_depara" as never).select("*"),
      ]);
      if (f.error) throw f.error;
      if (d.error) throw d.error;
      return {
        fatores: (f.data ?? []) as unknown as PsicoFator[],
        depara: (d.data ?? []) as unknown as PsicoFatorDepara[],
      };
    },
  });
}

/** AEP + DRPS/QPS concluídos das empresas do grupo que o usuário enxerga. */
export function useFontesDoGrupo(idGrupo: string | null, idsEmpresa: string[]) {
  return useQuery({
    queryKey: ["psico-fontes", idGrupo, idsEmpresa.join(",")],
    enabled: !!idGrupo && idsEmpresa.length > 0,
    staleTime: 60_000,
    queryFn: () => carregarFontesDoGrupo(sb(), idsEmpresa),
  });
}

export function useSetoresDoGrupo(idGrupo: string | null) {
  return useQuery({
    queryKey: ["psico-setores", idGrupo],
    enabled: !!idGrupo,
    queryFn: async () => {
      const [c, d] = await Promise.all([
        sb().from("psico_setor_canonico" as never).select("*").eq("id_grupo", idGrupo!).order("nome"),
        sb().from("psico_setor_depara" as never).select("*").eq("id_grupo", idGrupo!),
      ]);
      if (c.error) throw c.error;
      if (d.error) throw d.error;
      return {
        canonicos: (c.data ?? []) as unknown as PsicoSetorCanonico[],
        depara: (d.data ?? []) as unknown as PsicoSetorDepara[],
      };
    },
  });
}

export interface SetorParaConfirmar {
  id_empresa: string;
  origem: OrigemFonte;
  setor_original: string;
  /** Nome padronizado escolhido (cria o setor do grupo se ainda não existir). */
  nome_canonico: string;
}

/**
 * Confirma o de-para de vários setores de uma vez: cria os setores padronizados
 * que faltam e grava (ou regrava) cada linha como confirmada por quem salvou.
 */
export function useConfirmarSetores(idGrupo: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itens: SetorParaConfirmar[]) => {
      if (!idGrupo || itens.length === 0) return 0;
      const cli = sb();
      const { data: u } = await cli.auth.getUser();
      const email = u.user?.email?.toLowerCase() ?? null;

      const atual = await cli.from("psico_setor_canonico" as never).select("*").eq("id_grupo", idGrupo);
      if (atual.error) throw atual.error;
      const porChave = new Map(
        ((atual.data ?? []) as unknown as PsicoSetorCanonico[]).map((c) => [chaveSetor(c.nome), c.id_setor_canonico]),
      );
      const novos: Array<{ id_setor_canonico: string; id_grupo: string; nome: string }> = [];
      for (const it of itens) {
        const k = chaveSetor(it.nome_canonico);
        if (!k || porChave.has(k)) continue;
        const id = gerarId("SCN");
        porChave.set(k, id);
        novos.push({ id_setor_canonico: id, id_grupo: idGrupo, nome: it.nome_canonico.trim() });
      }
      if (novos.length) {
        const r = await cli.from("psico_setor_canonico" as never).insert(novos as never);
        if (r.error) throw r.error;
      }

      const dep = await cli.from("psico_setor_depara" as never).select("id_depara, id_empresa, origem, setor_original").eq("id_grupo", idGrupo);
      if (dep.error) throw dep.error;
      const existente = new Map(
        ((dep.data ?? []) as unknown as PsicoSetorDepara[]).map((d) => [`${d.id_empresa}|${d.origem}|${d.setor_original}`, d.id_depara]),
      );
      const agora = new Date().toISOString();
      const linhas = itens
        .filter((it) => chaveSetor(it.nome_canonico))
        .map((it) => ({
          id_depara: existente.get(`${it.id_empresa}|${it.origem}|${it.setor_original}`) ?? gerarId("SDP"),
          id_grupo: idGrupo,
          id_empresa: it.id_empresa,
          origem: it.origem,
          setor_original: it.setor_original,
          id_setor_canonico: porChave.get(chaveSetor(it.nome_canonico)) ?? null,
          confirmado_por: email,
          confirmado_em: agora,
        }));
      const r = await cli.from("psico_setor_depara" as never).upsert(linhas as never, { onConflict: "id_depara" });
      if (r.error) throw r.error;
      return linhas.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["psico-setores", idGrupo] });
      if (n) toast.success(`${n} setor(es) confirmado(s).`);
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useAlternarTransita(idGrupo: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_setor_canonico: string; transita: boolean }) => {
      const { error } = await sb()
        .from("psico_setor_canonico" as never)
        .update({ transita: p.transita } as never)
        .eq("id_setor_canonico", p.id_setor_canonico);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psico-setores", idGrupo] }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Fatores que o grupo deixa de fora (ex.: a Gênesis foi feita sem "Trabalho remoto"). */
export function useSalvarFatoresIgnorados() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_grupo: string; ignorados: string[] }) => {
      const { error } = await sb()
        .from("empresa_grupos" as never)
        .update({ psico_fatores_ignorados: p.ignorados } as never)
        .eq("id_grupo", p.id_grupo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_GRUPOS }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** De-para de uma categoria de QPS para um fator (só Admin, pela RLS). */
export function useSalvarFatorDepara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { origem: OrigemFonte; valor_origem: string; id_fator: string | null }) => {
      const tab = sb().from("psico_fator_depara" as never);
      const { error } = p.id_fator
        ? await tab.upsert({ origem: p.origem, valor_origem: p.valor_origem, id_fator: p.id_fator } as never, {
            onConflict: "origem,valor_origem",
          })
        : await tab.delete().eq("origem", p.origem).eq("valor_origem", p.valor_origem);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psico-catalogo"] }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function usePapeisEconomicos(idsEmpresa: string[]) {
  return useQuery({
    queryKey: ["psico-papeis", idsEmpresa.join(",")],
    enabled: idsEmpresa.length > 0,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("empresas")
        .select("id_empresa, papel_economico" as never)
        .in("id_empresa", idsEmpresa);
      if (error) throw error;
      return new Map(
        ((data ?? []) as unknown as Array<{ id_empresa: string; papel_economico: PapelEconomico | null }>).map((e) => [
          e.id_empresa,
          e.papel_economico,
        ]),
      );
    },
  });
}

export function useSalvarPapelEconomico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_empresa: string; papel: PapelEconomico | null }) => {
      const { error } = await sb()
        .from("empresas")
        .update({ papel_economico: p.papel } as never)
        .eq("id_empresa", p.id_empresa);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psico-papeis"] }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ── Fase 7: registro da consolidação e validação do cliente (append-only) ─────

/** Registros do grupo (sem o `resultado`, que é grande) e as validações deles. */
export function useRegistrosDoGrupo(idGrupo: string | null) {
  return useQuery({
    queryKey: ["psico-registros", idGrupo],
    enabled: !!idGrupo,
    queryFn: async () => {
      const ex = await sb()
        .from("psico_consolidacao_execucoes" as never)
        .select("id_execucao, id_grupo, criado_em, criado_por, fontes, parametros, observacao")
        .eq("id_grupo", idGrupo!)
        .order("criado_em", { ascending: false });
      if (ex.error) throw ex.error;
      const execucoes = (ex.data ?? []) as unknown as ExecucaoLinha[];
      let validacoes: ValidacaoLinha[] = [];
      if (execucoes.length) {
        const va = await sb()
          .from("psico_consolidacao_validacoes" as never)
          .select("*")
          .in("id_execucao", execucoes.map((e) => e.id_execucao))
          .order("registrado_em");
        if (va.error) throw va.error;
        validacoes = (va.data ?? []) as unknown as ValidacaoLinha[];
      }
      return { execucoes, validacoes };
    },
  });
}

/**
 * Grava a foto: primeiro a execução, depois os itens em lotes. Sem transação (o
 * PostgREST não tem): se um lote falhar, a execução fica com menos itens que
 * `parametros.n_itens` — o erro diz qual registro ficou incompleto.
 */
export function useRegistrarConsolidacao(idGrupo: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reg: ReturnType<typeof montarRegistro>) => {
      const cli = sb();
      const e = await cli.from("psico_consolidacao_execucoes" as never).insert(reg.execucao as never);
      if (e.error) throw e.error;
      for (let i = 0; i < reg.itens.length; i += 500) {
        const r = await cli.from("psico_consolidacao_itens" as never).insert(reg.itens.slice(i, i + 500) as never);
        if (r.error) {
          throw new Error(
            `O registro ${reg.execucao.id_execucao} ficou incompleto (${i} de ${reg.itens.length} linhas): ${mensagemErro(r.error)} Registre de novo.`,
          );
        }
      }
      return reg.execucao.id_execucao;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["psico-registros", idGrupo] });
      toast.success(`Consolidação registrada (${id}).`);
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export interface NovaValidacao {
  id_execucao: string;
  id_empresa: string;
  decisao: Decisao;
  validado_por: string;
  validado_em: string;
  comentario: string | null;
}

export function useRegistrarValidacao(idGrupo: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: NovaValidacao) => {
      const { error } = await sb()
        .from("psico_consolidacao_validacoes" as never)
        .insert({ ...v, id_validacao: gerarId("PCV"), comentario: v.comentario?.trim() || null } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["psico-registros", idGrupo] });
      toast.success("Validação registrada.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

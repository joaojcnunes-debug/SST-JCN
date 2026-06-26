"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria/registrar";

export interface RegistroExcluido {
  id: string;
  tabela: string;
  registro_id: string;
  chave: string | null;
  tipo_exclusao: "hard" | "soft";
  rotulo: string | null;
  dados: Record<string, unknown>;
  modulo: string | null;
  excluido_por: string | null;
  excluido_em: string;
  restaurado: boolean;
  restaurado_por: string | null;
  restaurado_em: string | null;
}

/**
 * Registra na lixeira um SOFT delete (status marcado como excluído). NÃO exclui
 * — o caller faz a atualização de status. `dados` deve conter o registro com o
 * status ANTERIOR (antes da marcação), para a restauração devolvê-lo.
 */
export async function registrarSoftNaLixeira(args: {
  tabela: string;
  chave: string;
  id: string;
  dados: Record<string, unknown>;
  rotulo?: string;
  modulo?: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("registros_excluidos").insert({
    tabela: args.tabela,
    registro_id: args.id,
    chave: args.chave,
    tipo_exclusao: "soft",
    rotulo: args.rotulo ?? null,
    dados: args.dados,
    modulo: args.modulo ?? null,
    excluido_por: user?.email ?? null,
  } as never);
  registrarAuditoria({
    modulo: args.modulo ?? args.tabela,
    id_referencia: args.id,
    acao: "excluiu",
    descricao: args.rotulo ?? args.tabela,
    metadata: { tabela: args.tabela, soft: true },
  });
}

export interface ExcluirComLixeiraArgs {
  /** Nome da tabela (ex.: "empresas"). */
  tabela: string;
  /** Nome da coluna PK (ex.: "id_empresa"). */
  chave: string;
  /** Valor da PK. */
  id: string;
  /** O registro inteiro (vira o snapshot recuperável). */
  dados: Record<string, unknown>;
  /** Texto amigável para exibir na lixeira. */
  rotulo?: string;
  /** Módulo lógico (para filtro/auditoria). */
  modulo?: string;
}

/**
 * Exclusão com lixeira: salva um snapshot recuperável, registra na auditoria
 * e então exclui da tabela. Se o snapshot falhar, NÃO exclui (segurança).
 */
export async function excluirComLixeira(args: ExcluirComLixeiraArgs): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error: snapErr } = await supabase.from("registros_excluidos").insert({
    tabela: args.tabela,
    registro_id: args.id,
    chave: args.chave,
    tipo_exclusao: "hard",
    rotulo: args.rotulo ?? null,
    dados: args.dados,
    modulo: args.modulo ?? null,
    excluido_por: user?.email ?? null,
  } as never);
  if (snapErr) throw snapErr;

  const { error: delErr } = await supabase.from(args.tabela).delete().eq(args.chave, args.id);
  if (delErr) throw delErr;

  registrarAuditoria({
    modulo: args.modulo ?? args.tabela,
    id_referencia: args.id,
    acao: "excluiu",
    descricao: args.rotulo ?? args.tabela,
    metadata: { tabela: args.tabela },
  });
}

/**
 * Versão que busca o registro pelo id antes de excluir (para hooks que só têm
 * o id em mãos). Faz select * → snapshot → exclui.
 */
export async function excluirComLixeiraPorId(args: {
  tabela: string;
  chave: string;
  id: string;
  modulo?: string;
  /** Coluna usada como rótulo amigável na lixeira (ex.: "titulo", "nome"). */
  rotuloCol?: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: row } = await supabase
    .from(args.tabela)
    .select("*")
    .eq(args.chave, args.id)
    .maybeSingle();
  const dados = (row ?? { [args.chave]: args.id }) as Record<string, unknown>;
  const rotulo =
    args.rotuloCol && dados[args.rotuloCol] != null
      ? String(dados[args.rotuloCol])
      : args.id;
  await excluirComLixeira({
    tabela: args.tabela,
    chave: args.chave,
    id: args.id,
    dados,
    rotulo,
    modulo: args.modulo,
  });
}

const KEY = ["lixeira"] as const;

/** Lista os registros na lixeira (não restaurados), mais recentes primeiro. */
export function useLixeira(filtros?: { tabela?: string }) {
  return useQuery({
    queryKey: [...KEY, filtros?.tabela ?? ""],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("registros_excluidos")
        .select("*")
        .eq("restaurado", false)
        .order("excluido_em", { ascending: false })
        .limit(500);
      if (filtros?.tabela) q = q.eq("tabela", filtros.tabela);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RegistroExcluido[];
    },
  });
}

/** Restaura um registro: reinsere na tabela original e marca como restaurado. */
export function useRestaurarRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reg: RegistroExcluido) => {
      const supabase = createSupabaseBrowserClient();
      if (reg.tipo_exclusao === "soft" && reg.chave) {
        // Soft delete: a linha existe, só volta o status anterior.
        const statusAnterior = (reg.dados as { status?: unknown }).status ?? null;
        const { error: updRowErr } = await supabase
          .from(reg.tabela)
          .update({ status: statusAnterior, updated_at: new Date().toISOString() } as never)
          .eq(reg.chave, reg.registro_id);
        if (updRowErr) throw updRowErr;
      } else {
        // Hard delete: reinsere o registro.
        const { error: insErr } = await supabase.from(reg.tabela).insert(reg.dados as never);
        if (insErr) throw insErr;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error: updErr } = await supabase
        .from("registros_excluidos")
        .update({
          restaurado: true,
          restaurado_por: user?.email ?? null,
          restaurado_em: new Date().toISOString(),
        } as never)
        .eq("id", reg.id);
      if (updErr) throw updErr;

      registrarAuditoria({
        modulo: reg.modulo ?? reg.tabela,
        id_referencia: reg.registro_id,
        acao: "restaurou",
        descricao: reg.rotulo ?? reg.tabela,
        metadata: { tabela: reg.tabela },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries(); // recarrega listas dos módulos afetados
      toast.success("Registro restaurado");
    },
    onError: (e: Error) => toast.error(`Falha ao restaurar: ${e.message}`),
  });
}

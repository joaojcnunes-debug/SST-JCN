"use client";

/**
 * Cadastro base da Escala de Supervisores: supervisores, unidades (config) e regras.
 * Camada de dados da Fase 2 — sem tela nenhuma aqui.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { perfilEscreveNaRls } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type { Unidade } from "@/lib/supabase/types";
import type {
  EscalaRegra,
  EscalaSupervisor,
  EscalaUnidadeConfig,
  UnidadeDaEscala,
} from "@/lib/escala/tipos";

export const CHAVE_SUPERVISORES = ["escala", "supervisores"] as const;
export const CHAVE_UNIDADES = ["escala", "unidades"] as const;
export const CHAVE_REGRAS = ["escala", "regras"] as const;

// ─── Supervisores ────────────────────────────────────────────────────────────

/** Todos os supervisores, ativos primeiro. Passe `soAtivos` para as telas de escala. */
export function useEscalaSupervisores(soAtivos = false) {
  return useQuery({
    queryKey: [...CHAVE_SUPERVISORES, soAtivos],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase.from("escala_supervisores").select("*");
      if (soAtivos) q = q.eq("ativo", true);
      const { data, error } = await q
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaSupervisor[];
    },
  });
}

export interface SupervisorForm {
  id_supervisor?: string;
  nome: string;
  nome_resumido?: string | null;
  funcao?: string | null;
  usuario_email?: string | null;
  ordem?: number;
  ativo?: boolean;
}

/** Cria ou atualiza. Sem id = cria. */
export function useSalvarSupervisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: SupervisorForm) => {
      const supabase = createSupabaseBrowserClient();
      // O CHECK do banco exige e-mail minúsculo; normalizar aqui evita um 400
      // que a pessoa leria como "erro ao salvar" sem saber o motivo.
      const email = form.usuario_email?.trim().toLowerCase() || null;
      const base = {
        nome: form.nome.trim(),
        nome_resumido: form.nome_resumido?.trim() || null,
        funcao: form.funcao?.trim() || null,
        usuario_email: email,
        ordem: form.ordem ?? 0,
        ativo: form.ativo ?? true,
      };

      if (form.id_supervisor) {
        const { error } = await supabase
          .from("escala_supervisores")
          .update({ ...base, updated_at: new Date().toISOString() } as never)
          .eq("id_supervisor", form.id_supervisor);
        if (error) throw error;
        return form.id_supervisor;
      }

      const id_supervisor = gerarId("ESUP");
      const { error } = await supabase
        .from("escala_supervisores")
        .insert({ id_supervisor, ...base, created_at: new Date().toISOString() } as never);
      if (error) throw error;
      return id_supervisor;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_SUPERVISORES });
      toast.success("Supervisor salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/**
 * Liga/desliga o supervisor. É a ÚNICA forma de tirá-lo da escala por aqui.
 *
 * NÃO existe hook de exclusão de propósito: `escala_dias` tem
 * `on delete cascade`, então apagar um supervisor levaria junto todo o histórico
 * de escala dele, em silêncio. Inativar preserva o passado e o tira dos meses
 * novos — que é o que "saiu da equipe" significa na prática.
 */
export function useAtivarSupervisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_supervisor, ativo }: { id_supervisor: string; ativo: boolean }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("escala_supervisores")
        .update({ ativo, updated_at: new Date().toISOString() } as never)
        .eq("id_supervisor", id_supervisor);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: CHAVE_SUPERVISORES });
      toast.success(v.ativo ? "Supervisor reativado" : "Supervisor inativado");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ─── Unidades (public.unidades + escala_unidade_config) ──────────────────────

/**
 * As unidades do painel já juntadas com a config da escala.
 *
 * A verdade de "quais unidades existem" é `public.unidades` (v75) — a mesma que
 * Gestão Gerencial, Frota e Inventário usam. Unidade sem linha em
 * `escala_unidade_config` aparece com `configurada: false` e cor padrão, em vez
 * de sumir: sumir faria a tela mentir sobre o que existe.
 */
export function useUnidadesDaEscala(soAtivas = false) {
  return useQuery({
    queryKey: [...CHAVE_UNIDADES, soAtivas],
    queryFn: async (): Promise<UnidadeDaEscala[]> => {
      const supabase = createSupabaseBrowserClient();
      const [uni, cfg] = await Promise.all([
        supabase.from("unidades").select("*").order("nome", { ascending: true }),
        supabase.from("escala_unidade_config").select("*"),
      ]);
      if (uni.error) throw uni.error;
      if (cfg.error) throw cfg.error;

      const unidades = (uni.data ?? []) as unknown as Unidade[];
      const configs = new Map(
        ((cfg.data ?? []) as unknown as EscalaUnidadeConfig[]).map((c) => [c.id_unidade, c])
      );

      const juntadas = unidades.map((u): UnidadeDaEscala => {
        const c = configs.get(u.id_unidade);
        return {
          id_unidade: u.id_unidade,
          nome: u.nome,
          cor_hex: c?.cor_hex ?? "#0ea5e9",
          ordem: c?.ordem ?? 0,
          municipio: c?.municipio ?? null,
          ativo: c?.ativo ?? true,
          configurada: !!c,
        };
      });

      const visiveis = soAtivas ? juntadas.filter((u) => u.ativo) : juntadas;
      return visiveis.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}

export interface UnidadeConfigForm {
  id_unidade: string;
  cor_hex?: string;
  ordem?: number;
  municipio?: string | null;
  ativo?: boolean;
}

/** Grava a config da unidade. Upsert: a 1ª gravação cria a linha 1:1. */
export function useSalvarUnidadeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: UnidadeConfigForm) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("escala_unidade_config").upsert(
        {
          id_unidade: form.id_unidade,
          cor_hex: form.cor_hex ?? "#0ea5e9",
          ordem: form.ordem ?? 0,
          municipio: form.municipio?.trim() || null,
          ativo: form.ativo ?? true,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "id_unidade" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_UNIDADES });
      toast.success("Unidade salva");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ─── Regras de validação ─────────────────────────────────────────────────────

export function useEscalaRegras() {
  return useQuery({
    queryKey: CHAVE_REGRAS,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("escala_regras")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaRegra[];
    },
  });
}

export interface RegraForm {
  id_regra?: string;
  codigo: string;
  descricao: string;
  parametros?: Record<string, unknown>;
  ativa?: boolean;
  ordem?: number;
}

export function useSalvarRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: RegraForm) => {
      const supabase = createSupabaseBrowserClient();
      const base = {
        codigo: form.codigo.trim(),
        descricao: form.descricao.trim(),
        parametros: form.parametros ?? {},
        ativa: form.ativa ?? true,
        ordem: form.ordem ?? 0,
      };
      if (form.id_regra) {
        const { error } = await supabase
          .from("escala_regras")
          .update({ ...base, updated_at: new Date().toISOString() } as never)
          .eq("id_regra", form.id_regra);
        if (error) throw error;
        return form.id_regra;
      }
      const id_regra = gerarId("EREG");
      const { error } = await supabase
        .from("escala_regras")
        .insert({ id_regra, ...base, created_at: new Date().toISOString() } as never);
      if (error) throw error;
      return id_regra;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_REGRAS });
      toast.success("Regra salva");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ─── Quem pode ALTERAR a escala ──────────────────────────────────────────────

/**
 * Espelho exato do `caller_pode_editar()` que guarda as tabelas `escala_*`:
 *
 *     perfil IN ('Admin','Tecnico') AND ativo_sistema = TRUE
 *
 * ⚠️ **O flag `pode_editar` NÃO entra aqui, de propósito.** Ele é a armadilha
 * conhecida do painel: a tela decide pela flag, o banco decide pelo PERFIL. Um
 * Visualizador com `pode_editar` ligado passa por toda a UI e só descobre no
 * salvamento, com o erro cru da RLS. Medido em 01/09: **55 contas enxergam o
 * módulo, mas só 36 (13 Admin + 23 Técnico) conseguem gravar.**
 *
 * E o contrário também importa: um Técnico com `pode_editar` DESLIGADO grava
 * normalmente nestas tabelas, porque a função do banco nem olha a flag. Somar a
 * flag aqui esconderia capacidade que o Postgres aceita.
 */
export function usePodeEditarEscala(): boolean {
  const user = useUserStore((s) => s.user);
  return perfilEscreveNaRls(user?.perfil) && user?.ativo_sistema === true;
}

// ─── Contas do painel (para vincular ao supervisor) ──────────────────────────

/**
 * Nome + e-mail das contas internas, só para a lista de sugestão do campo
 * "conta do painel" no cadastro de supervisor.
 *
 * POR QUE UMA CÓPIA E NÃO `useUsuarios` de `useGestao.ts`: aquele arquivo tem
 * mais de mil linhas e importá-lo aqui traria a Gestão inteira para o pacote da
 * Escala, por causa de uma lista de e-mails. A consulta é de uma linha, e manter
 * o módulo fechado em si é o que faz `rm -r lib/escala` continuar sendo uma
 * remoção limpa.
 *
 * O vínculo é OPCIONAL e digitável — a lista só evita o erro de digitação, que
 * aqui não dá erro nenhum: e-mail que não casa com conta nenhuma é aceito pelo
 * banco e simplesmente nunca encontra ninguém.
 */
export function useContasDoPainel() {
  return useQuery({
    queryKey: ["escala", "contas-painel"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      // `cargo` entrou em 02/09: o supervisor passou a ser cadastrado pela conta,
      // e a função vem junto dela (52 das 55 contas internas têm cargo preenchido).
      const { data, error } = await supabase
        .from("usuarios")
        .select("nome,email,cargo")
        .neq("perfil", "Cliente")
        .order("nome", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as { nome: string | null; email: string | null; cargo?: string | null }[])
        .filter((u) => u.nome && u.email)
        .map((u) => ({
          nome: u.nome as string,
          email: u.email as string,
          cargo: u.cargo ?? null,
        }));
    },
  });
}

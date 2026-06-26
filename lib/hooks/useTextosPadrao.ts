"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { registrarAuditoria } from "@/lib/auditoria/registrar";
import { excluirComLixeira } from "@/lib/hooks/useLixeira";
import {
  MODULO_CONFIGS,
  type ModuloTextoPadrao,
  type OrientacaoPagina,
  type PosicaoPdf,
  type QuebraPagina,
  type TextoPadraoCapitulo,
  type TextoPadraoVersao,
} from "@/lib/textos-padrao/types";
import type { CaixaTexto } from "@/lib/drps/types";

const KEY = (m: ModuloTextoPadrao) => ["textos-padrao", m] as const;
const KEY_HIST = (id: string) => ["textos-padrao-versoes", id] as const;

/** Lista todos os capítulos do módulo (ativos e inativos), ordenados. */
export function useTextosPadrao(modulo: ModuloTextoPadrao) {
  return useQuery({
    queryKey: KEY(modulo),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("textos_padrao")
        .select("*")
        .eq("modulo", modulo)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TextoPadraoCapitulo[];
    },
  });
}

export function useCriarCapituloTexto(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      titulo: string;
      conteudo?: string | null;
      ordem?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const id = gerarId("TXT");
      const { error } = await supabase
        .from("textos_padrao")
        .insert({
          id_capitulo: id,
          modulo,
          titulo: args.titulo,
          conteudo: args.conteudo ?? null,
          ordem: args.ordem ?? 0,
          ativo: true,
          created_at: new Date().toISOString(),
        } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
      toast.success("Capítulo criado");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useSalvarCapituloTexto(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id_capitulo: string;
      titulo?: string;
      conteudo?: string | null;
      ordem?: number;
      ativo?: boolean;
      bg_imagem_url?: string | null;
      caixas_texto?: CaixaTexto[] | null;
      orientacao?: OrientacaoPagina;
      quebra_pagina?: QuebraPagina;
      posicao_pdf?: PosicaoPdf;
      bloqueado?: boolean;
      obrigatorio?: boolean;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_capitulo, ...rest } = args;
      const { error } = await supabase
        .from("textos_padrao")
        .update({ ...rest, updated_at: new Date().toISOString() } as never)
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useSeedCapitulosFixos(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const fixos = MODULO_CONFIGS[modulo].fixos;
      const { data: exist } = await supabase
        .from("textos_padrao")
        .select("slug_fixo")
        .eq("modulo", modulo)
        .eq("tipo", "fixo");
      const existSlugs = new Set((exist ?? []).map((r: { slug_fixo: string | null }) => r.slug_fixo));
      const novos = fixos.filter((f) => !existSlugs.has(f.slug_fixo));
      if (!novos.length) { toast("Seções do sistema já existem."); return; }
      const { error } = await supabase.from("textos_padrao").insert(
        novos.map((f) => ({
          id_capitulo: gerarId("TXT"),
          modulo,
          titulo: f.titulo,
          conteudo: null,
          ordem: f.ordem_base,
          tipo: "fixo",
          slug_fixo: f.slug_fixo,
          ativo: true,
          created_at: new Date().toISOString(),
        })) as never
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
      toast.success("Seções do sistema adicionadas!");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Lista o histórico de versões de um capítulo (mais recente primeiro). */
export function useHistoricoCapitulo(id_capitulo: string | null) {
  return useQuery({
    queryKey: KEY_HIST(id_capitulo ?? ""),
    enabled: !!id_capitulo,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("textos_padrao_versoes")
        .select("*")
        .eq("id_capitulo", id_capitulo!)
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TextoPadraoVersao[];
    },
  });
}

/**
 * Restaura uma versão: reescreve o capítulo com o conteúdo da versão escolhida.
 * O trigger registra a restauração como uma nova versão (não apaga histórico).
 */
export function useRestaurarVersao(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versao: TextoPadraoVersao) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("textos_padrao")
        .update({
          titulo: versao.titulo,
          conteudo: versao.conteudo,
          bg_imagem_url: versao.bg_imagem_url,
          caixas_texto: versao.caixas_texto,
          orientacao: versao.orientacao,
          quebra_pagina: versao.quebra_pagina,
          posicao_pdf: versao.posicao_pdf,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_capitulo", versao.id_capitulo);
      if (error) throw error;
    },
    onSuccess: (_data, versao) => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
      qc.invalidateQueries({ queryKey: KEY_HIST(versao.id_capitulo) });
      registrarAuditoria({
        modulo,
        id_referencia: versao.id_capitulo,
        acao: "restaurou_texto",
        descricao: `Restaurou a versão ${versao.versao} de "${versao.titulo}"`,
      });
      toast.success(`Versão ${versao.versao} restaurada`);
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirCapituloTexto(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cap: TextoPadraoCapitulo) => {
      await excluirComLixeira({
        tabela: "textos_padrao",
        chave: "id_capitulo",
        id: cap.id_capitulo,
        dados: cap as unknown as Record<string, unknown>,
        rotulo: cap.titulo,
        modulo: cap.modulo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
      toast.success("Capítulo excluído");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

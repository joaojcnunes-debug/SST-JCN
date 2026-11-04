"use client";

// Biblioteca psicossocial — base de opções do inventário (v272 + v276).
// Todos leem; o Admin inclui/edita/exclui direto; o técnico SUGERE (item
// 'pendente') e o Admin aprova ou recusa. Ver lib/aep/biblioteca.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { mensagemErro } from "@/lib/errors";
import { COLUNA_PADRAO_COMUM, montarBiblioteca, type ItemBiblioteca, type TopicoBib } from "@/lib/aep/biblioteca";

const KEY = ["psi-biblioteca"] as const;

// As tabelas da v272/v276 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createSupabaseBrowserClient() as any;

const novoId = () =>
  `BIB-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

export function useBibliotecaPsi() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [f, i] = await Promise.all([
        db().from("psi_biblioteca_fatores").select("fator, ordem, meio_propagacao, situacao_padrao, tempo_exposicao_padrao"),
        db().from("psi_biblioteca_itens").select("*"),
      ]);
      if (f.error) throw f.error;
      if (i.error) throw i.error;
      return montarBiblioteca(f.data as unknown[], i.data as unknown[]);
    },
  });
}

/**
 * Inclui uma opção. Admin: entra ativa. Demais: entra como SUGESTÃO
 * (pendente), para o Admin aprovar. Devolve o item criado.
 */
export function useIncluirItemBiblioteca() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  const admin = user?.perfil === "Admin";
  return useMutation({
    mutationFn: async (a: { fator: string | null; topico: TopicoBib; texto: string; codigo?: string | null; padrao?: boolean }) => {
      const quem = user?.nome ?? user?.email ?? null;
      const agora = new Date().toISOString();
      const linha = {
        id_item: novoId(),
        fator: a.fator,
        topico: a.topico,
        texto: a.texto.trim(),
        codigo: a.codigo ?? null,
        ordem: 999,
        padrao: admin ? !!a.padrao : false,
        status: admin ? "ativo" : "pendente",
        sugerido_por: quem,
        sugerido_em: agora,
        ...(admin ? { revisado_por: quem, revisado_em: agora } : {}),
      };
      const { data, error } = await db().from("psi_biblioteca_itens").insert(linha).select("*").single();
      if (error) {
        if (String(error.code) === "23505") throw new Error("Essa opção já existe na biblioteca (ou já foi sugerida).");
        throw error;
      }
      return data as ItemBiblioteca;
    },
    onSuccess: (it) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(it.status === "pendente" ? "Sugestão enviada — aguarda aprovação do Admin" : "Incluído na biblioteca");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao incluir na biblioteca")),
  });
}

/** Admin: altera texto, código, padrão, ordem ou status (aprovar/recusar). */
export function useAtualizarItemBiblioteca() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (a: {
      id: string;
      patch: Partial<Pick<ItemBiblioteca, "texto" | "codigo" | "padrao" | "ordem" | "status">>;
      /**
       * Renomear opção de lista COMUM (meio/situação/tempo): os fatores cujo
       * padrão era o texto antigo (`fatoresComPadrao`) — o padrão deles vai
       * junto para o texto novo. Sem isto o padrão, que casa por texto, se
       * desfazia em silêncio (04/11/2026).
       */
      padraoDosFatores?: { topico: "meio" | "situacao" | "tempo"; fatores: string[] };
    }) => {
      const patch: Record<string, unknown> = { ...a.patch };
      if (a.patch.status) {
        patch.revisado_por = user?.nome ?? user?.email ?? null;
        patch.revisado_em = new Date().toISOString();
      }
      const { data, error } = await db().from("psi_biblioteca_itens").update(patch).eq("id_item", a.id).select("id_item");
      if (error) {
        if (String(error.code) === "23505") throw new Error("Já existe outra opção com esse texto.");
        throw error;
      }
      // RLS barra sem erro (0 linhas) quem não é Admin.
      if (!data?.length) throw new Error("Só o perfil Admin pode alterar a biblioteca.");
      // Depois do item, não antes: se o rename falhar (texto repetido), o
      // padrão dos fatores não pode ficar apontando para um texto que não existe.
      const pf = a.padraoDosFatores;
      if (pf && pf.fatores.length > 0 && typeof a.patch.texto === "string") {
        const { error: errF } = await db()
          .from("psi_biblioteca_fatores")
          .update({ [COLUNA_PADRAO_COMUM[pf.topico]]: a.patch.texto, atualizado_em: new Date().toISOString(), atualizado_por: user?.nome ?? user?.email ?? null })
          .in("fator", pf.fatores);
        if (errF) throw new Error("A opção foi renomeada, mas o padrão dos fatores não foi atualizado. Escolha o padrão de novo na tabela abaixo.");
      }
      return a.patch.status;
    },
    // Recarrega também no erro: o rename pode ter gravado e só o padrão falhado.
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
    onSuccess: (status) => {
      if (status === "ativo") toast.success("Sugestão aprovada");
      else if (status === "recusado") toast.success("Sugestão recusada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao alterar a biblioteca")),
  });
}

/** Admin: exclui a opção (quem já marcou perde a marcação dela). */
export function useExcluirItemBiblioteca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db().from("psi_biblioteca_itens").delete().eq("id_item", id).select("id_item");
      if (error) throw error;
      if (!data?.length) throw new Error("Só o perfil Admin pode excluir da biblioteca.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Opção excluída");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao excluir")),
  });
}

/** Admin: padrão do fator para meio de propagação / situação / tempo de exposição. */
export function useDefinirPadraoComum() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (a: { fator: string; topico: "meio" | "situacao" | "tempo"; texto: string }) => {
      const coluna = a.topico === "meio" ? "meio_propagacao" : a.topico === "situacao" ? "situacao_padrao" : "tempo_exposicao_padrao";
      const { data, error } = await db()
        .from("psi_biblioteca_fatores")
        .update({ [coluna]: a.texto, atualizado_em: new Date().toISOString(), atualizado_por: user?.nome ?? user?.email ?? null })
        .eq("fator", a.fator)
        .select("fator");
      if (error) throw error;
      if (!data?.length) throw new Error("Só o perfil Admin pode alterar a biblioteca.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao definir o padrão")),
  });
}

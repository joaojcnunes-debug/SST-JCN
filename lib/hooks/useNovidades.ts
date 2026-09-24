"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import { CATALOGO } from "@/lib/novidades/catalogo";
import type { AvisoBanco, ItemNovidade } from "@/lib/novidades/tipos";

/**
 * NOVIDADES — a lista que a tela e o modal consomem.
 *
 * Duas fontes, achatadas na mesma forma:
 *   • CATALOGO (lib/novidades/catalogo.ts) — novidade de versao, sobe com o
 *     codigo que ela descreve.
 *   • novidades_avisos (v194) — aviso avulso, escrito no banco, para o que nao
 *     e versao e nao pode esperar deploy.
 *
 * QUEM VE: Admin, Tecnico e Visualizador. Cliente nao — o portal e de empresa
 * de fora, e "a Escala de Supervisores mudou" e rotina interna que nao lhe diz
 * respeito. Sem filtro por modulo: decisao do Sanmyo em 01/09, todo mundo ve
 * tudo.
 *
 * SE O BANCO NAO RESPONDER, a lista nao fica vazia: o catalogo vem do bundle e
 * e a maior parte do conteudo. Um PostgREST fora do ar (acontece depois de
 * queda de luz) tira os avisos avulsos e o marcador de ja-vi, nao a tela.
 */

const KEY_AVISOS = ["novidades", "avisos"] as const;
const KEY_VISTAS = (email: string | null) => ["novidades", "vistas", email] as const;

/** Quantas novidades o modal mostra de uma vez. O resto fica na aba. */
export const LIMITE_MODAL = 5;

function emailDe(user: { email?: string | null } | null): string | null {
  return user?.email ? user.email.toLowerCase() : null;
}

/** Cliente nao participa: o portal e outro publico. */
export function usePodeVerNovidades(): boolean {
  const user = useCurrentUser();
  return !!user && user.perfil !== "Cliente";
}

// ─── Fonte 1: avisos avulsos do banco ────────────────────────────────────────

function useAvisos() {
  const pode = usePodeVerNovidades();
  return useQuery({
    queryKey: KEY_AVISOS,
    enabled: pode,
    staleTime: 5 * 60_000,
    // Sem retry agressivo: se o PostgREST estiver fora, o catalogo ja carrega a
    // tela sozinho e insistir so atrasa a primeira pintura.
    retry: 1,
    queryFn: async (): Promise<AvisoBanco[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("novidades_avisos")
        .select("*")
        .eq("ativo", true)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AvisoBanco[];
    },
  });
}

// ─── Fonte 2: o que esta pessoa ja viu ───────────────────────────────────────

interface Vistas {
  /** null = a pessoa nunca teve linha; ainda nao sabemos o que ela viu. */
  ids: string[] | null;
}

function useVistas() {
  const pode = usePodeVerNovidades();
  const email = emailDe(useCurrentUser());
  return useQuery({
    queryKey: KEY_VISTAS(email),
    enabled: pode && !!email,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Vistas> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("novidades_vistas")
        .select("ids_vistos")
        .eq("usuario_email", email as string)
        .maybeSingle();
      if (error) throw error;
      return { ids: data ? ((data as { ids_vistos: string[] }).ids_vistos ?? []) : null };
    },
  });
}

// ─── A lista completa ────────────────────────────────────────────────────────

/**
 * Catalogo + avisos, do mais recente para o mais antigo.
 *
 * Empate de data e desempatado pelo id, e nao deixado ao acaso: `sort` do V8 e
 * estavel, mas as duas fontes chegam em ordens diferentes e a lista mudaria de
 * ordem entre uma pintura e outra conforme o banco respondesse antes ou depois.
 */
export function useNovidades() {
  const { data: avisos = [], isLoading } = useAvisos();

  const itens = useMemo<ItemNovidade[]>(() => {
    const doCatalogo: ItemNovidade[] = CATALOGO.map((n) => ({ ...n, origem: "catalogo" }));
    const doBanco: ItemNovidade[] = avisos.map((a) => ({
      id: a.id_aviso,
      data: a.data,
      tipo: a.tipo,
      titulo: a.titulo,
      texto: a.texto,
      onde: a.onde ?? undefined,
      impacto: a.impacto ?? undefined,
      destaque: a.destaque,
      origem: "banco",
    }));
    return [...doCatalogo, ...doBanco].sort(
      (a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
    );
  }, [avisos]);

  return { itens, isLoading };
}

/**
 * O que esta pessoa ainda nao viu.
 *
 * CONTA NOVA VE TUDO. Decisao dele em 02/09, revertendo a de 01/09: quem entra
 * pela primeira vez tambem recebe o modal, com o que esta no ar. O raciocinio
 * anterior era "nao precisa se inteirar do que mudou antes de existir por aqui";
 * na pratica, quem chega novo e justamente quem menos sabe o que o painel faz.
 *
 * Sem linha no banco = nao viu NADA (e nao "ja viu tudo"). A linha passa a
 * nascer quando ela fecha o modal, pelo mesmo caminho de todo mundo.
 */
export function useNovidadesNaoVistas() {
  const { itens, isLoading: carregandoItens } = useNovidades();
  const { data: vistas, isLoading: carregandoVistas } = useVistas();

  const naoVistas = useMemo<ItemNovidade[]>(() => {
    // Enquanto a consulta nao responde, nao mostra nada: um modal que pisca na
    // cara e some sozinho e pior do que um modal que demora meio segundo.
    // `vistas.ids === null` ja e resposta — significa "nao tem linha".
    if (!vistas) return [];
    const jaViu = new Set(vistas.ids ?? []);
    return itens.filter((i) => !jaViu.has(i.id));
  }, [itens, vistas]);

  return {
    naoVistas,
    isLoading: carregandoItens || carregandoVistas,
  };
}

// ─── Marcar como visto ───────────────────────────────────────────────────────

/**
 * Grava os ids que a pessoa acabou de ver.
 *
 * Faz UPSERT com a lista inteira do que existe hoje, e nao um append do que o
 * modal mostrou: se o modal cortou em LIMITE_MODAL, o que sobrou ja esta na aba
 * e voltaria como "novo" no proximo login, reabrindo o modal para sempre.
 *
 * Falhar aqui e SILENCIOSO de proposito. A pessoa fechou um aviso; se a gravada
 * nao passou, o pior que acontece e o modal voltar amanha. Um toast vermelho
 * dizendo "erro ao marcar novidades como lidas" so assusta sem informar.
 */
export function useMarcarVistas() {
  const queryClient = useQueryClient();
  const email = emailDe(useCurrentUser());
  const { itens } = useNovidades();

  return useMutation({
    mutationFn: async () => {
      if (!email) return;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("novidades_vistas").upsert(
        {
          usuario_email: email,
          ids_vistos: itens.map((i) => i.id),
          visto_ate: new Date().toISOString(),
        } as never,
        { onConflict: "usuario_email" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY_VISTAS(email) });
    },
    onError: (e) => {
      console.warn("[novidades] nao consegui marcar como visto:", e);
    },
  });
}

"use client";

// Apontamento de tempo do documento (v311): lê as sessões e chama as funções do banco
// (documento_sessao_iniciar / _pausar / _atividade). As contas moram em lib/inspecoes/sessoes.ts.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import type { MotivoPausa, SessaoDocumento } from "@/lib/inspecoes/sessoes";

const CAMPOS = "id_sessao, id_inspecao, id_usuario, nome, inicio, ultima_atividade, fim, motivo_fim, fechada_auto";
export const CHAVE_SESSOES = "documento-sessoes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createSupabaseBrowserClient() as any;

/** Sessões dos documentos pedidos (lista de Minhas inspeções ou um documento só). */
export function useSessoesDocumentos(ids: readonly string[]) {
  const chave = [...new Set(ids)].sort();
  return useQuery({
    queryKey: [CHAVE_SESSOES, "docs", chave.join(",")],
    enabled: chave.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const out: SessaoDocumento[] = [];
      for (let i = 0; i < chave.length; i += 100) {
        const { data, error } = await sb()
          .from("documento_sessoes")
          .select(CAMPOS)
          .in("id_inspecao", chave.slice(i, i + 100))
          .order("inicio");
        if (error) throw error;
        out.push(...((data ?? []) as SessaoDocumento[]));
      }
      return out;
    },
  });
}

/** As minhas sessões de hoje (o "Hoje: 4h30" do topo de Minhas inspeções). */
export function useMinhasSessoesHoje(idUsuario: string | null | undefined) {
  return useQuery({
    queryKey: [CHAVE_SESSOES, "hoje", idUsuario ?? ""],
    enabled: !!idUsuario,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("documento_sessoes")
        .select(CAMPOS)
        .eq("id_usuario", idUsuario)
        .or(`fim.is.null,fim.gte.${hojeSP()}T03:00:00Z`)
        .order("inicio");
      if (error) throw error;
      return (data ?? []) as SessaoDocumento[];
    },
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    for (const k of [CHAVE_SESSOES, "inspecao", "inspecoes-atribuidas", "inspecoes-lista", "inspecoes-counts"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function useIniciarSessao() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (idInspecao: string) => {
      const { data, error } = await sb().rpc("documento_sessao_iniciar", { p_id_inspecao: idInspecao });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePausarSessao() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ idInspecao, motivo }: { idInspecao: string; motivo: MotivoPausa }) => {
      const { error } = await sb().rpc("documento_sessao_pausar", { p_id_inspecao: idInspecao, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Pausado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * "Ainda estou aqui": com a minha sessão aberta neste documento, cada interação (mouse,
 * teclado, rolagem, toque) avisa o banco — no máximo a cada 2 min. Sem isso a sessão pausa
 * sozinha depois de 30 min. Se o banco disser que já não há sessão, recarrega as sessões.
 */
export function useAtividadeSessao(idInspecao: string, ativa: boolean) {
  const invalidar = useInvalidar();
  const ultimo = useRef(0);
  const invalidarRef = useRef(invalidar);
  invalidarRef.current = invalidar;
  useEffect(() => {
    if (!ativa || !idInspecao) return;
    const avisar = () => {
      const agora = Date.now();
      if (agora - ultimo.current < 120_000) return;
      ultimo.current = agora;
      sb()
        .rpc("documento_sessao_atividade", { p_id_inspecao: idInspecao })
        .then(({ data, error }: { data: boolean | null; error: unknown }) => {
          if (!error && data === false) invalidarRef.current();
        });
    };
    const eventos = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
    for (const e of eventos) window.addEventListener(e, avisar, { passive: true });
    avisar();
    return () => {
      for (const e of eventos) window.removeEventListener(e, avisar);
    };
  }, [idInspecao, ativa]);
}

/** Relógio da tela (o cronômetro anda sem recarregar). */
export function useAgora(intervaloMs = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

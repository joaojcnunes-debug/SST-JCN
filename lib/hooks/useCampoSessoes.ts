"use client";

// Tempo de campo da inspeção (0.3.314, banco v364): lê as sessões e chama as funções do banco
// (campo_sessao_iniciar / _pausar / _atividade). As regras estão em lib/inspecoes/campo.ts.

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SessaoDocumento } from "@/lib/inspecoes/sessoes";
import type { MotivoPausaCampo } from "@/lib/inspecoes/campo";

export const CHAVE_CAMPO = "campo-sessoes";
const CAMPOS = "id_sessao, id_inspecao, id_usuario, nome, inicio, ultima_atividade, fim, motivo_fim, fechada_auto";

// campo_sessoes (v364) ainda não está no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createSupabaseBrowserClient() as any;

/** Sessões de campo de uma inspeção. */
export function useSessoesCampo(idInspecao: string) {
  return useQuery({
    queryKey: [CHAVE_CAMPO, idInspecao],
    enabled: !!idInspecao,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await sb().from("campo_sessoes").select(CAMPOS).eq("id_inspecao", idInspecao).order("inicio");
      if (error) throw error;
      return (data ?? []) as SessaoDocumento[];
    },
  });
}

export function useIniciarCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ idInspecao, origem = "BOTAO" }: { idInspecao: string; origem?: "BOTAO" | "AUTOMATICO" }) => {
      const { data, error } = await sb().rpc("campo_sessao_iniciar", { p_id_inspecao: idInspecao, p_origem: origem });
      if (error) throw error;
      return { id: data as string | null, origem };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [CHAVE_CAMPO] });
      if (r.id && r.origem === "AUTOMATICO") toast.success("Tempo de campo iniciado (primeira alteração)");
    },
    onError: (e: Error, v) => {
      // O automático falhar não pode atrapalhar quem está preenchendo.
      if (v.origem !== "AUTOMATICO") toast.error(e.message);
    },
  });
}

export function usePausarCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ idInspecao, motivo }: { idInspecao: string; motivo: MotivoPausaCampo }) => {
      const { error } = await sb().rpc("campo_sessao_pausar", { p_id_inspecao: idInspecao, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAVE_CAMPO] });
      toast.success("Tempo de campo pausado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Na tela da inspeção, para o técnico de campo:
 *   - com a sessão aberta, cada interação avisa "ainda estou aqui" (no máximo a cada 2 min) — sem isso ela pausa
 *     sozinha com 30 min parada;
 *   - sem sessão e sem nunca ter contado campo nesta inspeção, a PRIMEIRA ALTERAÇÃO (digitar ou mudar um campo)
 *     abre a sessão sozinha (origem AUTOMATICO). Quem pausou de propósito não volta a contar sozinho.
 */
export function useAtividadeCampo(
  idInspecao: string,
  opcoes: { ativa: boolean; podeIniciarSozinho: boolean },
) {
  const qc = useQueryClient();
  const iniciar = useIniciarCampo();
  const ultimo = useRef(0);
  const tentouIniciar = useRef(false);
  const refs = useRef({ qc, iniciar });
  refs.current = { qc, iniciar };

  useEffect(() => {
    if (!idInspecao || !opcoes.ativa) return;
    const avisar = () => {
      const agora = Date.now();
      if (agora - ultimo.current < 120_000) return;
      ultimo.current = agora;
      sb()
        .rpc("campo_sessao_atividade", { p_id_inspecao: idInspecao })
        .then(({ data, error }: { data: boolean | null; error: unknown }) => {
          if (!error && data === false) refs.current.qc.invalidateQueries({ queryKey: [CHAVE_CAMPO] });
        });
    };
    const eventos = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
    for (const e of eventos) window.addEventListener(e, avisar, { passive: true });
    avisar();
    return () => {
      for (const e of eventos) window.removeEventListener(e, avisar);
    };
  }, [idInspecao, opcoes.ativa]);

  useEffect(() => {
    if (!idInspecao || opcoes.ativa || !opcoes.podeIniciarSozinho || tentouIniciar.current) return;
    const alterou = () => {
      if (tentouIniciar.current) return;
      tentouIniciar.current = true;
      refs.current.iniciar.mutate({ idInspecao, origem: "AUTOMATICO" });
    };
    window.addEventListener("input", alterou, true);
    window.addEventListener("change", alterou, true);
    return () => {
      window.removeEventListener("input", alterou, true);
      window.removeEventListener("change", alterou, true);
    };
  }, [idInspecao, opcoes.ativa, opcoes.podeIniciarSozinho]);
}

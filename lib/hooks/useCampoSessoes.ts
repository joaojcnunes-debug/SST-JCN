"use client";

// Tempo de campo da inspeção (0.3.314, banco v364): lê as sessões de campo e avisa a atividade. Iniciar e Pausar
// são os do painel de tempo (useIniciarSessao/usePausarSessao com a fonte "campo", em useDocumentoSessoes.ts).
// As regras estão em lib/inspecoes/campo.ts.

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { minhaSessaoAberta, type SessaoDocumento } from "@/lib/inspecoes/sessoes";
import { ehTecnicoDeCampo, travaEdicaoCampo } from "@/lib/inspecoes/campo";
import { useAgora } from "@/lib/hooks/useDocumentoSessoes";
import { CHAVE_CAMPO, marcarAtividadeLocal } from "@/lib/inspecoes/campo-offline";
import { useEnviarFilaCampo } from "@/lib/hooks/useCampoOffline";

export { CHAVE_CAMPO };
const CAMPOS = "id_sessao, id_inspecao, id_usuario, nome, inicio, ultima_atividade, fim, motivo_fim, fechada_auto, corrigida";

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

/**
 * "Ainda estou aqui": com a minha sessão de campo aberta, cada interação avisa o banco (no máximo a cada 2 min).
 * Sem isso a sessão pausa sozinha depois de 30 min.
 */
export function useAtividadeCampo(idInspecao: string, ativa: boolean) {
  const qc = useQueryClient();
  const ultimo = useRef(0);
  const qcRef = useRef(qc);
  qcRef.current = qc;
  useEffect(() => {
    if (!idInspecao || !ativa) return;
    const avisar = () => {
      const agora = Date.now();
      if (agora - ultimo.current < 120_000) return;
      ultimo.current = agora;
      // 0.3.315: sem sinal, a sessão provisória acompanha a atividade na tela (senão pausaria em 30 min).
      if (!navigator.onLine) {
        qcRef.current.setQueryData<SessaoDocumento[]>([CHAVE_CAMPO, idInspecao], (s) => marcarAtividadeLocal(s ?? [], new Date(agora).toISOString()));
        return;
      }
      sb()
        .rpc("campo_sessao_atividade", { p_id_inspecao: idInspecao })
        .then(({ data, error }: { data: boolean | null; error: unknown }) => {
          if (!error && data === false) qcRef.current.invalidateQueries({ queryKey: [CHAVE_CAMPO] });
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

export interface CampoDaInspecao {
  carregando: boolean;
  sessoes: SessaoDocumento[];
  tecnico: boolean;
  concluida: boolean;
  /** A minha sessão de campo está correndo. */
  correndo: boolean;
  /** Sem o play, o técnico não inclui, edita nem exclui (TravaCampo). */
  trava: boolean;
}

/** Tudo o que a tela da inspeção precisa do tempo de campo (o painel e a trava usam o mesmo). */
export function useCampoDaInspecao(p: {
  idInspecao: string;
  inspecao: { status?: string | null; responsavel?: string | null; usuario?: string | null } | null | undefined;
  responsaveis: readonly { id_usuario?: string | null; tecnico_responsavel?: string | null }[];
  usuario: { id_usuario?: string | null; nome?: string | null; email?: string | null } | null | undefined;
  supervisor: boolean;
  podeEditar: boolean;
}): CampoDaInspecao {
  const { data: sessoes = [], isLoading } = useSessoesCampo(p.idInspecao);
  const agora = useAgora();
  const tecnico = !!p.inspecao && ehTecnicoDeCampo(p.inspecao, p.responsaveis, p.usuario);
  const concluida = p.inspecao?.status === "CONCLUIDA";
  const correndo = !!minhaSessaoAberta(sessoes, p.usuario?.id_usuario, agora);
  useAtividadeCampo(p.idInspecao, correndo);
  // 0.3.315: o que ficou guardado sem sinal vai quando a conexão voltar.
  useEnviarFilaCampo();
  return {
    carregando: isLoading || !p.inspecao,
    sessoes,
    tecnico,
    concluida,
    correndo,
    trava: travaEdicaoCampo({
      carregando: isLoading || !p.inspecao,
      tecnico,
      supervisor: p.supervisor,
      podeEditar: p.podeEditar,
      concluida,
      sessaoAberta: correndo,
    }),
  };
}

/**
 * Dashboard › Tempo nos documentos, seção "Tempo de campo" (0.3.315): as sessões de campo dos últimos `meses` meses,
 * com a empresa da inspeção (para o filtro de unidade). A RLS recorta o que a pessoa enxerga.
 */
export function useTempoCampo(meses = 12) {
  return useQuery({
    queryKey: [CHAVE_CAMPO, "dashboard", meses],
    refetchInterval: 120_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - meses * 31 * 86_400_000).toISOString();
      const { data, error } = await sb()
        .from("campo_sessoes")
        .select(`${CAMPOS}, inspecoes(id_empresa)`)
        .gte("inicio", desde)
        .order("inicio")
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as (SessaoDocumento & { inspecoes: { id_empresa: string } | null })[];
    },
  });
}

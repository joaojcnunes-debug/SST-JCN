"use client";

// Apontamento de tempo do documento (v311): lê as sessões e chama as funções do banco
// (documento_sessao_iniciar / _pausar / _atividade). As contas moram em lib/inspecoes/sessoes.ts.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import type { CorrecaoSessao, MotivoPausa, SessaoDocumento } from "@/lib/inspecoes/sessoes";
import type { DocTempo } from "@/lib/dashboard/tempo-documentos";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";

const CAMPOS = "id_sessao, id_inspecao, id_usuario, nome, inicio, ultima_atividade, fim, motivo_fim, fechada_auto, corrigida";
export const CHAVE_SESSOES = "documento-sessoes";

/**
 * De onde vêm as sessões: o documento da inspeção (v311) ou o atendimento de Consolidação ›
 * Liberar para o Comercial (v321, por empresa). As contas e a tela são as mesmas.
 */
export type FonteSessao = "documento" | "comercial";
const RPC_SESSAO: Record<FonteSessao, { iniciar: string; pausar: string; atividade: string; param: string }> = {
  documento: { iniciar: "documento_sessao_iniciar", pausar: "documento_sessao_pausar", atividade: "documento_sessao_atividade", param: "p_id_inspecao" },
  comercial: { iniciar: "comercial_sessao_iniciar", pausar: "comercial_sessao_pausar", atividade: "comercial_sessao_atividade", param: "p_id_empresa" },
};
// `id_inspecao` é o nome do campo em SessaoDocumento; no atendimento ele guarda a empresa.
const CAMPOS_COMERCIAL = "id_sessao, id_inspecao:id_empresa, id_usuario, nome, inicio, ultima_atividade, fim, motivo_fim, fechada_auto";

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

/** Sessões do atendimento de uma empresa em Liberar para o Comercial. */
export function useSessoesComercial(idEmpresa: string) {
  return useQuery({
    queryKey: [CHAVE_SESSOES, "comercial", idEmpresa],
    enabled: !!idEmpresa,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await sb().from("comercial_sessoes").select(CAMPOS_COMERCIAL).eq("id_empresa", idEmpresa).order("inicio");
      if (error) throw error;
      return (data ?? []) as SessaoDocumento[];
    },
  });
}

/** Todas as sessões de atendimento, para a coluna Tempo da lista. */
export function useTempoComercial() {
  return useQuery({
    queryKey: [CHAVE_SESSOES, "comercial-todas"],
    queryFn: () =>
      fetchAllRows<SessaoDocumento>((de, ate) => sb().from("comercial_sessoes").select(CAMPOS_COMERCIAL).order("inicio").range(de, ate)),
  });
}

/**
 * Dashboard › Tempo nos documentos: as sessões dos últimos `meses` meses e os documentos delas
 * (empresa, complexidade, situação). A RLS recorta o que a pessoa enxerga.
 */
export function useTempoDocumentos(meses = 12) {
  return useQuery({
    queryKey: [CHAVE_SESSOES, "dashboard", meses],
    refetchInterval: 120_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - meses * 31 * 86_400_000).toISOString();
      const sessoes = await fetchAllRows<SessaoDocumento>((de, ate) =>
        sb().from("documento_sessoes").select(CAMPOS).gte("inicio", desde).order("id_sessao").range(de, ate),
      );
      const ids = [...new Set(sessoes.map((s) => s.id_inspecao))];
      const docs: DocTempo[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await sb()
          .from("inspecoes")
          .select("id_inspecao, id_empresa, complexidade, elaboracao_status, elaboracao_concluida_em, empresas(nome_empresa)")
          .in("id_inspecao", ids.slice(i, i + 100));
        if (error) throw error;
        for (const d of (data ?? []) as Array<Omit<DocTempo, "empresa"> & { empresas: { nome_empresa: string | null } | null }>) {
          const { empresas, ...resto } = d;
          docs.push({ ...resto, empresa: empresas?.nome_empresa ?? "—" });
        }
      }
      return { sessoes, docs };
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
    for (const k of [CHAVE_SESSOES, "inspecao", "inspecoes-atribuidas", "inspecoes-lista", "inspecoes-counts", "comercial-dados"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function useIniciarSessao(fonte: FonteSessao = "documento") {
  const invalidar = useInvalidar();
  const rpc = RPC_SESSAO[fonte];
  return useMutation({
    mutationFn: async (idInspecao: string) => {
      const { data, error } = await sb().rpc(rpc.iniciar, { [rpc.param]: idInspecao });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePausarSessao(fonte: FonteSessao = "documento") {
  const invalidar = useInvalidar();
  const rpc = RPC_SESSAO[fonte];
  return useMutation({
    mutationFn: async ({ idInspecao, motivo }: { idInspecao: string; motivo: MotivoPausa }) => {
      const { error } = await sb().rpc(rpc.pausar, { [rpc.param]: idInspecao, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Pausado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Minutos que quem concluiu o documento tem para desfazer sozinho (v314; depois, só o Reabrir do supervisor). */
export const MINUTOS_DESFAZER_CONCLUSAO = 10;

/** Quem concluiu o documento por engano desfaz em até 10 min: volta a Em elaboração e reabre o tempo (v314). */
export function useDesfazerConclusao() {
  const invalidar = useInvalidar();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idInspecao: string) => {
      const { error } = await sb().rpc("documento_desfazer_conclusao", { p_id_inspecao: idInspecao });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      qc.invalidateQueries({ queryKey: ["dashboard-documentos-adm"] });
      toast.success("Conclusão desfeita — o documento voltou para Em elaboração");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Histórico das correções das sessões de um documento (v312). */
export function useCorrecoesSessoes(idInspecao: string, ativo: boolean) {
  return useQuery({
    queryKey: [CHAVE_SESSOES, "correcoes", idInspecao],
    enabled: ativo && !!idInspecao,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("documento_sessoes_correcoes")
        .select("*")
        .eq("id_inspecao", idInspecao)
        .order("corrigido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CorrecaoSessao[];
    },
  });
}

/** Supervisor ajusta início/fim de uma sessão, com justificativa (v312). */
export function useCorrigirSessao() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: { idSessao: string; inicio: string; fim: string; justificativa: string }) => {
      const { error } = await sb().rpc("documento_sessao_corrigir", {
        p_id_sessao: p.idSessao,
        p_inicio: p.inicio,
        p_fim: p.fim,
        p_justificativa: p.justificativa,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Sessão corrigida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * "Ainda estou aqui": com a minha sessão aberta neste documento, cada interação (mouse,
 * teclado, rolagem, toque) avisa o banco — no máximo a cada 2 min. Sem isso a sessão pausa
 * sozinha depois de 30 min. Se o banco disser que já não há sessão, recarrega as sessões.
 */
export function useAtividadeSessao(idInspecao: string, ativa: boolean, fonte: FonteSessao = "documento") {
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
        .rpc(RPC_SESSAO[fonte].atividade, { [RPC_SESSAO[fonte].param]: idInspecao })
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
  }, [idInspecao, ativa, fonte]);
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

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type { Maquina } from "@/lib/supabase/types";

/**
 * Registro de transferência de um equipamento do inventário. Guarda um snapshot
 * dos dados da máquina para o histórico/PDF ficar íntegro mesmo que a máquina
 * seja editada ou removida depois. Tabela `transferencias` (migration v115).
 */
export interface Transferencia {
  id_transferencia: string;
  id_maquina: string | null;
  de_unidade: string | null;
  de_localizacao: string | null;
  de_responsavel: string | null;
  para_unidade: string | null;
  para_localizacao: string | null;
  para_responsavel: string | null;
  motivo: string | null;
  observacoes: string | null;
  maquina_nome: string | null;
  maquina_tipo: string | null;
  maquina_categoria: string | null;
  maquina_codigo_interno: string | null;
  maquina_tag: string | null;
  maquina_marca: string | null;
  maquina_modelo: string | null;
  maquina_numero_serie: string | null;
  maquina_numero_patrimonio: string | null;
  maquina_foto_url: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  data_hora: string;
  created_at: string;
  // ── v136: estado + aceite assinado ──────────────────────────────
  status?: "pendente" | "aceita" | "recusada" | "cancelada";
  de_id_unidade?: string | null;
  para_id_unidade?: string | null;
  para_usuario_email?: string | null;   // quem ACEITA (obrigatório na pendente)
  para_usuario_nome?: string | null;
  transportado_por?: string | null;      // quem LEVA (informativo)
  aceita_por_email?: string | null;
  aceita_em?: string | null;
  recusada_por_email?: string | null;
  recusada_em?: string | null;
  recusada_motivo?: string | null;
  cancelada_por_email?: string | null;
  cancelada_em?: string | null;
  cancelada_motivo?: string | null;
  assinante_nome?: string | null;
  assinado_em?: string | null;
}

const KEY = ["transferencias"] as const;

export function useTransferencias() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Transferencia[]> => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb as any)
        .from("transferencias")
        .select("*")
        .order("data_hora", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transferencia[];
    },
  });
}

export interface RegistrarTransferenciaInput {
  maquina: Maquina;
  para_unidade: string | null;
  para_localizacao: string | null;
  para_responsavel: string | null;
  motivo: string | null;
  observacoes: string | null;
  /** Atualiza os campos atuais da máquina (unidade/localização/responsável) para o destino. */
  atualizarMaquina?: boolean;
}

export function useRegistrarTransferencia() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: RegistrarTransferenciaInput): Promise<Transferencia> => {
      const sb = createSupabaseBrowserClient();
      const m = input.maquina;
      const id_transferencia = gerarId("TRF");

      const row: Transferencia = {
        id_transferencia,
        id_maquina: m.id_maquina,
        // Origem = situação atual da máquina.
        de_unidade: m.unidade,
        de_localizacao: m.localizacao,
        de_responsavel: m.responsavel_setor,
        // Destino.
        para_unidade: input.para_unidade,
        para_localizacao: input.para_localizacao,
        para_responsavel: input.para_responsavel,
        motivo: input.motivo,
        observacoes: input.observacoes,
        // Snapshot de identificação da máquina.
        maquina_nome: m.nome,
        maquina_tipo: m.tipo,
        maquina_categoria: m.categoria,
        maquina_codigo_interno: m.codigo_interno,
        maquina_tag: m.tag,
        maquina_marca: m.marca,
        maquina_modelo: m.modelo,
        maquina_numero_serie: m.numero_serie,
        maquina_numero_patrimonio: m.numero_patrimonio,
        maquina_foto_url: m.foto_url,
        // Quem registrou.
        responsavel_nome: user?.nome ?? null,
        responsavel_email: user?.email ?? null,
        data_hora: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any).from("transferencias").insert(row);
      if (error) throw error;

      // Atualiza a localização atual da máquina para o destino (só os campos
      // informados). Usa os mesmos campos já existentes na tabela de máquinas.
      if (input.atualizarMaquina !== false) {
        const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
        if (input.para_unidade !== null) patch.unidade = input.para_unidade;
        if (input.para_localizacao !== null) patch.localizacao = input.para_localizacao;
        if (input.para_responsavel !== null) patch.responsavel_setor = input.para_responsavel;
        const { error: upErr } = await sb
          .from("inventario_maquinas")
          .update(patch as never)
          .eq("id_maquina", m.id_maquina);
        if (upErr) throw upErr;
      }

      return row;
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
      qc.invalidateQueries({ queryKey: ["inventario-maquina", vars.maquina.id_maquina] });
    },
    onError: (e: Error) => toast.error(`Erro ao registrar transferência: ${e.message}`),
  });
}

// ─── v136: fluxo com aceite ──────────────────────────────────────────────────

/**
 * Usuários que podem ser DESTINATÁRIOS de uma transferência para `idUnidade`:
 * ativos, da unidade de destino (ou admin), MENOS o próprio criador (quem cria
 * não aceita). Alimenta o seletor de destinatário.
 */
export function useUsuariosDestino(idUnidade: string | null) {
  const user = useUserStore((s) => s.user);
  return useQuery({
    queryKey: ["usuarios-destino", idUnidade, user?.email],
    enabled: !!idUnidade,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("usuarios")
        .select("nome, email, unidades, perfil, ativo_sistema")
        .eq("ativo_sistema", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        nome: string | null; email: string | null; unidades: string[] | null; perfil: string;
      }[];
      const meuEmail = (user?.email ?? "").toLowerCase();
      return rows.filter((u) => {
        if ((u.email ?? "").toLowerCase() === meuEmail) return false;   // criador ≠ destinatário
        if (u.perfil === "Admin") return true;                          // admin pode receber em qualquer base
        return (u.unidades ?? []).includes(idUnidade!);                 // ou pertence à base de destino
      });
    },
  });
}

export interface CriarPendenteInput {
  maquina: Maquina;
  para_id_unidade: string;
  para_unidade: string;           // nome da unidade (texto/PDF)
  para_usuario_email: string;     // destinatário que vai aceitar
  para_usuario_nome: string;
  para_localizacao: string | null;
  motivo: string | null;
  observacoes: string | null;
}

/** Cria uma transferência PENDENTE. NÃO move a máquina — isso só ocorre no aceite. */
export function useCriarTransferenciaPendente() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: CriarPendenteInput): Promise<void> => {
      const sb = createSupabaseBrowserClient();
      const m = input.maquina;
      const now = new Date().toISOString();
      const row = {
        id_transferencia: gerarId("TRF"),
        id_maquina: m.id_maquina,
        status: "pendente" as const,
        // Origem = situação atual da máquina
        de_id_unidade: m.id_unidade,
        de_unidade: m.unidade,
        de_localizacao: m.localizacao,
        de_responsavel: m.responsavel_setor,
        // Destino
        para_id_unidade: input.para_id_unidade,
        para_unidade: input.para_unidade,
        para_localizacao: input.para_localizacao,
        para_usuario_email: input.para_usuario_email.toLowerCase(),
        para_usuario_nome: input.para_usuario_nome,
        transportado_por: user?.nome ?? null,   // quem registra normalmente transporta
        motivo: input.motivo,
        observacoes: input.observacoes,
        // Snapshot da máquina
        maquina_nome: m.nome,
        maquina_tipo: m.tipo,
        maquina_categoria: m.categoria,
        maquina_codigo_interno: m.codigo_interno,
        maquina_tag: m.tag,
        maquina_marca: m.marca,
        maquina_modelo: m.modelo,
        maquina_numero_serie: m.numero_serie,
        maquina_numero_patrimonio: m.numero_patrimonio,
        maquina_foto_url: m.foto_url,
        // Quem registrou (= criador; o banco proíbe criador == destinatário)
        responsavel_nome: user?.nome ?? null,
        responsavel_email: user?.email ?? null,
        data_hora: now,
        created_at: now,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any).from("transferencias").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(`Erro ao criar transferência: ${e.message}`),
  });
}

/** Aceite assinado (RPC transacional): move a máquina e grava a assinatura. */
export function useAceitarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; assinaturaPng: string }): Promise<void> => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any).rpc("transferencia_aceitar", {
        p_id: params.id,
        p_assinatura_png: params.assinaturaPng,
        p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        p_consentimento: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
    },
    onError: (e: Error) => toast.error(`Não foi possível aceitar: ${e.message}`),
  });
}

export function useRecusarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; motivo: string }): Promise<void> => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any).rpc("transferencia_recusar", {
        p_id: params.id, p_motivo: params.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(`Não foi possível recusar: ${e.message}`),
  });
}

export function useCancelarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; motivo?: string }): Promise<void> => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any).rpc("transferencia_cancelar", {
        p_id: params.id, p_motivo: params.motivo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(`Não foi possível cancelar: ${e.message}`),
  });
}

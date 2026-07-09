"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type {
  EpiColaborador,
  EpiCatalogoItem,
  EpiMovimentacao,
  EpiSaldo,
  EpiTipoMovimentacao,
  EpiImportacaoNfe,
  EpiNfeItemStatusMap,
  EpiEntrega,
  EpiEntregaAssinatura,
  EpiTransferencia,
} from "@/lib/epi/types";

function emailAtual(): string | null {
  return useUserStore.getState().user?.email ?? null;
}

// ============================================================
// COLABORADORES (roster da empresa)
// ============================================================
export function useEpiColaboradores(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-colaboradores", empresaId],
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_colaboradores")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EpiColaborador[];
    },
  });
}

export function useSalvarColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      c: Partial<EpiColaborador> & { empresa_id: string }
    ) => {
      const sb = createSupabaseBrowserClient();
      if (c.id) {
        const { id, ...rest } = c;
        const { error } = await sb
          .from("epi_colaboradores")
          .update({ ...rest, updated_at: new Date().toISOString() } as never)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const id = gerarId("COL");
      const { error } = await sb
        .from("epi_colaboradores")
        .insert({ ...c, id, criado_por: emailAtual() } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-colaboradores", vars.empresa_id] });
      toast.success("Colaborador salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; empresa_id: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("epi_colaboradores")
        .delete()
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-colaboradores", vars.empresa_id] });
      toast.success("Colaborador removido");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// CATÁLOGO DE EPI
// ============================================================
export function useEpiCatalogo(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-catalogo", empresaId],
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_catalogo")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EpiCatalogoItem[];
    },
  });
}

export function useSalvarEpiItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      c: Partial<EpiCatalogoItem> & { empresa_id: string }
    ) => {
      const sb = createSupabaseBrowserClient();
      if (c.id) {
        const { id, ...rest } = c;
        const { error } = await sb
          .from("epi_catalogo")
          .update({ ...rest, updated_at: new Date().toISOString() } as never)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const id = gerarId("EPI");
      const { error } = await sb
        .from("epi_catalogo")
        .insert({ ...c, id, criado_por: emailAtual() } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-catalogo", vars.empresa_id] });
      toast.success("EPI salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirEpiItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; empresa_id: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("epi_catalogo").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-catalogo", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-saldo", vars.empresa_id] });
      toast.success("EPI removido");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// MOVIMENTAÇÕES (append-only) + SALDO
// ============================================================
export function useEpiMovimentacoes(
  empresaId: string | null | undefined,
  idCatalogo?: string | null
) {
  return useQuery({
    queryKey: ["epi-movimentacoes", empresaId, idCatalogo ?? null],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      let q = sb
        .from("epi_movimentacoes")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false })
        .limit(500);
      if (idCatalogo) q = q.eq("id_catalogo", idCatalogo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EpiMovimentacao[];
    },
  });
}

export interface RegistrarMovArgs {
  empresa_id: string;
  id_catalogo: string;
  tipo: EpiTipoMovimentacao;
  quantidade: number;
  origem?: string;
  ref_id?: string | null;
  motivo?: string | null;
  responsavel?: string | null;
}

export function useRegistrarMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RegistrarMovArgs) => {
      const sb = createSupabaseBrowserClient();
      const id = gerarId("MOV");
      const { error } = await sb.from("epi_movimentacoes").insert({
        id,
        empresa_id: args.empresa_id,
        id_catalogo: args.id_catalogo,
        tipo: args.tipo,
        quantidade: args.quantidade,
        origem: args.origem ?? "manual",
        ref_id: args.ref_id ?? null,
        motivo: args.motivo ?? null,
        responsavel: args.responsavel ?? null,
        criado_por: emailAtual(),
      } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-movimentacoes", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-saldo", vars.empresa_id] });
      toast.success("Movimentação registrada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Saldo por item (Map id_catalogo -> saldo), derivado da view v_epi_saldo. */
export function useEpiSaldo(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-saldo", empresaId],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("v_epi_saldo")
        .select("*")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as EpiSaldo[];
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.id_catalogo, Number(r.saldo) || 0);
      return map;
    },
  });
}

// ============================================================
// IMPORTAÇÃO DE NF-e (Fase 2) — histórico + importação via RPC
// ============================================================
export function useEpiImportacoes(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-importacoes", empresaId],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_importacoes_nfe")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as EpiImportacaoNfe[];
    },
  });
}

/** Item enviado ao RPC epi_importar_nfe após a conferência. */
export interface ImportarNfeItem {
  cprod: string;
  xprod: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number | null;
  status_map: EpiNfeItemStatusMap;
  id_catalogo: string | null;
  criar_novo: boolean;
}

export interface ImportarNfeArgs {
  empresa_id: string;
  chnfe: string;
  fornecedor_cnpj: string | null;
  fornecedor_nome: string | null;
  numero_nf: string | null;
  data_emissao: string | null;
  xml_nome: string | null;
  itens: ImportarNfeItem[];
}

/**
 * Importa a NF-e de forma atômica via RPC SECURITY DEFINER: cria itens novos
 * no catálogo (quando marcado), registra a importação e dá entrada no estoque.
 * A RPC valida permissão e faz dedup por chNFe — sem estado parcial.
 */
export function useImportarNfe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ImportarNfeArgs) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("epi_importar_nfe", {
        p_empresa_id: args.empresa_id,
        p_chnfe: args.chnfe,
        p_fornecedor_cnpj: args.fornecedor_cnpj,
        p_fornecedor_nome: args.fornecedor_nome,
        p_numero_nf: args.numero_nf,
        p_data_emissao: args.data_emissao,
        p_xml_nome: args.xml_nome,
        p_itens: args.itens as never,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-importacoes", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-catalogo", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-movimentacoes", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-saldo", vars.empresa_id] });
      toast.success("NF-e importada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// ENTREGAS DE EPI (Fase 3) — histórico + registro via RPC
// ============================================================
export function useEpiEntregas(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-entregas", empresaId],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_entregas")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("data_entrega", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as EpiEntrega[];
    },
  });
}

/** Item enviado ao RPC epi_registrar_entrega. */
export interface RegistrarEntregaItem {
  id_catalogo: string;
  quantidade: number;
}

export interface RegistrarEntregaArgs {
  empresa_id: string;
  id_colaborador: string;
  data_entrega: string | null;
  responsavel: string | null;
  observacao: string | null;
  itens: RegistrarEntregaItem[];
}

/**
 * Registra a entrega física de forma atômica via RPC SECURITY DEFINER: valida o
 * saldo de cada item ANTES de escrever, grava a ficha + itens (com snapshot de
 * nome/CA) e dá baixa (`saida`) no estoque. Sem estado parcial.
 */
export function useRegistrarEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RegistrarEntregaArgs) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("epi_registrar_entrega", {
        p_empresa_id: args.empresa_id,
        p_id_colaborador: args.id_colaborador,
        p_data_entrega: args.data_entrega,
        p_responsavel: args.responsavel,
        p_observacao: args.observacao,
        p_itens: args.itens as never,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-entregas", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-movimentacoes", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["epi-saldo", vars.empresa_id] });
      toast.success("Entrega registrada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// ASSINATURA DA ENTREGA (Fase 4) — evidência + registro via RPC
// ============================================================

/** SHA-256 (hex) de um buffer via WebCrypto — padrão da casa (usePdfsGerados). */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Assinaturas por entrega da empresa (Map id_entrega -> assinatura mais recente). */
export function useEpiEntregasAssinadas(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-entregas-assinadas", empresaId],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_entrega_assinaturas")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("assinado_em", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as EpiEntregaAssinatura[];
      const map = new Map<string, EpiEntregaAssinatura>();
      // já vem por assinado_em desc → o 1º de cada entrega é o mais recente
      for (const r of rows) if (!map.has(r.id_entrega)) map.set(r.id_entrega, r);
      return map;
    },
  });
}

export interface AssinarEntregaArgs {
  empresa_id: string;
  id_entrega: string;
  assinante_nome: string;
  /** Método da assinatura: desenho na tela ou digital biométrica. */
  metodo: "canvas" | "digital";
  /** PNG do desenho (canvas). Null quando metodo='digital'. */
  assinatura_png: string | null;
  pdf_sha256: string;
  /** Hash da amostra biométrica (a biometria em si é descartada). */
  finger_hash?: string | null;
  device_info?: string | null;
  qualidade?: string | null;
  /** Consentimento LGPD (obrigatório p/ digital). */
  consentimento?: boolean;
}

/**
 * Registra a assinatura do recebedor via RPC SECURITY DEFINER (insert-only,
 * append-only): desenho na tela OU digital biométrica (só o hash da amostra é
 * gravado; a biometria é descartada). Grava hash do PDF consentido, user-agent
 * e IP (capturado no servidor). Não altera a entrega (estado "assinada" é
 * derivado da existência desta evidência).
 */
export function useAssinarEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: AssinarEntregaArgs) => {
      const sb = createSupabaseBrowserClient();
      const ua =
        typeof navigator !== "undefined" ? navigator.userAgent : null;
      const { data, error } = await sb.rpc("epi_assinar_entrega", {
        p_id_entrega: args.id_entrega,
        p_assinante_nome: args.assinante_nome,
        p_assinatura_png: args.assinatura_png,
        p_pdf_sha256: args.pdf_sha256,
        p_user_agent: ua,
        p_metodo: args.metodo,
        p_finger_hash: args.finger_hash ?? null,
        p_device_info: args.device_info ?? null,
        p_qualidade: args.qualidade ?? null,
        p_consentimento: args.consentimento ?? false,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["epi-entregas-assinadas", vars.empresa_id] });
      toast.success("Assinatura registrada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Linha da trilha de auditoria de assinaturas (com dados da entrega). */
export interface EpiAuditoriaAssinatura extends EpiEntregaAssinatura {
  entrega?: { data_entrega: string | null } | null;
}

/**
 * Trilha completa de assinaturas da empresa para AUDITORIA/FISCALIZAÇÃO
 * (NT 162/2017). Append-only, ordenada por data/hora. Inclui hashes, método,
 * dispositivo, IP e consentimento — exportável em CSV pela UI.
 */
export function useEpiAuditoriaAssinaturas(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-auditoria-assin", empresaId],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_entrega_assinaturas")
        .select("*, entrega:epi_entregas(data_entrega)")
        .eq("empresa_id", empresaId!)
        .order("assinado_em", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as EpiAuditoriaAssinatura[];
    },
  });
}

// ============================================================
// TRANSFERÊNCIA ENTRE EMPRESAS (Fase 5) — histórico + registro via RPC
// ============================================================

/** Transferências em que a empresa aparece como origem OU destino. */
export function useEpiTransferencias(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["epi-transferencias", empresaId],
    enabled: !!empresaId,
    staleTime: 20 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("epi_transferencias")
        .select("*")
        .or(`empresa_origem.eq.${empresaId},empresa_destino.eq.${empresaId}`)
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as EpiTransferencia[];
    },
  });
}

/** Item enviado ao RPC epi_transferir após a conferência de destino. */
export interface TransferirItem {
  id_catalogo_origem: string;
  quantidade: number;
  id_catalogo_destino: string | null;
  criar_no_destino: boolean;
}

export interface TransferirArgs {
  empresa_origem: string;
  empresa_destino: string;
  observacao: string | null;
  itens: TransferirItem[];
}

/**
 * Transfere itens de uma empresa para outra de forma atômica via RPC SECURITY
 * DEFINER (só equipe interna): valida saldo na origem, cria/mapeia o item no
 * destino e gera saída+entrada. Sem estado parcial.
 */
export function useTransferir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: TransferirArgs) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("epi_transferir", {
        p_empresa_origem: args.empresa_origem,
        p_empresa_destino: args.empresa_destino,
        p_observacao: args.observacao,
        p_itens: args.itens as never,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_r, vars) => {
      // invalida os dois lados (origem e destino)
      for (const emp of [vars.empresa_origem, vars.empresa_destino]) {
        qc.invalidateQueries({ queryKey: ["epi-transferencias", emp] });
        qc.invalidateQueries({ queryKey: ["epi-catalogo", emp] });
        qc.invalidateQueries({ queryKey: ["epi-movimentacoes", emp] });
        qc.invalidateQueries({ queryKey: ["epi-saldo", emp] });
      }
      toast.success("Transferência registrada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

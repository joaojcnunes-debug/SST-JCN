"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type { Maquina, StatusMaquina, GrauRiscoMaquina } from "@/lib/supabase/types";

const KEY_LISTA = (vinculos: string[] | null) =>
  ["inventario-maquinas", vinculos] as const;
const KEY_ITEM = (id: string | null | undefined) =>
  ["inventario-maquina", id] as const;

/**
 * Carrega máquinas do inventário respeitando filtro por empresas
 * vinculadas pra perfil Técnico. Máquinas sem `id_empresa` (patrimônio
 * interno da Chabra) aparecem pra todos.
 */
async function fetchLista(empresasVinculadas: string[] | null) {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("inventario_maquinas")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    q = q.or(
      `id_empresa.in.(${empresasVinculadas.join(",")}),id_empresa.is.null`
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Maquina[];
}

export function useInventarioMaquinas() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
      ? user.empresas_vinculadas
      : null;

  return useQuery({
    queryKey: KEY_LISTA(vinculos),
    queryFn: () => fetchLista(vinculos),
  });
}

export function useMaquina(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ITEM(id),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("inventario_maquinas")
        .select("*")
        .eq("id_maquina", id!)
        .single();
      if (error) throw error;
      return data as unknown as Maquina;
    },
  });
}

export interface MaquinaInput {
  id_empresa: string | null;
  // Identificação
  nome: string;
  tipo: string | null;
  categoria: string | null;
  codigo_interno: string | null;
  tag: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  numero_patrimonio: string | null;
  status: StatusMaquina;
  // Localização
  unidade: string | null;
  setor: string | null;
  linha_processo: string | null;
  area: string | null;
  responsavel_setor: string | null;
  operacao_executada: string | null;
  localizacao: string | null;
  // Capacidade
  capacidade_operacional: string | null;
  producao_estimada: string | null;
  potencia: string | null;
  tensao: string | null;
  pressao: string | null;
  capacidade_carga: string | null;
  velocidade: string | null;
  dimensoes: string | null;
  finalidade: string | null;
  descricao_tecnica: string | null;
  // Segurança
  protecao_fixa: boolean | null;
  protecao_movel: boolean | null;
  intertravamento: boolean | null;
  botao_emergencia: boolean | null;
  sistema_bloqueio: boolean | null;
  possui_manual: boolean | null;
  possui_diagrama_eletrico: boolean | null;
  aterramento: boolean | null;
  sinalizacao: boolean | null;
  necessita_adequacao_nr12: boolean | null;
  grau_risco: GrauRiscoMaquina | null;
  observacoes_tecnicas: string | null;
  // Meta
  observacoes: string | null;
  foto_url: string | null;
  foto_storage_path: string | null;
}

export function useCriarMaquina() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (params: {
      input: MaquinaInput;
      /** ID pré-gerado pra alinhar com o storage path da foto já enviada.
       *  Quando omitido, gera um novo. */
      idMaquina?: string;
    }): Promise<Maquina> => {
      const supabase = createSupabaseBrowserClient();
      const id_maquina = params.idMaquina ?? gerarId("MAQ");
      const row: Maquina = {
        id_maquina,
        ...params.input,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const { error } = await supabase
        .from("inventario_maquinas")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
    },
    onError: (e: Error) => toast.error(`Erro ao criar: ${e.message}`),
  });
}

export function useAtualizarMaquina() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id_maquina: string; patch: Partial<MaquinaInput> }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("inventario_maquinas")
        .update({ ...params.patch, updated_at: new Date().toISOString() } as never)
        .eq("id_maquina", params.id_maquina);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
      qc.invalidateQueries({ queryKey: KEY_ITEM(params.id_maquina) });
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  });
}

export function useExcluirMaquina() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id_maquina: string) => {
      const supabase = createSupabaseBrowserClient();
      // 1) Recupera foto_storage_path pra limpar o storage primeiro
      const { data: atual } = await supabase
        .from("inventario_maquinas")
        .select("foto_storage_path")
        .eq("id_maquina", id_maquina)
        .single();
      const path = (atual as { foto_storage_path: string | null } | null)
        ?.foto_storage_path;
      if (path) {
        await supabase.storage.from("fotos").remove([path]);
      }
      const { error } = await supabase
        .from("inventario_maquinas")
        .delete()
        .eq("id_maquina", id_maquina);
      if (error) throw error;
      return id_maquina;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

/**
 * Sobe a foto pro bucket `fotos` em `inventario-maquinas/{id_maquina}.{ext}`.
 * Se já houver uma foto antiga (path diferente), o caller é responsável por
 * remover antes — ou aceitar o overwrite quando o path for igual.
 *
 * Retorna `{ publicUrl, storagePath }` pra salvar na linha da máquina.
 */
export async function uploadFotoMaquina(
  id_maquina: string,
  file: File
): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = createSupabaseBrowserClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const storagePath = `inventario-maquinas/${id_maquina}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("fotos")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("fotos").getPublicUrl(storagePath);
  return { publicUrl: pub.publicUrl, storagePath };
}

/** Remove a foto do storage sem mexer na linha. Útil quando o usuário troca a foto. */
export async function removerFotoMaquinaStorage(storagePath: string) {
  const supabase = createSupabaseBrowserClient();
  await supabase.storage.from("fotos").remove([storagePath]);
}

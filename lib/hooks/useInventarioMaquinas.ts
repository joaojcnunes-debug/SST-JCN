"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
import type {
  Maquina,
  StatusMaquina,
  GrauRiscoMaquina,
  CategoriaInventario,
} from "@/lib/supabase/types";

/**
 * O que sobrou do inventário de máquinas (`inventario_maquinas`).
 *
 * 30/09/2026 — passo 2 da remoção do inventário: a Relação de Máquinas passou
 * a ler a aba Máquinas das inspeções (`useRelacaoMaquinas`), e com isso saíram
 * a lista, o cadastro/edição/exclusão e a importação "inspeção → inventário".
 * Fica só o vínculo LEGADO do laudo de apreciação (`id_maquina`, 10 rascunhos)
 * e o tipo usado pela análise por IA. Some de vez no passo 3 (DROP da tabela).
 */

const KEY_ITEM = (id: string | null | undefined) =>
  ["inventario-maquina", id] as const;

export function useMaquina(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ITEM(id),
    enabled: !!id,

    // Sem rede, insistir é perder tempo: o plano B está dentro da `queryFn`.
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async (): Promise<Maquina> => {
      const idMaq = id!;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("inventario_maquinas")
          .select("*")
          .eq("id_maquina", idMaq)
          .single();
        if (error) throw error;
        const linha = data as unknown as Maquina;
        // Mantém fresca só a cópia que o técnico levou — ver `LevarParaCampo`.
        void lerDocumentoCache(idMaq).then((ja) => {
          if (ja) void guardarDocumentoCache(idMaq, linha);
        });
        return linha;
      } catch (e) {
        // Recusa do banco e máquina inexistente continuam sendo erro.
        if (!ehErroDeRede(e)) throw e;
        const guardado = await lerDocumentoCache<Maquina>(idMaq);
        if (guardado) return guardado.dados;
        throw e;
      }
    },
  });
}

export interface MaquinaInput {
  id_empresa: string | null;
  // Identificação
  nome: string;
  tipo: string | null;
  categoria: string | null;
  categoria_inventario: CategoriaInventario | null;
  codigo_interno: string | null;
  tag: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  numero_patrimonio: string | null;
  status: StatusMaquina;
  // Localização
  id_unidade: string | null;   // base/unidade (FK unidades) — controla o isolamento e a transferência
  unidade: string | null;      // espelho em texto do nome da unidade (legado/exibição)
  setor: string | null;
  linha_processo: string | null;
  area: string | null;
  responsavel_setor: string | null;
  operacao_executada: string | null;
  operadores: string | null;
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
  descricao_protecao_fixa: string | null;
  protecao_movel: boolean | null;
  descricao_protecao_movel: string | null;
  dispositivos_seguranca: string | null;
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
  /** Miniatura (~320px) usada na LISTAGEM. A original fica em foto_storage_path
   *  e só é buscada quando o item é aberto. v173. */
  foto_thumb_path: string | null;
}

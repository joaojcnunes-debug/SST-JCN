"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Lista TODOS os laudos dos 7 módulos num lugar só, para cadastrar/editar a
 * `data_validade` inline (tela "Validades de Documentos"). Cada item carrega a
 * tabela/coluna de id pra salvar no registro certo.
 */

export type TipoLaudo =
  | "Inspeção" | "Conformidade" | "Não Conformidade" | "AET" | "AEP" | "DRPS"
  | "Análise de Químicos" | "Apreciação" | "Investigação";

export interface LaudoValidadeItem {
  tipo: TipoLaudo;
  tabela: string;
  idCol: string;
  id: string;
  empresaNome: string | null;
  /** Data de referência do documento (elaboração/inspeção/apreciação/criação). */
  dataDoc: string | null;
  data_validade: string | null;
  href: string;
}

interface Fonte {
  tabela: string;
  idCol: string;
  dataCol: string;
  tipo: TipoLaudo;
  href: (id: string) => string;
  /** Exclui registros com esse status (soft-delete). */
  excluirStatus?: string;
}

const FONTES: Fonte[] = [
  { tabela: "inspecoes", idCol: "id_inspecao", dataCol: "data_inspecao", tipo: "Inspeção", href: (id) => `/inspecoes/${id}`, excluirStatus: "DELETADA" },
  { tabela: "relatorios_conformidade", idCol: "id_relatorio", dataCol: "data_inspecao", tipo: "Conformidade", href: (id) => `/relatorio-conformidade/${id}` },
  { tabela: "relatorios_nao_conformidade", idCol: "id_relatorio", dataCol: "data_inspecao", tipo: "Não Conformidade", href: (id) => `/relatorio-nao-conformidade/${id}` },
  { tabela: "aet_relatorios", idCol: "id_relatorio", dataCol: "data_elaboracao", tipo: "AET", href: (id) => `/aet/${id}/dados` },
  { tabela: "aep_relatorios", idCol: "id_relatorio", dataCol: "data_elaboracao", tipo: "AEP", href: (id) => `/aep/${id}/dados` },
  { tabela: "drps_relatorios", idCol: "id_relatorio", dataCol: "data_elaboracao", tipo: "DRPS", href: (id) => `/psicossocial/${id}/metadados`, excluirStatus: "DELETADO" },
  { tabela: "analises_quimicos", idCol: "id_analise", dataCol: "created_at", tipo: "Análise de Químicos", href: (id) => `/analise-quimicos/${id}` },
  { tabela: "apreciacoes_maquinas", idCol: "id_apreciacao", dataCol: "data_apreciacao", tipo: "Apreciação", href: (id) => `/apreciacao-maquinas/${id}` },
  { tabela: "investigacoes_acidente", idCol: "id_investigacao", dataCol: "data_acidente", tipo: "Investigação", href: (id) => `/investigacao-acidente/${id}`, excluirStatus: "DELETADA" },
];

export function useLaudosValidade() {
  return useQuery<LaudoValidadeItem[]>({
    queryKey: ["laudos-validade"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();

      const empRes = await sb.from("empresas").select("id_empresa, nome_empresa");
      const nomePorEmpresa = new Map<string, string>();
      for (const e of (empRes.data ?? []) as { id_empresa: string; nome_empresa: string }[]) {
        nomePorEmpresa.set(e.id_empresa, e.nome_empresa);
      }

      const listas = await Promise.all(
        FONTES.map(async (f) => {
          let q = sb.from(f.tabela).select(`${f.idCol}, id_empresa, ${f.dataCol}, data_validade`);
          if (f.excluirStatus) q = q.neq("status", f.excluirStatus);
          const { data, error } = await q;
          if (error) return [] as LaudoValidadeItem[];
          return ((data ?? []) as Record<string, string | null>[]).map((r) => {
            const id = r[f.idCol] as string;
            const idEmpresa = r.id_empresa;
            const dataDocRaw = r[f.dataCol];
            return {
              tipo: f.tipo,
              tabela: f.tabela,
              idCol: f.idCol,
              id,
              empresaNome: idEmpresa ? nomePorEmpresa.get(idEmpresa) ?? null : null,
              dataDoc: dataDocRaw ? dataDocRaw.slice(0, 10) : null,
              data_validade: r.data_validade,
              href: f.href(id),
            };
          });
        }),
      );

      return listas
        .flat()
        .sort((a, b) =>
          (a.empresaNome ?? "~").localeCompare(b.empresaNome ?? "~", "pt-BR") ||
          a.tipo.localeCompare(b.tipo, "pt-BR"),
        );
    },
  });
}

export function useSalvarValidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { tabela: string; idCol: string; id: string; data_validade: string | null }) => {
      const sb = createSupabaseBrowserClient();
      // tabela dinâmica → cliente sem tipagem estática.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from(p.tabela) as any)
        .update({ data_validade: p.data_validade || null })
        .eq(p.idCol, p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["laudos-validade"] });
      qc.invalidateQueries({ queryKey: ["vencimentos"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// Conciliação DRPS/QPS × AEP (29/10/2026) — lê a AEP concluída e o DRPS/QPS concluído
// ou enviado ao cliente de TODAS as empresas que quem pede enxerga (RLS), ou de uma só.
// As mesmas funções da Consolidação de Grupo (`fontes.ts`); a diferença é que aqui não
// há grupo: a tela lista toda empresa que tem algum dos documentos.
//
// A AEP vira linha só nos fatores "Sim" (`linhasDaAep`); para saber que a AEP AVALIOU um
// setor sem nenhum "Sim", os setores de cada AEP também voltam (`setoresAep`).

import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { carregarRiscosPsicossociais } from "@/lib/riscos-psicossociais/carregar";
import type { AepRelatorio } from "@/lib/supabase/types";
import type { EmpresaFonte, FontesDoGrupo } from "./carregar-grupo";
import type { SetorAvaliadoAep } from "./conciliacao";
import {
  documentoDaAep,
  documentoDaAvaliacao,
  linhasDaAep,
  linhasDaAvaliacao,
  pendenciasDaAep,
  pendenciasDaAvaliacao,
} from "./fontes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export interface FontesConciliacao extends FontesDoGrupo {
  setoresAep: SetorAvaliadoAep[];
}

type AepLida = Pick<
  AepRelatorio,
  "id_relatorio" | "id_empresa" | "status" | "setores" | "responsavel_elaboracao" | "data_elaboracao" | "updated_at"
> & { concluido_em: string | null };

/** @param idEmpresa uma empresa só (tela de detalhe); sem ela, todas. */
export async function carregarFontesConciliacao(sb: Sb, idEmpresa?: string): Promise<FontesConciliacao> {
  const [aeps, riscos] = await Promise.all([
    fetchAllRows<AepLida>((de, ate) => {
      let q = sb
        .from("aep_relatorios")
        .select("id_relatorio, id_empresa, status, setores, responsavel_elaboracao, data_elaboracao, concluido_em, updated_at")
        .eq("status", "CONCLUIDO");
      if (idEmpresa) q = q.eq("id_empresa", idEmpresa);
      return q.order("id_relatorio").range(de, ate);
    }),
    carregarRiscosPsicossociais(sb, idEmpresa),
  ]);

  const out: FontesConciliacao = { empresas: [], documentos: [], linhas: [], pendencias: [], setoresAep: [] };
  const empresas = new Map<string, EmpresaFonte>();
  for (const e of riscos) {
    empresas.set(e.idEmpresa, { idEmpresa: e.idEmpresa, nome: e.nome, cnpj: e.cnpj, municipio: e.municipio, uf: e.uf });
    for (const av of e.avaliacoes) {
      out.documentos.push(documentoDaAvaliacao(e.idEmpresa, av));
      out.linhas.push(...linhasDaAvaliacao(e.idEmpresa, av));
      out.pendencias.push(...pendenciasDaAvaliacao(e.idEmpresa, av));
    }
  }
  for (const a of aeps) {
    out.documentos.push(documentoDaAep(a));
    out.linhas.push(...linhasDaAep(a));
    out.pendencias.push(...pendenciasDaAep(a));
    for (const s of a.setores ?? []) {
      const setor = (s.nome_setor ?? "").trim();
      if (setor) out.setoresAep.push({ idDocumento: a.id_relatorio, setorOriginal: setor });
    }
  }

  // Empresa só com AEP: o nome não veio do DRPS/QPS.
  const faltando = [...new Set(aeps.map((a) => a.id_empresa))].filter((id) => id && !empresas.has(id));
  for (let i = 0; i < faltando.length; i += 100) {
    const { data, error } = await sb
      .from("empresas")
      .select("id_empresa, nome_empresa, cnpj, municipio, uf")
      .in("id_empresa", faltando.slice(i, i + 100));
    if (error) throw error;
    for (const e of (data ?? []) as Array<{ id_empresa: string; nome_empresa: string | null; cnpj: string | null; municipio: string | null; uf: string | null }>) {
      empresas.set(e.id_empresa, {
        idEmpresa: e.id_empresa,
        nome: e.nome_empresa ?? "Empresa sem nome",
        cnpj: e.cnpj,
        municipio: e.municipio,
        uf: e.uf,
      });
    }
  }

  out.empresas = [...empresas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  out.documentos.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  return out;
}

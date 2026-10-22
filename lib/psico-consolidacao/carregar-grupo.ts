// Consolidação Psicossocial de Grupo (v295) — lê a AEP e o DRPS/QPS das empresas
// de um grupo. Só lê: AEP concluída e DRPS/QPS concluído ou enviado ao cliente
// (a mesma régua de `lib/riscos-psicossociais/carregar.ts`, que é reaproveitado
// inteiro — o nível é o do laudo). A RLS de quem pede vale: empresa de outra
// unidade não volta.

import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { carregarRiscosPsicossociais } from "@/lib/riscos-psicossociais/carregar";
import type { AepRelatorio } from "@/lib/supabase/types";
import {
  documentoDaAep,
  documentoDaAvaliacao,
  linhasDaAep,
  linhasDaAvaliacao,
  pendenciasDaAep,
  pendenciasDaAvaliacao,
  type DocumentoFonte,
  type LinhaFonte,
  type PendenciaFonte,
} from "./fontes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export interface EmpresaFonte {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
}

export interface FontesDoGrupo {
  empresas: EmpresaFonte[];
  documentos: DocumentoFonte[];
  /** Linhas de TODOS os documentos; a tela filtra pelos escolhidos. */
  linhas: LinhaFonte[];
  /** N/I da AEP e categorias sem base do QPS. */
  pendencias: PendenciaFonte[];
}

type AepLida = Pick<
  AepRelatorio,
  "id_relatorio" | "id_empresa" | "status" | "setores" | "responsavel_elaboracao" | "data_elaboracao" | "updated_at"
> & { concluido_em: string | null };

export async function carregarFontesDoGrupo(sb: Sb, idsEmpresa: string[]): Promise<FontesDoGrupo> {
  if (idsEmpresa.length === 0) return { empresas: [], documentos: [], linhas: [], pendencias: [] };

  const [aeps, riscos, emps] = await Promise.all([
    fetchAllRows<AepLida>((de, ate) =>
      sb
        .from("aep_relatorios")
        .select("id_relatorio, id_empresa, status, setores, responsavel_elaboracao, data_elaboracao, concluido_em, updated_at")
        .in("id_empresa", idsEmpresa)
        .eq("status", "CONCLUIDO")
        .order("id_relatorio")
        .range(de, ate),
    ),
    carregarRiscosPsicossociais(sb, idsEmpresa),
    sb.from("empresas").select("id_empresa, nome_empresa, cnpj, municipio, uf").in("id_empresa", idsEmpresa),
  ]);
  if (emps.error) throw emps.error;

  const documentos: DocumentoFonte[] = [];
  const linhas: LinhaFonte[] = [];
  const pendencias: PendenciaFonte[] = [];
  for (const a of aeps) {
    documentos.push(documentoDaAep(a));
    linhas.push(...linhasDaAep(a));
    pendencias.push(...pendenciasDaAep(a));
  }
  for (const e of riscos) {
    for (const av of e.avaliacoes) {
      documentos.push(documentoDaAvaliacao(e.idEmpresa, av));
      linhas.push(...linhasDaAvaliacao(e.idEmpresa, av));
      pendencias.push(...pendenciasDaAvaliacao(e.idEmpresa, av));
    }
  }

  const empresas = ((emps.data ?? []) as Array<{
    id_empresa: string;
    nome_empresa: string | null;
    cnpj: string | null;
    municipio: string | null;
    uf: string | null;
  }>).map((e) => ({
    idEmpresa: e.id_empresa,
    nome: e.nome_empresa ?? "Empresa sem nome",
    cnpj: e.cnpj,
    municipio: e.municipio,
    uf: e.uf,
  }));

  documentos.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  return { empresas, documentos, linhas, pendencias };
}

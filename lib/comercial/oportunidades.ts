// Módulo Comercial (2026-10-05): transforma as AEPs entregues ao cliente em
// OPORTUNIDADES de venda — serviços que a AEP indicou e que a empresa ainda
// não contratou. Puro (sem tela, sem banco) para testar.
//
//   • AET (vendida à parte): algum setor da AEP com "Necessita AET".
//   • DRPS / Questionário Psicossocial: AEP com 3+ alertas organizacionais
//     (`recomendaQuestionario`, a mesma regra do editor e da Sinalização).
//
// Situação de cada uma, pelo que a empresa já tem no sistema:
//   aberta    → indicada e nenhum documento do serviço existe (vender);
//   andamento → já existe um em rascunho/andamento (provavelmente vendido);
//   realizada → já existe um concluído/enviado.
// Os dados vêm da RPC `comercial_dados` (v267). Base: a AEP entregue mais
// recente de cada empresa, igual à Sinalização.

import { montarSinalizacao, type AepEntregue, type EmpresaSinalizada } from "@/lib/aep/sinalizacao";

export type SituacaoOportunidade = "aberta" | "andamento" | "realizada";
export type Produto = "AET" | "DRPS/Questionário";

export interface DocEmpresa {
  id_empresa: string;
  tipo: "AET" | "DRPS" | "QPS";
  status: string | null;
}

export interface SetorAet {
  nome: string;
  expostos: number;
  cargos: number;
}

export interface Oportunidade {
  produto: Produto;
  situacao: SituacaoOportunidade;
  /** Para AET: setores indicados. */
  setores: SetorAet[];
}

export interface EmpresaComercial {
  empresa: EmpresaSinalizada;
  telefone: string | null;
  email: string | null;
  oportunidades: Oportunidade[];
  /** Trabalhadores expostos nos setores indicados para AET (base do orçamento). */
  expostosAet: number;
}

const FASE: Record<string, "realizada" | "andamento"> = {
  CONCLUIDO: "realizada",
  ENVIADO_CLIENTE: "realizada",
  RASCUNHO: "andamento",
  EM_ANDAMENTO: "andamento",
};

/** Melhor situação entre os documentos: realizada > andamento > aberta. */
export function situacaoPorDocs(status: (string | null)[]): SituacaoOportunidade {
  const fases = status.map((s) => FASE[s ?? ""]).filter(Boolean);
  if (fases.includes("realizada")) return "realizada";
  if (fases.includes("andamento")) return "andamento";
  return "aberta";
}

export function montarComercial(aeps: (AepEntregue & { empresas?: unknown })[], docs: DocEmpresa[]): EmpresaComercial[] {
  const empresas = montarSinalizacao(aeps);
  // A sinalização só traz empresa com fator organizacional "Sim". Para o
  // comercial a AET pode vir só da física/cognitiva — inclui as demais.
  const comFator = new Set(empresas.map((e) => e.idEmpresa));
  const ultimaPorEmpresa = new Map<string, AepEntregue>();
  for (const a of aeps) {
    const atual = ultimaPorEmpresa.get(a.id_empresa);
    const data = (x: AepEntregue) => x.entregue_em ?? x.data_elaboracao ?? "";
    if (!atual || data(a) > data(atual)) ultimaPorEmpresa.set(a.id_empresa, a);
  }
  for (const [id, a] of ultimaPorEmpresa) {
    if (comFator.has(id)) continue;
    if (!(a.setores ?? []).some((s) => s.necessita_aet)) continue;
    const cad = (a.empresas ?? {}) as { nome_empresa?: string; cnpj?: string | null; id_unidade?: string | null; municipio?: string | null; uf?: string | null };
    empresas.push({
      idEmpresa: id,
      nome: cad.nome_empresa ?? "Empresa sem cadastro",
      cnpj: cad.cnpj ?? null,
      avaliacoes: [],
      totalSetores: 0,
      totalAlertas: 0,
      totalAltos: 0,
      pior: null,
      ultimaData: a.entregue_em ?? a.data_elaboracao ?? null,
      precisaAet: true,
      precisaQuestionario: false,
      realizadaPor: a.responsavel_elaboracao || null,
      enviadoPor: a.enviado_por?.trim() || null,
      temInspecao: !!(a as { id_inspecao?: string | null }).id_inspecao,
      idUnidade: cad.id_unidade ?? null,
      municipio: cad.municipio ?? null,
      uf: cad.uf ?? null,
    });
  }

  return empresas
    .map((e) => {
      const ultima = ultimaPorEmpresa.get(e.idEmpresa);
      const cad = (ultima?.empresas ?? {}) as { telefone?: string | null; email?: string | null };
      const docsDa = docs.filter((d) => d.id_empresa === e.idEmpresa);
      const oportunidades: Oportunidade[] = [];
      const setoresAet: SetorAet[] = (ultima?.setores ?? [])
        .filter((s) => s.necessita_aet)
        .map((s) => ({
          nome: s.nome_setor || "Setor sem nome",
          expostos: Number(s.qtd_expostos) || 0,
          cargos: (s.cargos ?? []).filter((c) => c.cargo).length,
        }));
      if (e.precisaAet) {
        oportunidades.push({
          produto: "AET",
          situacao: situacaoPorDocs(docsDa.filter((d) => d.tipo === "AET").map((d) => d.status)),
          setores: setoresAet,
        });
      }
      if (e.precisaQuestionario) {
        oportunidades.push({
          produto: "DRPS/Questionário",
          situacao: situacaoPorDocs(docsDa.filter((d) => d.tipo !== "AET").map((d) => d.status)),
          setores: [],
        });
      }
      return {
        empresa: e,
        telefone: cad.telefone?.trim() || null,
        email: cad.email?.trim() || null,
        oportunidades,
        expostosAet: setoresAet.reduce((n, s) => n + s.expostos, 0),
      };
    })
    .filter((c) => c.oportunidades.length > 0)
    .sort(
      (a, b) =>
        b.oportunidades.filter((o) => o.situacao === "aberta").length -
          a.oportunidades.filter((o) => o.situacao === "aberta").length ||
        a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"),
    );
}

/** Uma linha por oportunidade, para exportar (CSV/Excel). */
export function linhasCsv(lista: EmpresaComercial[], nomeUnidade: (id: string | null) => string): string[][] {
  const cab = [
    "Empresa", "CNPJ", "Unidade", "Município/UF", "Telefone", "E-mail", "Produto", "Situação",
    "Setores indicados (AET)", "Trabalhadores expostos (AET)", "Nível AIHA", "Realizada por", "Enviada por", "Entregue em",
  ];
  const rot: Record<SituacaoOportunidade, string> = { aberta: "Aberta", andamento: "Em andamento", realizada: "Realizada" };
  const linhas = lista.flatMap((c) =>
    c.oportunidades.map((o) => [
      c.empresa.nome,
      c.empresa.cnpj ?? "",
      nomeUnidade(c.empresa.idUnidade),
      [c.empresa.municipio, c.empresa.uf].filter(Boolean).join("/"),
      c.telefone ?? "",
      c.email ?? "",
      o.produto,
      rot[o.situacao],
      o.setores.map((s) => s.nome).join(", "),
      o.produto === "AET" ? String(c.expostosAet) : "",
      c.empresa.pior ?? "",
      c.empresa.realizadaPor ?? "",
      c.empresa.enviadoPor ?? "",
      c.empresa.ultimaData ? c.empresa.ultimaData.slice(0, 10) : "",
    ]),
  );
  return [cab, ...linhas];
}

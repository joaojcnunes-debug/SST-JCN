// Consolidação Psicossocial de Grupo — fase 7: o REGISTRO de uma consolidação (foto
// imutável do que foi enviado ao cliente) e a validação do cliente, empresa por empresa.
//
// As tabelas são da v295 e são append-only (sem UPDATE/DELETE): um registro novo não
// apaga o anterior, e uma validação nova de uma empresa vale sobre a anterior (a
// história fica). Funções puras aqui; a gravação fica no hook.

import type { DocumentoFonte } from "./fontes";
import type { ItemMotor, ResultadoMotor } from "./motor";

export type Decisao = "VALIDADO" | "COM_RESSALVA";

export interface ParametrosRegistro {
  incluir_trivial_baixo: boolean;
  fatores_ignorados: string[];
  setores_sem_transito: string[];
  documentos: string[];
  /** Impressão digital do que vai para o PGR (Sim/Não e perfil): muda se o resultado mudar. */
  assinatura: string;
  /** Nº de itens gravados — registro com menos itens que isso ficou incompleto. */
  n_itens: number;
  empresas: string[];
  resumo: ResultadoMotor["resumo"];
}

export interface ExecucaoLinha {
  id_execucao: string;
  id_grupo: string;
  criado_em: string;
  criado_por: string;
  fontes: Array<{ id: string; origem: string; id_empresa: string; data: string | null; titulo: string }>;
  parametros: ParametrosRegistro;
  observacao: string | null;
}

export interface ValidacaoLinha {
  id_validacao: string;
  id_execucao: string;
  id_empresa: string;
  decisao: Decisao;
  validado_por: string;
  comentario: string | null;
  validado_em: string;
  registrado_por: string;
  registrado_em: string;
}

/** Hash curto e estável (FNV-1a 32 bits) — só para comparar, não é segurança. */
function fnv(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** O que importa para o cliente: o Sim/Não por empresa × setor e o nível do perfil. */
export function assinaturaResultado(r: ResultadoMotor): string {
  const sim = r.simNaoEmpresa
    .map((l) => `${l.idEmpresa}|${l.setor}|${Object.keys(l.fatores).filter((f) => l.fatores[f]).sort().join(",")}`)
    .sort();
  const perfil = [...r.perfil, ...r.avaliacaoPropria].map((p) => `${p.setor}|${p.idFator}|${p.nivel}`).sort();
  return fnv(sim.join("\n") + "\n#\n" + perfil.join("\n"));
}

export function montarRegistro(p: {
  idExecucao: string;
  idGrupo: string;
  r: ResultadoMotor;
  itens: ItemMotor[];
  documentos: DocumentoFonte[];
  idSetorCanonico: (nome: string) => string | null;
  incluirTrivialBaixo: boolean;
  fatoresIgnorados: string[];
  setoresSemTransito: string[];
  observacao: string | null;
}) {
  const fatores = new Set(p.r.fatores.map((f) => f.id_fator));
  const itens = p.itens
    .filter((i) => fatores.has(i.idFator))
    .map((i) => ({
      id_execucao: p.idExecucao,
      id_empresa: i.idEmpresa,
      origem: i.origem,
      id_documento: i.idDocumento ?? null,
      setor_original: i.setorOriginal,
      id_setor_canonico: p.idSetorCanonico(i.setor),
      setor_canonico: i.setor,
      id_fator: i.idFator,
      nivel: i.nivel,
      sinais: i.sinais,
      respondentes: i.respondentes,
    }));
  const parametros: ParametrosRegistro = {
    incluir_trivial_baixo: p.incluirTrivialBaixo,
    fatores_ignorados: p.fatoresIgnorados,
    setores_sem_transito: p.setoresSemTransito,
    documentos: p.documentos.map((d) => d.id),
    assinatura: assinaturaResultado(p.r),
    n_itens: itens.length,
    empresas: [...new Set(p.r.simNaoEmpresa.map((l) => l.idEmpresa))],
    resumo: p.r.resumo,
  };
  return {
    execucao: {
      id_execucao: p.idExecucao,
      id_grupo: p.idGrupo,
      fontes: p.documentos.map((d) => ({ id: d.id, origem: d.origem, id_empresa: d.idEmpresa, data: d.data, titulo: d.titulo })),
      parametros,
      resultado: p.r,
      observacao: p.observacao?.trim() || null,
    },
    itens,
  };
}

/** Validação que vale para cada empresa: a mais recente registrada. */
export function validacaoVigente(validacoes: ValidacaoLinha[]): Map<string, ValidacaoLinha> {
  const m = new Map<string, ValidacaoLinha>();
  for (const v of validacoes) {
    const k = `${v.id_execucao}|${v.id_empresa}`;
    const atual = m.get(k);
    if (!atual || v.registrado_em > atual.registrado_em) m.set(k, v);
  }
  return m;
}

/**
 * Biblioteca psicossocial — os 13 fatores com descrição do risco, danos à
 * saúde, fontes geradoras codificadas, meio de propagação, situação e tempo de
 * exposição padrão, sugestões iniciais e ações (Fase 2, 2026-10-06; tabela
 * `psi_biblioteca_fatores`, v272; seed do Anexo A).
 *
 * Única para o sistema (sem empresa): a AEP usa hoje, e foi feita para o
 * DRPS/QPS usarem depois. Leitura para todos; edição só Admin
 * (`/aep/biblioteca`). Módulo PURO: tipos e normalização, usados pela tela,
 * pelo laudo, pela rota do PDF e pelo inventário.
 */

export interface FonteGeradora {
  codigo: string;
  texto: string;
}

export interface FatorBiblioteca {
  fator: string;
  ordem: number;
  descricao_risco: string;
  danos_saude: string;
  meio_propagacao: string;
  situacao_padrao: string;
  tempo_exposicao_padrao: string;
  medidas_controle_verificar: string;
  fontes_geradoras: FonteGeradora[];
  sugestoes_iniciais: string[];
  acoes: string[];
  atualizado_em?: string | null;
  atualizado_por?: string | null;
}

export type Biblioteca = Record<string, FatorBiblioteca>;

const txt = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function normalizarFatorBiblioteca(raw: unknown): FatorBiblioteca | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.fator !== "string") return null;
  return {
    fator: r.fator,
    ordem: typeof r.ordem === "number" ? r.ordem : 0,
    descricao_risco: txt(r.descricao_risco),
    danos_saude: txt(r.danos_saude),
    meio_propagacao: txt(r.meio_propagacao),
    situacao_padrao: txt(r.situacao_padrao),
    tempo_exposicao_padrao: txt(r.tempo_exposicao_padrao),
    medidas_controle_verificar: txt(r.medidas_controle_verificar),
    fontes_geradoras: Array.isArray(r.fontes_geradoras)
      ? (r.fontes_geradoras as unknown[])
          .filter((f): f is FonteGeradora => typeof f === "object" && f !== null && typeof (f as FonteGeradora).codigo === "string")
          .map((f) => ({ codigo: f.codigo, texto: txt(f.texto) }))
      : [],
    sugestoes_iniciais: lista(r.sugestoes_iniciais),
    acoes: lista(r.acoes),
    atualizado_em: typeof r.atualizado_em === "string" ? r.atualizado_em : null,
    atualizado_por: typeof r.atualizado_por === "string" ? r.atualizado_por : null,
  };
}

export function montarBiblioteca(rows: unknown[] | null | undefined): Biblioteca {
  const out: Biblioteca = {};
  for (const r of rows ?? []) {
    const f = normalizarFatorBiblioteca(r);
    if (f) out[f.fator] = f;
  }
  return out;
}

/** Textos das fontes da biblioteca marcadas no fator ("1.3 — Ausência de…"). */
export function fontesMarcadas(b: Biblioteca | null | undefined, fator: string, codigos: readonly string[] | undefined): string[] {
  const doFator = b?.[fator]?.fontes_geradoras ?? [];
  return doFator.filter((f) => codigos?.includes(f.codigo)).map((f) => `${f.codigo} — ${f.texto}`);
}

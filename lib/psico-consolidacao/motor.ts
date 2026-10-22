// Consolidação Psicossocial de Grupo — o MOTOR DE REGRAS (fase 4).
//
// Função pura: recebe as linhas já padronizadas (setor canônico + fator do catálogo)
// e devolve comparativo da AEP, totais do DRPS/QPS, confronto AEP × DRPS, perfil
// consolidado por setor, lacunas por empresa, as tabelas Sim/Não e os alertas.
// Nada de banco nem de tela aqui — é testado com o caso real de um grupo do painel (anonimizado)
// (motor.test.ts), contra os números do pedido de 19/10.
//
// As regras (prompt de 19/10 + complemento, seções 4.0 a 4.7 e 5):
//  • nível de cada linha: DRPS/QPS Crítico 4, Alto 3, Médio 2; Baixo NÃO conta (fica em
//    monitoramento). AEP: fator "Sim" conta como "Identificado" (abaixo de Médio), com o
//    nível AIHA gravado ao lado. Com `aepIncluirTrivialBaixo = false`, a AEP Trivial/Baixo
//    sai;
//  • mesmo setor mais de uma vez na empresa (variante Altura) → vale o MAIOR nível;
//  • setor em 2+ empresas e que transita = COMUM: o perfil dele (todo fator presente em
//    qualquer empresa, no maior nível) é o mínimo para todas as empresas que têm o setor;
//  • setor de uma empresa só mantém a avaliação própria (¹ nos relatórios);
//  • lacuna: ausente/Baixo → Incluir; nível DRPS abaixo do perfil → Revisar nível;
//    Identificado ou nível ≥ perfil → OK.

import { SEVERIDADE_PADRAO_IDX } from "@/lib/aep/aiha-organizacional";
import type { ConfiancaAep, NivelConsolidacao } from "./fontes";
import type { OrigemFonte } from "./fatores";

/**
 * Nível AIHA pela regra da metodologia (complemento, 4.3.1) — usado SÓ quando o setor
 * não tem o nível gravado (AEP concluída antes da matriz AIHA, 02/10/2026). O gravado
 * vale sempre: o técnico pode ter trocado probabilidade ou severidade à mão.
 * Probabilidade = nº de sinais marcados (4 ou 5 → 4); severidade = padrão do fator
 * (Irreversíveis 3, Severos 2, Preocupantes 1); nível = produto.
 */
export function nivelAihaPelaRegra(idFator: string, nSinais: number): string {
  const prob = Math.min(Math.max(nSinais, 0), 4);
  const sev = SEVERIDADE_PADRAO_IDX[idFator as keyof typeof SEVERIDADE_PADRAO_IDX] ?? 1;
  const v = prob * sev;
  if (v === 0) return "Trivial";
  if (v <= 2) return "Baixo";
  if (v <= 6) return "Moderado";
  if (v <= 10) return "Alto";
  return "Muito Alto";
}

/** Nível AIHA que vale para a linha: o gravado; sem ele, o da regra. */
export function nivelAihaEfetivo(i: Pick<ItemMotor, "idFator" | "nivelAiha" | "sinais">): {
  nivel: string;
  pelaRegra: boolean;
} {
  return i.nivelAiha ? { nivel: i.nivelAiha, pelaRegra: false } : { nivel: nivelAihaPelaRegra(i.idFator, i.sinais.length), pelaRegra: true };
}

/**
 * A linha conta como risco presente? DRPS/QPS Baixo não conta; AEP conta sempre, ou só
 * acima de Trivial/Baixo na AIHA quando `incluirTrivialBaixo = false`.
 */
export function itemPresente(i: ItemMotor, incluirTrivialBaixo = true): boolean {
  if (i.origem === "AEP") {
    if (incluirTrivialBaixo) return true;
    const n = nivelAihaEfetivo(i).nivel;
    return n !== "Trivial" && n !== "Baixo";
  }
  return i.nivel !== "Baixo";
}

export type NivelPresente = "Identificado" | "Médio" | "Alto" | "Crítico";

/** Peso para "o maior nível vence". Baixo = 0 (não é risco presente). */
export const PESO_NIVEL: Record<NivelConsolidacao, number> = {
  Baixo: 0,
  Identificado: 1,
  Médio: 2,
  Alto: 3,
  Crítico: 4,
};

const ORDEM_DRPS: NivelConsolidacao[] = ["Crítico", "Alto", "Médio", "Baixo"];

export interface ItemMotor {
  idEmpresa: string;
  origem: OrigemFonte;
  setorOriginal: string;
  /** Setor padronizado (canônico) do grupo. */
  setor: string;
  /** Fator do catálogo (psico_fatores.id_fator). */
  idFator: string;
  nivel: NivelConsolidacao;
  sinais: string[];
  semSinal: boolean;
  nivelAiha: string | null;
  confianca: ConfiancaAep | null;
  respondentes: number | null;
  probabilidadeInformada: boolean | null;
  /** Documento de onde a linha veio (só para o registro da fase 7; o motor não usa). */
  idDocumento?: string | null;
}

export interface EmpresaMotor {
  idEmpresa: string;
  nome: string;
  /** SPE / EXECUTORA / INCORPORADORA / OUTRA; null = não informado. */
  papel: string | null;
}

export interface FatorMotor {
  id_fator: string;
  nome: string;
  ordem: number;
}

export interface PendenciaMotor {
  idEmpresa: string;
  origem: OrigemFonte;
  setorOriginal: string;
  fator: string;
  tipo: "nao_identificado" | "sem_base";
}

export interface EntradaMotor {
  itens: ItemMotor[];
  empresas: EmpresaMotor[];
  /** Fatores considerados (já sem os ignorados pelo grupo). */
  fatores: FatorMotor[];
  /** Setores canônicos marcados como "não transita". */
  setoresSemTransito?: string[];
  pendencias?: PendenciaMotor[];
  aepIncluirTrivialBaixo?: boolean;
}

export type ClasseComparativo = "Unânime" | "Parcial" | "Exclusivo";
export type ClasseConfronto = "Convergente" | "Divergente" | "Só AEP" | "Só DRPS" | "Sem indicação";
export type PresencaFator = "Nas duas fontes" | "Só na AEP" | "Só no DRPS" | "Em nenhuma";
export type AcaoLacuna = "Incluir" | "Revisar nível" | "OK";

export interface FonteNivel {
  idEmpresa: string;
  nivel: NivelPresente;
}

export interface LinhaPerfil {
  setor: string;
  idFator: string;
  nivel: NivelPresente;
  /** Empresas onde o fator foi achado, do mais grave para o menos grave. */
  fontes: FonteNivel[];
}

export interface Lacuna {
  idEmpresa: string;
  setor: string;
  idFator: string;
  /** Nível na própria empresa; null = ausente (ou só Baixo). */
  situacao: NivelPresente | null;
  perfil: NivelPresente;
  acao: AcaoLacuna;
  fontes: FonteNivel[];
}

export interface Alerta {
  tipo:
    | "fator_sem_sinal"
    | "aiha_nao_calculada"
    | "empregadora_sem_drps"
    | "probabilidade_nao_informada"
    | "poucos_respondentes"
    | "nao_identificado"
    | "sem_base";
  idEmpresa: string;
  setor?: string;
  idFator?: string;
  texto: string;
}

export interface ResultadoMotor {
  fatores: FatorMotor[];
  setores: Array<{ setor: string; empresas: string[]; comum: boolean; transita: boolean }>;
  comparativoAep: {
    empresas: string[];
    fatores: Array<{
      idFator: string;
      empresas: string[];
      classe: ClasseComparativo;
      sinais: Array<{ sinal: string; empresas: string[] }>;
      /** Sinais que só uma empresa marcou, num fator que 2+ empresas apontam. */
      sinaisExclusivos: Array<{ sinal: string; idEmpresa: string }>;
    }>;
  };
  drps: {
    total: Record<"Crítico" | "Alto" | "Médio" | "Baixo", number>;
    porFator: Record<string, Record<"Crítico" | "Alto" | "Médio" | "Baixo", number>>;
  };
  confronto: {
    celulas: Array<{ setor: string; idFator: string; classe: ClasseConfronto }>;
    totais: Record<ClasseConfronto, number>;
    porFator: Array<{ idFator: string; presenca: PresencaFator }>;
  };
  /** Perfil dos setores COMUNS (mínimo obrigatório para as empresas que têm o setor). */
  perfil: LinhaPerfil[];
  /** Setores de uma empresa só (ou que não transitam): a avaliação própria. */
  avaliacaoPropria: LinhaPerfil[];
  lacunas: Lacuna[];
  resumo: { incluir: number; revisar: number; ok: number };
  /** Setor × fator: "Sim" quando o fator está no perfil (ou na avaliação própria). */
  simNaoSetor: Array<{ setor: string; unicaEmpresa: boolean; fatores: Record<string, boolean> }>;
  /** Empresa × setor × fator: "Sim" quando o fator deve constar no PGR da empresa naquele setor. */
  simNaoEmpresa: Array<{ idEmpresa: string; setor: string; unicaEmpresa: boolean; fatores: Record<string, boolean> }>;
  alertas: Alerta[];
}

const ehDrps = (o: OrigemFonte) => o === "DRPS" || o === "QPS";

function maior(a: NivelPresente | null, b: NivelPresente): NivelPresente {
  return !a || PESO_NIVEL[b] > PESO_NIVEL[a] ? b : a;
}

function porNome<T>(lista: T[], chave: (x: T) => string): T[] {
  return [...lista].sort((a, b) => chave(a).localeCompare(chave(b), "pt-BR"));
}

export function consolidar(entrada: EntradaMotor): ResultadoMotor {
  const incluirTrivial = entrada.aepIncluirTrivialBaixo ?? true;
  const semTransito = new Set(entrada.setoresSemTransito ?? []);
  const idsFator = new Set(entrada.fatores.map((f) => f.id_fator));
  const nomeEmpresa = new Map(entrada.empresas.map((e) => [e.idEmpresa, e.nome]));
  const itens = entrada.itens.filter((i) => idsFator.has(i.idFator) && i.setor);

  const presente = (i: ItemMotor) => itemPresente(i, incluirTrivial);

  // ── Fatores que aparecem em algum documento (o 13º só entra se marcado) ──────
  const fatoresUsados = entrada.fatores
    .filter((f) => itens.some((i) => i.idFator === f.id_fator))
    .sort((a, b) => a.ordem - b.ordem);

  // ── Setores: quem tem cada setor (qualquer origem, inclusive só Baixo) ───────
  const empresasDoSetor = new Map<string, Set<string>>();
  for (const i of itens) {
    const s = empresasDoSetor.get(i.setor) ?? new Set<string>();
    s.add(i.idEmpresa);
    empresasDoSetor.set(i.setor, s);
  }
  const setores = porNome([...empresasDoSetor.entries()], ([s]) => s).map(([setor, emps]) => {
    const transita = !semTransito.has(setor);
    return { setor, empresas: [...emps], comum: emps.size >= 2 && transita, transita };
  });

  // ── Nível de cada empresa × setor × fator (o maior presente) ──────────────────
  const nivelEmpresa = new Map<string, NivelPresente>();
  const chave = (e: string, s: string, f: string) => `${e}\u0001${s}\u0001${f}`;
  for (const i of itens) {
    if (!presente(i)) continue;
    const n: NivelPresente = i.origem === "AEP" ? "Identificado" : (i.nivel as NivelPresente);
    const k = chave(i.idEmpresa, i.setor, i.idFator);
    nivelEmpresa.set(k, maior(nivelEmpresa.get(k) ?? null, n));
  }

  // ── Perfil (setor comum) e avaliação própria (setor de uma empresa) ──────────
  const perfil: LinhaPerfil[] = [];
  const avaliacaoPropria: LinhaPerfil[] = [];
  for (const s of setores) {
    for (const f of fatoresUsados) {
      const fontes: FonteNivel[] = [];
      for (const e of s.empresas) {
        const n = nivelEmpresa.get(chave(e, s.setor, f.id_fator));
        if (n) fontes.push({ idEmpresa: e, nivel: n });
      }
      if (fontes.length === 0) continue;
      fontes.sort(
        (a, b) =>
          PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel] ||
          (nomeEmpresa.get(a.idEmpresa) ?? "").localeCompare(nomeEmpresa.get(b.idEmpresa) ?? "", "pt-BR"),
      );
      const linha = { setor: s.setor, idFator: f.id_fator, nivel: fontes[0].nivel, fontes };
      (s.comum ? perfil : avaliacaoPropria).push(linha);
    }
  }

  // ── Lacunas: cada empresa × setor comum × fator do perfil ────────────────────
  const lacunas: Lacuna[] = [];
  for (const p of perfil) {
    for (const e of empresasDoSetor.get(p.setor) ?? []) {
      const situacao = nivelEmpresa.get(chave(e, p.setor, p.idFator)) ?? null;
      let acao: AcaoLacuna;
      if (!situacao) acao = "Incluir";
      else if (situacao === "Identificado") acao = "OK";
      else acao = PESO_NIVEL[situacao] < PESO_NIVEL[p.nivel] ? "Revisar nível" : "OK";
      lacunas.push({ idEmpresa: e, setor: p.setor, idFator: p.idFator, situacao, perfil: p.nivel, acao, fontes: p.fontes });
    }
  }
  const resumo = {
    incluir: lacunas.filter((l) => l.acao === "Incluir").length,
    revisar: lacunas.filter((l) => l.acao === "Revisar nível").length,
    ok: lacunas.filter((l) => l.acao === "OK").length,
  };

  // ── Sim/Não ───────────────────────────────────────────────────────────────────
  const noPerfil = new Set([...perfil, ...avaliacaoPropria].map((p) => `${p.setor}\u0001${p.idFator}`));
  const simNaoSetor = setores.map((s) => ({
    setor: s.setor,
    unicaEmpresa: !s.comum,
    fatores: Object.fromEntries(fatoresUsados.map((f) => [f.id_fator, noPerfil.has(`${s.setor}\u0001${f.id_fator}`)])),
  }));
  const simNaoEmpresa = porNome(
    setores.flatMap((s) => s.empresas.map((idEmpresa) => ({ idEmpresa, s }))),
    (x) => `${nomeEmpresa.get(x.idEmpresa) ?? x.idEmpresa}\u0001${x.s.setor}`,
  ).map(({ idEmpresa, s }) => ({
    idEmpresa,
    setor: s.setor,
    unicaEmpresa: !s.comum,
    fatores: Object.fromEntries(
      fatoresUsados.map((f) => [
        f.id_fator,
        s.comum
          ? noPerfil.has(`${s.setor}\u0001${f.id_fator}`)
          : nivelEmpresa.has(chave(idEmpresa, s.setor, f.id_fator)),
      ]),
    ),
  }));

  // ── Comparativo AEP entre empresas ───────────────────────────────────────────
  const aepPresentes = itens.filter((i) => i.origem === "AEP" && presente(i));
  const empresasAep = [...new Set(itens.filter((i) => i.origem === "AEP").map((i) => i.idEmpresa))];
  const comparativoFatores = fatoresUsados
    .map((f) => {
      const doFator = aepPresentes.filter((i) => i.idFator === f.id_fator);
      const empresas = [...new Set(doFator.map((i) => i.idEmpresa))];
      const sinaisMap = new Map<string, Set<string>>();
      for (const i of doFator) {
        for (const sn of i.sinais) {
          const s = sinaisMap.get(sn) ?? new Set<string>();
          s.add(i.idEmpresa);
          sinaisMap.set(sn, s);
        }
      }
      const sinais = [...sinaisMap.entries()]
        .map(([sinal, es]) => ({ sinal, empresas: [...es] }))
        .sort((a, b) => b.empresas.length - a.empresas.length || a.sinal.localeCompare(b.sinal, "pt-BR"));
      const classe: ClasseComparativo =
        empresas.length === empresasAep.length && empresasAep.length > 1
          ? "Unânime"
          : empresas.length === 1
            ? "Exclusivo"
            : "Parcial";
      const sinaisExclusivos =
        empresas.length >= 2
          ? sinais.filter((s) => s.empresas.length === 1).map((s) => ({ sinal: s.sinal, idEmpresa: s.empresas[0] }))
          : [];
      return { idFator: f.id_fator, empresas, classe, sinais, sinaisExclusivos };
    })
    .filter((f) => f.empresas.length > 0)
    .sort((a, b) => b.empresas.length - a.empresas.length);

  // ── Totais do DRPS/QPS (cada linha = uma avaliação setor × fator) ─────────────
  const zero = () => ({ Crítico: 0, Alto: 0, Médio: 0, Baixo: 0 });
  const drps = { total: zero(), porFator: {} as Record<string, ReturnType<typeof zero>> };
  for (const i of itens) {
    if (!ehDrps(i.origem) || !ORDEM_DRPS.includes(i.nivel)) continue;
    const n = i.nivel as keyof ReturnType<typeof zero>;
    drps.total[n]++;
    drps.porFator[i.idFator] ??= zero();
    drps.porFator[i.idFator][n]++;
  }

  // ── Confronto AEP × DRPS (fator × setor, no grupo) ────────────────────────────
  const setorAvaliadoDrps = new Set(itens.filter((i) => ehDrps(i.origem)).map((i) => i.setor));
  const aepAponta = new Set(aepPresentes.map((i) => `${i.setor}\u0001${i.idFator}`));
  const drpsAponta = new Set(
    itens.filter((i) => ehDrps(i.origem) && i.nivel !== "Baixo").map((i) => `${i.setor}\u0001${i.idFator}`),
  );
  const totais: Record<ClasseConfronto, number> = {
    Convergente: 0, Divergente: 0, "Só AEP": 0, "Só DRPS": 0, "Sem indicação": 0,
  };
  const celulas: ResultadoMotor["confronto"]["celulas"] = [];
  for (const f of fatoresUsados) {
    for (const s of setores) {
      const k = `${s.setor}\u0001${f.id_fator}`;
      const aep = aepAponta.has(k);
      const drp = drpsAponta.has(k);
      const classe: ClasseConfronto = aep
        ? drp
          ? "Convergente"
          : setorAvaliadoDrps.has(s.setor)
            ? "Divergente"
            : "Só AEP"
        : drp
          ? "Só DRPS"
          : "Sem indicação";
      totais[classe]++;
      celulas.push({ setor: s.setor, idFator: f.id_fator, classe });
    }
  }
  const porFator = fatoresUsados.map((f) => {
    const aep = aepPresentes.some((i) => i.idFator === f.id_fator);
    const drp = itens.some((i) => ehDrps(i.origem) && i.idFator === f.id_fator && i.nivel !== "Baixo");
    const presenca: PresencaFator = aep && drp ? "Nas duas fontes" : aep ? "Só na AEP" : drp ? "Só no DRPS" : "Em nenhuma";
    return { idFator: f.id_fator, presenca };
  });

  // ── Alertas ──────────────────────────────────────────────────────────────────
  const alertas: Alerta[] = [];
  const nomeFator = new Map(entrada.fatores.map((f) => [f.id_fator, f.nome]));
  for (const i of itens.filter((x) => x.origem === "AEP")) {
    if (i.semSinal) {
      alertas.push({
        tipo: "fator_sem_sinal", idEmpresa: i.idEmpresa, setor: i.setorOriginal, idFator: i.idFator,
        texto: `${nomeFator.get(i.idFator)} marcado "Sim" sem nenhum sinal observado`,
      });
    }
    if (!i.nivelAiha) {
      alertas.push({
        tipo: "aiha_nao_calculada", idEmpresa: i.idEmpresa, setor: i.setorOriginal, idFator: i.idFator,
        texto: `Matriz AIHA não gravada para ${nomeFator.get(i.idFator)} — nível pela regra: ${nivelAihaPelaRegra(i.idFator, i.sinais.length)}`,
      });
    }
  }
  const comDrps = new Set(itens.filter((i) => ehDrps(i.origem)).map((i) => i.idEmpresa));
  for (const e of entrada.empresas) {
    // SPE contratante não tem empregado próprio: recebe a AEP global, nunca DRPS.
    if ((e.papel === "EXECUTORA" || e.papel === "INCORPORADORA") && !comDrps.has(e.idEmpresa)) {
      alertas.push({ tipo: "empregadora_sem_drps", idEmpresa: e.idEmpresa, texto: "Empresa empregadora sem DRPS/Questionário concluído" });
    }
  }
  const vistos = new Set<string>();
  for (const i of itens.filter((x) => ehDrps(x.origem))) {
    const k = `${i.idEmpresa}\u0001${i.setorOriginal}`;
    if (i.probabilidadeInformada === false && !vistos.has(`p${k}${i.idFator}`)) {
      vistos.add(`p${k}${i.idFator}`);
      alertas.push({
        tipo: "probabilidade_nao_informada", idEmpresa: i.idEmpresa, setor: i.setorOriginal, idFator: i.idFator,
        texto: `Probabilidade não informada — valeu Baixa (1) para ${nomeFator.get(i.idFator)}`,
      });
    }
    if (i.respondentes != null && i.respondentes > 0 && i.respondentes <= 2 && !vistos.has(`r${k}`)) {
      vistos.add(`r${k}`);
      alertas.push({
        tipo: "poucos_respondentes", idEmpresa: i.idEmpresa, setor: i.setorOriginal,
        texto: `Só ${i.respondentes} respondente(s): baixa representatividade`,
      });
    }
  }
  for (const p of entrada.pendencias ?? []) {
    alertas.push({
      tipo: p.tipo, idEmpresa: p.idEmpresa, setor: p.setorOriginal,
      texto: p.tipo === "nao_identificado" ? `${p.fator}: N/I na AEP (pendente de avaliação)` : `${p.fator}: sem base (ninguém respondeu)`,
    });
  }

  return {
    fatores: fatoresUsados,
    setores,
    comparativoAep: { empresas: empresasAep, fatores: comparativoFatores },
    drps,
    confronto: { celulas, totais, porFator },
    perfil,
    avaliacaoPropria,
    lacunas,
    resumo,
    simNaoSetor,
    simNaoEmpresa,
    alertas,
  };
}

// Conciliação DRPS/QPS × AEP (29/10/2026) — por empresa, setor × fator, o que os
// QUESTIONÁRIOS (percepção de quem trabalha: DRPS e QPS) dizem contra o que a AEP
// (observação do técnico, ergonomia organizacional) viu.
//
// Usa as MESMAS linhas, o mesmo catálogo de fatores e a mesma sugestão de setor da
// Consolidação (fontes.ts, fatores.ts, setores.ts), para as duas telas nunca discordarem
// sobre o que está em cada documento. A diferença é a pergunta: a Consolidação junta as
// fontes num perfil; aqui as duas ficam lado a lado e a tela aponta onde não batem.
//
// Régua (pedido de 29/10: "presença e nível"; QPS com coluna própria):
//  • escala comum de 4 degraus — questionário: Baixo 1 · Médio 2 · Alto 3 · Crítico 4;
//    AEP (nível AIHA gravado no setor): Trivial/Baixo 1 · Moderado 2 · Alto 3 · Muito Alto 4;
//  • o questionário APONTA o fator a partir de Médio (Baixo fica em monitoramento, como
//    na Consolidação); a AEP aponta com o fator "Sim" e AIHA a partir de Moderado — "Sim"
//    sem AIHA calculada (AEP anterior a 02/10) aponta sem nível;
//  • os dois apontam: diferença de até 1 degrau = Convergente; 2 ou mais = Nível divergente;
//    sem nível na AEP, vale a presença (Convergente);
//  • só um aponta: Só questionário / Só AEP — desde que a outra fonte tenha avaliado o setor;
//  • nenhum aponta: Sem indicação;
//  • o setor não existe numa das fontes: Sem par (não dá para conciliar).
//
// NR-01 / NR-17 (v0.3.176, banco v310):
//  • setores ligados à mão por empresa (`deparaSetores`) e sugestão de pares parecidos;
//  • representatividade do questionário: respondentes × expostos do setor na AEP;
//  • prioridade de cada cruzamento (classe, nível, expostos, representatividade);
//  • sugestão de AET (NR-17, 17.3.2: avaliação mais aprofundada) na divergência;
//  • parecer por cruzamento (Confirmar no PGR, AET, Descartar) e o que ainda falta.
//
// Função pura, testada em conciliacao.test.ts.

import { resolverFator, type OrigemFonte, type PsicoFator, type PsicoFatorDepara } from "./fatores";
import { documentosPadrao, type DocumentoFonte, type LinhaFonte, type PendenciaFonte } from "./fontes";
import { chaveSetor, sugerirSetorCanonico } from "./setores";

export type Questionario = "DRPS" | "QPS";
export const QUESTIONARIOS: Questionario[] = ["DRPS", "QPS"];

export type ClasseConciliacao =
  | "Convergente"
  | "Nível divergente"
  | "Só questionário"
  | "Só AEP"
  | "Sem indicação"
  | "Sem par";

export const CLASSES: ClasseConciliacao[] = [
  "Nível divergente",
  "Só questionário",
  "Só AEP",
  "Convergente",
  "Sem indicação",
  "Sem par",
];

/** As classes que pedem revisão de alguém. */
export const DIVERGENCIAS: ReadonlySet<ClasseConciliacao> = new Set(["Nível divergente", "Só questionário", "Só AEP"]);

/** Diferença de degraus a partir da qual o nível não bate. */
export const DEGRAUS_DIVERGENCIA = 2;

/** Representatividade: abaixo disto o questionário do setor é só indicativo. */
export const MIN_RESPONDENTES = 3;
export const ADESAO_MINIMA = 0.5;

const DEGRAU_QUESTIONARIO: Record<string, number> = { Baixo: 1, Médio: 2, Alto: 3, Crítico: 4 };
const DEGRAU_AIHA: Record<string, number> = { Trivial: 1, Baixo: 1, Moderado: 2, Alto: 3, "Muito Alto": 4 };
const APONTA = 2;

/** A régua como foi aplicada — vai junto no fechamento e na seção "Como comparamos". */
export const REGUA = {
  degrauQuestionario: DEGRAU_QUESTIONARIO,
  degrauAiha: DEGRAU_AIHA,
  apontaAPartirDoDegrau: APONTA,
  degrausDivergencia: DEGRAUS_DIVERGENCIA,
  minRespondentes: MIN_RESPONDENTES,
  adesaoMinima: ADESAO_MINIMA,
} as const;

/** Um fator "Sim" da AEP no setor (o pior, se o setor aparece mais de uma vez). */
export interface LadoAep {
  /** Degrau 1–4; null = "Sim" sem AIHA calculada. */
  degrau: number | null;
  nivelAiha: string | null;
  sinais: string[];
}

export interface LadoQuestionario {
  degrau: number;
  nivel: string;
  respondentes: number | null;
}

export interface CelulaConciliacao {
  setor: string;
  /** Chave do setor (depois da ligação manual) — é a chave do parecer. */
  chaveSetor: string;
  idFator: string;
  aep: LadoAep | null;
  /** AEP marcou N/I (não identificável) neste fator e setor. */
  aepNaoIdentificado: boolean;
  drps: LadoQuestionario | null;
  qps: LadoQuestionario | null;
  /** null = não há esse questionário na empresa (a coluna inteira some). */
  classe: Record<Questionario, ClasseConciliacao | null>;
  /** Maior = olhar primeiro (ver `prioridadeDe`). */
  prioridade: Record<Questionario, number>;
  /** NR-17 (17.3.2): a divergência pede avaliação mais aprofundada. */
  sugereAet: Record<Questionario, boolean>;
  /** Poucos respondentes ou adesão baixa no setor: o questionário é só indicativo. */
  baixaRepresentatividade: Record<Questionario, boolean>;
}

export interface SetorConciliacao {
  setor: string;
  /** Chave do setor (depois da ligação manual). */
  chave: string;
  /** Nomes como estão em cada documento. */
  originais: Partial<Record<OrigemFonte, string[]>>;
  /** Chaves sugeridas que caíram aqui (mais de uma = setores ligados). */
  chavesOriginais: string[];
  /** Fontes que avaliaram o setor. */
  avaliadoPor: OrigemFonte[];
  /** Expostos no setor segundo a AEP (soma das variantes). */
  expostos: number | null;
  /** A AEP marcou "necessita AET" no setor. */
  necessitaAet: boolean;
  /** Respondentes do setor em cada questionário. */
  respondentes: Partial<Record<Questionario, number>>;
}

export interface ResultadoConciliacao {
  setores: SetorConciliacao[];
  celulas: CelulaConciliacao[];
  /** Questionários presentes na empresa. */
  questionarios: Questionario[];
  temAep: boolean;
  /** Setores avaliados pela AEP E por algum questionário — sem nenhum, nada se concilia. */
  setoresEmComum: number;
  totais: Record<Questionario, Record<ClasseConciliacao, number>>;
  /** Linhas que ficaram fora por não terem fator do catálogo. */
  linhasSemFator: number;
}

/** Setor de uma AEP avaliado (mesmo sem nenhum fator "Sim"). */
export interface SetorAvaliadoAep {
  idDocumento: string;
  setorOriginal: string;
  /** `qtd_expostos` do setor na AEP. */
  expostos?: number | null;
  necessitaAet?: boolean;
}

/** Ligação manual de setores por empresa (psico_conciliacao_setor_depara). */
export interface LigacaoSetor {
  id_depara?: string;
  id_empresa?: string;
  chave_de: string;
  nome_de?: string;
  chave_para: string;
  nome_para: string;
}

export type DecisaoParecer = "CONFIRMAR" | "AET" | "DESCARTAR";

export const ROTULO_DECISAO: Record<DecisaoParecer, string> = {
  CONFIRMAR: "Confirmar no inventário (PGR)",
  AET: "Aprofundar com AET (NR-17)",
  DESCARTAR: "Descartar com justificativa",
};

/** Parecer de um cruzamento (psico_conciliacao_pareceres). */
export interface ParecerConciliacao {
  id_parecer: string;
  id_empresa: string;
  setor_chave: string;
  setor_nome: string;
  id_fator: string;
  questionario: Questionario;
  decisao: DecisaoParecer;
  justificativa: string | null;
  classe: string;
  documentos: Partial<Record<OrigemFonte, string>>;
  id_acao: string | null;
  criado_por?: string | null;
  criado_em?: string | null;
  atualizado_por: string | null;
  atualizado_em: string | null;
}

export function degrauQuestionario(nivel: string): number {
  return DEGRAU_QUESTIONARIO[nivel] ?? 0;
}

export function degrauAiha(nivel: string | null | undefined): number | null {
  return nivel ? DEGRAU_AIHA[nivel] ?? null : null;
}

const temAcento = (s: string) => s.normalize("NFD") !== s;

const MINUSCULAS = new Set(["de", "do", "da", "dos", "das", "e", "em", "no", "na", "a", "o", "ao", "aos", "com", "sem"]);

/** "IMPLEMENTAÇÃO DE SISTEMAS" / "Atendimento ao cliente" → "Implementação de Sistemas" / "Atendimento ao Cliente". */
export function tituloComAcento(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .map((p, i) => {
      const min = p.toLocaleLowerCase("pt-BR");
      if (i > 0 && MINUSCULAS.has(min)) return min;
      // Sigla curta em maiúsculas fica como está (RH, TI, SST).
      if (p.length <= 3 && p === p.toLocaleUpperCase("pt-BR") && /[A-Z]/.test(p)) return p;
      return min.charAt(0).toLocaleUpperCase("pt-BR") + min.slice(1);
    })
    .join(" ");
}

/** A chave com que um setor entra na conciliação (antes da ligação manual). */
export function chaveConciliacao(original: string): string {
  return chaveSetor(sugerirSetorCanonico(original));
}

export function classificar(aep: LadoAep | null, q: LadoQuestionario | null, aepAvaliou: boolean, qAvaliou: boolean): ClasseConciliacao {
  if (!aepAvaliou || !qAvaliou) return "Sem par";
  const aepAponta = !!aep && (aep.degrau === null || aep.degrau >= APONTA);
  const qAponta = !!q && q.degrau >= APONTA;
  if (aepAponta && qAponta) {
    if (aep!.degrau === null) return "Convergente";
    return Math.abs(aep!.degrau - q!.degrau) >= DEGRAUS_DIVERGENCIA ? "Nível divergente" : "Convergente";
  }
  if (qAponta) return "Só questionário";
  if (aepAponta) return "Só AEP";
  return "Sem indicação";
}

/** O questionário do setor representa o setor? `expostos` nulo = só o mínimo de respondentes. */
export function baixaRepresentatividade(respondentes: number | null | undefined, expostos: number | null | undefined): boolean {
  if (respondentes == null) return false;
  if (respondentes < MIN_RESPONDENTES) return true;
  return !!expostos && expostos > 0 && respondentes / expostos < ADESAO_MINIMA;
}

/** NR-17 (17.3.2): divergência que pede avaliação mais aprofundada (AET). */
export function sugereAet(classe: ClasseConciliacao | null, q: LadoQuestionario | null): boolean {
  if (classe === "Nível divergente") return true;
  return classe === "Só questionário" && !!q && q.degrau >= 3;
}

const PESO_CLASSE: Record<ClasseConciliacao, number> = {
  "Nível divergente": 3,
  "Só questionário": 3,
  "Só AEP": 2,
  Convergente: 1,
  "Sem indicação": 0,
  "Sem par": 0,
};

/**
 * Prioridade de um cruzamento: o tipo de divergência pesa mais, depois o maior nível das
 * duas fontes, depois quantos estão expostos; com representatividade baixa, cai.
 */
export function prioridadeDe(
  classe: ClasseConciliacao | null,
  aep: LadoAep | null,
  q: LadoQuestionario | null,
  expostos: number | null,
  baixaRep: boolean,
): number {
  if (!classe || PESO_CLASSE[classe] === 0) return 0;
  const maior = Math.max(aep?.degrau ?? (aep ? 2 : 0), q?.degrau ?? 0);
  let p = PESO_CLASSE[classe] * 10 + maior * 2 + Math.min(expostos ?? 0, 200) / 40;
  if (baixaRep) p *= 0.6;
  return Math.round(p * 10) / 10;
}

const zeroTotais = (): Record<ClasseConciliacao, number> => ({
  Convergente: 0,
  "Nível divergente": 0,
  "Só questionário": 0,
  "Só AEP": 0,
  "Sem indicação": 0,
  "Sem par": 0,
});

/**
 * A conciliação de UMA empresa com os documentos escolhidos (um por origem).
 *
 * @param linhas         linhas da empresa (todas as origens) — só as dos `documentos` contam.
 * @param documentos     ids dos documentos usados.
 * @param setoresAep     setores avaliados de cada AEP (inclusive sem "Sim").
 * @param deparaSetores  ligações manuais da empresa (chave sugerida → chave de destino).
 */
export function conciliarEmpresa(p: {
  linhas: readonly LinhaFonte[];
  pendencias: readonly PendenciaFonte[];
  setoresAep: readonly SetorAvaliadoAep[];
  documentos: ReadonlySet<string>;
  fatores: PsicoFator[];
  depara: PsicoFatorDepara[];
  deparaSetores?: readonly LigacaoSetor[];
}): ResultadoConciliacao {
  const ativos = p.fatores.filter((f) => f.ativo !== false).sort((a, b) => a.ordem - b.ordem);
  const fatorDe = (origem: OrigemFonte, nome: string) => {
    const id = resolverFator(origem, nome, ativos, p.depara).id_fator;
    return id && ativos.some((f) => f.id_fator === id) ? id : null;
  };
  const ligacao = new Map((p.deparaSetores ?? []).map((d) => [d.chave_de, d]));

  const setores = new Map<string, SetorConciliacao>();
  const setorDe = (origem: OrigemFonte, original: string): string | null => {
    const nome = sugerirSetorCanonico(original);
    if (!nome) return null;
    const k0 = chaveSetor(nome);
    const lig = ligacao.get(k0);
    const k = lig ? lig.chave_para : k0;
    const novo = !setores.has(k);
    const s = setores.get(k) ?? {
      setor: lig ? tituloComAcento(lig.nome_para) : nome,
      chave: k,
      originais: {},
      chavesOriginais: [],
      avaliadoPor: [],
      expostos: null,
      necessitaAet: false,
      respondentes: {},
    };
    // A sugestão tira o acento de palavra que ela não conhece ("Implementacao") e põe "Ao" em
    // maiúscula: quando ela só trocou a grafia (não juntou setores, como "Administrativo
    // (canteiro)"), o nome mostrado é o do documento, em caixa de título, com o acento dele.
    // Setor ligado à mão fica com o nome do destino.
    if (!lig && chaveSetor(original) === k && (novo || !temAcento(s.setor))) {
      s.setor = tituloComAcento(original);
    }
    if (!s.chavesOriginais.includes(k0)) s.chavesOriginais.push(k0);
    const orig = (s.originais[origem] ??= []);
    if (!orig.includes(original)) orig.push(original);
    if (!s.avaliadoPor.includes(origem)) s.avaliadoPor.push(origem);
    setores.set(k, s);
    return k;
  };

  for (const sa of p.setoresAep) {
    if (!p.documentos.has(sa.idDocumento)) continue;
    const k = setorDe("AEP", sa.setorOriginal.trim());
    if (!k) continue;
    const s = setores.get(k)!;
    // Variantes do mesmo setor (com altura etc.) somam os expostos.
    if (sa.expostos != null && sa.expostos > 0) s.expostos = (s.expostos ?? 0) + sa.expostos;
    if (sa.necessitaAet) s.necessitaAet = true;
  }

  const aep = new Map<string, LadoAep>();
  const quest: Record<Questionario, Map<string, LadoQuestionario>> = { DRPS: new Map(), QPS: new Map() };
  const questionarios = new Set<Questionario>();
  let temAep = p.setoresAep.some((s) => p.documentos.has(s.idDocumento));
  let linhasSemFator = 0;

  for (const l of p.linhas) {
    if (!p.documentos.has(l.idDocumento)) continue;
    const ks = setorDe(l.origem, l.setorOriginal);
    if (!ks) continue;
    if (l.origem !== "AEP") {
      questionarios.add(l.origem);
      const s = setores.get(ks)!;
      if (l.respondentes != null) s.respondentes[l.origem] = Math.max(s.respondentes[l.origem] ?? 0, l.respondentes);
    } else temAep = true;
    const idFator = fatorDe(l.origem, l.fatorOriginal);
    if (!idFator) {
      linhasSemFator++;
      continue;
    }
    const k = `${ks}\u0001${idFator}`;
    if (l.origem === "AEP") {
      const degrau = degrauAiha(l.nivelAiha);
      const atual = aep.get(k);
      // Mesmo setor duas vezes na AEP (variante): vale o pior; sem nível perde para com nível.
      if (!atual || (degrau ?? 0) > (atual.degrau ?? 0)) {
        aep.set(k, { degrau, nivelAiha: l.nivelAiha, sinais: [...l.sinais] });
      }
    } else {
      const degrau = degrauQuestionario(l.nivel);
      const mapa = quest[l.origem];
      const atual = mapa.get(k);
      if (!atual || degrau > atual.degrau) mapa.set(k, { degrau, nivel: l.nivel, respondentes: l.respondentes });
    }
  }

  const naoIdentificado = new Set<string>();
  for (const pd of p.pendencias) {
    if (pd.origem !== "AEP" || pd.tipo !== "nao_identificado" || !p.documentos.has(pd.idDocumento)) continue;
    const ks = setorDe("AEP", pd.setorOriginal);
    const idFator = fatorDe("AEP", pd.fatorOriginal);
    if (ks && idFator) naoIdentificado.add(`${ks}\u0001${idFator}`);
  }

  const listaSetores = [...setores.entries()].sort((a, b) => a[1].setor.localeCompare(b[1].setor, "pt-BR"));
  const totais = { DRPS: zeroTotais(), QPS: zeroTotais() };
  const celulas: CelulaConciliacao[] = [];
  for (const [ks, s] of listaSetores) {
    for (const f of ativos) {
      const k = `${ks}\u0001${f.id_fator}`;
      const ladoAep = aep.get(k) ?? null;
      const classe: Record<Questionario, ClasseConciliacao | null> = { DRPS: null, QPS: null };
      const prioridade: Record<Questionario, number> = { DRPS: 0, QPS: 0 };
      const aet: Record<Questionario, boolean> = { DRPS: false, QPS: false };
      const baixaRep: Record<Questionario, boolean> = { DRPS: false, QPS: false };
      for (const q of QUESTIONARIOS) {
        if (!questionarios.has(q)) continue;
        const ladoQ = quest[q].get(k) ?? null;
        const c = classificar(ladoAep, ladoQ, s.avaliadoPor.includes("AEP"), s.avaliadoPor.includes(q));
        classe[q] = c;
        totais[q][c]++;
        baixaRep[q] = c !== "Sem par" && baixaRepresentatividade(s.respondentes[q], s.expostos);
        aet[q] = sugereAet(c, ladoQ);
        prioridade[q] = prioridadeDe(c, ladoAep, ladoQ, s.expostos, baixaRep[q]);
      }
      celulas.push({
        setor: s.setor,
        chaveSetor: ks,
        idFator: f.id_fator,
        aep: ladoAep,
        aepNaoIdentificado: naoIdentificado.has(k),
        drps: quest.DRPS.get(k) ?? null,
        qps: quest.QPS.get(k) ?? null,
        classe,
        prioridade,
        sugereAet: aet,
        baixaRepresentatividade: baixaRep,
      });
    }
  }

  return {
    setores: listaSetores.map(([, s]) => s),
    celulas,
    questionarios: QUESTIONARIOS.filter((q) => questionarios.has(q)),
    temAep,
    setoresEmComum: listaSetores.filter(([, s]) => s.avaliadoPor.includes("AEP") && s.avaliadoPor.some((o) => o !== "AEP")).length,
    totais,
    linhasSemFator,
  };
}

// ── Setores parecidos ──────────────────────────────────────────────────────────

/** Siglas e sinônimos comuns em nome de setor → forma por extenso (já em chave). */
const SINONIMOS: Record<string, string> = {
  SAC: "ATENDIMENTO",
  RH: "RECURSOS HUMANOS",
  DP: "DEPARTAMENTO PESSOAL",
  TI: "TECNOLOGIA DA INFORMACAO",
  INFORMATICA: "TECNOLOGIA DA INFORMACAO",
  ADM: "ADMINISTRATIVO",
  ADMINISTRACAO: "ADMINISTRATIVO",
  FINANCEIRA: "FINANCEIRO",
};
const VAZIAS = new Set(["DE", "DO", "DA", "DOS", "DAS", "E", "EM", "NO", "NA", "A", "O", "AO", "SETOR", "DEPARTAMENTO", "DEPTO", "AREA"]);

function tokens(nome: string): Set<string> {
  const out = new Set<string>();
  for (const bruto of chaveSetor(nome).split(/[\s/\-().,]+/)) {
    if (!bruto) continue;
    const exp = SINONIMOS[bruto] ?? bruto;
    for (const t of exp.split(" ")) {
      const r = t.replace(/S$/, ""); // plural simples: "COMPRAS" ~ "COMPRA"
      if (r.length >= 2 && !VAZIAS.has(t)) out.add(r);
    }
  }
  return out;
}

/** Semelhança 0–1 entre dois nomes de setor (palavras em comum, com siglas expandidas). */
export function semelhancaSetor(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comum = 0;
  for (const t of ta) if (tb.has(t)) comum++;
  if (comum === 0) return 0;
  const jaccard = comum / (ta.size + tb.size - comum);
  // Um contido no outro ("Produção" × "Produção Industrial") conta forte.
  const contido = comum / Math.min(ta.size, tb.size);
  return Math.round(Math.max(jaccard, contido * 0.85) * 100) / 100;
}

export interface ParSugerido {
  /** Setor só da AEP. */
  aep: SetorConciliacao;
  /** Setor só dos questionários. */
  questionario: SetorConciliacao;
  semelhanca: number;
}

/** Pares "parece o mesmo setor" entre os sem par: o melhor primeiro, cada setor uma vez. */
export function sugerirPares(setores: readonly SetorConciliacao[], minimo = 0.5): ParSugerido[] {
  const soAep = setores.filter((s) => s.avaliadoPor.length === 1 && s.avaliadoPor[0] === "AEP");
  const soQ = setores.filter((s) => !s.avaliadoPor.includes("AEP"));
  const nomes = (s: SetorConciliacao) => [s.setor, ...Object.values(s.originais).flat()].filter(Boolean) as string[];
  const candidatos: ParSugerido[] = [];
  for (const a of soAep) {
    for (const q of soQ) {
      let melhor = 0;
      for (const na of nomes(a)) for (const nq of nomes(q)) melhor = Math.max(melhor, semelhancaSetor(na, nq));
      if (melhor >= minimo) candidatos.push({ aep: a, questionario: q, semelhanca: melhor });
    }
  }
  candidatos.sort((x, y) => y.semelhanca - x.semelhanca || x.aep.setor.localeCompare(y.aep.setor, "pt-BR"));
  const usados = new Set<string>();
  return candidatos.filter((c) => {
    if (usados.has(c.aep.chave) || usados.has(c.questionario.chave)) return false;
    usados.add(c.aep.chave);
    usados.add(c.questionario.chave);
    return true;
  });
}

// ── Parecer ────────────────────────────────────────────────────────────────────

export const chaveParecer = (setorChave: string, idFator: string, q: Questionario) => `${setorChave}\u0001${idFator}\u0001${q}`;

export type SituacaoParecer = "pendente" | "sem-acao" | "desatualizado" | "ok" | "nao-precisa";

/**
 * O que falta num cruzamento:
 *  • pendente      — divergência sem parecer;
 *  • desatualizado — o parecer foi dado com outra classe (documento trocado ou editado);
 *  • sem-acao      — Confirmar/AET sem ação 5W2H ligada (NR-01: risco sem medida no plano);
 *  • ok            — tem parecer em dia; • nao-precisa — não é divergência e não tem parecer.
 */
export function situacaoParecer(classe: ClasseConciliacao | null, parecer: ParecerConciliacao | undefined): SituacaoParecer {
  if (!classe || classe === "Sem par") return "nao-precisa";
  if (!parecer) return DIVERGENCIAS.has(classe) ? "pendente" : "nao-precisa";
  if (parecer.classe !== classe) return "desatualizado";
  if (parecer.decisao !== "DESCARTAR" && !parecer.id_acao) return "sem-acao";
  return "ok";
}

export function indexarPareceres(pareceres: readonly ParecerConciliacao[]): Map<string, ParecerConciliacao> {
  return new Map(pareceres.map((p) => [chaveParecer(p.setor_chave, p.id_fator, p.questionario), p]));
}

export interface ContagemPareceres {
  pendentes: number;
  semAcao: number;
  desatualizados: number;
  comParecer: number;
}

export function contarPareceres(r: ResultadoConciliacao, pareceres: ReadonlyMap<string, ParecerConciliacao>): ContagemPareceres {
  const out: ContagemPareceres = { pendentes: 0, semAcao: 0, desatualizados: 0, comParecer: 0 };
  for (const c of r.celulas) {
    for (const q of r.questionarios) {
      const p = pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q));
      const s = situacaoParecer(c.classe[q], p);
      if (s === "pendente") out.pendentes++;
      else if (s === "sem-acao") out.semAcao++;
      else if (s === "desatualizado") out.desatualizados++;
      if (p && c.classe[q] && c.classe[q] !== "Sem par") out.comParecer++;
    }
  }
  return out;
}

// ── Lista ──────────────────────────────────────────────────────────────────────

/** Resumo de uma empresa para a lista. */
export interface ResumoEmpresa {
  idEmpresa: string;
  documentos: Partial<Record<OrigemFonte, DocumentoFonte>>;
  /** Faltam documentos para conciliar. */
  falta: Array<"AEP" | "Questionário">;
  /** Tem os dois documentos, mas nenhum setor bate pelo nome. */
  semSetorEmComum: boolean;
  convergentes: number;
  divergencias: number;
  /** Divergências por classe, somando DRPS e QPS. */
  porClasse: Record<ClasseConciliacao, number>;
  pareceres: ContagemPareceres;
}

/** Documentos padrão da empresa: o mais recente de cada origem (a régua da Consolidação). */
export function documentosDaEmpresa(docs: readonly DocumentoFonte[], idEmpresa: string): Partial<Record<OrigemFonte, DocumentoFonte>> {
  const daEmpresa = docs.filter((d) => d.idEmpresa === idEmpresa);
  const padrao = documentosPadrao(daEmpresa);
  const out: Partial<Record<OrigemFonte, DocumentoFonte>> = {};
  for (const d of daEmpresa) if (padrao.has(d.id)) out[d.origem] = d;
  return out;
}

export function resumirEmpresa(
  idEmpresa: string,
  docs: Partial<Record<OrigemFonte, DocumentoFonte>>,
  r: ResultadoConciliacao,
  pareceres: ReadonlyMap<string, ParecerConciliacao> = new Map(),
): ResumoEmpresa {
  const porClasse = zeroTotais();
  for (const q of r.questionarios) for (const c of CLASSES) porClasse[c] += r.totais[q][c];
  const falta: ResumoEmpresa["falta"] = [];
  if (!docs.AEP) falta.push("AEP");
  if (!docs.DRPS && !docs.QPS) falta.push("Questionário");
  return {
    idEmpresa,
    documentos: docs,
    falta,
    semSetorEmComum: falta.length === 0 && r.setoresEmComum === 0,
    convergentes: porClasse.Convergente,
    divergencias: porClasse["Nível divergente"] + porClasse["Só questionário"] + porClasse["Só AEP"],
    porClasse,
    pareceres: contarPareceres(r, pareceres),
  };
}

// ── Fechamento ─────────────────────────────────────────────────────────────────

export interface ItemFechamento {
  setor: string;
  setor_chave: string;
  id_fator: string;
  fator: string;
  questionario: Questionario;
  classe: ClasseConciliacao;
  aep: string | null;
  nivel_questionario: string | null;
  respondentes: number | null;
  expostos: number | null;
  decisao: DecisaoParecer | null;
  justificativa: string | null;
  id_acao: string | null;
}

/** A foto que vai para psico_conciliacao_fechamentos.itens: toda divergência e todo parecer. */
export function itensDoFechamento(
  r: ResultadoConciliacao,
  pareceres: ReadonlyMap<string, ParecerConciliacao>,
  nomeFator: (id: string) => string,
): ItemFechamento[] {
  const expostos = new Map(r.setores.map((s) => [s.chave, s.expostos]));
  const out: ItemFechamento[] = [];
  for (const c of r.celulas) {
    for (const q of r.questionarios) {
      const classe = c.classe[q];
      if (!classe || classe === "Sem par") continue;
      const p = pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q));
      if (!DIVERGENCIAS.has(classe) && !p) continue;
      const lado = q === "DRPS" ? c.drps : c.qps;
      out.push({
        setor: c.setor,
        setor_chave: c.chaveSetor,
        id_fator: c.idFator,
        fator: nomeFator(c.idFator),
        questionario: q,
        classe,
        aep: c.aep ? c.aep.nivelAiha ?? "Sim · sem AIHA" : c.aepNaoIdentificado ? "N/I" : null,
        nivel_questionario: lado?.nivel ?? null,
        respondentes: lado?.respondentes ?? null,
        expostos: expostos.get(c.chaveSetor) ?? null,
        decisao: p && p.classe === classe ? p.decisao : null,
        justificativa: p && p.classe === classe ? p.justificativa : null,
        id_acao: p?.id_acao ?? null,
      });
    }
  }
  return out;
}

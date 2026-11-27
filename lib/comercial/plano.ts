// 0.3.321 (pedido do João, 26/11/2026) — Plano de intervenções da conciliação (banco v370).
// Os 6 itens: setores envolvidos, riscos identificados, temas sugeridos, método por tema (EAD, online ou presencial),
// descrição dos métodos (forma, duração, avaliação, certificado — texto padrão por modalidade, ajustável na empresa) e o
// planejamento das ações (um tema por mês, ou o EAD o período todo com as ações online/presenciais distribuídas nos meses).
// Puro (sem React): testado em plano.test.ts.

import type { AtendimentoGrupo, IntervencaoIndicada, RiscoConciliado } from "@/lib/comercial/liberacao";
import type { EmpresaComercial } from "@/lib/comercial/oportunidades";

export type Planejamento = "tema_por_mes" | "ead_continuo";

export interface MetodoTexto {
  forma: string | null;
  duracao: string | null;
  avaliacao: string | null;
  certificado: string | null;
}

/** comercial_metodos: o texto padrão de uma modalidade (no catálogo). */
export interface MetodoModalidade extends MetodoTexto {
  modalidade: string;
  ordem: number;
}

/** comercial_planos: o plano de uma empresa ou de um grupo. */
export interface PlanoIntervencoes {
  id_alvo: string;
  tipo_alvo: "empresa" | "grupo";
  planejamento: Planejamento;
  /** 1º dia do mês em que o plano começa (yyyy-mm-01); sem ele, os meses são "Mês 1", "Mês 2"… */
  inicio: string | null;
  meses: number | null;
  /** O mês (1..meses) de cada tema, pela chave do tema. */
  temas: Record<string, number>;
  /** Ajustes do texto do método, por modalidade (só os campos alterados). */
  metodos: Record<string, Partial<MetodoTexto>>;
}

export const CAMPOS_METODO: { campo: keyof MetodoTexto; rotulo: string }[] = [
  { campo: "forma", rotulo: "Forma de realização" },
  { campo: "duracao", rotulo: "Duração" },
  { campo: "avaliacao", rotulo: "Avaliação de aprendizado" },
  { campo: "certificado", rotulo: "Certificado" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** "Ao vivo" é a modalidade online do sistema. */
export function rotuloModalidade(m: string): string {
  return norm(m) === "ao vivo" ? "Online (ao vivo)" : m;
}
export const ehEad = (m: string | null | undefined) => !!m && norm(m) === "ead";

export interface TemaPlano {
  /** A intervenção do catálogo ou, sem ela, o nome. */
  chave: string;
  nome: string;
  modalidades: string[];
  setores: string[];
  riscos: string[];
}

export const chaveTema = (i: Pick<IntervencaoIndicada, "id_intervencao" | "nome">) => i.id_intervencao ?? `nome:${norm(i.nome)}`;

const semRepetir = (lista: string[], v: string | null | undefined) => {
  if (v && !lista.some((x) => norm(x) === norm(v))) lista.push(v);
};

/** 3. Temas sugeridos (= as intervenções indicadas, sem repetir), com o método (4) e onde entram. */
export function temasDoPlano(indicadas: readonly IntervencaoIndicada[]): TemaPlano[] {
  const porChave = new Map<string, TemaPlano>();
  for (const i of indicadas) {
    if (!i.nome.trim()) continue;
    const chave = chaveTema(i);
    const t = porChave.get(chave) ?? { chave, nome: i.nome, modalidades: [], setores: [], riscos: [] };
    semRepetir(t.modalidades, i.modalidade);
    semRepetir(t.setores, i.setor_nome);
    semRepetir(t.riscos, i.fator_nome);
    porChave.set(chave, t);
  }
  return [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** 1. Setores envolvidos. */
export function setoresDoPlano(riscos: readonly RiscoConciliado[]): string[] {
  const out: string[] = [];
  for (const r of riscos) semRepetir(out, r.setor);
  return out.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** 2. Riscos identificados, com os setores de cada um. */
export function riscosDoPlano(riscos: readonly RiscoConciliado[]): { fator: string; setores: string[]; aet: boolean }[] {
  const porFator = new Map<string, { fator: string; setores: string[]; aet: boolean }>();
  for (const r of riscos) {
    const x = porFator.get(r.idFator) ?? { fator: r.fator, setores: [], aet: false };
    semRepetir(x.setores, r.setor);
    x.aet ||= r.aet;
    porFator.set(r.idFator, x);
  }
  return [...porFator.values()].sort((a, b) => a.fator.localeCompare(b.fator, "pt-BR"));
}

/** As modalidades em uso nos temas, na ordem do catálogo de métodos. */
export function modalidadesEmUso(temas: readonly TemaPlano[], metodos: readonly MetodoModalidade[]): string[] {
  const usadas: string[] = [];
  for (const t of temas) for (const m of t.modalidades) semRepetir(usadas, m);
  const ordem = (m: string) => metodos.find((x) => norm(x.modalidade) === norm(m))?.ordem ?? 999;
  return usadas.sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b, "pt-BR"));
}

/** 0.3.322: a chave do ajuste do método de uma intervenção (tema) numa modalidade, em `plano.metodos`. */
export const chaveMetodo = (tema: string, modalidade: string) => `${tema}::${modalidade}`;

/**
 * 5. O texto do método: o padrão do catálogo, com os ajustes da empresa por cima. Com o tema (0.3.322), o texto é o
 * daquela intervenção: o ajuste dela vale mais que o da modalidade inteira (que era como a 0.3.321 gravava).
 */
export function metodoDe(
  modalidade: string,
  metodos: readonly MetodoModalidade[],
  plano: Pick<PlanoIntervencoes, "metodos"> | null,
  tema?: string,
  /** 0.3.330 (v373): o texto que a própria intervenção tem no catálogo, por modalidade. */
  daIntervencao?: Record<string, Partial<MetodoTexto>> | null,
): MetodoTexto {
  const padrao = metodos.find((x) => norm(x.modalidade) === norm(modalidade));
  const daModalidade = plano?.metodos?.[modalidade] ?? {};
  const doTema = (tema && plano?.metodos?.[chaveMetodo(tema, modalidade)]) || {};
  const chaveCat = daIntervencao ? Object.keys(daIntervencao).find((k) => norm(k) === norm(modalidade)) : undefined;
  const doCatalogo = (chaveCat && daIntervencao?.[chaveCat]) || {};
  // Ordem: ajuste da empresa na intervenção > ajuste da empresa na modalidade > texto da intervenção > texto da modalidade.
  // No catálogo, campo vazio não conta (vale o da modalidade).
  const v = (c: keyof MetodoTexto) =>
    c in doTema ? doTema[c] ?? null
      : c in daModalidade ? daModalidade[c] ?? null
        : doCatalogo[c]?.trim() ? doCatalogo[c]! : padrao?.[c] ?? null;
  return { forma: v("forma"), duracao: v("duracao"), avaliacao: v("avaliacao"), certificado: v("certificado") };
}

/** Temas que entram no calendário mês a mês: todos no "um tema por mês"; no "EAD contínuo", os que não são só EAD. */
export function temasMensais(planejamento: Planejamento, temas: readonly TemaPlano[]): TemaPlano[] {
  if (planejamento === "tema_por_mes") return [...temas];
  return temas.filter((t) => t.modalidades.length === 0 || t.modalidades.some((m) => !ehEad(m)));
}

/** Quantos meses o plano tem: o escolhido ou, sem ele, um por tema mensal (mínimo 1). */
export function mesesDoPlano(plano: Pick<PlanoIntervencoes, "meses" | "planejamento"> | null, temas: readonly TemaPlano[]): number {
  if (plano?.meses && plano.meses > 0) return plano.meses;
  return Math.max(1, temasMensais(plano?.planejamento ?? "tema_por_mes", temas).length);
}

/** O mês de cada tema mensal: o escolhido ou, sem escolha, um por mês na ordem (e recomeça se faltar mês). */
export function mesDoTema(plano: Pick<PlanoIntervencoes, "temas"> | null, mensais: readonly TemaPlano[], chave: string, meses: number): number {
  const escolhido = plano?.temas?.[chave];
  if (escolhido && escolhido >= 1 && escolhido <= meses) return escolhido;
  const i = mensais.findIndex((t) => t.chave === chave);
  return (Math.max(0, i) % meses) + 1;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "jan/2027" a partir do início, ou "Mês 3" sem início. */
export function rotuloMes(inicio: string | null, n: number): string {
  if (!inicio || !/^\d{4}-\d{2}/.test(inicio)) return `Mês ${n}`;
  const ano = Number(inicio.slice(0, 4));
  const mes0 = Number(inicio.slice(5, 7)) - 1 + (n - 1);
  return `${MESES[((mes0 % 12) + 12) % 12]}/${ano + Math.floor(mes0 / 12)}`;
}

export interface MesDoCronograma {
  n: number;
  rotulo: string;
  temas: TemaPlano[];
}

/** 6. O cronograma: mês a mês e, no "EAD contínuo", os temas só EAD disponíveis o período todo. */
export function cronograma(plano: PlanoIntervencoes | null, temas: readonly TemaPlano[]): { meses: MesDoCronograma[]; continuos: TemaPlano[] } {
  const planejamento = plano?.planejamento ?? "tema_por_mes";
  const mensais = temasMensais(planejamento, temas);
  const total = mesesDoPlano(plano, temas);
  const meses: MesDoCronograma[] = Array.from({ length: total }, (_, k) => ({ n: k + 1, rotulo: rotuloMes(plano?.inicio ?? null, k + 1), temas: [] }));
  for (const t of mensais) meses[mesDoTema(plano, mensais, t.chave, total) - 1].temas.push(t);
  const continuos = planejamento === "ead_continuo" ? temas.filter((t) => !mensais.includes(t)) : [];
  return { meses, continuos };
}

export interface LinhaPlano {
  /** O setor (Por setor) ou o risco (Por risco) da linha. */
  grupo: string;
  /** Os riscos (Por setor) ou os setores (Por risco) em que o tema entra dentro do grupo. */
  outros: string[];
  tema: TemaPlano;
}

/**
 * 0.3.325 / 0.3.327 (pedido do João): o planejamento na visão Por setor ou Por risco, em colunas — uma linha por grupo × tema, com o
 * outro lado ao lado (Por setor: os riscos daquele setor em que o tema entra; Por risco: os setores). Um tema em dois
 * setores aparece nas duas linhas; o mês é o mesmo (é do tema). Ordem: grupo, o outro lado, depois tema.
 */
export function linhasDoPlano(
  indicadas: readonly IntervencaoIndicada[],
  temas: readonly TemaPlano[],
  por: "setor" | "risco",
): LinhaPlano[] {
  const doTema = new Map(temas.map((t) => [t.chave, t]));
  const linhas = new Map<string, LinhaPlano>();
  for (const i of indicadas) {
    const tema = doTema.get(chaveTema(i));
    if (!tema || !i.nome.trim()) continue;
    const grupo = por === "setor" ? i.setor_nome : i.fator_nome;
    const outro = por === "setor" ? i.fator_nome : i.setor_nome;
    const k = `${norm(grupo)}|${tema.chave}`;
    const l = linhas.get(k) ?? { grupo, outros: [], tema };
    semRepetir(l.outros, outro);
    linhas.set(k, l);
  }
  return [...linhas.values()].sort((a, b) =>
    a.grupo.localeCompare(b.grupo, "pt-BR") || a.outros.join(", ").localeCompare(b.outros.join(", "), "pt-BR") || a.tema.nome.localeCompare(b.tema.nome, "pt-BR"));
}

export function planoVazio(idAlvo: string, tipo: "empresa" | "grupo"): PlanoIntervencoes {
  return { id_alvo: idAlvo, tipo_alvo: tipo, planejamento: "tema_por_mes", inicio: null, meses: null, temas: {}, metodos: {} };
}

// ── 0.3.328 (pedido do João, 26/11/2026): o vendedor vê tudo o que a equipe preparou ──────────────────────────────

/** O Plano de intervenções pronto para a tela do Comercial (só leitura). */
export interface PlanoDoVendedor {
  planejamento: Planejamento;
  /** O plano foi gravado pela equipe; sem ele, é o padrão (um tema por mês, na ordem). */
  gravado: boolean;
  inicio: string | null;
  meses: number;
  /** Os temas que entram mês a mês, com o método e o mês. */
  linhas: { intervencao: string; metodo: string; mes: string }[];
  /** No "EAD o período todo": os temas só EAD. */
  continuos: string[];
  cronograma: { rotulo: string; intervencoes: string[] }[];
}

export function planoDoVendedor(plano: PlanoIntervencoes | null, indicadas: readonly IntervencaoIndicada[]): PlanoDoVendedor | null {
  const temas = temasDoPlano(indicadas);
  if (temas.length === 0) return null;
  const p = plano ?? planoVazio("", "empresa");
  const mensais = temasMensais(p.planejamento, temas);
  const total = mesesDoPlano(p, temas);
  const c = cronograma(p, temas);
  const metodoDoTema = (t: TemaPlano) =>
    (p.planejamento === "ead_continuo" ? t.modalidades.filter((m) => !ehEad(m)) : t.modalidades).map(rotuloModalidade).join(" + ") || "—";
  return {
    planejamento: p.planejamento,
    gravado: !!plano,
    inicio: p.inicio,
    meses: total,
    linhas: mensais.map((t) => ({ intervencao: t.nome, metodo: metodoDoTema(t), mes: rotuloMes(p.inicio, mesDoTema(p, mensais, t.chave, total)) })),
    continuos: c.continuos.map((t) => t.nome),
    cronograma: c.meses.map((m) => ({ rotulo: m.rotulo, intervencoes: m.temas.map((t) => t.nome) })),
  };
}

/**
 * Põe na oportunidade "Intervenção psicossocial" de cada empresa o método de cada intervenção e o plano. O plano é o do
 * grupo liberado que cobre a empresa (o grupo substitui, como em `aplicarGrupos`) ou, sem grupo, o da própria empresa.
 */
export function anexarPlanos(
  lista: readonly EmpresaComercial[],
  indicadas: readonly IntervencaoIndicada[],
  planos: readonly PlanoIntervencoes[],
  metodos: readonly MetodoModalidade[],
  grupos: readonly AtendimentoGrupo[],
  /** 0.3.330 (v373): o texto do método de cada intervenção do catálogo (id_intervencao → por modalidade). */
  metodosIntervencao: Record<string, Record<string, Partial<MetodoTexto>>> = {},
): EmpresaComercial[] {
  const doGrupo = new Map<string, string>();
  for (const g of grupos) if (g.status === "CONCLUIDO" && g.fechada) for (const e of g.empresas) doGrupo.set(e.id_empresa, g.id_grupo);
  const plano = (tipo: "empresa" | "grupo", id: string) => planos.find((p) => p.tipo_alvo === tipo && p.id_alvo === id) ?? null;
  return lista.map((c) => {
    const id = c.empresa.idEmpresa;
    if (!c.oportunidades.some((o) => o.produto === "Intervenção psicossocial" && o.intervencoes?.length)) return c;
    const g = doGrupo.get(id);
    const p = g ? plano("grupo", g) : plano("empresa", id);
    const dela = indicadas.filter((i) => i.id_empresa === id);
    return {
      ...c,
      oportunidades: c.oportunidades.map((o) =>
        o.produto !== "Intervenção psicossocial" || !o.intervencoes?.length
          ? o
          : {
              ...o,
              plano: planoDoVendedor(p, dela),
              intervencoes: o.intervencoes.map((l) => ({
                ...l,
                metodo: l.modalidade
                  ? metodoDe(l.modalidade, metodos, p, chaveTema({ id_intervencao: l.idIntervencao ?? null, nome: l.intervencao }),
                    l.idIntervencao ? metodosIntervencao[l.idIntervencao] : null)
                  : null,
              })),
            },
      ),
    };
  });
}

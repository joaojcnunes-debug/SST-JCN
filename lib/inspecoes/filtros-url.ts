/**
 * Os filtros da lista de Inspeções no ENDEREÇO (28/10/2026): recarregar não perde, o link pode
 * ser mandado para alguém e o botão Voltar desfaz. Também os atalhos de período ("Últimos 7
 * dias", "Este mês"…), que viram De/Até. Funções puras — a página lê e escreve com elas.
 */

import type { FiltroInspecao } from "./pilulas";
import type { PrioridadeInspecao } from "./prioridade";
import { COMPLEXIDADES, type ComplexidadeInspecao } from "./complexidade";

/** v309 (28/10): ATRIBUIDO = tem associado, mas o trabalho ainda não começou. */
export type Documento = "PENDENTE" | "ATRIBUIDO" | "EM_ELABORACAO" | "ENTREGUE";
/**
 * Visão da lista (28/10): "" = Todas; "tecnicos" = o lado do campo (técnico, status da inspeção,
 * data da visita); "associados" = o lado do documento (associado, associação, situação do documento).
 * Cada visão mostra só os filtros dela.
 */
export type Visao = "" | "tecnicos" | "associados";
export type OrdemLista = "recentes" | "antigas" | "revisao" | "prioridade" | "espera" | "prazo";
export type Periodo = "" | "hoje" | "7d" | "30d" | "mes" | "mes_passado" | "personalizado";

export interface FiltrosLista {
  visao: Visao;
  q: string;
  empresa: string;
  tecnico: string;
  associado: string;
  minhas: boolean;
  unidade: string;
  periodo: Periodo;
  de: string;
  ate: string;
  pilulas: FiltroInspecao[];
  documento: Documento[];
  /** Prioridade EFETIVA (a maior entre a marcada e a calculada). */
  prioridade: PrioridadeInspecao[];
  /** Complexidade marcada (v308). */
  complexidade: ComplexidadeInspecao[];
  /** Espera mínima em dias (0 = sem filtro). */
  espera: number;
  ordem: OrdemLista;
}

export const FILTROS_VAZIOS: FiltrosLista = {
  visao: "", q: "", empresa: "", tecnico: "", associado: "", minhas: false, unidade: "",
  periodo: "", de: "", ate: "", pilulas: [], documento: [], prioridade: [], complexidade: [], espera: 0, ordem: "recentes",
};

/**
 * Trocar de visão limpa os filtros que a nova visão não mostra — filtro escondido ligado faz a
 * lista "sumir" sem motivo aparente. Empresa, unidade, período, "só as minhas", prioridade,
 * complexidade, espera e ordem valem nas três.
 */
export function trocarVisao(f: FiltrosLista, visao: Visao): FiltrosLista {
  const novo = { ...f, visao };
  if (visao === "tecnicos") {
    novo.associado = "";
    novo.documento = [];
    novo.pilulas = f.pilulas.filter((p) => p !== "ASSOCIADOS" && p !== "NAO_ASSOCIADOS");
  } else if (visao === "associados") {
    novo.tecnico = "";
    novo.pilulas = f.pilulas.filter((p) => p === "ASSOCIADOS" || p === "NAO_ASSOCIADOS");
  }
  return novo;
}

const PILULAS_OK: FiltroInspecao[] = ["RASCUNHO", "EM_ANDAMENTO", "CONCLUIDA", "ASSOCIADOS", "NAO_ASSOCIADOS"];
const DOC_OK: Documento[] = ["PENDENTE", "ATRIBUIDO", "EM_ELABORACAO", "ENTREGUE"];
const PRI_OK: PrioridadeInspecao[] = ["CRITICA", "GRAVE", "MEDIA", "BAIXA"];
const ORDEM_OK: OrdemLista[] = ["recentes", "antigas", "revisao", "prioridade", "espera", "prazo"];
const PERIODO_OK: Periodo[] = ["hoje", "7d", "30d", "mes", "mes_passado", "personalizado"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const lista = <T extends string>(v: string | null, ok: readonly T[]) =>
  (v ?? "").split(",").filter((x): x is T => (ok as readonly string[]).includes(x));

/** Lê os filtros do endereço; valor inválido vira o padrão (um link velho não quebra a tela). */
export function lerFiltros(sp: URLSearchParams, unidadePadrao = ""): FiltrosLista {
  const periodo = (PERIODO_OK as string[]).includes(sp.get("periodo") ?? "") ? (sp.get("periodo") as Periodo) : "";
  const espera = Number(sp.get("espera"));
  const visao = sp.get("visao");
  return {
    visao: visao === "tecnicos" || visao === "associados" ? visao : "",
    q: sp.get("q") ?? "",
    empresa: sp.get("empresa") ?? "",
    tecnico: sp.get("tecnico") ?? "",
    associado: sp.get("associado") ?? "",
    minhas: sp.get("minhas") === "1",
    unidade: sp.has("unidade") ? (sp.get("unidade") ?? "") : unidadePadrao,
    periodo,
    de: DATA.test(sp.get("de") ?? "") ? sp.get("de")! : "",
    ate: DATA.test(sp.get("ate") ?? "") ? sp.get("ate")! : "",
    pilulas: lista(sp.get("status"), PILULAS_OK),
    documento: lista(sp.get("doc"), DOC_OK),
    prioridade: lista(sp.get("prioridade"), PRI_OK),
    complexidade: lista(sp.get("complexidade"), COMPLEXIDADES),
    espera: Number.isFinite(espera) && espera > 0 ? Math.floor(espera) : 0,
    ordem: (ORDEM_OK as string[]).includes(sp.get("ordem") ?? "") ? (sp.get("ordem") as OrdemLista) : "recentes",
  };
}

/** Escreve só o que difere do vazio (o endereço fica curto). `unidade` sempre que diferir do padrão. */
export function escreverFiltros(f: FiltrosLista, unidadePadrao = ""): URLSearchParams {
  const sp = new URLSearchParams();
  const put = (k: string, v: string) => v && sp.set(k, v);
  put("visao", f.visao);
  put("q", f.q.trim());
  put("empresa", f.empresa);
  put("tecnico", f.tecnico);
  put("associado", f.associado);
  if (f.minhas) sp.set("minhas", "1");
  if (f.unidade !== unidadePadrao) sp.set("unidade", f.unidade);
  put("periodo", f.periodo);
  if (f.periodo === "personalizado") {
    put("de", f.de);
    put("ate", f.ate);
  }
  put("status", f.pilulas.join(","));
  put("doc", f.documento.join(","));
  put("prioridade", f.prioridade.join(","));
  put("complexidade", f.complexidade.join(","));
  if (f.espera > 0) sp.set("espera", String(f.espera));
  if (f.ordem !== "recentes") sp.set("ordem", f.ordem);
  return sp;
}

const iso = (a: number, m: number, d: number) => new Date(Date.UTC(a, m, d)).toISOString().slice(0, 10);

/** De/Até de um atalho de período, a partir de "hoje" (AAAA-MM-DD, São Paulo). */
export function intervaloDoPeriodo(p: Periodo, hoje: string, de = "", ate = ""): { de: string; ate: string } {
  const [a, m, d] = hoje.split("-").map(Number);
  switch (p) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "7d":
      return { de: iso(a, m - 1, d - 6), ate: hoje };
    case "30d":
      return { de: iso(a, m - 1, d - 29), ate: hoje };
    case "mes":
      return { de: iso(a, m - 1, 1), ate: hoje };
    case "mes_passado":
      return { de: iso(a, m - 2, 1), ate: iso(a, m - 1, 0) };
    case "personalizado":
      return { de, ate };
    default:
      return { de: "", ate: "" };
  }
}

export const ROTULO_PERIODO: Record<Exclude<Periodo, "">, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  mes_passado: "Mês passado",
  personalizado: "Personalizado",
};

/** Quantos filtros (além das pílulas e da ordem) estão ligados — o número do "Mais filtros". */
export function contarFiltrosExtras(f: FiltrosLista, unidadePadrao = ""): number {
  return [f.unidade !== unidadePadrao && f.unidade !== "", f.espera > 0].filter(Boolean).length;
}

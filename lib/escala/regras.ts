/**
 * Conferência das regras da escala (Fase 6).
 *
 * Função PURA, como o gerador: recebe o mês pronto e devolve um veredito por
 * regra. Sem isso, "a escala está certa?" só teria a resposta de quem olha.
 *
 * ─── O QUE É "DIA ÚTIL" AQUI ───────────────────────────────────────────────
 *
 * **Dia de semana SEM feriado de alcance geral.** Essa distinção é a armadilha
 * central desta fase, e ela já apareceu medida: janeiro/2026 tem **22 dias de
 * semana e 21 com expediente** — os 21 da planilha já descontam o 1º de
 * janeiro. Se "dia útil" incluísse feriado, TODA regra acusaria falta
 * justamente nos dias em que ninguém trabalhou, e o painel viraria ruído que
 * as pessoas aprendem a ignorar.
 *
 * Feriado MUNICIPAL não tira o dia da conta: ele alcança só parte da equipe, e
 * quem não é alcançado continua devendo cobertura.
 *
 * ─── REGRA DESCONHECIDA NÃO PASSA ──────────────────────────────────────────
 *
 * Um código que este arquivo não conhece vira `desconhecida`, nunca `ok`.
 * Silenciar o que não se sabe avaliar é a forma mais fácil de um painel de
 * conformidade mentir.
 */

import { diaUtilDe, diasDoMes, paraDataLocal } from "./datas";
import { colunasParaAlocacao } from "./tipos";
import type {
  DiaUtilSemana,
  EscalaDia,
  EscalaFeriado,
  EscalaRegra,
  EscalaSupervisor,
  UnidadeDaEscala,
} from "./tipos";

export type SituacaoRegra = "ok" | "revisar" | "nao_configurada" | "desconhecida";

export interface ResultadoRegra {
  id_regra: string;
  codigo: string;
  descricao: string;
  situacao: SituacaoRegra;
  /** Uma linha explicando o veredito. */
  resumo: string;
  /** As datas ou pares que falharam — o que a pessoa precisa ir olhar. */
  ocorrencias: string[];
}

export interface EntradaConferencia {
  ano: number;
  /** 1..12 */
  mes: number;
  supervisores: EscalaSupervisor[];
  dias: EscalaDia[];
  feriados: EscalaFeriado[];
  unidades: UnidadeDaEscala[];
  regras: EscalaRegra[];
}

// ─── Os códigos que este motor sabe avaliar ─────────────────────────────────

export const CODIGOS_CONHECIDOS = [
  "min_supervisores_dia",
  "nenhum_dia_sem_supervisor",
  "sede_coberta",
  "ancora_dias_fixos",
  "par_mesma_unidade",
] as const;
export type CodigoRegra = (typeof CODIGOS_CONHECIDOS)[number];

/** O que cada código espera em `parametros` — usado pela tela de cadastro. */
export const FORMA_DOS_PARAMETROS: Record<CodigoRegra, string> = {
  min_supervisores_dia: '{ "minimo": 2, "considerar": "qualquer" | "em_unidade" }',
  nenhum_dia_sem_supervisor: "{ } — não tem parâmetro",
  sede_coberta: '{ "id_unidade": "UNI-XXXXXXXX" }',
  ancora_dias_fixos: '{ "id_supervisor": "ESUP-...", "dias": [3, 5] }',
  par_mesma_unidade: '{ "id_supervisor_a": "ESUP-...", "id_supervisor_b": "ESUP-...", "minimo_dias": 1 }',
};

// ─── Utilidades ─────────────────────────────────────────────────────────────

function ddmm(iso: string): string {
  const d = paraDataLocal(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function texto(v: unknown, padrao = ""): string {
  return typeof v === "string" && v.trim() ? v : padrao;
}

function numero(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}

/** Lista as datas com expediente do mês: dia de semana e sem feriado geral. */
export function diasUteisDoMes(
  ano: number,
  mes: number,
  feriados: EscalaFeriado[]
): string[] {
  const bloqueadas = new Set(
    feriados.filter((f) => f.abrangencia !== "municipal").map((f) => f.data)
  );
  return diasDoMes(ano, mes).filter((d) => diaUtilDe(d) !== null && !bloqueadas.has(d));
}

interface Mapa {
  /** `${id_supervisor}|${data}` → o dia gravado. */
  porChave: Map<string, EscalaDia>;
  /** data → supervisores com alguma alocação naquele dia. */
  comAlgo: Map<string, string[]>;
  /** data → supervisores alocados em ALGUMA unidade. */
  emUnidade: Map<string, string[]>;
  /** `${data}|${id_unidade}` → supervisores naquela unidade. */
  porUnidade: Map<string, string[]>;
}

function indexar(dias: EscalaDia[]): Mapa {
  const m: Mapa = {
    porChave: new Map(),
    comAlgo: new Map(),
    emUnidade: new Map(),
    porUnidade: new Map(),
  };
  const push = (mapa: Map<string, string[]>, chave: string, valor: string) => {
    const atual = mapa.get(chave);
    if (atual) atual.push(valor);
    else mapa.set(chave, [valor]);
  };

  for (const d of dias) {
    m.porChave.set(`${d.id_supervisor}|${d.data}`, d);
    const a = colunasParaAlocacao(d);
    if (!a) continue;
    push(m.comAlgo, d.data, d.id_supervisor);
    if (a.tipo === "unidades") {
      push(m.emUnidade, d.data, d.id_supervisor);
      for (const id of a.unidade_ids) push(m.porUnidade, `${d.data}|${id}`, d.id_supervisor);
    }
  }
  return m;
}

/** Corta a lista de ocorrências para o painel não virar uma parede de datas. */
function resumir(datas: string[], teto = 12): string[] {
  const vistas = datas.slice(0, teto).map(ddmm);
  if (datas.length > teto) vistas.push(`e mais ${datas.length - teto}`);
  return vistas;
}

// ─── O motor ────────────────────────────────────────────────────────────────

export function avaliarRegras(entrada: EntradaConferencia): ResultadoRegra[] {
  const { ano, mes, supervisores, dias, feriados, unidades, regras } = entrada;
  const uteis = diasUteisDoMes(ano, mes, feriados);
  const mapa = indexar(dias);

  const nomeSup = (id: string) => {
    const s = supervisores.find((x) => x.id_supervisor === id);
    return s ? s.nome_resumido || s.nome : "supervisor removido";
  };
  const nomeUni = (id: string) =>
    unidades.find((u) => u.id_unidade === id)?.nome ?? "unidade removida";

  return regras
    .filter((r) => r.ativa)
    .map((regra): ResultadoRegra => {
      const base = {
        id_regra: regra.id_regra,
        codigo: regra.codigo,
        descricao: regra.descricao,
      };
      const p = regra.parametros ?? {};

      switch (regra.codigo as CodigoRegra) {
        // ── Mínimo de supervisores por dia ────────────────────────────────
        case "min_supervisores_dia": {
          const minimo = numero(p.minimo, 2);
          // Default "qualquer" espelha a planilha, que contava home office
          // junto. Quem quiser a régua dura troca para "em_unidade" — não é o
          // módulo que decide endurecer a regra da operação.
          const emUnidadeSo = texto(p.considerar, "qualquer") === "em_unidade";
          const fonte = emUnidadeSo ? mapa.emUnidade : mapa.comAlgo;

          const faltando = uteis.filter((d) => (fonte.get(d)?.length ?? 0) < minimo);
          return {
            ...base,
            situacao: faltando.length === 0 ? "ok" : "revisar",
            resumo:
              faltando.length === 0
                ? `Os ${uteis.length} dias com expediente têm ${minimo} ou mais${emUnidadeSo ? " em unidade" : ""}.`
                : `${faltando.length} de ${uteis.length} dias ficam abaixo de ${minimo}${emUnidadeSo ? " em unidade" : ""}.`,
            ocorrencias: resumir(faltando),
          };
        }

        // ── Nenhum dia sem ninguém ────────────────────────────────────────
        case "nenhum_dia_sem_supervisor": {
          const vazios = uteis.filter((d) => (mapa.comAlgo.get(d)?.length ?? 0) === 0);
          return {
            ...base,
            situacao: vazios.length === 0 ? "ok" : "revisar",
            resumo:
              vazios.length === 0
                ? `Nenhum dos ${uteis.length} dias com expediente está vazio.`
                : `${vazios.length} dia(s) com expediente sem ninguém escalado.`,
            ocorrencias: resumir(vazios),
          };
        }

        // ── Sede coberta ──────────────────────────────────────────────────
        case "sede_coberta": {
          const idSede = texto(p.id_unidade);
          if (!idSede) {
            return {
              ...base,
              situacao: "nao_configurada",
              resumo: "Falta dizer qual unidade é a sede. A regra não roda assim.",
              ocorrencias: [],
            };
          }
          const descobertos = uteis.filter(
            (d) => (mapa.porUnidade.get(`${d}|${idSede}`)?.length ?? 0) === 0
          );
          return {
            ...base,
            situacao: descobertos.length === 0 ? "ok" : "revisar",
            resumo:
              descobertos.length === 0
                ? `${nomeUni(idSede)} tem alguém em todos os ${uteis.length} dias com expediente.`
                : `${nomeUni(idSede)} fica sem ninguém em ${descobertos.length} dia(s).`,
            ocorrencias: resumir(descobertos),
          };
        }

        // ── Âncora: dias fixos da pessoa ──────────────────────────────────
        case "ancora_dias_fixos": {
          const idSup = texto(p.id_supervisor);
          const diasFixos = Array.isArray(p.dias)
            ? (p.dias as unknown[]).filter(
                (n): n is DiaUtilSemana => typeof n === "number" && n >= 1 && n <= 5
              )
            : [];
          if (!idSup || diasFixos.length === 0) {
            return {
              ...base,
              situacao: "nao_configurada",
              resumo: "Falta escolher o supervisor e os dias da semana.",
              ocorrencias: [],
            };
          }

          const alvo = new Set<number>(diasFixos);
          const esperados = uteis.filter((d) => alvo.has(diaUtilDe(d) as number));
          const furados = esperados.filter(
            (d) => !(mapa.emUnidade.get(d) ?? []).includes(idSup)
          );
          return {
            ...base,
            situacao: furados.length === 0 ? "ok" : "revisar",
            resumo:
              furados.length === 0
                ? `${nomeSup(idSup)} está em unidade nos ${esperados.length} dias fixos do mês.`
                : `${nomeSup(idSup)} não está em unidade em ${furados.length} dos ${esperados.length} dias fixos.`,
            ocorrencias: resumir(furados),
          };
        }

        // ── Par: coincidir na mesma unidade ───────────────────────────────
        case "par_mesma_unidade": {
          const a = texto(p.id_supervisor_a);
          const b = texto(p.id_supervisor_b);
          const minimoDias = numero(p.minimo_dias, 1);
          if (!a || !b) {
            return {
              ...base,
              situacao: "nao_configurada",
              resumo: "Falta escolher os dois supervisores do par.",
              ocorrencias: [],
            };
          }

          const juntos: string[] = [];
          for (const d of uteis) {
            const daA = mapa.porChave.get(`${a}|${d}`);
            const daB = mapa.porChave.get(`${b}|${d}`);
            if (!daA || !daB) continue;
            const al = colunasParaAlocacao(daA);
            const bl = colunasParaAlocacao(daB);
            if (al?.tipo !== "unidades" || bl?.tipo !== "unidades") continue;
            const comuns = al.unidade_ids.filter((id) => bl.unidade_ids.includes(id));
            if (comuns.length > 0) juntos.push(`${ddmm(d)} em ${nomeUni(comuns[0])}`);
          }

          return {
            ...base,
            situacao: juntos.length >= minimoDias ? "ok" : "revisar",
            resumo:
              juntos.length >= minimoDias
                ? `${nomeSup(a)} e ${nomeSup(b)} coincidem em ${juntos.length} dia(s).`
                : `${nomeSup(a)} e ${nomeSup(b)} coincidem em ${juntos.length} dia(s) — o mínimo é ${minimoDias}.`,
            // Aqui a ocorrência é o que DEU certo: numa regra de mínimo, o que
            // a pessoa precisa ver é quais dias contaram, não os que não.
            ocorrencias: juntos.slice(0, 12),
          };
        }

        default:
          return {
            ...base,
            situacao: "desconhecida",
            resumo: `O código "${regra.codigo}" não é avaliado por esta versão do painel.`,
            ocorrencias: [],
          };
      }
    });
}

/** Um veredito só para o mês inteiro, para o chip da grade. */
export function vereditoGeral(resultados: ResultadoRegra[]): {
  situacao: SituacaoRegra | "vazio";
  aRevisar: number;
} {
  if (resultados.length === 0) return { situacao: "vazio", aRevisar: 0 };
  const aRevisar = resultados.filter((r) => r.situacao === "revisar").length;
  if (aRevisar > 0) return { situacao: "revisar", aRevisar };
  if (resultados.some((r) => r.situacao === "desconhecida")) {
    return { situacao: "desconhecida", aRevisar: 0 };
  }
  if (resultados.some((r) => r.situacao === "nao_configurada")) {
    return { situacao: "nao_configurada", aRevisar: 0 };
  }
  return { situacao: "ok", aRevisar: 0 };
}

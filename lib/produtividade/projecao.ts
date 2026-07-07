// Cálculo PURO da projeção de necessidade de equipe (Produtividade) — sem React,
// testável isoladamente. A view (page.tsx) só monta os inputs e renderiza o resultado.

/** Dias úteis por mês (premissa de conversão dias úteis → meses). */
export const DIAS_UTEIS_MES = 22;

/** Número não-negativo a partir de string/number; usa fallback quando inválido. */
export function num(v: string | number, fallback = 0): number {
  return Math.max(0, Number(v) || fallback);
}

/** Soma N dias ÚTEIS (pula sábado/domingo) a uma data base. */
export function addDiasUteis(base: Date, n: number): Date {
  const d = new Date(base);
  let add = 0;
  while (add < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) add += 1;
  }
  return d;
}

export function fmtDataCurta(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface ProjecaoInput {
  pendDocs: number;
  pendInsp: number;
  /** ADMs/Técnicos efetivos (cadastro ou simulação). */
  admsEfet: number;
  tecsEfet: number;
  /** Produtividade diária. */
  dpa: number; // docs por ADM / dia
  ipa: number; // inspeções por técnico / dia
  /** Janela em dias úteis. */
  dias: number;
}

export interface ProjecaoBarra { semana: string; restante: number; processado: number }

export interface ProjecaoResultado {
  capDocs: number;
  capInsp: number;
  admsNec: number;
  tecsNec: number;
  admsAdd: number;
  tecsAdd: number;
  diasNecDocs: number;
  diasNecInsp: number;
  pctDocs: number;
  pctInsp: number;
  graficoDocs: ProjecaoBarra[];
  okDocs: boolean;
  okInsp: boolean;
}

/** Quantos ADMs/técnicos cobrem a demanda na janela, dias p/ zerar, cobertura % e burn-down. */
export function calcularProjecao(inp: ProjecaoInput): ProjecaoResultado {
  const { pendDocs, pendInsp, admsEfet, tecsEfet, dpa, ipa, dias } = inp;

  const capDocs = admsEfet * dpa * dias;
  const capInsp = tecsEfet * ipa * dias;

  const admsNec = dpa * dias > 0 ? Math.ceil(pendDocs / (dpa * dias)) : 0;
  const tecsNec = ipa * dias > 0 ? Math.ceil(pendInsp / (ipa * dias)) : 0;
  const admsAdd = Math.max(0, admsNec - admsEfet);
  const tecsAdd = Math.max(0, tecsNec - tecsEfet);

  const diasNecDocs = dpa > 0 && admsEfet > 0 ? Math.ceil(pendDocs / (admsEfet * dpa)) : Infinity;
  const diasNecInsp = ipa > 0 && tecsEfet > 0 ? Math.ceil(pendInsp / (tecsEfet * ipa)) : Infinity;

  const pctDocs = pendDocs > 0 ? Math.min(100, Math.round((capDocs / pendDocs) * 100)) : 100;
  const pctInsp = pendInsp > 0 ? Math.min(100, Math.round((capInsp / pendInsp) * 100)) : 100;

  const semanas = [1, 2, 3, 4, 6, 8, 10, 12].filter((s) => s * 5 <= dias + 10);
  const graficoDocs: ProjecaoBarra[] = semanas.map((s) => {
    const diasS = Math.min(s * 5, dias);
    const capAcum = admsEfet * dpa * diasS;
    return {
      semana: `S${s}`,
      restante: Math.max(0, pendDocs - capAcum),
      processado: Math.min(capAcum, pendDocs),
    };
  });

  return {
    capDocs, capInsp,
    admsNec, tecsNec,
    admsAdd, tecsAdd,
    diasNecDocs, diasNecInsp,
    pctDocs, pctInsp,
    graficoDocs,
    okDocs: admsAdd === 0,
    okInsp: tecsAdd === 0,
  };
}

/** Necessidade/déficit de uma única unidade (usado no breakdown), dado o cadastro rateado. */
export function calcularUnidade(
  pendDocs: number, pendInsp: number, cadAdms: number, cadTecs: number, dpa: number, ipa: number, dias: number,
) {
  const admsNec = dpa * dias > 0 ? Math.ceil(pendDocs / (dpa * dias)) : 0;
  const tecsNec = ipa * dias > 0 ? Math.ceil(pendInsp / (ipa * dias)) : 0;
  const defADM = Math.max(0, Math.ceil(admsNec - cadAdms - 0.05));
  const defTec = Math.max(0, Math.ceil(tecsNec - cadTecs - 0.05));
  return { admsNec, tecsNec, defADM, defTec, critico: defADM + defTec };
}

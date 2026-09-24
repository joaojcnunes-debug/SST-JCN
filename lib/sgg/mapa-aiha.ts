/**
 * De-para dos rotulos do painel para os dois criterios da matriz AIHA do SGG.
 *
 * A matriz ativa do painel (MTZ-EC03227A, "AIHA", 5x5) usa os MESMOS rotulos do SGG
 * -- o de-para e identidade. O que exige tabela e o vocabulario legado da matriz
 * `sgg-padrao`, que 522 riscos ainda carregam MESMO apontando id_matriz da AIHA:
 * por isso o de-para olha o ROTULO, nunca o id_matriz.
 *
 * Rotulo desconhecido LANCA. O calcularNivelComMatriz de lib/calc.ts devolve "Baixo"
 * calado nesse caso; o envio nao pode herdar isso -- enviaria risco errado ao PGR.
 */
export const PROB_AIHA = [
  "Não há exposição", "Exposição a níveis baixos", "Exposição moderada",
  "Exposição elevada", "Exposição elevadíssima",
] as const;

export const SEV_AIHA = [
  "Pouca importância", "Preocupantes", "Severos", "Irreversíveis", "Ameaça",
] as const;

/** sgg-padrao (5x4) -> AIHA (5x5), por posicao. */
const PROB_LEGADO: Record<string, string> = {
  "Improvável": "Não há exposição",
  "Remoto": "Exposição a níveis baixos",
  "Ocasional": "Exposição moderada",
  "Provável": "Exposição elevada",
  "Frequente": "Exposição elevadíssima",
};
const SEV_LEGADO: Record<string, string> = {
  "Insignificante": "Pouca importância",
  "Marginal": "Preocupantes",
  "Crítico": "Severos",
  "Catastrófico": "Irreversíveis",
};

export class RotuloDesconhecido extends Error {
  // Campos declarados e atribuídos no corpo, NÃO como parameter property
  // (`constructor(readonly x)`): o type-stripping do Node recusa com
  // ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX, e o `tsc --noEmit` não pega isso —
  // quem reprova é o `node --test`.
  readonly eixo: "probabilidade" | "severidade";
  readonly rotulo: string;
  constructor(eixo: "probabilidade" | "severidade", rotulo: string) {
    super(`${eixo} "${rotulo}" não existe na matriz AIHA nem na tabela de equivalência`);
    this.name = "RotuloDesconhecido";
    this.eixo = eixo;
    this.rotulo = rotulo;
  }
}

const norm = (s: string) => s.normalize("NFC").trim();

export function criterioNivel1(probabilidade: string | null | undefined): string {
  const p = norm(probabilidade ?? "");
  if ((PROB_AIHA as readonly string[]).includes(p)) return p;
  const eq = PROB_LEGADO[p];
  if (eq) return eq;
  throw new RotuloDesconhecido("probabilidade", p);
}

export function criterioNivel2(severidade: string | null | undefined): string {
  const s = norm(severidade ?? "");
  if ((SEV_AIHA as readonly string[]).includes(s)) return s;
  const eq = SEV_LEGADO[s];
  if (eq) return eq;
  throw new RotuloDesconhecido("severidade", s);
}

/**
 * Regra de quando o painel avisa que a revisão da trava por módulo (v236)
 * chegou — separada do componente para poder ser exercida sem navegador.
 *
 * Combinado com ele em 22/09: o card em Sistema › Funções é passivo (só vê
 * quem abre a tela); este aviso aparece sozinho no Início na semana da data e
 * NÃO some depois que ela passa. Some quando a trava sai do modo LOG — ou
 * seja, quando a decisão foi tomada.
 */

export interface ResumoTrava {
  modo: "log" | "trava";
  desde: string;
  revisar_em: string;
  tentativas: number;
  contas: number;
}

export interface AvisoRevisao {
  mostrar: boolean;
  /** Dias até a data (negativo = já passou). */
  faltam: number;
  /** "em 5 dias" | "amanhã" | "hoje" | "há 3 dias" */
  quando: string;
  venceu: boolean;
}

/** Dias inteiros entre hoje e `dia` (YYYY-MM-DD). Negativo = já passou.
 *  Ancora os dois lados ao meio-dia LOCAL: data "só dia" vinda do banco lida
 *  como meia-noite UTC vira o dia anterior no fuso de São Paulo. */
export function diasAte(dia: string, hoje: Date = new Date()): number {
  const alvo = new Date(dia + "T12:00:00").getTime();
  const base = new Date(hoje);
  base.setHours(12, 0, 0, 0);
  return Math.round((alvo - base.getTime()) / 86_400_000);
}

/** Quantos dias antes da data o aviso começa a aparecer. */
export const DIAS_DE_ANTECEDENCIA = 7;

export function avisoRevisao(
  resumo: ResumoTrava | null | undefined,
  hoje: Date = new Date(),
): AvisoRevisao {
  const vazio: AvisoRevisao = { mostrar: false, faltam: 0, quando: "", venceu: false };
  // Sem dados (ou sem permissão para lê-los) e trava já ligada: nada a lembrar.
  if (!resumo || resumo.modo !== "log" || !resumo.revisar_em) return vazio;

  const faltam = diasAte(resumo.revisar_em, hoje);
  if (faltam > DIAS_DE_ANTECEDENCIA) return vazio;

  const quando =
    faltam > 1
      ? `em ${faltam} dias`
      : faltam === 1
        ? "amanhã"
        : faltam === 0
          ? "hoje"
          : `há ${-faltam} dia${faltam === -1 ? "" : "s"}`;
  return { mostrar: true, faltam, quando, venceu: faltam < 0 };
}

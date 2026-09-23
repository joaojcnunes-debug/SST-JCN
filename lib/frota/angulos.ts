/**
 * Os quatro ângulos obrigatórios da saída — fonte única.
 *
 * Por que um arquivo só para isso: o mesmo conjunto aparece em quatro lugares —
 * o assistente de captura, o contador "2 de 4", o caminho no storage e a trava
 * do banco (`frota_exige_4_fotos`, v177). Uma lista solta em cada lugar é como
 * o quinto ângulo entra em três e falta no quarto.
 *
 * ORDEM IMPORTA: é a ordem em que o condutor dá a volta no carro. Frente,
 * lateral direita, traseira, lateral esquerda — um círculo, não um zigue-zague.
 * Trocar a ordem aqui muda a sequência da tela, e nada mais.
 */
import type { AnguloFoto } from "@/lib/frota/tipos";

export type AnguloObrigatorio = Exclude<AnguloFoto, "EXTRA">;

/**
 * Os quatro, na ordem da volta no carro.
 *
 * Deve bater com o `array[...]` do trigger `frota_exige_4_fotos` na v177: se um
 * ângulo entrar aqui e não lá, a tela cobra e o banco deixa passar (ou o
 * contrário, e a saída nunca finaliza).
 */
export const ANGULOS_OBRIGATORIOS: readonly AnguloObrigatorio[] = [
  "FRENTE",
  "LATERAL_DIREITA",
  "TRASEIRA",
  "LATERAL_ESQUERDA",
] as const;

export const ROTULO_ANGULO: Record<AnguloFoto, string> = {
  FRENTE: "Frente",
  LATERAL_DIREITA: "Lateral direita",
  LATERAL_ESQUERDA: "Lateral esquerda",
  TRASEIRA: "Traseira",
  EXTRA: "Foto extra",
};

/** Rótulo curto para o slot no celular, onde não cabe "Lateral esquerda". */
export const ROTULO_ANGULO_CURTO: Record<AnguloFoto, string> = {
  FRENTE: "Frente",
  LATERAL_DIREITA: "Lat. direita",
  LATERAL_ESQUERDA: "Lat. esquerda",
  TRASEIRA: "Traseira",
  EXTRA: "Extra",
};

/**
 * Nome do arquivo no storage. Fixo por ângulo, de propósito: refazer a foto da
 * frente sobrescreve com upsert em vez de acumular lixo no bucket.
 */
export const SLUG_ANGULO: Record<AnguloObrigatorio, string> = {
  FRENTE: "frente",
  LATERAL_DIREITA: "lateral-direita",
  LATERAL_ESQUERDA: "lateral-esquerda",
  TRASEIRA: "traseira",
};

/** Quais dos quatro ainda faltam, na ordem da volta no carro. */
export function angulosFaltando(presentes: readonly AnguloFoto[]): AnguloObrigatorio[] {
  const tem = new Set(presentes);
  return ANGULOS_OBRIGATORIOS.filter((a) => !tem.has(a));
}

/** A saída pode ser finalizada? Espelha a condição do trigger da v177. */
export function podeFinalizar(presentes: readonly AnguloFoto[]): boolean {
  return angulosFaltando(presentes).length === 0;
}

/**
 * Mensagem amigável do que falta. O banco também recusa (trigger), mas com texto
 * de exceção — esta é a versão que o condutor lê antes de tentar.
 */
export function mensagemAngulosFaltando(presentes: readonly AnguloFoto[]): string | null {
  const faltam = angulosFaltando(presentes);
  if (faltam.length === 0) return null;
  const nomes = faltam.map((a) => ROTULO_ANGULO[a].toLowerCase());
  if (nomes.length === 1) return `Falta a foto da ${nomes[0]}.`;
  const ultimo = nomes.pop();
  return `Faltam as fotos da ${nomes.join(", da ")} e da ${ultimo}.`;
}

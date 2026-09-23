/**
 * A regra dos dois registros de km, por decisão do operador:
 *   • km_cadastro — gravado uma vez, no cadastro, e NUNCA mais alterado.
 *   • km_atual    — a última atualização, que sobe pela saída ou pelo
 *                   abastecimento, com data e origem.
 *
 * A diferença entre os dois é o rodado desde o cadastro, sem somar nada à mão.
 *
 * POR QUE km_atual NUNCA REGRIDE: odômetro digitado errado ("8421" em vez de
 * "84210") entraria como km menor e faria o veículo "voltar no tempo" — depois
 * disso, todo cálculo de rodado e de consumo sai errado e ninguém sabe desde
 * quando. Um km menor que o atual é digitação errada em 100% dos casos reais,
 * então a atualização simplesmente não acontece. A v177 tem o CHECK
 * `km_atual >= km_cadastro` como rede.
 */

/**
 * De onde veio a última leitura do odômetro.
 *
 * A v178 acrescentou três: o RETORNO da viagem (que é a leitura mais confiável
 * que existe — o carro acabou de encostar), a LOTAÇÃO (o veículo mudou de base
 * e alguém anotou o painel na chegada) e a MANUTENÇÃO (a oficina anota o km na
 * entrada). Nenhuma delas muda a regra: km só sobe.
 */
export const ORIGENS_KM = [
  "SAIDA",
  "RETORNO",
  "ABASTECIMENTO",
  "LOTACAO",
  "MANUTENCAO",
] as const;
export type OrigemKm = (typeof ORIGENS_KM)[number];

/** 'SAIDA:CHK-1A2B' — guardado em frota_veiculos.km_atual_origem. */
export function marcaOrigemKm(origem: OrigemKm, id: string): string {
  return `${origem}:${id}`;
}

export function lerOrigemKm(marca: string | null): { origem: OrigemKm; id: string } | null {
  if (!marca) return null;
  // split(":", 2) NÃO serve: ele descarta o resto em vez de juntar. Como a marca
  // é sempre 'ORIGEM:<id>' e o id não tem dois-pontos, o indexOf é exato e
  // sobrevive a um id que um dia venha a ter.
  const corte = marca.indexOf(":");
  if (corte < 1) return null;
  const origem = marca.slice(0, corte);
  const id = marca.slice(corte + 1);
  if (!id) return null;
  return (ORIGENS_KM as readonly string[]).includes(origem)
    ? { origem: origem as OrigemKm, id }
    : null;
}

export const ROTULO_ORIGEM_KM: Record<OrigemKm, string> = {
  SAIDA: "saída de veículo",
  RETORNO: "volta da viagem",
  ABASTECIMENTO: "abastecimento",
  LOTACAO: "mudança de base",
  MANUTENCAO: "manutenção",
};

/** O km efetivo do veículo hoje: a última atualização, ou o do cadastro. */
export function kmEfetivo(v: { km_cadastro: number; km_atual: number | null }): number {
  return v.km_atual ?? v.km_cadastro;
}

/** Rodado desde o cadastro. Zero quando nunca houve atualização. */
export function kmRodadoDesdeCadastro(v: { km_cadastro: number; km_atual: number | null }): number {
  return Math.max(0, kmEfetivo(v) - v.km_cadastro);
}

/**
 * O km informado deve atualizar o registro do veículo?
 * Só sobe. Igual não atualiza — evita reescrever data e origem sem mudança real.
 */
export function deveAtualizarKm(
  v: { km_cadastro: number; km_atual: number | null },
  kmInformado: number | null | undefined,
): boolean {
  if (kmInformado == null || !Number.isFinite(kmInformado)) return false;
  return kmInformado > kmEfetivo(v);
}

/**
 * Aviso para o formulário quando o km digitado é menor que o registro atual.
 * NÃO é erro que bloqueia: o abastecimento pode ser lançado com atraso, depois
 * de uma saída com km maior. O que não acontece é o registro do veículo baixar.
 */
export function avisoKmRetroativo(
  v: { km_cadastro: number; km_atual: number | null } | null | undefined,
  kmInformado: number | null | undefined,
): string | null {
  if (!v || kmInformado == null || !Number.isFinite(kmInformado)) return null;
  const atual = kmEfetivo(v);
  if (kmInformado >= atual) return null;
  return `O registro do veículo está em ${formatarKm(atual)} km. Este lançamento fica no histórico, mas não baixa o registro.`;
}

/** Erro que bloqueia: km abaixo do cadastro é digitação errada, não atraso. */
export function erroKmSaida(
  v: { km_cadastro: number; km_atual: number | null } | null | undefined,
  kmInformado: number | null | undefined,
): string | null {
  if (kmInformado == null || String(kmInformado) === "") return "Informe o km de saída.";
  if (!Number.isFinite(kmInformado) || kmInformado < 0) return "Km inválido.";
  if (v && kmInformado < v.km_cadastro) {
    return `Km menor que o do cadastro (${formatarKm(v.km_cadastro)} km). Confira o odômetro.`;
  }
  return null;
}

/** 84210 → "84.210". Milhar com ponto, como o resto do painel. */
export function formatarKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "—";
  return km.toLocaleString("pt-BR");
}

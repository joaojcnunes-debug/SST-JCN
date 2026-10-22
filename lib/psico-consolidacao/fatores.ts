// Consolidação Psicossocial de Grupo (v295) — de onde vem cada fator.
//
// AEP e DRPS têm catálogo fixo (de-para semeado na v295). As categorias do QPS são
// cadastradas por tipo de questionário, com o nome que quem cadastrou escolheu — por
// isso o fator delas é SUGERIDO pelo nome e o Admin confirma na tela de Fatores.

export type OrigemFonte = "AEP" | "DRPS" | "QPS";

export interface PsicoFator {
  id_fator: string;
  nome: string;
  nome_curto: string;
  ordem: number;
  ativo: boolean;
}

export interface PsicoFatorDepara {
  origem: OrigemFonte;
  valor_origem: string;
  id_fator: string;
}

/** Sem "Tópico NN - ", sem acento, minúsculas, só letras/números. */
export function normalizarNomeFator(nome: string | null | undefined): string {
  return (nome ?? "")
    .replace(/^\s*t[óo]pico\s*\d+\s*[-–—:]\s*/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Palavras que identificam cada fator. A ordem importa nos casos que dividem
 * palavra: "baixa demanda" (Subcarga) antes de "demanda" (Sobrecarga).
 */
const PALAVRAS: Array<[string, string[]]> = [
  ["subcarga", ["subcarga", "baixa demanda"]],
  ["sobrecarga", ["sobrecarga", "excesso de demanda"]],
  ["assedio", ["assedio"]],
  ["eventos_traumaticos", ["traumatic", "eventos violentos", "evento violento"]],
  ["recompensas", ["recompensa", "reconhecimento"]],
  ["falta_suporte", ["suporte", "apoio"]],
  ["gestao_mudancas", ["mudanca"]],
  ["maus_relacionamentos", ["relacionamento"]],
  ["baixo_controle", ["autonomia", "baixo controle"]],
  ["clareza_papel", ["clareza", "papel"]],
  ["comunicacao_dificil", ["comunicacao"]],
  ["justica_organizacional", ["justica"]],
  ["trabalho_remoto", ["remoto", "isolad"]],
];

/**
 * Fator do catálogo para um nome vindo da origem.
 *  1) de-para gravado (origem + valor exato);
 *  2) mesmo nome do catálogo, ignorando acento/caixa/pontuação;
 *  3) palavra-chave — só quando UM fator casa (empate = sem sugestão).
 */
export function resolverFator(
  origem: OrigemFonte,
  nome: string,
  fatores: PsicoFator[],
  depara: PsicoFatorDepara[],
): { id_fator: string | null; como: "depara" | "nome" | "sugestao" | null } {
  const gravado = depara.find((d) => d.origem === origem && d.valor_origem === nome);
  if (gravado) return { id_fator: gravado.id_fator, como: "depara" };

  const alvo = normalizarNomeFator(nome);
  if (!alvo) return { id_fator: null, como: null };
  const igual = fatores.find((f) => normalizarNomeFator(f.nome) === alvo);
  if (igual) return { id_fator: igual.id_fator, como: "nome" };

  const casam = PALAVRAS.filter(([, palavras]) => palavras.some((p) => alvo.includes(p))).map(([id]) => id);
  const existentes = casam.filter((id) => fatores.some((f) => f.id_fator === id));
  if (existentes.length === 1) return { id_fator: existentes[0], como: "sugestao" };
  return { id_fator: null, como: null };
}

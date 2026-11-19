/**
 * Tabela com grade pontilhada e colunas centralizadas (0.3.312–0.3.313, 19/11/2026 — pedido do João, a partir da lista
 * de Inspeções). Use no `<table>`: `className={cn(TABELA_GRADE, "w-full …")}`.
 *   - borda tracejada cinza em todas as células (cabeçalho e corpo);
 *   - título e conteúdo de cada coluna no centro;
 *   - listas (ul) com a bolinha junto do texto;
 *   - tira a borda das linhas (<tr>): a borda lisa e clarinha delas ganhava da tracejada e as horizontais sumiam.
 * Para tabelas de lista/consulta. Editores com campos, matrizes e tabelas de PDF/impressão ficam como estão.
 */
export const TABELA_GRADE =
  "border-collapse [&_th]:border [&_td]:border [&_th]:border-dashed [&_td]:border-dashed " +
  "[&_th]:border-gray-300 [&_td]:border-gray-300 [&_tr]:!border-0 " +
  "[&_th]:!text-center [&_td]:!text-center [&_td>*]:mx-auto " +
  // listas dentro da célula: a bolinha acompanha o texto centralizado (senão fica presa na esquerda).
  "[&_td_ul]:list-inside";

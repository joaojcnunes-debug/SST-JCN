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
  // 0.3.329 (pedido do João, 27/11/2026): cada linha do corpo vira um CARTÃO (fundo branco, borda arredondada, sombra e
  // espaço entre as linhas), como no Comercial. Por isso a tabela passa a ter as bordas separadas (border-separate) e o
  // espaço vertical entre as linhas; o cabeçalho continua com a grade tracejada.
  "border-separate border-spacing-x-0 border-spacing-y-2 " +
  "[&_th]:border [&_th]:border-dashed [&_th]:border-gray-300 [&_tr]:!border-0 " +
  // o cartão: borda em volta da linha (em cima, embaixo e nas pontas), cantos arredondados nas pontas e linha tracejada
  // separando as colunas por dentro.
  "[&_tbody_td]:border-y [&_tbody_td]:border-solid [&_tbody_td]:border-gray-200 " +
  "[&_tbody_td:first-child]:border-l [&_tbody_td:first-child]:rounded-l-xl " +
  "[&_tbody_td:last-child]:border-r [&_tbody_td:last-child]:rounded-r-xl " +
  "[&_tbody_td+td]:[border-left:1px_dashed_rgb(209_213_219)] " +
  // fundo branco e sombra; com :where() o fundo branco perde para a cor que a própria linha já tem (atrasada, feita…).
  "[:where(&)_tbody_tr]:bg-white [&_tbody_tr]:shadow-md [&_tbody_tr]:transition-shadow [&_tbody_tr:hover]:shadow-lg " +
  "[&_th]:!text-center [&_td]:!text-center [&_td>*]:mx-auto " +
  // listas dentro da célula: a bolinha acompanha o texto centralizado (senão fica presa na esquerda).
  "[&_td_ul]:list-inside";

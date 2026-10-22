/**
 * Escrita que voltou com 0 linhas é FALHA, não sucesso.
 *
 * O PostgREST não devolve erro quando a RLS filtra a linha de um UPDATE ou
 * DELETE: a requisição volta 2xx e a lista de linhas vem vazia. Cliente que
 * testa só `error` comemora um salvamento que não aconteceu — a tela fecha o
 * modo de edição, o refetch traz o valor antigo e o usuário conclui que "o
 * painel não salva", sem nenhum erro registrado em lugar nenhum.
 *
 * Medido em 2026-10-06 no `painel_sst`: duas contas reais caem nisso hoje na
 * tela de questionários — uma `Visualizador` (reprovada por
 * `caller_pode_editar()`) e uma `Tecnico` com 1 unidade de 7 (reprovada por
 * `caller_pode_ver_empresa()`). Nos dois casos o PATCH volta 2xx e vazio.
 *
 * Por isso toda escrita em `qps_aplicacoes` pede `.select(...)` e passa o
 * resultado por aqui.
 */
export function exigeLinhaGravada(linhas: unknown, oQue: string): void {
  if (Array.isArray(linhas) && linhas.length > 0) return;
  throw Object.assign(
    new Error(
      `A ${oQue} não foi gravada: o banco não autorizou a edição desta aplicação. ` +
        "Confira se o seu usuário tem permissão de edição e o módulo Questionários Psicossociais.",
    ),
    // `mensagemErro` (lib/errors.ts) devolve o fallback para erro desconhecido,
    // de propósito, para não vazar SQL. Sem um código reconhecido esta frase
    // nunca chegaria ao usuário.
    { code: "nao_gravou" },
  );
}

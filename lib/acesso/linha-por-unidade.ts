import type { Usuario } from "@/lib/supabase/types";

/**
 * Espelha a policy `for all` das tabelas escopadas por unidade (v75/v76):
 *
 *     caller_pode_editar() AND caller_pode_ver_empresa(id_empresa)
 *
 * Módulo **puro de propósito** — sem React, sem Next, sem store. É o que
 * permite testá-lo (`lib/qps/gravacao.test.ts`); o wrapper de hook fica em
 * `lib/hooks/useUsuario.ts`.
 *
 * Medido no banco em 2026-10-06, e as duas metades surpreendem:
 *
 *  • `caller_pode_editar()` é `perfil IN ('Admin','Tecnico') AND ativo_sistema`.
 *    Ela **não lê `usuarios.pode_editar`**. Por isso `useCanEdit()` não serve
 *    de guard aqui: ele libera Visualizador com `pode_editar = true` (existe um
 *    em produção), que o banco recusa em silêncio.
 *  • `caller_pode_ver_empresa()` (v75) é
 *    `caller_eh_admin() OR e.id_unidade IS NULL OR e.id_unidade = any(caller_unidades())`.
 *    Empresa **sem unidade é editável por todos** — a v76 liga a RLS contando
 *    com isso ("toda empresa nasce sem unidade (=visível a todos)"). Quem tem
 *    unidade atribuída é que fica restrito: há técnico com 1 unidade de 7 que
 *    não edita a aplicação da unidade vizinha.
 *
 * Sem este guard a tela oferece o lápis, o PATCH volta 2xx com 0 linhas e o
 * usuário vê "salvo" sem ter salvo.
 */

/**
 * Quem a RLS aceita como escritor. Vale como guard de CRIAÇÃO em geral; para
 * guardar EDIÇÃO, use `podeEditarLinhaDaUnidade` — e nunca mexa em
 * `useCanEdit()`, que a Gestão usa com RLS própria (membership por quadro).
 */
export function perfilEscreveNaRls(perfil?: string) {
  return perfil === "Admin" || perfil === "Tecnico";
}

/**
 * Os dois ramos "sem valor" liberam, de propósito: `undefined` é a empresa
 * ainda carregando, e `null` é empresa sem unidade — reprovar qualquer um dos
 * dois sumiria com o lápis de quem o banco autoriza. Hoje nenhuma empresa tem
 * `id_unidade` nulo, mas isso é dado, não regra: a FK é `on delete set null`,
 * então apagar uma unidade zera a coluna de todas as empresas dela de uma vez.
 */
export function podeEditarLinhaDaUnidade(
  user: Pick<Usuario, "perfil" | "ativo_sistema" | "unidades"> | null | undefined,
  idUnidadeDaEmpresa: string | null | undefined,
): boolean {
  if (!user) return false;
  if (user.ativo_sistema === false) return false;
  if (!perfilEscreveNaRls(user.perfil)) return false;
  if (user.perfil === "Admin") return true;
  if (!idUnidadeDaEmpresa) return true; // carregando, ou empresa sem unidade
  return (user.unidades ?? []).includes(idUnidadeDaEmpresa);
}

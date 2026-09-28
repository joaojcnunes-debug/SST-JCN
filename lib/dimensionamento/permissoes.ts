// Quem faz o quê no Dimensionamento (pedido de 2026-09-28).
//
//   Admin       → tudo.
//   Gerente     → vê tudo (Headcount, Cadastros, Histórico), NÃO cria/edita/exclui.
//   Supervisores→ só os Cadastros, com criar/editar/excluir; NÃO veem o Headcount
//                 nem o Histórico.
//   Demais      → sem acesso.
//
// A função (`usuarios.funcao`, cadastro em Sistema › Funções) decide o papel.
// O banco repete a mesma regra em `dim_pode_ver()` / `dim_pode_editar()` (v263)
// — se mudar aqui, mude lá.

export const FUNCOES_GERENTE = ["Gerente"] as const;
export const FUNCOES_SUPERVISOR = ["Supervisor dos técnicos", "Supervisora do administrativo"] as const;

export interface PermissoesDim {
  /** Entra no módulo. */
  acesso: boolean;
  verHeadcount: boolean;
  verHistorico: boolean;
  /** Criar, editar e excluir nos Cadastros. */
  editar: boolean;
  /** Sincronizar com a API externa (continua só do Admin). */
  sincronizar: boolean;
}

const NADA: PermissoesDim = {
  acesso: false,
  verHeadcount: false,
  verHistorico: false,
  editar: false,
  sincronizar: false,
};

export function permissoesDim(
  user: { perfil?: string | null; funcao?: string | null; ativo_sistema?: boolean | null } | null | undefined
): PermissoesDim {
  if (!user || user.ativo_sistema === false) return NADA;
  if (user.perfil === "Admin") {
    return { acesso: true, verHeadcount: true, verHistorico: true, editar: true, sincronizar: true };
  }
  const funcao = (user.funcao ?? "").trim();
  if ((FUNCOES_GERENTE as readonly string[]).includes(funcao)) {
    return { acesso: true, verHeadcount: true, verHistorico: true, editar: false, sincronizar: false };
  }
  if ((FUNCOES_SUPERVISOR as readonly string[]).includes(funcao)) {
    return { acesso: true, verHeadcount: false, verHistorico: false, editar: true, sincronizar: false };
  }
  return NADA;
}

/**
 * Traduz erros crus de Postgres / Supabase / rede em mensagens claras em
 * português, sem vazar SQL ou detalhes técnicos para o usuário final.
 *
 * Uso: `toast.error(mensagemErro(e, "Não foi possível salvar."))`.
 * O `fallback` é a mensagem para erros desconhecidos (contextualize por chamada).
 */

const POR_CODIGO: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23503": "Não é possível concluir: há dados vinculados a este registro.",
  "23502": "Preencha todos os campos obrigatórios.",
  "23514": "Algum valor informado não é permitido.",
  "22P02": "Algum valor está em formato inválido.",
  "42501": "Você não tem permissão para esta ação.",
  PGRST301: "Sua sessão expirou. Faça login novamente.",
  PGRST116: "Registro não encontrado.",
  "401": "Sua sessão expirou. Faça login novamente.",
};

type ErroLike = {
  code?: string | number;
  message?: string;
  error_description?: string;
  status?: number;
  statusCode?: number;
};

/** Extrai uma mensagem amigável de qualquer erro (Postgres/Supabase/Error/rede). */
export function mensagemErro(
  erro: unknown,
  fallback = "Algo deu errado. Tente novamente.",
): string {
  if (!erro) return fallback;
  if (typeof erro === "string") return erro || fallback;

  const e = erro as ErroLike;
  const code = e.code != null ? String(e.code) : undefined;
  const status = e.status ?? e.statusCode;
  const raw = (e.message ?? e.error_description ?? "").toString();
  const low = raw.toLowerCase();

  // Código conhecido tem prioridade.
  if (code && POR_CODIGO[code]) return POR_CODIGO[code];
  if (status && POR_CODIGO[String(status)]) return POR_CODIGO[String(status)];

  // Rede / sessão.
  if (
    low.includes("failed to fetch") ||
    low.includes("networkerror") ||
    low.includes("load failed") ||
    low.includes("fetch failed")
  ) {
    return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  }
  if (
    status === 401 ||
    low.includes("jwt expired") ||
    low.includes("invalid jwt") ||
    low.includes("not authenticated")
  ) {
    return "Sua sessão expirou. Faça login novamente.";
  }

  // Padrões na mensagem crua do Postgres (quando o code não veio).
  if (low.includes("duplicate key")) return POR_CODIGO["23505"];
  if (low.includes("violates foreign key")) return POR_CODIGO["23503"];
  if (low.includes("violates not-null")) return POR_CODIGO["23502"];
  if (low.includes("row-level security") || low.includes("permission denied")) {
    return POR_CODIGO["42501"];
  }

  // P0001 = RAISE EXCEPTION dos nossos RPCs: a mensagem já é escrita para o usuário.
  if (code === "P0001" && raw) return raw;

  // Desconhecido → fallback (nunca devolve SQL cru).
  return fallback;
}

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

// Mensagens de RAISE EXCEPTION da Gestão gravadas sem acento no banco (gestao_decidir_aprovacao v315,
// gestao_vincular/desvincular v195, dependências). Casadas pelo INÍCIO, em minúsculas, porque algumas
// terminam com o valor recebido ("decisao invalida: xyz"). Corrigir no banco é outra versão de SQL.
const RAISE_SEM_ACENTO: [string, string][] = [
  ["voce nao pode decidir esta aprovacao", "Você não pode decidir esta aprovação."],
  ["aprovacao ja decidida", "Esta aprovação já foi decidida."],
  ["decisao invalida", "Decisão inválida."],
  ["aprovacao inexistente", "Esta aprovação não existe mais."],
  ["nao autenticado", "Sua sessão expirou. Faça login novamente."],
  ["sem edicao neste quadro", "Você não tem permissão para editar esta lista."],
  ["voce so pode vincular a si mesmo", "Você só pode incluir a si mesmo. Para vincular outra pessoa, peça a um gestor."],
  ["voce so pode desvincular a si mesmo", "Você só pode tirar a si mesmo. Para desvincular outra pessoa, peça a um gestor."],
  // v319: quem edita a lista vincula outras pessoas, desde que sejam membros da Gestão.
  ["so membros da Gestao podem ser vinculados", "Só membros da Gestão podem ser responsáveis ou seguidores."],
  ["e-mail do vinculo obrigatorio", "Informe o e-mail da pessoa."],
  ["tarefa inexistente", "Esta tarefa não existe mais."],
  ["dependencia circular nao permitida", "Dependência circular não é permitida."],
];

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

  // RAISE dos RPCs da Gestão escritos sem acento (v195/v315): traduz antes de repassar o texto cru.
  const traduzida = RAISE_SEM_ACENTO.find(([prefixo]) => low.startsWith(prefixo));
  if (traduzida) return traduzida[1];

  // P0001 = RAISE EXCEPTION dos nossos RPCs: a mensagem já é escrita para o usuário.
  if (code === "P0001" && raw) return raw;
  // Limite do Groq (429) — também já escrita para o usuário, com os segundos de
  // espera (lib/ia/limite-groq.ts).
  if (code === "limite_ia" && raw) return raw;
  // Escrita que voltou com 0 linhas: o PostgREST não devolve erro quando a RLS
  // filtra a linha, então quem escreve verifica a contagem e levanta isto. A
  // mensagem já vem pronta para o usuário e diz o que conferir.
  if (code === "nao_gravou" && raw) return raw;
  // Recusa já escrita para o usuário (ex.: "Poucos comentários para resumir" na IA da Gestão, 0.3.275).
  if (code === "mensagem_usuario" && raw) return raw;

  // Desconhecido → fallback (nunca devolve SQL cru).
  return fallback;
}

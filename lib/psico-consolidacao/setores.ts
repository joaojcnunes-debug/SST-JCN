// Consolidação Psicossocial de Grupo (v295) — padronização dos nomes de setor.
//
// O setor é texto livre em todo o painel (AEP: `setores[i].nome_setor`; DRPS e QPS:
// a coluna do CSV do Forms). Cada empresa do grupo escreve o mesmo setor de um jeito
// ("CANTEIRO DE OBRAS - ELETRICA", "OBRA - ELÉTRICA", "ELETRICA C/ALTURA"…). Aqui só
// se SUGERE o nome padronizado — quem confirma é o técnico, na tela de Setores, e o
// nome original fica guardado ao lado (psico_setor_depara).
//
// Regras do caso de origem (prompt de 19/10, seção 4.2). Função pura, testada.

/** Sem acento, maiúsculas, espaços únicos — a forma de comparar dois nomes. */
export function chaveSetor(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras que o CSV costuma trazer sem acento → grafia correta. */
const ACENTOS: Record<string, string> = {
  ELETRICA: "Elétrica",
  HIDRAULICA: "Hidráulica",
  MAQUINA: "Máquinas",
  MAQUINAS: "Máquinas",
  ESCRITORIO: "Escritório",
  ESCAVACAO: "Escavação",
  SEGURANCA: "Segurança",
  INCORPORACAO: "Incorporação",
  MANUTENCAO: "Manutenção",
  PRODUCAO: "Produção",
  HIGIENIZACAO: "Higienização",
  ADMINISTRACAO: "Administração",
  OPERACAO: "Operação",
  LOGISTICA: "Logística",
  MECANICA: "Mecânica",
  SERVICOS: "Serviços",
  TECNICO: "Técnico",
  ARMACAO: "Armação",
  FUNDACAO: "Fundação",
};

const MINUSCULAS = new Set(["DE", "DO", "DA", "DOS", "DAS", "E", "EM", "NO", "NA", "A", "O"]);

/** "SEGURANCA DO TRABALHO" → "Segurança do Trabalho". */
function titulo(chave: string): string {
  return chave
    .split(" ")
    .filter(Boolean)
    .map((p, i) => {
      if (ACENTOS[p]) return ACENTOS[p];
      if (i > 0 && MINUSCULAS.has(p)) return p.toLowerCase();
      return p.charAt(0) + p.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Parte de um setor combinado ("ENGENHARIA / SEGURANÇA DO TRABALHO"). */
function parteCombinada(chave: string): string {
  if (chave === "SEGURANCA DO TRABALHO") return "Seg. Trabalho";
  return titulo(chave);
}

/**
 * Nome padronizado sugerido para um setor como ele veio no documento.
 * Devolve "" para nome vazio.
 */
export function sugerirSetorCanonico(original: string | null | undefined): string {
  let k = chaveSetor(original);
  if (!k) return "";

  // "CANTEIRO – ADMINISTRATIVO" (DRPS) e "ADMINISTRATIVO" (AEP) são o mesmo setor do canteiro.
  if (/^CANTEIRO( DE OBRAS?)? ?- ?ADMINISTRATIVO$/.test(k) || k === "ADMINISTRATIVO") {
    return "Administrativo (canteiro)";
  }

  // Prefixo de obra: "CANTEIRO DE OBRA(S) - X", "OBRA - X" → X.
  k = k.replace(/^(CANTEIRO( DE OBRAS?)?|OBRAS?) ?- ?/, "");
  // "OBRA - ADMINISTRATIVO" (AEP da Hildegardo) também é o administrativo do canteiro.
  if (k === "ADMINISTRATIVO") return "Administrativo (canteiro)";

  // Variante de altura soma ao setor base: "X - ALTURA", "X C/ALTURA", "X S/ALTURA".
  k = k
    .replace(/ ?- ?ALTURA$/, "")
    .replace(/ ?[CS]\/ ?ALTURA$/, "")
    .replace(/ (COM|SEM) ALTURA$/, "")
    .trim();

  if (k === "OBRA" || k === "OBRAS" || k === "CANTEIRO" || k === "CANTEIRO DE OBRAS") return "Obra (geral)";

  // Escritório: "ADMINISTRATIVO/ESCRITÓRIO", "ESCRITÓRIO - HIGIENIZAÇÃO", "ESCRITÓRIO".
  if (k === "ESCRITORIO" || k === "ADMINISTRATIVO/ESCRITORIO" || /^ESCRITORIO ?- ?/.test(k)) {
    return "Escritório";
  }

  // Setor combinado continua sendo um setor próprio.
  if (k.includes("/")) {
    return k.split("/").map((p) => parteCombinada(p.trim())).join("/");
  }

  return titulo(k);
}

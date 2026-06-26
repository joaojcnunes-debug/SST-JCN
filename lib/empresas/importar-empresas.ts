// Importação de empresas em lote a partir de planilha (CSV/XLSX).
// Funções puras (sem DOM): parsing, classificação e geração de modelo.

import * as XLSX from "xlsx";

/** Campos importáveis de uma linha da planilha. */
export interface EmpresaImport {
  nome_empresa: string;
  cnpj: string | null;
  razao_social: string | null;
  grau_risco: number | null;
  unidadeNome: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
}

export type StatusLinha = "valida" | "duplicada" | "erro";

export interface LinhaClassificada extends EmpresaImport {
  status: StatusLinha;
  /** Aviso/erro legível (ex.: "CNPJ já existe", "unidade não encontrada"). */
  motivo?: string;
  /** Unidade resolvida a partir do nome (null = sem unidade). */
  id_unidade: string | null;
}

/** Cabeçalho normalizado → campo. Aceita variações comuns. */
const MAPA: Record<string, keyof EmpresaImport> = {
  nome: "nome_empresa",
  "nome empresa": "nome_empresa",
  "nome da empresa": "nome_empresa",
  empresa: "nome_empresa",
  "razao social": "razao_social",
  razao: "razao_social",
  cnpj: "cnpj",
  "grau de risco": "grau_risco",
  "grau risco": "grau_risco",
  grau: "grau_risco",
  gr: "grau_risco",
  unidade: "unidadeNome",
  municipio: "municipio",
  cidade: "municipio",
  uf: "uf",
  estado: "uf",
  cep: "cep",
  telefone: "telefone",
  fone: "telefone",
  email: "email",
  "e mail": "email",
  logradouro: "logradouro",
  endereco: "logradouro",
  rua: "logradouro",
  numero: "numero",
  "n": "numero",
  bairro: "bairro",
};

/** minúsculo, sem acento, trim — para casar cabeçalhos e nomes de unidade. */
export function normalizarTexto(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Lê a 1ª aba e mapeia colunas → campos pelo cabeçalho. */
export function parsearPlanilhaEmpresas(buffer: ArrayBuffer): {
  linhas: EmpresaImport[];
  aviso?: string;
} {
  // XLSX é um zip ("PK"); CSV/texto é decodificado como UTF-8 (com fallback
  // Windows-1252). Ler CSV via type:"array" deixa o SheetJS assumir 1252 e
  // quebra os acentos (UTF-8) — daí a leitura explícita de texto.
  const bytes = new Uint8Array(buffer);
  const ehZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let wb;
  if (ehZip) {
    wb = XLSX.read(buffer, { type: "array" });
  } else {
    let texto = new TextDecoder("utf-8").decode(buffer);
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buffer);
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // remove BOM
    wb = XLSX.read(texto, { type: "string" });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { linhas: [], aviso: "A planilha está vazia." };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (rows.length < 2) return { linhas: [], aviso: "A planilha não tem linhas de dados." };

  const header = (rows[0] as unknown[]).map(normalizarTexto);
  const idx: Partial<Record<keyof EmpresaImport, number>> = {};
  header.forEach((h, i) => {
    const campo = MAPA[h];
    if (campo && idx[campo] === undefined) idx[campo] = i;
  });

  if (idx.nome_empresa === undefined) {
    return {
      linhas: [],
      aviso:
        'Não encontrei a coluna "Nome". Confira o cabeçalho da planilha ou baixe o modelo.',
    };
  }

  const linhas: EmpresaImport[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const get = (c?: number) => (c === undefined ? "" : String(row[c] ?? "").trim());

    // pula linha totalmente em branco
    if (row.every((c) => !String(c ?? "").trim())) continue;

    const grauRaw = soDigitos(get(idx.grau_risco));
    const grau = grauRaw ? parseInt(grauRaw, 10) : NaN;

    linhas.push({
      nome_empresa: get(idx.nome_empresa),
      cnpj: get(idx.cnpj) || null,
      razao_social: get(idx.razao_social) || null,
      grau_risco: grau >= 1 && grau <= 4 ? grau : null,
      unidadeNome: get(idx.unidadeNome) || null,
      municipio: get(idx.municipio) || null,
      uf: get(idx.uf).toUpperCase().slice(0, 2) || null,
      cep: get(idx.cep) || null,
      telefone: get(idx.telefone) || null,
      email: get(idx.email) || null,
      logradouro: get(idx.logradouro) || null,
      numero: get(idx.numero) || null,
      bairro: get(idx.bairro) || null,
    });
  }

  return { linhas };
}

/**
 * Classifica cada linha: erro (sem nome), duplicada (CNPJ já existe no banco ou
 * repetido na planilha) ou válida. Resolve a unidade pelo nome.
 */
export function classificarLinhas(
  linhas: EmpresaImport[],
  cnpjsExistentes: Set<string>,
  unidadePorNome: Map<string, string>,
): LinhaClassificada[] {
  const vistos = new Set<string>();
  return linhas.map((l) => {
    const id_unidade = l.unidadeNome
      ? unidadePorNome.get(normalizarTexto(l.unidadeNome)) ?? null
      : null;

    let status: StatusLinha = "valida";
    let motivo: string | undefined;

    if (!l.nome_empresa) {
      status = "erro";
      motivo = "Sem nome";
    } else {
      const dig = soDigitos(l.cnpj);
      if (dig && (cnpjsExistentes.has(dig) || vistos.has(dig))) {
        status = "duplicada";
        motivo = "CNPJ já cadastrado";
      }
      if (dig) vistos.add(dig);
    }

    if (status === "valida" && l.unidadeNome && !id_unidade) {
      motivo = "unidade não encontrada (ficará sem unidade)";
    }

    return { ...l, status, motivo, id_unidade };
  });
}

/** Mapeia a resposta da consulta de CNPJ (shape BrasilAPI) para campos da empresa. */
export function mapearReceita(d: Record<string, unknown>): Partial<EmpresaImport> {
  const str = (v: unknown) => (v == null ? null : String(v).trim() || null);
  return {
    razao_social: str(d.razao_social),
    cep: str(d.cep),
    logradouro: str(d.logradouro),
    numero: str(d.numero),
    bairro: str(d.bairro),
    municipio: str(d.municipio),
    uf: str(d.uf)?.toUpperCase().slice(0, 2) ?? null,
    telefone: str(d.ddd_telefone_1),
    email: str(d.email),
  };
}

/** Gera o modelo .xlsx (cabeçalho + 2 exemplos) para download. */
export function gerarModeloEmpresasXlsx(): ArrayBuffer {
  const dados = [
    [
      "Nome", "CNPJ", "Razão Social", "Grau de Risco", "Unidade",
      "Município", "UF", "CEP", "Telefone", "E-mail", "Logradouro", "Número", "Bairro",
    ],
    [
      "Padaria Exemplo Ltda", "12.345.678/0001-90", "Padaria Exemplo Ltda", 3, "Teresópolis",
      "Teresópolis", "RJ", "25953-000", "(21) 99999-0000", "contato@exemplo.com", "Rua das Flores", "100", "Centro",
    ],
    [
      "Metalúrgica Modelo ME", "98.765.432/0001-10", "", 4, "Petrópolis",
      "Petrópolis", "RJ", "", "", "", "", "", "",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws["!cols"] = [
    { wch: 28 }, { wch: 20 }, { wch: 28 }, { wch: 13 }, { wch: 18 },
    { wch: 18 }, { wch: 5 }, { wch: 11 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 8 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Empresas");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

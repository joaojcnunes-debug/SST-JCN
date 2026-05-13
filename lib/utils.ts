import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { NivelRisco } from "./supabase/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtData(
  value: string | Date | null | undefined,
  pattern = "dd/MM/yyyy"
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern, { locale: ptBR });
}

export function fmtDataHora(value: string | Date | null | undefined): string {
  return fmtData(value, "dd/MM/yyyy HH:mm");
}

// Lógica SGG v2 — listas em ordem crescente de peso (índice = peso).
// Probabilidades: 5 níveis (0–4). Severidades: 4 níveis (0–3).
export const PROBABILIDADES = [
  "Improvável",
  "Remoto",
  "Ocasional",
  "Provável",
  "Frequente",
] as const;

export const SEVERIDADES = [
  "Insignificante",
  "Marginal",
  "Crítico",
  "Catastrófico",
] as const;

export function calcularNivelRisco(
  prob: string | null | undefined,
  sev: string | null | undefined
): NivelRisco {
  if (!prob || !sev) return "Baixo";
  const iP = (PROBABILIDADES as readonly string[]).indexOf(prob);
  const iS = (SEVERIDADES as readonly string[]).indexOf(sev);
  if (iP < 0 || iS < 0) return "Baixo";

  const score = iP * iS;
  // Trivial: score 0 e ambos não-extremos.
  if (score === 0 && iP < 4 && iS < 3) return "Trivial";
  // Baixo: score baixo + casos especiais nos extremos.
  if (
    (score >= 1 && score < 3) ||
    (iP === 4 && iS === 0) ||
    (iP === 0 && iS === 3) ||
    (iP === 3 && iS === 1)
  )
    return "Baixo";
  // Moderado: score médio + caso especial.
  if ((score > 3 && score <= 8) || (iP === 1 && iS === 3)) return "Moderado";
  // Alto: score alto.
  if (score > 8 && score <= 12) return "Alto";
  // Muito Alto: matematicamente inalcançável com 5×4 mas mantido por
  // compatibilidade com a tipagem — pode ser usado em futuras matrizes 6×4.
  if (score > 12) return "Muito Alto";
  return "Moderado";
}

// Gera ID curto compatível com PRIMARY KEY TEXT.
// Formato: PREFIX-XXXXXXXX (8 chars hex maiúsculo) — ex. INS-A3F4B7C2.
export function gerarId(prefixo = "ID"): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefixo}-${hex}`;
}

/**
 * Faz parse de campo `medidas_adotadas` ou `medidas_recomendadas`.
 *
 * Compat: aceita tanto JSON array de strings (formato novo, lista de
 * itens individuais) quanto texto livre (formato legado pré-2026-05).
 * Em texto livre, retorna 1 item com o texto inteiro — assim o usuário
 * vê o conteúdo antigo e na primeira edição+save vira JSON limpo.
 */
export function parseMedidas(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return (parsed as string[]).map((x) => x.trim()).filter(Boolean);
    }
  } catch {
    // não é JSON — trata como item único
  }
  return [s];
}

/**
 * Converte array de medidas em string JSON pra persistir no banco.
 * Retorna null se a lista estiver vazia (deixa a coluna NULL).
 */
export function stringifyMedidas(arr: string[]): string | null {
  const limpas = arr.map((s) => s.trim()).filter(Boolean);
  if (limpas.length === 0) return null;
  return JSON.stringify(limpas);
}

export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return "—";
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}

/** Formata CPF: 11 digitos -> 000.000.000-00. */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** Formata CEI (Cadastro Especifico INSS): 12 digitos -> 00.000.00000/00. */
export function formatCEI(cei: string | null | undefined): string {
  if (!cei) return "—";
  const digits = cei.replace(/\D/g, "");
  if (digits.length !== 12) return cei;
  return digits.replace(/(\d{2})(\d{3})(\d{5})(\d{2})/, "$1.$2.$3/$4");
}

/** Formata CAEPF: 14 digitos -> 000.000.000/000-00. */
export function formatCAEPF(caepf: string | null | undefined): string {
  if (!caepf) return "—";
  const digits = caepf.replace(/\D/g, "");
  if (digits.length !== 14) return caepf;
  return digits.replace(
    /(\d{3})(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}

/** Formata CNO (Cadastro Nacional de Obras): 12 digitos -> 00.000.00000/00. */
export function formatCNO(cno: string | null | undefined): string {
  if (!cno) return "—";
  const digits = cno.replace(/\D/g, "");
  if (digits.length !== 12) return cno;
  return digits.replace(/(\d{2})(\d{3})(\d{5})(\d{2})/, "$1.$2.$3/$4");
}

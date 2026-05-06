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

// Lógica SGG. Listas em ordem crescente de peso (índice = peso).
export const PROBABILIDADES = [
  "Não há exposição",
  "Exposição a níveis baixos",
  "Exposição moderada",
  "Exposição elevada",
  "Exposição elevadíssima",
] as const;

export const SEVERIDADES = [
  "Pouca importância",
  "Preocupantes",
  "Severos",
  "Irreversíveis",
  "Ameaça",
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
  if (score === 0 && iP < 4 && iS < 4) return "Trivial";
  if (
    (score >= 1 && score < 3) ||
    (iP === 4 && iS === 0) ||
    (iP === 0 && iS === 4) ||
    (iP === 3 && iS === 1)
  )
    return "Baixo";
  if ((score > 3 && score <= 8) || (iP === 1 && iS === 3)) return "Moderado";
  if (score > 8 && score <= 12) return "Alto";
  if (score > 12) return "Muito Alto";
  return "Moderado";
}

// Gera ID curto compatível com PRIMARY KEY TEXT.
// Formato: prefixo + timestamp base36 + 4 caracteres aleatórios.
export function gerarId(prefixo = ""): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefixo}${ts}${rnd}`.toUpperCase();
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

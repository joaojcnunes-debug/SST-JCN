import type {
  CategoriaFoto,
  NivelRisco,
  StatusInspecao,
  TipoRisco,
} from "./supabase/types";

export { PROBABILIDADES, SEVERIDADES } from "./utils";

export const TIPOS_RISCO: TipoRisco[] = [
  "Acidente",
  "Ergonômico",
  "Físico",
  "Químico",
  "Biológico",
  "Psicossocial",
  "Ambiental",
];

export const NIVEIS_RISCO: NivelRisco[] = [
  "Trivial",
  "Baixo",
  "Moderado",
  "Alto",
  "Muito Alto",
];

export const NIVEL_CONFIG: Record<
  NivelRisco,
  { cor: string; bg: string; borda: string }
> = {
  Trivial: { cor: "#16a34a", bg: "#dcfce7", borda: "#86efac" },
  Baixo: { cor: "#65a30d", bg: "#ecfccb", borda: "#bef264" },
  Moderado: { cor: "#d97706", bg: "#fef3c7", borda: "#fcd34d" },
  Alto: { cor: "#dc2626", bg: "#fee2e2", borda: "#fca5a5" },
  "Muito Alto": { cor: "#be185d", bg: "#fce7f3", borda: "#f9a8d4" },
};

export const TIPO_ICONE: Record<TipoRisco, string> = {
  Acidente: "⚡",
  Físico: "🌡️",
  Químico: "⚗️",
  Biológico: "🦠",
  Ergonômico: "🏋️",
  Psicossocial: "🧠",
  Ambiental: "🌿",
};

export const STATUS_INSPECAO_CONFIG: Record<
  StatusInspecao,
  { label: string; cor: string; bg: string; borda: string }
> = {
  RASCUNHO: {
    label: "Rascunho",
    cor: "#475569",
    bg: "#f1f5f9",
    borda: "#cbd5e1",
  },
  EM_ANDAMENTO: {
    label: "Em andamento",
    cor: "#92400e",
    bg: "#fef3c7",
    borda: "#fcd34d",
  },
  CONCLUIDA: {
    label: "Concluída",
    cor: "#065f46",
    bg: "#d1fae5",
    borda: "#6ee7b7",
  },
};

export const CATEGORIAS_FOTO: CategoriaFoto[] = [
  "Setor",
  "EPI",
  "EPC",
  "Máquinas e Equipamentos",
  "Produto Químico",
  "Kit de Primeiros Socorros",
  "Extintor",
  "Geral",
];

export const CATEGORIA_FOTO_ICONE: Record<CategoriaFoto, string> = {
  Setor: "🏭",
  EPI: "🪖",
  EPC: "🛡️",
  "Máquinas e Equipamentos": "⚙️",
  "Produto Químico": "🧪",
  "Kit de Primeiros Socorros": "🩹",
  Extintor: "🧯",
  Geral: "📷",
};

export const GRAU_RISCO_CONFIG: Record<
  number,
  { label: string; cor: string; bg: string }
> = {
  1: { label: "Grau 1", cor: "#15803d", bg: "#dcfce7" },
  2: { label: "Grau 2", cor: "#a16207", bg: "#fef9c3" },
  3: { label: "Grau 3", cor: "#c2410c", bg: "#ffedd5" },
  4: { label: "Grau 4", cor: "#b91c1c", bg: "#fee2e2" },
};

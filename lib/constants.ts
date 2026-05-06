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
  "IAPAT Complexidade Laboral",
  "IAPAT Impactos de Alto Risco",
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

// Alias para a spec v2.
export const NIVEL_COR = NIVEL_CONFIG;

export const TIPO_ICONE: Record<TipoRisco, string> = {
  Acidente: "⚡",
  Físico: "🌡️",
  Químico: "⚗️",
  Biológico: "🦠",
  Ergonômico: "🏋️",
  Psicossocial: "🧠",
  Ambiental: "🌿",
  "IAPAT Complexidade Laboral": "📋",
  "IAPAT Impactos de Alto Risco": "⚠️",
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
  DELETADA: {
    label: "Deletada",
    cor: "#991b1b",
    bg: "#fee2e2",
    borda: "#fca5a5",
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

// Listas auxiliares (edição via /config persiste em public.configuracoes).
// Estes valores são fallback caso a tabela esteja vazia.
export const MEIOS_PROPAGACAO_DEFAULT = [
  "Corporal",
  "Contato",
  "Sonora",
  "Respiratório",
  "Cutâneo",
  "Visual",
  "Oral",
];

export const SITUACOES_DEFAULT = [
  "Controlada",
  "Não Controlada",
  "Em Avaliação",
];

export const TEMPOS_EXPOSICAO_DEFAULT = [
  "Ocasional",
  "Intermitente",
  "Permanente",
  "Habitual",
];

export const TECNICAS_DEFAULT = [
  "Qualitativa",
  "Quantitativa",
  "Semi-quantitativa",
];

// Sugestões de agente por tipo (usadas no combobox de RiscoForm).
export const AGENTES_SUGERIDOS: Record<TipoRisco, string[]> = {
  Acidente: [
    "Queda em mesmo nível",
    "Queda de altura",
    "Choque elétrico",
    "Corte/Perfuração",
    "Esmagamento",
    "Projeção de partículas",
  ],
  Físico: [
    "Ruído contínuo",
    "Ruído de impacto",
    "Calor",
    "Frio",
    "Vibração",
    "Radiação não ionizante",
    "Radiação ionizante",
    "Umidade",
    "Pressão atmosférica",
  ],
  Químico: [
    "Poeira",
    "Fumo metálico",
    "Névoa",
    "Neblina",
    "Gases",
    "Vapores orgânicos",
    "Solventes",
    "Produtos químicos em geral",
  ],
  Biológico: [
    "Bactérias",
    "Vírus",
    "Fungos",
    "Parasitas",
    "Bacilos",
    "Sangue/fluidos corpóreos",
  ],
  Ergonômico: [
    "Postura inadequada",
    "Esforço físico intenso",
    "Levantamento de peso",
    "Movimentos repetitivos",
    "Mobiliário inadequado",
    "Iluminação inadequada",
  ],
  Psicossocial: [
    "Sobrecarga de trabalho",
    "Assédio moral",
    "Pressão por produtividade",
    "Conflitos interpessoais",
    "Trabalho monótono",
  ],
  Ambiental: [
    "Resíduos sólidos",
    "Efluentes líquidos",
    "Emissões atmosféricas",
    "Contaminação do solo",
  ],
  "IAPAT Complexidade Laboral": [
    "Demanda cognitiva",
    "Demanda emocional",
    "Demanda física",
  ],
  "IAPAT Impactos de Alto Risco": [
    "Atividade em altura",
    "Espaço confinado",
    "Eletricidade",
    "Trabalho a quente",
  ],
};

// Q1-Q6 — perguntas qualitativas para riscos químicos.
export const PERGUNTAS_QUIMICAS = [
  { id: "quim_q1", texto: "O agente está em sistema fechado?" },
  { id: "quim_q2", texto: "Há ventilação local exaustora adequada?" },
  { id: "quim_q3", texto: "Existem EPCs (enclausuramento, captação)?" },
  { id: "quim_q4", texto: "Trabalhadores têm treinamento sobre o agente?" },
  { id: "quim_q5", texto: "Há monitoramento periódico de exposição?" },
  { id: "quim_q6", texto: "EPIs específicos são fornecidos e utilizados?" },
] as const;

// Fatores ergonômicos sugeridos (select).
export const FATORES_ERGONOMICOS = [
  "Postura inadequada",
  "Levantamento manual de cargas",
  "Movimentos repetitivos",
  "Esforço físico estático",
  "Pressão sobre tecidos",
  "Pega de ferramentas inadequada",
  "Mobiliário inadequado",
  "Iluminação deficiente",
  "Trabalho em pé prolongado",
  "Trabalho sentado prolongado",
];

// Fatores psicossociais sugeridos.
export const FATORES_PSICOSSOCIAIS = [
  "Pressão por metas",
  "Jornada excessiva",
  "Trabalho monótono",
  "Conflitos com chefia",
  "Conflitos entre colegas",
  "Assédio moral",
  "Assédio sexual",
  "Falta de autonomia",
  "Insegurança no emprego",
  "Comunicação deficiente",
];

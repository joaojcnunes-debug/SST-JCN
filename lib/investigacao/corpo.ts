// Silhueta do corpo (imagens do cliente, frente e costas) + marcadores das
// partes atingidas. Imagens em public/silhueta-frente.png e silhueta-costas.png
// (432x578, sem fundo). Marcas = anéis vermelhos clicáveis sobre o corpo.
// Lados E/D na perspectiva do acidentado (direita dele = esquerda de quem olha
// na frente; nas costas os lados se invertem em relação a quem olha).

export type Vista = "frente" | "costas";

export const IMG_W = 432;
export const IMG_H = 578;
export const VIEWBOX = `0 0 ${IMG_W} ${IMG_H}`;
export const SILHUETA_FRENTE = "/silhueta-frente.png";
export const SILHUETA_COSTAS = "/silhueta-costas.png";

export interface Marca {
  parte: string;
  cx: number;
  cy: number;
}

/** Marcas na vista de frente. */
export const MARCAS_FRENTE: Marca[] = [
  { parte: "Cabeça", cx: 216, cy: 46 },
  { parte: "Olhos", cx: 216, cy: 38 },
  { parte: "Pescoço", cx: 216, cy: 104 },
  { parte: "Ombro direito", cx: 162, cy: 128 },
  { parte: "Ombro esquerdo", cx: 270, cy: 128 },
  { parte: "Tórax", cx: 216, cy: 178 },
  { parte: "Abdômen", cx: 216, cy: 246 },
  { parte: "Quadril", cx: 216, cy: 305 },
  { parte: "Braço direito", cx: 132, cy: 236 },
  { parte: "Braço esquerdo", cx: 300, cy: 236 },
  { parte: "Mão direita", cx: 96, cy: 300 },
  { parte: "Mão esquerda", cx: 336, cy: 300 },
  { parte: "Coxa direita", cx: 185, cy: 372 },
  { parte: "Coxa esquerda", cx: 247, cy: 372 },
  { parte: "Joelho direito", cx: 188, cy: 448 },
  { parte: "Joelho esquerdo", cx: 244, cy: 448 },
  { parte: "Perna direita", cx: 190, cy: 505 },
  { parte: "Perna esquerda", cx: 242, cy: 505 },
  { parte: "Pé direito", cx: 197, cy: 560 },
  { parte: "Pé esquerdo", cx: 235, cy: 560 },
];

// Partes que só existem na frente (não vão pras costas).
const SO_FRENTE = new Set(["Olhos", "Tórax", "Abdômen", "Quadril"]);

// Partes exclusivas das costas (posições centrais no tronco/quadril traseiro).
const COSTAS_TRONCO: Marca[] = [
  { parte: "Costas", cx: 216, cy: 175 },
  { parte: "Lombar", cx: 216, cy: 250 },
  { parte: "Glúteos", cx: 216, cy: 300 },
];

/** Marcas na vista de costas: membros/centro espelhados em x + tronco traseiro. */
export const MARCAS_COSTAS: Marca[] = [
  ...MARCAS_FRENTE
    .filter((m) => !SO_FRENTE.has(m.parte))
    .map((m) => ({ parte: m.parte, cx: IMG_W - m.cx, cy: m.cy })),
  ...COSTAS_TRONCO,
];

export function marcasDaVista(v: Vista): Marca[] {
  return v === "frente" ? MARCAS_FRENTE : MARCAS_COSTAS;
}

export function imgDaVista(v: Vista): string {
  return v === "frente" ? SILHUETA_FRENTE : SILHUETA_COSTAS;
}

/** Todas as partes (frente + exclusivas de costas), sem repetir. */
export const PARTES = [
  ...MARCAS_FRENTE.map((m) => m.parte),
  ...COSTAS_TRONCO.map((m) => m.parte),
];

// Raio dos anéis do marcador (escala da imagem 432x578).
export const MARK = { r0: 10, r1: 17, r2: 24 };
export const COR_SEL = "#dc2626";

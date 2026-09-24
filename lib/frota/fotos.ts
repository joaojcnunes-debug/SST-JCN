/**
 * Caminhos e upload das imagens do módulo Frota.
 *
 * TRÊS NÍVEIS, decididos pelo balanço de peso:
 *   thumb  320 px  ≈  35 kB  → a grade da galeria e a lista de veículos
 *   vista 1600 px  ≈ 280 kB  → o que abre ao clicar; mostra risco e amassado
 *   original       ≈ 2,2 MB  → DESCARTADO por padrão (ver PRESERVAR_ORIGINAL)
 *
 * A conta que decidiu: 40 veículos × 30 fotos = 1 200 fotos. Como saiu da
 * câmera dariam ≈ 2,7 GB e a aba abriria baixando 54 MB. Com três níveis a aba
 * abre com ≈ 840 kB (24 miniaturas por página) e o bucket fica em ≈ 378 MB.
 *
 * O GANHO QUE O CONDUTOR SENTE é o upload: a redução acontece NO NAVEGADOR,
 * antes de subir. No 4G do pátio, enviar 315 kB em vez de 2,25 MB é a diferença
 * entre a foto ir na hora e ele achar que o aplicativo travou.
 *
 * Reaproveita `gerarMiniatura` de lib/imagem/redimensionar.ts, que já existe
 * desde a v173 — o `desenharReduzido` interno é genérico em maxPx, então a vista
 * de 1600 px é a mesma função com outro argumento. Zero código de imagem novo.
 */
import { gerarMiniatura } from "@/lib/imagem/redimensionar";
import type { SLUG_ANGULO } from "@/lib/frota/angulos";

/** Bucket já existente, com credencial de escrita no browser. Nenhum novo. */
export const BUCKET = "fotos";

/**
 * Prefixo único do módulo. É o que torna a limpeza um comando só: apagar
 * `fotos/frota/` remove todas as imagens do módulo e nada além delas.
 */
export const PREFIXO = "frota";

export const THUMB_MAX_PX = 320;
export const VISTA_MAX_PX = 1600;

/**
 * Guardar o arquivo como saiu da câmera?
 *
 * `false`: 378 MB contra 3,1 GB no bucket. A vista de 1600 px já mostra risco e
 * amassado de sobra em lataria — diferente da v173, que preservou os originais
 * do inventário porque eram fotos de plaqueta, onde o detalhe legível importa.
 *
 * Virar `true` não muda mais nada: a coluna `original_path` já existe nas três
 * tabelas de foto e aceita nulo.
 */
export const PRESERVAR_ORIGINAL = false;

// ─── Caminhos ───────────────────────────────────────────────────────────────
// SEMPRE por ID, nunca por placa: placa se corrige por digitação errada, o ID
// não muda. Renomear pasta no MinIO por causa de um typo não é operação que se
// queira ter.

export const caminhoCapa = (idVeiculo: string) =>
  `${PREFIXO}/veiculos/${idVeiculo}/capa.jpg`;
export const caminhoCapaThumb = (idVeiculo: string) =>
  `${PREFIXO}/veiculos/${idVeiculo}/capa_thumb.jpg`;

export const caminhoGaleria = (idVeiculo: string, idFoto: string, nivel: NivelImagem) =>
  `${PREFIXO}/veiculos/${idVeiculo}/galeria/${idFoto}_${nivel}.jpg`;

/** Nome do ângulo é fixo no caminho: refazer a frente sobrescreve, não acumula. */
export const caminhoChecklistAngulo = (
  idChecklist: string,
  slug: (typeof SLUG_ANGULO)[keyof typeof SLUG_ANGULO],
  nivel: NivelImagem,
) => `${PREFIXO}/checklists/${idChecklist}/${slug}_${nivel}.jpg`;

export const caminhoChecklistExtra = (idChecklist: string, idFoto: string, nivel: NivelImagem) =>
  `${PREFIXO}/checklists/${idChecklist}/extra/${idFoto}_${nivel}.jpg`;

export const caminhoSinistro = (idSinistro: string, idFoto: string, nivel: NivelImagem) =>
  `${PREFIXO}/sinistros/${idSinistro}/${idFoto}_${nivel}.jpg`;

/** Anexo de abastecimento mantém a extensão original: pode ser PDF. */
export const caminhoAnexo = (idAbastecimento: string, idAnexo: string, ext: string) =>
  `${PREFIXO}/abastecimentos/${idAbastecimento}/${idAnexo}.${ext.replace(/^\./, "")}`;

export type NivelImagem = "thumb" | "vista" | "original";

// ─── Derivados ──────────────────────────────────────────────────────────────

export type ImagemPreparada = {
  thumb: Blob;
  vista: Blob;
  original: File | null;
  largura: number | null;
  altura: number | null;
  bytes: number;
};

/**
 * Gera thumb e vista no navegador. Devolve null quando o arquivo não é imagem
 * legível — o chamador decide o que fazer (no caso do anexo de abastecimento,
 * seguir sem miniatura é o comportamento certo: PDF não tem thumb).
 *
 * A vista sai da mesma `gerarMiniatura` com maxPx maior. Se a vista falhar mas a
 * thumb funcionar, ainda é falha: as duas colunas são NOT NULL na v177, porque
 * galeria sem teto e sem miniatura repete o problema que a v173 acabou de matar.
 */
export async function prepararImagem(file: File): Promise<ImagemPreparada | null> {
  const [thumb, vista] = await Promise.all([
    gerarMiniatura(file, THUMB_MAX_PX),
    gerarMiniatura(file, VISTA_MAX_PX),
  ]);
  if (!thumb || !vista) return null;

  const dim = await dimensoes(file).catch(() => null);
  return {
    thumb,
    vista,
    original: PRESERVAR_ORIGINAL ? file : null,
    largura: dim?.largura ?? null,
    altura: dim?.altura ?? null,
    bytes: vista.size,
  };
}

function dimensoes(file: File): Promise<{ largura: number; altura: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ largura: img.width, altura: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler as dimensões."));
    };
    img.src = url;
  });
}

/** Extensão a partir do nome do arquivo, para o anexo manter o formato. */
export function extensaoDe(nome: string): string {
  const m = /\.([a-zA-Z0-9]{1,6})$/.exec(nome.trim());
  return m ? m[1].toLowerCase() : "bin";
}

/** É imagem? Decide se vale gerar miniatura para o anexo. */
export function ehImagem(mime: string): boolean {
  return mime.startsWith("image/");
}

/**
 * Ícone por tipo de arquivo, para a lista de anexos. PDF não tem miniatura —
 * mostrar um quadrado cinza vazio pareceria foto que não carregou.
 */
export function iconeAnexo(mime: string): string {
  if (ehImagem(mime)) return "🖼️";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "📊";
  return "📎";
}

/** 315000 → "308 kB". Para a lista de anexos mostrar peso legível. */
export function formatarBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Redimensionamento de imagem no NAVEGADOR (usa canvas — não roda no servidor).
 *
 * Nasceu de código duplicado: `resizeAndBase64` existia igual, palavra por
 * palavra, em `components/inventario-maquinas/MaquinaForm.tsx` (removido em
 * 2026-09-14 com o módulo Inventário) e em
 * `components/inspecoes/editor/tabs/MaquinasTab.tsx`, e nos dois lugares servia
 * só para baratear o envio da foto à IA — nunca no upload de verdade.
 *
 * O upload continuava gravando o arquivo como saiu da câmera: 121 fotos, média
 * de 2,25 MB, as maiores em 6 MB, 272 MB no total — tudo baixado em resolução
 * plena para desenhar miniaturas de 64x64 px na lista do inventário.
 *
 * Daí as duas exportações:
 *   • redimensionarParaBase64 — o que já existia, agora num lugar só;
 *   • gerarMiniatura         — o derivado pequeno que a lista passa a consumir.
 */

/** Lado maior da miniatura, em pixels. A lista desenha em 64px; 320 cobre telas
 *  retina e o card maior sem virar peso. */
export const MINIATURA_MAX_PX = 320;

/** Qualidade JPEG da miniatura. Abaixo de 0,7 aparece artefato em foto de
 *  plaqueta metálica, que é o caso comum aqui. */
const MINIATURA_QUALIDADE = 0.75;

/**
 * Teto de espera pela decodificação.
 *
 * `onload` e `onerror` são as duas únicas saídas desta promessa — e existe caso
 * em que NENHUM DOS DOIS chega: arquivo escolhido na galeria que o aparelho
 * ainda está trazendo da nuvem, decodificador que engasga sem sinalizar erro.
 * Sem este teto a promessa fica pendurada para sempre, e quem espera por ela
 * (o botão "Salvando…") gira sem fim e sem explicação nenhuma.
 */
const TIMEOUT_DECODIFICAR_MS = 20_000;

/**
 * Desenha o arquivo num canvas reduzido, preservando a proporção.
 * Nunca AMPLIA: `Math.min(1, ...)` garante que imagem menor que `maxPx` passa
 * intacta em dimensão (só é recodificada).
 */
async function desenharReduzido(file: File | Blob, maxPx: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    // Três caminhos disputam esta promessa (carregou, falhou, demorou). O
    // primeiro a chegar fecha a porta: sem isto, o cronômetro revogaria a URL
    // debaixo de um `onload` que ainda vinha.
    let fechado = false;
    const chegouPrimeiro = (): boolean => {
      if (fechado) return false;
      fechado = true;
      clearTimeout(cronometro);
      URL.revokeObjectURL(url);
      return true;
    };
    const cronometro = setTimeout(() => {
      if (!chegouPrimeiro()) return;
      img.src = "";
      reject(new Error("A leitura da imagem demorou demais."));
    }, TIMEOUT_DECODIFICAR_MS);

    img.onload = () => {
      if (!chegouPrimeiro()) return;
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      // Dimensão zero acontece quando o decodificador desiste da imagem mas
      // dispara `onload` assim mesmo. Canvas 0x0 devolve blob nulo lá na frente,
      // e aí a causa já se perdeu — melhor recusar aqui, com nome.
      if (w === 0 || h === 0) {
        reject(new Error("Não foi possível ler a imagem."));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D indisponível neste navegador."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => {
      if (!chegouPrimeiro()) return;
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

/**
 * Redimensiona e converte para base64 SEM o prefixo `data:` — o formato que as
 * rotas de análise por IA esperam.
 *
 * Comportamento idêntico ao `resizeAndBase64` que existia duplicado: mesmo
 * `maxPx` padrão (1024) e mesma qualidade (0,85). Trocar qualquer um dos dois
 * muda o custo em tokens das chamadas de IA — não é só estética.
 */
export async function redimensionarParaBase64(file: File, maxPx = 1024): Promise<string> {
  const canvas = await desenharReduzido(file, maxPx);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.split(",")[1];
}

/**
 * Gera a miniatura de listagem. Sempre JPEG, mesmo que a original seja PNG:
 * transparência não faz falta em foto de equipamento e PNG de foto sai várias
 * vezes maior.
 *
 * Devolve `null` quando o arquivo não é imagem legível — o chamador segue com o
 * upload da original, porque ficar sem miniatura é degradação, não erro.
 */
export async function gerarMiniatura(
  file: File | Blob,
  maxPx = MINIATURA_MAX_PX
): Promise<Blob | null> {
  try {
    const canvas = await desenharReduzido(file, maxPx);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", MINIATURA_QUALIDADE)
    );
  } catch {
    return null;
  }
}

/**
 * Lado maior da foto que VAI PARA O STORAGE.
 *
 * Maior que a vista de 1600 px da Frota de propósito: aqui a foto é de
 * patrimônio, e é comum o número da plaqueta aparecer nela — 2048 px mantém a
 * plaqueta legível ao abrir o detalhe. Ainda assim o arquivo fica em centenas
 * de kB, contra os 8 a 20 MB que um celular de hoje produz.
 */
export const ENVIO_MAX_PX = 2048;

/** Um degrau acima da miniatura: esta imagem é a que a pessoa abre para olhar. */
const ENVIO_QUALIDADE = 0.85;

/**
 * Reduz a foto ANTES de subir. Devolve `null` quando não vale a pena ou não dá.
 *
 * POR QUE ISTO EXISTE — o mesmo motivo escrito em `lib/frota/fotos.ts`: "no 4G
 * do pátio, enviar 315 kB em vez de 2,25 MB é a diferença entre a foto ir na
 * hora e ele achar que o aplicativo travou". A diferença é que lá a redução
 * nasceu com o módulo, e aqui ela chega depois — o /equipamentos subia o arquivo
 * como saiu da câmera e recusava de saída tudo acima de 10 MB.
 *
 * `null` em três situações, todas com a mesma resposta do chamador (seguir com o
 * arquivo original):
 *   • o navegador não decodifica o formato (HEIC do iPhone é o caso real);
 *   • o canvas não devolveu blob;
 *   • a redução saiu MAIOR que o original — foto já pequena, ou PNG de tela onde
 *     recodificar para JPEG não compensa. Trocar por algo maior seria piorar.
 */
export async function reduzirParaEnvio(
  file: File | Blob,
  maxPx = ENVIO_MAX_PX
): Promise<Blob | null> {
  try {
    const canvas = await desenharReduzido(file, maxPx);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", ENVIO_QUALIDADE)
    );
    if (!blob) return null;
    return blob.size < file.size ? blob : null;
  } catch {
    return null;
  }
}

// Captura de digital NO NAVEGADOR via o agente local DpHost (o mesmo do SGG), usando o
// SDK web da DigitalPersona carregado como <script> (evita o webpack — gotcha do WebSdk).
// Ordem obrigatória: WebSdk → dp.core → dp.devices. Captura imagem PNG (p/ o matcher).

export interface CapturaResult { ok: boolean; imagem?: string; qualidade?: string; erro?: string }

const VENDORS = [
  "/vendor/websdk.client.ui.min.js",
  "/vendor/dp.core.min.js",
  "/vendor/dp.devices.min.js",
];

let carregado: Promise<void> | null = null;
function carregarSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Sem navegador."));
  if (carregado) return carregado;
  carregado = (async () => {
    for (const src of VENDORS) {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[data-dp="${src}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = src; s.async = false; s.defer = false; s.dataset.dp = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
        document.head.appendChild(s);
      });
    }
  })();
  return carregado;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function devicesApi(): any {
  const dp = (window as any).dp;
  if (!dp?.devices?.FingerprintReader) throw new Error("SDK de digital não disponível.");
  return dp.devices;
}

/** Há SDK + (tentativa de) agente? Só confirma que o SDK carregou. */
export async function sdkWebDisponivel(): Promise<boolean> {
  try { await carregarSdk(); return !!(window as any).dp?.devices?.FingerprintReader; } catch { return false; }
}

/** Captura uma digital (imagem PNG base64). Encoste o dedo até ~timeout. */
export async function capturarDigitalWeb(timeoutMs = 20000): Promise<CapturaResult> {
  try {
    await carregarSdk();
    const devices = devicesApi();
    const reader = new devices.FingerprintReader();
    return await new Promise<CapturaResult>((resolve) => {
      let done = false;
      const finish = (r: CapturaResult) => {
        if (done) return; done = true;
        try { reader.stopAcquisition(); } catch { /* noop */ }
        resolve(r);
      };
      const timer = setTimeout(() => finish({ ok: false, erro: "Tempo esgotado — encoste o dedo no leitor." }), timeoutMs);

      reader.on("SamplesAcquired", (ev: any) => {
        clearTimeout(timer);
        let img = "";
        try {
          const raw = ev?.samples ?? ev?.sampleData ?? "";
          const parsed = typeof raw === "string" && raw.trim().startsWith("[") ? JSON.parse(raw) : raw;
          img = Array.isArray(parsed) ? String(parsed[0] ?? "") : String(parsed ?? "");
        } catch { img = String(ev?.samples ?? ev?.sampleData ?? ""); }
        // o SDK usa base64url → normaliza p/ base64 padrão
        img = img.replace(/-/g, "+").replace(/_/g, "/");
        if (!img) return finish({ ok: false, erro: "Amostra vazia." });
        finish({ ok: true, imagem: img });
      });
      reader.on("QualityReported", (ev: any) => { void ev; });
      reader.on("ErrorOccurred", (ev: any) => { clearTimeout(timer); finish({ ok: false, erro: "Erro no leitor: " + (ev?.error ?? "desconhecido") }); });
      reader.on("CommunicationFailed", () => { clearTimeout(timer); finish({ ok: false, erro: "Sem comunicação com o agente (DpHost). Verifique se o leitor e o agente da DigitalPersona estão ativos." }); });

      Promise.resolve(reader.startAcquisition(devices.SampleFormat.PngImage))
        .catch((e: any) => { clearTimeout(timer); finish({ ok: false, erro: "Não foi possível iniciar a captura: " + (e?.message ?? e) }); });
    });
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha na captura." };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─────────────────────────────────────────────────────────────────────────────
 * Diagnóstico do caminho até o leitor.
 *
 * Existe por um motivo medido: em 2026-08-27 o leitor ficou inalcançável e o
 * sintoma foi "Tempo esgotado — encoste o dedo no leitor", que manda a pessoa
 * fazer exatamente a coisa errada. A causa era a permissão **Local Network
 * Access** do Chrome 138+: origem pública falando com 127.0.0.1 exige permissão
 * de site, e em aba de segundo plano o pedido nunca aparece — a requisição fica
 * pendurada para sempre, sem erro, sem log, sem console.
 *
 * Por isso: consultar a permissão ANTES de capturar, e toda chamada ao agente
 * com timeout. Sem timeout, o estado natural da falha é travar a tela em silêncio.
 * ────────────────────────────────────────────────────────────────────────────*/

export type EstadoLeitor = "ok" | "sem-permissao" | "sem-agente" | "sem-sdk";

export interface DiagnosticoLeitor {
  estado: EstadoLeitor;
  /** Texto pronto para a tela — diz o que fazer, não o que aconteceu. */
  mensagem: string;
}

const AGENTE = "https://127.0.0.1:52181/get_connection";

export async function diagnosticarLeitor(timeoutMs = 6000): Promise<DiagnosticoLeitor> {
  // 1) A permissão de rede local, quando o navegador expõe a consulta.
  try {
    const perm = await (
      navigator.permissions as unknown as {
        query(d: { name: string }): Promise<{ state: string }>;
      }
    ).query({ name: "local-network-access" });
    if (perm.state === "denied") {
      return {
        estado: "sem-permissao",
        mensagem:
          "O navegador está bloqueando o acesso à rede local. Abra o cadeado na barra de endereços, " +
          "ligue “Acesso à rede local” e recarregue a página.",
      };
    }
  } catch {
    /* navegador sem essa permissão (ou anterior ao Chrome 138): segue para a sonda */
  }

  // 2) O agente responde? Com timeout — pendurar é o modo de falha real.
  let respondeu = false;
  try {
    await Promise.race([
      fetch(AGENTE, { cache: "no-store" }).then(() => {
        respondeu = true;
      }),
      new Promise<void>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
  } catch {
    respondeu = false;
  }
  if (!respondeu) {
    return {
      estado: "sem-permissao",
      mensagem:
        "Não consegui falar com o leitor. Quase sempre é a permissão de rede local do navegador: " +
        "clique no botão de captura com esta aba em primeiro plano e responda “Permitir”. " +
        "Se não aparecer pedido nenhum, confira se o serviço DigitalPersona está rodando nesta máquina.",
    };
  }

  // 3) O SDK carregou e enxerga um leitor?
  if (!(await sdkWebDisponivel())) {
    return { estado: "sem-sdk", mensagem: "O componente de leitura não carregou. Recarregue a página." };
  }
  try {
    const devices = devicesApiPublica();
    const lista = await Promise.race([
      new devices.FingerprintReader().enumerateDevices(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    if (!lista || (lista as unknown[]).length === 0) {
      return { estado: "sem-agente", mensagem: "Nenhum leitor conectado. Ligue o leitor na USB e tente de novo." };
    }
  } catch {
    return { estado: "sem-agente", mensagem: "O leitor não respondeu. Desconecte e reconecte o cabo USB." };
  }

  return { estado: "ok", mensagem: "Leitor pronto." };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function devicesApiPublica(): any {
  const dp = (window as any).dp;
  if (!dp?.devices?.FingerprintReader) throw new Error("SDK de digital não disponível.");
  return dp.devices;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

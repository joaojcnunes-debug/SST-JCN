// Wrapper do leitor biométrico HID DigitalPersona (U.are.U 4500) para captura no
// navegador. Fala com o "HID Authentication Device Client" (ex-Lite Client) via
// o SDK @digitalpersona/devices — que precisa estar instalado na máquina Windows.
//
// PRINCÍPIO LGPD: a amostra é capturada, transformada em HASH e DESCARTADA. Não
// guardamos imagem nem template — só o hash como token de integridade do ato.
//
// Tudo aqui é client-only e à prova de ausência do SDK/agente: se o leitor ou o
// cliente não estiverem disponíveis, as funções degradam (retornam false/erro)
// e a UI cai para a assinatura desenhada.

export interface CapturaDigital {
  /** SHA-256 (hex) da amostra — a biometria em si é descartada. */
  fingerHash: string;
  /** UID/modelo do leitor usado. */
  device: string;
  /** Qualidade reportada pelo leitor (quando disponível). */
  qualidade: string | null;
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Detecta se há agente + leitor disponíveis (sem capturar). */
export async function leitorDisponivel(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // Electron desktop: helper nativo DPUruNet (funciona com o RTE do SGG, em
  // modo exclusivo — o SDK web cooperativo não recebe o toque nessas máquinas).
  const api = window.electronAPI;
  if (api?.epiLeitorCheck) {
    try {
      const r = await api.epiLeitorCheck();
      return !!r?.ok && (r.count ?? 0) > 0;
    } catch {
      return false;
    }
  }
  // Navegador: SDK web (@digitalpersona/devices) via agente local.
  try {
    const dp = await import("@digitalpersona/devices");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reader = new (dp as any).FingerprintReader();
    const devices: string[] = await reader.enumerateDevices();
    try {
      reader.off?.();
    } catch {
      /* ignora */
    }
    return Array.isArray(devices) && devices.length > 0;
  } catch {
    return false;
  }
}

/**
 * Captura UMA leitura da digital, retorna o hash e descarta a amostra.
 * Rejeita se não houver leitor/agente, em erro do dispositivo ou por timeout.
 */
export async function capturarDigital(
  opts?: { onQualidade?: (q: string) => void; timeoutMs?: number },
): Promise<CapturaDigital> {
  if (typeof window === "undefined") throw new Error("Indisponível no servidor");

  // Electron desktop: captura pelo helper nativo (retorna só o hash; a
  // biometria é descartada no próprio helper).
  const api = window.electronAPI;
  if (api?.epiLerDigital) {
    const r = await api.epiLerDigital();
    if (!r?.ok || !r.fingerHash) {
      throw new Error(r?.error || "Falha ao ler a digital.");
    }
    return {
      fingerHash: r.fingerHash,
      device: r.device ?? "U.are.U",
      qualidade: r.quality ?? null,
    };
  }

  const dp = await import("@digitalpersona/devices");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const D = dp as any;
  const reader = new D.FingerprintReader();

  const devices: string[] = await reader.enumerateDevices();
  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error("Nenhum leitor de digital detectado.");
  }
  const device = devices[0];

  // Formato "Intermediate" (feature set), não a imagem — e ainda assim descartado.
  const formato = D.SampleFormat?.Intermediate ?? 1;

  return await new Promise<CapturaDigital>((resolve, reject) => {
    let finalizado = false;
    const timeout = window.setTimeout(() => {
      finalizar();
      reject(new Error("Tempo esgotado — encoste o dedo no leitor e tente de novo."));
    }, opts?.timeoutMs ?? 30_000);

    function finalizar() {
      if (finalizado) return;
      finalizado = true;
      window.clearTimeout(timeout);
      try {
        reader.onSamplesAcquired = undefined;
        reader.onQualityReported = undefined;
        reader.onErrorOccurred = undefined;
        reader.onDeviceDisconnected = undefined;
        reader.stopAcquisition?.().catch(() => {});
      } catch {
        /* ignora limpeza */
      }
    }

    reader.onQualityReported = (e: { quality?: unknown }) => {
      if (e?.quality != null) opts?.onQualidade?.(String(e.quality));
    };
    reader.onErrorOccurred = (e: { error?: unknown }) => {
      finalizar();
      reject(new Error("Falha na leitura da digital: " + String(e?.error ?? "")));
    };
    reader.onDeviceDisconnected = () => {
      finalizar();
      reject(new Error("Leitor desconectado durante a captura."));
    };
    reader.onSamplesAcquired = async (e: { samples?: unknown }) => {
      try {
        // Serializa a amostra só para hashear; nada é persistido.
        const bruto = typeof e?.samples === "string" ? e.samples : JSON.stringify(e?.samples ?? "");
        const fingerHash = await sha256Hex(bruto + "|" + device);
        finalizar();
        resolve({ fingerHash, device: String(device), qualidade: null });
      } catch (err) {
        finalizar();
        reject(err instanceof Error ? err : new Error("Erro ao processar a digital"));
      }
    };

    reader.startAcquisition(formato).catch((err: unknown) => {
      finalizar();
      reject(err instanceof Error ? err : new Error("Não foi possível iniciar o leitor."));
    });
  });
}

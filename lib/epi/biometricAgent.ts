// Cliente do companion local de biometria (EpiBiometricAgent) — captura e
// COMPARA digitais usando o RTE DigitalPersona da máquina. Roda em
// http://127.0.0.1:52182. O site https fala com ele via CORS + Private Network
// Access. Se o agente não estiver rodando, todas as chamadas degradam.

const AGENT = "http://127.0.0.1:52182";

export interface AgentCapture {
  template: string; // base64 do FMD serializado (armazenar no cadastro)
  quality: string | null;
  device: string | null;
}

export interface AgentVerify {
  match: boolean;
  score: number;
  threshold: number;
  finger_hash: string | null;
  quality: string | null;
  device: string | null;
}

/** O companion está rodando e há leitor? (não captura) */
export async function agentDisponivel(): Promise<boolean> {
  try {
    const r = await fetch(`${AGENT}/status`, { method: "GET", cache: "no-store" });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j?.ok && (j.count ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Captura uma digital e devolve o TEMPLATE (para cadastro/enroll). */
export async function capturarTemplate(): Promise<AgentCapture> {
  const r = await fetch(`${AGENT}/capturar`, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  if (!j?.ok || !j.template) {
    throw new Error(j?.error || "Falha ao capturar a digital.");
  }
  return { template: j.template, quality: j.quality ?? null, device: j.device ?? null };
}

/** Captura uma AMOSTRA de pré-registro (DP_PRE_REGISTRATION) para o enrollment 4×. */
export async function capturarPreTemplate(): Promise<AgentCapture> {
  const r = await fetch(`${AGENT}/capturar-pre`, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  if (!j?.ok || !j.template) {
    throw new Error(j?.error || "Falha ao capturar a digital.");
  }
  return { template: j.template, quality: j.quality ?? null, device: j.device ?? null };
}

/** Combina várias capturas (pré-enrollment) num template de enrollment melhor. */
export async function combinarTemplates(templates: string[]): Promise<string> {
  const r = await fetch(`${AGENT}/combinar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templates }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.ok || !j.template) {
    throw new Error(j?.error || "Falha ao combinar as capturas.");
  }
  return j.template as string;
}

/** Captura uma digital e COMPARA com o template cadastrado (verificação 1:1). */
export async function verificarDigital(template: string): Promise<AgentVerify> {
  const r = await fetch(`${AGENT}/verificar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) throw new Error(j?.error || "Falha na verificação da digital.");
  return {
    match: !!j.match,
    score: Number(j.score),
    threshold: Number(j.threshold),
    finger_hash: j.finger_hash ?? null,
    quality: j.quality ?? null,
    device: j.device ?? null,
  };
}

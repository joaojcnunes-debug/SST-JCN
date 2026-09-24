import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const SOCK = process.env.SGG_WEBHOOK_SOCKET ?? "/run/chabra-sgg/sgg-webhook.sock";
const TIMEOUT_MS = 30000;   // o servico usa 20 s no POST ao SGG + sonda

export type RespostaWebhook = {
  ok: boolean;
  resultado: "sucesso" | "duplicado" | "erro_catalogo" | "erro_criterio" | "erro" | "indeterminado" | "indisponivel" | "erro_config";
  sgg_id?: string | null; codigo?: string; msg?: string; erro?: string;
};

export function novoIdEnvio(): string {
  return "SGE-" + randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function enviarAoWebhook(args: {
  id_envio: string; base: string; payload: Record<string, unknown>;
}): Promise<RespostaWebhook> {
  const segredo = process.env.SGG_WEBHOOK_HMAC_SECRET;
  if (!segredo) return { ok: false, resultado: "erro_config", msg: "HMAC não configurado" };
  const ts = String(Math.floor(Date.now() / 1000));
  const corpo = Buffer.from(JSON.stringify({ ...args, ts: Number(ts) }), "utf8");
  const assinatura = "sha256=" + createHmac("sha256", segredo).update(ts + ".").update(corpo).digest("hex");

  return new Promise((resolve) => {
    const req = http.request(
      { socketPath: SOCK, path: "/enviar-riscos", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": corpo.length,
                   "X-Chabra-Signature": assinatura, "X-Chabra-Timestamp": ts } },
      (res) => {
        const pedacos: Buffer[] = [];
        res.on("data", (c) => pedacos.push(c));
        res.on("end", () => {
          try { resolve(JSON.parse(Buffer.concat(pedacos).toString("utf8")) as RespostaWebhook); }
          catch { resolve({ ok: false, resultado: "erro", codigo: "PARSE", msg: `HTTP ${res.statusCode}` }); }
        });
      },
    );
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(new Error("timeout")); });
    // Falha no transporte NAO e "erro": os bytes podem ter saido e o SGG nao tem DELETE.
    req.on("error", (e) => resolve({ ok: false, resultado: "indeterminado", sgg_id: null, msg: e.message }));
    req.end(corpo);
  });
}

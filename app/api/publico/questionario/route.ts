import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ESCALA, tokenValido, validarEnvio } from "@/lib/qps/triagem-anonima";

export const dynamic = "force-dynamic";

/**
 * Questionário ANÔNIMO da AEP por QR Code (v273/v274, 2026-10-06). PÚBLICO,
 * guardado pelo token da coleta (256 bits). Liberado no middleware
 * (`/api/publico/`).
 *   GET  ?token=…                         → perguntas do setor
 *   POST { token, respostas, comentario } → grava UMA resposta anônima
 *
 * Sem service role (a produção não tem a chave, e não precisa): usa a chave
 * pública e as duas únicas portas do banco, `qps_questionario_publico` e
 * `qps_responder_anonimo` (SECURITY DEFINER), que validam token, validade,
 * teto e respostas lá dentro. A tabela de respostas segue fechada e
 * append-only; o banco grava só a data (sem IP, user-agent nem horário).
 * O limite por IP abaixo vive só na memória da instância e nunca é gravado.
 */

const sem = { "Cache-Control": "no-store" };

function erro(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status, headers: sem });
}

function cliente() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Limite de envios por IP e token: 5 a cada 10 minutos (só em memória).
const JANELA_MS = 10 * 60 * 1000;
const MAX_ENVIOS = 5;
const envios = new Map<string, number[]>();
function excedeuLimite(chave: string): boolean {
  const agora = Date.now();
  const lista = (envios.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length >= MAX_ENVIOS) {
    envios.set(chave, lista);
    return true;
  }
  lista.push(agora);
  envios.set(chave, lista);
  if (envios.size > 5000) envios.clear(); // memória limitada
  return false;
}

interface Publico {
  setor: string;
  situacao: "aberta" | "encerrada" | "expirada" | "cheia";
  instrucoes: string | null;
  perguntas: { id: string; texto: string }[];
}

async function carregar(token: string): Promise<Publico | null> {
  const { data, error } = await cliente().rpc("qps_questionario_publico", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as Publico | null) ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!tokenValido(token)) return erro("Link inválido.", 404);
    const c = await carregar(token);
    if (!c) return erro("Link inválido.", 404);
    return NextResponse.json(
      { setor: c.setor, situacao: c.situacao, instrucoes: c.instrucoes ?? "", perguntas: c.perguntas, escala: ESCALA },
      { headers: sem },
    );
  } catch (e) {
    console.error("[api/publico/questionario GET]", e instanceof Error ? e.message : e);
    return erro("Não foi possível abrir o questionário agora. Tente de novo.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const token = body?.token;
    if (!tokenValido(token)) return erro("Link inválido.", 404);

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
    if (excedeuLimite(`${token}:${ip}`)) return erro("Muitos envios seguidos. Tente de novo mais tarde.", 429);

    const c = await carregar(token);
    if (!c) return erro("Link inválido.", 404);
    if (c.situacao !== "aberta") return erro("Este questionário não está mais recebendo respostas.", 410);

    // Validação também aqui (mensagem amigável); o banco valida de novo.
    const v = validarEnvio(body, c.perguntas.map((p) => p.id));
    if (!v.ok) return erro(v.erro, 400);

    const { data, error } = await cliente().rpc("qps_responder_anonimo", {
      p_token: token,
      p_respostas: v.respostas,
      p_comentario: v.comentario,
    });
    if (error) throw new Error(error.message);
    if (data === "ok") return NextResponse.json({ ok: true }, { headers: sem });
    if (data === "fechado") return erro("Este questionário não está mais recebendo respostas.", 410);
    if (data === "incompleto") return erro("Responda todas as afirmações.", 400);
    return erro("Link inválido.", 404);
  } catch (e) {
    console.error("[api/publico/questionario POST]", e instanceof Error ? e.message : e);
    return erro("Não foi possível registrar a resposta. Tente de novo.", 500);
  }
}

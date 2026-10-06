import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/client";
import {
  ESCALA,
  FATOR_POR_CATEGORIA,
  ID_TIPO_TRIAGEM,
  situacaoColeta,
  tokenValido,
  validarEnvio,
} from "@/lib/qps/triagem-anonima";

export const dynamic = "force-dynamic";

/**
 * Questionário ANÔNIMO da AEP por QR Code (v273, 2026-10-06). PÚBLICO,
 * guardado pelo token da coleta (256 bits). Liberado no middleware
 * (`/api/publico/`).
 *   GET  ?token=…                         → perguntas do setor
 *   POST { token, respostas, comentario } → grava UMA resposta anônima
 *
 * Anonimato: não grava IP, user-agent nem horário (o banco põe só a data);
 * a resposta vai para `qps_respostas_anonimas`, que o cliente não lê nem
 * altera (append-only, sem policy). O limite por IP abaixo vive só na
 * memória da instância e nunca é gravado.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

const sem = { "Cache-Control": "no-store" };

function erro(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status, headers: sem });
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

async function carregar(sb: Sb, token: string) {
  const { data: coleta } = await sb
    .from("qps_coletas_anonimas")
    .select("id_coleta, setor, expira_em, ativo, max_respostas")
    .eq("token", token)
    .maybeSingle();
  if (!coleta) return null;
  const { count } = await sb
    .from("qps_respostas_anonimas")
    .select("id", { count: "exact", head: true })
    .eq("id_coleta", coleta.id_coleta);
  const { data: tipo } = await sb.from("qps_tipos").select("instrucoes").eq("id_tipo", ID_TIPO_TRIAGEM).maybeSingle();
  const { data: perguntas } = await sb
    .from("qps_perguntas")
    .select("id_pergunta, texto, ordem, ativo, id_categoria, qps_categorias!inner(ordem, id_tipo)")
    .eq("qps_categorias.id_tipo", ID_TIPO_TRIAGEM)
    .eq("ativo", true);
  const lista = ((perguntas ?? []) as { id_pergunta: string; texto: string; ordem: number; id_categoria: string; qps_categorias: { ordem: number } }[])
    .filter((p) => FATOR_POR_CATEGORIA[p.id_categoria])
    .sort((a, b) => a.qps_categorias.ordem - b.qps_categorias.ordem || a.ordem - b.ordem)
    .map((p) => ({ id: p.id_pergunta, texto: p.texto }));
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    coleta,
    situacao: situacaoColeta(coleta, hoje, count ?? 0),
    instrucoes: (tipo?.instrucoes as string) ?? "",
    perguntas: lista,
  };
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!tokenValido(token)) return erro("Link inválido.", 404);
  const sb = createSupabaseServiceClient({ email: null, origem: "questionario-anonimo" }) as Sb;
  const c = await carregar(sb, token);
  if (!c) return erro("Link inválido.", 404);
  return NextResponse.json(
    { setor: c.coleta.setor, situacao: c.situacao, instrucoes: c.instrucoes, perguntas: c.perguntas, escala: ESCALA },
    { headers: sem },
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = body?.token;
  if (!tokenValido(token)) return erro("Link inválido.", 404);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
  if (excedeuLimite(`${token}:${ip}`)) return erro("Muitos envios seguidos. Tente de novo mais tarde.", 429);

  const sb = createSupabaseServiceClient({ email: null, origem: "questionario-anonimo" }) as Sb;
  const c = await carregar(sb, token);
  if (!c) return erro("Link inválido.", 404);
  if (c.situacao !== "aberta") return erro("Este questionário não está mais recebendo respostas.", 410);

  const v = validarEnvio(body, c.perguntas.map((p) => p.id));
  if (!v.ok) return erro(v.erro, 400);

  // Só respostas e comentário: a data vem do default do banco (sem horário).
  const { error } = await sb
    .from("qps_respostas_anonimas")
    .insert({ id_coleta: c.coleta.id_coleta, respostas: v.respostas, comentario: v.comentario });
  if (error) return erro("Não foi possível registrar a resposta. Tente de novo.", 500);
  return NextResponse.json({ ok: true }, { headers: sem });
}

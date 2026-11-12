// Edge Function — IA da Gestão (Groq, modelos com fallback).
// Ações:
//   "subtarefas" → { data: { subtarefas: string[] } }              Body: { acao, titulo, descricao? }
//   "descricao"  → { data: { descricao: string } }                 Body: { acao, titulo, descricao? }
//   "checklist"  → { data: { checklist: string[] } }               Body: { acao, titulo, descricao?, existentes? }
//   "resumo"     → { data: { resumo, usados, total } }             Body: { acao, id_tarefa }
// "checklist" e "resumo" vieram do Painel 0.3.925 (JCN 0.3.275). No resumo a função busca a tarefa e os comentários
// COM O LOGIN DA PESSOA (o cabeçalho Authorization dela): só resume o que ela já vê pela RLS. O JCN não tem tarefa
// sigilosa (gestao_tarefa_restrita do Painel), então não há essa recusa aqui.
// JWT validado (invocada por usuário logado).
//
// DEPLOY: supabase functions deploy gestao-ia   (usa o segredo GROQ_API_KEY já configurado)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// 0.3.287 (= Painel 0.3.963): a imagem fica DENTRO da descrição como ![nome](anexo:<uuid>) — a IA recebe "[imagem]"
// no lugar (o mesmo de textoSemImagens em lib/gestao/descricao-imagens.ts).
const TOKEN_IMAGEM = /!\[([^\]\n]*)\]\(anexo:([0-9a-fA-F-]{36})\)/g;
const textoSemImagens = (t: string | null | undefined) => (t ?? "").replace(TOKEN_IMAGEM, "[imagem]");
// Em ordem de preferência. O Groq retira modelos do ar sem aviso (o
// llama-3.1-8b-instant sumiu em 2026-10 e a função passou a dar 502): se um
// modelo não existir mais, tenta o próximo.
const MODELOS = [
  // Conferidos no /models do Groq em 05/11/2026; os demais da lista antiga saíram do ar.
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
/** Recusa já escrita para a pessoa: o `codigo` faz o mensagemErro da tela mostrar o texto como está (lib/errors.ts). */
function aviso(msg: string, status: number) {
  return json({ error: msg, codigo: "mensagem_usuario" }, status);
}

const PROMPT_SUBTAREFAS = `Você ajuda equipes a planejar tarefas. A partir do título (e descrição, se houver) de uma tarefa, gere de 3 a 7 subtarefas objetivas e acionáveis — passos concretos para concluí-la.
Responda APENAS com JSON válido, sem markdown: {"subtarefas": ["...", "..."]}.
Regras: português do Brasil; cada item curto (até ~10 palavras); verbo no infinitivo; sem numeração; não invente dados específicos (nomes, valores) que não foram dados.`;

const PROMPT_DESCRICAO = `Você ajuda a redigir descrições de tarefas. A partir do título (e de uma descrição parcial, se houver), escreva uma descrição clara e objetiva.
Responda APENAS com JSON válido, sem markdown: {"descricao": "..."}.
Regras: português do Brasil; 2 a 4 frases; explique o objetivo e o que precisa ser feito; tom profissional; não invente dados específicos não fornecidos.`;

const PROMPT_CHECKLIST = `Você ajuda equipes de uma empresa de Segurança e Medicina do Trabalho a montar checklists. A partir do título (e da descrição, se houver) de uma tarefa, gere de 3 a 8 itens de checklist: verificações ou entregas que se marcam como feitas antes de concluir a tarefa.
Responda APENAS com JSON válido, sem markdown: {"checklist": ["...", "..."]}.
Regras: português do Brasil; itens curtos (até ~8 palavras); sem numeração; não repita o título nem os itens que já existem; não invente dados específicos (nomes, datas, valores) que não foram dados.`;

const PROMPT_RESUMO = `Você resume a conversa (comentários) de uma tarefa de uma empresa de Segurança e Medicina do Trabalho, para quem vai pegar a tarefa agora.
Responda APENAS com JSON válido, sem markdown: {"situacao": "...", "decisoes": ["..."], "pendencias": ["..."], "proximo_passo": "..."}.
Regras: português do Brasil; "situacao": 1 a 2 frases dizendo onde a tarefa está agora; "decisoes": o que já foi combinado ou resolvido (até 5 itens curtos); "pendencias": o que ainda falta e com quem está, com o nome quando a conversa disser (até 5 itens curtos); "proximo_passo": uma frase. Use só o que está escrito — não invente datas, valores, nomes ou números de documento; se algo não estiver claro, diga que não está claro. Não copie CPF, telefones, e-mails nem dados de saúde de pessoas.`;

// ── Cópia de lib/gestao/ia-resumo.ts (testada lá). Mudou lá, mude aqui. ──
interface ComentarioIa { autor: string | null; texto: string | null; created_at: string }
const MIN_COMENTARIOS_RESUMO = 3;
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function montarConversa(cs: ComentarioIa[], limite = 14_000): { texto: string; usados: number; total: number } {
  const ord = [...cs].filter((c) => (c.texto ?? "").trim()).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const linhas: string[] = [];
  let tam = 0;
  for (let i = ord.length - 1; i >= 0; i--) {
    const c = ord[i];
    const autor = !c.autor ? "Alguém" : c.autor === "automacao" ? "Automação" : c.autor;
    const linha = `${quando(c.created_at)} · ${autor}: ${(c.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 2_000)}`;
    if (linhas.length > 0 && tam + linha.length + 1 > limite) break;
    linhas.unshift(linha);
    tam += linha.length + 1;
  }
  const fora = ord.length - linhas.length;
  if (fora > 0) linhas.unshift(fora === 1 ? "(1 comentário mais antigo não entrou no resumo)" : `(${fora} comentários mais antigos não entraram no resumo)`);
  return { texto: linhas.join("\n"), usados: ord.length - fora, total: ord.length };
}
const lista = (x: unknown, max: number) =>
  (Array.isArray(x) ? x : []).map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, max);
function normalizarResumo(x: unknown) {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const r = {
    situacao: String(o.situacao ?? "").trim(),
    decisoes: lista(o.decisoes, 6),
    pendencias: lista(o.pendencias, 6),
    proximo_passo: String(o.proximo_passo ?? "").trim(),
  };
  return r.situacao || r.decisoes.length || r.pendencias.length ? r : null;
}
// ── fim da cópia ──

interface Body { acao?: string; titulo?: string; descricao?: string; existentes?: unknown; id_tarefa?: string }

/** Chama o Groq tentando os modelos em ordem; devolve o JSON do modelo ou a resposta de erro pronta. */
async function chamarGroq(system: string, user: string, temperatura: number, maxTokens: number):
  Promise<{ json: Record<string, unknown> } | { resposta: Response }> {
  let groqRes: Response | null = null;
  const falhas: string[] = [];
  for (const model of MODELOS) {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        ...(model.startsWith("qwen/") ? { reasoning_effort: "none" } : {}),
        temperature: temperatura,
        max_tokens: maxTokens,
      }),
    });
    if (groqRes.ok) break;
    // Modelo retirado, sem acesso ou JSON malformado: tenta o próximo.
    falhas.push(`${model}: ${groqRes.status} ${(await groqRes.text()).slice(0, 200)}`);
    if (groqRes.status === 401 || groqRes.status === 429) break;
  }
  if (!groqRes || !groqRes.ok) {
    if (groqRes?.status === 429) return { resposta: aviso("A IA está no limite de uso agora. Tente de novo em alguns instantes.", 429) };
    return { resposta: json({ error: `Groq falhou em todos os modelos — ${falhas.join(" | ")}` }, 502) };
  }
  const groqData = await groqRes.json();
  const content: string | undefined = groqData?.choices?.[0]?.message?.content;
  if (!content) return { resposta: json({ error: "Resposta vazia do modelo." }, 502) };
  try {
    return { json: JSON.parse(content) as Record<string, unknown> };
  } catch {
    return { resposta: json({ error: "Modelo retornou JSON inválido." }, 502) };
  }
}

async function resumir(req: Request, idTarefa: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);
  // Cliente com o login da pessoa: a RLS decide o que ela vê (tarefa e comentários).
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

  const { data: tarefa } = await sb.from("gestao_tarefas").select("id_tarefa, titulo, descricao").eq("id_tarefa", idTarefa).maybeSingle();
  const t = tarefa as { id_tarefa: string; titulo: string; descricao: string | null } | null;
  if (!t) return aviso("Tarefa não encontrada ou sem acesso.", 404);

  const { data: lidos, error: erroCom } = await sb.from("gestao_comentarios").select("autor, texto, created_at")
    .eq("id_tarefa", idTarefa).order("created_at", { ascending: false }).limit(120);
  if (erroCom) return json({ error: "Não foi possível ler os comentários." }, 500);
  const conversa = montarConversa((lidos ?? []) as ComentarioIa[]);
  if (conversa.total < MIN_COMENTARIOS_RESUMO) return aviso(`Poucos comentários para resumir (mínimo ${MIN_COMENTARIOS_RESUMO}).`, 400);

  const usuario = `Tarefa: ${t.titulo}${t.descricao ? `\nDescrição: ${textoSemImagens(t.descricao).slice(0, 1_500)}` : ""}\n\nComentários (do mais antigo ao mais novo):\n${conversa.texto}`;
  const r = await chamarGroq(PROMPT_RESUMO, usuario, 0.2, 1500);
  if ("resposta" in r) return r.resposta;
  const resumo = normalizarResumo(r.json);
  if (!resumo) return aviso("A IA não conseguiu resumir esta conversa. Tente de novo.", 502);
  return json({ data: { resumo, usados: conversa.usados, total: conversa.total } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!GROQ_API_KEY) return json({ error: "GROQ_API_KEY não configurada." }, 500);

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const acao = body?.acao;

    if (acao === "resumo") {
      const id = (body?.id_tarefa ?? "").trim();
      if (!id) return json({ error: "Informe a tarefa." }, 400);
      return await resumir(req, id);
    }

    const titulo = (body?.titulo ?? "").trim();
    if (!titulo) return json({ error: "Informe o título da tarefa." }, 400);
    if (acao !== "subtarefas" && acao !== "descricao" && acao !== "checklist") return json({ error: "Ação inválida." }, 400);

    const system = acao === "subtarefas" ? PROMPT_SUBTAREFAS : acao === "checklist" ? PROMPT_CHECKLIST : PROMPT_DESCRICAO;
    const existentes = Array.isArray(body?.existentes)
      ? (body!.existentes as unknown[]).map((x) => String(x).trim()).filter(Boolean).slice(0, 40)
      : [];
    const userMsg = `Título: ${titulo}${body?.descricao ? `\nDescrição atual: ${textoSemImagens(String(body.descricao))}` : ""}`
      + (acao === "checklist" && existentes.length ? `\nItens que já existem (não repita): ${existentes.join("; ")}` : "");

    const r = await chamarGroq(system, userMsg, 0.5, 1500);
    if ("resposta" in r) return r.resposta;
    const parsed = r.json;

    if (acao === "subtarefas" || acao === "checklist") {
      const arr = Array.isArray(parsed[acao]) ? (parsed[acao] as unknown[]) : [];
      const ja = new Set(existentes.map((x) => x.toLowerCase()));
      const itens = arr.map((x) => String(x).trim()).filter((x) => x && !ja.has(x.toLowerCase())).slice(0, 12);
      return json({ data: { [acao]: itens } });
    }
    return json({ data: { descricao: String(parsed.descricao ?? "").trim() } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/client";
import { comporTitulo, faltando, normalizarEtiquetaForm, perguntaVisivel } from "@/lib/gestao/formularios";

export const dynamic = "force-dynamic";

/**
 * Formulário público da Gestão (porta a Edge Function gestao-form-submit p/ a .107).
 * PÚBLICO, guardado por token do formulário. Usa service_role (PostgREST .107).
 * Precisa de CF Access "Bypass" no path /api/gestao/* p/ ser alcançável de fora.
 *   GET  ?token=...  -> definição pública do formulário
 *   POST { token, titulo, descricao?, prazo?, prioridade?, respostas[] } -> cria tarefa
 */
// F1 (GESTAO-KANBAN-03): pergunta tipada com destino estruturado.
//   tipo:   texto|texto_longo|email|cnpj|cpf|telefone|data|data_hora|selecao|multipla
//   destino: "descricao" (default) | "etiquetas" | "prazo" | "campo:<id do gestao_campos>"
// F1.5 (v230): id estável, ajuda, condicao (pergunta condicional), pendente_anexo; e o
//   formulário pode ter titulo_composicao (título montado das respostas — o campo "título"
//   some do form público). Regras puras em lib/gestao/formularios.ts.
interface Pergunta {
  id?: string; label: string; obrigatorio: boolean; tipo?: string; opcoes?: string[]; destino?: string;
  ajuda?: string; condicao?: { pergunta: string; opcao: string } | null; pendente_anexo?: boolean;
}
type Resposta = string | string[];

function gerarIdTarefa(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `TRF-${hex}`;
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 });
  const sb = createSupabaseServiceClient({ email: null, origem: "formulario-publico" });
  const { data } = await sb.from("gestao_formularios").select("*").eq("token", token).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = data as any;
  if (!f || !f.ativo) return NextResponse.json({ error: "Formulário indisponível." }, { status: 404 });
  return NextResponse.json({
    titulo: f.titulo,
    descricao: f.descricao,
    mostra_descricao: f.mostra_descricao,
    mostra_prazo: f.mostra_prazo,
    mostra_prioridade: f.mostra_prioridade,
    prioridade_padrao: f.prioridade_padrao,
    // Título composto das respostas? Então o form público não pede título.
    titulo_composto: Array.isArray(f.titulo_composicao) && f.titulo_composicao.length > 0,
    // Esconde o `destino` (mapeamento interno); o form público precisa de label/obrigatório/tipo/
    // opções + id/ajuda/condição/anexo-pendente (F1.5) para renderizar e esconder perguntas.
    perguntas: ((f.perguntas ?? []) as Pergunta[]).map((p) => ({
      id: p.id ?? null, label: p.label, obrigatorio: p.obrigatorio, tipo: p.tipo ?? "texto", opcoes: p.opcoes ?? [],
      ajuda: p.ajuda ?? null, condicao: p.condicao ?? null, pendente_anexo: !!p.pendente_anexo,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { token?: string; titulo?: string; descricao?: string; prazo?: string; prioridade?: string; respostas?: Resposta[] }
    | null;
  if (!body?.token) return NextResponse.json({ error: "Token ausente." }, { status: 400 });

  const sb = createSupabaseServiceClient({ email: null, origem: "formulario-publico" });
  const { data } = await sb.from("gestao_formularios").select("*").eq("token", body.token).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = data as any;
  if (!f || !f.ativo) return NextResponse.json({ error: "Formulário indisponível." }, { status: 404 });

  const perguntas = (f.perguntas ?? []) as Pergunta[];
  const respostas = Array.isArray(body.respostas) ? body.respostas : [];

  // F1.5: título composto das respostas (tokens em titulo_composicao) quando o form não pede título.
  const tokensTitulo = Array.isArray(f.titulo_composicao) ? (f.titulo_composicao as string[]) : null;
  const titulo = (body.titulo ?? "").trim() || comporTitulo(tokensTitulo, f.titulo ?? "", perguntas, respostas);
  if (!titulo) return NextResponse.json({ error: "Informe o título da solicitação." }, { status: 400 });

  // Obrigatórias só entre as VISÍVEIS (pergunta condicional oculta não bloqueia o envio).
  const faltam = faltando(perguntas, respostas);
  if (faltam.length) return NextResponse.json({ error: `Responda: ${faltam[0].label}` }, { status: 400 });

  let status = f.status_inicial as string | null;
  if (!status) {
    const { data: st } = await sb
      .from("gestao_status")
      .select("slug")
      .eq("id_quadro", f.id_quadro)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status = (st as any)?.slug ?? "A_FAZER";
  }

  // F1: campos personalizados p/ o destino "campo:<id>" (valida contra as opções). F1.5: busca pelos
  // ids referenciados nas perguntas, sem filtrar por quadro — o campo "Produtos" é global (vive no
  // Comercial, id eb5d9daf…) e os forms do "SST — Entrada" gravam nele para a esteira das unidades.
  const idsCampos = perguntas.map((p) => (p.destino ?? "").startsWith("campo:") ? (p.destino as string).slice(6) : "").filter(Boolean);
  const { data: camposDefRaw } = idsCampos.length
    ? await sb.from("gestao_campos").select("id,tipo,opcoes").in("id", idsCampos)
    : { data: [] as unknown[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camposDef = new Map(((camposDefRaw ?? []) as any[]).map((c) => [c.id as string, c]));

  const strOf = (r: Resposta | undefined) => (Array.isArray(r) ? r.join(", ") : (r ?? "")).trim();
  const vaziaResp = (r: Resposta | undefined) =>
    Array.isArray(r) ? r.filter((x) => (x ?? "").trim()).length === 0 : !(r ?? "").trim();
  const arrOf = (r: Resposta | undefined) =>
    (Array.isArray(r) ? r : String(r ?? "").split(",")).map((x) => x.trim()).filter(Boolean);

  // Mapeia cada resposta pelo `destino`: campo estruturado / etiqueta / prazo / descrição.
  const etiquetas: string[] = [...((f.etiquetas_padrao ?? []) as string[])];
  const campos: Record<string, unknown> = {};
  const linhasDesc: string[] = [];
  let prazoDeCampo: string | null = null;
  let anexoPendente = false;

  perguntas.forEach((p, i) => {
    // Pergunta condicional oculta: a resposta (se veio) é ignorada.
    if (!perguntaVisivel(p, perguntas, respostas)) return;
    const r = respostas[i];
    if (p.pendente_anexo && !vaziaResp(r)) anexoPendente = true;
    const dest = p.destino ?? "descricao";
    if (dest === "etiquetas") {
      // Normaliza como as automações de roteamento esperam ("Teresópolis" → "teresopolis").
      arrOf(r).map(normalizarEtiquetaForm).filter(Boolean).forEach((v) => { if (!etiquetas.includes(v)) etiquetas.push(v); });
    } else if (dest === "prazo") {
      const v = strOf(r); if (v) prazoDeCampo = v;
    } else if (dest.startsWith("campo:")) {
      const def = camposDef.get(dest.slice(6));
      if (def) {
        const ops = new Set((def.opcoes ?? []) as string[]);
        const ok = (v: string) => ops.size === 0 || ops.has(v); // sem opções (texto/numero/data) aceita qualquer
        // Valor fora do catálogo do campo NÃO some: vai para a descrição (ex.: form importado do
        // Runrun oferece 44 "Produtos", o catálogo do Gestão tem 25 — AET/AEP etc. ficam legíveis).
        const fora: string[] = [];
        if (p.tipo === "multipla" || def.tipo === "multi") {
          const todos = arrOf(r);
          const vals = todos.filter(ok);
          todos.filter((v) => !ok(v)).forEach((v) => fora.push(v));
          if (vals.length) campos[def.id] = vals;
        } else {
          const v = strOf(r);
          if (v && ok(v)) campos[def.id] = v; else if (v) fora.push(v);
        }
        if (fora.length) linhasDesc.push(`${p.label} (fora do catálogo): ${fora.join(", ")}`);
      } else {
        const v = strOf(r); if (v) linhasDesc.push(`${p.label}: ${v}`);
      }
    } else {
      const v = strOf(r); if (v) linhasDesc.push(`${p.label}: ${v}`);
    }
  });

  const partes: string[] = [];
  if (f.mostra_descricao && (body.descricao ?? "").trim()) partes.push((body.descricao ?? "").trim());
  if (linhasDesc.length) partes.push(linhasDesc.join("\n"));
  // F1.5: pergunta de anexo (Runrun `documents`) sem upload público ainda → a tarefa nasce marcada
  // para a equipe pedir/anexar o arquivo (a F2 decide o upload).
  if (anexoPendente) partes.push("⚠️ Anexo pendente: o respondente indicou documentos; solicitar/anexar na tarefa.");
  const descricao = partes.join("\n\n") || null;

  const prioridade = f.mostra_prioridade && body.prioridade ? body.prioridade : f.prioridade_padrao;
  const prazo = prazoDeCampo ?? (f.mostra_prazo && body.prazo ? body.prazo : null);
  const now = new Date().toISOString();

  // Resolve o responsável por E-MAIL (F1.3-D). Só um usuário INTERNO ATIVO conta —
  // nunca input livre. Match case-insensitive e literal (ilike + verificação exata em
  // JS, para o `_`/`%` de um e-mail não virar wildcard). Se resolveu, a tarefa nasce
  // com created_by=<e-mail> e um vínculo tipo=responsavel (service_role); o trigger v187
  // espelha gestao_tarefas.responsavel = usuarios.nome. Se NÃO resolveu, cai no fallback
  // legado (created_by='Formulário', responsavel=nome-espelho, sem vínculo → gestor-only).
  const emailForm = (f.responsavel_email ?? "").trim();
  let responsavelEmailResolvido: string | null = null;
  if (emailForm) {
    const { data: cands } = await sb
      .from("usuarios")
      .select("email,nome,ativo_sistema")
      .ilike("email", emailForm);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = ((cands ?? []) as any[]).find(
      (c) => (c.email as string).toLowerCase() === emailForm.toLowerCase() && c.ativo_sistema,
    );
    if (match) responsavelEmailResolvido = match.email as string;
  }

  const idTarefa = gerarIdTarefa();
  const { error } = await sb.from("gestao_tarefas").insert({
    id_tarefa: idTarefa,
    id_quadro: f.id_quadro,
    titulo,
    descricao,
    status,
    prioridade,
    // Resolvido: deixa `responsavel` ao trigger-espelho (a partir do vínculo). Fallback: nome-espelho.
    responsavel: responsavelEmailResolvido ? null : f.responsavel_padrao,
    prazo,
    data_inicio: null,
    ordem: 0,
    etiquetas,
    subtarefas: [],
    campos,
    recorrencia: null,
    pontos: null,
    created_by: responsavelEmailResolvido ?? "Formulário",
    created_at: now,
    updated_at: now,
  } as never);
  if (error) return NextResponse.json({ error: "Não foi possível registrar a solicitação." }, { status: 500 });

  // Vínculo + trilha só quando resolveu. Falha aqui NÃO derruba a tarefa já criada
  // (a solicitação foi registrada; a lacuna de visibilidade é degradação suave, não erro).
  if (responsavelEmailResolvido) {
    const emailLc = responsavelEmailResolvido.toLowerCase(); // CHECK de gestao_tarefa_vinculados exige lower(email)
    const { error: vErr } = await sb.from("gestao_tarefa_vinculados").insert({
      id_tarefa: idTarefa,
      usuario_email: emailLc,
      tipo: "responsavel",
      origem: "form",
    } as never);
    if (!vErr) {
      await sb.from("gestao_vinculo_log").insert({
        ator_email: "Formulário",
        alvo_email: emailLc,
        acao: "vinculou",
        tipo: "responsavel",
        id_tarefa: idTarefa,
      } as never);
    }
  }

  return NextResponse.json({ ok: true });
}

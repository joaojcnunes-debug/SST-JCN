import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/client";
import { MAX_ANEXOS_FORM, MAX_BYTES_ANEXO_FORM, chaveTicketAnexo, ticketAnexoValido } from "@/lib/gestao/anexo-ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mesmo bucket/prefixo do AnexosTarefa (useUploadAnexo): o arquivo aparece nos anexos do card.
const BUCKET_ANEXOS = "anexos";

/**
 * Anexo da pergunta tipo "anexo" do formulário público da Gestão (quem abre pode não ter conta).
 * Replicado do Painel SST (v0.3.744) e adaptado à Vercel: lá o arquivo passava por esta rota; aqui
 * o corpo de uma requisição para numa casa de 4,5 MB, então o arquivo vai DIRETO ao Storage com
 * uma URL assinada, em dois passos:
 *
 *   { acao: "preparar",  token, id_tarefa, ticket, nome, tamanho }  → { path, token_upload }
 *   (o navegador sobe o arquivo com uploadToSignedUrl)
 *   { acao: "confirmar", token, id_tarefa, ticket, path, nome }     → grava em gestao_anexos
 *
 * Só aceita quando: o form do token está ativo e tem pergunta de anexo; o ticket (devolvido pelo
 * POST que criou a tarefa) é válido para ESTA tarefa e está no prazo de 30 min; a tarefa existe
 * (em qualquer quadro — pode já ter sido roteada); e ela ainda tem menos de MAX_ANEXOS_FORM anexos.
 * Grava com service_role.
 */
interface Corpo {
  acao?: string;
  token?: string;
  id_tarefa?: string;
  ticket?: string;
  nome?: string;
  tamanho?: number;
  path?: string;
}

function nomeSeguro(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: NextRequest) {
  let b: Corpo;
  try {
    b = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const { acao, token, id_tarefa: idTarefa, ticket } = b;
  if (typeof token !== "string" || typeof idTarefa !== "string" || typeof ticket !== "string") {
    return NextResponse.json({ error: "Dados do anexo incompletos." }, { status: 400 });
  }
  if (!ticketAnexoValido(chaveTicketAnexo(), idTarefa, ticket)) {
    return NextResponse.json({ error: "Prazo para anexar expirou. Anexe pelo card da tarefa ou fale com a equipe." }, { status: 403 });
  }

  const sb = createSupabaseServiceClient({ email: null, origem: "formulario-publico/anexo" });
  const { data: fRaw } = await sb.from("gestao_formularios").select("id_quadro,ativo,perguntas").eq("token", token).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = fRaw as any;
  const temAnexo = ((f?.perguntas ?? []) as { tipo?: string }[]).some((p) => p.tipo === "anexo");
  if (!f || !f.ativo || !temAnexo) return NextResponse.json({ error: "Formulário indisponível." }, { status: 404 });

  // Sem conferir o quadro: automações movem a tarefa recém-criada para outro quadro antes de os
  // anexos subirem. O ticket já amarra o arquivo a ESTA tarefa.
  const { data: tRaw } = await sb.from("gestao_tarefas").select("id_tarefa").eq("id_tarefa", idTarefa).maybeSingle();
  if (!tRaw) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });

  const { data: existentes } = await sb.from("gestao_anexos").select("id").eq("id_tarefa", idTarefa).limit(MAX_ANEXOS_FORM);
  if ((existentes ?? []).length >= MAX_ANEXOS_FORM) {
    return NextResponse.json({ error: `Limite de ${MAX_ANEXOS_FORM} arquivos por solicitação.` }, { status: 409 });
  }

  const prefixo = `gestao/${idTarefa}/`;

  if (acao === "preparar") {
    const nome = typeof b.nome === "string" ? b.nome : "";
    const tamanho = typeof b.tamanho === "number" ? b.tamanho : 0;
    if (!nome) return NextResponse.json({ error: "Arquivo sem nome." }, { status: 400 });
    if (tamanho <= 0) return NextResponse.json({ error: `"${nome}" está vazio.` }, { status: 400 });
    if (tamanho > MAX_BYTES_ANEXO_FORM) return NextResponse.json({ error: `"${nome}" excede 50 MB.` }, { status: 413 });
    const path = `${prefixo}${crypto.randomUUID()}-${nomeSeguro(nome)}`;
    const { data, error } = await sb.storage.from(BUCKET_ANEXOS).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: `Não foi possível preparar o envio de "${nome}".` }, { status: 500 });
    return NextResponse.json({ path: data.path, token_upload: data.token });
  }

  if (acao === "confirmar") {
    const path = typeof b.path === "string" ? b.path : "";
    const nome = typeof b.nome === "string" && b.nome ? b.nome : path.split("/").pop() ?? "arquivo";
    // Só caminhos desta tarefa: o ticket vale para ela e para mais nenhuma.
    if (!path.startsWith(prefixo) || path.includes("..")) {
      return NextResponse.json({ error: "Arquivo fora desta solicitação." }, { status: 400 });
    }
    const arquivo = path.slice(prefixo.length);
    const { data: lista, error: listErr } = await sb.storage.from(BUCKET_ANEXOS).list(prefixo.slice(0, -1), { search: arquivo, limit: 1 });
    const obj = (lista ?? []).find((o) => o.name === arquivo);
    if (listErr || !obj) return NextResponse.json({ error: `"${nome}" não chegou ao armazenamento.` }, { status: 404 });
    const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
    if ((meta.size ?? 0) > MAX_BYTES_ANEXO_FORM) {
      await sb.storage.from(BUCKET_ANEXOS).remove([path]);
      return NextResponse.json({ error: `"${nome}" excede 50 MB.` }, { status: 413 });
    }
    const { error } = await sb.from("gestao_anexos").insert({
      id: crypto.randomUUID(),
      id_tarefa: idTarefa,
      nome,
      storage_path: path,
      mime: meta.mimetype ?? null,
      tamanho_bytes: meta.size ?? null,
      created_by: "Formulário",
    } as never);
    if (error) {
      await sb.storage.from(BUCKET_ANEXOS).remove([path]);
      return NextResponse.json({ error: `Não foi possível registrar "${nome}".` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

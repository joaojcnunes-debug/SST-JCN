import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/client";
import { montarPayloadSetor, podeReprocessar, DATA_ESTEIRA, VALIDADE_ESTEIRA, type RiscoPainel } from "@/lib/sgg/payload";
import { enviarAoWebhook, novoIdEnvio } from "@/lib/sgg/socket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";        // node:http nao existe no edge runtime

const MESTRES = process.env.MESTRES_POSTGREST_URL ?? "http://mestres-postgrest:3000";

async function mestres<T>(caminho: string): Promise<T> {
  const r = await fetch(`${MESTRES}${caminho}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`mestres ${r.status}`);
  return (await r.json()) as T;
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });

  const { data: perfil } = await supabase.from("usuarios")
    .select("perfil, ativo_sistema, pode_enviar_sgg").eq("email", user.email.toLowerCase()).single();
  const p = perfil as { perfil?: string; ativo_sistema?: boolean; pode_enviar_sgg?: boolean } | null;
  const autorizado = !!p?.ativo_sistema && (p.perfil === "Admin" || p.pode_enviar_sgg === true);
  if (!autorizado) return NextResponse.json({ ok: false, erro: "Seu perfil não pode enviar riscos ao SGG." }, { status: 403 });

  let corpo: { id_inspecao?: string; id_setor?: string };
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false, erro: "Requisição inválida" }, { status: 400 }); }
  const { id_inspecao, id_setor } = corpo;
  if (!id_inspecao || !id_setor) return NextResponse.json({ ok: false, erro: "Dados incompletos" }, { status: 400 });

  // Leitura pela SESSAO: RLS decide o que este usuario alcanca.
  const { data: insp } = await supabase.from("inspecoes").select("id_inspecao, id_empresa").eq("id_inspecao", id_inspecao).single();
  const inspecao = insp as { id_empresa: string } | null;
  if (!inspecao) return NextResponse.json({ ok: false, erro: "Inspeção não encontrada" }, { status: 404 });

  const { data: emp } = await supabase.from("empresas")
    .select("id_empresa, nome_empresa, sgg_base_sgg, sgg_id").eq("id_empresa", inspecao.id_empresa).single();
  const empresa = emp as { sgg_base_sgg: string | null; sgg_id: string | null } | null;
  if (!empresa?.sgg_base_sgg || !empresa.sgg_id) {
    return NextResponse.json({ ok: false, erro: "Empresa ainda não vinculada ao SGG. Peça o vínculo ao administrador." }, { status: 409 });
  }

  const { data: setorRow } = await supabase.from("setores").select("id_setor, setor_ghe").eq("id_setor", id_setor).single();
  const setor = setorRow as { setor_ghe: string } | null;
  if (!setor) return NextResponse.json({ ok: false, erro: "Setor não encontrado" }, { status: 404 });

  const { data: riscosRow } = await supabase.from("riscos").select("*").eq("id_inspecao", id_inspecao).eq("id_setor", id_setor);
  const riscos = (riscosRow ?? []) as unknown as RiscoPainel[];
  if (!riscos.length) return NextResponse.json({ ok: false, erro: "Setor sem riscos" }, { status: 400 });

  const { data: episRow } = await supabase.from("epi_epc").select("id_risco, ca, descricao, tipo").eq("id_inspecao", id_inspecao);
  const caPorRisco: Record<string, string[]> = {};
  for (const e of (episRow ?? []) as { id_risco: string; ca: string | null; descricao: string | null }[]) {
    if (!e.ca) continue;
    (caPorRisco[e.id_risco] ??= []).push(`${e.descricao ?? "EPI"} CA ${e.ca}`);
  }

  // D3.7 -- resolucao por NOME exato contra os dados-mestres (GET-only), sem fallback
  // por similaridade: casar errado manda risco para o setor errado do cliente.
  let sggIdSetor: string; let sggIdsCargos: string[];
  try {
    const q = `?base_sgg=eq.${encodeURIComponent(empresa.sgg_base_sgg)}&id_empresa=eq.${encodeURIComponent(empresa.sgg_id)}`;
    const setores = await mestres<{ sgg_id: string; nome: string }[]>(
      `/setores${q}&nome=eq.${encodeURIComponent(setor.setor_ghe)}&select=sgg_id,nome`);
    if (setores.length !== 1) {
      return NextResponse.json({ ok: false, erro:
        setores.length === 0
          ? `O setor "${setor.setor_ghe}" não existe com esse nome no SGG desta empresa.`
          : `Há ${setores.length} setores com o nome "${setor.setor_ghe}" no SGG — corrija no SGG antes de enviar.` }, { status: 409 });
    }
    sggIdSetor = setores[0].sgg_id;
    // TODOS os cargos do setor (handoff 3 da fase 2): torna D40016 impossivel.
    const vinculos = await mestres<{ cargo_id: string }[]>(
      `/cargo_setores?base_sgg=eq.${encodeURIComponent(empresa.sgg_base_sgg)}&setor_id=eq.${encodeURIComponent(sggIdSetor)}&select=cargo_id`);
    sggIdsCargos = vinculos.map((v) => v.cargo_id);
  } catch {
    return NextResponse.json({ ok: false, erro: "Não foi possível consultar os dados-mestres agora." }, { status: 503 });
  }

  const montado = montarPayloadSetor({ sggIdEmpresa: empresa.sgg_id, sggIdSetor, sggIdsCargos, riscos, caPorRisco });
  if ("impedimentos" in montado) {
    return NextResponse.json({ ok: false, resultado: "bloqueado", impedimentos: montado.impedimentos }, { status: 422 });
  }

  const servico = createSupabaseServiceClient({ email: user.email, origem: "sgg/enviar-riscos" });
  let id_envio = novoIdEnvio();
  const linha = {
    id_envio, id_inspecao, id_empresa: inspecao.id_empresa, id_setor,
    base_sgg: empresa.sgg_base_sgg, sgg_id_empresa: empresa.sgg_id,
    sgg_id_setor: sggIdSetor, sgg_ids_cargos: sggIdsCargos.join(","),
    data: DATA_ESTEIRA, data_validade: VALIDADE_ESTEIRA,
    payload: montado.payload, status: "pendente", ator_email: user.email.toLowerCase(),
  };
  const { error: eIns } = await servico.from("sgg_envios").insert(linha as never);
  if (eIns) {
    if ((eIns as { code?: string }).code !== "23505") {
      return NextResponse.json({ ok: false, resultado: "erro", erro: "Não foi possível registrar o envio." }, { status: 500 });
    }
    // 23505 = ux_sgg_envios_idem: ja existe linha para (inspecao, setor, data).
    // A unique NAO filtra por status, entao ela dispara tambem quando a tentativa
    // anterior FALHOU. Responder "duplicado" aqui deixaria o setor fora do SGG
    // para sempre, com a UI dizendo que ja esta la. Ler o status e decidir.
    const { data: ant } = await servico.from("sgg_envios")
      .select("id_envio, status, sgg_codigo, sgg_id_avaliacao")
      .eq("id_inspecao", id_inspecao).eq("id_setor", id_setor).eq("data", DATA_ESTEIRA)
      .maybeSingle();
    const anterior = ant as { id_envio: string; status: string; sgg_codigo: string | null; sgg_id_avaliacao: string | null } | null;

    if (!anterior) {
      return NextResponse.json({ ok: false, resultado: "erro", erro: "Não foi possível registrar o envio." }, { status: 500 });
    }
    // Ja esta la: reenviar e a UNICA forma de duplicar (a API do SGG nao tem DELETE).
    if (anterior.status === "enviado" || anterior.status === "duplicado") {
      return NextResponse.json({ ok: false, resultado: "duplicado", id_envio: anterior.id_envio,
        sgg_id: anterior.sgg_id_avaliacao,
        erro: "Este setor já foi enviado nesta esteira." }, { status: 409 });
    }
    if (anterior.status === "pendente") {
      return NextResponse.json({ ok: false, resultado: "em_andamento", id_envio: anterior.id_envio,
        erro: "Há um envio deste setor em andamento. Aguarde e recarregue." }, { status: 409 });
    }
    // indeterminado, ou erro cujo codigo nao prova que o SGG recusou: pode ter
    // sido gravado la. Reenviar as cegas duplicaria — quem decide e a pessoa,
    // olhando o SGG.
    if (!podeReprocessar(anterior.status, anterior.sgg_codigo)) {
      return NextResponse.json({ ok: false, resultado: "indeterminado", id_envio: anterior.id_envio,
        erro: "A tentativa anterior não confirmou se a avaliação foi criada no SGG. "
          + "Confira no SGG antes de reenviar — a API não permite excluir." }, { status: 409 });
    }
    // O SGG RECUSOU com codigo (D40027, D40082, ...): nada foi criado la.
    // Reaproveitar a linha para reprocessar, senao o setor fica preso para sempre.
    const { error: eReset } = await servico.from("sgg_envios").update({
      status: "pendente", payload: montado.payload, ator_email: user.email.toLowerCase(),
      sgg_codigo: null, sgg_msg: null, sgg_id_avaliacao: null, respondido_em: null,
      sgg_id_setor: sggIdSetor, sgg_ids_cargos: sggIdsCargos.join(","),
      // compare-and-swap: so reseta se AINDA estiver em "erro". Sem isso, dois
      // atores no mesmo segundo resetariam a mesma linha e postariam os dois.
    } as never).eq("id_envio", anterior.id_envio).eq("status", "erro");
    if (eReset) {
      return NextResponse.json({ ok: false, resultado: "erro", erro: "Não foi possível preparar o reenvio." }, { status: 500 });
    }
    id_envio = anterior.id_envio;
  }

  const resposta = await enviarAoWebhook({ id_envio, base: empresa.sgg_base_sgg, payload: montado.payload });
  const status = resposta.resultado === "sucesso" ? "enviado"
    : resposta.resultado === "duplicado" ? "duplicado"
    : resposta.resultado === "indeterminado" ? "indeterminado" : "erro";
  const { error: eUpd } = await servico.from("sgg_envios").update({
    status, sgg_id_avaliacao: resposta.sgg_id ?? null,
    sgg_codigo: resposta.codigo ?? null, sgg_msg: (resposta.msg ?? "").slice(0, 500),
    respondido_em: new Date().toISOString(),
  } as never).eq("id_envio", id_envio);

  // O POST ja foi ao SGG. Se o registro do resultado falhar, a linha fica em
  // "pendente" com a avaliacao possivelmente criada -- o usuario PRECISA saber,
  // senao a inconsistencia so aparece numa varredura. Nunca silenciar aqui.
  if (eUpd) {
    return NextResponse.json({
      ok: false, id_envio, status: "pendente", resultado: "registro_falhou",
      erro: "O envio foi feito, mas o resultado nao pode ser registrado no painel. "
        + "Confira a avaliacao no SGG antes de tentar de novo -- reenviar pode duplicar.",
      sgg_id: resposta.sgg_id ?? null,
    }, { status: 500 });
  }

  // O spread vem PRIMEIRO de proposito: `status` aqui e o que foi gravado em
  // sgg_envios (o vocabulario do painel), enquanto `resposta.resultado` e o
  // vocabulario do servico. Com o spread depois, um campo homonimo da resposta
  // sobrescreveria o valor gravado e a UI mostraria estado diferente do banco.
  return NextResponse.json({ ...resposta, ok: resposta.ok, id_envio, status });
}

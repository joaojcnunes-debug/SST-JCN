import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Uma captura da U.are.U 4500 mede ~225 KB em base64; 3 MB é folga larga. */
const LIMITE_SONDA = 3_000_000;

type Rpc = {
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T; error: { message: string } | null }>;
};

type Papel = "envia" | "recebe" | "valida";
const PAPEIS: Papel[] = ["envia", "recebe", "valida"];

/**
 * Verificação biométrica 1:1 na assinatura de RETIRADA de equipamento, em três papéis.
 *
 * O desenho que importa: a leitura do template e a comparação passam pela sessão do
 * usuário (RLS decide o que ele alcança), mas **a gravação é feita com o cliente de
 * serviço**, chamando `equipamento_assinar_entrega_digital` — que não é concedida a
 * `authenticated`. Sem isso, qualquer cliente autenticado gravaria `finger_verificado`
 * direto no PostgREST sem nunca ter encostado o dedo no leitor.
 *
 * Sem `EPI_MATCHER_URL` ou com o matcher fora, devolve `{ fallback: true }` — e aí a UI
 * **bloqueia**, por decisão do operador: retirada de equipamento não sai sem biometria.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });

  // E2 — sem isto, a via digital escreveria com requisito MENOR que a via canvas:
  // a RPC de desenho exige `caller_pode_editar()` por dentro, mas a gravação digital
  // roda com o cliente de serviço e nunca via o perfil de quem pediu. Um Visualizador
  // passaria a assinar retirada, coisa que a v166 não permitia. Reusa a função do
  // banco em vez de reimplementar a regra de perfil aqui.
  const rpcUsuario = supabase as unknown as Rpc;
  const { data: podeEditar } = await rpcUsuario.rpc<boolean>("caller_pode_editar");
  if (podeEditar !== true) {
    return NextResponse.json({ ok: false, erro: "Seu perfil não pode assinar retiradas." }, { status: 403 });
  }

  const matcherUrl = process.env.EPI_MATCHER_URL;
  if (!matcherUrl) {
    return NextResponse.json({ ok: false, fallback: true, erro: "Serviço de biometria não configurado." });
  }

  let body: {
    id_entrega?: string;
    papel?: string;
    id_colaborador?: string;
    sonda?: string;
    /** O hash de conteúdo que a TELA viu. Serve para pegar a corrida (alguém editou a
     *  retirada com o modal aberto); o que fica gravado é o que o banco recalcula. */
    conteudo_hash?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida" }, { status: 400 });
  }

  // B4 — o campo `consentimento` SAIU. A tela mandava `true` literal (não existe caixa
  // lá) e o banco carimbava `consentimento_em`: registro de consentimento que ninguém
  // coletou, em documento trabalhista com dado pessoal sensível. O consentimento real é
  // o do cadastro, onde a caixa existe — e é ele que a função grava agora.
  const { id_entrega, sonda, conteudo_hash } = body;
  const papel = (body.papel ?? "") as Papel;
  if (!id_entrega || !sonda) return NextResponse.json({ ok: false, erro: "Dados incompletos" }, { status: 400 });
  if (!PAPEIS.includes(papel)) {
    return NextResponse.json({ ok: false, erro: "Papel inválido. Use envia, recebe ou valida." }, { status: 400 });
  }
  // R-c — `req.json()` não tem teto no App Router, e cada requisição faz o matcher
  // decodificar base64 e extrair template. Sonda enorme em paralelo derruba o container
  // por memória: DoS ao alcance de qualquer usuário autenticado.
  if (sonda.length > LIMITE_SONDA) {
    return NextResponse.json({ ok: false, erro: "Leitura grande demais." }, { status: 413 });
  }
  // B3 — a identidade da leitura é calculada AQUI. Se viesse do cliente, quem quisesse
  // reusar um PNG mandaria um hash inventado junto e passaria pelo antirreplay.
  const sondaSha = createHash("sha256").update(sonda).digest("hex");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;

  try {
    // A entrega é lida pela sessão do usuário: se a base estiver fora do alcance dele,
    // a RLS devolve "não encontrada" — 404 em vez de vazar a existência da linha.
    const { data: ent, error: eErr } = await supabase
      .from("equipamentos_entregas")
      .select("id_entrega, id_unidade, id_colaborador")
      .eq("id_entrega", id_entrega)
      .single();
    if (eErr || !ent) return NextResponse.json({ ok: false, erro: "Entrega não encontrada" }, { status: 404 });
    const entrega = ent as { id_unidade: string; id_colaborador: string | null };

    // Quem assina depende do papel.
    //
    // `recebe` continua sendo decidido pelo servidor — é o colaborador da própria
    // retirada, e o cliente não opina.
    //
    // `envia` e `valida` são escolhidos na tela, entre a EQUIPE DE ENTREGA, e podem ser
    // de outra base: a entrega de equipamento é feita pela TI, que atende as 7 unidades.
    // A rota NÃO reimplementa essa regra — quem valida pertencimento à equipe é a função
    // que grava, com `security definer`, porque é lá que a linha de fato entra. Conferir
    // aqui e confiar seria conferir do lado errado da porta.
    //
    // A checagem de "mesma base" que existia aqui saiu junto com a do banco: era ela que
    // impedia a TI de assinar a retirada de outra unidade.
    let idColab: string | null = null;
    if (papel === "recebe") {
      idColab = entrega.id_colaborador;
    } else {
      idColab = body.id_colaborador ?? null;
      if (!idColab) {
        return NextResponse.json(
          { ok: false, erro: papel === "envia" ? "Informe quem está entregando." : "Informe quem está validando." },
          { status: 400 },
        );
      }
    }
    if (!idColab) return NextResponse.json({ ok: false, erro: "Não foi possível identificar quem assina." }, { status: 400 });

    // O template e lido pelo cliente de SERVICO, nunca pela sessao do usuario: a
    // funcao devolve texto claro, e quem tem o template pode reenviá-lo como sonda e
    // forjar a assinatura.
    const servicoDb = createSupabaseServiceClient();
    const servico = servicoDb as unknown as Rpc;

    // ACHADO DO PORTÃO — e é aqui que o escopo de quem pode ser comparado se decide.
    //
    // A guarda de equipe do banco só roda no INSERT. Até lá, esta rota já decifrou o
    // template (com o cliente de SERVIÇO, que pula a guarda de base de
    // `equip_obter_biometria`) e já devolveu o score ao cliente — inclusive sem match,
    // de propósito, para permitir calibrar. Sem conferir aqui, qualquer usuário com
    // `caller_pode_editar()` rodaria comparação 1:1 contra o template de QUALQUER
    // colaborador da empresa e leria o score: o oráculo que o teto de tentativas existe
    // para fechar, com denominador "empresa inteira" em vez de "a base da retirada".
    // De quebra, dá para queimar as 5 tentativas de um colega e travar por 10 minutos a
    // assinatura legítima dele.
    //
    // Isto NÃO é reimplementar a regra do INSERT e confiar: é fechar uma porta
    // diferente. Decifrar, comparar e devolver score nunca chegam ao banco — nesse
    // caminho a rota é a única porta que existe.
    //
    // O `ativo` entra aqui junto: sem ele, rota e banco discordariam do mesmo jeito que
    // tela e banco discordavam antes — um ex-membro desativado passaria por esta porta
    // (template decifrado, comparado, score devolvido, tentativa queimada) e só levaria
    // recusa no INSERT. O oráculo encolheria de "empresa inteira" para "roster inclusive
    // inativos", que é pequeno, mas não é zero.
    if (papel !== "recebe") {
      const [equipeRes, colabRes] = await Promise.all([
        servicoDb
          .from("equip_equipe_entrega")
          .select("id_colaborador")
          .eq("id_colaborador", idColab)
          .maybeSingle(),
        servicoDb
          .from("colaboradores_chabra")
          .select("id_colaborador")
          .eq("id_colaborador", idColab)
          .eq("ativo", true)
          .maybeSingle(),
      ]);

      // ⚠️ NÃO CONSEGUIR LER NÃO É "NÃO PODE". Esta distinção custou três semanas.
      //
      // A v189 deu `select` em `equip_equipe_entrega` só a `authenticated`, e esta
      // rota lê pelo cliente de SERVIÇO. O PostgREST respondia `42501 permission
      // denied`, o `error` era descartado, `data` vinha `null` — e a rota recusava
      // TODA assinatura de "envia" e "valida" dizendo que a pessoa não era da equipe.
      // Medido: o papel `recebe` (que não passa por aqui) seguiu assinando até
      // 22/09/2026; `envia` e `valida` pararam em 01/09, no deploy desta checagem.
      // A v246 devolveu o grant; isto aqui é o que impede o próximo grant faltando
      // de se disfarçar de regra de negócio outra vez.
      if (equipeRes.error || colabRes.error) {
        console.error("[biometria] não foi possível conferir a equipe de entrega", {
          equipe: equipeRes.error?.message,
          colaborador: colabRes.error?.message,
        });
        return NextResponse.json(
          {
            ok: false,
            erro: "Não foi possível conferir a equipe de entrega. Isto é falha do sistema, não da sua digital — avise a TI.",
          },
          { status: 500 },
        );
      }

      if (!equipeRes.data || !colabRes.data) {
        return NextResponse.json(
          {
            ok: false,
            // Diz o que fazer: a mensagem antiga era um beco sem saída para quem
            // está com a pessoa na frente esperando o papel.
            erro: `Quem assina "${papel}" precisa estar na equipe de entrega e ativo. Um Admin inclui em Equipamentos › Movimentação › Colaboradores.`,
          },
          { status: 403 },
        );
      }
    }

    // E4 — teto de tentativas por (quem pede, por quem assina). Comparador 1:1 que
    // devolve score e aceita tentativas infinitas é hill-climbing de manual.
    // R-a — a versão anterior LIA o contador aqui e só gravava depois do matcher: N
    // requisições em paralelo liam 0 e passavam todas, deixando vivo justamente o
    // hill-climbing que o teto existe para fechar. Agora contar e reservar acontecem
    // sob a mesma trava no banco, e a reserva já é a linha da tentativa.
    const { data: idTentativa, error: tErr } = await servico.rpc<number>("equip_bio_reservar_tentativa", {
      p_email: user.email,
      p_id_colaborador: idColab,
      p_minutos: 10,
      p_limite: 5,
    });
    if (tErr) {
      return NextResponse.json({ ok: false, erro: tErr.message }, { status: 429 });
    }
    const registrar = (resultado: "match" | "sem_match" | "erro", score: number | null) =>
      servico.rpc("equip_bio_fechar_tentativa", {
        p_id_tentativa: idTentativa,
        p_resultado: resultado,
        p_score: score,
        p_id_entrega: id_entrega,
        p_papel: papel,
      });

    const { data: template, error: bErr } = await servico.rpc<string | null>("equip_obter_biometria", {
      p_id_colaborador: idColab,
    });
    if (bErr) return NextResponse.json({ ok: false, erro: bErr.message }, { status: 400 });
    if (!template) {
      return NextResponse.json({ ok: false, semBiometria: true, erro: "Esta pessoa ainda não cadastrou a digital." });
    }

    let amostras: string[];
    try {
      const p = JSON.parse(template);
      amostras = Array.isArray(p) ? p : [template];
    } catch {
      amostras = [template];
    }

    let cmp: { ok: boolean; match?: boolean; score?: number; threshold?: number; erro?: string };
    try {
      const r = await fetch(`${matcherUrl.replace(/\/$/, "")}/comparar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sonda, amostras }),
        signal: AbortSignal.timeout(15000),
      });
      cmp = await r.json();
    } catch (e) {
      return NextResponse.json({
        ok: false,
        fallback: true,
        erro: "Serviço de biometria indisponível: " + (e instanceof Error ? e.message : ""),
      });
    }
    if (!cmp.ok) {
      await registrar("erro", null);
      return NextResponse.json({ ok: false, erro: cmp.erro || "Falha na comparação." });
    }
    // R-b — a rota confiava só no booleano `match` e nunca comparava score com limiar.
    // Se o matcher trocar de versão, ou responder com `match:true` e score baixo, o
    // termo saía afirmando "digital verificada" sem nada por trás. Aqui e no banco.
    const score = typeof cmp.score === "number" ? cmp.score : null;
    const threshold = typeof cmp.threshold === "number" ? cmp.threshold : null;
    if (!cmp.match || score === null || threshold === null || score < threshold) {
      await registrar("sem_match", score);
      // O score volta mesmo sem match: é o que permite calibrar o limiar com dedo real.
      return NextResponse.json({ ok: true, match: false, score, threshold });
    }

    // Deu match → grava com o cliente de SERVIÇO. A função não existe para `authenticated`.
    const { data: idAssin, error: aErr } = await servico.rpc<string>("equipamento_assinar_entrega_digital", {
      p_id_entrega: id_entrega,
      p_papel: papel,
      p_id_colaborador: idColab,
      p_assinante_nome: null,
      p_conteudo_hash: conteudo_hash || null,
      p_user_agent: req.headers.get("user-agent"),
      p_ip: ip,
      p_match_score: score,
      p_threshold: threshold,
      p_sonda_sha256: sondaSha,
      p_criado_por: user.email,
    });
    if (aErr) {
      await registrar("erro", score);
      return NextResponse.json({ ok: false, erro: aErr.message }, { status: 400 });
    }
    await registrar("match", score);

    return NextResponse.json({
      ok: true,
      match: true,
      score,
      threshold,
      papel,
      id_assinatura: idAssin,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro na verificação" },
      { status: 500 },
    );
  }
}

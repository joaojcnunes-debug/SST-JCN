import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type {
  AssinaturaTermo,
  HistoricoTermo,
  ItemTermo,
  LadoTermo,
  TermoEquipamentoProps,
  TipoTermo,
} from "@/components/pdf/templates/TermoEquipamentoTemplate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Termo de Transferência de Equipamento em PDF — os três movimentos numa rota.
 *
 * `/api/pdf/equipamento-termo/entrega|devolucao|transferencia/<id>`
 *
 * POR QUE UMA ROTA SÓ. É o mesmo documento com origem e destino trocados de
 * lugar; três rotas seriam três lugares para o layout divergir. O que muda por
 * tipo é apenas de ONDE vêm os dados, e isso cabe num switch.
 *
 * ⚠️ A AUTORIZAÇÃO É A RLS, não um `if` daqui. A rota usa o cliente do usuário
 * logado (cookie), então quem não enxerga a base não enxerga a entrega e recebe
 * 404 — o mesmo 404 de um id inexistente. Nunca trocar por client de serviço
 * "para simplificar": isso entregaria termo de qualquer base a qualquer pessoa.
 *
 * ⚠️ OS DADOS DO ITEM SAEM DO SNAPSHOT (`*_itens.nome_equipamento`,
 * `numero_serie`, `numero_patrimonio`), nunca de um join com `equipamentos`.
 * Reemitir um termo de seis meses atrás tem de devolver o que estava escrito
 * naquele dia, não o cadastro de hoje.
 */

const TIPOS: TipoTermo[] = ["entrega", "devolucao", "transferencia"];

const PREFIXO: Record<TipoTermo, string> = {
  entrega: "RET",
  devolucao: "DEV",
  transferencia: "TRF",
};

const ROTULO_ESTADO: Record<string, string> = {
  integro: "Íntegro",
  avariado: "Avariado",
  inservivel: "Inservível",
};

type Linha = Record<string, unknown>;
const txt = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

/** `RET-2026-A1B2C3D4` — ano da emissão + 8 dígitos do id. O id é uuid; o
 *  número curto é o que cabe no papel e o que a pessoa consegue ditar por
 *  telefone. O id inteiro continua na URL. */
function numeroTermo(tipo: TipoTermo, id: string, emitidoEm: Date): string {
  const curto = String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${PREFIXO[tipo]}-${emitidoEm.getFullYear()}-${curto}`;
}

/** Hash do conteúdo, não dos bytes do PDF: um documento não imprime o hash de
 *  si mesmo. Reemitir com os mesmos dados dá o mesmo hash; uma linha alterada
 *  depois da assinatura deixa de bater. */
function hashConteudo(dados: unknown): string {
  return createHash("sha256").update(JSON.stringify(dados)).digest("hex");
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tipo: string; id: string }> },
) {
  const { tipo: tipoBruto, id } = await ctx.params;
  const tipo = tipoBruto as TipoTermo;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de termo inválido." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    // Nome de quem está emitindo — vai na linha do conferente.
    // R-e — `_` e `%` são curingas de LIKE: `a_b@x.com` casava `axb@x.com`, e com duas
    // linhas o `.maybeSingle()` erra. O nome vai impresso na linha "Quem valida".
    const { data: quem } = await supabase
      .from("usuarios")
      .select("nome")
      .ilike("email", user.email.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    const conferente = txt((quem as Linha | null)?.nome) ?? user.email;

    const montado =
      tipo === "transferencia"
        ? await montarTransferencia(supabase, id)
        : await montarEntregaOuDevolucao(supabase, tipo, id);

    if (!montado) return NextResponse.json({ error: "Termo não encontrado" }, { status: 404 });

    const emitidoEm = new Date();
    const numero = numeroTermo(tipo, id, emitidoEm);

    const props: TermoEquipamentoProps = {
      ...montado,
      tipo,
      numero,
      emitidoEm: emitidoEm.toISOString(),
      conferente,
      sha256:
        montado.sha256 ??
        hashConteudo({
          tipo,
          id,
          origem: montado.origem,
          destino: montado.destino,
          itens: montado.itens,
          dataAto: montado.dataAto,
          motivo: montado.motivo,
        }),
    };

    const [{ default: React }, { renderToStaticMarkup }, { default: Template }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/TermoEquipamentoTemplate"),
    ]);

    const bodyHtml = renderToStaticMarkup(React.createElement(Template, props));
    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const bodySemStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Termo de Transferência de Equipamento</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;">
${bodySemStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    // 8×10 mm é a margem em que o termo foi medido: 268 mm de conteúdo contra
    // 281 mm úteis. Afrouxar aqui joga as assinaturas para a segunda página.
    const pdf = await gerarPdf(fullHtml, {
      margens: { top: "8mm", bottom: "8mm", left: "10mm", right: "10mm" },
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="termo-${numero}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar o termo" },
      { status: 500 },
    );
  }
}

type Montado = Omit<TermoEquipamentoProps, "tipo" | "numero" | "emitidoEm" | "conferente" | "sha256"> & {
  sha256: string | null;
};

type Cliente = ReturnType<typeof createSupabaseServerClient>;

async function nomeUnidade(supabase: Cliente, idUnidade: string | null): Promise<string | null> {
  if (!idUnidade) return null;
  const { data } = await supabase
    .from("unidades")
    .select("nome")
    .eq("id_unidade", idUnidade)
    .maybeSingle();
  return txt((data as Linha | null)?.nome) ?? idUnidade;
}

/**
 * Retirada e devolução são a MESMA consulta com os lados invertidos — a única
 * assimetria real é o estado de retorno, que só existe na volta.
 */
async function montarEntregaOuDevolucao(
  supabase: Cliente,
  tipo: "entrega" | "devolucao",
  id: string,
): Promise<Montado | null> {
  const ehEntrega = tipo === "entrega";
  const tabela = ehEntrega ? "equipamentos_entregas" : "equipamentos_devolucoes";
  const tabelaItens = ehEntrega ? "equipamentos_entregas_itens" : "equipamentos_devolucoes_itens";
  const chave = ehEntrega ? "id_entrega" : "id_devolucao";

  const { data: cab } = await supabase.from(tabela).select("*").eq(chave, id).maybeSingle();
  if (!cab) return null;
  const c = cab as Linha;

  const [{ data: itens }, { data: colabRow }] = await Promise.all([
    supabase.from(tabelaItens).select("*").eq(chave, id),
    supabase
      .from("colaboradores_chabra")
      .select("*")
      .eq("id_colaborador", c.id_colaborador as string)
      .maybeSingle(),
  ]);

  const colab = (colabRow ?? {}) as Linha;
  const unidade = await nomeUnidade(supabase, txt(c.id_unidade));

  /**
   * O lado da BASE leva o nome de QUEM EMITIU, não o nome da base.
   *
   * A base já aparece no campo logo abaixo, e uma linha de assinatura embaixo de
   * "Quem entrega" com o nome de uma unidade escrito nela não faz sentido: quem
   * assina é uma pessoa. Na retirada isso é `responsavel_entrega` — preenchido
   * na tela com o nome de quem está registrando; na devolução, `recebido_por`.
   * Sem nenhum dos dois, cai para `criado_por`, que é o e-mail de quem gravou.
   */
  const emissor =
    txt(ehEntrega ? c.responsavel_entrega : c.recebido_por) ?? txt(c.criado_por) ?? unidade;

  const ladoBase: LadoTermo = {
    tipo: "base",
    nome: emissor ?? "—",
    unidade,
    matricula_cpf: null,
    setor: null,
    telefone: null,
    email: null,
  };
  const ladoPessoa: LadoTermo = {
    tipo: "colaborador",
    nome: txt(colab.nome) ?? "—",
    unidade,
    matricula_cpf: [txt(colab.matricula), txt(colab.cpf)].filter(Boolean).join(" / ") || null,
    setor: txt(colab.setor) ?? txt(colab.cargo),
    // A `colaboradores_chabra` não tem telefone — o campo do papel continua
    // existindo e sai em branco, para preenchimento à mão. É a lacuna conhecida.
    telefone: null,
    email: txt(colab.email),
  };

  const linhas = ((itens ?? []) as Linha[]).map<ItemTermo>((r) => ({
    patrimonio: txt(r.numero_patrimonio),
    descricao: txt(r.nome_equipamento),
    marca_modelo: null,
    serie: txt(r.numero_serie),
    nota_fiscal: null,
    quantidade: Number(r.quantidade) || 1,
    estado: ehEntrega
      ? null
      : (ROTULO_ESTADO[String(r.estado_retorno ?? "integro")] ?? txt(r.estado_retorno)),
  }));

  // Na devolução, a ressalva de cada item vira uma linha só no campo de avarias
  // — o quadro de itens não tem largura para um laudo.
  const ressalvas = ehEntrega
    ? null
    : ((itens ?? []) as Linha[])
        .filter((r) => txt(r.observacao_estado))
        .map((r) => `${txt(r.nome_equipamento) ?? "item"}: ${txt(r.observacao_estado)}`)
        .join(" · ") || null;

  // V4 — o termo lia UMA assinatura (a mais recente) e a imprimia na linha "Quem recebe".
  // Com tres papeis, se o validador assinasse por ultimo o documento trocava os papeis.
  // Agora le as tres, e cada uma vai para o seu lugar com metodo e score.
  let assinatura: Montado["assinatura"] = null;
  let hashAtual: string | null = null;
  const assinaturas: AssinaturaTermo[] = [];
  let historico: HistoricoTermo[] = [];
  if (ehEntrega) {
    const { data: linhasAssin } = await supabase
      .from("equipamentos_entrega_assinaturas")
      .select(
        "id_assinatura, papel, id_colaborador, assinante_nome, assinatura_png, assinado_em, metodo, match_score, finger_verificado, conteudo_sha256",
      )
      .eq("id_entrega", id)
      .order("assinado_em", { ascending: true });

    // B2/F3 — o hash do conteúdo AGORA, comparado com o que estava gravado no ato de
    // cada assinatura. Item acrescentado depois (medido: `insert` numa entrega assinada
    // devolve INSERT 0 1) faz os dois divergirem, e o termo para de afirmar
    // "digital verificada". Antes, o rodapé trazia um hash recalculado na impressão que
    // não era comparado com nada — o documento afirmava validade sem sustentar.
    const { data: hashAgora } = await (supabase as unknown as {
      rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown }>;
    }).rpc("equip_hash_conteudo_entrega", { p_id_entrega: id });
    hashAtual = typeof hashAgora === "string" ? hashAgora : null;

    for (const raw of (linhasAssin ?? []) as Linha[]) {
      const gravado = txt(raw.conteudo_sha256);
      assinaturas.push({
        papel: (txt(raw.papel) ?? "recebe") as "envia" | "recebe" | "valida",
        id_colaborador: txt(raw.id_colaborador),
        nome: txt(raw.assinante_nome),
        assinatura_png: txt(raw.assinatura_png),
        assinado_em: txt(raw.assinado_em),
        metodo: txt(raw.metodo),
        match_score: raw.match_score == null ? null : Number(raw.match_score),
        finger_verificado: raw.finger_verificado === true,
        conteudo_confere: gravado != null && hashAtual != null ? gravado === hashAtual : null,
        codigo: String(raw.id_assinatura ?? "").replace(/-/g, "").slice(0, 12).toUpperCase() || null,
      });
    }
    assinatura = assinaturas.find((a) => a.papel === "recebe") ?? assinaturas[0] ?? null;

    // O histórico vem pela sessão do usuário: a policy da tabela recorta por unidade,
    // então quem não pode ver a retirada não vê o que mudou nela.
    const { data: hist } = await supabase
      .from("equipamentos_entregas_historico")
      .select("acao, campo, valor_antes, valor_depois, motivo, usuario_email, criado_em")
      .eq("id_entrega", id)
      .order("criado_em", { ascending: true });
    historico = (hist ?? []) as HistoricoTermo[];
  }

  return {
    assinaturas,
    unidadeEmissora: unidade,
    origem: ehEntrega ? ladoBase : ladoPessoa,
    destino: ehEntrega ? ladoPessoa : ladoBase,
    itens: linhas,
    acessorios: null,
    observacoesEstado: ressalvas,
    motivo:
      txt(c.observacao) ??
      (ehEntrega ? "Retirada de equipamento pelo colaborador" : "Devolução de equipamento à base"),
    local: unidade,
    dataAto: txt(ehEntrega ? c.data_entrega : c.data_devolucao),
    assinatura,
    // O hash impresso no rodapé passa a ser o MESMO valor canônico que fica gravado na
    // linha da assinatura — antes era um hash recalculado na impressão, que a cláusula
    // legal citava como fonte de validade sem nunca ser comparado com nada.
    sha256: hashAtual,
    // `emitido` só faz sentido para retirada. Devolução não tem o campo, e marcá-la como
    // rascunho por omissão faria o termo dela sair com marca d'água sem motivo.
    emitido: ehEntrega ? c.emitido_em != null : true,
    cancelado:
      ehEntrega && c.cancelado_em
        ? { em: txt(c.cancelado_em), por: txt(c.cancelado_por), motivo: txt(c.cancelado_motivo) }
        : null,
    historico,
  };
}

/** Transferência entre bases — a tabela da v115/v136, que já guarda snapshot do
 *  aparelho nas colunas `maquina_*` (nome legado; o conteúdo é o equipamento). */
async function montarTransferencia(supabase: Cliente, id: string): Promise<Montado | null> {
  const { data } = await supabase
    .from("transferencias")
    .select("*")
    .eq("id_transferencia", id)
    .maybeSingle();
  if (!data) return null;
  const t = data as Linha;

  const [de, para] = await Promise.all([
    nomeUnidade(supabase, txt(t.de_id_unidade)),
    nomeUnidade(supabase, txt(t.para_id_unidade)),
  ]);

  // Mesma regra da retirada: o nome do lado que entrega é o de quem emitiu a
  // transferência (`responsavel_nome`), não o da unidade — que segue logo abaixo.
  const origem: LadoTermo = {
    tipo: "base",
    nome: txt(t.responsavel_nome) ?? de ?? txt(t.de_unidade) ?? "—",
    unidade: de ?? txt(t.de_unidade),
    matricula_cpf: null,
    setor: txt(t.de_localizacao),
    telefone: null,
    email: txt(t.responsavel_email),
  };
  const destino: LadoTermo = {
    tipo: "base",
    nome: txt(t.para_usuario_nome) ?? para ?? txt(t.para_unidade) ?? "—",
    unidade: para ?? txt(t.para_unidade),
    matricula_cpf: null,
    setor: txt(t.para_localizacao),
    telefone: null,
    email: txt(t.para_usuario_email),
  };

  const item: ItemTermo = {
    patrimonio: txt(t.maquina_numero_patrimonio),
    descricao: txt(t.maquina_nome),
    marca_modelo: [txt(t.maquina_marca), txt(t.maquina_modelo)].filter(Boolean).join(" · ") || null,
    serie: txt(t.maquina_numero_serie),
    nota_fiscal: null,
    quantidade: Number(t.quantidade) || 1,
    estado: null,
  };

  const assinatura = t.assinatura_png
    ? {
        nome: txt(t.assinante_nome) ?? txt(t.para_usuario_nome),
        assinatura_png: txt(t.assinatura_png),
        assinado_em: txt(t.assinado_em),
        metodo: "canvas",
        codigo: String(id).replace(/-/g, "").slice(0, 12).toUpperCase(),
      }
    : null;

  // ⚠️ Metade das transferencias existentes (2 de 4, medido em 26/08/2026) e
  // anterior a FK de unidade da v136 e tem `de_id_unidade` NULL — o nome da
  // base so existe na coluna de texto `de_unidade`. Sem esta reserva, o termo
  // dessas linhas sai com "Unidade emissora: —" e "Local: —" enquanto o bloco
  // das partes, que ja caia para o texto, imprime o nome logo abaixo. Dois
  // campos vazios num documento que a pessoa assina.
  const deExibicao = de ?? txt(t.de_unidade);

  return {
    unidadeEmissora: deExibicao,
    origem,
    destino,
    itens: [item],
    acessorios: null,
    observacoesEstado: txt(t.observacoes),
    motivo: txt(t.motivo) ?? "Transferência entre bases",
    local: deExibicao,
    dataAto: txt(t.data_hora) ?? txt(t.created_at),
    assinatura,
    // A v136 já grava o hash do PDF assinado no aceite. Quando ele existe, é
    // mais forte que o hash de conteúdo — então prevalece.
    sha256: txt(t.pdf_sha256),
  };
}

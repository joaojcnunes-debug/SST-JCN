import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  mapearForm, mapearPergunta, mapearTitulo, slugEtapa, slugStatus, automacoesRoteamentoSST,
  MAPA_BOARDS, UNIDADES, CAMPO_PRODUTOS_ID, CAMPO_TIPO_CLIENTE_ID, QUADRO_SST_ENTRADA,
  type RRForm, type RRQuestion, type CtxMapa,
} from "./runrun-forms-mapa";

const ctx: CtxMapa = {
  campoDestino: (fk, quadro, nome) => (fk === "custom_86" ? `campo:${CAMPO_PRODUTOS_ID}` : fk === "custom_100" ? `campo:${CAMPO_TIPO_CLIENTE_ID}` : `campo:novo-${quadro}-${nome}`),
};

function q(partial: Partial<RRQuestion> & { id: number; type: string; label: string }): RRQuestion {
  return { field_key: null, required: false, description: null, ...partial };
}
function form(partial: Partial<RRForm> & { id: number; board_id: number; questions: RRQuestion[] }): RRForm {
  return {
    title: "F", is_active: true, answers_count: 0, board_name: "B", board_stage_id: 1, board_stage_name: "A fazer",
    task_type_id: 1, task_type_name: "Baixo", tags: [], title_pattern: ["form_title"], is_public: false,
    is_shared_by_link: false, should_collect_sender_email: true, should_send_answers_to_sender_email: false,
    should_sender_become_guest: false, should_show_recaptcha: false, should_redirect: false, redirect_url: null,
    custom_confirmation: null, description: null, ...partial,
  };
}

describe("slugEtapa / slugStatus", () => {
  test("quadro existente usa o slug medido; SST usa o slug da unidade; novo usa slug gerado", () => {
    assert.equal(slugEtapa(598871, "Novos chamados"), "A_FAZER");
    assert.equal(slugEtapa(594780, "Orçamento - Aguardando Aprovação"), "ORC_AG_APROV");
    assert.equal(slugEtapa(594810, "Revisões a Fazer"), "REVISOES_A_FAZER");
    assert.equal(slugEtapa(594810, "Documentações Retroativas"), "DOC_RETROATIVAS");
    assert.equal(slugEtapa(597675, "Envio do formulário"), "ENVIO_DO_FORMULARIO");
    assert.equal(slugStatus("Orçamento - Aguardando Aprovação"), "ORCAMENTO_AGUARDANDO_APROVACAO");
  });
});

describe("mapearPergunta", () => {
  const f = form({ id: 1, board_id: 594810, questions: [] });
  const alvo = MAPA_BOARDS[594810]!;
  test("tipos básicos + creator_email + documents", () => {
    const av: string[] = [];
    assert.equal(mapearPergunta(q({ id: 1, type: "short_text", label: "Razão Social", required: true }), f, alvo, ctx, av).tipo, "texto");
    assert.equal(mapearPergunta(q({ id: 2, type: "cnpj", label: "CNPJ" }), f, alvo, ctx, av).tipo, "cnpj");
    assert.equal(mapearPergunta(q({ id: 3, type: "date_time", label: "Quando" }), f, alvo, ctx, av).tipo, "data_hora");
    const ce = mapearPergunta(q({ id: 4, type: "creator_email", label: "Seu email" }), f, alvo, ctx, av);
    assert.equal(ce.tipo, "email"); assert.equal(ce.obrigatorio, true);
    const doc = mapearPergunta(q({ id: 5, type: "documents", label: "Anexos", required: true }), f, alvo, ctx, av);
    assert.equal(doc.tipo, "texto_longo"); assert.equal(doc.pendente_anexo, true); assert.equal(doc.obrigatorio, false);
    assert.equal(av.length, 1);
  });
  test("tags → seleção de unidade em etiquetas; custom_86/100 → campos globais; outro custom → campo do quadro", () => {
    const av: string[] = [];
    const tg = mapearPergunta(q({ id: 6, type: "tags", label: "Região", field_key: "tags" }), f, alvo, ctx, av);
    assert.equal(tg.destino, "etiquetas"); assert.deepEqual(tg.opcoes, UNIDADES.map((u) => u.label));
    const pr = mapearPergunta(q({ id: 7, type: "multiple_options", label: "Produtos", field_key: "custom_86", options: [{ id: 1, label: "PGR", field_option_id: 1 }] }), f, alvo, ctx, av);
    assert.equal(pr.destino, `campo:${CAMPO_PRODUTOS_ID}`); assert.deepEqual(pr.opcoes, ["PGR"]); assert.equal(pr.tipo, "multipla");
    const tc = mapearPergunta(q({ id: 8, type: "single_option", label: "Tipo de Cliente", field_key: "custom_100", options: [{ id: 1, label: "Mensal", field_option_id: 1 }] }), f, alvo, ctx, av);
    assert.equal(tc.destino, `campo:${CAMPO_TIPO_CLIENTE_ID}`);
    const outro = mapearPergunta(q({ id: 9, type: "single_option", label: "Orçamento Químico", field_key: "custom_87", options: [{ id: 1, label: "Sim", field_option_id: 1 }] }), f, alvo, ctx, av);
    assert.equal(outro.destino, `campo:novo-${alvo.id_quadro}-Orçamento Químico`);
    const livre = mapearPergunta(q({ id: 10, type: "single_option", label: "Estado civil", options: [{ id: 1, label: "Solteiro", field_option_id: null }] }), f, alvo, ctx, av);
    assert.equal(livre.destino, "descricao"); assert.deepEqual(livre.opcoes, ["Solteiro"]);
  });
  test("ramificação vira condicao {pergunta: rr<origem>, opcao}", () => {
    const origem = q({ id: 20, type: "single_option", label: "Houve CAT?", options: [{ id: 100, label: "Sim", field_option_id: null }], ramifications: [{ id: 555, option_id: 100, option_label: "Sim" }] });
    const alvoQ = q({ id: 21, type: "documents", label: "Anexar a CAT", ramification_id: 555 });
    const f2 = form({ id: 2, board_id: 595427, questions: [origem, alvoQ] });
    const av: string[] = [];
    const p = mapearPergunta(alvoQ, f2, MAPA_BOARDS[595427]!, ctx, av);
    assert.deepEqual(p.condicao, { pergunta: "rr20", opcao: "Sim" });
    const semOrigem = mapearPergunta(q({ id: 22, type: "short_text", label: "x", ramification_id: 999 }), f2, MAPA_BOARDS[595427]!, ctx, av);
    assert.equal(semOrigem.condicao, undefined);
    assert.ok(av.some((a) => a.includes("999")));
  });
});

describe("mapearTitulo / mapearForm", () => {
  test("pattern com ids vira p:rr<id>; só form_title mantém composição", () => {
    assert.deepEqual(mapearTitulo(form({ id: 1, board_id: 594780, questions: [], title_pattern: [11, "form_title"] })), ["p:rr11", "form_title"]);
    assert.deepEqual(mapearTitulo(form({ id: 1, board_id: 594780, questions: [], title_pattern: ["form_title"] })), ["form_title"]);
    assert.equal(mapearTitulo(form({ id: 1, board_id: 594780, questions: [], title_pattern: [] })), null);
  });
  test("form completo: alvo, status, prioridade, etiquetas extra, prazo por field_key, origem", () => {
    const av: string[] = [];
    const m = mapearForm(form({
      id: 122436, board_id: 594780, board_name: "Comercial", board_stage_name: "Orçamento - Aguardando Aprovação",
      task_type_name: "Verificar com o Supervisor", tags: ["VIP"], title: "Cadastro de empresa - Comercial", answers_count: 606,
      questions: [q({ id: 1, type: "short_text", label: "Razão Social", required: true }), q({ id: 2, type: "date", label: "Entrega", field_key: "desired_delivery_date" })],
      title_pattern: [1],
    }), ctx, av)!;
    assert.equal(m.id_quadro, "QDR-AAFEE5F3");
    assert.equal(m.status_inicial, "ORC_AG_APROV");
    assert.equal(m.prioridade_padrao, "Alta");
    assert.deepEqual(m.etiquetas_padrao, ["verificar-supervisor", "vip"]);
    assert.equal(m.perguntas[1].destino, "prazo");
    assert.deepEqual(m.titulo_composicao, ["p:rr1"]);
    assert.equal(m.origem.answers_count, 606);
    assert.equal(m.mostra_descricao, false);
  });
  test("board sem alvo (Agenda) é ignorado com aviso", () => {
    const av: string[] = [];
    assert.equal(mapearForm(form({ id: 9, board_id: 596354, questions: [] }), ctx, av), null);
    assert.equal(av.length, 1);
  });
});

describe("automacoesRoteamentoSST", () => {
  test("6 unidades × 3 etapas ativas = 18, movendo para a unidade na MESMA etapa", () => {
    const a = automacoesRoteamentoSST();
    assert.equal(a.length, 18);
    const t = a.find((x) => x.nome.includes("Teresópolis") && x.nome.includes("Revisões"))!;
    assert.deepEqual(t.condicao, { all: [{ campo: "status", op: "=", valor: "REVISOES_A_FAZER" }, { campo: "etiqueta", op: "contains", valor: "teresopolis" }] });
    assert.deepEqual(t.acao, { tipo: "mover_tarefa_quadro", id_quadro_destino: "QDR-CBDD056A", status_destino: "REVISOES_A_FAZER" });
    assert.equal(t.gatilho, "tarefa_criada");
    assert.ok(a.every((x) => (x.acao as { id_quadro_destino: string }).id_quadro_destino !== QUADRO_SST_ENTRADA));
  });
});

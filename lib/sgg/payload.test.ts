import test from "node:test";
import assert from "node:assert/strict";
import { parseLista, montarPayloadSetor, podeReprocessar, DATA_ESTEIRA, VALIDADE_ESTEIRA } from "./payload";

const base = {
  id_risco: "RSC-1", agente: "Ruído", id_setor: "SET-1",
  probabilidade: "Exposição moderada", severidade: "Preocupantes",
  tempo_exposicao: "Permanente", meio_propagacao: ["Sonora"],
  fonte_geradora: '["Ambiente"]', tecnica_utilizada: "Qualitativa",
  situacao: "Controlada", numero_cas: null, via_absorcao: null,
  tipo_agente_biologico: null, fator_ergonomico: null, fator_psicossocial: null,
  pontuacao_iapat: null, observacoes_risco: null,
};
const arg = (riscos: unknown[]) => ({ sggIdEmpresa: "3204", sggIdSetor: "17219", sggIdsCargos: ["29416"], riscos: riscos as never });

test("parseLista cobre os 3 formatos reais", () => {
  assert.deepEqual(parseLista('["A","B"]'), ["A", "B"]);
  assert.deepEqual(parseLista("texto puro"), ["texto puro"]);   // ~77 registros
  assert.deepEqual(parseLista(""), []);
  assert.deepEqual(parseLista("[quebrado"), ["[quebrado"]);      // nao lanca
});

test("payload valido usa datas da esteira e nao manda nivel pronto", () => {
  const r = montarPayloadSetor(arg([base])) as { payload: Record<string, unknown> };
  assert.equal(r.payload.data, DATA_ESTEIRA);
  assert.equal(r.payload.data_validade, VALIDADE_ESTEIRA);
  const risco = (r.payload.riscos as Record<string, unknown>[])[0];
  assert.equal(risco.nivel_risco, "");
  assert.equal(risco.classificacao_risco, "");
  assert.equal(risco.matriz_risco, "AIHA");
  assert.equal(risco.peso_criterio_nivel_1, "Exposição moderada");
});

test("D3.3: tempo ausente BLOQUEIA e nomeia o risco", () => {
  const r = montarPayloadSetor(arg([{ ...base, tempo_exposicao: null }])) as { impedimentos: { agente: string; motivo: string }[] };
  assert.equal(r.impedimentos.length, 1);
  assert.equal(r.impedimentos[0].agente, "Ruído");
  assert.match(r.impedimentos[0].motivo, /tempo de exposição/);
});

test("meios de propagacao vao SEMPRE vazios (o SGG valida contra o AGENTE)", () => {
  // Medido 23/09: com o agente "Queda em mesmo nivel", D40035 para "Corporal",
  // "Nao Aplicavel" e "Contato fisico" -- os tres no catalogo global do SGG. Um
  // meio invalido recusa a avaliacao INTEIRA; sem o campo, o payload passou
  // (sgg_id 42534). Religar so com o vinculo agente -> meios.
  const r = montarPayloadSetor(arg([{ ...base, meio_propagacao: ["Corporal"] }])) as { payload: Record<string, unknown> };
  const risco = (r.payload.riscos as Record<string, unknown>[])[0];
  assert.deepEqual(risco.meios_propagacao, []);
});

test("rotulo desconhecido bloqueia nomeando o risco", () => {
  const r = montarPayloadSetor(arg([{ ...base, probabilidade: "Moderada" }])) as { impedimentos: { motivo: string }[] };
  assert.match(r.impedimentos[0].motivo, /Moderada/);
});

test("setor sem cargos bloqueia", () => {
  const r = montarPayloadSetor({ ...arg([base]), sggIdsCargos: [] }) as { impedimentos: unknown[] };
  assert.equal(r.impedimentos.length, 1);
});

// Regressao do achado do portao (23/09), agora contra a funcao REAL que a rota
// importa — antes o teste redefinia a regra e passaria mesmo se a rota mudasse.
// A unique (id_inspecao,id_setor,data) NAO
// filtra status, entao o 23505 dispara tambem quando a tentativa anterior falhou.
// Responder "duplicado" ali deixava o setor fora do SGG para sempre com a UI
// dizendo que estava la. A regra que a rota aplica esta isolada aqui.
test("reenvio so e liberado quando o SGG RECUSOU com codigo (nada criado la)", () => {
  // SGG recusou: seguro reaproveitar a linha e postar de novo
  assert.equal(podeReprocessar("erro", "D40027"), true);   // agente fora do catalogo
  assert.equal(podeReprocessar("erro", "D40082"), true);   // rotulo inexistente
  assert.equal(podeReprocessar("erro", "D40086"), true);   // celula nao resolve

  // ambiguo ou ja gravado: NUNCA reenviar as cegas (a API nao tem DELETE)
  assert.equal(podeReprocessar("erro", "PARSE"), false);   // corpo nao reconhecido
  assert.equal(podeReprocessar("erro", null), false);      // falha sem codigo
  assert.equal(podeReprocessar("indeterminado", null), false);
  assert.equal(podeReprocessar("enviado", "D000"), false);
  assert.equal(podeReprocessar("duplicado", "D40017"), false);
  assert.equal(podeReprocessar("pendente", null), false);
});

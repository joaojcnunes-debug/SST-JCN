import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarNomeFator, resolverFator, type PsicoFator } from "./fatores";
import { TOPICOS } from "@/lib/drps/topicos";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";

// Espelho do seed da v295.
const FATORES: PsicoFator[] = [
  ["assedio", "Assédio de qualquer natureza"],
  ["eventos_traumaticos", "Eventos violentos ou traumáticos"],
  ["sobrecarga", "Excesso de demandas no trabalho (Sobrecarga)"],
  ["recompensas", "Baixas recompensas e reconhecimento"],
  ["falta_suporte", "Falta de suporte / Apoio no trabalho"],
  ["subcarga", "Baixa demanda no trabalho (Subcarga)"],
  ["gestao_mudancas", "Má gestão de mudanças organizacionais"],
  ["maus_relacionamentos", "Maus relacionamentos no local de trabalho"],
  ["baixo_controle", "Baixo controle no trabalho / Falta de autonomia"],
  ["clareza_papel", "Baixa clareza de papel / Função"],
  ["comunicacao_dificil", "Trabalho em condições de difícil comunicação"],
  ["justica_organizacional", "Baixa justiça organizacional"],
  ["trabalho_remoto", "Trabalho remoto e isolado"],
].map(([id_fator, nome], i) => ({ id_fator, nome, nome_curto: nome, ordem: i + 1, ativo: true }));

test("normaliza tópico do DRPS", () => {
  assert.equal(normalizarNomeFator("Tópico 02 - Falta de suporte/apoio no trabalho"), "falta de suporte apoio no trabalho");
});

test("os 13 tópicos do DRPS acham o fator sem de-para gravado", () => {
  const achados = TOPICOS.map((t) => resolverFator("DRPS", t.nome, FATORES, []).id_fator);
  assert.equal(achados.filter(Boolean).length, 13);
  assert.equal(new Set(achados).size, 13, "cada tópico num fator diferente");
});

test("os 13 fatores da AEP (rótulo) acham o próprio id", () => {
  for (const it of ITENS_ORGANIZACIONAL) {
    assert.equal(resolverFator("AEP", it.label, FATORES, []).id_fator, it.key, it.label);
  }
});

test("de-para gravado vence a sugestão", () => {
  const r = resolverFator("QPS", "Demandas", FATORES, [{ origem: "QPS", valor_origem: "Demandas", id_fator: "sobrecarga" }]);
  assert.deepEqual(r, { id_fator: "sobrecarga", como: "depara" });
});

test("categoria do QPS com nome livre vira sugestão; ambígua fica sem", () => {
  assert.equal(resolverFator("QPS", "Reconhecimento e recompensas", FATORES, []).id_fator, "recompensas");
  assert.equal(resolverFator("QPS", "Subcarga de trabalho", FATORES, []).id_fator, "subcarga");
  assert.equal(resolverFator("QPS", "Clima geral", FATORES, []).id_fator, null);
  // "apoio" (suporte) + "comunicação" → empate, sem sugestão
  assert.equal(resolverFator("QPS", "Apoio e comunicação", FATORES, []).id_fator, null);
});

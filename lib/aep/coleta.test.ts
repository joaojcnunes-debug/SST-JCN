import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fraseCondicoesColeta,
  limitacoesDaAvaliacao,
  niSemMotivo,
  normalizarCondicoesColeta,
  normalizarMotivoNi,
  participantesExcedem,
  temReceioManifestacao,
} from "./coleta";
import { recomendaQuestionario } from "./sinalizacao";
import { ROTEIRO_CAMPO } from "./roteiro-campo";
import { ITENS_ORGANIZACIONAL } from "./checklist-itens";
import type { AepRelatorio } from "@/lib/supabase/types";

const rot = (k: string) => ({ assedio: "Assédio", sobrecarga: "Sobrecarga" })[k] ?? k;

test("N/I sem motivo e 'outro' sem texto são cobrados; com motivo, não", () => {
  const s = {
    checklist_organizacional: { assedio: "nao_identificado", sobrecarga: "nao_identificado", subcarga: "nao_identificado", recompensas: "sim" },
    motivo_ni: {
      assedio: { motivo: "receio_manifestacao" as const },
      sobrecarga: { motivo: "outro" as const, texto: "  " },
    },
  };
  assert.deepEqual(niSemMotivo(s), ["sobrecarga", "subcarga"]);
});

test("receio: N/I com motivo de receio ou sinal de inibição; motivo de fator que não é mais N/I não conta", () => {
  assert.equal(
    temReceioManifestacao({ checklist_organizacional: { assedio: "nao_identificado" }, motivo_ni: { assedio: { motivo: "receio_manifestacao" } } }),
    true,
  );
  assert.equal(
    temReceioManifestacao({ checklist_organizacional: { assedio: "sim" }, motivo_ni: { assedio: { motivo: "receio_manifestacao" } } }),
    false,
  );
  assert.equal(temReceioManifestacao({ condicoes_coleta: { sinais_inibicao: ["lideranca_olhar"] } }), true);
  assert.equal(temReceioManifestacao({ condicoes_coleta: { sinais_inibicao: [] } }), false);
});

test("DRPS: 3+ 'Sim' como antes, ou receio de manifestação em algum setor", () => {
  const base = { checklist_organizacional: { assedio: "sim" } };
  const setores = (xs: object[]) => xs as unknown as AepRelatorio["setores"];
  assert.equal(recomendaQuestionario(setores([base])), false);
  assert.equal(recomendaQuestionario(setores([base, base, base])), true);
  assert.equal(recomendaQuestionario(setores([{ ...base, condicoes_coleta: { sinais_inibicao: ["recusa_participar"] } }])), true);
});

test("limitações da avaliação trazem o motivo de cada N/I", () => {
  const l = limitacoesDaAvaliacao(
    {
      checklist_organizacional: { assedio: "nao_identificado", sobrecarga: "nao_identificado", subcarga: "nao" },
      motivo_ni: { assedio: { motivo: "receio_manifestacao" }, sobrecarga: { motivo: "outro", texto: "turno noturno" } },
    },
    rot,
  );
  assert.deepEqual(l, [
    "Assédio: não identificável — Receio dos trabalhadores em se manifestar",
    "Sobrecarga: não identificável — turno noturno",
  ]);
});

test("frase das condições da coleta", () => {
  assert.equal(fraseCondicoesColeta({}), null);
  assert.equal(
    fraseCondicoesColeta({
      trab_abordados: 8,
      trab_participantes: 5,
      recusas_evasivas: 2,
      lideranca_presente: true,
      sinais_inibicao: ["lideranca_olhar"],
    }),
    "Foram abordados 8 trabalhadores, dos quais 5 participaram da coleta; 2 recusas ou respostas evasivas; a coleta ocorreu com a liderança presente. Durante a coleta, observou-se receio dos trabalhadores em se manifestar na presença da liderança (trabalhadores olham para a liderança antes de responder).",
  );
});

test("participantes acima dos abordados", () => {
  assert.equal(participantesExcedem({ trab_abordados: 3, trab_participantes: 4 }), true);
  assert.equal(participantesExcedem({ trab_abordados: 3, trab_participantes: 3 }), false);
  assert.equal(participantesExcedem({ trab_participantes: 4 }), false);
});

test("normalização descarta lixo do jsonb", () => {
  assert.deepEqual(normalizarMotivoNi({ assedio: { motivo: "xx" }, sobrecarga: 3 }), { assedio: { motivo: "" } });
  const c = normalizarCondicoesColeta({ trab_abordados: -1, trab_participantes: 2.7, sinais_inibicao: ["lideranca_olhar", "inventado", 4] });
  assert.equal(c.trab_abordados, null);
  assert.equal(c.trab_participantes, 2);
  assert.deepEqual(c.sinais_inibicao, ["lideranca_olhar"]);
});

test("roteiro de campo cobre os 13 fatores", () => {
  for (const f of ITENS_ORGANIZACIONAL) {
    const r = ROTEIRO_CAMPO[f.key];
    assert.ok(r && r.perguntas.length > 0 && r.observar.length > 0, f.key);
  }
});

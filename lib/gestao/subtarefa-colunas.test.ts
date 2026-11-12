import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  fmtHorasTrabalhadas, progressoExibir, fmtDataDesejada, entregaAtrasada, corTextoSobre, etapaExibir, alocadosExibir,
  vemDoRunrun, etapaDaLinha, erroDatasSubtarefa,
} from "./subtarefa-colunas";
import type { GestaoStatus } from "@/lib/hooks/useGestao";

describe("fmtHorasTrabalhadas", () => {
  test("como o Runrun: 00h00, minutos inteiros, horas sem limite", () => {
    assert.equal(fmtHorasTrabalhadas(0), "00h00");
    assert.equal(fmtHorasTrabalhadas(null), "00h00");
    assert.equal(fmtHorasTrabalhadas(3599), "00h59");
    assert.equal(fmtHorasTrabalhadas(3600 + 5 * 60), "01h05");
    assert.equal(fmtHorasTrabalhadas(123 * 3600), "123h00");
  });
});

describe("progressoExibir", () => {
  test("arredonda, não corta o texto e a barra para em 100", () => {
    assert.deepEqual(progressoExibir(0), { texto: "0%", barra: 0 });
    assert.deepEqual(progressoExibir(null), { texto: "0%", barra: 0 });
    assert.deepEqual(progressoExibir(42.6), { texto: "43%", barra: 42.6 });
    assert.deepEqual(progressoExibir(3393.64), { texto: "3394%", barra: 100 });
  });
});

describe("fmtDataDesejada", () => {
  test("horário de Brasília, dd/mm/aaaa hh:mm (23:59 aparece, como no Runrun)", () => {
    assert.equal(fmtDataDesejada("2026-10-28T12:00:00-03:00"), "28/10/2026 12:00");
    assert.equal(fmtDataDesejada("2026-10-28T15:00:00+00:00"), "28/10/2026 12:00");
    assert.equal(fmtDataDesejada(null), null);
    assert.equal(fmtDataDesejada("lixo"), null);
    assert.equal(fmtDataDesejada("2026-07-22T23:59:59-03:00"), "22/07/2026 23:59");
  });
});

describe("entregaAtrasada", () => {
  const agora = new Date("2026-11-11T12:00:00-03:00");
  test("vencida e aberta → atrasada; feita, sem data ou no futuro → não", () => {
    assert.equal(entregaAtrasada("2026-07-22T23:59:59-03:00", false, agora), true);
    assert.equal(entregaAtrasada("2026-07-22T23:59:59-03:00", true, agora), false);
    assert.equal(entregaAtrasada(null, false, agora), false);
    assert.equal(entregaAtrasada("2026-11-11T23:59:59-03:00", false, agora), false);
  });
});

describe("corTextoSobre", () => {
  test("branco no vermelho e no laranja; escuro nas cores claras", () => {
    assert.equal(corTextoSobre("#F90D0D"), "#ffffff");
    assert.equal(corTextoSobre("#FF6800"), "#ffffff");
    assert.equal(corTextoSobre("#DCEDC8"), "#1f2937");
    assert.equal(corTextoSobre("#F8BBD0"), "#1f2937");
    assert.equal(corTextoSobre(null), "#ffffff");
  });
});

describe("etapaExibir", () => {
  const st: Pick<GestaoStatus, "slug" | "nome" | "tipo">[] = [
    { slug: "ELABORACAO_PROGRAMAS", nome: "Elaboração dos programas", tipo: "ativo" },
    { slug: "CONCLUIDA", nome: "Concluída", tipo: "concluido" },
  ];
  test("nome do Runrun primeiro; verde quando a etapa é de conclusão", () => {
    assert.deepEqual(etapaExibir({ etapa_nome: "Concluída", etapa: "CONCLUIDA", feito: true }, st), { nome: "Concluída", concluida: true });
    assert.deepEqual(etapaExibir({ etapa_nome: "Revisões a Fazer", feito: false }, st), { nome: "Revisões a Fazer", concluida: false });
  });
  test("sem nome do Runrun: o da etapa do SST no quadro", () => {
    assert.deepEqual(etapaExibir({ etapa: "ELABORACAO_PROGRAMAS", feito: false }, st), { nome: "Elaboração dos programas", concluida: false });
  });
  test("etapa de outro quadro: verde pelo feito", () => {
    assert.deepEqual(etapaExibir({ etapa_nome: "Finalizado", feito: true }, st), { nome: "Finalizado", concluida: true });
  });
  test("subtarefa da Gestão sem etapa: nada", () => {
    assert.equal(etapaExibir({ feito: false }, st), null);
  });
});

describe("alocadosExibir", () => {
  const nomeDe = (e: string) => (e === "isaac.melo@chabra.com.br" ? "Isaac Melo (Gestão)" : null);
  test("pessoas do Runrun, com o nome da Gestão quando houver", () => {
    const r = alocadosExibir({
      alocados: [{ email: "isaac.melo@chabra.com.br", nome: "Isaac Melo", feito: true }, { email: "x@chabra.com.br", nome: "Xis", feito: false }],
      responsavel_email: "isaac.melo@chabra.com.br", feito: false,
    }, nomeDe);
    assert.deepEqual(r.map((a) => [a.nome, a.feito]), [["Isaac Melo (Gestão)", true], ["Xis", false]]);
  });
  test("sem alocados do Runrun: o responsável; sem responsável: ninguém", () => {
    assert.deepEqual(alocadosExibir({ alocados: [], responsavel_email: "y@chabra.com.br", feito: false }, nomeDe), [{ email: "y@chabra.com.br", nome: "y@chabra.com.br", feito: false }]);
    assert.deepEqual(alocadosExibir({ alocados: null, responsavel_email: null, feito: false }, nomeDe), []);
  });
  test("todos os responsáveis da janela, sem repetir o da linha (11/11/2026)", () => {
    const r = alocadosExibir({
      alocados: [], responsavel_email: "Ana@chabra.com.br", feito: false,
      responsaveis: ["ana@chabra.com.br", "isaac.melo@chabra.com.br", "bia@chabra.com.br"],
    }, nomeDe);
    assert.deepEqual(r.map((a) => a.nome), ["Ana@chabra.com.br", "Isaac Melo (Gestão)", "bia@chabra.com.br"]);
    const rr = alocadosExibir({
      alocados: [{ email: "x@chabra.com.br", nome: "Xis", feito: true }], responsavel_email: null, feito: false,
      responsaveis: ["x@chabra.com.br", "y@chabra.com.br"],
    }, nomeDe);
    assert.deepEqual(rr.map((a) => [a.nome, a.feito]), [["Xis", true], ["y@chabra.com.br", false]]);
  });
});

describe("vemDoRunrun", () => {
  test("só a linha do importador (SRR-) é do Runrun", () => {
    assert.equal(vemDoRunrun("SRR-123456"), true);
    assert.equal(vemDoRunrun("SUB-AB12CD34"), false);
    assert.equal(vemDoRunrun(undefined), false);
    assert.equal(vemDoRunrun(""), false);
  });
});

describe("etapaDaLinha", () => {
  const st = [
    { slug: "FEITO", tipo: "concluido" as const, ordem: 3 },
    { slug: "FAZENDO", tipo: "ativo" as const, ordem: 2 },
    { slug: "A_FAZER", tipo: "nao_iniciado" as const, ordem: 1 },
  ];
  test("a etapa da janela vale quando existe no quadro", () => {
    assert.equal(etapaDaLinha(false, "FAZENDO", st), "FAZENDO");
    assert.equal(etapaDaLinha(true, "FAZENDO", st), "FAZENDO");
  });
  test("sem janela (ou etapa de outro quadro): pelo feito, como o banco faria ao abrir", () => {
    assert.equal(etapaDaLinha(false, null, st), "A_FAZER");
    assert.equal(etapaDaLinha(true, null, st), "FEITO");
    assert.equal(etapaDaLinha(false, "OUTRO", st), "A_FAZER");
  });
  test("quadro sem 'não iniciado': a 1ª não concluída; sem etapas: nada", () => {
    assert.equal(etapaDaLinha(false, null, st.filter((s) => s.tipo !== "nao_iniciado")), "FAZENDO");
    assert.equal(etapaDaLinha(false, null, []), null);
  });
});

describe("erroDatasSubtarefa", () => {
  const vazio = { data_inicio: null, hora_inicio: null, prazo: null, hora_fim: null };
  test("sem datas ou datas em ordem: pode gravar", () => {
    assert.equal(erroDatasSubtarefa(vazio), null);
    assert.equal(erroDatasSubtarefa({ ...vazio, data_inicio: "2026-11-12", prazo: "2026-11-14" }), null);
    assert.equal(erroDatasSubtarefa({ data_inicio: "2026-11-12", hora_inicio: "08:00", prazo: "2026-11-12", hora_fim: "10:00" }), null);
  });
  test("hora sem data, início depois da entrega e hora fim antes do início no mesmo dia", () => {
    assert.match(erroDatasSubtarefa({ ...vazio, hora_inicio: "08:00" }) ?? "", /data do início/);
    assert.match(erroDatasSubtarefa({ ...vazio, hora_fim: "08:00" }) ?? "", /data da entrega/);
    assert.match(erroDatasSubtarefa({ ...vazio, data_inicio: "2026-11-15", prazo: "2026-11-14" }) ?? "", /depois da entrega/);
    assert.match(erroDatasSubtarefa({ data_inicio: "2026-11-12", hora_inicio: "10:00", prazo: "2026-11-12", hora_fim: "09:00" }) ?? "", /mesmo dia/);
  });
});

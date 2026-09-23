import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  acaoCentralDeAetAcao,
  acoesEnviaveis,
  agruparAcoesPorSetor,
  contextoIaDaAcao,
  prazoIaParaTexto,
  prazoTextoParaData,
} from "./acoes";
import type { AetAcao } from "@/lib/supabase/types";

function acao(over: Partial<AetAcao> = {}): AetAcao {
  return {
    id_acao: "AAC-1",
    id_relatorio: "REL-1",
    id_setor: null,
    ordem: 0,
    what_acao: "Ajustar cadeiras",
    why_justificativa: null,
    where_local: null,
    when_prazo: null,
    who_responsavel: null,
    how_metodo: null,
    how_much_custo: null,
    status: "Pendente",
    prioridade: "Media",
    data_conclusao: null,
    observacoes: null,
    created_by: null,
    created_at: "2026-09-11T00:00:00Z",
    updated_at: null,
    ...over,
  };
}

const SETORES = [
  { id: "S-COZ", nome_setor: "COZINHA" },
  { id: "S-ADM", nome_setor: "ADMINISTRATIVO" },
];

describe("agruparAcoesPorSetor", () => {
  test("segue a ordem dos SETORES do laudo, não a de criação", () => {
    const grupos = agruparAcoesPorSetor(
      [
        acao({ id_acao: "a", id_setor: "S-ADM", ordem: 0 }),
        acao({ id_acao: "b", id_setor: "S-COZ", ordem: 1 }),
      ],
      SETORES,
    );
    assert.deepEqual(grupos.map((g) => g.setor?.id), ["S-COZ", "S-ADM"]);
  });

  test("dentro do setor vale `ordem`", () => {
    const [g] = agruparAcoesPorSetor(
      [
        acao({ id_acao: "b", id_setor: "S-COZ", ordem: 5 }),
        acao({ id_acao: "a", id_setor: "S-COZ", ordem: 2 }),
      ],
      SETORES,
    );
    assert.deepEqual(g.acoes.map((a) => a.id_acao), ["a", "b"]);
  });

  test("setor sem ação não gera grupo", () => {
    const grupos = agruparAcoesPorSetor([acao({ id_setor: "S-COZ" })], SETORES);
    assert.equal(grupos.length, 1);
    assert.equal(grupos[0].setor?.id, "S-COZ");
  });

  test("sem setor E setor apagado caem nas gerais, por último", () => {
    const grupos = agruparAcoesPorSetor(
      [
        acao({ id_acao: "orfa", id_setor: "S-APAGADO", ordem: 0 }),
        acao({ id_acao: "coz", id_setor: "S-COZ", ordem: 1 }),
        acao({ id_acao: "geral", id_setor: null, ordem: 2 }),
      ],
      SETORES,
    );
    assert.deepEqual(grupos.map((g) => g.setor?.id ?? null), ["S-COZ", null]);
    assert.deepEqual(grupos[1].acoes.map((a) => a.id_acao), ["orfa", "geral"]);
  });

  test("lista vazia → nenhum grupo (o capítulo do laudo não imprime)", () => {
    assert.deepEqual(agruparAcoesPorSetor([], SETORES), []);
  });
});

describe("contextoIaDaAcao", () => {
  test("a recomendação do setor vai LIMPA de HTML como medidasRecomendadas", () => {
    const ctx = contextoIaDaAcao({
      empresa: { nome: "PIZZARIA", cnpj: "00.000.000/0001-00" },
      setor: {
        id: "S-COZ",
        nome_setor: "COZINHA",
        descricao_atividade: "<p>Preparo de massas</p>",
        parecer_tecnico: "<p>Posto <strong>inadequado</strong></p>",
        recomendacoes: "<p>Manter o mobili&aacute;rio regulado.&nbsp;Incentivar pausas.</p>",
      },
      parcial: { what_acao: "" },
    });
    assert.equal(ctx.setor?.nome, "COZINHA");
    assert.equal(ctx.setor?.descricao, "Preparo de massas");
    assert.equal(ctx.risco?.tipo, "Ergonômico");
    assert.equal(ctx.risco?.fonte, "Parecer técnico: Posto inadequado");
    // &aacute; não é traduzido pelo htmlParaTexto (só &nbsp;/&amp;/&lt;/&gt;/&quot;):
    // o que importa aqui é que as TAGS saíram e o &nbsp; virou espaço.
    assert.ok(!/<[^>]+>/.test(ctx.risco?.medidasRecomendadas ?? ""));
    assert.ok((ctx.risco?.medidasRecomendadas ?? "").includes("regulado. Incentivar pausas."));
  });

  test("ação geral (sem setor) manda só a empresa", () => {
    const ctx = contextoIaDaAcao({ empresa: { nome: "X" }, setor: null, parcial: {} });
    assert.equal(ctx.setor, null);
    assert.equal(ctx.risco, null);
    assert.equal(ctx.empresa.nome, "X");
  });

  test("recomendação vazia vira null, não string vazia", () => {
    const ctx = contextoIaDaAcao({
      empresa: null,
      setor: { id: "S", nome_setor: "S", recomendacoes: "<p></p>" },
      parcial: {},
    });
    assert.equal(ctx.risco?.medidasRecomendadas, null);
  });
});

describe("prazoIaParaTexto", () => {
  test("dias inteiros viram texto", () => {
    assert.equal(prazoIaParaTexto(30), "30 dias");
    assert.equal(prazoIaParaTexto(1), "1 dia");
    assert.equal(prazoIaParaTexto(29.6), "30 dias");
  });
  test("fora da faixa ou não numérico → vazio (o técnico escreve)", () => {
    assert.equal(prazoIaParaTexto(0), "");
    assert.equal(prazoIaParaTexto(-5), "");
    assert.equal(prazoIaParaTexto(400), "");
    assert.equal(prazoIaParaTexto("30"), "");
    assert.equal(prazoIaParaTexto(undefined), "");
    assert.equal(prazoIaParaTexto(NaN), "");
  });
});

// ─── Porta para o Plano de Ação do PGR (v208) ────────────────────────────────

describe("prazoTextoParaData", () => {
  const HOJE = "2026-09-11";
  test("data pura passa como está (ISO e dd/mm/aaaa)", () => {
    assert.equal(prazoTextoParaData("2026-10-15", HOJE), "2026-10-15");
    assert.equal(prazoTextoParaData("15/10/2026", HOJE), "2026-10-15");
  });
  test("prazo relativo conta a partir de hoje — e aceita o ponto final que o técnico escreve", () => {
    assert.equal(prazoTextoParaData("30 dias", HOJE), "2026-10-11");
    assert.equal(prazoTextoParaData("30 dias.", HOJE), "2026-10-11");   // como está no MERIM
    assert.equal(prazoTextoParaData("em 45 dias", HOJE), "2026-10-26");
    assert.equal(prazoTextoParaData("1 dia", HOJE), "2026-09-12");
    assert.equal(prazoTextoParaData("2 semanas", HOJE), "2026-09-25");
    assert.equal(prazoTextoParaData("3 meses", HOJE), "2026-12-11");
    assert.equal(prazoTextoParaData("1 mês", HOJE), "2026-10-11");
  });
  test("vira o mês e o ano sem passar por fuso", () => {
    assert.equal(prazoTextoParaData("30 dias", "2026-12-15"), "2027-01-14");
  });
  test("texto que não é data nem prazo relativo → null (nunca inventa)", () => {
    assert.equal(prazoTextoParaData("imediato", HOJE), null);
    assert.equal(prazoTextoParaData("na próxima parada de manutenção", HOJE), null);
    assert.equal(prazoTextoParaData("30 dias após a entrega dos EPIs", HOJE), null);
    assert.equal(prazoTextoParaData("", HOJE), null);
    assert.equal(prazoTextoParaData(null, HOJE), null);
  });
});

describe("acoesEnviaveis", () => {
  test("cancelada fica de fora; as outras vão", () => {
    const r = acoesEnviaveis([
      acao({ id_acao: "a", status: "Pendente" }),
      acao({ id_acao: "b", status: "Cancelada" }),
      acao({ id_acao: "c", status: "Concluida" }),
    ]);
    assert.deepEqual(r.map((a) => a.id_acao), ["a", "c"]);
  });
});

describe("acaoCentralDeAetAcao", () => {
  const OPTS = {
    idEmpresa: "EMP-1",
    referencia: "AET 6d2ef44c de 02/09/2026",
    setores: SETORES,
    createdBy: "tecnico@exemplo",
    hoje: "2026-09-11",
    gerarIdAcao: () => "ACA-FIXO",
  };

  test("marca a origem em id_aet_acao e deixa as outras origens nulas", () => {
    const c = acaoCentralDeAetAcao(acao({ id_acao: "AAC-1", id_setor: "S-COZ" }), OPTS);
    assert.equal(c.id_acao, "ACA-FIXO");
    assert.equal(c.id_aet_acao, "AAC-1");
    assert.equal(c.id_empresa, "EMP-1");
    assert.equal(c.id_setor, null);          // setor do AET é JSONB, não a tabela setores
    assert.equal(c.id_risco_origem, null);
    assert.equal(c.id_apreciacao_acao, null);
    assert.equal(c.id_inspecao, null);
    assert.equal(c.created_by, "tecnico@exemplo");
  });

  test("copia os 5W2H, status e prioridade; 'Onde' vazio recebe o nome do setor", () => {
    const c = acaoCentralDeAetAcao(
      acao({
        id_setor: "S-COZ",
        what_acao: "Ajustar cadeiras",
        why_justificativa: "NR-17",
        how_metodo: "Trocar",
        who_responsavel: "Gerente",
        how_much_custo: "R$ 1.000",
        status: "Em Andamento",
        prioridade: "Alta",
      }),
      OPTS,
    );
    assert.equal(c.what_acao, "Ajustar cadeiras");
    assert.equal(c.why_justificativa, "NR-17");
    assert.equal(c.how_metodo, "Trocar");
    assert.equal(c.who_responsavel, "Gerente");
    assert.equal(c.how_much_custo, "R$ 1.000");
    assert.equal(c.where_local, "COZINHA");
    assert.equal(c.status, "Em Andamento");
    assert.equal(c.prioridade, "Alta");
  });

  test("'Onde' preenchido pelo técnico prevalece sobre o setor", () => {
    const c = acaoCentralDeAetAcao(acao({ id_setor: "S-COZ", where_local: "Setor de Condomínio." }), OPTS);
    assert.equal(c.where_local, "Setor de Condomínio.");
  });

  test("prazo relativo vira data E fica registrado nas observações com a base", () => {
    const c = acaoCentralDeAetAcao(acao({ id_setor: "S-COZ", when_prazo: "30 dias." }), OPTS);
    assert.equal(c.when_prazo, "2026-10-11");
    assert.equal(
      c.observacoes,
      'Origem: AET 6d2ef44c de 02/09/2026\nSetor: COZINHA\nPrazo na AET: "30 dias." (contado a partir de 11/09/2026)',
    );
  });

  test("prazo que não converte → data nula, texto preservado", () => {
    const c = acaoCentralDeAetAcao(acao({ when_prazo: "imediato", observacoes: "ver ata" }), OPTS);
    assert.equal(c.when_prazo, null);
    assert.equal(c.observacoes, 'Origem: AET 6d2ef44c de 02/09/2026\nPrazo combinado na AET: "imediato"\nver ata');
  });

  test("prazo que já era data não polui as observações", () => {
    const c = acaoCentralDeAetAcao(acao({ when_prazo: "15/10/2026" }), OPTS);
    assert.equal(c.when_prazo, "2026-10-15");
    assert.equal(c.observacoes, "Origem: AET 6d2ef44c de 02/09/2026");
  });

  test("ação de setor apagado: sem nome de setor, sem 'Onde' inventado", () => {
    const c = acaoCentralDeAetAcao(acao({ id_setor: "S-APAGADO" }), OPTS);
    assert.equal(c.where_local, null);
    assert.equal(c.observacoes, "Origem: AET 6d2ef44c de 02/09/2026");
  });
});

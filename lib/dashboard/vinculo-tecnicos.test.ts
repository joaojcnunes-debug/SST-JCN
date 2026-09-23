import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contaDoTecnicoDigitado,
  planejarVinculo,
  resumirSemVinculo,
} from "./vinculo-tecnicos";

/**
 * O cadastro e as grafias abaixo são os MESMOS de `tecnicos.test.ts` — as 43
 * grafias que existiam na produção em 2026-08-25, com os ids no formato do
 * painel. O ponto destes testes não é reconferir o casamento (aquele arquivo já
 * faz isso), e sim provar as duas coisas que o backfill precisa garantir:
 *
 *   1. o que a regra afirma vira `id_usuario` gravado, e
 *   2. o que ela NÃO afirma fica de fora COM O MOTIVO CERTO — porque
 *      "ambíguo" pede decisão de gente e "fora do painel" já está correto.
 *
 * Sem o item 2, o backfill viraria exatamente o que a regra da casa proíbe:
 * escolher no lugar de quem sabe.
 */
const CADASTRO = [
  { id_usuario: "USR-NAT01", nome: "Nathalia Correa" },
  { id_usuario: "USR-SIR01", nome: "Sirlei Lopes" },
  { id_usuario: "USR-ANA01", nome: "Ana Renata" },
  { id_usuario: "USR-NTF01", nome: "Nathan Ferreira" },
  { id_usuario: "USR-JVR01", nome: "João Vitor Rodrigues" },
  { id_usuario: "USR-LED01", nome: "Lédimo Duarte" },
  { id_usuario: "USR-ELA01", nome: "Elaine Maia de Oliveira" },
  { id_usuario: "USR-JOR01", nome: "Jorge Figueiredo" },
  { id_usuario: "USR-ROB01", nome: "Robson Alves" },
  { id_usuario: "USR-ALE01", nome: "Alexandre Moraes" },
  { id_usuario: "USR-EST01", nome: "Estefano Rosário" },
  { id_usuario: "USR-STE01", nome: "Stéfani Amorim" },
  { id_usuario: "USR-DAN01", nome: "Daniele Alves" },
  { id_usuario: "USR-PHE01", nome: "Phelipe Klein" },
  { id_usuario: "USR-JJE01", nome: "João Jefferson" },
  { id_usuario: "USR-JPE01", nome: "João Pessoal" },
  { id_usuario: "USR-JMA01", nome: "Joao Marcos Silveira" },
];

const linha = (id: string, tecnico: string | null, idUsuario?: string | null) => ({
  id_responsavel: id,
  tecnico_responsavel: tecnico,
  id_usuario: idUsuario ?? null,
});

describe("planejarVinculo — as grafias reais viram vínculo", () => {
  const casos: [string, string][] = [
    ["Nathalia Corrêa de Oliveira", "USR-NAT01"],
    ["Sirlei Lopes de Sousa", "USR-SIR01"],
    ["Lédimo", "USR-LED01"],
    ["LÉDIMO", "USR-LED01"],
    ["Elaine Maia", "USR-ELA01"],
    ["ALEXANDRE", "USR-ALE01"],
    ["Estefano do Rosario silva", "USR-EST01"],
    ["Estefano rosario", "USR-EST01"],
    ["STÉFANI", "USR-STE01"],
    ["João Vitor Lima Rodrigues", "USR-JVR01"],
    ["Nathan Felipe Ferreira", "USR-NTF01"],
    ["Daniele de Aguiar Alves Machado", "USR-DAN01"],
  ];

  for (const [digitado, idEsperado] of casos) {
    it(`"${digitado}" → ${idEsperado}`, () => {
      const plano = planejarVinculo([linha("RES-1", digitado)], CADASTRO);
      assert.equal(plano.semVinculo.length, 0);
      assert.equal(plano.ligar.length, 1);
      assert.equal(plano.ligar[0].id_usuario, idEsperado);
    });
  }
});

describe("o apelido do Robson entra, e vem marcado como decisão humana", () => {
  it("Robson Silva liga no Robson Alves", () => {
    const plano = planejarVinculo([linha("RES-1", "Robson Silva")], CADASTRO);
    assert.equal(plano.ligar[0].id_usuario, "USR-ROB01");
    assert.equal(plano.ligar[0].porApelido, true);
  });

  it("o erro de digitação ROBSON SILVS também", () => {
    const plano = planejarVinculo([linha("RES-1", "ROBSON SILVS")], CADASTRO);
    assert.equal(plano.ligar[0].id_usuario, "USR-ROB01");
  });

  it("uma grafia que a regra alcança NÃO é marcada como apelido", () => {
    const plano = planejarVinculo([linha("RES-1", "Lédimo")], CADASTRO);
    assert.equal(plano.ligar[0].porApelido, false);
  });
});

describe("o que a regra não afirma fica de fora — com o motivo certo", () => {
  it("ambíguo: quatro Joões, e os candidatos ficam à mostra", () => {
    const plano = planejarVinculo([linha("RES-1", "João")], CADASTRO);
    assert.equal(plano.ligar.length, 0);
    assert.equal(plano.semVinculo[0].motivo, "ambiguo");
    assert.ok((plano.semVinculo[0].candidatos ?? []).length > 1);
  });

  it("fora do painel: Thiago Nunes é técnico de unidade, sem login", () => {
    const plano = planejarVinculo([linha("RES-1", "Thiago Nunes")], CADASTRO);
    assert.equal(plano.ligar.length, 0);
    assert.equal(plano.semVinculo[0].motivo, "fora_do_painel");
  });

  it("os dois motivos NÃO se confundem — é a razão de o campo existir", () => {
    const plano = planejarVinculo(
      [linha("RES-1", "João"), linha("RES-2", "Thiago Nunes")],
      CADASTRO,
    );
    const resumo = resumirSemVinculo(plano.semVinculo);
    assert.equal(resumo.ambiguo, 1);
    assert.equal(resumo.fora_do_painel, 1);
  });

  it("campo em branco é 'vazio', não um vínculo inventado", () => {
    const plano = planejarVinculo(
      [linha("RES-1", ""), linha("RES-2", "   "), linha("RES-3", null)],
      CADASTRO,
    );
    assert.equal(plano.ligar.length, 0);
    assert.equal(resumirSemVinculo(plano.semVinculo).vazio, 3);
  });

  it("cadastro vazio não liga ninguém e não quebra", () => {
    const plano = planejarVinculo([linha("RES-1", "Nathalia Corrêa de Oliveira")], []);
    assert.equal(plano.ligar.length, 0);
    assert.equal(plano.semVinculo[0].motivo, "fora_do_painel");
  });
});

describe("rodar de novo não estraga o que já está gravado", () => {
  it("linha já vinculada é contada e NÃO entra no plano", () => {
    const plano = planejarVinculo(
      [linha("RES-1", "Lédimo", "USR-LED01"), linha("RES-2", "Lédimo")],
      CADASTRO,
    );
    assert.equal(plano.jaVinculadas, 1);
    assert.equal(plano.ligar.length, 1);
    assert.equal(plano.ligar[0].id_responsavel, "RES-2");
  });

  it("vínculo feito à mão para OUTRA pessoa é respeitado, não corrigido", () => {
    // Alguém pode ter arrumado na tela um caso que a regra erraria. O backfill
    // não é dono do dado: ele preenche o que está vazio.
    const plano = planejarVinculo([linha("RES-1", "Lédimo", "USR-JOR01")], CADASTRO);
    assert.equal(plano.ligar.length, 0);
    assert.equal(plano.jaVinculadas, 1);
  });
});

/**
 * FASE B1 (2026-09-10) -- o caso de UMA linha, na hora em que alguem digita.
 *
 * O que estes testes protegem nao e uma tela: e o que vai ser GRAVADO. Um
 * `null` a mais so deixa a linha sem vinculo (o painel cai no texto e nada se
 * perde); um id ERRADO credita o trabalho de uma pessoa em outra e ninguem
 * percebe. Por isso a maioria dos casos abaixo cobra RECUSA.
 */
describe("contaDoTecnicoDigitado -- a conta de um nome digitado", () => {
  it("nome exato do cadastro devolve a conta", () => {
    assert.equal(
      contaDoTecnicoDigitado("Nathan Ferreira", CADASTRO),
      "USR-NTF01",
    );
  });

  it("caixa e acento nao atrapalham -- e o defeito real da base", () => {
    assert.equal(contaDoTecnicoDigitado("LEDIMO", CADASTRO), "USR-LED01");
    assert.equal(contaDoTecnicoDigitado("ledimo duarte", CADASTRO), "USR-LED01");
    assert.equal(
      contaDoTecnicoDigitado("Estefano do Rosario", CADASTRO),
      "USR-EST01",
    );
  });

  it("nome curto casa com o cadastro completo", () => {
    assert.equal(contaDoTecnicoDigitado("Elaine Maia", CADASTRO), "USR-ELA01");
  });

  it("o apelido decidido a mao vale (Robson Silva e Robson Alves)", () => {
    assert.equal(contaDoTecnicoDigitado("Robson Silva", CADASTRO), "USR-ROB01");
  });

  it("AMBIGUO recusa -- quatro Joaos no painel, um 'Joao' digitado", () => {
    assert.equal(contaDoTecnicoDigitado("João", CADASTRO), null);
  });

  it("pessoa de fora do painel recusa, e isso esta certo", () => {
    // Tecnico de unidade sem login continua sendo o tecnico: o NOME fica
    // gravado na linha, so nao ha conta para apontar.
    assert.equal(contaDoTecnicoDigitado("Thiago Nunes", CADASTRO), null);
  });

  it("vazio, espaco e nulo recusam sem explodir", () => {
    assert.equal(contaDoTecnicoDigitado("", CADASTRO), null);
    assert.equal(contaDoTecnicoDigitado("   ", CADASTRO), null);
    assert.equal(contaDoTecnicoDigitado(null, CADASTRO), null);
    assert.equal(contaDoTecnicoDigitado(undefined, CADASTRO), null);
  });

  it("lista de contas vazia recusa -- nao inventa vinculo sem cadastro", () => {
    // E o caso da consulta que nao respondeu. Recusar aqui e o que permite a
    // tela de edicao MANTER o vinculo que ja estava gravado.
    assert.equal(contaDoTecnicoDigitado("Nathan Ferreira", []), null);
  });

  it("dois cadastros com o MESMO nome recusam", () => {
    // Chutar entre os dois creditaria trabalho na pessoa errada.
    const duplicado = [
      { id_usuario: "USR-A", nome: "Maria Souza" },
      { id_usuario: "USR-B", nome: "Maria Souza" },
    ];
    assert.equal(contaDoTecnicoDigitado("Maria Souza", duplicado), null);
  });

  it("concorda com planejarVinculo -- a regra e UMA so", () => {
    // Se um dia divergirem, e porque alguem copiou a regra. Este teste quebra.
    for (const grafia of [
      "Nathan Ferreira",
      "LEDIMO",
      "Elaine Maia",
      "Robson Silva",
      "Estefano do Rosario",
      "João",
      "Thiago Nunes",
    ]) {
      const plano = planejarVinculo([linha("RES-1", grafia)], CADASTRO);
      const doLote = plano.ligar[0]?.id_usuario ?? null;
      assert.equal(
        contaDoTecnicoDigitado(grafia, CADASTRO),
        doLote,
        `divergiu em "${grafia}"`,
      );
    }
  });
});

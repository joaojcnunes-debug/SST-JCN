import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { avisosDeCadastro, chaveAlternativa, parsearQpsCsv } from "./parsearCsv";

/**
 * Testes da importação de respondentes do QPS.
 *
 * Existem por causa da v180, que trouxe perguntas com alternativas próprias: a
 * célula do CSV passa a trazer o TEXTO da alternativa, e o parser tem que gravar
 * a POSIÇÃO dela. É onde o dado do questionário novo entra no painel, e onde
 * errar é caro — resposta descartada em silêncio some da média sem ninguém ver,
 * que foi exatamente o estrago da escala 0–4 em agosto.
 *
 * Duas coisas são testadas com o mesmo peso: casar o que deve casar, e RECUSAR
 * ALTO o que não casa. Casamento aproximado não existe de propósito — alternativa
 * parecida casando com a errada inverte o risco de um respondente e ninguém
 * percebe.
 */

const P = (id: string, opcoes?: string[]) => ({ id_pergunta: id, opcoes: opcoes ?? null });

/** Monta um CSV do formato do Forms: Carimbo | Setor | Cargo | respostas… */
function csv(respostasPorLinha: string[][], nPerguntas: number): string {
  const cols = Array.from({ length: nPerguntas }, (_, i) => `Pergunta ${i + 1}`);
  const header = ["Carimbo de data/hora", "Setor", "Cargo", ...cols].join(",");
  const linhas = respostasPorLinha.map((r, i) =>
    [`01/01/2026 09:0${i}:00`, "Producao", "Operador", ...r]
      .map((c) => (c.includes(",") ? `"${c}"` : c))
      .join(","),
  );
  return [header, ...linhas].join("\n");
}

describe("chave de comparação da alternativa", () => {
  test("ignora acento, caixa e espaço sobrando", () => {
    assert.equal(chaveAlternativa("Às vezes"), chaveAlternativa("as   VEZES  "));
    assert.equal(chaveAlternativa("Não"), chaveAlternativa("nao"));
  });

  test("ignora o prefixo numerado que alguns formulários colocam", () => {
    assert.equal(chaveAlternativa("1 - Nunca"), chaveAlternativa("Nunca"));
    assert.equal(chaveAlternativa("2) Sempre"), chaveAlternativa("Sempre"));
    assert.equal(chaveAlternativa("3. Às vezes"), chaveAlternativa("às vezes"));
  });

  test("NÃO junta alternativas que são realmente diferentes", () => {
    assert.notEqual(chaveAlternativa("Nunca"), chaveAlternativa("Quase nunca"));
    assert.notEqual(chaveAlternativa("Sempre"), chaveAlternativa("Quase sempre"));
  });
});

describe("pergunta com alternativas próprias", () => {
  const perguntas = [P("p1", ["Nunca", "Às vezes", "Sempre"])];

  test("grava a POSIÇÃO da alternativa, não o texto", () => {
    const r = parsearQpsCsv(csv([["Nunca"], ["Às vezes"], ["Sempre"]], 1), perguntas, 1, 5);
    assert.equal(r.linhas.length, 3);
    assert.equal(r.linhas[0].respostas.p1, 1);
    assert.equal(r.linhas[1].respostas.p1, 2);
    assert.equal(r.linhas[2].respostas.p1, 3);
  });

  test("casa mesmo com acento, caixa e espaço diferentes do cadastro", () => {
    const r = parsearQpsCsv(csv([["as vezes"], ["  SEMPRE  "]], 1), perguntas, 1, 5);
    assert.equal(r.linhas[0].respostas.p1, 2);
    assert.equal(r.linhas[1].respostas.p1, 3);
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 0);
  });

  test("aceita a posição em número, quando o export já vem assim", () => {
    const r = parsearQpsCsv(csv([["2"]], 1), perguntas, 1, 5);
    assert.equal(r.linhas[0].respostas.p1, 2);
  });

  test("número fora da faixa da pergunta é recusado, não convertido", () => {
    const r = parsearQpsCsv(csv([["7"]], 1), perguntas, 1, 5);
    assert.equal(r.linhas.length, 0);
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 1);
  });

  test("o diagnóstico conta quantas perguntas têm alternativas", () => {
    const r = parsearQpsCsv(csv([["Nunca"]], 1), perguntas, 1, 5);
    assert.equal(r.diagnostico.perguntasComAlternativas, 1);
  });
});

describe("texto que não bate é recusado ALTO", () => {
  const perguntas = [P("p1", ["Nunca", "Às vezes", "Sempre"])];

  test("a resposta é descartada e contada", () => {
    const r = parsearQpsCsv(csv([["Não se aplica"], ["Nunca"]], 1), perguntas, 1, 5);
    assert.equal(r.linhas.length, 1, "só a linha que casou entra");
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 1);
  });

  test("a mensagem diz a pergunta, o texto e as alternativas cadastradas", () => {
    const r = parsearQpsCsv(csv([["Não se aplica"]], 1), perguntas, 1, 5);
    const msg = r.erros.find((e) => e.includes("Não se aplica"));
    assert.ok(msg, "tem que existir um aviso sobre o texto que não casou");
    assert.ok(msg!.includes("pergunta 1"), "diz qual pergunta");
    assert.ok(msg!.includes('"Nunca"'), "lista o que estava cadastrado");
    assert.ok(msg!.includes('"Sempre"'));
  });

  test("texto parecido NÃO é casado por aproximação", () => {
    // "Quase sempre" não está cadastrada. Casar com "Sempre" gravaria a melhor
    // resposta possível para quem respondeu outra coisa.
    const r = parsearQpsCsv(csv([["Quase sempre"]], 1), perguntas, 1, 5);
    assert.equal(r.linhas.length, 0);
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 1);
  });
});

describe("perguntas de alternativa e numéricas no mesmo arquivo", () => {
  const perguntas = [P("texto", ["Ruim", "Bom"]), P("num")];

  test("cada uma é lida do seu jeito", () => {
    const r = parsearQpsCsv(csv([["Bom", "4"]], 2), perguntas, 1, 5);
    assert.equal(r.linhas[0].respostas.texto, 2);
    assert.equal(r.linhas[0].respostas.num, 4);
  });

  test("a pergunta de texto não polui o diagnóstico de escala", () => {
    // Sem isso, um questionário de alternativas apareceria como "escala
    // divergente" só por não ter número — o banner da v0.3.519 dispara com
    // valorMin preenchido + valores fora da escala.
    const r = parsearQpsCsv(csv([["Bom", "4"], ["Ruim", "5"]], 2), perguntas, 1, 5);
    assert.deepEqual(r.diagnostico.valoresEncontrados, [4, 5]);
    assert.equal(r.diagnostico.totalForaEscala, 0);
    assert.equal(r.diagnostico.totalNaoNumerico, 0);
  });

  test("número fora da escala do tipo continua sendo pego na pergunta numérica", () => {
    const r = parsearQpsCsv(csv([["Bom", "9"]], 2), perguntas, 1, 5);
    assert.equal(r.diagnostico.totalForaEscala, 1);
    assert.equal(r.linhas[0].respostas.num, undefined);
    assert.equal(r.linhas[0].respostas.texto, 2, "a outra pergunta não é afetada");
  });
});

describe("questionário numérico continua igual", () => {
  const perguntas = [P("p1"), P("p2")];

  test("escala 0–4 do Forms da JCN Consultoria", () => {
    const r = parsearQpsCsv(csv([["0", "4"], ["2", "3"]], 2), perguntas, 0, 4);
    assert.equal(r.linhas.length, 2);
    assert.equal(r.linhas[0].respostas.p1, 0);
    assert.equal(r.linhas[0].respostas.p2, 4);
    assert.equal(r.diagnostico.perguntasComAlternativas, 0);
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 0);
  });

  test("texto num questionário numérico segue caindo em 'não é número'", () => {
    const r = parsearQpsCsv(csv([["COPEIRO (A) HOSPITALAR", "3"]], 2), perguntas, 1, 5);
    assert.equal(r.diagnostico.totalNaoNumerico, 1);
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 0);
  });
});

describe("aviso de cadastro", () => {
  test("duas alternativas que normalizam igual são denunciadas", () => {
    const avisos = avisosDeCadastro([{ opcoes: ["Não", "NAO", "Sim"] }]);
    assert.equal(avisos.length, 1);
    assert.ok(avisos[0].includes("pergunta 1"));
  });

  test("cadastro sadio não gera aviso", () => {
    assert.deepEqual(avisosDeCadastro([{ opcoes: ["Nunca", "Às vezes", "Sempre"] }]), []);
    assert.deepEqual(avisosDeCadastro([{ opcoes: null }]), []);
  });

  test("o aviso chega junto com o resultado da importação", () => {
    const r = parsearQpsCsv(csv([["Sim"]], 1), [P("p1", ["Não", "NAO", "Sim"])], 1, 5);
    assert.ok(r.erros.some((e) => e.includes("iguais para efeito de comparação")));
  });
});

describe("formulário SEM coluna de cargo", () => {
  /**
   * O PER (Pesquisa Estratégica de Riscos) não tem pergunta de cargo: o export
   * é Carimbo | Setor | 20 perguntas | Considerações. O parser palpitava que o
   * cargo era a coluna 2 e a tirava das perguntas mesmo sem ter detectado
   * cargo nenhum — engolindo a PRIMEIRA pergunta e deslocando todas as
   * respostas uma casa para a esquerda.
   *
   * Num questionário numérico o estrago é MUDO: os valores continuam dentro da
   * escala, então cada resposta ia para a pergunta seguinte sem um aviso
   * sequer. Só apareceu quando o questionário de alternativas foi importado e
   * nada casou.
   */
  function csvSemCargo(respostas: string[]): string {
    const header = ["Carimbo de data/hora", "Setor:", "P1", "P2", "P3"].join(",");
    return [header, ["24/08/2026 09:15:32", "Producao", ...respostas].join(",")].join("\n");
  }

  test("a primeira pergunta não é engolida", () => {
    const perguntas = [P("p1"), P("p2"), P("p3")];
    const r = parsearQpsCsv(csvSemCargo(["1", "3", "5"]), perguntas, 1, 5);
    assert.equal(r.linhas.length, 1);
    assert.deepEqual(r.linhas[0].respostas, { p1: 1, p2: 3, p3: 5 });
    assert.equal(r.linhas[0].setor, "Producao");
    assert.equal(r.linhas[0].cargo, null);
  });

  test("com alternativas, o deslocamento aparecia como 'não casou'", () => {
    const perguntas = [
      P("p1", ["a1", "a2"]),
      P("p2", ["b1", "b2"]),
      P("p3", ["c1", "c2"]),
    ];
    const r = parsearQpsCsv(csvSemCargo(["a2", "b1", "c2"]), perguntas, 1, 5);
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 0);
    assert.deepEqual(r.linhas[0].respostas, { p1: 2, p2: 1, p3: 2 });
  });

  test("quando HÁ coluna de cargo, ela continua saindo das perguntas", () => {
    const header = ["Carimbo de data/hora", "Setor", "Cargo", "P1", "P2"].join(",");
    const csv = [header, "24/08/2026 09:15:32,Producao,Operador,2,4"].join("\n");
    const r = parsearQpsCsv(csv, [P("p1"), P("p2")], 1, 5);
    assert.equal(r.linhas[0].cargo, "Operador");
    assert.deepEqual(r.linhas[0].respostas, { p1: 2, p2: 4 });
  });

  test("coluna extra no FIM (campo de considerações) é ignorada", () => {
    const header = ["Carimbo de data/hora", "Setor:", "P1", "P2", "Faça suas Considerações"].join(",");
    const csv = [header, '24/08/2026 09:15:32,Producao,1,5,"Precisa melhorar o ventilador"'].join("\n");
    const r = parsearQpsCsv(csv, [P("p1"), P("p2")], 1, 5);
    assert.deepEqual(r.linhas[0].respostas, { p1: 1, p2: 5 });
    assert.equal(r.diagnostico.totalNaoNumerico, 0, "o texto livre não vira aviso");
  });
});

describe("célula vazia", () => {
  test("não vira resposta nem reclamação", () => {
    const perguntas = [P("p1", ["Ruim", "Bom"]), P("p2", ["Ruim", "Bom"])];
    const r = parsearQpsCsv(csv([["", "Bom"]], 2), perguntas, 1, 5);
    assert.equal(r.linhas[0].respostas.p1, undefined);
    assert.equal(r.linhas[0].respostas.p2, 2);
    assert.equal(r.diagnostico.totalAlternativaNaoCasou, 0);
  });
});

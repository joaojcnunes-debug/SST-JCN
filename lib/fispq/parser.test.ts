import { test } from "node:test";
import assert from "node:assert/strict";
import { colunaComposicaoParaExibir, ehLaudoDoPainel, juntarColunaComposicao, montarContextoFispq, parseFispq, pdfSemTexto } from "./parser";

const fispq = (secao3: string) =>
  `1. IDENTIFICAÇÃO\nNome do produto: PRODUTO TESTE\n\n3. COMPOSIÇÃO E INFORMAÇÕES SOBRE OS INGREDIENTES\n${secao3}\n\n4. MEDIDAS DE PRIMEIROS SOCORROS\nLavar com água.\n`;

test("ingredientes sem CAS entram na composição, com o sinal da concentração (ECOCOOL: 5, não 1)", () => {
  const r = parseFispq(
    fispq(
      [
        "MISTURA",
        "Destilados (petróleo), naftênicos pesados tratados com hidrogênio (CAS 64742-52-5): 60,0",
        "- 90,0%",
        "Segredo industrial 1:   <   5,0%; (Classificação: H316; H412)",
        "Segredo industrial 2:   <   5,0%; (Classificação: H302; H314; H401)",
        "Segredo industrial 3:   <   5,0%; (Classificação: H301; H314; H410)",
        "Segredo industrial 4:   <   2,0% 1 ; (Classificação: H314; H317; H410)",
      ].join("\n"),
    ),
  );
  assert.equal(r.numero_cas, "64742-52-5");
  assert.equal(r.concentracao, "60,0-90,0%");
  assert.deepEqual(
    r.cas_componentes?.map((c) => [c.cas, c.nome, c.concentracao]),
    [
      ["", "Segredo industrial 1", "<5,0%"],
      ["", "Segredo industrial 2", "<5,0%"],
      ["", "Segredo industrial 3", "<5,0%"],
      ["", "Segredo industrial 4", "<2,0%"],
    ],
  );
  assert.match(montarContextoFispq(r), /Segredo industrial 1 \(sem CAS, <5,0%\)/);
});

test("ingrediente sigiloso na frente não vira o químico principal", () => {
  const r = parseFispq(fispq("Segredo industrial: 10%\nTolueno 108-88-3 20%"));
  assert.equal(r.numero_cas, "108-88-3");
  assert.equal(r.nome_quimico, "Tolueno");
  assert.deepEqual(r.cas_componentes?.map((c) => [c.cas, c.nome]), [["", "Segredo industrial"]]);
});

test("rótulo com porcentagem não vira ingrediente, e menor que com CAS mantém o sinal", () => {
  const r = parseFispq(fispq("Concentração total: 100%\nTeor: 15%\nTolueno 108-88-3 < 5%"));
  assert.equal(r.numero_cas, "108-88-3");
  assert.equal(r.concentracao, "<5%");
  assert.equal(r.cas_componentes?.length ?? 0, 0);
});

test("propriedade física vazada na seção 3 não vira ingrediente nem tira o CAS solto (Glutamato)", () => {
  // Ficha que não separa as seções: o texto da 9 cai dentro da 3, e o CAS está fora da tabela.
  const texto =
    "1. IDENTIFICAÇÃO\nNome do produto: GLUTAMATO\nCAS 142-47-2\n\n3. COMPOSIÇÃO\nSubstância pura\nPonto de fusão: 232 graus C\nSolubilidade em água:   73%\n";
  const r = parseFispq(texto);
  assert.equal(r.numero_cas, "142-47-2");
  assert.notEqual(r.nome_quimico, "Solubilidade em água");
  assert.equal(r.cas_componentes?.length ?? 0, 0);
});

test("CAS escrito com espaços é reconhecido, e a faixa com dois sinais de % fica inteira (Desengripante)", () => {
  const r = parseFispq(
    fispq(
      "Butano   (CAS   106 - 97 - 8):   40% - 50%;\nPropano   (CAS   74 - 98 - 6):   10% - 20%;",
    ),
  );
  assert.equal(r.numero_cas, "106-97-8");
  assert.equal(r.nome_quimico, "Butano");
  assert.equal(r.concentracao, "40-50%");
  assert.deepEqual(r.cas_componentes?.map((c) => [c.cas, c.nome, c.concentracao]), [["74-98-6", "Propano", "10-20%"]]);
});

test("nome começando com as letras de um rótulo fica inteiro, e CAS com espaços fora do parêntese não é tocado", () => {
  const r = parseFispq(fispq("Butano (CAS 106 - 97 - 8): 40%\nCeras parafínicas (CAS 8002 - 74 - 2): 1%"));
  assert.equal(r.cas_componentes?.[0].nome, "Ceras parafínicas");
  const nitrico = parseFispq(fispq("Ácido Nítrico\nCAS nº 7664 - 39 - 3\n15 – 20%"));
  assert.notEqual(nitrico.nome_quimico, "nº");
});

test("FDS com CAS em espaços: pega nome e CAS, sem usar o rótulo como nome (Ácido Fluossilícico)", () => {
  const r = parseFispq(
    fispq("Nome químico: Ácido Fluossilícico.\nSinônimo : Ácido hexafluorossilícico.\nRegistro no Chemical Abstract Service (n° CAS): 16961 - 83 - 4."),
  );
  assert.equal(r.numero_cas, "16961-83-4");
  assert.equal(r.nome_quimico, "Ácido Fluossilícico");
});

test("tabela fora da seção 3 é achada em linha única (Adesivo)", () => {
  const texto =
    "1. IDENTIFICAÇÃO\nNome do produto: ADESIVO\n3. COMPOSIÇÃO E INFORMAÇÕES\n3.2 Misturas\n4. MEDIDAS DE PRIMEIROS SOCORROS\nProcurar ar fresco.\nMetiletilcetona 78 - 93 - 3 15 - 25 %\nAcetona 67 - 64 - 1 30 – 45%\n";
  const r = parseFispq(texto);
  assert.equal(r.numero_cas, "78-93-3");
  assert.equal(r.nome_quimico, "Metiletilcetona");
  assert.equal(r.concentracao, "15-25%");
  assert.deepEqual(r.cas_componentes?.map((c) => [c.nome, c.cas, c.concentracao]), [["Acetona", "67-64-1", "30–45%"]]);
});

test("linha única não perde ingrediente: nome com número entra e CAS solto continua (A Z Neutro, Corante)", () => {
  const texto =
    "1. IDENTIFICAÇÃO\nNome do produto: NEUTRO\nCAS: 8028-89-5\n3. COMPOSIÇÃO E INFORMAÇÕES\n3.2 Misturas\n4. MEDIDAS DE PRIMEIROS SOCORROS\nHidróxido de Sódio 50% 1310-73-2 1,0 - 1,5%\nÁcido Linear 85536-14-7 3,5 - 4,5%\n";
  const r = parseFispq(texto);
  const todos = [r.numero_cas, ...(r.cas_componentes ?? []).map((c) => c.cas)];
  assert.deepEqual(todos, ["1310-73-2", "85536-14-7", "8028-89-5"]);
  assert.equal(r.nome_quimico, "Hidróxido de Sódio 50%");
});

test("faixa com sinais fica inteira, e número que não passa no dígito verificador não vira CAS", () => {
  const r = parseFispq(fispq("Nafta leve\n64741 - 84 - 0\n>= 25 - < 30 % Líquidos inflamáveis"));
  assert.equal(r.numero_cas, "64741-84-0");
  assert.equal(r.concentracao, "25-30%");
  assert.equal(parseFispq(fispq("Faixa 15 - 25 - 7")).numero_cas, undefined);
});

test("PDF só com imagem é reconhecido, mesmo com as marcas de página", () => {
  assert.equal(pdfSemTexto("=== Página 1 ===\n\n=== Página 2 ===\n \n=== Página 14 ===\n"), true);
  assert.equal(pdfSemTexto(""), true);
  assert.equal(pdfSemTexto("=== Página 1 ===\n12 34 56 --- 1/8\n"), true);
  assert.equal(pdfSemTexto(`=== Página 1 ===\n${"Ficha de dados de segurança do produto. ".repeat(5)}`), false);
});

test("laudo do painel é reconhecido, e 'Empresa não informada.' nunca vira nome de produto", () => {
  const laudo =
    "SUMÁRIO\n1. Identificação da Empresa\n4. Análise Química (corpo do laudo)\n1. IDENTIFICAÇÃO DA EMPRESA\nEmpresa não informada.\n2. Análise\n1. Identificação do Agente Químico\nNúmero CAS 143-74-8\nPrecisa de medição? Sim\n";
  assert.equal(ehLaudoDoPainel(laudo), true);
  assert.notEqual(parseFispq(laudo).nome_produto, "Empresa não informada.");
  assert.equal(ehLaudoDoPainel(fispq("Tolueno 108-88-3 20%")), false);
});

test("a coluna gravada mantém a posição de cada componente", () => {
  assert.equal(juntarColunaComposicao(["64742-52-5", "", null]), "64742-52-5; —; —");
  assert.equal(juntarColunaComposicao([null, "108-88-3"]), "—; 108-88-3");
  assert.equal(juntarColunaComposicao(["Tolueno"]), "Tolueno");
  assert.equal(juntarColunaComposicao(["", null]), null);
  assert.equal(juntarColunaComposicao([]), null);
});

test("no texto corrido o marcador de alinhamento não aparece", () => {
  assert.equal(colunaComposicaoParaExibir("64742-52-5; —; —"), "64742-52-5");
  assert.equal(colunaComposicaoParaExibir("A; —; B"), "A; B");
  assert.equal(colunaComposicaoParaExibir("108-88-3"), "108-88-3");
  assert.equal(colunaComposicaoParaExibir(null), "");
});

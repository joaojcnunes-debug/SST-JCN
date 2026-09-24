import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buscar, distanciaEdicao, normalizarTexto, toleranciaPara } from "./texto";
import { buscarEmpresas } from "./empresas";

/**
 * Nomes REAIS da produção em 2026-09-21 (861 empresas; 850 em MAIÚSCULAS,
 * 31 com acento). O caso que motivou tudo: "COMERCIO" 129× e "COMÉRCIO" 1×.
 */
const EMPRESAS = [
  { nome_empresa: "CONDOMINIO DO EDIFICIO ESTORIL", cnpj: null },
  { nome_empresa: "FRITAMP INDUSTRIA E COMERCIO LTDA.", cnpj: "29.123.456/0001-10" },
  { nome_empresa: "HOSPITAL EM CASA PRODUTOS MEDICOS LTDA", cnpj: "13267504000203" },
  { nome_empresa: "HOSPITAL EM CASA PRODUTOS MÉDICOS LTDA", cnpj: "13267504000629" },
  { nome_empresa: "DISTRIBUIDORA DE LEGUMES SITIO SAO JOSE LTDA", cnpj: null },
  { nome_empresa: "CONDOMINIO DO EDIFICIO SAO PAULO", cnpj: null },
  { nome_empresa: "CERÂMICA M VELASCO", cnpj: null },
  { nome_empresa: "ACOUGUE INDAIA LTDA", cnpj: null },
  { nome_empresa: "EMÍLIA CONFECÇÕES", cnpj: null, razao_social: "E C ROUPAS LTDA" },
  { nome_empresa: "T-GIU CONFECCAO E COMERCIO LTDA", cnpj: null },
];
const nomes = (r: { itens: { nome_empresa: string }[] }) => r.itens.map((e) => e.nome_empresa);

describe("normalizarTexto", () => {
  it("tira acento, caixa e pontuação", () => {
    assert.equal(normalizarTexto("Comércio, Indústria & Cia."), "comercio industria cia");
    assert.equal(normalizarTexto("  CONDOMÍNIO   DO  EDIFÍCIO "), "condominio do edificio");
    assert.equal(normalizarTexto(null), "");
  });
});

describe("distanciaEdicao", () => {
  it("conta troca, falta, sobra e transposição como 1", () => {
    assert.equal(distanciaEdicao("condominio", "condominio", 2), 0);
    assert.equal(distanciaEdicao("condominoi", "condominio", 2), 1); // transposição
    assert.equal(distanciaEdicao("hopsital", "hospital", 2), 1);
    assert.equal(distanciaEdicao("comercio", "comerci", 2), 1);
    assert.equal(distanciaEdicao("comercio", "comerrcio", 2), 1);
  });
  it("para de contar acima do máximo", () => {
    assert.equal(distanciaEdicao("abcdef", "uvwxyz", 2), 3);
    assert.equal(distanciaEdicao("a", "abcd", 1), 2);
  });
  it("tolerância cresce com o tamanho da palavra", () => {
    assert.equal(toleranciaPara(3), 0);
    assert.equal(toleranciaPara(4), 1);
    assert.equal(toleranciaPara(7), 2);
  });
});

describe("buscarEmpresas — o caso do acento", () => {
  it("com acento acha o nome gravado sem acento (e vice-versa)", () => {
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "comércio")), [
      "FRITAMP INDUSTRIA E COMERCIO LTDA.",
      "T-GIU CONFECCAO E COMERCIO LTDA",
    ]);
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "ceramica")), ["CERÂMICA M VELASCO"]);
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "emilia")), ["EMÍLIA CONFECÇÕES"]);
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "açougue")), ["ACOUGUE INDAIA LTDA"]);
  });

  it("o nome INTEIRO digitado com acento acha o gravado sem", () => {
    const r = buscarEmpresas(EMPRESAS, "Condomínio do Edifício Estoril");
    assert.equal(r.aproximado, false);
    assert.deepEqual(nomes(r), ["CONDOMINIO DO EDIFICIO ESTORIL"]);
  });

  it("acha as duas grafias da mesma empresa de uma vez", () => {
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "hospital em casa médicos")), [
      "HOSPITAL EM CASA PRODUTOS MEDICOS LTDA",
      "HOSPITAL EM CASA PRODUTOS MÉDICOS LTDA",
    ]);
  });

  it("palavras em qualquer ordem e começo de palavra", () => {
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "estoril cond")), ["CONDOMINIO DO EDIFICIO ESTORIL"]);
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "são josé")), ["DISTRIBUIDORA DE LEGUMES SITIO SAO JOSE LTDA"]);
  });

  it("tolera erro de digitação", () => {
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "condominoi estoril")), ["CONDOMINIO DO EDIFICIO ESTORIL"]);
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "hopsital")).length, 2);
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "fritanp")), ["FRITAMP INDUSTRIA E COMERCIO LTDA."]);
  });

  it("palavra curta errada não tem perdão (evita achar tudo)", () => {
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "xyz")), []);
  });

  it("CNPJ com ou sem máscara, inteiro ou pedaço", () => {
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "29.123.456")), ["FRITAMP INDUSTRIA E COMERCIO LTDA."]);
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "29123456000110")), ["FRITAMP INDUSTRIA E COMERCIO LTDA."]);
    assert.equal(nomes(buscarEmpresas(EMPRESAS, "13267504")).length, 2);
  });

  it("razão social também conta", () => {
    assert.deepEqual(nomes(buscarEmpresas(EMPRESAS, "e c roupas")), ["EMÍLIA CONFECÇÕES"]);
  });

  it("quem começa pela busca vem antes de quem só contém", () => {
    const r = buscarEmpresas(EMPRESAS, "condominio");
    assert.equal(r.aproximado, false);
    assert.deepEqual(nomes(r), ["CONDOMINIO DO EDIFICIO ESTORIL", "CONDOMINIO DO EDIFICIO SAO PAULO"]);
    const r2 = buscarEmpresas(EMPRESAS, "sao");
    // "SITIO SAO JOSE" contém a palavra; "EDIFICIO SAO PAULO" também — ordem original.
    assert.equal(r2.itens.length, 2);
  });

  it("quando nada bate por inteiro, mostra os MAIS PARECIDOS e avisa", () => {
    const r = buscarEmpresas(EMPRESAS, "condominio estoril xyzabc");
    assert.equal(r.aproximado, true);
    assert.equal(r.itens[0].nome_empresa, "CONDOMINIO DO EDIFICIO ESTORIL");
    // Menos da metade das palavras batendo não entra nem como parecido.
    const r2 = buscarEmpresas(EMPRESAS, "qqq www estoril");
    assert.equal(r2.aproximado, true);
    assert.deepEqual(nomes(r2), []);
  });

  it("busca vazia devolve a lista como veio", () => {
    const r = buscarEmpresas(EMPRESAS, "   ");
    assert.equal(r.aproximado, false);
    assert.equal(r.itens, EMPRESAS);
  });
});

describe("buscar — genérico", () => {
  it("serve a qualquer lista, com campos à escolha", () => {
    const setores = [{ nome: "Produção", area: "Fábrica" }, { nome: "Administrativo", area: "Escritório" }];
    assert.deepEqual(buscar(setores, "fabrica", (s) => [s.nome, s.area]).itens, [setores[0]]);
    assert.deepEqual(buscar(setores, "escritorio", (s) => [s.nome, s.area]).itens, [setores[1]]);
  });
});

describe("manterOrdem — tabela filtra, seletor ranqueia", () => {
  const lista = [
    { nome: "DISTRIBUIDORA COMERCIO LTDA", data: "2026-09-20" },
    { nome: "COMERCIO DE PEDRAS LTDA", data: "2026-09-19" },
    { nome: "PADARIA COMERCIAL", data: "2026-09-18" },
  ];
  it("sem manterOrdem, quem começa pela busca sobe", () => {
    const r = buscar(lista, "comercio", (x) => [x.nome]);
    assert.equal(r.itens[0].nome, "COMERCIO DE PEDRAS LTDA");
  });
  it("com manterOrdem, a ordem original (por data) fica", () => {
    const r = buscar(lista, "comercio", (x) => [x.nome], { manterOrdem: true });
    assert.deepEqual(
      r.itens.map((x) => x.nome),
      ["DISTRIBUIDORA COMERCIO LTDA", "COMERCIO DE PEDRAS LTDA", "PADARIA COMERCIAL"],
    );
  });
});

describe("placa de veículo sem separador", () => {
  const frota = [{ placa: "RJP-2A45", modelo: "Gol" }, { placa: "KXY-1B22", modelo: "Strada" }];
  const textos = (v: { placa: string; modelo: string }) => [v.placa.replace(/[^a-z0-9]/gi, ""), v.modelo];
  it("acha com e sem hífen, inteira ou por pedaço", () => {
    assert.equal(buscar(frota, "rjp2a45", textos).itens[0].placa, "RJP-2A45");
    assert.equal(buscar(frota, "RJP-2A45", textos).itens[0].placa, "RJP-2A45");
    assert.equal(buscar(frota, "2a45", textos).itens.length, 1);
    assert.equal(buscar(frota, "gol rjp", textos).itens.length, 1);
  });
});

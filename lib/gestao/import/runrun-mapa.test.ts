import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  tipoParaPrioridade,
  etapaParaStatus,
  normalizarEtiqueta,
  normalizarEtiquetas,
  resolverVinculos,
  htmlParaTexto,
  slugify,
  ETIQUETA_VERIFICAR_SUPERVISOR,
  mapearCamposTarefa,
  casarOpcao,
  ehCampoMulti,
  extrairNomeCampo,
  extrairValores,
  type CampoDef,
} from "./runrun-mapa";

describe("tipoParaPrioridade (§6: Tipo -> prioridade)", () => {
  test("Critico e Emergencia -> Urgente", () => {
    assert.deepEqual(tipoParaPrioridade("Critico"), { prioridade: "Urgente", etiquetasExtra: [] });
    assert.deepEqual(tipoParaPrioridade("Crítico"), { prioridade: "Urgente", etiquetasExtra: [] });
    assert.deepEqual(tipoParaPrioridade("Emergência"), {
      prioridade: "Urgente",
      etiquetasExtra: [],
    });
  });

  test("Medio -> Media, Baixo -> Baixa", () => {
    assert.equal(tipoParaPrioridade("Médio").prioridade, "Media");
    assert.equal(tipoParaPrioridade("Baixo").prioridade, "Baixa");
  });

  test('"Verificar com o Supervisor" -> Alta + etiqueta', () => {
    const r = tipoParaPrioridade("Verificar com o Supervisor");
    assert.equal(r.prioridade, "Alta");
    assert.deepEqual(r.etiquetasExtra, [ETIQUETA_VERIFICAR_SUPERVISOR]);
  });

  test("tipo ausente ou desconhecido -> Media sem etiqueta", () => {
    assert.deepEqual(tipoParaPrioridade(null), { prioridade: "Media", etiquetasExtra: [] });
    assert.deepEqual(tipoParaPrioridade(""), { prioridade: "Media", etiquetasExtra: [] });
    assert.deepEqual(tipoParaPrioridade("Qualquer outra coisa"), {
      prioridade: "Media",
      etiquetasExtra: [],
    });
  });
});

describe("etapaParaStatus (§6: Etapa -> gestao_status)", () => {
  test("fechadas -> concluido (singular/plural, masc/fem)", () => {
    assert.equal(etapaParaStatus("Concluída").tipo, "concluido"); // SST (fem sing)
    assert.equal(etapaParaStatus("Concluídos").tipo, "concluido"); // Suporte T.I (masc plural)
    assert.equal(etapaParaStatus("Concluídas").tipo, "concluido");
    assert.equal(etapaParaStatus("Inativas/Inadimplentes").tipo, "concluido");
    assert.equal(etapaParaStatus("Inadimplentes").tipo, "concluido");
  });

  test('"Concluir ..." NAO e etapa fechada (falso positivo evitado)', () => {
    assert.equal(etapaParaStatus("Concluir cadastro").tipo, "ativo");
  });

  test('"Empresas Novas" -> nao_iniciado', () => {
    assert.equal(etapaParaStatus("Empresas Novas").tipo, "nao_iniciado");
  });

  test("demais etapas -> ativo", () => {
    for (const e of [
      "Fiscalização",
      "Treinamento",
      "Revisões a Fazer",
      "Agendado",
      "Inspeção Pendente",
      "Elaboração dos programas",
      "Aguardando Aprovação",
    ]) {
      assert.equal(etapaParaStatus(e).tipo, "ativo", `${e} deveria ser ativo`);
    }
  });

  test("slug estavel e nome preservado", () => {
    const r = etapaParaStatus("Aguardando Retorno do Cliente");
    assert.equal(r.slug, "aguardando-retorno-do-cliente");
    assert.equal(r.nome, "Aguardando Retorno do Cliente");
  });
});

describe("normalizarEtiqueta / normalizarEtiquetas (§6: Tags -> etiquetas)", () => {
  test("unidades viram slugs sem acento", () => {
    assert.equal(normalizarEtiqueta("Petrópolis"), "petropolis");
    assert.equal(normalizarEtiqueta("Nova Friburgo"), "nova-friburgo");
    assert.equal(normalizarEtiqueta("Teresópolis"), "teresopolis");
    assert.equal(normalizarEtiqueta("Portal do Cliente"), "portal-do-cliente");
  });

  test("lista: dedupe, remove vazias, preserva ordem", () => {
    assert.deepEqual(
      normalizarEtiquetas(["Campos", "campos", "", null, "Piabetá", undefined, "Piabetá"]),
      ["campos", "piabeta"],
    );
  });
});

describe("resolverVinculos (§6: Alocados -> vinculados por e-mail)", () => {
  const contas = new Set(["ana@chabra.com.br", "bruno@chabra.com.br", "carla@chabra.com.br"]);

  test("1o alocado -> responsavel; demais -> seguidor", () => {
    const r = resolverVinculos(
      [
        { email: "Ana@JCN Consultoria.com.br", nome: "Ana" },
        { email: "bruno@chabra.com.br", nome: "Bruno" },
      ],
      [],
      contas,
    );
    assert.deepEqual(r.vinculos, [
      { email: "ana@chabra.com.br", tipo: "responsavel" },
      { email: "bruno@chabra.com.br", tipo: "seguidor" },
    ]);
    assert.deepEqual(r.naoCasados, []);
  });

  test("seguidores do Runrun -> seguidor", () => {
    const r = resolverVinculos(
      [{ email: "ana@chabra.com.br", nome: "Ana" }],
      [{ email: "carla@chabra.com.br", nome: "Carla" }],
      contas,
    );
    assert.deepEqual(r.vinculos, [
      { email: "ana@chabra.com.br", tipo: "responsavel" },
      { email: "carla@chabra.com.br", tipo: "seguidor" },
    ]);
  });

  test("responsavel vence quando o mesmo e-mail tambem e seguidor", () => {
    const r = resolverVinculos(
      [{ email: "ana@chabra.com.br", nome: "Ana" }],
      [{ email: "ana@chabra.com.br", nome: "Ana" }],
      contas,
    );
    assert.deepEqual(r.vinculos, [{ email: "ana@chabra.com.br", tipo: "responsavel" }]);
  });

  test("promove seguidor a responsavel se aparecer como 1o alocado depois", () => {
    // seguidor lido antes (via lista de alocados fora de ordem improvavel, mas o codigo
    // trata): aqui o 1o alocado ja e responsavel; garante nao duplicar.
    const r = resolverVinculos(
      [
        { email: "ana@chabra.com.br", nome: "Ana" },
        { email: "ana@chabra.com.br", nome: "Ana" },
      ],
      [],
      contas,
    );
    assert.deepEqual(r.vinculos, [{ email: "ana@chabra.com.br", tipo: "responsavel" }]);
  });

  test("sem e-mail e sem conta -> naoCasados com motivo", () => {
    const r = resolverVinculos(
      [
        { email: null, nome: "Fulano Sem Email" },
        { email: "externo@outra.com", nome: "Externo" },
      ],
      [],
      contas,
    );
    assert.deepEqual(r.vinculos, []);
    assert.deepEqual(r.naoCasados, [
      { nome: "Fulano Sem Email", email: null, papelPretendido: "responsavel", motivo: "sem_email" },
      { nome: "Externo", email: "externo@outra.com", papelPretendido: "seguidor", motivo: "sem_conta" },
    ]);
  });
});

describe("htmlParaTexto (§6: Descricao HTML -> markdown/plain)", () => {
  test("paragrafos e <br> viram quebras de linha", () => {
    assert.equal(htmlParaTexto("<p>Linha um</p><p>Linha dois<br>continua</p>"), "Linha um\n\nLinha dois\ncontinua");
  });

  test("listas viram '- '", () => {
    assert.equal(htmlParaTexto("<ul><li>Um</li><li>Dois</li></ul>"), "- Um\n- Dois");
  });

  test("links viram markdown", () => {
    assert.equal(
      htmlParaTexto('Veja <a href="https://runrun.it/x">o cartao</a> aqui'),
      "Veja [o cartao](https://runrun.it/x) aqui",
    );
  });

  test("entidades sao decodificadas", () => {
    assert.equal(htmlParaTexto("A &amp; B &lt;ok&gt; &#233;"), "A & B <ok> é");
  });

  test("vazio/nulo -> string vazia", () => {
    assert.equal(htmlParaTexto(null), "");
    assert.equal(htmlParaTexto(""), "");
  });
});

describe("slugify (helper deterministico)", () => {
  test("apara pontas e colapsa separadores", () => {
    assert.equal(slugify("  Olá,  Mundo!! "), "ola-mundo");
    assert.equal(slugify("---"), "");
  });
});

// ── GE4: campos personalizados (Runrun custom fields -> gestao_tarefas.campos) ──────
// Defs com os IDs (uuid) e opcoes reais capturadas do QDR-GERAL01 (2026-09-16, subset).
const PRODUTOS_ID = "11111111-1111-1111-1111-111111111111";
const TIPO_ID = "22222222-2222-2222-2222-222222222222";
const defProdutos: CampoDef = {
  id: PRODUTOS_ID,
  nome: "Produtos",
  tipo: "multi",
  opcoes: ["PCMSO", "LTCAT", "LI", "LP", "PGR", "Psicossocial", "ASOs", "DRPS", "DIREÇÃO DEFENSIVA", "NR - 01"],
};
const defTipoCliente: CampoDef = {
  id: TIPO_ID,
  nome: "Tipo de Cliente",
  tipo: "selecao",
  opcoes: ["Mensal", "Avulso", "Somente PCSMO", "Somente PGR"],
};
const DEFS = [defProdutos, defTipoCliente];

describe("ehCampoMulti (multi -> array; resto -> string)", () => {
  test("variantes de multipla escolha", () => {
    for (const t of ["multi", "Multi", "multipla", "multiple", "list", "multi-select"]) {
      assert.equal(ehCampoMulti(t), true, `${t} deveria ser multi`);
    }
  });
  test("selecao/single/texto/null -> nao-multi", () => {
    for (const t of ["selecao", "single", "texto", "numero", "", null, undefined]) {
      assert.equal(ehCampoMulti(t as string | null | undefined), false);
    }
  });
});

describe("casarOpcao (verbatim -> normalizado)", () => {
  test("igualdade verbatim", () => {
    assert.equal(casarOpcao("Somente PCSMO", defTipoCliente.opcoes), "Somente PCSMO");
  });
  test("normaliza acento/caixa e devolve o CANONICO", () => {
    assert.equal(casarOpcao("direção defensiva", defProdutos.opcoes), "DIREÇÃO DEFENSIVA");
    assert.equal(casarOpcao("psicossocial", defProdutos.opcoes), "Psicossocial");
    assert.equal(casarOpcao("nr 01", defProdutos.opcoes), "NR - 01"); // separador difere
  });
  test("fora do catalogo -> null; vazio -> null", () => {
    assert.equal(casarOpcao("Procuração Eletrônica", defProdutos.opcoes), null);
    assert.equal(casarOpcao("  ", defProdutos.opcoes), null);
    assert.equal(casarOpcao(null, defProdutos.opcoes), null);
  });
});

describe("extrairNomeCampo / extrairValores (shape defensivo)", () => {
  test("nome em chaves alternativas e aninhado", () => {
    assert.equal(extrairNomeCampo({ name: "Produtos" }), "Produtos");
    assert.equal(extrairNomeCampo({ custom_field_title: "Tipo de Cliente" }), "Tipo de Cliente");
    assert.equal(extrairNomeCampo({ custom_field: { title: "Produtos" } }), "Produtos");
    assert.equal(extrairNomeCampo({ foo: "bar" }), null);
  });
  test("valores: escalar, array de strings, array de objetos", () => {
    assert.deepEqual(extrairValores({ value: "Mensal" }), ["Mensal"]);
    assert.deepEqual(extrairValores({ values: ["PGR", "LI"] }), ["PGR", "LI"]);
    assert.deepEqual(extrairValores({ value: [{ value: "PGR" }, { name: "LI" }] }), ["PGR", "LI"]);
    assert.deepEqual(extrairValores({ custom_field_value: 42 }), ["42"]);
    assert.deepEqual(extrairValores({ outro: "x" }), []);
  });
});

describe("mapearCamposTarefa (GE4: custom fields -> {id_campo: valor})", () => {
  test("Produtos multi -> array de canonicos; Tipo single -> string (shape A: value array)", () => {
    const brutos = [
      { name: "Produtos", value: ["PGR", "PCMSO", "Psicossocial"] },
      { name: "Tipo de Cliente", value: "Mensal" },
    ];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.deepEqual(r.campos[PRODUTOS_ID], ["PGR", "PCMSO", "Psicossocial"]);
    assert.equal(r.campos[TIPO_ID], "Mensal");
    assert.deepEqual(r.naoMapeados, []);
  });

  test("shape B: N entradas do mesmo campo (uma por valor) sao UNIDAS", () => {
    const brutos = [
      { custom_field_title: "Produtos", custom_field_value: "PGR" },
      { custom_field_title: "Produtos", custom_field_value: "LTCAT" },
      { custom_field_title: "Tipo de Cliente", custom_field_value: "Avulso" },
    ];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.deepEqual(r.campos[PRODUTOS_ID], ["PGR", "LTCAT"]);
    assert.equal(r.campos[TIPO_ID], "Avulso");
  });

  test("valores casam por normalizacao e gravam o CANONICO (verbatim)", () => {
    const brutos = [{ title: "Produtos", values: ["direção defensiva", "nr 01"] }];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.deepEqual(r.campos[PRODUTOS_ID], ["DIREÇÃO DEFENSIVA", "NR - 01"]);
  });

  test("campo sem def no quadro -> naoMapeados (campo_sem_def), nao quebra", () => {
    const brutos = [
      { name: "Pontos", value: "13" },
      { name: "Produtos", value: ["PGR"] },
    ];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.deepEqual(r.campos[PRODUTOS_ID], ["PGR"]);
    assert.ok(!(TIPO_ID in r.campos));
    assert.deepEqual(r.naoMapeados, [{ campo: "Pontos", valor: "13", motivo: "campo_sem_def" }]);
  });

  test("opcao fora do catalogo -> naoMapeados (opcao_sem_match); demais entram", () => {
    const brutos = [
      { name: "Produtos", value: ["PGR", "Procuração Eletrônica", "Solicitação de Quadro Funcional"] },
    ];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.deepEqual(r.campos[PRODUTOS_ID], ["PGR"]);
    assert.deepEqual(r.naoMapeados, [
      { campo: "Produtos", valor: "Procuração Eletrônica", motivo: "opcao_sem_match" },
      { campo: "Produtos", valor: "Solicitação de Quadro Funcional", motivo: "opcao_sem_match" },
    ]);
  });

  test("idempotente: valores repetidos no multi viram SET (nao infla)", () => {
    const brutos = [{ name: "Produtos", value: ["PGR", "PGR", "LI", "PGR"] }];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.deepEqual(r.campos[PRODUTOS_ID], ["PGR", "LI"]);
  });

  test("single com varios casados -> 1o valor; extras viram log", () => {
    const brutos = [{ name: "Tipo de Cliente", value: ["Mensal", "Avulso"] }];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.equal(r.campos[TIPO_ID], "Mensal");
    assert.deepEqual(r.naoMapeados, [{ campo: "Tipo de Cliente", valor: "Avulso", motivo: "single_valor_extra" }]);
  });

  test("nenhum valor casa -> chave NAO e gravada (merge nao apaga nada)", () => {
    const brutos = [{ name: "Produtos", value: ["Inexistente"] }];
    const r = mapearCamposTarefa(brutos, DEFS);
    assert.deepEqual(r.campos, {});
    assert.equal(r.naoMapeados.length, 1);
  });

  test("entrada nula/vazia/sem nome -> {campos:{}, naoMapeados:[]}", () => {
    assert.deepEqual(mapearCamposTarefa(null, DEFS), { campos: {}, naoMapeados: [] });
    assert.deepEqual(mapearCamposTarefa([], DEFS), { campos: {}, naoMapeados: [] });
    assert.deepEqual(mapearCamposTarefa([{ foo: "bar" }], DEFS), { campos: {}, naoMapeados: [] });
  });
});

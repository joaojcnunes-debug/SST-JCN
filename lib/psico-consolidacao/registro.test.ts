import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { consolidar, type ItemMotor } from "./motor";
import { sugerirSetorCanonico } from "./setores";
import { assinaturaResultado, montarRegistro, validacaoVigente, type ValidacaoLinha } from "./registro";

// O fixture é um grupo real anonimizado do painel e não vem para o JCN sem
// autorização: sem ele, os testes que dependem dos números do caso são pulados.
const FIXTURE = path.join(process.cwd(), "lib/psico-consolidacao/__fixtures__/genesis-2026-10.json");
const TEM_FIXTURE = existsSync(FIXTURE);
const SEM_FIXTURE = { skip: !TEM_FIXTURE && "fixture do grupo real ausente (lib/psico-consolidacao/__fixtures__)" };
const fx = (TEM_FIXTURE ? JSON.parse(readFileSync(FIXTURE, "utf-8")) : { itens: [] }) as { itens: Array<Omit<ItemMotor, "idEmpresa" | "setor"> & { empresa: string }> };
const FATORES = [
  "assedio", "eventos_traumaticos", "sobrecarga", "recompensas", "falta_suporte", "subcarga", "gestao_mudancas",
  "maus_relacionamentos", "baixo_controle", "clareza_papel", "comunicacao_dificil", "justica_organizacional", "trabalho_remoto",
].map((id_fator, i) => ({ id_fator, nome: id_fator, ordem: i + 1 }));
const itens: ItemMotor[] = fx.itens.map(({ empresa, ...i }) => ({ ...i, idEmpresa: empresa, setor: sugerirSetorCanonico(i.setorOriginal) }));
const empresas = [...new Set(itens.map((i) => i.idEmpresa))].map((e) => ({ idEmpresa: e, nome: e, papel: null }));
const r = consolidar({ itens, empresas, fatores: FATORES });

test("assinatura: igual para o mesmo resultado, muda quando o PGR muda", SEM_FIXTURE, () => {
  assert.equal(assinaturaResultado(r), assinaturaResultado(consolidar({ itens, empresas, fatores: FATORES })));
  const semTrivial = consolidar({ itens, empresas, fatores: FATORES, aepIncluirTrivialBaixo: false });
  assert.notEqual(assinaturaResultado(r), assinaturaResultado(semTrivial));
});

test("registro: 564 itens, 11 empresas a validar e o resultado inteiro na foto", SEM_FIXTURE, () => {
  const reg = montarRegistro({
    idExecucao: "PCX-TESTE", idGrupo: "GRP-X", r, itens, documentos: [],
    idSetorCanonico: () => null,
    incluirTrivialBaixo: true, fatoresIgnorados: [], setoresSemTransito: [], observacao: "  ",
  });
  assert.equal(reg.itens.length, 564);
  assert.equal(reg.execucao.parametros.n_itens, 564);
  assert.equal(reg.execucao.parametros.empresas.length, 11);
  assert.deepEqual(reg.execucao.parametros.resumo, { incluir: 301, revisar: 25, ok: r.resumo.ok });
  assert.equal(reg.execucao.observacao, null);
  assert.equal(reg.execucao.resultado.lacunas.length, r.lacunas.length);
});

test("validação vigente: a mais recente de cada empresa", SEM_FIXTURE, () => {
  const v = (id: string, emp: string, em: string, decisao: "VALIDADO" | "COM_RESSALVA"): ValidacaoLinha => ({
    id_validacao: id, id_execucao: "PCX-1", id_empresa: emp, decisao, validado_por: "x", comentario: null,
    validado_em: em.slice(0, 10), registrado_por: "y", registrado_em: em,
  });
  const m = validacaoVigente([
    v("1", "A", "2026-10-19T10:00:00Z", "COM_RESSALVA"),
    v("2", "A", "2026-10-20T10:00:00Z", "VALIDADO"),
    v("3", "B", "2026-10-19T10:00:00Z", "COM_RESSALVA"),
  ]);
  assert.equal(m.get("PCX-1|A")!.decisao, "VALIDADO");
  assert.equal(m.get("PCX-1|B")!.decisao, "COM_RESSALVA");
});

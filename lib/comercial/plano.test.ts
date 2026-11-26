import { test } from "node:test";
import assert from "node:assert/strict";
import type { IntervencaoIndicada, RiscoConciliado } from "./liberacao";
import { anexarPlanos, chaveMetodo, cronograma, linhasDoPlano, planoDoVendedor, metodoDe, modalidadesEmUso, planoVazio, riscosDoPlano, rotuloMes, setoresDoPlano, temasDoPlano } from "./plano";

const ind = (setor: string, fator: string, nome: string, modalidade: string | null, id: string | null = null) =>
  ({ id_item: `${setor}${fator}${nome}`, id_empresa: "E", setor_chave: setor, setor_nome: setor, id_fator: fator, fator_nome: fator,
     id_intervencao: id, nome, modalidade, responsavel: null, prazo_dias: null }) as IntervencaoIndicada;
const risco = (setor: string, fator: string, aet = false) =>
  ({ chave: `${setor}|${fator}`, setorChave: setor, setor, idFator: fator, fator, questionarios: [], aet, foraDaConciliacao: false }) as RiscoConciliado;

test("temas sem repetir, com métodos, setores e riscos", () => {
  const t = temasDoPlano([ind("Adm", "Sobrecarga", "Gestão do tempo", "EAD", "I1"), ind("Eng", "Sobrecarga", "Gestão do tempo", "Presencial", "I1"),
    ind("Eng", "Assédio", "Respeito no trabalho", "Ao vivo")]);
  assert.deepEqual(t.map((x) => [x.nome, x.modalidades.join("+"), x.setores.join("+")]), [["Gestão do tempo", "EAD+Presencial", "Adm+Eng"], ["Respeito no trabalho", "Ao vivo", "Eng"]]);
  assert.deepEqual(modalidadesEmUso(t, [{ modalidade: "EAD", ordem: 1 }, { modalidade: "Ao vivo", ordem: 2 }, { modalidade: "Presencial", ordem: 3 }] as never), ["EAD", "Ao vivo", "Presencial"]);
});

test("setores e riscos do plano", () => {
  const r = [risco("Eng", "Sobrecarga"), risco("Adm", "Sobrecarga", true), risco("Adm", "Assédio")];
  assert.deepEqual(setoresDoPlano(r), ["Adm", "Eng"]);
  assert.deepEqual(riscosDoPlano(r), [{ fator: "Assédio", setores: ["Adm"], aet: false }, { fator: "Sobrecarga", setores: ["Eng", "Adm"], aet: true }]);
});

test("método: padrão do catálogo com o ajuste da empresa por cima", () => {
  const m = [{ modalidade: "EAD", ordem: 1, forma: "Plataforma", duracao: "8h", avaliacao: "Prova", certificado: "Sim" }];
  assert.equal(metodoDe("EAD", m, null).duracao, "8h");
  assert.deepEqual(metodoDe("EAD", m, { metodos: { EAD: { duracao: "4h", certificado: null } } }), { forma: "Plataforma", duracao: "4h", avaliacao: "Prova", certificado: null });
  assert.equal(metodoDe("Presencial", m, null).forma, null);
});

test("método por intervenção: o ajuste do tema vale mais que o da modalidade", () => {
  const m = [{ modalidade: "EAD", ordem: 1, forma: "Plataforma", duracao: "8h", avaliacao: "Prova", certificado: "Sim" }];
  const plano = { metodos: { EAD: { duracao: "4h" }, [chaveMetodo("I1", "EAD")]: { duracao: "2h", avaliacao: null } } };
  assert.deepEqual(metodoDe("EAD", m, plano, "I1"), { forma: "Plataforma", duracao: "2h", avaliacao: null, certificado: "Sim" });
  assert.equal(metodoDe("EAD", m, plano, "I2").duracao, "4h");
});

test("um tema por mês: um em cada mês, na ordem, e o escolhido vale", () => {
  const temas = temasDoPlano([ind("A", "F1", "Tema A", "EAD"), ind("A", "F2", "Tema B", "Presencial"), ind("A", "F3", "Tema C", "Ao vivo")]);
  const c = cronograma({ ...planoVazio("E", "empresa"), inicio: "2027-11-01" }, temas);
  assert.deepEqual(c.meses.map((m) => `${m.rotulo}:${m.temas.map((t) => t.nome).join(",")}`), ["nov/2027:Tema A", "dez/2027:Tema B", "jan/2028:Tema C"]);
  const chaveC = temas.find((t) => t.nome === "Tema C")!.chave;
  const c2 = cronograma({ ...planoVazio("E", "empresa"), meses: 2, temas: { [chaveC]: 1 } }, temas);
  assert.deepEqual(c2.meses.map((m) => m.temas.map((t) => t.nome).join(",")), ["Tema A,Tema C", "Tema B"]);
});

test("EAD contínuo: só EAD fica o período todo; online e presencial vão para os meses", () => {
  const temas = temasDoPlano([ind("A", "F1", "Tema A", "EAD"), ind("A", "F2", "Tema B", "Presencial"), ind("B", "F1", "Tema A", "EAD")]);
  const c = cronograma({ ...planoVazio("E", "empresa"), planejamento: "ead_continuo", meses: 3 }, temas);
  assert.deepEqual(c.continuos.map((t) => t.nome), ["Tema A"]);
  assert.deepEqual(c.meses.map((m) => m.temas.map((t) => t.nome).join(",")), ["Tema B", "", ""]);
  assert.equal(rotuloMes(null, 2), "Mês 2");
});

test("planejamento em colunas: por setor (riscos ao lado) e por risco (setores ao lado)", () => {
  const ii = [ind("Caixa", "Assédio", "Tema A", "EAD", "I1"), ind("Loja", "Assédio", "Tema A", "EAD", "I1"), ind("Caixa", "Sobrecarga", "Tema B", "Presencial")];
  const temas = temasDoPlano(ii);
  const txt = (por: "setor" | "risco") => linhasDoPlano(ii, temas, por).map((l) => `${l.grupo}|${l.outros.join("+")}|${l.tema.nome}`);
  assert.deepEqual(txt("setor"), ["Caixa|Assédio|Tema A", "Caixa|Sobrecarga|Tema B", "Loja|Assédio|Tema A"]);
  assert.deepEqual(txt("risco"), ["Assédio|Caixa+Loja|Tema A", "Sobrecarga|Caixa|Tema B"]);
  // só os temas pedidos (ex.: os mensais)
  assert.deepEqual(linhasDoPlano(ii, temas.filter((t) => t.nome === "Tema B"), "setor").map((l) => l.grupo), ["Caixa"]);
});

test("vendedor: plano com o mês de cada intervenção e o cronograma (padrão sem plano gravado)", () => {
  const ii = [ind("Caixa", "Assédio", "Tema A", "EAD", "I1"), ind("Caixa", "Sobrecarga", "Tema B", "Presencial", "I2")];
  const p = planoDoVendedor({ ...planoVazio("E", "empresa"), inicio: "2027-01-01", temas: { I2: 1, I1: 2 } }, ii)!;
  assert.deepEqual(p.linhas.map((l) => `${l.intervencao}:${l.metodo}:${l.mes}`), ["Tema A:EAD:fev/2027", "Tema B:Presencial:jan/2027"]);
  assert.deepEqual(p.cronograma.map((m) => `${m.rotulo}=${m.intervencoes.join(",")}`), ["jan/2027=Tema B", "fev/2027=Tema A"]);
  assert.equal(p.gravado, true);
  assert.equal(planoDoVendedor(null, ii)!.gravado, false);
  assert.equal(planoDoVendedor(null, []), null);
});

test("vendedor: método e plano entram na oportunidade; o grupo liberado vale sobre a empresa", () => {
  const m = [{ modalidade: "EAD", ordem: 1, forma: "Plataforma", duracao: "8h", avaliacao: "Prova", certificado: "Sim" }];
  const ii = [ind("Caixa", "Assédio", "Tema A", "EAD", "I1")];
  const emp = { empresa: { idEmpresa: "E" }, oportunidades: [{ produto: "Intervenção psicossocial", intervencoes: [{ idItem: "x", setor: "Caixa", risco: "Assédio", intervencao: "Tema A", modalidade: "EAD", responsavel: null, prazoDias: null, idIntervencao: "I1" }] }] } as never;
  const planos = [
    { ...planoVazio("E", "empresa"), metodos: { [chaveMetodo("I1", "EAD")]: { duracao: "da empresa" } } },
    { ...planoVazio("G", "grupo"), metodos: { [chaveMetodo("I1", "EAD")]: { duracao: "do grupo" } } },
  ];
  const so = anexarPlanos([emp], ii, planos, m, []);
  const op = (so[0] as { oportunidades: { intervencoes: { metodo: { duracao: string; forma: string } }[]; plano: unknown }[] }).oportunidades[0];
  assert.equal(op.intervencoes[0].metodo.duracao, "da empresa");
  assert.equal(op.intervencoes[0].metodo.forma, "Plataforma");
  assert.ok(op.plano);
  const g = [{ id_grupo: "G", status: "CONCLUIDO", fechada: true, empresas: [{ id_empresa: "E" }] }] as never;
  const comGrupo = anexarPlanos([emp], ii, planos, m, g);
  assert.equal((comGrupo[0] as { oportunidades: { intervencoes: { metodo: { duracao: string } }[] }[] }).oportunidades[0].intervencoes[0].metodo.duracao, "do grupo");
});

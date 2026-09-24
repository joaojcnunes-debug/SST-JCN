/* ==========================================================================
   Conversão linha do banco → domínio do motor (DIM-01).

   Cópia FIEL dos conversores de `web/src/services/api.js` do repo
   joaojefferson-hash/Dimensionamento_Chabra @ e5671c2, com uma única mudança:
   os nomes de tabela ganharam o prefixo `dim_` (quem lê são os hooks, não este
   arquivo — aqui só entram LINHAS já buscadas).

   Por que cópia e não reescrita: é aqui que o C7 se decide. O motor recebe
   camelCase (`empresasVencidas`, `dataAdmissao`, `alocacoes`) e o banco devolve
   snake_case; um campo mapeado errado não estoura nada — só muda o número, em
   silêncio. O jeito de não errar é não redigitar.

   Continua .js pelo mesmo motivo do motor; os tipos vivem em mapear.d.ts.
   ========================================================================== */

export const CONDICOES = [
  { condicao: 'mensal',        campo: 'empresasVencidas',     rotulo: 'Mensal',                ajuda: 'clientes com contrato mensal cujos documentos vencem no mês' },
  { condicao: 'exclusiva_tst', campo: 'empresasExclusivaTst', rotulo: 'Exclusiva TST',         ajuda: 'clientes na condição Exclusiva TST (atendimento completo)' },
  { condicao: 'sem_avaliacao', campo: 'empresasSemAvaliacao', rotulo: 'Empresa sem avaliação', ajuda: 'clientes ainda sem avaliação realizada no mês' },
  { condicao: 'contrato_novo', campo: 'empresasContratoNovo', rotulo: 'Contratos novos',       ajuda: 'clientes de contratos firmados no mês' },
];

export const TIPOS_PRODUCAO = [
  { id: 'tecnico',        rotulo: 'Técnico',        descricao: 'realiza inspeções e relatórios — entra no dimensionamento como técnico' },
  { id: 'administrativo', rotulo: 'Administrativo', descricao: 'finaliza empresas — entra como administrativo' },
  { id: 'nenhuma',        rotulo: 'Sem produção',   descricao: 'sem produção diária; fica fora do cálculo (ex.: supervisores)' },
];

export const COORDENA = [
  { id: 'todos',           rotulo: 'Toda a equipe' },
  { id: 'tecnicos',        rotulo: 'Somente os técnicos' },
  { id: 'administrativos', rotulo: 'Somente os administrativos' },
];

export const PARAMETROS_PADRAO = {
  diasUteis: [21, 18, 22, 20, 20, 21, 23, 21, 21, 21, 19, 22],
  ocupacaoAlvo: 85,
  prazoDias: 60,
  rampup: [50, 80],
};

const num = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);

/* ---------- conversores linha → domínio ---------- */

export const funcaoDeLinha = r => ({
  id: r.id, nome: r.nome, tipoProducao: r.tipo_producao, chefia: r.chefia === true,
  coordena: r.coordena || 'todos', respondeParaId: r.responde_para || null,
  ordem: num(r.ordem), custoMensal: num(r.custo_mensal),
});

export const funcaoParaLinha = f => ({
  nome: f.nome.trim(), tipo_producao: f.tipoProducao, chefia: !!f.chefia,
  coordena: f.chefia ? f.coordena : 'todos',
  responde_para: f.chefia ? f.respondeParaId || null : null,
  ordem: num(f.ordem), custo_mensal: Math.max(0, num(f.custoMensal)),
});

export const colaboradorDeLinha = r => ({
  id: r.id, nome: r.nome, funcaoId: r.funcao_id || null,
  inspecoesDia: num(r.inspecoes_dia), relatoriosDia: num(r.relatorios_dia), empresasDia: num(r.empresas_dia),
  dataAdmissao: r.data_admissao || null, dataDesligamento: r.data_desligamento || null,
  custoMensal: r.custo_mensal != null ? num(r.custo_mensal) : null,
  // v257 — marcações que tiram a pessoa do cálculo (ver colaboradoresCompletos)
  semProducaoDiaria: r.sem_producao_diaria === true,
  gestao: r.gestao === true,
  alocacoes: [],
});

export const colaboradorParaLinha = c => ({
  nome: c.nome.trim(), funcao_id: c.funcaoId || null,
  inspecoes_dia: Math.max(0, num(c.inspecoesDia)),
  relatorios_dia: Math.max(0, num(c.relatoriosDia)),
  empresas_dia: Math.max(0, num(c.empresasDia)),
  data_admissao: c.dataAdmissao || null, data_desligamento: c.dataDesligamento || null,
  custo_mensal: num(c.custoMensal) > 0 ? num(c.custoMensal) : null,
  sem_producao_diaria: c.semProducaoDiaria === true,
  gestao: c.gestao === true,
});

/**
 * Motivo pelo qual a pessoa está fora do cálculo — '' quando está dentro.
 * As duas marcações têm o MESMO efeito; o motivo serve para a tela dizer qual foi.
 * Quando as duas estão marcadas, "gestão" ganha: é a condição mais permanente.
 */
export const motivoForaDoCalculo = c =>
  c?.gestao === true ? 'gestao' : c?.semProducaoDiaria === true ? 'sem_producao_diaria' : '';

export const porteDeLinha = r => ({ codigo: r.codigo, nome: r.nome, peso: num(r.peso, 1), ordem: num(r.ordem) });

export const parametrosDeLinha = r => ({
  diasUteis: Array.isArray(r?.dias_uteis) && r.dias_uteis.length === 12
    ? r.dias_uteis.map(v => num(v, 21))
    : PARAMETROS_PADRAO.diasUteis.slice(),
  ocupacaoAlvo: num(r?.ocupacao_alvo, 85),
  prazoDias: num(r?.prazo_dias, 60),
  rampup: Array.isArray(r?.rampup) ? r.rampup.map(v => num(v, 100)) : PARAMETROS_PADRAO.rampup.slice(),
});

/** Monta um mês: demanda por condição × porte + contagens derivadas + clientes ativos. */
export function montarMes(demanda = {}, clientesAtivos = 0, atendidas = 0, atendidasPorte = null) {
  const d = {};
  CONDICOES.forEach(c => {
    d[c.condicao] = {};
    Object.entries(demanda[c.condicao] || {}).forEach(([porte, q]) => {
      const n = Math.max(0, Math.round(num(q)));
      if (n > 0) d[c.condicao][porte] = n;
    });
  });
  const soma = cond => Object.values(d[cond]).reduce((s, q) => s + q, 0);
  const contagens = Object.fromEntries(CONDICOES.map(c => [c.campo, soma(c.condicao)]));
  const porte = {};
  Object.entries(atendidasPorte || {}).forEach(([k, v]) => {
    const q = Math.max(0, Math.round(num(v)));
    if (q > 0) porte[k] = q;
  });
  const totalAtendidas = Object.keys(porte).length
    ? Object.values(porte).reduce((s, q) => s + q, 0)
    : Math.max(0, Math.round(num(atendidas)));
  // compatibilidade: sem detalhe por porte, o total informado conta como porte P
  if (!Object.keys(porte).length && totalAtendidas > 0) porte.P = totalAtendidas;
  return {
    demanda: d, ...contagens,
    clientesAtivos: Math.max(0, Math.round(num(clientesAtivos))),
    atendidas: totalAtendidas, atendidasPorte: porte,
  };
}

/** Linhas de dim_demanda_mensal + dim_unidade_mes → mesesPorAno de cada unidade. */
export function mesesPorUnidade(demanda, ativos) {
  const por = {};
  const slot = (uid, ano, mes) => {
    const u = (por[uid] = por[uid] || {});
    const a = (u[ano] = u[ano] || {});
    return (a[mes] = a[mes] || { demanda: {}, clientesAtivos: 0, atendidas: 0, atendidasPorte: {} });
  };
  (demanda || []).forEach(d => {
    const s = slot(d.unidade_id, d.ano, d.mes);
    (s.demanda[d.condicao] = s.demanda[d.condicao] || {})[d.porte] = num(d.quantidade);
  });
  (ativos || []).forEach(a => {
    const s = slot(a.unidade_id, a.ano, a.mes);
    s.clientesAtivos = num(a.clientes_ativos);
    s.atendidas = num(a.atendidas);
    s.atendidasPorte = a.atendidas_porte || {};
  });
  Object.values(por).forEach(anos =>
    Object.values(anos).forEach(meses =>
      Object.keys(meses).forEach(m => {
        meses[m] = montarMes(meses[m].demanda, meses[m].clientesAtivos, meses[m].atendidas, meses[m].atendidasPorte);
      })));
  return por;
}

/** Junta as linhas cruas num cadastro pronto para o motor. */
export function montarCadastro({ funcoes, unidades, colaboradores, alocacoes, demanda, ativos, portes, parametros }) {
  const porUnidade = mesesPorUnidade(demanda, ativos);
  const porColab = {};
  (alocacoes || []).forEach(a => {
    (porColab[a.colaborador_id] = porColab[a.colaborador_id] || [])
      .push({ unidadeId: a.unidade_id, percentual: num(a.percentual) });
  });
  return {
    funcoes: (funcoes || []).map(funcaoDeLinha),
    unidades: (unidades || []).map(r => ({
      id: r.id, nome: r.nome, codigoApi: r.codigo_api || null, mesesPorAno: porUnidade[r.id] || {},
    })),
    colaboradores: (colaboradores || []).map(r => ({ ...colaboradorDeLinha(r), alocacoes: porColab[r.id] || [] })),
    portes: (portes || []).map(porteDeLinha),
    parametros: parametrosDeLinha(parametros),
  };
}

/** Colaboradores enriquecidos com a função — o formato que o motor lê. */
export function colaboradoresCompletos(colaboradores, funcoes, unidades) {
  const porFuncao = Object.fromEntries((funcoes || []).map(f => [f.id, f]));
  const porUnidade = Object.fromEntries((unidades || []).map(u => [u.id, u]));
  return (colaboradores || []).map(c => {
    const f = porFuncao[c.funcaoId] || null;
    // v257 — UM ponto decide quem entra na conta. Marcar a pessoa a rebaixa a
    // `tipoProducao = 'nenhuma'`, que é o valor que o motor JÁ trata como "fora das
    // contas" desde a origem: ela some de `produtivos`, de `pessoasMes`/`cabecasMes`
    // (o FTE da equipe) e de `consegue`. Não foi preciso tocar em calculo.js.
    //
    // O efeito no número não é cosmético: `deficit = necessário − quadro`, e `quadro` é
    // esse FTE. Em 2026-09-24 havia 6,5 FTE administrativos entregando zero e contando
    // como capacidade — o déficit exibido estava subestimado. Ver o cabeçalho da v257.
    const foraDoCalculo = c.semProducaoDiaria === true || c.gestao === true;
    return {
      ...c,
      funcao: f ? f.nome : '',
      foraDoCalculo,
      motivoFora: motivoForaDoCalculo(c),
      tipoProducao: foraDoCalculo ? 'nenhuma' : f ? f.tipoProducao : 'nenhuma',
      chefia: !!(f && f.chefia),
      coordena: f && f.chefia ? f.coordena : 'todos',
      funcaoOrdem: f ? f.ordem : 9999,
      funcaoCustoMensal: f ? f.custoMensal : 0,
      alocacoes: (c.alocacoes || []).map(a => ({ ...a, unidadeNome: (porUnidade[a.unidadeId] || {}).nome || '' })),
    };
  });
}

/** Unidades com os `meses` do ano pedido (formato do motor). */
export function unidadesDoAno(unidades, ano) {
  return (unidades || []).map(u => ({
    id: u.id, nome: u.nome, meses: (u.mesesPorAno && u.mesesPorAno[ano]) || {},
  }));
}

/** Pesos por porte, no formato que o motor espera em `parametros.pesosPorte`. */
export function pesosPorte(portes) {
  return Object.fromEntries((portes || []).map(p => [p.codigo, p.peso]));
}

/** Anos do seletor: 2025 até o ano corrente + 2, mais os que têm números lançados. */
export function anosDisponiveis(unidades, anoSelecionado) {
  const hoje = new Date().getFullYear();
  const set = new Set();
  for (let y = Math.min(2025, hoje); y <= hoje + 2; y++) set.add(y);
  (unidades || []).forEach(u => Object.keys(u.mesesPorAno || {}).forEach(y => set.add(Number(y))));
  if (anoSelecionado) set.add(anoSelecionado);
  return [...set].sort((a, b) => a - b);
}

/* ==========================================================================
   MOTOR DE DIMENSIONAMENTO -- copia FIEL de js/calculo.js do repo
   joaojefferson-hash/Dimensionamento_Chabra @ e5671c2 (DIM-01, 2026-09-22).

   Continua .js de proposito: a matematica e auditada pelos 84 testes e
   retipar 1.141 linhas a mao e onde o bug entra. Os tipos do lado de fora
   vivem em calculo.d.ts. Unica mudanca em relacao a origem: a linha
   `module.exports` (CommonJS) virou `export default` (ESM) -- o mesmo corte
   que o sync-engine.mjs da origem faz para o front Vue.
   ========================================================================== */
/* ==========================================================================
   Calculo — motor de dimensionamento (modelo de produção diária)

   Funções puras sobre os cadastros; nada de DOM. Também roda em Node (testes).

   Entradas (formato do Store):
     unidades:      [{ id, nome, meses?: { [1..12]: { empresasVencidas, empresasExclusivaTst,
                                                     demanda?: { mensal: { P, M, G… }, exclusiva_tst: { … } } } } }]
                    // empresasVencidas/ExclusivaTst = contagens (Σ dos portes); demanda = por porte (o motor pondera)
     colaboradores: [{ id, nome, funcao, tipoProducao ('tecnico' | 'administrativo' | 'nenhuma'), chefia,
                       empresasDia, inspecoesDia, relatoriosDia, alocacoes: [{ unidadeId, percentual }],
                       dataAdmissao? ('AAAA-MM-DD'), dataDesligamento?, custoMensal?, funcaoCustoMensal? }]
                    // tipoProducao 'nenhuma' = não entra nas contas; chefia = aparece como responsável pelas unidades
     parametros:    { diasUteis[12], ocupacaoAlvo, rampup?: [50, 80], pesosPorte?: { P: 1, M: 1.5, G: 2 } }
     simulacoes:    [{ unidadeId, grupo: 'tecnico' | 'administrativo', quantidade (≠ 0; negativa = a menos), de, ate (0..11),
                       inspecoesDia?, relatoriosDia?, empresasDia?, custoMensal? }]   // "e se…": pessoas virtuais só nas contas
     janela:        { de: 0..11, ate: 0..11 }   (meses, inclusive)
     ano:           ano dos meses calculados (para admissão/desligamento e ramp-up; padrão = ano corrente)

   Modelo:
     precisa(unidade, entrega, mês) = Σ clientes que vencem no mês × peso do porte (P 1,0 · M 1,5 · G 2,0)
                                      (cada um exige uma inspeção, um relatório e uma finalização)
     produção(colab, entrega, mês) = valor_por_dia × dias úteis do mês × fração alocada na unidade
                                     × presença no mês (admissão/desligamento, proporcional aos dias)
                                     × ramp-up (1º mês de casa rampup[0]%, 2º rampup[1]%…, depois 100%)
     consegue(unidade, entrega, mês) = Σ produção × (ocupaçãoAlvo/100)   ← folga para imprevistos
     sobra = consegue − precisa  (negativa = falta)
     pessoas que faltam/sobram = sobra ÷ produção de uma pessoa inteira (veterana) no período
     custo: por função, custo médio mensal de uma pessoa (colaborador.custoMensal ou o da função);
            faltam × custo = quanto custa contratar; sobram × custo = quanto custa a sobra

   Entregas: técnicos → inspeções e relatórios; administrativos → empresas finalizadas.
   A situação de uma função é a pior entre as suas entregas; a da unidade, a pior das funções.
   ========================================================================== */

const Calculo = (() => {
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  // grupos de produção (tipo da função do colaborador)
  const TEC = 'tecnico';
  const ADM = 'administrativo';
  const FUNCOES = [TEC, ADM];
  const FUNCAO_CURTA = { [TEC]: 'Técnicos', [ADM]: 'Administrativos' };
  const FUNCAO_SINGULAR = { [TEC]: 'técnico', [ADM]: 'administrativo' };

  const ENTREGAS = [
    { id: 'inspecoes',  funcao: TEC, campo: 'inspecoesDia',  rotulo: 'Inspeções',            unidade: 'inspeções',            singular: 'uma inspeção',    atividade: 'inspeção' },
    { id: 'relatorios', funcao: TEC, campo: 'relatoriosDia', rotulo: 'Relatórios',           unidade: 'relatórios',           singular: 'um relatório',    atividade: 'relatório' },
    { id: 'empresas',   funcao: ADM, campo: 'empresasDia',   rotulo: 'Empresas finalizadas', unidade: 'empresas finalizadas', singular: 'uma finalização', atividade: 'finalização' },
  ];
  const ENTREGAS_DA_FUNCAO = { [TEC]: ENTREGAS.filter(e => e.funcao === TEC), [ADM]: ENTREGAS.filter(e => e.funcao === ADM) };

  const COLAB_PADRAO = { empresasDia: 2, inspecoesDia: 2, relatoriosDia: 2 }; // referência quando não há ninguém na função
  const MARGEM_ATENCAO = 0.10; // sobra menor que 10% do que a equipe consegue = "no limite"

  const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  /* ---------- blocos elementares ---------- */

  function empresasDoMes(u, mes) {
    const exc = u.meses && u.meses[mes + 1];
    return exc
      ? { empresasVencidas: n(exc.empresasVencidas), empresasExclusivaTst: n(exc.empresasExclusivaTst), demanda: exc.demanda || null, excecao: true }
      : { empresasVencidas: n(u.empresasVencidas), empresasExclusivaTst: n(u.empresasExclusivaTst), demanda: u.demanda || null, excecao: false };
  }

  /** Quantos clientes vencem no mês, em contagem simples (todas as condições). */
  function clientesDoMes(u, mes) {
    const q = empresasDoMes(u, mes);
    const d = q.demanda;
    if (d && typeof d === 'object') {
      let total = 0;
      Object.values(d).forEach(porPorte => {
        if (porPorte && typeof porPorte === 'object') Object.values(porPorte).forEach(qtd => { total += Math.max(0, n(qtd)); });
      });
      return total;
    }
    return n(q.empresasVencidas) + n(q.empresasExclusivaTst);
  }

  /** Peso de um porte (P 1,0 · M 1,5 · G 2,0…); porte desconhecido ou sem tabela de pesos = 1. */
  function pesoPorte(p, porte) {
    const pesos = p && p.pesosPorte;
    const w = pesos && pesos[porte];
    return Number.isFinite(Number(w)) && Number(w) > 0 ? Number(w) : 1;
  }

  /**
   * Esforço que a carteira exige no mês, em "empresas equivalentes": Σ clientes que vencem × peso do porte.
   * Sem detalhe por porte, vale a contagem (Mensal + Exclusiva TST). Com `mes` (0..11) usa a quantidade daquele mês.
   */
  function empresasPonderadas(u, p, mes) {
    const q = mes === undefined ? u : empresasDoMes(u, mes);
    const d = q.demanda;
    if (d && typeof d === 'object') {
      let total = 0;
      Object.values(d).forEach(porPorte => {
        if (porPorte && typeof porPorte === 'object') Object.entries(porPorte).forEach(([porte, qtd]) => { total += Math.max(0, n(qtd)) * pesoPorte(p, porte); });
      });
      return total;
    }
    return n(q.empresasVencidas) + n(q.empresasExclusivaTst);
  }

  /* ---------- presença no mês e ramp-up ---------- */

  const parseData = s => {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();

  /**
   * Presença de um colaborador num mês (0..1): fração dos dias do mês entre a admissão e o desligamento.
   * Sem datas = 1. Meses antes da admissão ou depois do desligamento = 0.
   */
  function presencaNoMes(c, ano, mes) {
    const adm = parseData(c.dataAdmissao), desl = parseData(c.dataDesligamento);
    if (!adm && !desl) return 1;
    const inicio = new Date(ano, mes, 1), fim = new Date(ano, mes, diasNoMes(ano, mes));
    if (adm && adm > fim) return 0;
    if (desl && desl < inicio) return 0;
    const de = adm && adm > inicio ? adm : inicio;
    const ate = desl && desl < fim ? desl : fim;
    // proporção de DIAS ÚTEIS (segunda a sexta) do período, não de dias corridos:
    // quem entra dia 25 não produz a mesma fração de quem entra dia 20 com um fim de semana no meio
    const uteis = (d1, d2) => { let q = 0; const d = new Date(d1); while (d <= d2) { const s = d.getDay(); if (s !== 0 && s !== 6) q++; d.setDate(d.getDate() + 1); } return q; };
    const noPeriodo = uteis(de, ate), noMes = uteis(inicio, fim);
    if (noMes <= 0) return 0;
    return Math.max(0, Math.min(1, noPeriodo / noMes));
  }

  /**
   * Ramp-up (0..1) de quem foi contratado: no 1º mês de casa produz rampup[0]%, no 2º rampup[1]%…, depois 100%.
   * `mesesDeCasa` = 0 no mês da admissão. Sem admissão (veterano) = 1.
   */
  function fatorRampup(mesesDeCasa, rampup) {
    if (mesesDeCasa == null || mesesDeCasa < 0) return 1;
    const curva = Array.isArray(rampup) ? rampup : [];
    return mesesDeCasa < curva.length ? Math.max(0, Math.min(100, n(curva[mesesDeCasa]))) / 100 : 1;
  }
  const mesesDeCasa = (c, ano, mes) => {
    if (c.simulado) return c.quantidade > 0 && Number.isInteger(c.rampupDesde) ? mes - c.rampupDesde : null; // desligamento simulado não tem ramp-up
    const adm = parseData(c.dataAdmissao);
    return adm ? (ano - adm.getFullYear()) * 12 + (mes - adm.getMonth()) : null;
  };
  /** Produção efetiva no mês = presença × ramp-up (pessoas simuladas: presença 1 nos meses ativos). */
  const fatorProducao = (c, ano, mes, p) => (c.simulado ? 1 : presencaNoMes(c, ano, mes)) * fatorRampup(mesesDeCasa(c, ano, mes), p.rampup);

  /** Produção de um colaborador numa entrega num mês (100% do tempo). */
  function producaoMes(colab, entrega, mes, p) {
    return n(colab[entrega.campo]) * n(p.diasUteis[mes]);
  }

  /** Quantas entregas a carteira da unidade precisa no mês (uma por empresa ponderada). */
  function precisaMes(u, entrega, mes, p) {
    return empresasPonderadas(u, p, mes);
  }

  function status(sobra, consegue) {
    if (sobra < -1e-9) return 'deficit';
    if (consegue > 0 && sobra < consegue * MARGEM_ATENCAO) return 'atencao';
    return 'ok';
  }

  const PIOR = { deficit: 3, atencao: 2, ok: 1 };
  const piorStatus = lista => lista.reduce((acc, s) => (PIOR[s] > PIOR[acc] ? s : acc), 'ok');

  /* ---------- montagem ---------- */

  /**
   * Bloco de uma entrega num período.
   *   precisa, consegue (já com a folga aplicada), consegueMax, sobra, status,
   *   pessoas (FTE alocadas), producaoPessoa (uma pessoa inteira, com folga),
   *   faltam (nº inteiro de pessoas a contratar), sobram (nº inteiro de pessoas de folga),
   *   ideal (quadro ideal: pessoas inteiras para dar conta do que precisa no período)
   */
  function bloco(precisa, consegueMax, pessoas, producaoPessoaMax, p) {
    const alvo = n(p.ocupacaoAlvo) / 100;
    const consegue = consegueMax * alvo;
    const producaoPessoa = producaoPessoaMax * alvo;
    const sobra = consegue - precisa;
    const pessoasEquivalentes = producaoPessoa > 0 ? sobra / producaoPessoa : 0;
    return {
      precisa, consegue, consegueMax, sobra,
      status: status(sobra, consegue),
      pessoas,
      producaoPessoa,
      pessoasEquivalentes,
      faltam: sobra < -1e-9 ? Math.ceil(-pessoasEquivalentes - 1e-9) : 0,
      sobram: sobra > 1e-9 ? Math.floor(pessoasEquivalentes + 1e-9) : 0,
      ideal: producaoPessoa > 0 && precisa > 1e-9 ? Math.ceil(precisa / producaoPessoa - 1e-9) : 0,
    };
  }

  /** Resumo de uma função a partir das suas entregas: pior situação, maior falta, menor sobra. */
  function resumoFuncao(funcao, entregas) {
    const lista = ENTREGAS_DA_FUNCAO[funcao].map(e => entregas[e.id]);
    const st = piorStatus(lista.map(b => b.status));
    const faltam = Math.max(...lista.map(b => b.faltam));
    const sobram = Math.min(...lista.map(b => b.sobram));
    const ideal = Math.max(...lista.map(b => b.ideal)); // quadro ideal = o que a entrega mais exigente pede
    const limitante = lista.reduce((a, b) => (b.sobra < a.sobra ? b : a)); // entrega que limita
    const pessoas = lista[0].pessoas;
    return {
      funcao, status: st, faltam, sobram, ideal, pessoas,
      atendeEmpresas: Math.min(...lista.map(b => b.consegue)), // empresas que a função dá conta no período
      precisa: limitante.precisa,
      limitante: ENTREGAS_DA_FUNCAO[funcao].find(e => entregas[e.id] === limitante),
      sobraEmpresas: limitante.sobra,
      recomendacao: recomendacao(funcao, st, faltam, sobram, pessoas),
    };
  }

  /**
   * Impacto financeiro de uma função num mês/período: custo médio de uma pessoa, quanto custa contratar
   * quem falta e quanto custa a sobra (pessoas inteiras × custo). Sem custo cadastrado, tudo zero.
   */
  function custoFuncao(resumo, custoPessoa) {
    const c = Math.max(0, n(custoPessoa));
    return { pessoa: c, contratar: c * n(resumo.faltam), sobra: c * n(resumo.sobram) };
  }

  /** Frase de recomendação em linguagem simples. */
  function recomendacao(funcao, st, faltam, sobram, pessoas) {
    const rot = FUNCAO_CURTA[funcao].toLowerCase();
    const sing = FUNCAO_SINGULAR[funcao];
    const plural = q => (q === 1 ? sing : sing + 's');
    if (st === 'deficit') {
      const q = Math.max(1, faltam);
      return { tipo: 'contratar', quantidade: q, texto: pessoas > 0
        ? `Faltam aproximadamente ${q} ${plural(q)} para dar conta da demanda.`
        : `Não há ${rot} alocados aqui: seriam necessários aproximadamente ${q} ${plural(q)}.` };
    }
    if (st === 'atencao') return { tipo: 'limite', quantidade: 0, texto: `Os ${rot} dão conta, mas estão no limite.` };
    if (sobram >= 1) return { tipo: 'folga', quantidade: sobram, texto: `Os ${rot} dão conta com folga — sobra o equivalente a ${sobram} ${plural(sobram)}.` };
    return { tipo: 'adequado', quantidade: 0, texto: `Os ${rot} dão conta da demanda.` };
  }

  /**
   * Calcula tudo para a janela. Retorna:
   * {
   *   janela: { de, ate, meses: [idx...] },
   *   unidades: [{ id, nome, pessoas: {funcao: fte}, colaboradores: [{ id, nome, funcao, fracao }], chefia: [{ id, nome, funcao }],
   *                meses: [{ mes, nome, nomeLongo, diasUteis, empresas, precisa, excecao, entregas: {id: Bloco}, funcoes: {f: Resumo}, status }],
   *                janela: { nMeses, empresasMedia, precisa, precisaMedia, entregas, funcoes, status, mesesComExcecao } }],
   *   total: { pessoas, meses: [...], janela: {...}, chefia: [...] },
   *   avisos: { colabSemProducao: [], colabProducaoZerada: [], colabSemUnidade: [], colabParcial: [], unidadesSemColab: [], unidadesSemFuncao: [{unidade, funcao}] },
   *   parametros: p
   * }
   */
  function calcular({ unidades = [], colaboradores = [], parametros, janela, simulacoes = [], ano = new Date().getFullYear() }) {
    const p = normalizarParametros(parametros);
    const anoCalc = Number.isInteger(Number(ano)) ? Number(ano) : new Date().getFullYear();
    /** Custo médio mensal de uma pessoa (o do colaborador, senão o da função). */
    const custoDe = c => (n(c.custoMensal) > 0 ? n(c.custoMensal) : n(c.funcaoCustoMensal));
    const de = clampMes(janela && janela.de, 0);
    const ate = clampMes(janela && janela.ate, 11);
    const meses = [];
    for (let m = Math.min(de, ate); m <= Math.max(de, ate); m++) meses.push(m);

    const idsUnidades = new Set(unidades.map(u => u.id));
    const alocValidas = c => (c.alocacoes || []).filter(a => a && idsUnidades.has(a.unidadeId) && n(a.percentual) > 0);
    const fracaoEm = (c, unidadeId) => alocValidas(c).filter(a => a.unidadeId === unidadeId).reduce((s, a) => s + n(a.percentual), 0) / 100;
    // simulações viram pessoas virtuais (quantidade inteira, podendo ser negativa) ativas só em alguns meses
    const simulados = colaboradoresSimulados(simulacoes).filter(c => idsUnidades.has(c.unidadeId));
    const ativoNoMes = (c, mes) => (c.mesesAtivos ? c.mesesAtivos.includes(mes) : presencaNoMes(c, anoCalc, mes) > 0);
    // quem não produz fica fora das contas; se for chefia, aparece como responsável pelas unidades
    const chefes = colaboradores.filter(c => c.chefia)
      .map(c => ({ id: c.id, nome: c.nome, funcao: c.funcao || '', coordena: c.coordena || 'todos', ordem: n(c.funcaoOrdem) || 9999, unidades: alocValidas(c).map(a => a.unidadeId) }))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')); // chefia mais alta primeiro (ordem do cadastro de funções)
    const colabSemProducao = colaboradores.filter(c => !FUNCOES.includes(c.tipoProducao) && !c.chefia).map(c => `${c.nome}${c.funcao ? ' (' + c.funcao + ')' : ''}`);
    // conta na equipe, mas com produção diária zerada: o cadastro está incompleto e o cálculo sente
    const colabProducaoZerada = colaboradores
      .filter(c => FUNCOES.includes(c.tipoProducao) && alocValidas(c).length > 0
        && ENTREGAS_DA_FUNCAO[c.tipoProducao].every(e => n(c[e.campo]) <= 0))
      .map(c => `${c.nome}${c.funcao ? ' (' + c.funcao + ')' : ''}`);
    const produtivos = colaboradores.filter(c => FUNCOES.includes(c.tipoProducao));
    const produtivosESimulados = produtivos.concat(simulados);
    const colabSemUnidade = colaboradores.filter(c => (FUNCOES.includes(c.tipoProducao) || c.chefia) && alocValidas(c).length === 0).map(c => c.nome);
    const colabParcial = produtivos
      .map(c => ({ nome: c.nome, pct: alocValidas(c).reduce((s, a) => s + n(a.percentual), 0) }))
      .filter(x => x.pct > 0 && x.pct < 99.999)
      .map(x => `${x.nome} (${Math.round(x.pct)}%)`);

    // referência de "uma pessoa inteira" por grupo: os da unidade; senão, os da equipe; senão, o padrão
    const globalPorFuncao = {};
    FUNCOES.forEach(f => { const l = produtivos.filter(c => c.tipoProducao === f); globalPorFuncao[f] = l.length ? l : [COLAB_PADRAO]; });
    // custo médio de uma pessoa por grupo, na equipe toda (referência quando a unidade não tem ninguém do grupo)
    const custoGlobal = {};
    FUNCOES.forEach(f => { const l = produtivos.filter(c => c.tipoProducao === f && custoDe(c) > 0); custoGlobal[f] = l.length ? l.reduce((s, c) => s + custoDe(c), 0) / l.length : 0; });
    const custoMedio = (lista, f) => {
      const comCusto = lista.filter(c => c.fracao > 0 && custoDe(c) > 0);
      const peso = comCusto.reduce((s, c) => s + c.fracao, 0);
      return peso > 0 ? comCusto.reduce((s, c) => s + custoDe(c) * c.fracao, 0) / peso : custoGlobal[f];
    };

    const calcUnidade = u => {
      const colabs = produtivosESimulados
        .map(c => ({ ...c, fracao: c.simulado ? (c.unidadeId === u.id ? c.quantidade : 0) : fracaoEm(c, u.id) }))
        .filter(c => c.fracao !== 0);
      const porFuncao = {};
      FUNCOES.forEach(f => { porFuncao[f] = colabs.filter(c => c.tipoProducao === f); });
      const pessoas = {}, pessoasSimuladas = {};
      FUNCOES.forEach(f => {
        pessoas[f] = porFuncao[f].filter(c => !c.simulado).reduce((s, c) => s + c.fracao, 0);          // pessoas reais
        pessoasSimuladas[f] = porFuncao[f].filter(c => c.simulado).reduce((s, c) => s + c.fracao, 0);  // saldo simulado (pode ser negativo)
      });

      const mesesCalc = meses.map(mes => {
        const q = empresasDoMes(u, mes);
        const precisa = empresasPonderadas(u, p, mes);
        const entregas = {};
        const pessoasMes = {}, cabecasMes = {}, emRampup = {};
        FUNCOES.forEach(f => {
          const cf = porFuncao[f].filter(c => ativoNoMes(c, mes));
          // pessoas = presença no mês (quem entra dia 15 conta meio); ramp-up só reduz a produção
          pessoasMes[f] = Math.max(0, cf.reduce((s, c) => s + c.fracao * (c.simulado ? 1 : presencaNoMes(c, anoCalc, mes)), 0));
          // cabeças = gente de verdade no mês: 1 por pessoa, mesmo em tempo parcial ou entrando no dia 16.
          // É o número que a diretoria confere na lista de colaboradores; `pessoasMes` é o equivalente
          // em tempo integral, que é o que a capacidade usa.
          cabecasMes[f] = Math.max(0, cf.reduce((s, c) => s + (c.simulado ? c.fracao : (c.fracao > 0 ? 1 : 0)), 0));
          emRampup[f] = cf.filter(c => c.fracao > 0 && fatorRampup(mesesDeCasa(c, anoCalc, mes), p.rampup) < 1).reduce((s, c) => s + Math.abs(c.fracao), 0);
        });
        ENTREGAS.forEach(e => {
          const cf = porFuncao[e.funcao].filter(c => ativoNoMes(c, mes));
          // desligamento simulado além do que existe não fica negativo: a equipe vai a zero
          const consegueMax = Math.max(0, cf.reduce((s, c) => s + producaoMes(c, e, mes, p) * c.fracao * fatorProducao(c, anoCalc, mes, p), 0));
          // "uma pessoa inteira" é a referência do quadro necessário: quem está alocado na unidade
          // COM produção declarada. Alguém cadastrado com 0/dia (produção ainda não informada) não
          // pode puxar a régua para baixo — isso faria o sistema pedir mais gente do que precisa.
          const presentes = cf.filter(c => c.fracao > 0);
          const comProducao = presentes.filter(c => n(c[e.campo]) > 0);
          const globalComProducao = globalPorFuncao[e.funcao].filter(c => n(c[e.campo]) > 0);
          const ref = comProducao.length ? comProducao
            : globalComProducao.length ? globalComProducao      // ninguém aqui produz: média da equipe
              : [COLAB_PADRAO];                                  // nem na equipe: produção de referência do sistema
          const producaoPessoaMax = ref.reduce((s, c) => s + producaoMes(c, e, mes, p), 0) / ref.length;
          entregas[e.id] = bloco(precisaMes(u, e, mes, p), consegueMax, pessoasMes[e.funcao], producaoPessoaMax, p);
          entregas[e.id].referenciaLocal = comProducao.length > 0;     // a régua veio da própria unidade?
          entregas[e.id].pessoasSemProducao = presentes.length - comProducao.length;
        });
        const funcoes = {};
        FUNCOES.forEach(f => {
          funcoes[f] = resumoFuncao(f, entregas);
          funcoes[f].emRampup = emRampup[f];
          funcoes[f].custo = custoFuncao(funcoes[f], custoMedio(porFuncao[f].filter(c => ativoNoMes(c, mes)), f));
        });
        return {
          mes, nome: MESES[mes], nomeLongo: MESES_LONGO[mes], diasUteis: n(p.diasUteis[mes]),
          empresas: clientesDoMes(u, mes), precisa, excecao: q.excecao,
          pessoas: pessoasMes, cabecas: cabecasMes,
          entregas, funcoes, status: piorStatus(FUNCOES.map(f => funcoes[f].status)),
        };
      });

      return {
        id: u.id, nome: u.nome, pessoas, pessoasSimuladas,
        colaboradores: colabs.filter(c => !c.simulado).map(c => ({ id: c.id, nome: c.nome, funcao: c.funcao, tipoProducao: c.tipoProducao, fracao: c.fracao })),
        chefia: chefes.filter(ch => ch.unidades.includes(u.id)).map(ch => ({ id: ch.id, nome: ch.nome, funcao: ch.funcao, coordena: ch.coordena })),
        meses: mesesCalc,
        janela: consolidar(mesesCalc, p),
      };
    };

    const resultadoUnidades = unidades.map(calcUnidade);

    // total = soma das unidades, mês a mês
    const alvo = n(p.ocupacaoAlvo) / 100 || 1;
    const totalMeses = meses.map((mes, i) => {
      const linhas = resultadoUnidades.map(u => u.meses[i]);
      const entregas = {};
      ENTREGAS.forEach(e => {
        const blocos = linhas.map(l => l.entregas[e.id]);
        const pessoas = blocos.reduce((s, b) => s + b.pessoas, 0);
        const consegueMax = blocos.reduce((s, b) => s + b.consegueMax, 0);
        const precisa = blocos.reduce((s, b) => s + b.precisa, 0);
        // produção de uma pessoa inteira: média ponderada pelas pessoas; sem gente, média das referências
        const prodMax = pessoas > 0
          ? blocos.reduce((s, b) => s + (b.producaoPessoa / alvo) * b.pessoas, 0) / pessoas
          : (blocos.length ? blocos.reduce((s, b) => s + b.producaoPessoa / alvo, 0) / blocos.length : 0);
        entregas[e.id] = bloco(precisa, consegueMax, pessoas, prodMax, p);
        entregas[e.id].referenciaLocal = blocos.every(b2 => b2.referenciaLocal !== false);
        entregas[e.id].pessoasSemProducao = blocos.reduce((s2, b2) => s2 + n(b2.pessoasSemProducao), 0);
      });
      const funcoes = {};
      FUNCOES.forEach(f => { funcoes[f] = resumoFuncao(f, entregas); });
      const pessoasMes = {}, cabecasMes = {};
      FUNCOES.forEach(f => { pessoasMes[f] = linhas.reduce((s, l) => s + l.pessoas[f], 0); });
      // cabeças do total: contadas na equipe inteira, não somando as unidades — quem está
      // alocado em Teresópolis e em Petrópolis é uma pessoa, não duas.
      FUNCOES.forEach(f => {
        const reais = produtivos.filter(c => c.tipoProducao === f && alocValidas(c).length > 0 && ativoNoMes(c, mes)).length;
        const sim = simulados.filter(c => c.tipoProducao === f && ativoNoMes(c, mes)).reduce((s, c) => s + n(c.quantidade), 0);
        cabecasMes[f] = Math.max(0, reais + sim);
      });
      return {
        mes, nome: MESES[mes], nomeLongo: MESES_LONGO[mes], diasUteis: n(p.diasUteis[mes]),
        empresas: linhas.reduce((s, l) => s + l.empresas, 0), precisa: linhas.reduce((s, l) => s + l.precisa, 0), excecao: linhas.some(l => l.excecao),
        pessoas: pessoasMes, cabecas: cabecasMes,
        entregas, funcoes, status: piorStatus(FUNCOES.map(f => funcoes[f].status)),
      };
    });
    const pessoasTotal = {}, pessoasSimuladasTotal = {};
    FUNCOES.forEach(f => {
      pessoasTotal[f] = resultadoUnidades.reduce((s, u) => s + u.pessoas[f], 0);
      pessoasSimuladasTotal[f] = resultadoUnidades.reduce((s, u) => s + u.pessoasSimuladas[f], 0);
    });

    // No total, faltas e sobras são a SOMA das unidades (folga numa unidade não cobre falta em outra)
    // e a situação é a pior entre as unidades.
    const somarUnidades = (alvoTotal, pegar) => {
      FUNCOES.forEach(f => {
        const partes = resultadoUnidades.map(u => pegar(u).funcoes[f]);
        if (!partes.length) return;
        const r = alvoTotal.funcoes[f];
        r.faltam = partes.reduce((s, x) => s + x.faltam, 0);
        r.sobram = partes.reduce((s, x) => s + x.sobram, 0);
        r.ideal = partes.reduce((s, x) => s + x.ideal, 0); // quadro ideal do total = soma das unidades
        r.emRampup = partes.reduce((s, x) => s + n(x.emRampup), 0);
        const comCusto = partes.filter(x => x.custo && x.custo.pessoa > 0);
        r.custo = {
          pessoa: comCusto.length ? comCusto.reduce((s, x) => s + x.custo.pessoa, 0) / comCusto.length : 0,
          contratar: partes.reduce((s, x) => s + (x.custo ? x.custo.contratar : 0), 0),
          sobra: partes.reduce((s, x) => s + (x.custo ? x.custo.sobra : 0), 0),
        };
        r.status = piorStatus(partes.map(x => x.status));
        r.recomendacao = recomendacao(f, r.status, r.faltam, r.sobram, r.pessoas);
      });
      alvoTotal.status = piorStatus(FUNCOES.map(f => alvoTotal.funcoes[f].status));
    };
    totalMeses.forEach((m, i) => somarUnidades(m, u => u.meses[i]));
    const totalJanela = consolidar(totalMeses, p);
    somarUnidades(totalJanela, u => u.janela);

    return {
      janela: { de: Math.min(de, ate), ate: Math.max(de, ate), meses },
      unidades: resultadoUnidades,
      total: { pessoas: pessoasTotal, pessoasSimuladas: pessoasSimuladasTotal, meses: totalMeses, janela: totalJanela, chefia: chefes.map(ch => ({ id: ch.id, nome: ch.nome, funcao: ch.funcao, coordena: ch.coordena })) },
      simulacao: simulados.length > 0,
      avisos: {
        colabSemProducao,
        colabProducaoZerada,
        colabSemUnidade,
        colabParcial,
        unidadesSemColab: resultadoUnidades.filter(u => u.colaboradores.length === 0 && u.janela.precisa > 0).map(u => u.nome),
        unidadesSemFuncao: resultadoUnidades.flatMap(u => FUNCOES.filter(f => u.pessoas[f] === 0 && u.janela.precisa > 0 && u.colaboradores.length > 0).map(f => ({ unidade: u.nome, funcao: f }))),
      },
      parametros: p,
    };
  }

  /**
   * Transforma simulações em pessoas virtuais: quantidade inteira (positiva = a mais,
   * negativa = a menos) numa unidade e num grupo, ativas só entre `de` e `ate`.
   * Ritmo por dia: o informado ou o padrão.
   */
  function colaboradoresSimulados(simulacoes) {
    return (simulacoes || [])
      .filter(s => s && FUNCOES.includes(s.grupo) && s.unidadeId && Math.round(n(s.quantidade)) !== 0)
      .map((s, i) => {
        const de = clampMes(s.de, 0), ate = clampMes(s.ate, 11);
        const mesesAtivos = [];
        for (let m = Math.min(de, ate); m <= Math.max(de, ate); m++) mesesAtivos.push(m);
        return {
          id: `sim-${i}`, nome: `Simulação ${i + 1}`, simulado: true, chefia: false,
          tipoProducao: s.grupo, unidadeId: s.unidadeId, quantidade: Math.round(n(s.quantidade)), mesesAtivos,
          rampupDesde: Math.min(de, ate), // contratação simulada entra em ramp-up como uma contratação real
          custoMensal: Math.max(0, n(s.custoMensal)),
          inspecoesDia: s.inspecoesDia == null ? COLAB_PADRAO.inspecoesDia : Math.max(0, n(s.inspecoesDia)),
          relatoriosDia: s.relatoriosDia == null ? COLAB_PADRAO.relatoriosDia : Math.max(0, n(s.relatoriosDia)),
          empresasDia: s.empresasDia == null ? COLAB_PADRAO.empresasDia : Math.max(0, n(s.empresasDia)),
          alocacoes: [],
        };
      });
  }

  /** Consolida uma lista de meses (de uma unidade ou do total) na janela. */
  function consolidar(mesesCalc, p) {
    const nMeses = Math.max(1, mesesCalc.length);
    const alvo = n(p.ocupacaoAlvo) / 100 || 1;
    const entregas = {};
    ENTREGAS.forEach(e => {
      const blocos = mesesCalc.map(m => m.entregas[e.id]);
      const precisa = blocos.reduce((s, b) => s + b.precisa, 0);
      const consegueMax = blocos.reduce((s, b) => s + b.consegueMax, 0);
      const producaoPessoaMax = blocos.reduce((s, b) => s + b.producaoPessoa / alvo, 0);
      const pessoas = blocos.length ? blocos.reduce((s, b) => s + b.pessoas, 0) / blocos.length : 0; // média (a simulação pode mudar por mês)
      const b = bloco(precisa, consegueMax, pessoas, producaoPessoaMax, p);
      entregas[e.id] = { ...b, porMes: { precisa: precisa / nMeses, consegue: b.consegue / nMeses } };
    });
    const funcoes = {};
    FUNCOES.forEach(f => {
      funcoes[f] = resumoFuncao(f, entregas);
      const custos = mesesCalc.map(m => m.funcoes[f].custo || { pessoa: 0, contratar: 0, sobra: 0 });
      // no período: contratar = custo de cobrir a falta de cada mês, somado; sobra idem (o que se paga sem produção)
      funcoes[f].custo = {
        pessoa: custos.length ? custos.reduce((s, c) => s + c.pessoa, 0) / custos.length : 0,
        contratar: custos.reduce((s, c) => s + c.contratar, 0),
        sobra: custos.reduce((s, c) => s + c.sobra, 0),
      };
    });
    return {
      nMeses,
      empresasMedia: mesesCalc.reduce((s, m) => s + m.empresas, 0) / nMeses,
      precisa: mesesCalc.reduce((s, m) => s + m.precisa, 0),
      precisaMedia: mesesCalc.reduce((s, m) => s + m.precisa, 0) / nMeses,
      mesesComExcecao: mesesCalc.filter(m => m.excecao).length,
      entregas, funcoes,
      status: piorStatus(FUNCOES.map(f => funcoes[f].status)),
    };
  }

  function normalizarParametros(p) {
    const base = p || {};
    const dias = Array.isArray(base.diasUteis) && base.diasUteis.length === 12 ? base.diasUteis.map(n) : new Array(12).fill(21);
    const rampup = Array.isArray(base.rampup) ? base.rampup.map(v => Math.max(0, Math.min(100, n(v)))) : [50, 80];
    const pesosPorte = {};
    Object.entries(base.pesosPorte || {}).forEach(([k, v]) => { if (n(v) > 0) pesosPorte[k] = n(v); });
    return {
      diasUteis: dias,
      ocupacaoAlvo: Number.isFinite(Number(base.ocupacaoAlvo)) ? Math.max(0, Math.min(100, n(base.ocupacaoAlvo))) : 85,
      rampup,
      pesosPorte,
    };
  }

  function clampMes(v, fallback) {
    const m = Number(v);
    return Number.isInteger(m) && m >= 0 && m <= 11 ? m : fallback;
  }

  /** Texto do ritmo diário de um colaborador ("2 inspeções · 2 relatórios por dia"; "sem produção" para quem não produz). */
  function ritmoTexto(c) {
    const f = v => (Number.isInteger(n(v)) ? String(n(v)) : n(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
    const tipo = c.tipoProducao;
    if (!FUNCOES.includes(tipo)) return 'sem produção';
    return ENTREGAS_DA_FUNCAO[tipo].map(e => `${f(c[e.campo])} ${e.unidade}`).join(' · ') + ' por dia';
  }

  /* ---------- fluxo: o núcleo único do dimensionamento ----------

     Toda a matemática de fila, quadro necessário, custo e cenário vive aqui. `fila()` e
     `evolucao()` são adaptadores deste núcleo — não existem duas contas para a mesma pergunta.

     UEP (Unidade Equivalente de Produção): tudo — demanda, capacidade, atendimento e fila —
     é medido na mesma unidade: clientes × peso do porte (P 1,0 · M 1,5 · G 2,0, parametrizável).

     CADEIA. As três etapas acontecem em série e cada uma só recebe o que a anterior concluiu:

         demanda do mês → [inspeção] → [relatório] → [finalização] → concluído

     Cada etapa tem a sua fila. O backlog da unidade é a soma das filas das três etapas — cada
     UEP está em exatamente uma delas. A etapa com a maior fila é o gargalo; capacidade não
     usada em uma etapa a jusante é ociosidade, não folga.

     COORTES. Cada parcela da fila guarda o mês em que venceu, e o consumo é FIFO (o mais antigo
     primeiro). Daí saem as faixas de idade (0–30, 31–60, 61–90, 91–120, +120 dias), em
     aproximação de 30 dias por mês.

     ATENDIMENTO. `atendidas[unidadeId][mes]` traz o que foi concluído, por porte
     ({ P: 10, M: 2 }) ou como número único (convertido pelo peso médio do mês, com aviso).
     Meses passados sem informação acumulam tudo (nada é descontado); do mês atual em diante,
     cada etapa conclui o que a sua capacidade permite.

     QUADRO (QLP), em três leituras por área:
       operacional  = pessoas para dar conta do que entra no mês (a fila não cresce)
       recuperação  = pessoas para dar conta da entrada e ainda diluir a fila no prazo
       estrutural   = pessoas para a demanda média do ano, depois de normalizada a fila
     ---------------------------------------------------- */

  const FAIXAS_IDADE = [
    { id: 'ate30', rotulo: 'Até 30 dias', minMeses: 0, maxMeses: 0 },
    { id: 'ate60', rotulo: '31 a 60 dias', minMeses: 1, maxMeses: 1 },
    { id: 'ate90', rotulo: '61 a 90 dias', minMeses: 2, maxMeses: 2 },
    { id: 'ate120', rotulo: '91 a 120 dias', minMeses: 3, maxMeses: 3 },
    { id: 'mais120', rotulo: 'Mais de 120 dias', minMeses: 4, maxMeses: Infinity },
  ];

  /** Coortes: lista de { ano, mes, uep }, consumida do mais antigo para o mais novo. */
  const somaCoortes = lista => lista.reduce((s, c) => s + c.uep, 0);
  function consumirCoortes(lista, quantidade) {
    let resta = Math.max(0, quantidade);
    const saida = [], fica = [];
    lista.forEach(c => {
      if (resta <= 1e-9) { fica.push(c); return; }
      const usa = Math.min(c.uep, resta);
      resta -= usa;
      if (usa > 1e-9) saida.push({ ano: c.ano, mes: c.mes, uep: usa });
      if (c.uep - usa > 1e-9) fica.push({ ano: c.ano, mes: c.mes, uep: c.uep - usa });
    });
    return { saida, fica };
  }
  const juntarCoortes = lista => {
    const mapa = new Map();
    lista.forEach(c => {
      if (c.uep <= 1e-9) return;
      const k = `${c.ano}-${c.mes}`;
      mapa.set(k, (mapa.get(k) || 0) + c.uep);
    });
    return [...mapa.entries()]
      .map(([k, uep]) => ({ ano: Number(k.split('-')[0]), mes: Number(k.split('-')[1]), uep }))
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  };
  /** Idade das coortes em relação a um mês de referência, nas faixas de 30 dias. */
  function idadeDasCoortes(lista, anoRef, mesRef, limiteMeses) {
    const faixas = {};
    FAIXAS_IDADE.forEach(f => { faixas[f.id] = 0; });
    const limite = Math.max(1, Math.round(n(limiteMeses)) || 1);
    let foraDoPrazo = 0, total = 0, maisAntiga = null;
    lista.forEach(c => {
      const meses = Math.max(0, (anoRef - c.ano) * 12 + (mesRef - c.mes));
      const faixa = FAIXAS_IDADE.find(f => meses >= f.minMeses && meses <= f.maxMeses) || FAIXAS_IDADE[FAIXAS_IDADE.length - 1];
      faixas[faixa.id] += c.uep;
      total += c.uep;
      // fora do prazo: vencido há mais tempo que o prazo de atendimento configurado
      if (meses >= limite) foraDoPrazo += c.uep;
      if (maisAntiga == null || meses > maisAntiga) maisAntiga = meses;
    });
    return { faixas, total, maisAntigaMeses: maisAntiga, foraDoPrazo, limiteMeses: limite };
  }

  /** Atendimento informado de um mês, em UEP: por porte (exato) ou número único (peso médio). */
  function atendidasEmUep(valor, p, pesoMedio) {
    if (valor == null || valor === '') return null;
    if (typeof valor === 'object') {
      let uep = 0, clientes = 0, exato = true;
      Object.entries(valor).forEach(([porte, qtd]) => {
        const q = Math.max(0, n(qtd));
        clientes += q;
        uep += q * pesoPorte(p, porte);
      });
      return { uep, clientes, exato };
    }
    const q = Math.max(0, n(valor));
    return { uep: q * (pesoMedio > 0 ? pesoMedio : 1), clientes: q, exato: false };
  }

  /**
   * Núcleo: cadeia de etapas, filas por coorte, quadro necessário e custo, mês a mês.
   * Entrada: o resultado de calcular() (capacidades já com margem) + as opções.
   * Não conhece tela, banco nem Vue.
   */
  function fluxo(resultado, { mesAtual = 0, prazoMeses = 2, filaInicial = null, atendidas = null, parametros = null, ano = new Date().getFullYear() } = {}) {
    const p = normalizarParametros(parametros);
    const t = Number(mesAtual) === 12 ? 12 : clampMes(mesAtual, 0);
    const pm = Math.max(1, Math.round(n(prazoMeses)) || 1);
    const anoRef = Number(ano) || new Date().getFullYear();

    /** Fila inicial de uma etapa: formato novo (coortes por etapa) ou o antigo (número por função). */
    function inicialDaEtapa(unidadeId, etapa) {
      const doItem = filaInicial && filaInicial[unidadeId];
      if (!doItem) return [];
      const porEtapa = doItem[etapa.id];
      if (Array.isArray(porEtapa)) return juntarCoortes(porEtapa.map(c => ({ ano: n(c.ano) || anoRef - 1, mes: clampMes(c.mes, 11), uep: Math.max(0, n(c.uep)) })));
      // compatibilidade: { tecnico, administrativo } → tudo na primeira etapa da função, vindo de dezembro anterior
      const valor = n(doItem[etapa.funcao]);
      const primeira = ENTREGAS_DA_FUNCAO[etapa.funcao][0];
      return valor > 0 && etapa.id === primeira.id ? [{ ano: anoRef - 1, mes: 11, uep: valor }] : [];
    }

    const pessoasInteiras = (quanto, producaoPessoa) => (quanto > 1e-9 && producaoPessoa > 0 ? Math.ceil(quanto / producaoPessoa - 1e-9) : 0);

    function fluxoDaUnidade(item, informadasDoMes, iniciais) {
      // estado das filas por etapa (coortes)
      const fila = {};
      ENTREGAS.forEach(e => { fila[e.id] = (iniciais && iniciais[e.id] ? iniciais[e.id] : []).slice(); });
      const filaCenario = {};
      ENTREGAS.forEach(e => { filaCenario[e.id] = fila[e.id].slice(); });
      const admissoes = { [TEC]: [], [ADM]: [] }; // [{ mes, quantidade }] acumulativas

      const meses = item.meses.map((m, i) => {
        const demanda = Math.max(0, n(m.precisa));
        const clientes = Math.max(0, n(m.empresas));
        const pesoMedio = clientes > 0 ? demanda / clientes : 1;
        const informado = atendidasEmUep(informadasDoMes(m.mes), p, pesoMedio);
        const passado = i < t;

        /* ---- cadeia: cada etapa recebe o que a anterior concluiu ---- */
        const etapas = {};
        let entrada = [{ ano: anoRef, mes: i, uep: demanda }]; // a primeira etapa recebe o que vence no mês
        let filaAcumulada = 0; // fila das etapas anteriores: ainda vai passar por esta
        ENTREGAS.forEach((e, idx) => {
          const capacidade = Math.max(0, n(m.entregas[e.id].consegue));
          const producaoPessoa = Math.max(0, n(m.entregas[e.id].producaoPessoa));
          const filaInicio = fila[e.id];
          const uepInicio = somaCoortes(filaInicio);
          filaAcumulada += uepInicio; // o que está parado aqui e nas etapas anteriores passa por esta etapa
          const uepEntrada = somaCoortes(entrada);
          const disponivel = juntarCoortes(filaInicio.concat(entrada));
          const uepDisponivel = somaCoortes(disponivel);
          const ultima = idx === ENTREGAS.length - 1;
          // quanto a etapa conclui: informado (última etapa) > capacidade (mês atual em diante) > nada (passado sem informação)
          let concluir;
          if (ultima && informado) concluir = Math.min(uepDisponivel, informado.uep);
          else if (passado && !informado) concluir = 0;
          else if (passado && informado && !ultima) concluir = Math.min(uepDisponivel, Math.max(informado.uep, 0)); // etapas anteriores entregaram ao menos o que foi concluído
          else concluir = Math.min(uepDisponivel, capacidade);
          const { saida, fica } = consumirCoortes(disponivel, concluir);
          fila[e.id] = fica;
          const uepConcluido = somaCoortes(saida);
          const idade = idadeDasCoortes(fica, anoRef, i, pm);
          etapas[e.id] = {
            id: e.id, rotulo: e.rotulo, funcao: e.funcao, ordem: idx,
            entrada: uepEntrada, filaInicio: uepInicio, filaAcumulada, disponivel: uepDisponivel,
            capacidade, capacidadeNominal: Math.max(0, n(m.entregas[e.id].consegueMax)),
            concluido: uepConcluido, filaFim: somaCoortes(fica),
            ocioso: Math.max(0, capacidade - uepDisponivel),
            saturada: uepDisponivel > capacidade + 1e-9,
            atividade: e.atividade,
            producaoPessoa, quadro: n(m.pessoas[e.funcao]),
            coortes: fica, idade,
            // dimensionamento: cada etapa precisa dar conta da DEMANDA do mês (toda empresa passa por
            // todas as etapas). Usar a entrada estrangulada pela etapa anterior esconderia a necessidade.
            qlpOperacional: pessoasInteiras(demanda, producaoPessoa),
            qlpRecuperacao: pessoasInteiras(demanda + filaAcumulada / pm, producaoPessoa),
            faltamOperacional: pessoasInteiras(Math.max(0, demanda - capacidade), producaoPessoa),
            faltamRecuperacao: pessoasInteiras(Math.max(0, demanda + filaAcumulada / pm - capacidade), producaoPessoa),
            sobram: capacidade > 0 && capacidade - demanda > 1e-9 && producaoPessoa > 0 ? Math.floor((capacidade - demanda) / producaoPessoa + 1e-9) : 0,
          };
          // sem produção possível (mês sem dias úteis ou ninguém com produção declarada) o quadro
          // não pode ser calculado: o sistema diz isso em vez de devolver "ninguém é necessário"
          etapas[e.id].impossivel = demanda > 1e-9 && producaoPessoa <= 0;
          etapas[e.id].semEquipe = etapas[e.id].quadro <= 1e-9;
          etapas[e.id].status = etapas[e.id].impossivel || etapas[e.id].faltamOperacional > 0 ? 'deficit'
            : uepInicio > 1e-9 || (capacidade > 0 && capacidade - demanda < capacidade * MARGEM_ATENCAO) ? 'atencao' : 'ok';
          entrada = saida; // o que esta etapa concluiu alimenta a próxima
        });

        /* ---- cenário: as mesmas etapas com as admissões sugeridas (acumulativas, com adaptação) ---- */
        const cenario = {};
        let entradaCenario = [{ ano: anoRef, mes: i, uep: demanda }];
        let filaAcumuladaCenario = 0;
        const extraDaFuncao = (f, e) => admissoes[f].reduce((s, a) => s + a.quantidade * Math.max(0, n(m.entregas[e.id].producaoPessoa)) * fatorRampup(i - a.mes, p.rampup), 0);
        const novasPorFuncao = { [TEC]: 0, [ADM]: 0 };
        ENTREGAS.forEach((e, idx) => {
          const capacidade = Math.max(0, n(m.entregas[e.id].consegue)) + extraDaFuncao(e.funcao, e);
          const producaoPessoa = Math.max(0, n(m.entregas[e.id].producaoPessoa));
          const uepInicio = somaCoortes(filaCenario[e.id]);
          const uepEntrada = somaCoortes(entradaCenario);
          filaAcumuladaCenario += uepInicio;
          const falta = Math.max(0, demanda + filaAcumuladaCenario / pm - capacidade);
          const novas = pessoasInteiras(falta, producaoPessoa);
          novasPorFuncao[e.funcao] = Math.max(novasPorFuncao[e.funcao], novas); // uma pessoa atende as duas etapas da sua função
          cenario[e.id] = { entrada: uepEntrada, filaInicio: uepInicio, capacidade, idx };
          entradaCenario = [{ ano: anoRef, mes: i, uep: Math.min(uepEntrada + uepInicio, capacidade) }]; // estimativa para dimensionar a etapa seguinte
        });
        FUNCOES.forEach(f => { if (novasPorFuncao[f] > 0) admissoes[f].push({ mes: i, quantidade: novasPorFuncao[f] }); });
        // com as admissões decididas, roda a cadeia do cenário de verdade
        entradaCenario = [{ ano: anoRef, mes: i, uep: demanda }];
        ENTREGAS.forEach(e => {
          const capacidade = Math.max(0, n(m.entregas[e.id].consegue)) + extraDaFuncao(e.funcao, e);
          const disponivel = juntarCoortes(filaCenario[e.id].concat(entradaCenario));
          const { saida, fica } = consumirCoortes(disponivel, Math.min(somaCoortes(disponivel), capacidade));
          filaCenario[e.id] = fica;
          cenario[e.id] = { ...cenario[e.id], capacidade, concluido: somaCoortes(saida), filaFim: somaCoortes(fica) };
          entradaCenario = saida;
        });

        /* ---- leitura por área (uma pessoa cobre as etapas da sua função) ---- */
        const areas = {};
        FUNCOES.forEach(f => {
          const daFuncao = ENTREGAS_DA_FUNCAO[f].map(e => etapas[e.id]);
          const custoPessoa = m.funcoes[f].custo ? n(m.funcoes[f].custo.pessoa) : 0;
          const gargalo = daFuncao.reduce((a, b) => (b.filaFim > a.filaFim ? b : (b.filaFim === a.filaFim && b.capacidade < a.capacidade ? b : a)));
          areas[f] = {
            funcao: f, rotulo: FUNCAO_CURTA[f],
            quadro: n(m.pessoas[f]),                       // equivalente em tempo integral
            cabecas: n(m.cabecas && m.cabecas[f]),         // gente de verdade no mês
            capacidade: Math.min(...daFuncao.map(e => e.capacidade)),
            demanda,
            entrada: Math.max(...daFuncao.map(e => e.entrada)),
            concluido: daFuncao[daFuncao.length - 1].concluido,
            filaInicio: daFuncao.reduce((s, e) => s + e.filaInicio, 0),
            filaFim: daFuncao.reduce((s, e) => s + e.filaFim, 0),
            qlpOperacional: Math.max(...daFuncao.map(e => e.qlpOperacional)),
            qlpRecuperacao: Math.max(...daFuncao.map(e => e.qlpRecuperacao)),
            faltamOperacional: Math.max(...daFuncao.map(e => e.faltamOperacional)),
            faltamRecuperacao: Math.max(...daFuncao.map(e => e.faltamRecuperacao)),
            sobram: Math.min(...daFuncao.map(e => e.sobram)),
            producaoPessoa: Math.min(...daFuncao.map(e => e.producaoPessoa)),
            // a área é uma equipe só: se a inspeção está saturada e o relatório parado por falta de
            // trabalho, o técnico não está ocioso — ele está inspecionando. Por isso ociosa = a menor.
            ocioso: Math.min(...daFuncao.map(e => e.ocioso)),
            saturada: daFuncao.some(e => e.saturada),
            atividades: daFuncao.map(e => e.rotulo),
            etapaSaturada: (daFuncao.find(e => e.saturada) || gargalo).atividade,
            gargaloRotulo: gargalo.atividade,
            custoPessoa,
            admissoesCenario: novasPorFuncao[f],
            quadroCenario: n(m.pessoas[f]) + admissoes[f].reduce((s, a) => s + a.quantidade, 0),
            gargaloEtapa: gargalo.id,
            status: piorStatus(daFuncao.map(e => e.status)),
            etapas: daFuncao.map(e => e.id),
          };
          areas[f].custoDeficitOperacional = areas[f].faltamOperacional * custoPessoa;
          areas[f].custoDeficitRecuperacao = areas[f].faltamRecuperacao * custoPessoa;
          areas[f].custoAtual = areas[f].quadro * custoPessoa;
        });

        const backlog = ENTREGAS.reduce((s, e) => s + etapas[e.id].filaFim, 0);
        const coortesTotais = juntarCoortes(ENTREGAS.flatMap(e => etapas[e.id].coortes));
        const idadeTotal = idadeDasCoortes(coortesTotais, anoRef, i, pm);
        const gargalo = ENTREGAS.map(e => etapas[e.id]).reduce((a, b) => (b.filaFim > a.filaFim ? b : (Math.abs(b.filaFim - a.filaFim) < 1e-9 && b.capacidade < a.capacidade ? b : a)));

        return {
          mes: m.mes, nome: m.nome, nomeLongo: m.nomeLongo, diasUteis: m.diasUteis,
          passado, hoje: i === t,
          clientes, demanda, pesoMedio,
          informado: !!informado, informadas: informado ? informado.clientes : null,
          informadasUep: informado ? informado.uep : null, informadasExatas: informado ? informado.exato : null,
          etapas, areas,
          concluido: etapas[ENTREGAS[ENTREGAS.length - 1].id].concluido,
          backlog, backlogInicio: ENTREGAS.reduce((s, e) => s + etapas[e.id].filaInicio, 0),
          coortes: coortesTotais, idade: idadeTotal,
          gargalo: gargalo.id, gargaloRotulo: gargalo.rotulo,
          impossivel: ENTREGAS.some(e => etapas[e.id].impossivel),
          quadroEstimado: ENTREGAS.some(e => etapas[e.id].semEquipe && demanda > 1e-9),
          backlogCenario: ENTREGAS.reduce((s, e) => s + cenario[e.id].filaFim, 0),
          cenario,
          status: piorStatus(FUNCOES.map(f => areas[f].status)),
        };
      });

      /* ---- resumo do ano e quadro estrutural ---- */
      const mediaDemanda = meses.reduce((s, m) => s + m.demanda, 0) / (meses.length || 1);
      const estrutural = {};
      FUNCOES.forEach(f => {
        const producaoPessoa = meses.reduce((s, m) => s + m.areas[f].producaoPessoa, 0) / (meses.length || 1);
        const quadroMedio = meses.reduce((s, m) => s + m.areas[f].quadro, 0) / (meses.length || 1);
        const custoPessoa = meses.reduce((s, m) => s + m.areas[f].custoPessoa, 0) / (meses.length || 1);
        const qlp = pessoasInteiras(mediaDemanda, producaoPessoa);
        const pico = Math.max(0, ...meses.map(m => m.areas[f].qlpOperacional));
        const recuperacao = Math.max(0, ...meses.slice(t === 12 ? 11 : t).map(m => m.areas[f].qlpRecuperacao));
        estrutural[f] = {
          funcao: f, qlp, pico, recuperacao,
          quadroAtual: quadroMedio,
          faltamEstrutural: Math.max(0, Math.ceil(qlp - quadroMedio - 1e-9)),
          faltamRecuperacao: Math.max(0, Math.ceil(recuperacao - quadroMedio - 1e-9)),
          temporarios: Math.max(0, recuperacao - qlp),
          custoPessoa,
          custoAtual: quadroMedio * custoPessoa,
          custoEstrutural: qlp * custoPessoa,
          custoRecuperacao: Math.max(0, recuperacao - qlp) * custoPessoa,
          custoIncremental: Math.max(0, recuperacao - quadroMedio) * custoPessoa,
        };
      });
      const admissoesResumo = {};
      FUNCOES.forEach(f => {
        admissoesResumo[f] = { lista: admissoes[f].slice(), total: admissoes[f].reduce((s, a) => s + a.quantidade, 0) };
      });
      const ultimo = meses[meses.length - 1];
      const hoje = meses[Math.min(t, 11)];
      const zeraIdx = meses.findIndex((m, i) => i >= (t === 12 ? 11 : t) && m.backlog <= 1e-9);

      return {
        id: item.id, nome: item.nome, meses,
        resumo: {
          mediaDemanda,
          demandaAno: meses.reduce((s, m) => s + m.demanda, 0),
          concluidoAno: meses.reduce((s, m) => s + m.concluido, 0),
          backlogHoje: hoje ? hoje.backlog : 0,
          backlogInicioHoje: hoje ? hoje.backlogInicio : 0,
          idadeHoje: hoje ? hoje.idade : null,
          backlogDezembro: ultimo ? ultimo.backlog : 0,
          backlogDezembroCenario: ultimo ? ultimo.backlogCenario : 0,
          gargaloHoje: hoje ? hoje.gargalo : null,
          zeraEm: zeraIdx >= 0 ? zeraIdx : null,
          mesesInformados: meses.filter(m => m.informado).length,
          mesesInsuficientes: meses.filter(m => m.status === 'deficit').length,
          primeiroDeficit: (() => { const i = meses.findIndex(m => m.status === 'deficit'); return i >= 0 ? i : null; })(),
          estrutural, admissoes: admissoesResumo,
          filaFinal: Object.fromEntries(ENTREGAS.map(e => [e.id, meses.length ? meses[meses.length - 1].etapas[e.id].coortes : []])),
        },
      };
    }

    const informadasDe = id => mes => {
      const porMes = atendidas && atendidas[id];
      return porMes ? porMes[mes + 1] : null;
    };
    const informadasTotal = mes => {
      if (!atendidas) return null;
      let total = null;
      resultado.unidades.forEach(u => {
        const v = (atendidas[u.id] || {})[mes + 1];
        if (v == null || v === '') return;
        if (typeof v === 'object') {
          total = typeof total === 'object' && total ? total : {};
          Object.entries(v).forEach(([porte, q]) => { total[porte] = n(total[porte]) + Math.max(0, n(q)); });
        } else if (typeof total === 'object' && total) {
          total.P = n(total.P) + Math.max(0, n(v));
        } else {
          total = n(total) + Math.max(0, n(v));
        }
      });
      return total;
    };

    const iniciaisDe = unidadeId => Object.fromEntries(ENTREGAS.map(e => [e.id, inicialDaEtapa(unidadeId, e)]));
    const unidades = resultado.unidades.map(u => fluxoDaUnidade(u, informadasDe(u.id), iniciaisDe(u.id)));
    // no total, a fila inicial é a soma das unidades (a equipe de uma não atende a fila de outra,
    // mas o backlog consolidado é a soma dos backlogs)
    const iniciaisTotal = Object.fromEntries(ENTREGAS.map(e => [e.id, juntarCoortes(resultado.unidades.flatMap(u => inicialDaEtapa(u.id, e)))]));
    const total = fluxoDaUnidade({ id: '__total__', nome: 'Todas as unidades', meses: resultado.total.meses }, informadasTotal, iniciaisTotal);
    return { mesAtual: t, prazoMeses: pm, ano: anoRef, faixasIdade: FAIXAS_IDADE, unidades, total };
  }

  /* ---------- headcount para eliminar o vencido acumulado ----------

     Responde à pergunta direta: "com o que está vencido até este mês, quantas pessoas eu
     preciso para zerar isso em N meses?" — por etapa da cadeia, por área e no total.

       trabalho(etapa, N) = vencido acumulado que ainda passa por essa etapa
                          + o que vence nos N meses do período (tudo passa por todas as etapas)
       por mês            = trabalho ÷ N
       pessoas(etapa)     = ⌈ (trabalho ÷ N) ÷ produção de uma pessoa no mês ⌉
       pessoas(área)      = a maior entre as etapas da área (a mesma pessoa cobre as duas)
       déficit            = pessoas − quadro atual (nunca negativo)

     Quando o prazo passa de dezembro, os meses que faltam entram pela média mensal do ano e
     o cenário é marcado como estimado — o sistema não inventa demanda, declara a premissa.
     ---------------------------------------------------- */

  function headcount(item, { mes = 0, prazos = [1, 2, 3, 6, 12] } = {}) {
    const meses = item.meses || [];
    const i = clampMes(mes, 0);
    const mesInfo = meses[i];
    if (!mesInfo) return null;
    const mediaEntrada = meses.length ? meses.reduce((acc, m) => acc + m.demanda, 0) / meses.length : 0;

    const backlogPorEtapa = {};
    ENTREGAS.forEach(e => { backlogPorEtapa[e.id] = Math.max(0, n(mesInfo.etapas[e.id].filaAcumulada)); });
    const backlogTotal = ENTREGAS.reduce((acc, e) => acc + n(mesInfo.etapas[e.id].filaInicio), 0);

    const cenarios = prazos.map(prazo => {
      const n_ = Math.max(1, Math.round(n(prazo)) || 1);
      const disponiveis = Math.min(n_, meses.length - i);
      const entradaReal = meses.slice(i, i + disponiveis).reduce((acc, m) => acc + m.demanda, 0);
      const mesesEstimados = Math.max(0, n_ - disponiveis);
      const entradaPeriodo = entradaReal + mesesEstimados * mediaEntrada;

      const etapas = {};
      ENTREGAS.forEach(e => {
        const d = mesInfo.etapas[e.id];
        const trabalho = backlogPorEtapa[e.id] + entradaPeriodo;
        const porMes = trabalho / n_;
        const producaoPessoa = Math.max(0, n(d.producaoPessoa));
        const pessoas = producaoPessoa > 0 && porMes > 1e-9 ? Math.ceil(porMes / producaoPessoa - 1e-9) : 0;
        etapas[e.id] = {
          id: e.id, rotulo: e.rotulo, funcao: e.funcao,
          trabalho, porMes, producaoPessoa,
          capacidadeAtual: Math.max(0, n(d.capacidade)),
          quadro: Math.max(0, n(d.quadro)),
          pessoas,
          deficit: Math.max(0, Math.ceil(pessoas - n(d.quadro) - 1e-9)),
          impossivel: porMes > 1e-9 && producaoPessoa <= 0,
        };
      });

      const areas = {};
      FUNCOES.forEach(f => {
        const daFuncao = ENTREGAS_DA_FUNCAO[f].map(e => etapas[e.id]);
        const quadro = Math.max(0, n(mesInfo.areas[f].quadro));
        const pessoas = Math.max(...daFuncao.map(e => e.pessoas));
        const custoPessoa = Math.max(0, n(mesInfo.areas[f].custoPessoa));
        const deficit = Math.max(0, Math.ceil(pessoas - quadro - 1e-9));
        areas[f] = {
          funcao: f, rotulo: FUNCAO_CURTA[f],
          quadro, cabecas: Math.max(0, n(mesInfo.areas[f].cabecas)), pessoas, deficit,
          etapaCritica: daFuncao.reduce((a, b) => (b.pessoas > a.pessoas ? b : a)).id,
          custoPessoa,
          custoDeficit: deficit * custoPessoa,
          custoTotal: pessoas * custoPessoa,
          impossivel: daFuncao.some(e => e.impossivel),
        };
      });

      return {
        prazoMeses: n_, mesesEstimados, entradaPeriodo, entradaReal,
        trabalhoTotal: backlogTotal + entradaPeriodo,
        etapas, areas,
        pessoas: FUNCOES.reduce((acc, f) => acc + areas[f].pessoas, 0),
        deficit: FUNCOES.reduce((acc, f) => acc + areas[f].deficit, 0),
        custoDeficit: FUNCOES.reduce((acc, f) => acc + areas[f].custoDeficit, 0),
        custoTotal: FUNCOES.reduce((acc, f) => acc + areas[f].custoTotal, 0),
        impossivel: FUNCOES.some(f => areas[f].impossivel),
      };
    });

    return {
      mes: i, nomeMes: mesInfo.nomeLongo,
      backlog: { total: backlogTotal, porEtapa: backlogPorEtapa, idade: mesInfo.idade },
      demandaDoMes: mesInfo.demanda, clientesDoMes: mesInfo.clientes,
      mediaEntrada,
      quadroAtual: FUNCOES.reduce((acc, f) => acc + n(mesInfo.areas[f].quadro), 0),      // tempo integral
      cabecasAtual: FUNCOES.reduce((acc, f) => acc + n(mesInfo.areas[f].cabecas), 0),    // pessoas
      cenarios,
    };
  }

  /* ---------- adaptadores: fila() e evolucao() sobre o núcleo ----------
     Mantêm o formato que as telas já consomem, mas a conta é uma só (fluxo()).
     ---------------------------------------------------- */

  /** Fila de atendimento por área (formato usado por Projeção, Dashboard e Resumo do mês). */
  function fila(resultado, opcoes = {}) {
    const fx = fluxo(resultado, opcoes);
    const t = fx.mesAtual, pm = fx.prazoMeses;
    const nomeMes = i => MESES_LONGO[i];

    const grupoDeItem = (item, f) => {
      const meses = item.meses.map((m, i) => {
        const a = m.areas[f];
        const producaoDiaPor = {};
        ENTREGAS_DA_FUNCAO[f].forEach(e => { producaoDiaPor[e.id] = m.diasUteis > 0 ? m.etapas[e.id].capacidade / m.diasUteis : 0; });
        return {
          mes: m.mes, nome: m.nome, nomeLongo: m.nomeLongo, diasUteis: m.diasUteis,
          passado: m.passado, hoje: m.hoje,
          informado: m.demanda, entram: m.demanda,
          filaInicio: a.filaInicio, pendentes: a.filaInicio + m.demanda,
          consegue: a.capacidade, atendidas: a.concluido, filaFim: a.filaFim,
          pessoas: a.quadro, cabecas: a.cabecas, producaoPessoa: a.producaoPessoa,
          producaoDia: m.diasUteis > 0 ? a.capacidade / m.diasUteis : 0,
          producaoDiaPor, gargaloId: a.gargaloEtapa,
          status: a.status,
        };
      });
      const hoje = meses[Math.min(t, 11)];
      const prazo = meses.slice(Math.min(t, 11), Math.min(12, Math.min(t, 11) + pm));
      const filaHoje = hoje ? hoje.pendentes : 0;
      const entramPrazo = prazo.slice(1).reduce((s, x) => s + x.entram, 0);
      const conseguePrazo = prazo.reduce((s, x) => s + x.consegue, 0);
      const producaoPessoaPrazo = prazo.reduce((s, x) => s + x.producaoPessoa, 0);
      const faltaPrazo = Math.max(0, filaHoje + entramPrazo - conseguePrazo);
      const sobraPrazo = Math.max(0, conseguePrazo - (filaHoje + entramPrazo));
      const zeraIdx = meses.findIndex((x, i) => i >= Math.min(t, 11) && x.filaFim <= 1e-9);
      const resumo = {
        funcao: f, mesAtual: t, prazoMeses: pm,
        filaHoje, deMesesAnteriores: hoje ? hoje.filaInicio : 0, entramHoje: hoje ? hoje.entram : 0,
        entramPrazo, conseguePrazo, faltaPrazo,
        pessoasPrazo: faltaPrazo > 1e-9 && producaoPessoaPrazo > 0 ? Math.ceil(faltaPrazo / producaoPessoaPrazo - 1e-9) : 0,
        pessoasSobram: sobraPrazo > 1e-9 && producaoPessoaPrazo > 0 ? Math.floor(sobraPrazo / producaoPessoaPrazo + 1e-9) : 0,
        entramResto: meses.slice(Math.min(t, 11)).reduce((s, x) => s + x.entram, 0),
        filaDezembro: meses[11].filaFim,
        zeraEm: zeraIdx >= 0 ? zeraIdx : null, zeraEmNome: zeraIdx >= 0 ? nomeMes(zeraIdx) : null,
        pessoas: hoje ? hoje.pessoas : 0, cabecas: hoje ? hoje.cabecas : 0, producaoDia: hoje ? hoje.producaoDia : 0,
        producaoDiaPor: hoje ? hoje.producaoDiaPor : {}, gargaloId: hoje ? hoje.gargaloId : null,
        status: piorStatus(meses.slice(Math.min(t, 11)).map(x => x.status)),
      };
      return { meses, resumo };
    };

    const unidades = fx.unidades.map(u => {
      const grupos = {};
      FUNCOES.forEach(f => { grupos[f] = grupoDeItem(u, f); });
      return { id: u.id, nome: u.nome, grupos };
    });
    const grupos = {};
    FUNCOES.forEach(f => { grupos[f] = grupoDeItem(fx.total, f); });
    // no total, contratar é a soma das unidades (folga numa não cobre a fila de outra)
    FUNCOES.forEach(f => {
      grupos[f].resumo.pessoasPrazo = unidades.reduce((s, u) => s + u.grupos[f].resumo.pessoasPrazo, 0);
      grupos[f].resumo.pessoasSobram = unidades.reduce((s, u) => s + u.grupos[f].resumo.pessoasSobram, 0);
      grupos[f].resumo.faltaPrazo = unidades.reduce((s, u) => s + u.grupos[f].resumo.faltaPrazo, 0);
    });
    const filaInicialTotal = {};
    FUNCOES.forEach(f => { filaInicialTotal[f] = fx.total.meses[0].areas[f].filaInicio; });
    return { mesAtual: t, prazoMeses: pm, unidades, total: { grupos }, filaInicial: filaInicialTotal, fluxo: fx };
  }

  /** Evolução (controle histórico) por área — mesmo núcleo, formato da tela Evolução. */
  function evolucao(resultado, opcoes = {}) {
    const fx = fluxo(resultado, opcoes);
    const areaDeItem = (item, f) => {
      const meses = item.meses.map(m => {
        const a = m.areas[f];
        return {
          mes: m.mes, nome: m.nome, nomeLongo: m.nomeLongo, diasUteis: m.diasUteis,
          passado: m.passado, hoje: m.hoje,
          clientes: m.clientes, entram: m.demanda, pesoMedio: m.pesoMedio,
          informadas: m.informadas, informado: m.informado, informadasExatas: m.informadasExatas,
          filaInicio: a.filaInicio, pendentes: a.filaInicio + m.demanda,
          capacidade: a.capacidade, atendidas: a.concluido, filaFim: a.filaFim,
          quadro: a.quadro, cabecas: a.cabecas, producaoPessoa: a.producaoPessoa, custoPessoa: a.custoPessoa,
          necessarioVazao: a.qlpOperacional, necessarioRecuperacao: a.qlpRecuperacao,
          faltamVazao: a.faltamOperacional, faltamRecuperacao: a.faltamRecuperacao,
          sobramPessoas: a.sobram,
          custoDeficit: a.custoDeficitRecuperacao,
          gargaloEtapa: a.gargaloEtapa,
          status: a.status,
          cenario: {
            filaInicio: ENTREGAS_DA_FUNCAO[f].reduce((s, e) => s + n(m.cenario[e.id].filaInicio), 0),
            capacidade: Math.min(...ENTREGAS_DA_FUNCAO[f].map(e => n(m.cenario[e.id].capacidade))),
            atendidas: n(m.cenario[ENTREGAS_DA_FUNCAO[f][ENTREGAS_DA_FUNCAO[f].length - 1].id].concluido),
            filaFim: ENTREGAS_DA_FUNCAO[f].reduce((s, e) => s + n(m.cenario[e.id].filaFim), 0),
            admissoes: a.admissoesCenario, quadro: a.quadroCenario,
          },
        };
      });
      const soma = campo => meses.reduce((s, m) => s + m[campo], 0);
      const ultimo = meses[meses.length - 1];
      const estrutural = item.resumo.estrutural[f];
      const adm = item.resumo.admissoes[f];
      return {
        funcao: f, meses,
        resumo: {
          funcao: f,
          entram: soma('entram'), atendidas: soma('atendidas'), capacidade: soma('capacidade'),
          filaDezembro: ultimo ? ultimo.filaFim : 0,
          filaDezembroCenario: ultimo ? ultimo.cenario.filaFim : 0,
          admissoes: adm.lista, admissoesTotal: adm.total,
          mesesInsuficientes: meses.filter(m => m.status === 'deficit').length,
          mesesInformados: meses.filter(m => m.informado).length,
          custoDeficitMes: meses.length ? soma('custoDeficit') / meses.length : 0,
          primeiroDeficit: (() => { const i = meses.findIndex(m => m.faltamVazao > 0); return i >= 0 ? i : null; })(),
          estrutural,
          status: piorStatus(meses.map(m => m.status)),
        },
      };
    };
    const unidades = fx.unidades.map(u => {
      const areas = {};
      FUNCOES.forEach(f => { areas[f] = areaDeItem(u, f); });
      return { id: u.id, nome: u.nome, areas };
    });
    const areasTotal = {};
    FUNCOES.forEach(f => { areasTotal[f] = areaDeItem(fx.total, f); });
    return { mesAtual: fx.mesAtual, prazoMeses: fx.prazoMeses, unidades, total: { areas: areasTotal }, fluxo: fx };
  }

  return {
    MESES, MESES_LONGO, TEC, ADM, FUNCOES, FUNCAO_CURTA, FUNCAO_SINGULAR, ENTREGAS, ENTREGAS_DA_FUNCAO, COLAB_PADRAO, MARGEM_ATENCAO, colaboradoresSimulados,
    empresasDoMes, empresasPonderadas, pesoPorte, presencaNoMes, fatorRampup, custoFuncao,
    producaoMes, precisaMes, calcular, fluxo, fila, evolucao, headcount, FAIXAS_IDADE, normalizarParametros, ritmoTexto, piorStatus,
  };
})();

// Node (testes): expõe como módulo; no navegador fica global.
export default Calculo;

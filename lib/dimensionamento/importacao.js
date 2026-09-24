/* Copia FIEL de web/src/services/importacao.js do repo joaojefferson-hash/Dimensionamento_Chabra @ e5671c2
   (DIM-01, 2026-09-22). Modulo puro: sem rede, sem banco, sem framework.
   Tipos do lado de fora em importacao.d.ts -- o corpo nao foi retipado de proposito. */
/* ==========================================================================
   Importação da planilha do SGG (ou qualquer planilha) → demanda por unidade × mês.

   Funções puras (sem Vue/Supabase; testáveis em Node):
     lerPlanilha(arrayBuffer)            → { abas: [{ nome, cabecalhos, linhas }] }
     detectarColunas(cabecalhos)         → { unidade, vencimento, cliente, clienteId, condicao, porte, situacao } (índices ou null)
     resumir(linhas, mapa, opcoes)       → { ano, porUnidade: { [nomeUnidade]: { [mes]: { [condicao]: { [porte]: n } } } },
                                             avisos, totalLinhas, linhasUsadas, anosEncontrados,
                                             detalhes: [{ cliente, codigo, unidade, data, mes, ano, condicao, porte, situacao, usada, motivo }] }
     casarUnidades(nomesNoArquivo, unidadesCadastro) → { [nomeNoArquivo]: unidadeId | null }
     montarLinhasRpc(porUnidade, mapaUnidades)       → [{ unidade_id, mes, condicao, porte, quantidade }]

   Regras:
     • uma linha = um documento (ou um cliente) com data de vencimento;
     • opcoes.unidadeFixa = nome: o arquivo inteiro conta para essa unidade (o relatório do SGG sai por região);
     • opcoes.condicaoFixa = 'mensal' | 'exclusiva_tst': o arquivo inteiro vai para essa condição (ignora a coluna);
     • opcoes.porteCliente = { [codigo ou nome]: 'P'|'M'|'G' }: porte escolhido por cliente (vence a coluna e o padrão);
     • conta-se cada CLIENTE uma vez por unidade × mês (vários documentos do mesmo cliente
       vencendo no mesmo mês = 1 atendimento), a não ser que opcoes.contarPor = 'linha';
     • condição: valor contendo "exclus" ou "tst" → Exclusiva TST; senão Mensal (padrão quando não há coluna);
     • porte: P/M/G, "pequeno/médio/grande", ou faixa de funcionários quando opcoes.porteFaixas está definido.
   ========================================================================== */
import * as XLSX from 'xlsx';

const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const chave = s => semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim();

/* ---------- leitura ---------- */

export function lerPlanilha(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, raw: true });
  const abas = wb.SheetNames.map(nome => {
    const ws = wb.Sheets[nome];
    const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
    // cabeçalho = primeira linha com pelo menos 2 células preenchidas
    const iCab = matriz.findIndex(l => l.filter(c => String(c).trim() !== '').length >= 2);
    if (iCab < 0) return { nome, cabecalhos: [], linhas: [] };
    const cabecalhos = matriz[iCab].map(c => String(c).trim());
    const linhas = matriz.slice(iCab + 1).filter(l => l.some(c => String(c).trim() !== ''));
    return { nome, cabecalhos, linhas };
  });
  return { abas };
}

/* ---------- detecção de colunas ---------- */

// Palavras por campo, em ordem de preferência. Export do SGG ("VENCIMENTO(s) DE PGR(s)"):
// Código Empresa · Empresa · Região · Tipo Período · Data Emissão Anterior · Data Validade · Situação ·
// Detalhes Adicionais · Informações adicionais da Empresa
const PALAVRAS = {
  unidade:    ['regiao', 'unidade', 'filial', 'regional', 'base', 'escritorio', 'polo'],
  vencimento: ['data validade', 'data de validade', 'validade', 'vencimento', 'data de venc', 'dt venc', 'vence', 'expira'],
  cliente:    ['empresa', 'cliente', 'razao social', 'nome fantasia', 'contratante', 'nome'],
  clienteId:  ['codigo empresa', 'codigo cliente', 'cod empresa', 'cod cliente', 'cnpj', 'codigo'],
  condicao:   ['condicao', 'informacoes adicionais', 'tipo de contrato', 'modalidade', 'plano', 'observac'],
  porte:      ['porte', 'grau de risco', 'tamanho', 'funcionarios', 'colaboradores', 'vidas', 'empregados'],
  situacao:   ['situacao', 'status'],
};
const NAO_E_CLIENTE = ['codigo', 'cnpj', 'informacoes', 'detalhes']; // colunas que contêm "empresa" mas não são o nome
export function detectarColunas(cabecalhos) {
  const c = cabecalhos.map(chave);
  const acha = (lista, evitar = []) => {
    const ok = i => !evitar.some(e => c[i].includes(e));
    for (const p of lista) { const k = chave(p); const i = c.findIndex((h, idx) => h === k && ok(idx)); if (i >= 0) return i; }       // nome exato
    for (const p of lista) { const k = chave(p); const i = c.findIndex((h, idx) => h.startsWith(k) && ok(idx)); if (i >= 0) return i; } // começa com
    for (const p of lista) { const k = chave(p); const i = c.findIndex((h, idx) => h.includes(k) && ok(idx)); if (i >= 0) return i; }   // contém
    return null;
  };
  const mapa = {};
  Object.entries(PALAVRAS).forEach(([campo, lista]) => { mapa[campo] = acha(lista, campo === 'cliente' ? NAO_E_CLIENTE : []); });
  if (mapa.unidade != null && mapa.unidade === mapa.cliente) mapa.cliente = null;
  return mapa;
}

/** Valores distintos de uma coluna (para o filtro de situação), com contagem. */
export function valoresDistintos(linhas, coluna) {
  const c = {};
  linhas.forEach(l => { const v = String(l[coluna] ?? '').trim() || '(vazio)'; c[v] = (c[v] || 0) + 1; });
  return Object.entries(c).map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n);
}
/** Situações que NÃO representam demanda em aberto (renovado, em dia, cancelado…). */
export const situacaoExcluida = v => /renovad|em dia|cancel|inativ|encerrad|baixad|conclu/.test(semAcento(v));

/* ---------- valores ---------- */

export function lerData(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(1899, 11, 30 + Math.floor(v)); // serial do Excel (época 30/12/1899)
  const s = String(v).trim();
  let m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s);
  if (m) { const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return new Date(a, Number(m[2]) - 1, Number(m[1])); }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}
/** Condição a partir de um texto (só a primeira linha: "Mensal desde 04/04/2022" + "Reativado…" -> Mensal). */
export function lerCondicao(v) {
  const s = semAcento(String(v).split(/\r?\n/)[0]);
  if (s.includes('sem avalia') || s.includes('nao avaliad')) return 'sem_avaliacao';
  if (s.includes('contrato novo') || s.includes('novo contrato') || s.includes('contratos novos')) return 'contrato_novo';
  return s.includes('exclus') || /\btst\b/.test(s) ? 'exclusiva_tst' : 'mensal';
}
export function lerPorte(v, faixas = null, codigos = ['P', 'M', 'G']) {
  if (v == null || v === '') return codigos[0];
  const s = semAcento(v);
  if (/^p\b|pequen|micro/.test(s)) return codigos[0];
  if (/^m\b|medi/.test(s)) return codigos[1] || codigos[0];
  if (/^g\b|grand/.test(s)) return codigos[2] || codigos[0];
  const n = Number(String(v).replace(/[^\d.,]/g, '').replace(',', '.'));
  if (faixas && Number.isFinite(n)) return n <= faixas.pequeno ? codigos[0] : n <= faixas.medio ? (codigos[1] || codigos[0]) : (codigos[2] || codigos[0]);
  return codigos[0];
}

/* ---------- resumo por unidade × mês ---------- */

export function resumir(linhas, mapa, opcoes = {}) {
  const { contarPor = 'cliente', ano = null, condicaoPadrao = 'mensal', portePadrao = 'P', porteFaixas = null, codigosPorte = ['P', 'M', 'G'], situacoes = null, unidadeFixa = null, condicaoFixa = null, porteCliente = null, mesFixo = null } = opcoes;
  // sem coluna de data, todas as linhas contam no mês de referência escolhido (1..12)
  const mesReferencia = Number(mesFixo) >= 1 && Number(mesFixo) <= 12 ? Number(mesFixo) : null;
  let foraSituacao = 0;
  const avisos = [];
  const anos = {};
  const vistos = new Set();
  const porUnidade = {};
  const detalhes = [];
  let usadas = 0, semData = 0, semUnidade = 0, outroAno = 0;
  const texto = (i) => (i == null ? '' : String(linhas_atual[i] ?? '').trim());
  let linhas_atual = null;
  if (mapa.vencimento == null && !mesReferencia) return { ano, porUnidade, avisos: ['Escolha a coluna de data de vencimento ou o mês de referência.'], totalLinhas: linhas.length, linhasUsadas: 0, anosEncontrados: [], detalhes };
  if (mapa.unidade == null && !unidadeFixa) return { ano, porUnidade, avisos: ['Escolha a unidade do cadastro (o arquivo não tem coluna de unidade).'], totalLinhas: linhas.length, linhasUsadas: 0, anosEncontrados: [], detalhes };

  linhas.forEach(l => {
    linhas_atual = l;
    const det = { cliente: texto(mapa.cliente), codigo: texto(mapa.clienteId), situacao: texto(mapa.situacao), data: null, mes: null, ano: null, condicao: null, porte: null, unidade: unidadeFixa || texto(mapa.unidade), usada: false, motivo: '' };
    detalhes.push(det);
    const fora = motivo => { det.motivo = motivo; };
    if (mapa.situacao != null && situacoes) { const sv = det.situacao || '(vazio)'; if (!situacoes.includes(sv)) { foraSituacao++; fora('situação não selecionada'); return; } }
    const data = mapa.vencimento != null ? lerData(l[mapa.vencimento]) : null;
    if (!data && !mesReferencia) { semData++; fora('sem data de vencimento'); return; }
    const y = data ? data.getFullYear() : ano;
    const mes = data ? data.getMonth() + 1 : mesReferencia;
    det.data = data; det.ano = y; det.mes = mes;
    const unidade = det.unidade;
    if (!unidade) { semUnidade++; fora('sem unidade'); return; }
    if (data) anos[y] = (anos[y] || 0) + 1;
    if (ano != null && y !== ano) { outroAno++; fora(`vencimento em ${y}, não em ${ano}`); return; }
    const cond = condicaoFixa || (mapa.condicao != null ? lerCondicao(l[mapa.condicao]) : condicaoPadrao);
    // porte: o escolhido para o cliente (pelo código; sem código, pelo nome) > coluna do arquivo > padrão
    const chaveCliente = det.codigo || det.cliente;
    const porte = (porteCliente && chaveCliente && porteCliente[chaveCliente]) || (mapa.porte != null ? lerPorte(l[mapa.porte], porteFaixas, codigosPorte) : portePadrao);
    det.condicao = cond; det.porte = porte; det.chave = chaveCliente;
    // identidade do cliente: o código (cada estabelecimento tem o seu) ou, sem código, o nome
    const idCliente = mapa.clienteId != null ? l[mapa.clienteId] : mapa.cliente != null ? l[mapa.cliente] : null;
    if (contarPor === 'cliente' && idCliente != null && String(idCliente).trim() !== '') {
      const k = `${chave(unidade)}|${y}|${mes}|${chave(idCliente)}`;
      if (vistos.has(k)) { fora('cliente já contabilizado neste mês'); return; }
      vistos.add(k);
    }
    const u = (porUnidade[unidade] = porUnidade[unidade] || {});
    const m = (u[mes] = u[mes] || {});
    const c = (m[cond] = m[cond] || {});
    c[porte] = (c[porte] || 0) + 1;
    det.usada = true;
    usadas++;
  });
  if (foraSituacao) avisos.push(`${foraSituacao} linha(s) com situação não selecionada foram desconsideradas.`);
  if (semData) avisos.push(`${semData} linha(s) sem data de vencimento válida foram desconsideradas.`);
  if (semUnidade) avisos.push(`${semUnidade} linha(s) sem unidade foram desconsideradas.`);
  if (outroAno) avisos.push(`${outroAno} linha(s) de outros anos foram desconsideradas (apenas o ano ${ano} é importado).`);
  const anosEncontrados = Object.entries(anos).map(([a, n]) => ({ ano: Number(a), linhas: n })).sort((x, y) => x.ano - y.ano);
  return { ano, porUnidade, avisos, totalLinhas: linhas.length, linhasUsadas: usadas, anosEncontrados, detalhes };
}

/* ---------- unidades: nome no arquivo → cadastro ---------- */

export function casarUnidades(nomes, unidades) {
  const out = {};
  nomes.forEach(nome => {
    const k = chave(nome);
    let u = unidades.find(x => chave(x.nome) === k);
    if (!u) u = unidades.find(x => k.includes(chave(x.nome)) || chave(x.nome).includes(k));
    if (!u) { const p = k.split(' ')[0]; if (p && p.length >= 4) u = unidades.find(x => chave(x.nome).split(' ')[0] === p); }
    out[nome] = u ? u.id : null;
  });
  return out;
}

export function montarLinhasRpc(porUnidade, mapaUnidades) {
  const out = [];
  Object.entries(porUnidade).forEach(([nome, meses]) => {
    const unidade_id = mapaUnidades[nome];
    if (!unidade_id) return;
    Object.entries(meses).forEach(([mes, conds]) => Object.entries(conds).forEach(([condicao, portes]) => Object.entries(portes).forEach(([porte, quantidade]) => {
      out.push({ unidade_id, mes: Number(mes), condicao, porte, quantidade });
    })));
  });
  // soma linhas repetidas (dois nomes do arquivo apontando para a mesma unidade)
  const agr = {};
  out.forEach(l => { const k = `${l.unidade_id}|${l.mes}|${l.condicao}|${l.porte}`; agr[k] = agr[k] ? { ...agr[k], quantidade: agr[k].quantidade + l.quantidade } : l; });
  return Object.values(agr);
}

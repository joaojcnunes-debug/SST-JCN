/* Copia FIEL de supabase/functions/sincronizar-sst/transformar.js do repo joaojefferson-hash/Dimensionamento_Chabra @ e5671c2
   (DIM-01, 2026-09-22). Modulo puro: sem rede, sem banco, sem framework.
   Tipos do lado de fora em transformar.d.ts -- o corpo nao foi retipado de proposito. */
/* ==========================================================================
   Transformação pura: documentos da API de SST → lote de demanda e atendidas.

   Sem rede, sem banco, sem Deno: a mesma entrada produz sempre a mesma saída
   (testes em tests/sincronizacao.test.mjs).

   Regras de negócio:
     - DEMANDA = clientes com documento a vencer no mês. Cada empresa conta
       UMA VEZ por mês, mesmo com PGR, LTCAT, LI e LP vencendo juntos.
       Considera apenas o documento corrente de cada par (empresa, tipo):
       `vigente = true` (o substituído já foi resolvido).
     - ATENDIDAS = empresas com documento EMITIDO no mês (a emissão é a conclusão
       do trabalho). Também uma vez por empresa e por mês, e aqui entram inclusive
       os documentos já substituídos — eles registram trabalho concluído.
     - PORTE e CONDIÇÃO não existem na API: vêm da classificação da Chabra
       (por CNPJ, senão por código); sem classificação, porte padrão e Mensal.
     - COBERTURA manda: unidade `indisponivel` ou `falha` não é gravada (ausência
       de documento ali não prova ausência de trabalho).
   ========================================================================== */

export const COBERTURA_UTILIZAVEL = ['ok', 'parcial', 'desatualizado'];
export const PORTE_PADRAO = 'P';
export const CONDICAO_PADRAO = 'mensal';

const so = v => (v == null ? '' : String(v).trim());
const digitos = v => so(v).replace(/\D+/g, '');
/** Mês (1..12) de uma data ISO `AAAA-MM-DD`, quando pertence ao ano pedido. */
export function mesDoAno(data, ano) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(so(data));
  if (!m) return null;
  return Number(m[1]) === Number(ano) ? Number(m[2]) : null;
}

/** Classificação de um cliente (porte e condição), por CNPJ e, na falta, por código. */
export function classificar(doc, classificacao = {}) {
  const porCnpj = classificacao.porCnpj || {};
  const porCodigo = classificacao.porCodigo || {};
  const achado = porCnpj[digitos(doc.empresa_cnpj)] || porCodigo[so(doc.empresa_id)] || null;
  return {
    porte: achado && achado.porte ? achado.porte : PORTE_PADRAO,
    condicao: achado && achado.condicao ? achado.condicao : CONDICAO_PADRAO,
    classificado: !!achado,
  };
}

/**
 * Monta o lote a ser aplicado no banco.
 *   cobertura:  linhas de /sincronizacao
 *   documentos: linhas de /documentos (do ano pedido; vigentes e substituídos)
 *   unidades:   [{ id, nome, codigo_api }] do cadastro
 *   classificacao: { porCnpj: { [cnpj]: { porte, condicao } }, porCodigo: {...} }
 */
export function montarLote({ ano, cobertura = [], documentos = [], unidades = [], classificacao = {} }) {
  const porCodigoApi = new Map(unidades.filter(u => u.codigo_api).map(u => [u.codigo_api, u]));
  const naoClassificados = new Map();

  const doApi = cobertura.map(c => {
    const unidade = porCodigoApi.get(so(c.unidade)) || null;
    const utilizavel = COBERTURA_UTILIZAVEL.includes(so(c.cobertura));
    return {
      codigo_api: so(c.unidade),
      unidade_id: unidade ? unidade.id : null,
      unidade_nome: unidade ? unidade.nome : null,
      cobertura: so(c.cobertura),
      ultima_varredura_em: c.ultima_varredura_em || null,
      documentos: Number(c.documentos_sst) || 0,
      aplicar: utilizavel && !!unidade,
      mensagem: !unidade ? 'unidade da API sem correspondente no cadastro'
        : !utilizavel ? `cobertura ${so(c.cobertura)}: dado não utilizável, nada foi gravado`
          : c.cobertura === 'parcial' ? 'cobertura parcial: ausência de documento não prova ausência'
            : null,
      demandaPorMes: new Map(),   // mes → Map(chaveEmpresa → { porte, condicao })
      atendidasPorMes: new Map(), // mes → Map(chaveEmpresa → porte)
    };
  });
  const porUnidade = new Map(doApi.map(u => [u.codigo_api, u]));

  documentos.forEach(doc => {
    const alvo = porUnidade.get(so(doc.unidade));
    if (!alvo || !alvo.aplicar) return;
    const chave = digitos(doc.empresa_cnpj) || so(doc.empresa_id);
    if (!chave) return;
    const { porte, condicao, classificado } = classificar(doc, classificacao);
    if (!classificado) {
      naoClassificados.set(chave, {
        cnpj: digitos(doc.empresa_cnpj), codigo: so(doc.empresa_id),
        nome: so(doc.empresa_razao_social), unidade: alvo.codigo_api,
      });
    }

    // demanda: documento corrente com vencimento no ano
    if (doc.vigente === true) {
      const mes = mesDoAno(doc.vence_em, ano);
      if (mes) {
        if (!alvo.demandaPorMes.has(mes)) alvo.demandaPorMes.set(mes, new Map());
        alvo.demandaPorMes.get(mes).set(chave, { porte, condicao });
      }
    }
    // atendidas: emissão no ano (inclusive de documento já substituído)
    const mesEmissao = mesDoAno(doc.emitido_em, ano);
    if (mesEmissao) {
      if (!alvo.atendidasPorMes.has(mesEmissao)) alvo.atendidasPorMes.set(mesEmissao, new Map());
      alvo.atendidasPorMes.get(mesEmissao).set(chave, porte);
    }
  });

  const unidadesLote = doApi.map(u => {
    const demanda = [];
    [...u.demandaPorMes.entries()].sort((a, b) => a[0] - b[0]).forEach(([mes, empresas]) => {
      const contagem = new Map(); // "condicao|porte" → quantidade
      empresas.forEach(({ porte, condicao }) => {
        const k = `${condicao}|${porte}`;
        contagem.set(k, (contagem.get(k) || 0) + 1);
      });
      [...contagem.entries()].sort().forEach(([k, quantidade]) => {
        const [condicao, porte] = k.split('|');
        demanda.push({ mes, condicao, porte, quantidade });
      });
    });
    const atendidas = {};
    [...u.atendidasPorMes.entries()].sort((a, b) => a[0] - b[0]).forEach(([mes, empresas]) => {
      const porPorte = {};
      empresas.forEach(porte => { porPorte[porte] = (porPorte[porte] || 0) + 1; });
      atendidas[String(mes)] = porPorte;
    });
    return {
      codigo_api: u.codigo_api, unidade_id: u.unidade_id, unidade_nome: u.unidade_nome,
      cobertura: u.cobertura, ultima_varredura_em: u.ultima_varredura_em,
      documentos: u.documentos, aplicar: u.aplicar, mensagem: u.mensagem,
      demanda, atendidas,
      totalDemanda: demanda.reduce((s, d) => s + d.quantidade, 0),
      totalAtendidas: Object.values(atendidas).reduce((s, p) => s + Object.values(p).reduce((x, q) => x + q, 0), 0),
    };
  });

  return {
    ano: Number(ano),
    unidades: unidadesLote,
    naoClassificados: [...naoClassificados.values()],
    resumo: {
      unidadesAplicadas: unidadesLote.filter(u => u.aplicar).length,
      unidadesIgnoradas: unidadesLote.filter(u => !u.aplicar).map(u => ({ codigo_api: u.codigo_api, cobertura: u.cobertura, mensagem: u.mensagem })),
      demanda: unidadesLote.reduce((s, u) => s + (u.aplicar ? u.totalDemanda : 0), 0),
      atendidas: unidadesLote.reduce((s, u) => s + (u.aplicar ? u.totalAtendidas : 0), 0),
      semClassificacao: naoClassificados.size,
    },
  };
}

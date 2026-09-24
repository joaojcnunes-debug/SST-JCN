/* Copia FIEL de web/src/composables/organograma.js do repo joaojefferson-hash/Dimensionamento_Chabra @ e5671c2
   (DIM-01, 2026-09-22). Modulo puro: sem rede, sem banco, sem framework.
   Tipos do lado de fora em organograma.d.ts -- o corpo nao foi retipado de proposito. */
/* ==========================================================================
   Organograma da equipe — montado pela hierarquia das funções de chefia e
   pelas unidades informadas em cada colaborador, sem cadastro adicional:

     chefia   → fica subordinada ao colaborador cuja função é a "Subordinada a"
                da sua função (havendo mais de um, o que divide unidade com ela)
     equipe   → cada colaborador fica sob a chefia mais próxima que coordena a
                sua área (técnicos / administrativos / toda a equipe) na unidade
     à parte  → "Sem chefia definida" (unidade sem chefia para aquela área) e
                "Sem unidade" (colaboradores sem unidade informada)

   Funções puras: recebem os cadastros e devolvem a árvore pronta para exibição.
   ========================================================================== */

const ORDEM_TIPO = { tecnico: 0, administrativo: 1, nenhuma: 2 };
export const ROTULO_TIPO = { tecnico: 'Técnicos', administrativo: 'Administrativos', nenhuma: 'Outros' };
export const COORDENA_TXT = { todos: 'coordena toda a equipe', tecnicos: 'coordena os técnicos', administrativos: 'coordena os administrativos' };

const cobre = (coordena, tipo) => coordena === 'todos' || (coordena === 'tecnicos' && tipo === 'tecnico') || (coordena === 'administrativos' && tipo === 'administrativo');
const cmpNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Árvore do organograma: chefias (pela hierarquia das funções) com as suas equipes por unidade. */
export function montarOrganograma({ unidades = [], colaboradores = [], funcoes = [] }) {
  const ids = new Set(unidades.map(u => u.id));
  const nomeUnidade = uid => (unidades.find(u => u.id === uid) || {}).nome || '?';
  const alocs = c => (c.alocacoes || []).filter(a => a && ids.has(a.unidadeId) && Number(a.percentual) > 0);
  const funcaoDe = c => funcoes.find(f => f.id === c.funcaoId) || null;
  const ordemF = f => (f ? f.ordem : 9999);

  /* ---- chefias ---- */
  const chefes = colaboradores.filter(c => c.chefia).map(c => ({
    c, funcao: funcaoDe(c), unidades: alocs(c).map(a => a.unidadeId), coordena: c.coordena || 'todos', filhos: [], equipes: new Map(),
  }));
  chefes.sort((a, b) => ordemF(a.funcao) - ordemF(b.funcao) || cmpNome(a.c, b.c));

  // profundidade da função na hierarquia (0 = nível superior): a chefia mais baixa fica mais próxima da equipe
  const profundidade = f => {
    let d = 0; const vistos = new Set();
    for (let cur = f; cur && cur.respondeParaId && !vistos.has(cur.id); d++) { vistos.add(cur.id); cur = funcoes.find(x => x.id === cur.respondeParaId) || null; }
    return d;
  };
  chefes.forEach(ch => { ch.nivel = profundidade(ch.funcao); });

  // superior de uma chefia: sobe pela cadeia "Subordinada a" até encontrar uma função com colaborador
  const superiorDe = ch => {
    const vistos = new Set();
    let f = ch.funcao ? funcoes.find(x => x.id === ch.funcao.respondeParaId) : null;
    while (f && !vistos.has(f.id)) {
      vistos.add(f.id);
      const cands = chefes.filter(s => s !== ch && s.c.funcaoId === f.id);
      if (cands.length) {
        const comum = cands.filter(s => s.unidades.some(u => ch.unidades.includes(u)));
        return (comum.length ? comum : cands)[0];
      }
      f = funcoes.find(x => x.id === f.respondeParaId) || null;
    }
    return null;
  };
  chefes.forEach(ch => { ch.superior = superiorDe(ch); });
  // proteção contra ciclo: quem retorna a si mesmo passa a ser raiz
  chefes.forEach(ch => {
    const vistos = new Set([ch]);
    for (let s = ch.superior; s; s = s.superior) { if (vistos.has(s)) { ch.superior = null; break; } vistos.add(s); }
  });
  chefes.forEach(ch => { if (ch.superior) ch.superior.filhos.push(ch); });

  /* ---- equipe: cada colaborador vai para a chefia mais próxima que coordena a sua área na unidade ---- */
  const coordenadorDe = (p, unidadeId) => {
    const cands = chefes.filter(ch => ch.unidades.includes(unidadeId) && cobre(ch.coordena, p.tipoProducao));
    cands.sort((a, b) => (a.coordena === 'todos') - (b.coordena === 'todos') || b.nivel - a.nivel || ordemF(a.funcao) - ordemF(b.funcao) || cmpNome(a.c, b.c));
    return cands[0] || null;
  };
  const semChefia = new Map(); // unidadeId → [{ c, pct }]
  const membros = colaboradores.filter(c => !c.chefia).sort((a, b) => (ORDEM_TIPO[a.tipoProducao] != null ? ORDEM_TIPO[a.tipoProducao] : 2) - (ORDEM_TIPO[b.tipoProducao] != null ? ORDEM_TIPO[b.tipoProducao] : 2) || cmpNome(a, b));
  membros.forEach(m => {
    alocs(m).forEach(a => {
      const ch = coordenadorDe(m, a.unidadeId);
      const mapa = ch ? ch.equipes : semChefia;
      if (!mapa.has(a.unidadeId)) mapa.set(a.unidadeId, []);
      mapa.get(a.unidadeId).push({ c: m, pct: Number(a.percentual) });
    });
  });

  /* ---- formato de exibição ---- */
  const equipesDe = mapa => [...mapa.entries()].map(([unidadeId, membrosDaUnidade]) => ({ unidadeId, unidade: nomeUnidade(unidadeId), membros: membrosDaUnidade }));
  const paraNo = ch => ({
    id: ch.c.id, pessoa: ch.c, coordena: ch.coordena,
    unidades: ch.unidades.map(nomeUnidade),
    todasAsUnidades: unidades.length > 1 && ch.unidades.length === unidades.length,
    filhos: ch.filhos.map(paraNo),
    equipes: equipesDe(ch.equipes),
  });

  return {
    raizes: chefes.filter(ch => !ch.superior).map(paraNo),
    semChefia: equipesDe(semChefia),
    semUnidade: colaboradores.filter(c => !c.chefia && alocs(c).length === 0),
    totalChefes: chefes.length,
  };
}

/** Colaboradores por unidade (técnicos × administrativos em pessoas inteiras e nº de chefias), para as barras. */
export function pessoasPorUnidade({ unidades = [], colaboradores = [] }) {
  const alocsEm = (c, uid) => (c.alocacoes || []).filter(a => a && a.unidadeId === uid && Number(a.percentual) > 0).reduce((s, a) => s + Number(a.percentual), 0) / 100;
  return unidades.map(u => {
    let tec = 0, adm = 0, chefia = 0;
    colaboradores.forEach(c => {
      const f = alocsEm(c, u.id);
      if (f <= 0) return;
      if (c.chefia) chefia++;
      else if (c.tipoProducao === 'tecnico') tec += f;
      else if (c.tipoProducao === 'administrativo') adm += f;
    });
    return { nome: u.nome, tec, adm, chefia };
  });
}

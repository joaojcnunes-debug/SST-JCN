/* ==========================================================================
   Derivação do dimensionamento (DIM-01) — cadastro + escolhas da barra → números.

   Porte FIEL de `web/src/stores/dimensionamento.js` do repo
   joaojefferson-hash/Dimensionamento_Chabra @ e5671c2, sem Vue: as mesmas
   `computed` viraram funções puras.

   É a orquestração do motor, e a parte dela que mais importa não é óbvia:

     A FILA NÃO ZERA NA VIRADA DO ANO. Para saber o vencido acumulado de
     setembro/2026 é preciso rodar o motor em CADA ano anterior com lançamento,
     do mais antigo até 2025, carregando o saldo de um para o outro. É daí que
     saem os "88 vindo de 2025" dentro dos 510 UEP de Teresópolis. Quem chamar
     `calcular` + `fluxo` só do ano corrente obtém um número menor e plausível —
     o pior tipo de erro, porque não parece errado.

   Esta é a fonte única: a tela e o conferidor do C7 chamam as MESMAS funções.
   Um conferidor que reimplementa a orquestração prova só que eu sei repetir o
   meu próprio engano.

   Continua .js pelo mesmo motivo do motor; tipos em derivar.d.ts.
   ========================================================================== */
import Calculo from "./calculo.js";
import { colaboradoresCompletos, unidadesDoAno, pesosPorte } from "./mapear.js";

/** Parâmetros no formato do motor (com os pesos de porte embutidos). */
export function parametrosMotor(cadastro) {
  return { ...cadastro.parametros, pesosPorte: pesosPorte(cadastro.portes) };
}

/** Prazo de atendimento em meses, a partir do `prazo_dias` do cadastro. */
export function prazoMeses(cadastro) {
  return Math.max(1, Math.round((cadastro.parametros?.prazoDias ?? 60) / 30));
}

/** Anos que têm lançamento em alguma unidade, do mais antigo para o mais novo. */
export function anosComLancamento(cadastro) {
  const anos = new Set();
  (cadastro.unidades || []).forEach(u =>
    Object.entries(u.mesesPorAno || {}).forEach(([ano, meses]) => {
      if (meses && Object.keys(meses).length) anos.add(Number(ano));
    }));
  return [...anos].sort((x, y) => x - y);
}

/** Atendimentos informados de um ano: { [unidadeId]: { 1..12: { P, M, G } } }. */
export function atendidasDoAno(cadastro, ano) {
  const out = {};
  (cadastro.unidades || []).forEach(u => {
    const meses = (u.mesesPorAno || {})[ano] || {};
    Object.entries(meses).forEach(([mes, v]) => {
      const porte = v && v.atendidasPorte ? v.atendidasPorte : null;
      if (porte && Object.keys(porte).length) {
        out[u.id] = out[u.id] || {};
        out[u.id][Number(mes)] = { ...porte };
      }
    });
  });
  return out;
}

/**
 * O que ficou em aberto NÃO zera na virada do ano: a fila atravessa todos os anos
 * com lançamento, do mais antigo até o ano anterior ao escolhido, carregando as
 * coortes (e, portanto, a idade do backlog). Documento vencido em 2025 continua
 * vencido em 2026.
 */
export function filaInicial(cadastro, ano, mesAtual) {
  const anteriores = anosComLancamento(cadastro).filter(a => a < ano);
  if (!anteriores.length) return null;
  const p = parametrosMotor(cadastro);
  const prazo = prazoMeses(cadastro);
  const colaboradores = colaboradoresCompletos(cadastro.colaboradores, cadastro.funcoes, cadastro.unidades);
  const hojeAno = new Date().getFullYear();
  let carga = null;

  anteriores.forEach(a => {
    const r = Calculo.calcular({
      unidades: unidadesDoAno(cadastro.unidades, a),
      colaboradores,
      parametros: p,
      simulacoes: [],
      janela: { de: 0, ate: 11 },
      ano: a,
    });
    // ano já encerrado: tudo é passado; ano corrente: até o mês escolhido na barra
    const mesAtualDoAno = a < hojeAno ? 12 : a === hojeAno ? mesAtual : 0;
    const f = Calculo.fluxo(r, {
      mesAtual: mesAtualDoAno,
      prazoMeses: prazo,
      filaInicial: carga,
      atendidas: atendidasDoAno(cadastro, a),
      parametros: p,
      ano: a,
    });
    const out = {};
    f.unidades.forEach(u => { out[u.id] = u.resumo.filaFinal; });
    carga = out;
  });
  return carga;
}

/**
 * Tudo que a tela do Headcount precisa, em uma chamada.
 *   unidadeId = '' ou null ⇒ o TOTAL (o motor soma por unidade; a folga de uma não
 *   cobre a falta de outra).
 */
export function derivarHeadcount(cadastro, { ano, mesAtual, unidadeId = "", prazos = [1, 2, 3, 6, 12] }) {
  const p = parametrosMotor(cadastro);
  const colaboradores = colaboradoresCompletos(cadastro.colaboradores, cadastro.funcoes, cadastro.unidades);

  const resultado = Calculo.calcular({
    unidades: unidadesDoAno(cadastro.unidades, ano),
    colaboradores,
    parametros: p,
    janela: { de: 0, ate: 11 },
    ano,
  });

  const fluxo = Calculo.fluxo(resultado, {
    mesAtual,
    prazoMeses: prazoMeses(cadastro),
    filaInicial: filaInicial(cadastro, ano, mesAtual),
    atendidas: atendidasDoAno(cadastro, ano),
    parametros: p,
    ano,
  });

  const valida = unidadeId && (cadastro.unidades || []).some(u => u.id === unidadeId) ? unidadeId : "";
  const alvo = valida ? fluxo.unidades.find(u => u.id === valida) : fluxo.total;
  const titulo = valida
    ? (cadastro.unidades.find(u => u.id === valida) || {}).nome || ""
    : "Todas as unidades";

  return {
    resultado,
    fluxo,
    alvo,
    titulo,
    headcount: alvo ? Calculo.headcount(alvo, { mes: mesAtual, prazos }) : null,
    // Quebra por unidade, tirada do MESMO `fluxo` que produziu o total. Poderia ser uma
    // segunda chamada de `derivarHeadcount` por unidade, e aí os dois números viriam de
    // execuções diferentes do motor — bastaria alguém mudar o cadastro no meio para a
    // soma das partes não fechar com o todo. Aqui fecha por construção.
    //
    // Cuidado ao somar: a soma dos `deficit` das unidades NÃO é o `deficit` do total. Cada
    // um é arredondado para cima (`ceil`) na sua conta, e a folga de uma unidade não cobre
    // a falta de outra. O total continua sendo a verdade da diretoria; a quebra responde
    // "onde".
    porUnidade: (fluxo.unidades || []).map(u => ({
      id: u.id,
      nome: u.nome,
      headcount: Calculo.headcount(u, { mes: mesAtual, prazos }),
    })),
  };
}

/**
 * A equipe alocada no alvo, no mês da barra — a lista de conferência da tela:
 * gente de verdade, com alocação, presença e o que cada um equivale.
 */
export function equipeDoMes(cadastro, { ano, mesAtual, unidadeId = "" }) {
  const p = parametrosMotor(cadastro);
  const completos = colaboradoresCompletos(cadastro.colaboradores, cadastro.funcoes, cadastro.unidades);
  const naUnidade = unidadeId
    ? completos.filter(c => (c.alocacoes || []).some(a => a.unidadeId === unidadeId))
    : completos.filter(c => (c.alocacoes || []).length > 0);

  return naUnidade.map(c => {
    const aloc = unidadeId
      ? (c.alocacoes.find(a => a.unidadeId === unidadeId) || {}).percentual || 0
      : (c.alocacoes || []).reduce((s, a) => s + (a.percentual || 0), 0);
    const presenca = Calculo.presencaNoMes(c, ano, mesAtual);
    const produz = c.tipoProducao === "tecnico" || c.tipoProducao === "administrativo";
    return {
      id: c.id,
      nome: c.nome,
      funcao: c.funcao,
      tipoProducao: c.tipoProducao,
      chefia: c.chefia,
      alocacao: aloc,
      presenca,
      ritmo: Calculo.ritmoTexto(c),
      // "equivale a" = fração de uma pessoa integral naquele mês
      equivalente: produz ? (aloc / 100) * presenca : 0,
      // v257 — marcado a mão: sai do FTE de propósito. `semProducao` logo abaixo é o
      // OUTRO caso, o do cadastro incompleto; marcar a pessoa desliga ESSE campo (e só
      // ele) porque passa a existir uma resposta ("é gestão", "não tem produção diária")
      // onde antes havia uma lacuna. Os dois nunca são verdade ao mesmo tempo: `produz`
      // é false para quem está fora, e `semProducao` exige `produz`.
      //
      // Atenção ao que NÃO é desligado: `avisos.colabSemProducao`, do motor, passa a
      // LISTAR os marcados (lá o filtro é `!FUNCOES.includes(tipoProducao)`). Hoje é
      // inerte — nenhuma tela lê `avisos` do motor —, mas quem for exibir esse aviso um
      // dia precisa excluir `foraDoCalculo` antes, ou vai chamar de lacuna o que é
      // resposta.
      foraDoCalculo: c.foraDoCalculo === true,
      motivoFora: c.motivoFora || "",
      semProducao: produz && c.tipoProducao === "tecnico"
        ? c.inspecoesDia <= 0 && c.relatoriosDia <= 0
        : produz && c.empresasDia <= 0,
      parametros: p,
    };
  });
}

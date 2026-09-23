/**
 * Considerações Finais e Encaminhamentos do laudo AEP.
 *
 * O capítulo `aep_consideracoes` é do SISTEMA e sempre se anunciou como
 * "gerado automaticamente", mas o único conteúdo que ele tinha era o campo de
 * texto livre "Considerações finais" (tela Dados da Análise). Com o campo em
 * branco — o caso comum — a seção sumia inteira: do corpo, do sumário e da
 * numeração, na tela E no PDF, e o laudo terminava sem conclusão nenhuma.
 *
 * Aqui mora a conclusão automática, montada a partir do que o próprio laudo já
 * afirma (setores avaliados, expostos, riscos classificados e escalonamento
 * para AET). Módulo PURO: sem "use client" e sem hook, porque roda nos dois
 * lados — na prévia da tela e dentro do template do Puppeteer.
 *
 * Nada aqui sobrepõe o que o técnico escreveu: havendo texto no campo, ele é o
 * conteúdo da seção, exatamente como antes.
 */

/** Recorte mínimo do setor — casa com `AepSetor` (tela) e `AepSetorLocal` (PDF). */
export interface SetorParaConsideracoes {
  nome_setor?: string | null;
  cargo?: string | null;
  qtd_expostos?: number | null;
  necessita_aet?: boolean | null;
  riscos?: { classificacao_risco?: string | null }[] | null;
}

/** Da mais grave para a mais leve — mesma ordem usada na triagem por setor. */
const ORDEM_RISCO = ["Crítico", "Alto", "Moderado", "De Atenção", "Trivial"];

/** "a, b e c" — vírgula até o penúltimo, "e" antes do último. */
function listar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function rotuloSetor(s: SetorParaConsideracoes): string {
  const nome = (s.nome_setor ?? "").trim() || "Setor sem nome";
  const cargo = (s.cargo ?? "").trim();
  return cargo ? `${nome} — ${cargo}` : nome;
}

export interface DadosConsideracoesAep {
  setores: SetorParaConsideracoes[];
  empresaNome?: string | null;
  /** Validade JÁ formatada em dd/mm/aaaa (vem de `valoresVars.data_validade`). */
  dataValidadeBR?: string | null;
}

/**
 * Conclusão automática do AEP, em parágrafos. Só afirma o que está no laudo:
 * contagens, nomes de setor e classificações já registradas — nada é inferido.
 */
export function gerarConsideracoesAep({
  setores,
  empresaNome,
  dataValidadeBR,
}: DadosConsideracoesAep): string[] {
  const paragrafos: string[] = [];

  const n = setores.length;
  const expostos = setores.reduce(
    (acc, s) => acc + (typeof s.qtd_expostos === "number" ? s.qtd_expostos : 0),
    0,
  );
  const empresa = (empresaNome ?? "").trim();

  // 1) Escopo do que foi avaliado.
  const alvo = n === 1 ? "1 setor/função" : `${n} setores/funções`;
  paragrafos.push(
    n === 0
      ? `Esta Análise Ergonômica Preliminar (AEP)${empresa ? ` da ${empresa}` : ""} não teve setores registrados até a emissão deste documento. A triagem ergonômica das dimensões física, cognitiva e organizacional do trabalho, prevista na NR-17, deve ser concluída antes que o documento seja utilizado como base para o gerenciamento de riscos.`
      : `Esta Análise Ergonômica Preliminar (AEP) avaliou ${alvo}${empresa ? ` da ${empresa}` : ""}${
          expostos > 0
            ? `, abrangendo ${expostos} ${expostos === 1 ? "trabalhador" : "trabalhadores"}`
            : ""
        }, por meio de triagem das dimensões física, cognitiva e organizacional do trabalho, conforme a NR-17 e o gerenciamento de riscos ocupacionais previsto na NR-01.`,
  );

  if (n === 0) return paragrafos;

  // 2) Riscos registrados, por classificação (só as classes que existem).
  const porClasse = new Map<string, number>();
  let totalRiscos = 0;
  for (const s of setores) {
    for (const r of s.riscos ?? []) {
      const c = (r?.classificacao_risco ?? "").trim();
      if (!c) continue;
      porClasse.set(c, (porClasse.get(c) ?? 0) + 1);
      totalRiscos += 1;
    }
  }
  if (totalRiscos > 0) {
    const classes = [...porClasse.entries()].sort(
      (a, b) => ORDEM_RISCO.indexOf(a[0]) - ORDEM_RISCO.indexOf(b[0]),
    );
    // "sendo 2 classificados como Alto, 5 como Moderado" — o particípio só no
    // primeiro item, para a frase não repetir "classificados" a cada classe.
    const detalhe = listar(
      classes.map(([c, q], i) =>
        i === 0 ? `${q} ${q === 1 ? "classificado" : "classificados"} como ${c}` : `${q} como ${c}`,
      ),
    );
    const ondeRiscos = n === 1 ? "no setor avaliado" : "nos setores avaliados";
    paragrafos.push(
      totalRiscos === 1
        ? `Foi registrado 1 fator de risco ergonômico ${ondeRiscos}, classificado como ${classes[0][0]}. A medida preventiva indicada para ele consta na triagem por setor deste documento.`
        : `Foram registrados ${totalRiscos} fatores de risco ergonômico ${ondeRiscos}, sendo ${detalhe}. As medidas preventivas indicadas para cada fator constam na triagem por setor deste documento.`,
    );
  }

  // 3) Escalonamento para AET completa — é o desfecho técnico do laudo.
  const comAet = setores.filter((s) => s.necessita_aet);
  if (comAet.length > 0) {
    const m = comAet.length;
    paragrafos.push(
      `Dos setores avaliados, ${m === 1 ? "1 apresentou" : `${m} apresentaram`} condições que indicam a necessidade de aprofundamento por meio de Análise Ergonômica do Trabalho (AET) completa: ${listar(
        comAet.map(rotuloSetor),
      )}. Recomenda-se a elaboração da AET ${
        m === 1 ? "nesse setor" : "nesses setores"
      }, com avaliação postural, análise biomecânica e medições complementares, e a incorporação das medidas resultantes ao Plano de Ação do PGR.`,
    );
  } else {
    paragrafos.push(
      "Nenhum dos setores avaliados apresentou, nesta triagem, indicadores que justifiquem a elaboração de Análise Ergonômica do Trabalho (AET) completa, devendo ser mantidas as medidas de controle já existentes e o monitoramento periódico das condições de trabalho.",
    );
  }

  // 4) Encaminhamentos.
  paragrafos.push(
    `Como encaminhamentos, recomenda-se: (i) incorporar as recomendações registradas em cada setor ao Plano de Ação do PGR (NR-01), com responsáveis e prazos definidos; (ii) dar ciência do conteúdo desta análise aos trabalhadores e às lideranças dos setores avaliados; (iii) acompanhar a implantação das medidas e verificar a eficácia delas; (iv) revisar esta análise sempre que houver alteração de processo, layout, mobiliário, ritmo ou jornada de trabalho, ou o surgimento de queixas e agravos relacionados ao trabalho${
      (dataValidadeBR ?? "").trim() ? `, e no máximo até ${(dataValidadeBR ?? "").trim()}` : ""
    }.`,
  );

  return paragrafos;
}

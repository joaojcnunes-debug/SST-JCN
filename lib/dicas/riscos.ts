/**
 * Dicas de preenchimento do formulário de Risco da inspeção (Etapa 7, lote 7.1, do
 * docs/plano-skin-viva-jcn.md). Mesmas regras de lib/dicas/empresas.ts: frase curta e prática,
 * sem inventar exigência legal. Revisadas pelo João em 03/11/2026.
 */
export const DICAS_RISCO = {
  tipo_risco: "Escolha o grupo do risco. Trocar o tipo limpa o modelo e a triagem já escolhidos.",
  setores: "Marque um ou mais setores. Com vários, o sistema grava um risco para cada setor.",
  agente:
    "Escolha um modelo da lista para trazer o kit (EPIs, medidas, perguntas) ou digite um agente novo.",
  fonte_geradora: "O que produz o risco: máquina, processo ou tarefa. Pode ter mais de uma.",
  cargo:
    "Deixe em branco para valer para todos os cargos do setor. A lista mostra os cargos do 1º setor marcado.",
  meio_propagacao: "Por onde o agente chega ao trabalhador. Marque todos que valem.",
  situacao:
    "Controlada: as medidas atuais bastam. Não controlada: ainda falta medida. Em avaliação: análise não concluída.",
  tempo_exposicao: "Com que frequência há exposição: ocasional, intermitente, habitual ou permanente.",
  tecnica:
    "Qualitativa: por observação. Quantitativa: com medição. Semi-quantitativa: estimativa com algum dado medido.",
  matriz: "Matriz usada no cálculo. Em \"Padrão\", vale a matriz ativa das Configurações.",
  probabilidade: "Chance de o dano acontecer, na escala da matriz escolhida.",
  severidade: "Gravidade do dano se acontecer, na escala da matriz escolhida.",
  nivel:
    "Sai do cruzamento probabilidade × severidade; não se edita. Alto e Muito Alto podem ir ao Plano de Ação.",
  necessita_medicao: "\"Sim\" quando só a medição com equipamento confirma a exposição.",
  qual_medicao: "Ex.: dosimetria de ruído, avaliação de calor.",
  motivo_medicao: "Por que a medição é necessária (ou por que não é).",
  nivel_medido: "Valor medido com a unidade (ex.: 87 dB(A)). Em branco se não houve medição.",
  limite_tolerancia: "Limite do agente, com a unidade, para comparar com o valor medido.",
  insalubridade: "Grau (mínimo, médio, máximo) ou percentual, se houver enquadramento.",
  numero_cas: "Registro do produto químico, como está na FDS (ex.: 64-17-5).",
  via_absorcao: "Respiratória, cutânea ou digestiva.",
  concentracao_quimico: "Quanto do produto chega ao trabalhador, se for conhecido.",
  uso_processo: "Onde e como o produto é usado (ex.: limpeza de peças, diluição).",
  periculosidade: "Enquadramento, se houver (ex.: inflamáveis). Em branco se não se aplica.",
  foto_fds: "Foto do rótulo ou da Ficha de Dados de Segurança do produto.",
  agente_biologico: "Vírus, bactéria, fungo, parasita… e qual, se souber.",
  fator_ergonomico: "Escolha da lista ou escreva (ex.: postura, repetição, levantamento de peso).",
  fator_psicossocial: "Escolha da lista ou escreva (ex.: sobrecarga, pressão por prazo).",
  pontuacao_iapat: "Nota obtida na avaliação IAPAT.",
  observacoes: "O que não coube nos campos acima e precisa constar.",
} as const;

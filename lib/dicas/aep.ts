/**
 * Dicas de preenchimento do módulo AEP (Etapa 7, lote 7.5, do docs/plano-skin-viva-jcn.md):
 * Nova análise, Dados, Checklist de gestão, Setores (coleta, fatores, inventário e análise).
 * Mesmas regras de lib/dicas/empresas.ts; cada afirmação conferida no laudo/PDF. Revisadas pelo
 * João em 03/11/2026.
 */
export const DICAS_AEP_IDENTIFICACAO = {
  empresa: "Escolha a empresa da análise. O endereço vem do cadastro dela e as inspeções dela aparecem abaixo.",
  // A Identificação do PDF usa o endereço do cadastro; este só entra na variável {{endereco_empresa}}.
  endereco: "Endereço usado nos textos padrão do laudo. Vem do cadastro (ou de Puxar do cadastro) e pode ser editado.",
  responsavel: "Escolha o profissional da lista: título e registro vêm juntos. O nome sai na assinatura do laudo.",
  titulo: "Vem do cargo do profissional. Sai na assinatura e define o prefixo do registro (ex.: médico sai com CRM).",
  registro: "Número do registro no conselho. Vem do cadastro e sai na assinatura do PDF.",
  data_elaboracao: "Data em que a análise foi feita. Sai na identificação e na capa do laudo.",
  validade: "Até quando a análise vale. Sai na identificação do laudo e na conclusão automática.",
} as const;

export const DICAS_AEP_GESTAO = {
  respondido_com: "Quem respondeu o checklist (ex.: RH, gerente). Grave no Salvar desta aba.",
} as const;

export const DICAS_AEP_SETOR = {
  nome_setor: "Nome do setor como a empresa usa. Com um nome da lista, aparecem os cargos cadastrados. É o título no laudo.",
  unidade: "Unidade ou filial onde fica o setor. Sai no laudo junto ao nome do setor.",
  ghe: "Grupo Homogêneo de Exposição do setor. Sai no laudo e na planilha do inventário.",
  jornada: "Horário de trabalho do setor. Sai no laudo e é enviado à IA do parecer.",
  qtd_expostos: "Total de expostos no setor; não soma sozinho com os cargos. Sai no laudo e vai para a IA.",
  cargos: "Inclua cada cargo com atividade e quantidade. Saem no laudo e montam os Trabalhadores consultados.",
  metodo_coleta: "Marque como os dados foram coletados; pode marcar mais de um. Sai no laudo, na ficha do setor.",
  consultados: "Montado pelos cargos; pode editar, mas mudar um cargo refaz o texto. Sai no laudo.",
  parecer_tecnico: "Conclusão técnica do setor; sai no laudo. O Gerar IA troca o texto atual por um rascunho do setor.",
  recomendacoes: "Medidas sugeridas para o setor; saem no laudo. O Gerar IA troca o texto atual por um rascunho.",
} as const;

export const DICAS_AEP_COLETA = {
  abordados: "Quantos trabalhadores você abordou no setor. Entra na frase de condições da coleta no laudo.",
  participaram: "Quantos aceitaram participar; não pode passar dos abordados. Sai no laudo nas condições da coleta.",
  recusas: "Quantas pessoas recusaram ou responderam de forma evasiva. Sai no laudo nas condições da coleta.",
  lideranca: "Marque se a chefia estava junto durante a coleta. O laudo registra isso nas condições da coleta.",
  inibicao: "Marque o que indicou medo de falar. Sai no laudo e faz o sistema recomendar o DRPS/Questionário.",
} as const;

export const DICAS_AEP_FATOR = {
  sinais: "Marque o que viu ou ouviu. Mais sinais, maior a probabilidade sugerida na matriz. Saem no laudo.",
  probabilidade: "Vem sugerida pelos sinais; troque só com motivo. Fica travada sem sinais. Sai no laudo com o nível.",
  severidade: "Começa no padrão do fator; ajuste se preciso. Com a probabilidade, define o nível e a indicação de AET.",
  motivo_ni: "Obrigatório para salvar. Sai em Limitações da avaliação; \"Receio\" faz o sistema recomendar o DRPS.",
  origem_evidencia: "Marque cada origem: 1 tipo dá confiança Baixa, 2 Média, 3 ou mais Alta. Sai no laudo com o fator.",
} as const;

export const DICAS_AEP_INVENTARIO = {
  perigo: "Escolha ou digite o perigo. Se preenchido, vira o título do fator no detalhamento do laudo.",
  fonte: "O que gera o risco. As lacunas do checklist de gestão entram sozinhas. Sai no laudo.",
  meio: "Como o risco chega ao trabalhador. Vai para a planilha do inventário, não para o texto do laudo.",
  situacao: "Situação em que a exposição acontece. Vai para a planilha do inventário, não para o laudo.",
  tempo: "Por quanto tempo há exposição. Vai para a planilha do inventário, não para o texto do laudo.",
  medida: "Os itens evidenciados no checklist de gestão entram sozinhos. Vazio, o laudo diz que não há medidas.",
  medida_recomendada: "O que a empresa ainda precisa implantar. Sai no laudo e é enviada à IA como ação escolhida.",
  descricao: "Texto que descreve o risco do fator. Sai no laudo, no detalhamento do fator.",
  danos: "Danos que o fator pode causar à saúde. Saem no laudo, no detalhamento do fator.",
  sugestao: "Ideias de encaminhamento do fator. Vão para a IA do parecer e para a planilha, não direto ao laudo.",
  acao: "Ações escolhidas para o fator. A IA usa no parecer e elas saem na planilha do inventário.",
} as const;

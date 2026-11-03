/**
 * Dicas de preenchimento do módulo AET (Etapa 7, lote 7.4, do docs/plano-skin-viva-jcn.md):
 * Novo laudo, Dados, QPS, Setores, Fatores PSI, Análise e Plano de Ação. Mesmas regras de
 * lib/dicas/empresas.ts; cada afirmação conferida no laudo/PDF. Revisadas pelo João em 03/11/2026.
 * As Seções 2–12 da aba Dados ficam sem dica: hoje o texto delas não chega ao laudo.
 */
export const DICAS_AET_IDENTIFICACAO = {
  empresa: "Escolha a empresa do laudo. Os outros campos aparecem depois, e o endereço vem do cadastro dela.",
  responsavel: "Escolha o profissional da lista: título e registro são preenchidos sozinhos e saem na assinatura do PDF.",
  titulo: "Vem do cargo do profissional. Define o prefixo do registro na assinatura do PDF (ex.: médico sai com CRM).",
  registro: "Número do conselho do profissional. Vem do cadastro e sai na assinatura do PDF.",
  data_elaboracao: "Data em que o laudo foi feito. Sai na identificação da empresa no laudo.",
  validade: "Até quando o laudo vale. Sai no PDF e, em branco, o laudo mostra um aviso na tela.",
  status: "Deixe Rascunho enquanto edita e Concluído quando estiver pronto. Aparece na lista, no dashboard e no laudo.",
} as const;

export const DICAS_AET_QPS = {
  respondentes: "Quantas pessoas responderam ao QPS. Grave no botão Salvar Dados QPS: o Salvar do topo não grava este bloco.",
  elegiveis: "Quantas pessoas poderiam responder. Com os respondentes, calcula a % de adesão, que sai no laudo.",
  adesao: "Calculada sozinha: respondentes ÷ elegíveis. Fica verde a partir de 70%.",
  inicio: "Primeiro dia de aplicação do questionário. Sai no laudo como período da aplicação.",
  fim: "Último dia de aplicação do questionário. Sai no laudo junto com a data de início.",
  forma: "Como o questionário foi aplicado: papel, tablet ou híbrido. Sai no laudo como Modo de Aplicação.",
  tecnico: "Quem conduziu a aplicação do questionário. Sai no laudo nos dados da aplicação.",
  observacao: "Contexto da aplicação que ajude a ler os resultados. Sai no laudo como Observações.",
} as const;

export const DICAS_AET_SETOR = {
  nome: "Nome do setor como a empresa usa. Vira o título do setor no laudo e no plano de ação.",
  cargos: "Adicione cada cargo do setor com a descrição da atividade. O nome e a descrição saem no laudo.",
  maquinas: "Digite cada máquina ou equipamento e tecle Enter. Saem no laudo, na ficha do setor.",
  atividade: "Resuma o que o setor faz no dia a dia. Sai no laudo e é usada pela IA no parecer e nas recomendações.",
  risco_tipo: "Grupo do agente: Acidentes, Ergonômico, Físico, Químico ou Biológico. Sai na tabela de riscos do laudo.",
  risco_nome: "Nome do agente ou risco avaliado. Sai na coluna Agente / Risco do laudo.",
  risco_intensidade: "Valor medido ou concentração do agente (começa como N/A). Sai na tabela de riscos do laudo.",
  risco_tecnica: "Como o risco foi avaliado (começa como Qualitativa). Sai na coluna Técnica / Metodologia do laudo.",
  risco_epi_ca: "Número do CA do EPI usado contra o risco (começa como N/A). Sai na tabela de riscos do laudo.",
  risco_epi_eficaz: "Diga se o EPI é eficaz contra o risco (texto livre, começa como N/A). Sai na tabela do laudo.",
  risco_classificacao: "Grau do risco, de Trivial a Crítico. Muda a cor no laudo, e o maior grau vai para a IA das considerações.",
  fotos: "Até 6 fotos do posto. A foto só sobe quando você salva, e sai no registro fotográfico do laudo.",
  parecer_tecnico: "Conclusão técnica sobre o setor. Sai no laudo, e o Gerar com IA cria um rascunho com os dados do setor.",
  recomendacoes: "Medidas sugeridas para o setor. Saem no laudo e servem de base para as ações do Plano de Ação.",
  demais_condicoes: "Outras condições observadas no setor. Sai no laudo junto com o parecer e as recomendações.",
} as const;

export const DICAS_AET_FATORES = {
  classificacao_f13: "Zona do fator 13, escolhida à mão com base no PGR. Grave no botão Salvar F13. Sai no laudo.",
  observacao: "Análise do fator neste setor. Só grava no botão Salvar do fator e sai no laudo quando preenchida.",
  consideracoes: "Fechamento do laudo. Grave no botão Salvar Considerações; em branco, a seção não sai no laudo.",
} as const;

export const DICAS_AET_PLANO = {
  oque: "Descreva a ação em uma frase. Grava ao sair do campo e vira o título da ação no laudo.",
  porque: "Motivo da ação, ligado ao risco ou à recomendação do setor. Grava ao sair do campo e sai no laudo.",
  como: "Passos ou método para executar a ação. Grava ao sair do campo e sai no laudo.",
  onde: "Local da ação. Se ficar vazio, a IA usa o nome do setor.",
  quem: "Pessoa ou área responsável pela ação. Aparece na linha da ação e no laudo.",
  quando: "Prazo. Escrito como \"30 dias\", vira data ao enviar ao PGR; outro texto vai para as observações.",
  quanto: "Custo estimado da ação. Grava ao sair do campo e sai no laudo.",
  prioridade: "De Baixa a Crítica, grava na hora. A IA só troca a prioridade se ela ainda estiver em Média.",
  setor: "Move a ação para outro setor do laudo ou para as ações gerais. O plano sai agrupado assim no laudo.",
} as const;

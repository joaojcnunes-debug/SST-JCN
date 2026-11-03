/**
 * Dicas de preenchimento do Questionário psicossocial (QPS) (Etapa 7, lote 7.7, do
 * docs/plano-skin-viva-jcn.md): Nova aplicação, Aplicação, Análise, Plano anual, Monitoramento,
 * Revisão, Plano de ação 5W2H, Respondentes e Tipos. Mesmas regras de lib/dicas/empresas.ts;
 * cada afirmação conferida no laudo/PDF. Revisadas pelo João em 03/11/2026.
 * Plano anual e Revisão usam os mesmos textos do DRPS (DICAS_DRPS_PLANO_ANUAL / _REVISAO).
 */
export const DICAS_QPS_APLICACAO = {
  empresa: "Escolha a empresa da aplicação ou cadastre em Nova Empresa; a empresa criada já volta selecionada.",
  tipo: "Define as categorias, as perguntas e a escala. Depois de criada, a aplicação não troca de tipo.",
  titulo: "Nome para achar a aplicação nas listas. Entra no laudo só onde o texto padrão usar {{titulo_aplicacao}}.",
  responsavel: "Psicólogo do time psicossocial ou nome digitado. Sai no laudo e na assinatura; o CRP vem do cadastro dele.",
  inicio: "Início da coleta, impresso na Metodologia do laudo. Em branco, vale a data da 1ª resposta importada.",
  fim: "Fim da coleta, impresso na Metodologia do laudo. Em branco, vale a data da última resposta importada.",
  unidade: "Filial do cliente, quando a empresa tem várias. Se preenchida, sai na identificação dos setores no laudo.",
  previstos: "Quantos deveriam responder. Com ele o laudo mostra a taxa de participação; vazio, essa frase não sai.",
  data_elaboracao: "Data em que o laudo foi elaborado. Sai na identificação de cada setor do laudo.",
  data_conclusao: "Data impressa na capa do laudo. É carimbada ao concluir; ao reconcluir, o sistema pergunta qual data manter.",
} as const;

export const DICAS_QPS_ANALISE = {
  fontes: "Escolha ou digite as fontes da categoria; fonte nova entra no catálogo. Grave em Salvar agravos e medidas.",
  conclusao: "Grava ao sair do campo. No consolidado vira a Conclusão Técnica Consolidada do laudo; vazia, a seção não sai.",
} as const;

export const DICAS_QPS_MONITORAMENTO = {
  data_intervencao: "Data em que a intervenção foi feita no setor. Grava na hora e sai no Monitoramento do laudo.",
  responsavel: "Quem acompanha a categoria no setor. Grava ao sair do campo e sai no Monitoramento do laudo.",
  status: "Pendente, Em Andamento, Concluído ou Cancelado. Grava na hora e sai no Monitoramento do laudo.",
  proxima: "Data da próxima reavaliação da categoria. Grava na hora e sai no Monitoramento do laudo.",
} as const;

// O capítulo 5W2H do laudo do QPS foi desligado na v243: as dicas não prometem o PDF.
export const DICAS_QPS_5W2H = {
  oque: "Escolha do catálogo ou digite a ação. A ação do catálogo libera as opções do campo Como.",
  porque: "Motivo ou objetivo da ação, a coluna Por quê do 5W2H.",
  onde: "Marque os setores da aplicação ou Todos os setores. A lista vem dos respondentes importados.",
  quando: "Marque os meses de execução. Ficam gravados em ordem de mês na coluna Quando.",
  quem: "Responsável pela ação, a coluna Quem do 5W2H.",
  quanto: "Custo estimado, em texto livre, a coluna Quanto custa do 5W2H.",
  como: "Escolha as formas do catálogo da ação ou digite outra. Ficam separadas por vírgula na coluna Como.",
  status: "Grave no Salvar da ação. Só sai no laudo se o capítulo Plano de Ação 5W2H for ligado no Texto Padrão.",
} as const;

export const DICAS_QPS_RESPONDENTES = {
  importar: "Importar soma aos já importados. O Modelo Excel e o Guia Forms trazem a ordem certa das perguntas.",
  setor: "Setor do respondente; escolha um já usado para não duplicar. Cada setor vira um bloco no laudo.",
  cargo: "Função do respondente. Sai na coluna Funções do setor no laudo; em branco não entra.",
  lote: "Rótulo livre para agrupar (ex.: turno). Só aparece na lista desta tela, não no laudo.",
} as const;

export const DICAS_QPS_TIPO = {
  nome: "Nome do questionário. Aparece na escolha da Nova Aplicação e vira {{tipo_questionario}} no laudo.",
  descricao: "Resumo do questionário. Aparece abaixo do tipo na Nova Aplicação e no Word do tipo.",
  instrucoes: "Orientação ao respondente. Vai no Guia Forms, no modelo Excel e no Word; copie para o seu formulário.",
  escala_min: "Menor valor da resposta, igual ao formulário (ex.: 0 numa escala de 0 a 4). Valor fora da escala é descartado.",
  escala_max: "Maior valor da resposta, igual ao formulário. Com a mínima, define a conta da gravidade e a checagem da importação.",
  categorias: "Cada categoria vira uma linha de Fatores de Risco na Análise e no laudo, com a gravidade das perguntas dela.",
  perguntas: "Cada pergunta entra na média da categoria. Escolha a lógica certa: invertida vira a pontuação antes da conta.",
} as const;

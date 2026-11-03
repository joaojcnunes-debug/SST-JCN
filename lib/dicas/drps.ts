/**
 * Dicas de preenchimento do DRPS (Etapa 7, lote 7.6, do docs/plano-skin-viva-jcn.md):
 * Novo, Metadados, barra do Dashboard/Análise, Análise, Dados, Conclusão geral, Plano anual,
 * Plano de ação 5W2H, Monitoramento, Revisão e Capa. Mesmas regras de lib/dicas/empresas.ts;
 * cada afirmação conferida no laudo/PDF. Revisadas pelo João em 03/11/2026.
 * Status e Registro ficaram neutros de propósito: a data de conclusão e a sigla do registro
 * no PDF entram no PR de correções do DRPS/QPS.
 */
export const DICAS_DRPS_IDENTIFICACAO = {
  empresa: "Escolha a empresa do diagnóstico. O número da revisão sai sozinho: a última revisão da empresa mais um.",
  data_elaboracao: "Data em que o diagnóstico foi feito. Sai na identificação de cada setor do laudo e na tela de Validades.",
  responsavel: "Escolha o psicólogo da lista: o registro vem junto. O nome sai no cabeçalho de cada setor e na assinatura do laudo.",
  registro: "Número do registro no conselho; vem do cadastro do profissional. Sai na assinatura do laudo.",
  status: "Rascunho, Em andamento, Concluído ou Enviado p/ cliente. Grave no Salvar desta tela.",
  validade: "Até quando o diagnóstico vale. Não sai no laudo: alimenta a tela de Validades e os avisos de vencimento.",
  cnpj: "Grava no cadastro da empresa, não só neste relatório. Sai na identificação de cada setor do laudo.",
} as const;

export const DICAS_DRPS_ANALISE = {
  fontes: "Escolha ou digite as fontes do tópico; fonte nova entra no catálogo. Grave no Salvar do topo. Sai no laudo.",
  conclusao_setor: "Texto do psicólogo para o setor; grava ao sair do campo. Gerar com IA troca o texto e já grava. Sai no laudo.",
  colar_dados: "Cole do Sheets com o cabeçalho ou use Upload CSV. Importar soma aos já importados; para refazer, use Remover tudo.",
  conclusao_geral: "Grave em Salvar conclusão geral. O Gerar com IA troca o texto e já grava. Sai no laudo como Conclusão Geral.",
} as const;

export const DICAS_DRPS_PLANO_ANUAL = {
  ano: "Cada ano tem um plano separado. O laudo imprime só o plano do ano atual; salve antes de trocar o ano.",
  mes: "Marque os meses em que a ação será feita. Sai com ✓ no cronograma do laudo. Grave no Salvar Plano.",
  responsavel: "Quem conduz a ação. Sai na coluna Responsável do cronograma do laudo. Grave no Salvar Plano.",
} as const;

export const DICAS_DRPS_5W2H = {
  oque: "Escolha do catálogo ou digite a ação. A ação do catálogo libera as opções do campo Como.",
  porque: "Motivo ou objetivo da ação. Sai na coluna Por quê do 5W2H no laudo.",
  onde: "Marque os setores avaliados ou Todos os setores. A lista vem dos respondentes importados.",
  quando: "Marque os meses de execução. Saem na coluna Quando do 5W2H, em ordem de mês.",
  quem: "Responsável pela ação. Sai na coluna Quem do 5W2H no laudo.",
  quanto: "Custo estimado, em texto livre. Sai na coluna Quanto custa do 5W2H no laudo.",
  como: "Escolha as formas do catálogo da ação ou digite outra. Saem separadas por vírgula na coluna Como.",
  status: "Pendente, Em andamento ou Concluída. Cada ação grava no seu botão Salvar; ação vazia não sai no laudo.",
} as const;

export const DICAS_DRPS_MONITORAMENTO = {
  data_intervencao: "Data em que a intervenção foi feita no setor. Grava na hora e sai no Monitoramento do laudo.",
  responsavel: "Quem acompanha o tópico no setor. Grava ao sair do campo e sai no Monitoramento do laudo.",
  status: "Grava na hora. Concluído conta inteiro e Em Andamento conta meio no percentual do Painel de Gestão.",
  proxima: "Data da próxima reavaliação do tópico. Grava na hora, sai no laudo e aparece no Painel de Gestão.",
} as const;

export const DICAS_DRPS_REVISAO = {
  acoes: "Marque o que já é feito. Sai no laudo com caixa marcada ou vazia. Grave no Salvar Revisão.",
  equipe: "Marque as áreas que participam. Sai no laudo como Equipe técnica designada. Grave no Salvar Revisão.",
  anotacoes: "Registros e próximos passos. Só sai no laudo se preenchido, como Anotações da coordenação.",
} as const;

export const DICAS_CAPA = {
  tamanho: "Tamanho da letra, de 8 a 120. A prévia é menor que a folha, então no PDF o texto fica proporcionalmente menor.",
  largura: "Largura da caixa em % da página, de 5 a 100. O texto quebra linha dentro dessa largura.",
  cor: "Cor do texto da caixa. Sai igual na capa do PDF.",
} as const;

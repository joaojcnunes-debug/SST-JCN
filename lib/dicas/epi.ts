/**
 * Dicas de preenchimento do módulo EPI (Etapa 7, lote 7.3, do docs/plano-skin-viva-jcn.md):
 * Catálogo, Estoque, Entregas, Colaboradores, Transferências e Assinatura. Mesmas regras de
 * lib/dicas/empresas.ts. Revisadas pelo João em 03/11/2026.
 */
export const DICAS_EPI_CATALOGO = {
  nome: "Nome do EPI como vai sair na ficha de entrega (ex.: luva nitrílica tam. M).",
  tipo: "EPI: de uso individual. EPC: proteção coletiva.",
  fabricante: "Quem fabrica o equipamento, como na embalagem.",
  ca: "Certificado de Aprovação do EPI. Vai junto na ficha de entrega.",
  ca_validade: "Data de validade do CA. A lista do catálogo avisa quando ele vence.",
  unidade: "Como o item é contado: un, par ou caixa, por exemplo.",
  estoque_minimo: "Abaixo desta quantidade, o item aparece destacado como estoque baixo.",
  observacoes: "Detalhes do item (tamanho, modelo, uso).",
} as const;

export const DICAS_EPI_ESTOQUE = {
  epi: "Item do catálogo que entra ou sai do estoque.",
  // v_epi_saldo conta "ajuste" como positivo e a quantidade não aceita negativo.
  tipo: "Entrada e Ajuste somam ao saldo; Saída tira. As entregas já dão baixa sozinhas.",
  quantidade: "Quantidade na unidade do item (sempre positiva).",
  responsavel: "Quem fez a movimentação.",
  motivo: "Por que o estoque mudou (ex.: compra, perda, correção de contagem).",
} as const;

export const DICAS_EPI_ENTREGA = {
  colaborador: "Quem recebe os EPIs. Cadastre antes na aba Colaboradores.",
  data: "Dia em que o colaborador recebeu os itens. Sai na ficha.",
  itens: "EPIs e quantidades. Não passa do saldo, e a entrega dá baixa no estoque sozinha.",
  observacao: "Algo a registrar sobre esta entrega.",
} as const;

export const DICAS_EPI_COLABORADOR = {
  nome: "Nome completo, como vai sair na ficha de entrega.",
  cpf: "CPF do colaborador, para identificá-lo.",
  matricula: "Número de registro do colaborador na empresa, se houver.",
  cargo: "Cargo do colaborador. Aparece ao lado do nome na hora de registrar a entrega.",
  setor: "Setor onde o colaborador trabalha.",
  // "Inativo" hoje só muda a etiqueta: a pessoa continua na lista da entrega.
  ativo: "Desmarque quando a pessoa sair da empresa. As entregas dela continuam no histórico.",
} as const;

export const DICAS_EPI_TRANSFERENCIA = {
  destino: "Empresa que recebe os itens. Precisa ser diferente da empresa de origem (a do topo).",
  itens: "Não passa do saldo. No destino, crie uma cópia do item ou ligue a um EPI que ele já tem.",
  observacao: "Motivo ou detalhe da transferência.",
} as const;

export const DICAS_EPI_ASSINATURA = {
  nome: "Nome de quem recebe os EPIs e assina a ficha.",
  desenho: "Assine com o dedo ou com o mouse dentro do quadro.",
} as const;

/**
 * Dicas de preenchimento da Apreciação de Máquinas NR-12 (Etapa 7, lote 7.8, do
 * docs/plano-skin-viva-jcn.md): Nova, Dados gerais, Identificação da máquina, Ficha, Item livre,
 * Risco HRN, Item do checklist, Conclusão e Plano de Adequação. Mesmas regras de
 * lib/dicas/empresas.ts; cada afirmação conferida no PDF. Revisadas pelo João em 03/11/2026.
 * 0.3.220: Notificação SIT, Limites, Componentes, NPE e Sistemas passaram a sair no PDF.
 * Continuam neutras (gravadas, sem PDF): NPE do risco e Nível das ações.
 */
const GRAVE_IDENT = "Grave em Salvar identificação; sai na ficha da máquina no PDF.";

export const DICAS_APR_DADOS = {
  responsavel: "Escolha o profissional da lista; já vem com o seu nome. Sai na folha de assinaturas do PDF.",
  responsavel_empresa: "Contato do cliente que acompanha a apreciação. Vira o Quem das ações geradas no Plano de Adequação.",
  data: "Data da avaliação; já vem com hoje. Entra nos textos padrão do PDF e na tela de Validades.",
  notificacao: "Número da notificação da fiscalização e os itens citados, se houver. Sai no PDF junto da identificação.",
  validade: "Até quando o documento vale. Não sai no PDF: alimenta a tela de Validades e os avisos de vencimento.",
  observacoes: "Grave em Salvar dados gerais. Sai no PDF como Observações gerais.",
  imprimir_checklist: "Já vem marcado em laudo novo. Grave em Salvar dados gerais para valer no PDF.",
} as const;

export const DICAS_APR_MAQUINA = {
  operadores: "Nome e cargo de quem opera a máquina. Grave em Salvar identificação; saem numa tabela na ficha do PDF.",
  fotos: "Até 6 fotos, que gravam na hora. Só as 3 primeiras saem na ficha da máquina no PDF.",
  limite_uso: `Para que a máquina é usada (ex.: panificação). ${GRAVE_IDENT}`,
  limite_espaco: `Onde a máquina fica e o espaço em volta (ex.: 2º andar). ${GRAVE_IDENT}`,
  limite_tempo: `Vida útil ou período de uso previsto (ex.: 15 anos). ${GRAVE_IDENT}`,
  limite_produtividade: `Capacidade de produção (ex.: 80 kg/h). ${GRAVE_IDENT}`,
  npe: `Faixa de pessoas expostas à máquina. ${GRAVE_IDENT}`,
  sistema_atual: `Marque os sistemas de segurança que a máquina já tem. ${GRAVE_IDENT}`,
  sistema_necessario: `Marque os sistemas de segurança que a máquina precisa ter. ${GRAVE_IDENT}`,
  constatacoes: "O que foi visto em campo nesta máquina. Grave em Salvar identificação; sai na ficha da máquina no PDF.",
  parecer: "Conclusão só desta máquina, não do laudo. Grave em Salvar identificação; sai no fim da ficha no PDF.",
} as const;

export const DICAS_APR_FICHA = {
  equipamento: "Nome da máquina. Ao salvar, vira o título da ficha e da linha na Relação de Máquinas do PDF.",
  setor: "Agrupa as máquinas por setor no editor e no PDF e muda a numeração. Em branco, cai em Sem setor.",
  tipo: "Tipo ou função da máquina. Sai no bloco Inventário da ficha no PDF.",
  modelo: "Modelo da placa da máquina. Sai no Inventário da ficha e na Relação de Máquinas do PDF.",
  fabricante: "Quem fabricou a máquina. Sai no Inventário da ficha e na Relação de Máquinas do PDF.",
  serie: "Número de série da placa. Sai no Inventário da ficha e na Relação de Máquinas do PDF.",
  ano: "Ano de fabricação. Sai no Inventário da ficha e na Relação de Máquinas do PDF.",
  capacidade: "Capacidade da máquina (ex.: 80 kg/h). Sai no bloco Inventário da ficha no PDF.",
} as const;

export const DICAS_APR_LIVRE = {
  categoria: "Grupo do checklist em que o item entra. Define onde ele aparece no checklist do PDF.",
  titulo: "Obrigatório. Vira o nome do item, com código LIVRE-N, no checklist do PDF.",
  descricao: "Contexto do item livre. Diferente dos itens do catálogo, sai no PDF logo abaixo do título.",
} as const;

export const DICAS_APR_RISCO = {
  perigo: "Obrigatório. Sai na coluna Perigo da ficha no PDF. Em risco já lançado, grave em Salvar alterações.",
  origem: "O que causa o perigo. Sai no PDF junto das consequências, na coluna Origem / Consequências.",
  consequencias: "Danos possíveis à pessoa. Saem no PDF depois da origem, ligados por uma seta.",
  itens_nr12: "Separe os itens com ponto e vírgula, porque o item pode ter vírgula. Saem na coluna Item NR-12 da ficha.",
  pod: "Probabilidade do dano: Remota (1) a Muito Provável (4). Multiplicada por FEP e GPD, dá o índice HRN.",
  fep: "Frequência de exposição: Anualmente (1) a Diariamente (4). Entra no índice HRN junto com POD e GPD.",
  gpd: "Gravidade do dano: Baixa (1) a Catastrófica (4). O índice POD × FEP × GPD sugere a classificação.",
  npe: "Pessoas expostas a este perigo.",
  classificacao: "Vem da sugestão do índice: até 8 Desprezível, até 18 Baixo, até 36 Médio, acima Alto. A gravada sai no PDF.",
  nivel_acoes: "Prazo das ações preventivas, em texto livre (ex.: Imediato, Curto prazo).",
  engenharia: "Proteções e dispositivos que reduzem o risco. Saem com o prefixo Eng.: na coluna Medidas de Controle do PDF.",
  administrativas: "Treinamento, procedimento, EPI. Saem com o prefixo Adm.: na coluna Medidas de Controle do PDF.",
  categoria_seguranca: "Categoria B, 1, 2, 3 ou 4 do sistema de comando. Sai como Cat. segurança na coluna Medidas de Controle.",
  pod_residual: "Probabilidade depois das medidas, na mesma régua do POD. Com FEP e GPD residuais, dá o Risco Residual do PDF.",
  fep_residual: "Frequência de exposição depois das medidas. Entra no índice residual da coluna Risco Residual.",
  gpd_residual: "Gravidade depois das medidas. Os três residuais definem o maior risco da máquina na Conclusão Geral.",
  classificacao_residual: "Vem da sugestão do índice residual; use o link para trocar. A gravada sai em Risco Residual.",
} as const;

export const DICAS_APR_ITEM = {
  probabilidade: "Opções da matriz de risco ativa. Com a severidade, calcula o nível do item; grava na hora e sai no PDF.",
  severidade: "Com a probabilidade, define o nível do item. O nível dá a prioridade da ação gerada no Plano de Adequação.",
  fotos: "Até 6 fotos de 5 MB cada; sobem na hora. A legenda grava ao sair do campo e sai sob a foto no PDF.",
  observacao: "Grava sozinha quando você para de digitar. Sai no PDF e vira o Por quê da ação gerada deste item.",
  recomendacao: "Grava sozinha quando você para de digitar. Sai no PDF e vira o Como da ação gerada no Plano de Adequação.",
} as const;

export const DICAS_APR_CONCLUSAO = {
  parecer: "Conclusão geral do laudo. Grave em Salvar conclusão (Finalizar também grava); sai na Conclusão Geral do PDF.",
  recomendacoes: "Ações prioritárias do laudo todo. Grave em Salvar conclusão; sai na Conclusão Geral do PDF.",
  risco_residual: "Grau final do laudo. Sugerir usa o maior nível dos itens não conformes de todas as máquinas.",
} as const;

export const DICAS_APR_PLANO = {
  oque: "A ação a fazer. Grava ao sair do campo e sai em destaque no Plano de Ação do PDF.",
  porque: "Motivo da ação; nas geradas vem da observação do item. Grava ao sair do campo e sai no PDF.",
  como: "Como executar; nas geradas vem da recomendação do item. Grava ao sair do campo e sai no PDF.",
  onde: "Local da ação. Grava ao sair do campo e sai no PDF como Onde.",
  quem: "Responsável pela ação; nas geradas vem do Responsável da empresa. Grava ao sair do campo e sai no PDF.",
  quando: "Data limite da ação. Aparece na linha resumida, sai no PDF e vai junto ao Enviar para Plano de Ação.",
  quanto: "Custo estimado em texto livre (ex.: R$ 500). Grava ao sair do campo e sai no PDF como Quanto.",
  prioridade: "Grava na hora. Nas ações geradas vem do nível de risco do item. Sai em destaque no PDF.",
} as const;

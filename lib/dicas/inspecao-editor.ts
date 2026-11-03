/**
 * Dicas de preenchimento das abas do editor de inspeção (Etapa 7, lote 7.2, do
 * docs/plano-skin-viva-jcn.md): Setor, Cargo, EPI/EPC, Extintor, Treinamento, Máquinas,
 * Responsáveis, Complemento e Foto. Mesmas regras de lib/dicas/empresas.ts. Revisadas pelo João
 * em 03/11/2026.
 */
const PLACA = "Como está na placa de identificação da máquina.";
const ORDEM = "Posição na lista: os números menores vêm primeiro.";

export const DICAS_SETOR = {
  nome: "Nome do setor ou do grupo de trabalhadores com exposição parecida (GHE).",
  descricao: "Como é o ambiente e o que se faz nele: área, estrutura, atividades.",
  conformidade: "O que está adequado neste setor.",
  nao_conformidade: "O que está fora do adequado neste setor e precisa de correção.",
} as const;

export const DICAS_CARGO = {
  setor: "Setor onde o cargo trabalha. O cargo aparece na escolha de cargo dos riscos deste setor.",
  cargo: "Nome do cargo, como a empresa usa.",
  descricao: "Atividades que a pessoa do cargo faz no dia a dia.",
} as const;

export const DICAS_EPI = {
  setores: "Filtra a lista de riscos abaixo. Nenhum marcado mostra os riscos de todos os setores.",
  riscos: "Riscos que pedem este equipamento. Cada risco marcado recebe os equipamentos escolhidos.",
  setor: "Filtra a lista de riscos abaixo.",
  risco: "Risco ao qual este equipamento está ligado.",
  tipo: "EPI: de uso individual (luva, protetor auricular). EPC: proteção coletiva (guarda-corpo, exaustor).",
  recomendado: "Sim: sai como RECOMENDADO no relatório. Não: equipamento que a empresa já usa.",
  descricao: "Nome do equipamento (ex.: protetor auricular tipo plug).",
  ca: "Número do Certificado de Aprovação, impresso no próprio EPI ou na embalagem.",
} as const;

export const DICAS_EXTINTOR = {
  setor: "Setor onde o extintor fica. Em branco, vale para a empresa toda.",
  tipo_agente: "Agente do extintor, como no rótulo (ex.: pó químico ABC, CO2, água).",
  capacidade: "Carga do extintor, como no rótulo (ex.: 4 kg, 10 L).",
  identificacao: "Número ou patrimônio que identifica o extintor no local.",
  localizacao: "Onde exatamente ele fica, para quem for procurar.",
  validade: "Validade da carga, como está no selo ou na etiqueta do extintor.",
  situacao: "\"Não conforme\" abre a lista de problemas para marcar. \"Não avaliado\": não foi possível conferir.",
  ordem: ORDEM,
  outra_nc: "Problema que não está na lista acima.",
  observacoes: "Qualquer outro detalhe sobre o extintor.",
} as const;

export const DICAS_TREINAMENTO = {
  nr: "Escolha a NR na lista (o título se preenche sozinho) ou digite um treinamento sem NR.",
  titulo: "Nome do treinamento como deve aparecer no relatório.",
  carga_horaria: "Duração do treinamento (ex.: 8h).",
  periodicidade: "De quanto em quanto tempo repetir (ex.: reciclagem anual).",
  ordem: ORDEM,
  descricao: "Conteúdo ou detalhes do treinamento, se quiser registrar.",
  observacoes: "Outros detalhes que precisam constar.",
} as const;

export const DICAS_MAQUINA = {
  setores: "Setores onde a máquina é usada. A mesma máquina pode estar em mais de um.",
  nome: "Nome pelo qual a máquina é conhecida (ex.: prensa hidráulica 50T).",
  tipo: "Categoria da máquina (ex.: prensa, serra, torno).",
  marca: PLACA,
  modelo: PLACA,
  numero_serie: PLACA,
  tag: "Código interno da empresa para a máquina, se houver.",
  ano_fabricacao: PLACA,
  potencia: "Potência do motor, com a unidade (ex.: 5 kW, 3 cv).",
  tensao: "Tensão de alimentação (ex.: 220 V, 380 V).",
  grau_risco: "Avaliação geral da máquina. Deixe \"não avaliado\" se ainda não analisou.",
  observacoes: "Detalhes técnicos que não couberam acima.",
} as const;

export const DICAS_RESPONSAVEL = {
  tecnico: "Técnico da JCN que fez a visita. Sai no relatório.",
  recepcionado_por: "Pessoa da empresa que acompanhou a visita.",
  cargo: "Cargo de quem recepcionou a visita.",
  data_hora: "Dia e hora da visita.",
} as const;

export const DICAS_COMPLEMENTO = {
  tipo: "Que tipo de informação é: procedimento, ordem de serviço, sinalização, documento ou outro.",
  setor: "Setor a que se refere. Em branco, vale para a empresa toda.",
  titulo: "Nome curto do complemento.",
  descricao: "O que foi verificado ou o que o documento diz.",
  dados: "Anotações extras sobre este complemento.",
} as const;

export const DICAS_FOTO = {
  categoria: "Assunto da foto.",
  setor: "Setor a que a foto pertence. Sem setor, fica como foto geral da inspeção.",
  legenda: "Texto curto que acompanha a foto.",
} as const;

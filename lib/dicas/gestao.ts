/**
 * Dicas de preenchimento da Gestão (Etapa 7, lotes 7.9a e 7.9b, do docs/plano-skin-viva-jcn.md).
 * 7.9a: janela da tarefa, formulários (configurar e público), modelos de checklist e campos.
 * 7.9b: automações e acessos. Mesmas regras de lib/dicas/empresas.ts; cada afirmação conferida no
 * código e no banco (avisos v290/v291, agenda em app/api/gestao/google). Revisadas pelo João em
 * 04/11/2026. Campos só com placeholder (comentário, motivo da aprovação, responsável da subtarefa)
 * ficam sem dica: a dica abre no rótulo.
 */
export const DICAS_GESTAO_TAREFA = {
  titulo: "O que precisa ser feito, em poucas palavras. É o nome do evento na Google Agenda e aparece nos avisos e e-mails.",
  descricao: "Detalhes e combinados da tarefa. Redigir com IA acrescenta um texto ao que já está escrito; não vai para a Google Agenda.",
  inicio: "Quando o trabalho começa. Com a data de término, vira um evento de vários dias na Google Agenda de quem está na tarefa.",
  termino: "Prazo da tarefa. Sem ela, nada vai para a Google Agenda; no dia, os responsáveis recebem aviso e e-mail de Vence hoje.",
  hora_inicio: "Opcional. Com hora, o evento na Google Agenda deixa de ser de dia inteiro; sem hora fim, dura 1 hora.",
  hora_fim: "Opcional. No mesmo dia não pode ser antes da hora de início. Sem hora de início, o evento começa 1 hora antes.",
  prioridade: "Baixa, Média, Alta ou Urgente. Muda a cor da borda do cartão; Alta e Urgente ganham bandeira no cartão.",
  status: "Etapa atual da tarefa. Ao mudar, todos na tarefa são avisados; status concluído tira a tarefa da Google Agenda.",
  pontos: "Esforço estimado, em número inteiro. Aparece no cartão e soma no indicador Pontos do Painel.",
  responsaveis: "Quem faz a tarefa; pode ser mais de um. Cada um recebe aviso e e-mail e vê a tarefa na Google Agenda, se conectou.",
  seguidores: "Quem acompanha sem executar. Recebe avisos de status e comentários e vê a tarefa na agenda, mas não o aviso de prazo.",
  recorrencia: "Repete a tarefa: uma cópia nova nasce a cada período, contado a partir da data de término. Subtarefas não vão junto.",
  etiquetas: "Palavras-chave para filtrar e agrupar o quadro. Ficam coloridas quando existem no catálogo de Etiquetas da lista.",
  subtarefas: "Passos da tarefa. Só são gravados quando você salva; dê duplo clique numa subtarefa para abri-la inteira.",
} as const;

export const DICAS_GESTAO_FORMULARIO = {
  titulo: "Nome que aparece no topo do formulário público. Pode virar parte do título da tarefa em Título da tarefa.",
  introducao: "Orientação para quem vai responder. Aparece logo abaixo do título no formulário público.",
  detalhes: "Mostra a caixa Detalhes no formulário. O que a pessoa escrever abre a descrição da tarefa.",
  prazo: "Mostra Prazo desejado no formulário. A resposta vira o prazo da tarefa, salvo se uma pergunta gravar em Prazo.",
  prioridade: "Deixa quem responde escolher a prioridade. Desmarcado, vale a Prioridade padrão.",
  status_inicial: "Em que status a tarefa nasce. Em branco, entra no primeiro status da lista.",
  prioridade_padrao: "Prioridade da tarefa criada quando o formulário não pede prioridade. Também já vem marcada no formulário.",
  responsavel_padrao: "Quem recebe cada solicitação. Vira responsável da tarefa e é avisado; precisa ser usuário ativo do sistema.",
  etiquetas_padrao: "Etiquetas que toda tarefa deste formulário recebe, além das que vierem das respostas.",
  perguntas: "Perguntas além do título. Em grava em, escolha onde cada resposta vai parar na tarefa.",
  obrigatoria: "Marcado, o formulário só envia com a resposta. Pergunta escondida por condição não é cobrada.",
  grava_em: "Onde a resposta vai: descrição, etiquetas, prazo ou um campo. Valor fora das opções do campo vai para a descrição.",
  mostrar_se: "Esconde a pergunta até a resposta escolhida aparecer. Escondida, não é cobrada e a resposta é ignorada.",
} as const;

export const DICAS_GESTAO_FORM_PUBLICO = {
  titulo: "Resuma o pedido em uma linha. Vira o título da tarefa que a equipe vai receber.",
  detalhes: "Conte o que precisa, com o máximo de detalhes. O texto vai para a descrição da tarefa.",
  prazo: "Até quando você precisa. Vira o prazo da tarefa.",
  prioridade: "Diga a urgência do pedido. Já vem com a prioridade padrão do formulário.",
} as const;

export const DICAS_GESTAO_LISTA = {
  modelo_titulo: "Nome do checklist. É o que aparece para escolher na ação Criar subtarefas a partir de modelo.",
  modelo_slug: "Código que a automação usa para achar o modelo. Se trocar depois, as automações com o código antigo param.",
  modelo_itens: "Uma subtarefa por linha. Item com o mesmo texto de uma subtarefa que a tarefa já tem não é criado de novo.",
  campo_opcoes: "Escolhas do campo na tarefa. Respostas de formulário fora desta lista não entram no campo e vão para a descrição.",
} as const;

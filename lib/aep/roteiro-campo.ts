import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/**
 * Roteiro de campo por fator da Ergonomia Organizacional (2026-10-06):
 * perguntas INDIRETAS (que não pedem ao trabalhador para "denunciar" ninguém)
 * e o que OBSERVAR — para sustentar a triagem mesmo quando ninguém fala.
 *
 * Fonte: Anexo B do plano "AEP com menos dependência de entrevistas". Só
 * orientação: não grava nada. Aparece recolhido em cada fator do editor e
 * impresso no Formulário em Branco.
 */

export interface RoteiroFator {
  perguntas: string[];
  observar: string[];
}

export const ROTEIRO_CAMPO: Record<keyof AepChecklistOrganizacional, RoteiroFator> = {
  assedio: {
    perguntas: [
      "Quando a liderança precisa cobrar algo, como costuma fazer?",
      "Se um colega novo entrasse amanhã, o que você diria para ele tomar cuidado aqui?",
      "Já viu alguém ser chamado atenção na frente dos outros?",
    ],
    observar: [
      "Tom de voz e forma de cobrança da liderança",
      "Mudança de comportamento quando o líder se aproxima",
      "Brincadeiras constrangedoras ou apelidos",
      "Silêncio excessivo no setor",
    ],
  },
  falta_suporte: {
    perguntas: [
      "Quando aparece um problema que você não sabe resolver, a quem recorre?",
      "Quando alguém erra, o que costuma acontecer?",
    ],
    observar: [
      "Presença e acessibilidade do líder durante a visita",
      "Trabalhadores aguardando orientação para continuar",
      "Demora para obter respostas",
    ],
  },
  gestao_mudancas: {
    perguntas: [
      "Como vocês ficam sabendo das mudanças aqui?",
      "Teve alguma mudança recente? Como foi para o setor?",
    ],
    observar: [
      "Comentários sobre boatos ou instabilidade",
      "Processos ou ferramentas novos sem orientação",
      "Retrabalho e dúvidas sobre o novo modo de fazer",
    ],
  },
  clareza_papel: {
    perguntas: [
      "Se duas pessoas pedirem coisas diferentes, qual você faz?",
      "Como você aprendeu a fazer sua atividade?",
    ],
    observar: [
      "Instruções vindas de mais de uma pessoa",
      "Ausência de procedimento no posto",
      "Trabalhadores executando a mesma tarefa de formas diferentes",
    ],
  },
  recompensas: {
    perguntas: [
      "Quando o trabalho sai bem feito, alguém comenta?",
      "Quem trabalha aqui consegue crescer na empresa?",
    ],
    observar: [
      "Feedback apenas diante de erros",
      "Desânimo aparente",
      "Existência de ações visíveis de reconhecimento",
    ],
  },
  baixo_controle: {
    perguntas: [
      "Se você tiver uma ideia para melhorar o trabalho, o que acontece?",
      "Para quais decisões você precisa pedir autorização?",
    ],
    observar: [
      "Supervisão constante e revisões excessivas",
      "Trabalhadores parados aguardando autorização",
      "Receio de tomar iniciativa",
    ],
  },
  justica_organizacional: {
    perguntas: [
      "Como é decidido quem folga, faz hora extra ou é promovido?",
      "As regras valem igual para todo mundo aqui?",
    ],
    observar: [
      "Comentários sobre preferidos",
      "Tratamento diferente entre trabalhadores na mesma função",
      "Conflitos visíveis",
    ],
  },
  eventos_traumaticos: {
    perguntas: [
      "Já aconteceu alguma situação difícil com cliente ou público? Como foi resolvido?",
      "Se acontecer de novo, você sabe o que fazer?",
    ],
    observar: [
      "Exposição direta ao público e manuseio de valores",
      "Local e horário de trabalho",
      "Barreiras físicas, controle de acesso, CFTV ou botão de pânico",
    ],
  },
  subcarga: {
    perguntas: [
      "Como é o movimento do setor ao longo do dia ou do mês?",
      "O que vocês fazem quando não tem serviço?",
    ],
    observar: [
      "Ociosidade durante a visita",
      "Tarefas monótonas ou repetitivas",
      "Compatibilidade entre qualificação e tarefa",
    ],
  },
  sobrecarga: {
    perguntas: [
      "Dá para fazer tudo dentro do horário?",
      "Quando alguém falta, como fica o trabalho?",
    ],
    observar: [
      "Ritmo acelerado e pausas suprimidas",
      "Acúmulo de tarefas simultâneas",
      "Trabalhadores permanecendo após o horário",
    ],
  },
  maus_relacionamentos: {
    perguntas: [
      "Como é a convivência entre o pessoal do setor?",
      "Quando dois colegas se desentendem, o que acontece?",
    ],
    observar: [
      "Evitação ou isolamento entre colegas",
      "Recados indiretos",
      "Falta de cooperação nas tarefas",
    ],
  },
  comunicacao_dificil: {
    perguntas: [
      "Como a informação chega até você?",
      "Já teve que parar o serviço por falta de informação?",
    ],
    observar: [
      "Ausência de quadro de avisos ou registro de passagem de turno",
      "Informações divergentes entre pessoas",
      "Barreiras físicas à comunicação (ruído, distância)",
    ],
  },
  trabalho_remoto: {
    perguntas: [
      "Com que frequência você conversa com a equipe e a liderança?",
      "Se algo der errado quando está sozinho, como pede ajuda?",
    ],
    observar: [
      "Meios de comunicação disponíveis",
      "Existência de check-in ou monitoramento",
      "Contato real com a equipe",
    ],
  },
};

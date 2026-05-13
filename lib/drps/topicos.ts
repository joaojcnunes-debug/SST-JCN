// DRPS — Tópicos e perguntas do questionário NR-01 (modelo NR_01_50P_Atual_13F).
//
// 13 tópicos com número variável de perguntas (5, 5, 4, 4, 3, 4, 4, 3, 4, 4, 3,
// 4, 3 = 50 perguntas), ocupando as colunas D a BA do CSV exportado do Forms.
// Cada pergunta tem lógica "direta" (resposta alta = risco alto) ou
// "invertida" (resposta alta = proteção; pontuação convertida via 4 - valor).

export type LogicaPergunta = "direta" | "invertida";

export interface PerguntaDRPS {
  num: number;
  texto: string;
  logica: LogicaPergunta;
}

export interface TopicoDRPS {
  id: string;
  nome: string;
  nomeAbreviado: string;
  /** Índice da primeira pergunta deste tópico no array de respostas (0-based). */
  colunaInicio: number;
  /** Fonte geradora padrão (pré-preenchida no relatório DRPS). */
  fonteGeradora: string;
  perguntas: PerguntaDRPS[];
}

export const TOPICOS: TopicoDRPS[] = [
  {
    id: "T01",
    nome: "Tópico 01 - Assédio de qualquer natureza no trabalho",
    nomeAbreviado: "Assédio no Trabalho",
    colunaInicio: 0,
    fonteGeradora:
      "Cultura permissiva a desrespeito; ausência de canal de denúncia; liderança despreparada; comunicação violenta.",
    perguntas: [
      { num: 1, texto: "Você já presenciou ou sofreu comentários ofensivos, piadas ou insinuações inadequadas no ambiente de trabalho?", logica: "direta" },
      { num: 2, texto: "Você se sente à vontade para relatar situações de assédio moral ou sexual na empresa sem medo de represálias?", logica: "invertida" },
      { num: 3, texto: "Existe um canal seguro e sigiloso para denunciar assédio na empresa?", logica: "invertida" },
      { num: 4, texto: "Há casos conhecidos de assédio moral ou sexual que não foram devidamente investigados ou punidos?", logica: "direta" },
      { num: 5, texto: "O RH e os gestores demonstram comprometimento real com a prevenção do assédio?", logica: "invertida" },
    ],
  },
  {
    id: "T02",
    nome: "Tópico 02 - Falta de suporte/apoio no trabalho",
    nomeAbreviado: "Falta de Suporte",
    colunaInicio: 5,
    fonteGeradora:
      "Liderança ausente; falta de escuta; cobrança sem acompanhamento; RH pouco atuante.",
    perguntas: [
      { num: 1, texto: "Você sente que pode contar com seus colegas em momentos de dificuldade?", logica: "invertida" },
      { num: 2, texto: "Existe apoio da liderança para lidar com desafios relacionados ao trabalho?", logica: "invertida" },
      { num: 3, texto: "O RH está presente e atuante quando surgem conflitos ou dificuldades no trabalho?", logica: "invertida" },
      { num: 4, texto: "Os gestores promovem um ambiente saudável e respeitoso?", logica: "invertida" },
      { num: 5, texto: "Você sente que pode expressar suas dificuldades no trabalho sem ser julgado(a)?", logica: "invertida" },
    ],
  },
  {
    id: "T03",
    nome: "Tópico 03 - Má gestão de mudanças organizacionais",
    nomeAbreviado: "Gestão de Mudanças",
    colunaInicio: 10,
    fonteGeradora:
      "Comunicação inadequada; mudanças abruptas; falta de planejamento; insegurança quanto à estabilidade.",
    perguntas: [
      { num: 1, texto: "Mudanças organizacionais impactaram negativamente seu sentimento de segurança no trabalho?", logica: "direta" },
      { num: 2, texto: "Há comunicação clara sobre mudanças que afetam a empresa ou os trabalhadores?", logica: "invertida" },
      { num: 3, texto: "Você já sentiu que seu emprego estava ameaçado sem explicações claras durante períodos de mudança?", logica: "direta" },
      { num: 4, texto: "Existe transparência na comunicação da empresa durante processos de mudança?", logica: "invertida" },
    ],
  },
  {
    id: "T04",
    nome: "Tópico 04 - Baixa clareza de papel/função",
    nomeAbreviado: "Clareza de Função",
    colunaInicio: 14,
    fonteGeradora:
      "Falta de definição de responsabilidades; ordens contraditórias; comunicação confusa; atribuições mal definidas.",
    perguntas: [
      { num: 1, texto: "Você recebe instruções claras sobre suas responsabilidades no trabalho?", logica: "invertida" },
      { num: 2, texto: "A comunicação da empresa ajuda você a entender o que é esperado do seu trabalho?", logica: "invertida" },
      { num: 3, texto: "A comunicação entre equipes e setores contribui para a clareza das suas tarefas?", logica: "invertida" },
      { num: 4, texto: "Você se sente confortável para pedir esclarecimentos quando não entende suas funções ou prioridades?", logica: "invertida" },
    ],
  },
  {
    id: "T05",
    nome: "Tópico 05 - Baixas recompensas e reconhecimento",
    nomeAbreviado: "Recompensas",
    colunaInicio: 18,
    fonteGeradora:
      "Ausência de feedback; foco exclusivo em metas; reconhecimento desigual; falta de plano de crescimento.",
    perguntas: [
      { num: 1, texto: "Você sente que seu esforço e desempenho são reconhecidos pela liderança?", logica: "invertida" },
      { num: 2, texto: "Você recebe feedback construtivo sobre o seu trabalho com regularidade?", logica: "invertida" },
      { num: 3, texto: "Com que frequência você já se sentiu desmotivado(a) por falta de reconhecimento no trabalho?", logica: "direta" },
    ],
  },
  {
    id: "T06",
    nome: "Tópico 06 - Baixo controle no trabalho / Falta de autonomia",
    nomeAbreviado: "Autonomia",
    colunaInicio: 21,
    fonteGeradora:
      "Microgestão; excesso de burocracia; centralização de decisões; baixa confiança na equipe.",
    perguntas: [
      { num: 1, texto: "Você tem liberdade para tomar decisões sobre como executar suas tarefas diárias?", logica: "invertida" },
      { num: 2, texto: "A empresa confia na sua capacidade de organizar e gerenciar o próprio trabalho?", logica: "invertida" },
      { num: 3, texto: "Existe excesso de controle ou burocracia que interfere no seu desempenho?", logica: "direta" },
      { num: 4, texto: "Existe excesso de supervisão que impacte negativamente sua produtividade ou bem-estar?", logica: "direta" },
    ],
  },
  {
    id: "T07",
    nome: "Tópico 07 - Baixa justiça organizacional",
    nomeAbreviado: "Justiça Organizacional",
    colunaInicio: 25,
    fonteGeradora:
      "Critérios pouco transparentes; favorecimento; desigualdade de tratamento; decisões pouco claras.",
    perguntas: [
      { num: 1, texto: "Você acha justas e claras as formas que a empresa usa para avaliar o seu trabalho?", logica: "invertida" },
      { num: 2, texto: "Você sente que há igualdade no reconhecimento entre diferentes áreas ou equipes?", logica: "invertida" },
      { num: 3, texto: "Você sente que há transparência nas decisões de desligamento na empresa?", logica: "invertida" },
      { num: 4, texto: "Você já presenciou casos de demissões que considerasse injustas?", logica: "direta" },
    ],
  },
  {
    id: "T08",
    nome: "Tópico 08 - Eventos violentos ou traumáticos",
    nomeAbreviado: "Eventos Traumáticos",
    colunaInicio: 29,
    fonteGeradora:
      "Falta de protocolos de segurança; exposição a risco; ausência de treinamento; falta de suporte pós-evento.",
    perguntas: [
      { num: 1, texto: "Você já vivenciou ou presenciou alguma situação de violência grave no trabalho (como agressão física, ameaça séria ou ataque)?", logica: "direta" },
      { num: 2, texto: "Você já passou por algum evento grave no trabalho (como acidente sério, situação de risco extremo ou episódio muito impactante)?", logica: "direta" },
      { num: 3, texto: "Alguma situação vivida no trabalho já foi tão marcante que deixou medo, choque ou forte abalo emocional?", logica: "direta" },
    ],
  },
  {
    id: "T09",
    nome: "Tópico 09 - Baixa demanda no trabalho (Subcarga)",
    nomeAbreviado: "Subcarga de Trabalho",
    colunaInicio: 32,
    fonteGeradora:
      "Subutilização de competências; ociosidade; má distribuição de tarefas; funções pouco desafiadoras.",
    perguntas: [
      { num: 1, texto: "Você sente que, na maior parte do tempo, tem pouco trabalho a realizar durante sua jornada?", logica: "direta" },
      { num: 2, texto: "Você costuma ficar com tempo ocioso no trabalho por falta de tarefas ou demandas claras?", logica: "direta" },
      { num: 3, texto: "Você sente que suas habilidades ou conhecimentos são pouco utilizados no seu trabalho?", logica: "direta" },
      { num: 4, texto: "Seu trabalho costuma ser pouco desafiador ou repetitivo a ponto de gerar desânimo?", logica: "direta" },
    ],
  },
  {
    id: "T10",
    nome: "Tópico 10 - Excesso de demandas no trabalho (Sobrecarga)",
    nomeAbreviado: "Sobrecarga de Trabalho",
    colunaInicio: 36,
    fonteGeradora:
      "Metas irrealistas; equipe insuficiente; jornadas prolongadas; acúmulo de funções.",
    perguntas: [
      { num: 1, texto: "Você sente que sua carga de trabalho diária é maior do que consegue realizar dentro do horário normal?", logica: "direta" },
      { num: 2, texto: "Você frequentemente precisa fazer horas extras ou levar trabalho para casa?", logica: "direta" },
      { num: 3, texto: "Você já teve sintomas físicos ou emocionais (como exaustão, ansiedade ou insônia) devido ao excesso de trabalho?", logica: "direta" },
      { num: 4, texto: "A equipe é dimensionada/dividida corretamente para a demanda/quantidade de trabalho existente?", logica: "invertida" },
    ],
  },
  {
    id: "T11",
    nome: "Tópico 11 - Maus relacionamentos no local de trabalho",
    nomeAbreviado: "Relacionamentos",
    colunaInicio: 40,
    fonteGeradora:
      "Comunicação agressiva; rivalidade interna; conflitos mal geridos; liderança despreparada.",
    perguntas: [
      { num: 1, texto: "Você já evitou colegas ou superiores por causa de desentendimentos frequentes?", logica: "direta" },
      { num: 2, texto: "Você percebe rivalidade excessiva ou desnecessária entre colegas ou setores?", logica: "direta" },
      { num: 3, texto: "Conflitos no trabalho costumam ser resolvidos de forma justa?", logica: "invertida" },
    ],
  },
  {
    id: "T12",
    nome: "Tópico 12 - Trabalho em condições de difícil comunicação",
    nomeAbreviado: "Comunicação Difícil",
    colunaInicio: 43,
    fonteGeradora:
      "Turnos desalinhados; distância física; falha nos meios de comunicação; fluxo de informação inadequado.",
    perguntas: [
      { num: 1, texto: "Você trabalha em condições (como turnos diferentes, trabalho externo ou distância física) que dificultam a comunicação no trabalho?", logica: "direta" },
      { num: 2, texto: "A distância física entre você e sua equipe ou liderança dificulta a troca de informações?", logica: "direta" },
      { num: 3, texto: "Você já teve dificuldade para receber informações importantes no momento certo por causa da organização do trabalho?", logica: "direta" },
      { num: 4, texto: "Você tem acesso fácil aos meios necessários para se comunicar com colegas e liderança durante o trabalho?", logica: "invertida" },
    ],
  },
  {
    id: "T13",
    nome: "Tópico 13 - Trabalho remoto e isolado",
    nomeAbreviado: "Trabalho Remoto/Isolado",
    colunaInicio: 47,
    fonteGeradora:
      "Isolamento social; falta de acompanhamento; comunicação exclusivamente digital; baixa integração da equipe.",
    perguntas: [
      { num: 1, texto: "Você trabalha grande parte do tempo de forma remota ou sozinho(a), com pouco contato presencial com colegas ou liderança?", logica: "direta" },
      { num: 2, texto: "Você sente que o trabalho remoto ou isolado faz com que se sinta distante da equipe ou da empresa?", logica: "direta" },
      { num: 3, texto: "Se você trabalha de forma remota ou isolada, você sente que recebe apoio e acompanhamento adequados da empresa?", logica: "invertida" },
    ],
  },
];

/** Total de perguntas esperadas no array de respostas (= 50). */
export const TOTAL_PERGUNTAS = TOPICOS.reduce(
  (s, t) => s + t.perguntas.length,
  0
);

/** Programas/medidas de controle padrão para o plano anual. */
export const MEDIDAS_CONTROLE: string[] = [
  "DRPS — Diagnóstico de Riscos Psicossociais",
  "Programa de apoio psicológico",
  "Programa de gestão do estresse e prevenção ao burnout",
  "Programa de inteligência emocional para líderes",
  "Programa de prevenção ao assédio moral e psicológico no trabalho",
  "Programa de avaliação psicológica",
  "Programa de psicologia positiva",
  "Programa de saúde mental e clima organizacional",
  "Programa de prevenção e manejo da ansiedade",
  "Programa de equilíbrio vida-trabalho",
  "Programa de comunicação assertiva e não agressiva",
  "Programa de formação de multiplicadores da cultura do cuidado",
  "Programa de treinamento à equipe de RH para implementação da NR-01",
];

/** Possíveis agravos à saúde mental — sugestões padrão (multi-select). */
export const AGRAVOS_OPCOES: string[] = [
  "Transtornos de ansiedade",
  "Quadros depressivos",
  "Síndrome de Burnout (esgotamento profissional)",
  "Transtornos do sono",
  "Transtornos psicossomáticos",
  "Estresse pós-traumático",
  "Uso abusivo de álcool e outras drogas",
  "Ideação suicida e comportamento autolesivo",
  "Conflitos interpessoais e assédio moral",
  "Absenteísmo e presenteísmo",
];

/** Medidas de controle já existentes — sugestões padrão (multi-select). */
export const MEDIDAS_EXISTENTES_OPCOES: string[] = [
  "Programa de Apoio ao Empregado (PAE / EAP)",
  "Canal de denúncias e ouvidoria",
  "Treinamentos de liderança e gestão de equipes",
  "Pausas regulares e ginástica laboral",
  "Plano de saúde com cobertura para saúde mental",
  "Pesquisas de clima organizacional",
  "Política de prevenção ao assédio moral e sexual",
  "Programa de qualidade de vida no trabalho",
  "Acompanhamento psicológico (interno ou conveniado)",
  "Reuniões periódicas de feedback estruturado",
];

export const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

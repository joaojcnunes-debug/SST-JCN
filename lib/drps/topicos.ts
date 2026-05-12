// DRPS — Tópicos e perguntas do questionário NR-01 psicossocial.
//
// São 9 tópicos × 10 perguntas = 90 perguntas, na ordem das colunas D–CO
// da planilha de origem. Cada pergunta tem lógica "direta" (quanto maior
// a resposta, maior o risco) ou "invertida" (resposta alta = proteção,
// pontuação é convertida via 4 - valor antes de classificar).

export type LogicaPergunta = "direta" | "invertida";

export interface PerguntaDRPS {
  texto: string;
  logica: LogicaPergunta;
}

export interface TopicoDRPS {
  nome: string;
  /** Índice da primeira pergunta deste tópico no array de 90 respostas (0-based). */
  colunaInicio: number;
  /** Fonte geradora padrão (pré-preenchida no relatório DRPS). */
  fonteGeradora: string;
  perguntas: PerguntaDRPS[];
}

export const TOPICOS: TopicoDRPS[] = [
  {
    nome: "Assédio Moral e Sexual",
    colunaInicio: 0,
    fonteGeradora:
      "Relações de trabalho abusivas, comunicação violenta e importunação sexual.",
    perguntas: [
      { texto: "1. Você já presenciou ou sofreu comentários ofensivos, piadas ou insinuações inadequadas?", logica: "direta" },
      { texto: "2. Você se sente à vontade para relatar situações de assédio sem medo de retaliação?", logica: "invertida" },
      { texto: "3. Existe canal seguro e sigiloso para denunciar assédio na empresa?", logica: "invertida" },
      { texto: "4. Você já recebeu tratamento desrespeitoso ou humilhante de colegas ou superiores?", logica: "direta" },
      { texto: "5. Você sente que há favoritismo ou perseguição por parte da liderança?", logica: "direta" },
      { texto: "6. Há casos de assédio não investigados ou punidos?", logica: "direta" },
      { texto: "7. A empresa realiza treinamentos sobre assédio?", logica: "invertida" },
      { texto: "8. O RH e gestores demonstram comprometimento com prevenção do assédio?", logica: "invertida" },
      { texto: "9. Você já foi forçado(a) a realizar tarefas humilhantes?", logica: "direta" },
      { texto: "10. Existe cultura de brincadeiras que desrespeitam funcionários?", logica: "direta" },
    ],
  },
  {
    nome: "Carga Excessiva de Trabalho",
    colunaInicio: 10,
    fonteGeradora:
      "Metas irrealistas, jornadas prolongadas, horas extras excessivas e má distribuição de cargos.",
    perguntas: [
      { texto: "1. Sua carga de trabalho diária é superior à sua capacidade dentro do horário normal?", logica: "direta" },
      { texto: "2. Você frequentemente faz horas extras ou leva trabalho para casa?", logica: "direta" },
      { texto: "3. As demandas e prazos são realistas e atingíveis?", logica: "invertida" },
      { texto: "4. A empresa respeita seus limites físicos e mentais?", logica: "invertida" },
      { texto: "5. Você recebe pausas adequadas ao longo do dia?", logica: "invertida" },
      { texto: "6. Existe equilíbrio entre tarefas administrativas e operacionais?", logica: "invertida" },
      { texto: "7. Há redistribuição de tarefas quando há sobrecarga?", logica: "invertida" },
      { texto: "8. Você já teve sintomas físicos ou emocionais devido ao excesso de trabalho?", logica: "direta" },
      { texto: "9. Existe flexibilidade para gerenciar sua carga de trabalho?", logica: "invertida" },
      { texto: "10. A equipe é dimensionada corretamente para a demanda?", logica: "invertida" },
    ],
  },
  {
    nome: "Reconhecimento e Recompensas",
    colunaInicio: 20,
    fonteGeradora:
      "Gestão pouco humanizada e administração precária de recursos.",
    perguntas: [
      { texto: "1. Seu esforço e desempenho são reconhecidos pela liderança?", logica: "invertida" },
      { texto: "2. A empresa possui políticas claras de promoção e progressão de carreira?", logica: "invertida" },
      { texto: "3. As avaliações de desempenho são justas e transparentes?", logica: "invertida" },
      { texto: "4. Há igualdade no reconhecimento entre diferentes áreas?", logica: "invertida" },
      { texto: "5. A empresa oferece incentivos pelo bom desempenho?", logica: "invertida" },
      { texto: "6. Você recebe feedback construtivo regularmente?", logica: "invertida" },
      { texto: "7. Existe cultura de valorização dos funcionários?", logica: "invertida" },
      { texto: "8. Você já se sentiu desmotivado(a) por falta de reconhecimento?", logica: "direta" },
      { texto: "9. A empresa celebra conquistas individuais e coletivas?", logica: "invertida" },
      { texto: "10. O plano de benefícios é condizente com suas necessidades?", logica: "invertida" },
    ],
  },
  {
    nome: "Clima Organizacional",
    colunaInicio: 30,
    fonteGeradora:
      "Autoritarismo, gestão centralizadora e ausência de regras de bom convívio.",
    perguntas: [
      { texto: "1. O ambiente de trabalho é amigável e colaborativo?", logica: "invertida" },
      { texto: "2. Existe sentimento de confiança entre os colegas?", logica: "invertida" },
      { texto: "3. Você se sente confortável para expressar suas opiniões?", logica: "invertida" },
      { texto: "4. Os gestores promovem um ambiente saudável e respeitoso?", logica: "invertida" },
      { texto: "5. Existe transparência na comunicação da empresa?", logica: "invertida" },
      { texto: "6. Você pode contar com seus colegas em momentos de dificuldade?", logica: "invertida" },
      { texto: "7. Há senso de propósito e pertencimento entre os funcionários?", logica: "invertida" },
      { texto: "8. Conflitos são resolvidos de forma justa e eficiente?", logica: "invertida" },
      { texto: "9. O ambiente físico do local de trabalho é confortável e seguro?", logica: "invertida" },
      { texto: "10. A cultura organizacional está alinhada com seus valores pessoais?", logica: "invertida" },
    ],
  },
  {
    nome: "Autonomia e Controle sobre o Trabalho",
    colunaInicio: 40,
    fonteGeradora:
      "Gestão não humanizada e escassez de inteligência emocional.",
    perguntas: [
      { texto: "1. Você tem liberdade para tomar decisões sobre suas tarefas diárias?", logica: "invertida" },
      { texto: "2. Seu trabalho permite flexibilidade para adaptar sua rotina?", logica: "invertida" },
      { texto: "3. Você sente que tem voz ativa na empresa?", logica: "direta" },
      { texto: "4. A empresa confia em sua capacidade de autogestão?", logica: "invertida" },
      { texto: "5. Você recebe instruções claras sobre suas responsabilidades?", logica: "invertida" },
      { texto: "6. O excesso de controle ou burocracia interfere no seu desempenho?", logica: "direta" },
      { texto: "7. Suas sugestões são ouvidas e consideradas pela liderança?", logica: "direta" },
      { texto: "8. Você tem acesso às ferramentas e recursos necessários?", logica: "invertida" },
      { texto: "9. Você pode propor melhorias sem medo de represálias?", logica: "invertida" },
      { texto: "10. O excesso de supervisão impacta sua produtividade ou bem-estar?", logica: "direta" },
    ],
  },
  {
    nome: "Pressão e Metas",
    colunaInicio: 50,
    fonteGeradora:
      "Propósitos financeiros desalinhados com saúde e bem-estar.",
    perguntas: [
      { texto: "1. As metas da empresa são realistas e atingíveis?", logica: "invertida" },
      { texto: "2. Você sente que há pressão excessiva para alcançar resultados?", logica: "direta" },
      { texto: "3. A cobrança por metas impacta sua saúde mental ou emocional?", logica: "direta" },
      { texto: "4. Existe apoio da liderança para lidar com desafios relacionados às metas?", logica: "invertida" },
      { texto: "5. Você pode negociar prazos ou objetivos quando necessário?", logica: "invertida" },
      { texto: "6. A competitividade entre funcionários é estimulada de maneira saudável?", logica: "invertida" },
      { texto: "7. Você já sentiu medo de punição por não atingir metas?", logica: "direta" },
      { texto: "8. O sistema de avaliação de metas é transparente?", logica: "invertida" },
      { texto: "9. Você tem tempo suficiente para cumprir suas demandas com qualidade?", logica: "invertida" },
      { texto: "10. A pressão por resultados impacta negativamente o ambiente de trabalho?", logica: "direta" },
    ],
  },
  {
    nome: "Insegurança e Ameaças",
    colunaInicio: 60,
    fonteGeradora:
      "Gestão não humanizada e falhas na condução de conflitos.",
    perguntas: [
      { texto: "1. Você já sentiu que seu emprego está ameaçado sem justificativa clara?", logica: "direta" },
      { texto: "2. A empresa faz cortes ou demissões repentinas sem aviso prévio?", logica: "direta" },
      { texto: "3. Há comunicação clara sobre a estabilidade da empresa e dos empregos?", logica: "invertida" },
      { texto: "4. Você já sofreu ameaças veladas ou diretas no trabalho?", logica: "direta" },
      { texto: "5. Há transparência nas políticas de desligamento?", logica: "invertida" },
      { texto: "6. Mudanças organizacionais impactaram seu sentimento de segurança?", logica: "direta" },
      { texto: "7. Você já presenciou casos de demissões injustas?", logica: "direta" },
      { texto: "8. O medo da demissão afeta seu desempenho?", logica: "direta" },
      { texto: "9. A empresa oferece suporte psicológico para funcionários inseguros?", logica: "invertida" },
      { texto: "10. Você já evitou expressar sua opinião por medo de represálias?", logica: "direta" },
    ],
  },
  {
    nome: "Conflitos Interpessoais e Falta de Comunicação",
    colunaInicio: 70,
    fonteGeradora:
      "Falta de treinamentos e baixa habilidade de comunicação.",
    perguntas: [
      { texto: "1. Conflitos internos são resolvidos de maneira justa?", logica: "invertida" },
      { texto: "2. A comunicação entre equipes e departamentos é eficiente?", logica: "invertida" },
      { texto: "3. Você já evitou colegas ou superiores devido a desentendimentos?", logica: "direta" },
      { texto: "4. Existe canal aberto para feedback entre colaboradores e liderança?", logica: "invertida" },
      { texto: "5. A falta de comunicação já comprometeu seu trabalho?", logica: "direta" },
      { texto: "6. Você sente que há rivalidade desnecessária entre setores?", logica: "direta" },
      { texto: "7. Há treinamentos sobre comunicação assertiva e gestão de conflitos?", logica: "invertida" },
      { texto: "8. Você pode expressar suas dificuldades sem ser julgado?", logica: "invertida" },
      { texto: "9. A empresa promove ambiente de diálogo aberto?", logica: "invertida" },
      { texto: "10. O RH está presente e atuante na mediação de conflitos?", logica: "invertida" },
    ],
  },
  {
    nome: "Alinhamento entre Vida Pessoal e Profissional",
    colunaInicio: 80,
    fonteGeradora:
      "Falta de tempo, planejamento, incentivo e recursos.",
    perguntas: [
      { texto: "1. Sua jornada de trabalho permite equilíbrio com sua vida pessoal?", logica: "invertida" },
      { texto: "2. Você tem tempo para sua família e lazer?", logica: "invertida" },
      { texto: "3. O trabalho impacta negativamente sua saúde mental?", logica: "direta" },
      { texto: "4. Você tem flexibilidade para lidar com questões pessoais urgentes?", logica: "invertida" },
      { texto: "5. A empresa oferece suporte para equilíbrio entre trabalho e vida pessoal?", logica: "invertida" },
      { texto: "6. Você consegue se desconectar do trabalho fora do expediente?", logica: "invertida" },
      { texto: "7. Sua vida pessoal é respeitada pela empresa?", logica: "invertida" },
      { texto: "8. Há incentivo ao bem-estar e qualidade de vida no trabalho?", logica: "invertida" },
      { texto: "9. O estresse profissional afeta sua vida familiar?", logica: "direta" },
      { texto: "10. O ambiente corporativo valoriza o descanso e recuperação dos funcionários?", logica: "invertida" },
    ],
  },
];

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

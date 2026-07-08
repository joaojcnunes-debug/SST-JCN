import type { Aet13FatorPergunta } from "@/lib/supabase/types";

/**
 * Perguntas padrão dos 13 Fatores Psicossociais (QPS) do AET, com a lógica de pontuação
 * (direta = nota alta é risco → invertida via 6−nota; invertida = nota alta é proteção → nota crua).
 *
 * Usadas como FALLBACK quando a tabela `aet_13fatores_perguntas` está vazia. Fica neste módulo
 * server-safe (sem "use client") para que TANTO a tela (useAet) QUANTO o gerador de PDF
 * (app/api/pdf/aet) apliquem o MESMO fallback — senão o PDF calcula médias cruas (sem inversão)
 * e a seção 10 diverge da seção 11.
 */
export const PERGUNTAS_DEFAULT: Omit<Aet13FatorPergunta, "id" | "updated_at">[] = [
  // F01 — Assédio de qualquer natureza no trabalho
  { codigo_fator: "F01", texto: "Você já presenciou ou sofreu comentários ofensivos, piadas ou insinuações inadequadas no ambiente de trabalho?", logica: "direta", ordem: 1 },
  { codigo_fator: "F01", texto: "Você se sente à vontade para relatar situações de assédio moral ou sexual na empresa sem medo de represálias?", logica: "invertida", ordem: 2 },
  { codigo_fator: "F01", texto: "Existe um canal seguro e sigiloso para denunciar assédio na empresa?", logica: "invertida", ordem: 3 },
  { codigo_fator: "F01", texto: "Há casos conhecidos de assédio moral ou sexual que não foram devidamente investigados ou punidos?", logica: "direta", ordem: 4 },
  { codigo_fator: "F01", texto: "O RH e os gestores demonstram comprometimento real com a prevenção do assédio?", logica: "invertida", ordem: 5 },
  // F02 — Falta de suporte / apoio no trabalho
  { codigo_fator: "F02", texto: "Você sente que pode contar com seus colegas em momentos de dificuldade?", logica: "invertida", ordem: 6 },
  { codigo_fator: "F02", texto: "Existe apoio da liderança para lidar com desafios relacionados ao trabalho?", logica: "invertida", ordem: 7 },
  { codigo_fator: "F02", texto: "O RH está presente e atuante quando surgem conflitos ou dificuldades no trabalho?", logica: "invertida", ordem: 8 },
  { codigo_fator: "F02", texto: "Os gestores promovem um ambiente saudável e respeitoso?", logica: "invertida", ordem: 9 },
  { codigo_fator: "F02", texto: "Você sente que pode expressar suas dificuldades no trabalho sem ser julgado(a)?", logica: "invertida", ordem: 10 },
  // F03 — Má gestão de mudanças organizacionais
  { codigo_fator: "F03", texto: "Mudanças organizacionais impactaram negativamente seu sentimento de segurança no trabalho?", logica: "direta", ordem: 11 },
  { codigo_fator: "F03", texto: "Há comunicação clara sobre mudanças que afetam a empresa ou os trabalhadores?", logica: "invertida", ordem: 12 },
  { codigo_fator: "F03", texto: "Você já sentiu que seu emprego estava ameaçado sem explicações claras durante períodos de mudança?", logica: "direta", ordem: 13 },
  { codigo_fator: "F03", texto: "Existe transparência na comunicação da empresa durante processos de mudança?", logica: "invertida", ordem: 14 },
  // F04 — Baixa clareza de papel / função
  { codigo_fator: "F04", texto: "Você recebe instruções claras sobre suas responsabilidades no trabalho?", logica: "invertida", ordem: 15 },
  { codigo_fator: "F04", texto: "A comunicação da empresa ajuda você a entender o que é esperado do seu trabalho?", logica: "invertida", ordem: 16 },
  { codigo_fator: "F04", texto: "A comunicação entre equipes e setores contribui para a clareza das suas tarefas?", logica: "invertida", ordem: 17 },
  { codigo_fator: "F04", texto: "Você se sente confortável para pedir esclarecimentos quando não entende suas funções ou prioridades?", logica: "invertida", ordem: 18 },
  // F05 — Baixas recompensas e reconhecimento
  { codigo_fator: "F05", texto: "Você sente que seu esforço e desempenho são reconhecidos pela liderança?", logica: "invertida", ordem: 19 },
  { codigo_fator: "F05", texto: "Você recebe feedback construtivo sobre o seu trabalho com regularidade?", logica: "invertida", ordem: 20 },
  { codigo_fator: "F05", texto: "Com que frequência você já se sentiu desmotivado(a) por falta de reconhecimento no trabalho?", logica: "direta", ordem: 21 },
  // F06 — Baixo controle no trabalho / Falta de autonomia
  { codigo_fator: "F06", texto: "Você tem liberdade para tomar decisões sobre como executar suas tarefas diárias?", logica: "invertida", ordem: 22 },
  { codigo_fator: "F06", texto: "A empresa confia na sua capacidade de organizar e gerenciar o próprio trabalho?", logica: "invertida", ordem: 23 },
  { codigo_fator: "F06", texto: "Existe excesso de controle ou burocracia que interfere no seu desempenho?", logica: "direta", ordem: 24 },
  { codigo_fator: "F06", texto: "Existe excesso de supervisão que impacte negativamente sua produtividade ou bem-estar?", logica: "direta", ordem: 25 },
  // F07 — Baixa justiça organizacional
  { codigo_fator: "F07", texto: "Você acha justas e claras as formas que a empresa usa para avaliar o seu trabalho?", logica: "invertida", ordem: 26 },
  { codigo_fator: "F07", texto: "Você sente que há igualdade no reconhecimento entre diferentes áreas ou equipes?", logica: "invertida", ordem: 27 },
  { codigo_fator: "F07", texto: "Você sente que há transparência nas decisões de desligamento na empresa?", logica: "invertida", ordem: 28 },
  { codigo_fator: "F07", texto: "Você já presenciou casos de demissões que considerasse injustas?", logica: "direta", ordem: 29 },
  // F08 — Eventos violentos ou traumáticos
  { codigo_fator: "F08", texto: "Você já vivenciou ou presenciou alguma situação de violência grave no trabalho (como agressão física, ameaça séria ou ataque)?", logica: "direta", ordem: 30 },
  { codigo_fator: "F08", texto: "Você já passou por algum evento grave no trabalho (como acidente sério, situação de risco extremo ou episódio muito impactante)?", logica: "direta", ordem: 31 },
  { codigo_fator: "F08", texto: "Alguma situação vivida no trabalho já foi tão marcante que deixou medo, choque ou forte abalo emocional?", logica: "direta", ordem: 32 },
  // F09 — Baixa demanda no trabalho (Subcarga)
  { codigo_fator: "F09", texto: "Você sente que, na maior parte do tempo, tem pouco trabalho a realizar durante sua jornada?", logica: "direta", ordem: 33 },
  { codigo_fator: "F09", texto: "Você costuma ficar com tempo ocioso no trabalho por falta de tarefas ou demandas claras?", logica: "direta", ordem: 34 },
  { codigo_fator: "F09", texto: "Você sente que suas habilidades ou conhecimentos são pouco utilizados no seu trabalho?", logica: "direta", ordem: 35 },
  { codigo_fator: "F09", texto: "Seu trabalho costuma ser pouco desafiador ou repetitivo a ponto de gerar desânimo?", logica: "direta", ordem: 36 },
  // F10 — Excesso de demandas no trabalho (Sobrecarga)
  { codigo_fator: "F10", texto: "Você sente que sua carga de trabalho diária é maior do que consegue realizar dentro do horário normal?", logica: "direta", ordem: 37 },
  { codigo_fator: "F10", texto: "Você frequentemente precisa fazer horas extras ou levar trabalho para casa?", logica: "direta", ordem: 38 },
  { codigo_fator: "F10", texto: "Você já teve sintomas físicos ou emocionais (como exaustão, ansiedade ou insônia) devido ao excesso de trabalho?", logica: "direta", ordem: 39 },
  { codigo_fator: "F10", texto: "A equipe é dimensionada corretamente para a demanda/quantidade de trabalho existente?", logica: "invertida", ordem: 40 },
  // F11 — Maus relacionamentos no local de trabalho
  { codigo_fator: "F11", texto: "Você já evitou colegas ou superiores por causa de desentendimentos frequentes?", logica: "direta", ordem: 41 },
  { codigo_fator: "F11", texto: "Você percebe rivalidade excessiva ou desnecessária entre colegas ou setores?", logica: "direta", ordem: 42 },
  { codigo_fator: "F11", texto: "Conflitos no trabalho costumam ser resolvidos de forma justa?", logica: "invertida", ordem: 43 },
  // F12 — Trabalho em condições de difícil comunicação
  { codigo_fator: "F12", texto: "Você trabalha em condições (como turnos diferentes, trabalho externo ou distância física) que dificultam a comunicação no trabalho?", logica: "direta", ordem: 44 },
  { codigo_fator: "F12", texto: "A distância física entre você e sua equipe ou liderança dificulta a troca de informações?", logica: "direta", ordem: 45 },
  { codigo_fator: "F12", texto: "Você já teve dificuldade para receber informações importantes no momento certo por causa da organização do trabalho?", logica: "direta", ordem: 46 },
  { codigo_fator: "F12", texto: "Você tem acesso fácil aos meios necessários para se comunicar com colegas e liderança durante o trabalho?", logica: "invertida", ordem: 47 },
  // F13 — Trabalho remoto e isolado
  { codigo_fator: "F13", texto: "Você trabalha grande parte do tempo de forma remota ou sozinho(a), com pouco contato presencial com colegas ou liderança?", logica: "direta", ordem: 48 },
  { codigo_fator: "F13", texto: "Você sente que o trabalho remoto ou isolado faz com que se sinta distante da equipe ou da empresa?", logica: "direta", ordem: 49 },
  { codigo_fator: "F13", texto: "Se você trabalha de forma remota ou isolada, você sente que recebe apoio e acompanhamento adequados da empresa?", logica: "invertida", ordem: 50 },
];

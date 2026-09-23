// Catálogo de itens da NR-12 (Segurança no Trabalho em Máquinas e Equipamentos).
//
// Cada item é um requisito objetivo da norma, agrupado por categoria (seção da
// NR-12). Quando uma Ficha de Máquina é criada, todos os itens deste catálogo
// são COPIADOS pra `apreciacoes_maquinas_itens` no Supabase (snapshot
// regulatório). Alterar este arquivo NÃO afeta apreciações já emitidas —
// mesmo padrão do Relatório de Conformidade NR.
//
// ─────────────────────────────────────────────────────────────────────────────
// REVISÃO DE REFERÊNCIAS — 2026-08-05
//
// Os códigos anteriores (12.6.1, 12.25.1, 12.106.1…) eram da redação da NR-12
// ANTERIOR à Portaria SEPRT n.º 916/2019. A NR-12 vigente se organiza em seções
// de 12.1 a 12.18 e nenhum daqueles códigos existe nela — vários colidiam com
// assunto diferente (o antigo "12.7.1 distância entre máquinas" caía no atual
// 12.7, que é componentes pressurizados).
//
// Cada item foi remapeado ao subitem correto da NR-12 vigente ou, quando o
// requisito NÃO é da NR-12, à norma de origem real (NR-15, NR-17). O código
// antigo fica registrado em `codigo_legado` para rastrear laudos já emitidos.
//
// Conferido linha a linha contra os textos oficiais publicados no gov.br:
//   NR-12 (atualizada 2022, Portaria SEPRT 916/2019 + alterações)
//   NR-17 (atualizada 2022, Portaria MTP 423/2021)
// Onde a norma não sustenta o texto anterior, a descrição diz isso de forma
// explícita (ex.: a NR-12 não fixa prazo de reciclagem nem carga horária).
//
// ⚠️ O Anexo VII da NR-12 ("Máquinas para açougue, mercearia, bares e
// restaurantes") trata nominalmente de serra de fita, amaciador de bife e
// moedor de carne, e traz DISPENSAS que mudam o resultado do checklist nesses
// equipamentos. Onde incide, está anotado na descrição do item.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoriaNR12 =
  | "INSTALACOES"
  | "DISPOSITIVOS"
  | "SISTEMAS_SEGURANCA"
  | "PRESSURIZADOS"
  | "TRANSPORTADORES"
  | "ERGONOMIA"
  | "RISCOS_ADICIONAIS"
  | "MANUTENCAO"
  | "SINALIZACAO"
  | "CAPACITACAO"
  | "PROCEDIMENTOS";

export const CATEGORIAS_NR12_LABELS: Record<CategoriaNR12, string> = {
  INSTALACOES: "Instalações e áreas de trabalho",
  DISPOSITIVOS: "Dispositivos de partida, acionamento e parada",
  SISTEMAS_SEGURANCA: "Sistemas de segurança (proteções e intertravamento)",
  PRESSURIZADOS: "Componentes pressurizados",
  TRANSPORTADORES: "Transportadores de materiais",
  ERGONOMIA: "Aspectos ergonômicos",
  RISCOS_ADICIONAIS: "Riscos adicionais (térmicos, químicos, biológicos)",
  MANUTENCAO: "Manutenção, inspeção e reparos",
  SINALIZACAO: "Sinalização e identificação",
  CAPACITACAO: "Capacitação e qualificação",
  PROCEDIMENTOS: "Procedimentos de trabalho e segurança",
};

/** Ordem visual fixa das categorias (acompanha o fluxo lógico da auditoria). */
export const CATEGORIAS_NR12_ORDEM: CategoriaNR12[] = [
  "INSTALACOES",
  "DISPOSITIVOS",
  "SISTEMAS_SEGURANCA",
  "PRESSURIZADOS",
  "TRANSPORTADORES",
  "ERGONOMIA",
  "RISCOS_ADICIONAIS",
  "MANUTENCAO",
  "SINALIZACAO",
  "CAPACITACAO",
  "PROCEDIMENTOS",
];

export interface ItemCatalogoNR12 {
  codigo: string;
  categoria: CategoriaNR12;
  titulo: string;
  descricao?: string;
  /**
   * Código usado até 2026-08-05 (redação da NR-12 anterior à Portaria
   * 916/2019). Só documenta a correspondência — NÃO é gravado no snapshot.
   * Serve para localizar o mesmo requisito em laudo antigo já emitido.
   */
  codigo_legado?: string;
}

export const CATALOGO_NR12: ItemCatalogoNR12[] = [
  // ===== Instalações e áreas de trabalho — NR-12, 12.2 =====
  {
    // era 12.6.1 — código inexistente; o atual 12.6 é parada de emergência.
    codigo: "12.2.4",
    codigo_legado: "12.6.1",
    categoria: "INSTALACOES",
    titulo: "Piso resistente às cargas e sem risco de acidentes, com entorno desobstruído",
    descricao:
      "12.2.4 — o piso do local onde se instalam as máquinas e o das áreas de circulação devem ser resistentes às cargas a que estão sujeitos e não oferecer riscos de acidentes. 12.2.1.2 — as áreas de circulação devem ser mantidas desobstruídas. Piso nivelado e antiderrapante não são exigências literais da NR-12 vigente, mas atendem ao requisito de não oferecer risco de acidentes — verificação relevante em piso úmido.",
  },
  {
    // era 12.6.2 — a NR-12 vigente não fixa largura em metros.
    codigo: "12.2.1",
    codigo_legado: "12.6.2",
    categoria: "INSTALACOES",
    titulo: "Áreas de circulação demarcadas e dimensionadas",
    descricao:
      "12.2.1 — áreas de circulação demarcadas em conformidade com as normas técnicas oficiais, admitidos marcos, balizas ou outros meios físicos (12.2.1.1). 12.2.3 — áreas de circulação e espaços em torno das máquinas dimensionados de forma que trabalhadores e transportadores se movimentem com segurança. A NR-12 vigente NÃO fixa largura mínima em metros. Anexo VII, item 1.2 — empresas de pequeno porte de açougue, mercearia, bares e restaurantes são dispensadas do item 12.2.1.",
  },
  {
    // era 12.6.3 — iluminância não é objeto da NR-12; e a NBR 5413 foi cancelada.
    codigo: "NR-17 17.8",
    codigo_legado: "12.6.3",
    categoria: "INSTALACOES",
    titulo: "Iluminação adequada no posto de operação e na área de manutenção",
    descricao:
      "Requisito da NR-17. Iluminação apropriada à natureza da atividade; 17.8.2 — projetada e instalada de forma a evitar ofuscamento, reflexos incômodos, sombras e contrastes excessivos; 17.8.3 — níveis mínimos de iluminamento conforme a Norma de Higiene Ocupacional n.º 11 (NHO 11) da Fundacentro, versão 2018. A NBR 5413 foi cancelada e substituída pela ABNT NBR ISO/CIE 8995-1.",
  },
  {
    // era 12.7.1 — colidia com o atual 12.7 (componentes pressurizados).
    codigo: "12.2.2",
    codigo_legado: "12.7.1",
    categoria: "INSTALACOES",
    titulo: "Distância entre máquinas que resguarde a segurança do trabalhador",
    descricao:
      "12.2.2 — a distância mínima entre máquinas, conforme suas características e aplicações, deve resguardar a segurança dos trabalhadores durante operação, manutenção, ajuste, limpeza e inspeção, e permitir a movimentação dos segmentos corporais em face da natureza da tarefa.",
  },

  // ===== Dispositivos de partida, acionamento e parada — NR-12, 12.4 e 12.6 =====
  {
    // era 12.24.1
    codigo: "12.4.1",
    codigo_legado: "12.24.1",
    categoria: "DISPOSITIVOS",
    titulo: "Dispositivos de partida e parada que impeçam acionamento involuntário",
    descricao:
      "12.4.1 — projetados, selecionados e instalados de modo que não se localizem em zonas perigosas ('a'), possam ser acionados ou desligados em emergência por outra pessoa que não o operador ('b'), impeçam acionamento ou desligamento involuntário ou acidental ('c') e não acarretem riscos adicionais ('d'). 12.4.2 — os comandos de partida devem impedir o funcionamento automático ao serem energizados. Acionamento bimanual: 12.4.3 a 12.4.5.",
  },
  {
    // era 12.25.1 — formato/cor do acionador NÃO estão na NR-12.
    codigo: "12.6.1",
    codigo_legado: "12.25.1",
    categoria: "DISPOSITIVOS",
    titulo: "Dispositivo de parada de emergência instalado, acessível e com retenção",
    descricao:
      "12.6.1 — a máquina deve ser equipada com um ou mais dispositivos de parada de emergência. 12.6.2 — posicionados em local de fácil acesso e visualização e mantidos permanentemente desobstruídos. 12.6.3 'c' — acionadores projetados para fácil atuação. 12.6.5 — o acionamento deve resultar na retenção do acionador, que se mantém retido até desacionamento por ação manual intencionada. O formato tipo soco (cogumelo) e as cores vermelho sobre amarelo não constam da NR-12: decorrem de norma técnica (ABNT NBR 13759 / ISO 13850) e da NR-26. Anexo VII, item 3.5 — o amaciador de bifes não necessita de parada de emergência.",
  },
  {
    // era 12.25.2
    codigo: "12.6.3",
    codigo_legado: "12.25.2",
    categoria: "DISPOSITIVOS",
    titulo: "Emergência prevalece sobre os demais comandos e opera em qualquer modo",
    descricao:
      "12.6.3 'd' — prevalecer sobre todos os outros comandos; 'e' — provocar a parada da operação ou processo perigoso em tempo tão reduzido quanto tecnicamente possível, sem riscos suplementares; 'f' — ter sua função disponível e operacional a qualquer tempo, independentemente do modo de operação. Não pode ser anulado por seletor, modo manutenção ou bypass.",
  },
  {
    // era 12.27.1 — o antigo mapa apontava 12.4.2, que trata de partida automática.
    codigo: "12.12.4",
    codigo_legado: "12.27.1",
    categoria: "DISPOSITIVOS",
    titulo: "Comandos identificados por inscrições e símbolos legíveis, em português",
    descricao:
      "12.12.4 — as inscrições das máquinas devem ser escritas na língua portuguesa (Brasil) e ser legíveis; 12.12.4.1 — devem indicar claramente o risco e a parte da máquina a que se referem, não bastando a inscrição 'perigo'. 12.12.3 — símbolos, inscrições e sinais luminosos e sonoros conforme normas técnicas oficiais ou internacionais aplicáveis.",
  },

  // ===== Sistemas de segurança — NR-12, 12.5 =====
  {
    // era 12.38.1
    codigo: "12.5.4",
    codigo_legado: "12.38.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Proteções fixas nas zonas de perigo sem necessidade de acesso frequente",
    descricao:
      "12.5.1 — as zonas de perigo devem possuir sistemas de segurança caracterizados por proteções fixas, móveis e dispositivos de segurança interligados. 12.5.4 'a' — proteção fixa é a mantida em sua posição de maneira permanente ou por elementos de fixação que só permitam remoção ou abertura com o uso de ferramentas.",
  },
  {
    // era 12.38.2 — o 12.5.8 'c' vale para intertravamento COM BLOQUEIO; o caso
    // geral da proteção móvel intertravada é o 12.5.7 'c'.
    codigo: "12.5.7",
    codigo_legado: "12.38.2",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Proteções móveis associadas a dispositivo de intertravamento",
    descricao:
      "12.5.6 — a proteção deve ser móvel quando o acesso à zona de perigo for requerido mais de uma vez por turno, associada a dispositivo de intertravamento ('a') e a intertravamento com bloqueio quando a abertura possibilitar o acesso antes da eliminação do risco ('b'). 12.5.7 — operar somente com as proteções fechadas ('a'), paralisar as funções perigosas quando abertas durante a operação ('b') e garantir que o fechamento por si só não dê início às funções perigosas ('c'). Intertravamento com bloqueio: 12.5.8.",
  },
  {
    // era 12.41.1
    codigo: "12.5.2 a",
    codigo_legado: "12.41.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Dispositivos de segurança com categoria compatível com a apreciação de riscos",
    descricao:
      "12.5.2 'a' — categoria de segurança conforme apreciação de riscos prevista nas normas técnicas oficiais; 'b' — sob responsabilidade técnica de profissional legalmente habilitado; 'c' — conformidade técnica com o sistema de comando a que são integrados; 'd' — instalação que dificulte a burla. As categorias B, 1, 2, 3 e 4 são definidas pela ABNT NBR 14153; máquinas fabricadas de acordo com a NBR ISO 13849, partes 1 e 2, são consideradas em conformidade quanto às partes de comando relacionadas à segurança (12.1.11).",
  },
  {
    // era 12.42.1 — o antigo mapa apontava 12.5.5, que trata de flutuação de energia.
    codigo: "12.5.2 e",
    codigo_legado: "12.42.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Monitoramento do sistema de segurança e paralisação segura em caso de falha",
    descricao:
      "12.5.2 'e' — sistemas mantidos sob vigilância automática (monitoramento), se indicado pela apreciação de risco e de acordo com a categoria de segurança requerida, exceto dispositivos exclusivamente mecânicos; 'f' — paralisação dos movimentos perigosos e demais riscos quando ocorrerem falhas ou situações anormais de trabalho. 12.5.5 — manutenção do estado seguro diante de flutuação, corte e restabelecimento do fornecimento de energia. 12.5.3 — rearme ('reset') manual quando indicado pela apreciação de riscos.",
  },
  {
    // era 12.45.1 — a NBR NM 272 não trata de distância de segurança (é projeto
    // e construção de proteções) e não é citada em nenhum ponto da NR-12.
    codigo: "12.5.1.1",
    codigo_legado: "12.45.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Distâncias de segurança respeitadas nas proteções e nos detectores",
    descricao:
      "12.5.1.1 — quando utilizadas proteções que restringem o acesso do corpo ou de parte dele, devem ser observadas as distâncias mínimas conforme normas técnicas oficiais ou internacionais aplicáveis: ABNT NBR NM-ISO 13852 (membros superiores) e ABNT NBR NM-ISO 13853 (membros inferiores), reunidas na EN ISO 13857:2008. Detectores de presença optoeletrônicos: Anexo I da NR-12.",
  },

  // ===== Componentes pressurizados — NR-12, 12.7 =====
  {
    // era 12.106.1
    codigo: "12.7.1",
    codigo_legado: "12.106.1",
    categoria: "PRESSURIZADOS",
    titulo: "Mangueiras, tubulações e conexões protegidas e com pressão indicada",
    descricao:
      "12.7.1 — medidas adicionais de proteção de mangueiras, tubulações e demais componentes pressurizados sujeitos a impactos mecânicos e outros agentes agressivos, quando houver risco. 12.7.2 — localizados ou protegidos de tal forma que ruptura e vazamento de fluidos não possam ocasionar acidentes. 12.7.3 — mangueiras com indicação da pressão máxima de trabalho admissível especificada pelo fabricante.",
  },
  {
    // era 12.106.2
    codigo: "12.7.4",
    codigo_legado: "12.106.2",
    categoria: "PRESSURIZADOS",
    titulo: "Meios que impeçam exceder a pressão máxima admissível",
    descricao:
      "12.7.4 — os sistemas pressurizados devem possuir meios ou dispositivos destinados a garantir que a pressão máxima de trabalho admissível nos circuitos não possa ser excedida ('a') e que quedas de pressão progressivas ou bruscas e perdas de vácuo não possam gerar perigo ('b').",
  },
  {
    // era 12.108.1
    codigo: "12.7.5",
    codigo_legado: "12.108.1",
    categoria: "PRESSURIZADOS",
    titulo: "Pressão residual sem risco após o isolamento das fontes de energia",
    descricao:
      "12.7.5 — quando as fontes de energia da máquina forem isoladas, a pressão residual dos reservatórios e de depósitos similares, como os acumuladores hidropneumáticos, não pode gerar risco de acidentes.",
  },

  // ===== Transportadores de materiais — NR-12, 12.8 (e 12.6.6) =====
  {
    // era 12.112.1 — o antigo mapa apontava 12.8.2, que trata de PASSARELAS em
    // correia com borda acima de 2,70 m.
    codigo: "12.6.6",
    codigo_legado: "12.112.1",
    categoria: "TRANSPORTADORES",
    titulo: "Acionadores tipo cabo de parada de emergência ao longo do percurso",
    descricao:
      "12.6.6 — quando usados acionadores do tipo cabo, deve-se utilizar chaves de parada de emergência que trabalhem tracionadas, de modo a cessarem automaticamente as funções perigosas em caso de ruptura ou afrouxamento dos cabos ('a'); considerar o deslocamento e a força aplicada nos acionadores ('b'); e obedecer à distância máxima entre chaves recomendada pelo fabricante ('c').",
  },
  {
    // era 12.112.2
    codigo: "12.8.1",
    codigo_legado: "12.112.2",
    categoria: "TRANSPORTADORES",
    titulo: "Movimentos perigosos do transportador protegidos",
    descricao:
      "12.8.1 — os movimentos perigosos dos transportadores contínuos de materiais, acessíveis durante a operação normal, devem ser protegidos, especialmente nos pontos de esmagamento, agarramento e aprisionamento.",
  },

  // ===== Aspectos ergonômicos — NR-12, 12.9 (remete à NR-17) =====
  {
    // era 12.93.1
    codigo: "12.9.1",
    codigo_legado: "12.93.1",
    categoria: "ERGONOMIA",
    titulo: "Posto de operação que permita postura adequada",
    descricao:
      "12.9.1 — para o trabalho em máquinas e equipamentos devem ser respeitadas as disposições da NR-17. Mobiliário com regulagens que o adaptem às características antropométricas dos trabalhadores (NR-17 17.6.1); posto planejado ou adaptado para favorecer a alternância entre as posições em pé e sentada, sempre que possível (17.6.2); planos de trabalho que proporcionem boa postura, visualização e operação (17.6.3).",
  },
  {
    // era 12.93.2 — o antigo mapa citava "12.9.1 g/h": o 12.9.1 NÃO tem alíneas.
    codigo: "NR-17 17.6.5",
    codigo_legado: "12.93.2",
    categoria: "ERGONOMIA",
    titulo: "Comandos e pedais posicionados para evitar esforços e torções repetidas",
    descricao:
      "NR-17 17.6.5 — os pedais e demais comandos para acionamento pelos pés devem ter posicionamento e dimensões que possibilitem fácil alcance, além de atender aos requisitos do item 17.6.3. A proteção do pedal contra acionamento involuntário decorre da NR-12, 12.4.1 'c'.",
  },
  {
    // era 12.94.1
    codigo: "NR-17 17.6.7",
    codigo_legado: "12.94.1",
    categoria: "ERGONOMIA",
    titulo: "Assentos com encosto para descanso no trabalho realizado em pé",
    descricao:
      "Requisito da NR-17. Para as atividades em que os trabalhos devam ser realizados em pé, devem ser colocados assentos com encosto para descanso em locais em que possam ser utilizados pelos trabalhadores durante as pausas; esses assentos ficam dispensados dos requisitos do item 17.6.6 (17.6.7.1).",
  },

  // ===== Riscos adicionais — NR-12, 12.10 =====
  {
    // era 12.85.1
    codigo: "12.10.1 f",
    codigo_legado: "12.85.1",
    categoria: "RISCOS_ADICIONAIS",
    titulo: "Superfícies quentes acessíveis isoladas ou sinalizadas",
    descricao:
      "12.10.1 'f' — o calor é risco adicional para fins de aplicação da NR-12. 12.10.2 — devem ser adotadas medidas de controle dos riscos adicionais provenientes da emissão ou liberação de agentes físicos, com prioridade à eliminação, à redução da emissão e à redução da exposição. Sinalização conforme o item 12.12.",
  },
  {
    // era 12.85.2
    codigo: "12.10.2",
    codigo_legado: "12.85.2",
    categoria: "RISCOS_ADICIONAIS",
    titulo: "Controle das emissões de agentes químicos geradas pela máquina",
    descricao:
      "12.10.1 'a' — substâncias perigosas, agentes biológicos ou químicos em qualquer estado, são riscos adicionais para fins da NR-12. 12.10.2 — medidas de controle com prioridade à eliminação, à redução da emissão ou liberação e à redução da exposição dos trabalhadores, conforme a NR-09 (redação da Portaria MTP n.º 806/2022). Captação na fonte quando aplicável.",
  },
  {
    // era 12.87.1 — o ruído É risco adicional na NR-12; o que não é da NR-12 é o
    // LIMITE DE TOLERÂNCIA.
    codigo: "12.10.1 e",
    codigo_legado: "12.87.1",
    categoria: "RISCOS_ADICIONAIS",
    titulo: "Exposição a ruído gerada pela máquina avaliada e controlada",
    descricao:
      "12.10.1 'e' — o ruído é risco adicional para fins de aplicação da NR-12, com medidas de controle pelo item 12.10.2 e pela NR-09. O limite de tolerância — 85 dB(A) para jornada de 8 horas — é da NR-15, Anexo 1: a NR-12 não fixa limite de exposição.",
  },

  // ===== Manutenção, inspeção e reparos — NR-12, 12.11 =====
  {
    // era 12.131.1
    codigo: "12.11.3 b",
    codigo_legado: "12.131.1",
    categoria: "MANUTENCAO",
    titulo: "Bloqueio e etiquetagem (LOTO) de todas as fontes de energia",
    descricao:
      "12.11.3 — intervenções executadas por profissionais capacitados, qualificados ou legalmente habilitados, formalmente autorizados pelo empregador, com as máquinas paradas, adotando: 'a' isolamento e descarga de todas as fontes de energia, de modo visível ou facilmente identificável; 'b' bloqueio mecânico e elétrico na posição 'desligado' ou 'fechado' de todos os dispositivos de corte, a fim de impedir a reenergização, e sinalização com cartão ou etiqueta de bloqueio contendo o horário e a data do bloqueio, o motivo da manutenção e o nome do responsável.",
  },
  {
    // era 12.131.2
    codigo: "12.11.2",
    codigo_legado: "12.131.2",
    categoria: "MANUTENCAO",
    titulo: "Registro das manutenções mantido e disponível",
    descricao:
      "12.11.2 — manutenções registradas em livro próprio, ficha ou sistema informatizado, com intervenções realizadas, data, serviço executado, peças reparadas ou substituídas, condições de segurança do equipamento, indicação conclusiva quanto às condições de segurança da máquina e nome do responsável. 12.11.2.1 — registro disponível aos trabalhadores envolvidos, à CIPA, ao SESMT e à Auditoria Fiscal do Trabalho. 12.11.2.2 'a' — manutenções preventivas de itens que influenciem na segurança devem possuir cronograma de execução.",
  },
  {
    // era 12.131.3
    codigo: "12.11.1",
    codigo_legado: "12.131.3",
    categoria: "MANUTENCAO",
    titulo: "Manutenção na periodicidade do fabricante, por profissional habilitado ou qualificado",
    descricao:
      "12.11.1 — as máquinas devem ser submetidas a manutenções na forma e periodicidade determinadas pelo fabricante, por profissional legalmente habilitado ou por profissional qualificado, conforme normas técnicas oficiais ou internacionais aplicáveis. Capacitação exigida também de prestadores externos: item 12.16.",
  },
  {
    // era 12.140.1 — o antigo mapa apontava 12.11.2 'a', que é campo do REGISTRO
    // ("intervenções realizadas"), não requisito de inspeção.
    codigo: "12.11.2 f",
    codigo_legado: "12.140.1",
    categoria: "MANUTENCAO",
    titulo: "Inspeção periódica das proteções e dispositivos de segurança",
    descricao:
      "A periodicidade decorre do item 12.11.1 (forma e periodicidade determinadas pelo fabricante ou por norma técnica). O registro deve conter as condições de segurança do equipamento (12.11.2 'e') e indicação conclusiva quanto às condições de segurança da máquina (12.11.2 'f'), com as não conformidades encontradas.",
  },

  // ===== Sinalização e identificação — NR-12, 12.12 =====
  {
    // era 12.116.1 — o antigo mapa apontava 12.12.4 (inscrições em português).
    codigo: "12.12.7",
    codigo_legado: "12.116.1",
    categoria: "SINALIZACAO",
    titulo: "Informações indeléveis de identificação da máquina em local visível",
    descricao:
      "12.12.7 — máquinas fabricadas a partir de 24/12/2011 devem possuir em local visível, de forma indelével: razão social, CNPJ e endereço do fabricante ou importador; tipo, modelo e capacidade; número de série ou identificação e ano de fabricação; número de registro do fabricante/importador ou do profissional legalmente habilitado no CREA; e peso. 12.12.7.1 — máquinas fabricadas ANTES de 24/12/2011 devem possuir apenas tipo, modelo e capacidade e o número de série ou, quando inexistente, identificação atribuída pela empresa.",
  },
  {
    // era 12.117.1 — nem "NR-26" nem "NBR 7195" aparecem no texto da NR-12.
    codigo: "12.12.1",
    codigo_legado: "12.117.1",
    categoria: "SINALIZACAO",
    titulo: "Sinalização de segurança advertindo sobre os riscos",
    descricao:
      "12.12.1 — as máquinas e as instalações em que se encontram devem possuir sinalização de segurança para advertir trabalhadores e terceiros sobre os riscos a que estão expostos, as instruções de operação e manutenção e demais informações necessárias. 12.12.2 — a sinalização deve ficar destacada na máquina, em localização claramente visível e ser de fácil compreensão. 12.12.3 — símbolos, inscrições e sinais conforme normas técnicas oficiais ou internacionais aplicáveis. Cores de segurança conforme a NR-26.",
  },
  {
    // era 12.118.1
    codigo: "12.12.5",
    codigo_legado: "12.118.1",
    categoria: "SINALIZACAO",
    titulo: "Inscrições e sinais indicando limitações técnicas e eventos perigosos",
    descricao:
      "12.12.5 — inscrições e símbolos utilizados para indicar as especificações e limitações técnicas fundamentais à segurança. 12.12.6 — sinais ativos de aviso ou alerta, como sinais luminosos e sonoros intermitentes, sempre que necessário, indicando a iminência ou a ocorrência de evento perigoso, como a partida, a parada ou a velocidade excessiva, de modo que não sejam ambíguos ('a') e possam ser inequivocamente reconhecidos pelos trabalhadores ('b').",
  },

  // ===== Capacitação e qualificação — NR-12, 12.16 =====
  {
    // era 12.135.1 — a NR-12 NÃO fixa carga horária.
    codigo: "12.16.3",
    codigo_legado: "12.135.1",
    categoria: "CAPACITACAO",
    titulo: "Operadores capacitados antes de assumir a função",
    descricao:
      "12.16.2 — capacitação providenciada pelo empregador, compatível com as funções, abordando os riscos a que os trabalhadores estão expostos e as medidas de proteção. 12.16.3 — deve ocorrer antes que o trabalhador assuma a função ('a'), ser realizada sem ônus para o trabalhador ('b'), ter carga horária mínima definida pelo empregador e ser realizada durante a jornada de trabalho ('c'), ter conteúdo programático conforme o Anexo II da NR-12 ('d') e supervisão de profissional legalmente habilitado ('e'). A NR-12 não fixa número de horas.",
  },
  {
    // era 12.135.2 — a descrição anterior dizia "mínimo a cada 2 anos": a NR-12
    // não estabelece prazo fixo. Periodicidade bienal é de outras NRs.
    codigo: "12.16.8",
    codigo_legado: "12.135.2",
    categoria: "CAPACITACAO",
    titulo: "Reciclagem sempre que houver mudança que implique novos riscos",
    descricao:
      "12.16.8 — deve ser realizada capacitação para reciclagem sempre que ocorrerem modificações significativas nas instalações e na operação de máquinas ou troca de métodos, processos e organização do trabalho que impliquem novos riscos. 12.16.8.1 — conteúdo programático adequado à situação que a motivou, com carga horária mínima definida pelo empregador e dentro da jornada de trabalho. A NR-12 NÃO estabelece prazo fixo de reciclagem.",
  },
  {
    // era 12.137.1 — o antigo mapa citava "12.16.1 b/c": o 12.16.1 NÃO tem alíneas.
    codigo: "12.16.1",
    codigo_legado: "12.137.1",
    categoria: "CAPACITACAO",
    titulo: "Intervenções realizadas por trabalhador autorizado para a função",
    descricao:
      "12.16.1 — a operação, a manutenção, a inspeção e demais intervenções em máquinas devem ser realizadas por trabalhadores habilitados, qualificados ou capacitados, e autorizados para este fim. 12.16.2 — capacitação compatível com as funções exercidas, distinguindo operação, manutenção e preparação.",
  },

  // ===== Procedimentos de trabalho e segurança — NR-12, 12.13, 12.14 e 12.1.9 =====
  {
    // era 12.130.1
    codigo: "12.13.1",
    codigo_legado: "12.130.1",
    categoria: "PROCEDIMENTOS",
    titulo: "Manual de instruções do fabricante disponível e em português",
    descricao:
      "12.13.1 — as máquinas devem possuir manual de instruções fornecido pelo fabricante ou importador, com informações relativas à segurança em todas as fases de utilização. 12.13.2 — os manuais devem ser escritos em língua portuguesa (Brasil), com legibilidade e ilustrações explicativas ('a'), ser objetivos e sem ambiguidades ('b'), ter sinais e avisos de segurança realçados ('c') e permanecer disponíveis a todos os usuários nos locais de trabalho ('d').",
  },
  {
    // era 12.130.2
    codigo: "12.14.1",
    codigo_legado: "12.130.2",
    categoria: "PROCEDIMENTOS",
    titulo: "Procedimentos de trabalho e segurança específicos e padronizados",
    descricao:
      "12.14.1 — devem ser elaborados procedimentos de trabalho e segurança para máquinas e equipamentos, específicos e padronizados, a partir da apreciação de riscos. 12.14.1.1 — os procedimentos não podem ser as únicas medidas de proteção adotadas, sendo complementos e não substitutos das medidas de proteção coletiva. Abrangem partida, parada normal e emergencial, limpeza, ajustes e troca de ferramental.",
  },
  {
    // era 12.132.1
    codigo: "12.1.9",
    codigo_legado: "12.132.1",
    categoria: "PROCEDIMENTOS",
    titulo: "Apreciação de riscos documentada e considerada nas medidas adotadas",
    descricao:
      "12.1.9 — na aplicação da NR-12 e de seus anexos devem ser consideradas as características das máquinas e equipamentos, do processo, a apreciação de riscos e o estado da técnica. 12.1.9.1 — a adoção de sistemas de segurança nas zonas de perigo deve considerá-la. Método conforme ABNT NBR ISO 12100 (princípios gerais de projeto, apreciação e redução de riscos) e ABNT NBR ISO/TR 14121-2 (guia prático e exemplos de métodos).",
  },
];

/** Retorna o catálogo agrupado por categoria, na ordem fixa de exibição. */
export function catalogoNR12PorCategoria(): Array<{
  categoria: CategoriaNR12;
  label: string;
  itens: ItemCatalogoNR12[];
}> {
  return CATEGORIAS_NR12_ORDEM.map((cat) => ({
    categoria: cat,
    label: CATEGORIAS_NR12_LABELS[cat],
    itens: CATALOGO_NR12.filter((i) => i.categoria === cat),
  })).filter((g) => g.itens.length > 0);
}

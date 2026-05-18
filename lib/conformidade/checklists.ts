// Catálogo de checklists de conformidade por NR.
//
// Cada item representa um requisito objetivo da norma que pode ser
// avaliado como: CONFORME / NÃO APLICÁVEL / PENDENTE.
//
// Quando um Relatório de Conformidade é criado, os itens da NR escolhida
// são COPIADOS pra tabela `relatorios_conformidade_itens` no Supabase.
// Mudanças futuras neste catálogo NÃO afetam relatórios já emitidos
// (snapshot regulatório na data da auditoria).
//
// Os textos dos itens são resumos práticos pra checklist de auditoria —
// não substituem a leitura integral da norma vigente. Fonte: textos
// consolidados publicados pelo MTE/Subsecretaria de Inspeção do Trabalho.

export interface ChecklistItem {
  /** Código do item (ex: "24.1.2") — usado pra ordenar e referenciar. */
  codigo: string;
  /** Resumo objetivo do requisito (1 linha). */
  titulo: string;
  /** Detalhamento opcional (limites, exceções, observações práticas). */
  descricao?: string;
}

export interface ChecklistNR {
  /** Ex: "NR-24" */
  codigo: string;
  /** Título oficial da norma. */
  titulo: string;
  /** Subtítulo descritivo (pra UI). */
  resumo: string;
  itens: ChecklistItem[];
}

export const CHECKLISTS_NR: ChecklistNR[] = [
  // =========================================================
  {
    codigo: "NR-01",
    titulo: "Disposições Gerais e Gerenciamento de Riscos Ocupacionais",
    resumo: "GRO / PGR / treinamentos / direitos e deveres",
    itens: [
      {
        codigo: "1.1",
        titulo: "Programa de Gerenciamento de Riscos (PGR) elaborado e atualizado",
        descricao: "PGR documentado, com inventário de riscos e plano de ação vigentes.",
      },
      {
        codigo: "1.2",
        titulo: "Inventário de Riscos Ocupacionais (IRO) consolidado",
        descricao: "Identificação, avaliação e classificação de riscos por GHE/cargo/setor.",
      },
      {
        codigo: "1.3",
        titulo: "Plano de Ação do PGR com prazos e responsáveis",
      },
      {
        codigo: "1.4",
        titulo: "Treinamentos obrigatórios em dia (admissional/periódico/eventual)",
      },
      {
        codigo: "1.5",
        titulo: "Ordens de Serviço (OS) emitidas e entregues aos trabalhadores",
        descricao: "Comprovação de recebimento por assinatura ou meio digital.",
      },
      {
        codigo: "1.6",
        titulo: "Procedimentos para situações de risco grave e iminente definidos",
      },
      {
        codigo: "1.7",
        titulo: "Comunicação de Acidente de Trabalho (CAT) emitida quando aplicável",
      },
      {
        codigo: "1.8",
        titulo: "Levantamento preliminar de perigos realizado antes de novas atividades",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-05",
    titulo: "Comissão Interna de Prevenção de Acidentes (CIPA)",
    resumo: "Constituição, eleição e funcionamento da CIPA",
    itens: [
      {
        codigo: "5.1",
        titulo: "CIPA constituída conforme dimensionamento do Quadro I da NR-5",
        descricao: "Nº de membros titulares e suplentes conforme grau de risco e nº de empregados.",
      },
      {
        codigo: "5.2",
        titulo: "Processo eleitoral documentado e válido",
        descricao: "Edital, inscrições, votação por escrutínio secreto, ata e posse.",
      },
      {
        codigo: "5.3",
        titulo: "Treinamento dos membros da CIPA realizado (20h)",
      },
      {
        codigo: "5.4",
        titulo: "Reuniões mensais ordinárias da CIPA documentadas em ata",
      },
      {
        codigo: "5.5",
        titulo: "Mapa de Riscos elaborado pela CIPA e afixado nos setores",
      },
      {
        codigo: "5.6",
        titulo: "Estabilidade do membro da CIPA garantida",
        descricao: "Vedada dispensa arbitrária do registro da candidatura até 1 ano após o mandato.",
      },
      {
        codigo: "5.7",
        titulo: "SIPAT — Semana Interna de Prevenção de Acidentes do Trabalho — realizada anualmente",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-06",
    titulo: "Equipamento de Proteção Individual (EPI)",
    resumo: "Fornecimento, treinamento, CA e controle de uso",
    itens: [
      {
        codigo: "6.1",
        titulo: "EPIs adequados aos riscos disponíveis e fornecidos gratuitamente",
      },
      {
        codigo: "6.2",
        titulo: "Todos os EPIs com Certificado de Aprovação (CA) válido",
        descricao: "CA dentro da validade emitido pelo órgão competente do MTE.",
      },
      {
        codigo: "6.3",
        titulo: "Ficha de controle de EPI individual por trabalhador",
        descricao: "Com data de entrega, modelo, nº do CA e assinatura/digital.",
      },
      {
        codigo: "6.4",
        titulo: "Treinamento sobre uso, guarda e conservação do EPI ministrado",
      },
      {
        codigo: "6.5",
        titulo: "Higienização e substituição periódica dos EPIs realizada",
      },
      {
        codigo: "6.6",
        titulo: "Fiscalização do uso correto dos EPIs em campo",
      },
      {
        codigo: "6.7",
        titulo: "EPIs com prazo de validade dentro do recomendado pelo fabricante",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-07",
    titulo: "Programa de Controle Médico de Saúde Ocupacional (PCMSO)",
    resumo: "Exames ocupacionais e gestão da saúde",
    itens: [
      {
        codigo: "7.1",
        titulo: "PCMSO elaborado por médico do trabalho e atualizado",
      },
      {
        codigo: "7.2",
        titulo: "Exames admissionais realizados antes do início das atividades",
      },
      {
        codigo: "7.3",
        titulo: "Exames periódicos realizados nos prazos previstos no PCMSO",
      },
      {
        codigo: "7.4",
        titulo: "Exames de retorno ao trabalho realizados após afastamento >30 dias",
      },
      {
        codigo: "7.5",
        titulo: "Exames de mudança de função realizados quando há alteração de risco",
      },
      {
        codigo: "7.6",
        titulo: "Exames demissionais realizados",
      },
      {
        codigo: "7.7",
        titulo: "Atestados de Saúde Ocupacional (ASO) arquivados",
      },
      {
        codigo: "7.8",
        titulo: "Relatório anual do PCMSO emitido",
      },
      {
        codigo: "7.9",
        titulo: "Primeiros socorros — material e treinamento disponíveis no local de trabalho",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-09",
    titulo: "Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos",
    resumo: "Avaliações ambientais e medidas de controle",
    itens: [
      {
        codigo: "9.1",
        titulo: "Antecipação e reconhecimento dos riscos ambientais realizados",
      },
      {
        codigo: "9.2",
        titulo: "Avaliações quantitativas dos agentes (ruído, calor, químicos) documentadas",
      },
      {
        codigo: "9.3",
        titulo: "Medidas de controle de engenharia priorizadas antes de EPI",
      },
      {
        codigo: "9.4",
        titulo: "Limites de exposição ocupacional respeitados",
        descricao: "Conforme NR-15, ACGIH-TLV ou outros critérios técnicos aplicáveis.",
      },
      {
        codigo: "9.5",
        titulo: "Monitoramento periódico das exposições realizado",
      },
      {
        codigo: "9.6",
        titulo: "Trabalhadores informados sobre os riscos e medidas de proteção",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-10",
    titulo: "Segurança em Instalações e Serviços em Eletricidade",
    resumo: "Trabalhos com eletricidade — SEP / BT / AT",
    itens: [
      {
        codigo: "10.1",
        titulo: "Prontuário das Instalações Elétricas (PIE) elaborado e atualizado",
      },
      {
        codigo: "10.2",
        titulo: "Trabalhadores qualificados/habilitados/capacitados/autorizados conforme a tarefa",
      },
      {
        codigo: "10.3",
        titulo: "Curso básico (40h) de NR-10 realizado pelos trabalhadores",
      },
      {
        codigo: "10.4",
        titulo: "Curso complementar SEP (40h) para trabalho em Sistema Elétrico de Potência",
      },
      {
        codigo: "10.5",
        titulo: "Procedimentos de desenergização e bloqueio (LOTO) implementados",
      },
      {
        codigo: "10.6",
        titulo: "EPIs e EPCs específicos para risco elétrico disponíveis e em uso",
        descricao: "Luvas isolantes, capacete classe B, vestimenta com proteção arco elétrico, etc.",
      },
      {
        codigo: "10.7",
        titulo: "Sinalização de segurança nas instalações elétricas",
      },
      {
        codigo: "10.8",
        titulo: "Análise de Risco (AR) elaborada para serviços em eletricidade",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-12",
    titulo: "Segurança no Trabalho em Máquinas e Equipamentos",
    resumo: "Proteções, dispositivos de segurança e manuais",
    itens: [
      {
        codigo: "12.1",
        titulo: "Inventário de máquinas e equipamentos atualizado",
      },
      {
        codigo: "12.2",
        titulo: "Proteções fixas e móveis instaladas nas zonas de perigo",
      },
      {
        codigo: "12.3",
        titulo: "Dispositivos de parada de emergência acessíveis e funcionais",
      },
      {
        codigo: "12.4",
        titulo: "Manuais de instrução das máquinas em português, disponíveis aos operadores",
      },
      {
        codigo: "12.5",
        titulo: "Treinamento específico para operação segura de cada máquina",
      },
      {
        codigo: "12.6",
        titulo: "Procedimentos de bloqueio/etiquetagem (LOTO) durante manutenção",
      },
      {
        codigo: "12.7",
        titulo: "Análise de Risco realizada para cada máquina ou conjunto",
      },
      {
        codigo: "12.8",
        titulo: "Inspeção periódica e manutenção preventiva documentadas",
      },
      {
        codigo: "12.9",
        titulo: "Sinalização de segurança nas máquinas (riscos, EPIs obrigatórios)",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-17",
    titulo: "Ergonomia",
    resumo: "AEP / AET / mobiliário / pausas / levantamento de cargas",
    itens: [
      {
        codigo: "17.1",
        titulo: "Avaliação Ergonômica Preliminar (AEP) realizada para todas as atividades",
      },
      {
        codigo: "17.2",
        titulo: "Análise Ergonômica do Trabalho (AET) realizada quando a AEP indica necessidade",
      },
      {
        codigo: "17.3",
        titulo: "Mobiliário do posto de trabalho adequado (cadeira regulável, mesa, apoio de pés)",
      },
      {
        codigo: "17.4",
        titulo: "Monitor/tela posicionados conforme distância e altura ergonômica",
      },
      {
        codigo: "17.5",
        titulo: "Iluminação adequada à tarefa (sem ofuscamento, luminância apropriada)",
      },
      {
        codigo: "17.6",
        titulo: "Conforto térmico e acústico aceitáveis",
      },
      {
        codigo: "17.7",
        titulo: "Levantamento manual de cargas dentro dos limites da NR-17/ISO 11228",
      },
      {
        codigo: "17.8",
        titulo: "Pausas e revezamento implementados em atividades repetitivas/intensas",
      },
      {
        codigo: "17.9",
        titulo: "Treinamento ergonômico ministrado aos trabalhadores",
      },
      {
        codigo: "17.10",
        titulo: "Trabalho em teleatendimento — pausas e limites de jornada respeitados (Anexo II)",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-20",
    titulo: "Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis",
    resumo: "Classificação, plano de emergência e treinamentos",
    itens: [
      {
        codigo: "20.1",
        titulo: "Classificação das instalações (Classe I, II ou III) realizada",
      },
      {
        codigo: "20.2",
        titulo: "Projeto de instalação aprovado conforme normas técnicas",
      },
      {
        codigo: "20.3",
        titulo: "Análise de Risco e/ou Estudo de Análise de Riscos (EAR) elaborados",
      },
      {
        codigo: "20.4",
        titulo: "Plano de Resposta a Emergências (PRE) documentado e divulgado",
      },
      {
        codigo: "20.5",
        titulo: "Treinamentos básico/intermediário/avançado/específico realizados conforme classe",
      },
      {
        codigo: "20.6",
        titulo: "Permissão de Trabalho (PT) emitida para trabalhos a quente em áreas classificadas",
      },
      {
        codigo: "20.7",
        titulo: "Equipamentos elétricos adequados à classificação de área (Ex-proof)",
      },
      {
        codigo: "20.8",
        titulo: "Sistemas de detecção de gás inflamável instalados e operantes",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-23",
    titulo: "Proteção Contra Incêndios",
    resumo: "Extintores, saídas, brigada e sinalização",
    itens: [
      {
        codigo: "23.1",
        titulo: "Extintores em quantidade e tipo adequados ao risco do local",
      },
      {
        codigo: "23.2",
        titulo: "Extintores inspecionados e dentro da validade",
      },
      {
        codigo: "23.3",
        titulo: "Saídas de emergência sinalizadas, desobstruídas e com abertura no sentido do fluxo",
      },
      {
        codigo: "23.4",
        titulo: "Rotas de fuga sinalizadas com placas fotoluminescentes",
      },
      {
        codigo: "23.5",
        titulo: "Iluminação de emergência funcional nas rotas de fuga",
      },
      {
        codigo: "23.6",
        titulo: "Brigada de incêndio constituída e treinada",
      },
      {
        codigo: "23.7",
        titulo: "Plano de Emergência elaborado e exercícios simulados realizados",
      },
      {
        codigo: "23.8",
        titulo: "AVCB / CLCB (Auto de Vistoria do Corpo de Bombeiros) válido",
      },
      {
        codigo: "23.9",
        titulo: "Hidrantes, mangueiras e bombas de incêndio em condições operacionais",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-24",
    titulo: "Condições Sanitárias e de Conforto nos Locais de Trabalho",
    resumo: "Sanitários, vestiários, refeitórios e água potável",
    itens: [
      {
        codigo: "24.1",
        titulo: "Instalações sanitárias separadas por sexo",
      },
      {
        codigo: "24.2",
        titulo: "Vasos sanitários — 1 para cada 20 trabalhadores ou fração",
      },
      {
        codigo: "24.3",
        titulo: "Mictórios — 1 para cada 10 homens ou fração (substituíveis por vasos)",
      },
      {
        codigo: "24.4",
        titulo: "Lavatórios — 1 para cada 10 trabalhadores ou fração",
      },
      {
        codigo: "24.5",
        titulo: "Chuveiros — 1 para cada 10 trabalhadores quando obrigatório",
        descricao: "Obrigatório em atividades insalubres ou com sujidade intensa.",
      },
      {
        codigo: "24.6",
        titulo: "Vestiários adequados quando exige troca de roupa",
        descricao: "Armários individuais, bancos, ventilação e separação por sexo.",
      },
      {
        codigo: "24.7",
        titulo: "Água potável disponível e em quantidade suficiente",
      },
      {
        codigo: "24.8",
        titulo: "Refeitório fornecido quando há 30 ou mais trabalhadores",
      },
      {
        codigo: "24.9",
        titulo: "Refeitório com mesas, assentos, lavatórios e iluminação adequados",
      },
      {
        codigo: "24.10",
        titulo: "Local específico para aquecimento de marmitas (geladeira/micro-ondas) quando aplicável",
      },
      {
        codigo: "24.11",
        titulo: "Áreas de vivência separadas dos locais de trabalho insalubre",
      },
      {
        codigo: "24.12",
        titulo: "Higienização diária dos sanitários, vestiários e refeitórios",
      },
      {
        codigo: "24.13",
        titulo: "Iluminação e ventilação adequadas em todas as áreas de vivência",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-26",
    titulo: "Sinalização de Segurança",
    resumo: "Cores, rótulos, FISPQ e identificação de tubulações",
    itens: [
      {
        codigo: "26.1",
        titulo: "Sinalização de segurança visível e legível nos locais de risco",
      },
      {
        codigo: "26.2",
        titulo: "Cores de segurança aplicadas conforme padrão (vermelho, amarelo, verde, azul)",
      },
      {
        codigo: "26.3",
        titulo: "Tubulações industriais identificadas por cor e fluxo",
      },
      {
        codigo: "26.4",
        titulo: "Produtos químicos rotulados conforme GHS (ABNT NBR 14725)",
      },
      {
        codigo: "26.5",
        titulo: "FISPQ disponível para todos os produtos químicos utilizados",
      },
      {
        codigo: "26.6",
        titulo: "Treinamento dos trabalhadores sobre rotulagem e FISPQ",
      },
      {
        codigo: "26.7",
        titulo: "Placas de aviso de risco visíveis nas áreas de máquinas/elétrica/altura",
      },
    ],
  },
  // =========================================================
  {
    codigo: "NR-35",
    titulo: "Trabalho em Altura",
    resumo: "Análise de risco, PT, EPIs de proteção contra quedas",
    itens: [
      {
        codigo: "35.1",
        titulo: "Análise de Risco (AR) elaborada antes do trabalho em altura",
      },
      {
        codigo: "35.2",
        titulo: "Permissão de Trabalho (PT) emitida para cada serviço",
      },
      {
        codigo: "35.3",
        titulo: "Trabalhadores capacitados em NR-35 (8h inicial + 8h bienal)",
      },
      {
        codigo: "35.4",
        titulo: "Aptidão médica para trabalho em altura comprovada no ASO",
      },
      {
        codigo: "35.5",
        titulo: "Sistemas de Proteção Contra Quedas (SPCQ) dimensionados e em uso",
        descricao: "Cinturão tipo paraquedista, talabarte, trava-quedas, linha de vida.",
      },
      {
        codigo: "35.6",
        titulo: "Inspeção dos equipamentos (cinturão, talabarte, ancoragem) antes do uso",
      },
      {
        codigo: "35.7",
        titulo: "Pontos de ancoragem certificados e dimensionados",
      },
      {
        codigo: "35.8",
        titulo: "Plano de Resgate elaborado e equipe treinada",
      },
      {
        codigo: "35.9",
        titulo: "Isolamento e sinalização da área de trabalho em altura",
      },
    ],
  },
];

/** Busca o checklist pelo código da NR (ex: "NR-24"). */
export function getChecklistNR(codigo: string): ChecklistNR | null {
  return CHECKLISTS_NR.find((c) => c.codigo === codigo) ?? null;
}

/** Lista resumida pra UI (select etc). */
export function listarNRs(): Array<{ codigo: string; titulo: string; resumo: string; totalItens: number }> {
  return CHECKLISTS_NR.map((c) => ({
    codigo: c.codigo,
    titulo: c.titulo,
    resumo: c.resumo,
    totalItens: c.itens.length,
  }));
}

// Catálogo de itens da NR-12 (Segurança no Trabalho em Máquinas e Equipamentos).
//
// Cada item é um requisito objetivo da norma, agrupado por categoria (subseção
// da NR-12). Quando uma Apreciação de Máquina é criada, todos os itens deste
// catálogo são COPIADOS pra `apreciacoes_maquinas_itens` no Supabase (snapshot
// regulatório). Alterar este arquivo NÃO afeta apreciações já emitidas —
// mesmo padrão do Relatório de Conformidade NR.
//
// Os textos são resumos práticos pra checklist — não substituem a leitura
// integral da NR-12 vigente. Fonte: NR-12 (Portaria SIT 197/2010 com
// atualizações posteriores).

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
}

export const CATALOGO_NR12: ItemCatalogoNR12[] = [
  // ===== Instalações e áreas de trabalho (12.6 - 12.18) =====
  {
    codigo: "12.6.1",
    categoria: "INSTALACOES",
    titulo: "Piso ao redor da máquina nivelado, antiderrapante e livre de obstáculos",
    descricao: "Sem rachaduras, sem materiais soltos ou obstáculos no entorno operacional.",
  },
  {
    codigo: "12.6.2",
    categoria: "INSTALACOES",
    titulo: "Áreas de circulação demarcadas e com largura mínima",
    descricao: "Passagens com no mínimo 0,60 m onde houver fluxo de pessoas; 1,20 m em corredores principais.",
  },
  {
    codigo: "12.6.3",
    categoria: "INSTALACOES",
    titulo: "Iluminação adequada no posto de operação e área de manutenção",
    descricao: "Iluminamento conforme NBR 5413/ABNT — sem ofuscamento e sem zonas de sombra críticas.",
  },
  {
    codigo: "12.7.1",
    categoria: "INSTALACOES",
    titulo: "Distância mínima entre máquinas respeitada",
    descricao: "Espaçamento que permita movimentação segura do operador e acesso à manutenção.",
  },

  // ===== Dispositivos de partida, acionamento e parada (12.24 - 12.37) =====
  {
    codigo: "12.24.1",
    categoria: "DISPOSITIVOS",
    titulo: "Dispositivos de partida e parada projetados para impedir acionamento involuntário",
    descricao: "Botoeiras protegidas (anel/embutidas) ou comandos bimanuais quando aplicável.",
  },
  {
    codigo: "12.25.1",
    categoria: "DISPOSITIVOS",
    titulo: "Botão de emergência tipo soco (cogumelo) vermelho em fundo amarelo",
    descricao: "Visível, ao alcance do operador, com travamento mecânico após acionamento (não rearmável só por liberação).",
  },
  {
    codigo: "12.25.2",
    categoria: "DISPOSITIVOS",
    titulo: "Acionamento de emergência interrompe energia da máquina em qualquer modo de operação",
    descricao: "Não pode ser anulado por seletores, modo manutenção ou bypass.",
  },
  {
    codigo: "12.27.1",
    categoria: "DISPOSITIVOS",
    titulo: "Comandos identificados por símbolos/textos claros e em português",
    descricao: "Identificação resistente a desgaste, com função e sentido de acionamento.",
  },

  // ===== Sistemas de segurança (12.38 - 12.55) =====
  {
    codigo: "12.38.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Proteções fixas instaladas em zonas de risco que não exigem acesso frequente",
    descricao: "Removíveis apenas com ferramenta. Sem furos/aberturas que permitam acesso aos pontos de prensagem/corte.",
  },
  {
    codigo: "12.38.2",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Proteções móveis com intertravamento associado",
    descricao: "Abertura da proteção interrompe energia da máquina; fechamento não rearma automaticamente.",
  },
  {
    codigo: "12.41.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Dispositivos de segurança (cortinas/sensores/tapetes) categorizados conforme análise de risco",
    descricao: "Categoria de segurança (B, 1, 2, 3, 4 — ISO 13849) compatível com gravidade do risco.",
  },
  {
    codigo: "12.42.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Sistema de segurança com redundância em pontos críticos",
    descricao: "Falha de um componente não anula a função de segurança (canal duplo + monitoramento).",
  },
  {
    codigo: "12.45.1",
    categoria: "SISTEMAS_SEGURANCA",
    titulo: "Distância de segurança respeitada para proteções e sensores",
    descricao: "Conforme NBR NM 272 (distâncias de segurança para proteção dos membros superiores e inferiores).",
  },

  // ===== Componentes pressurizados (12.106 - 12.111) =====
  {
    codigo: "12.106.1",
    categoria: "PRESSURIZADOS",
    titulo: "Mangueiras, tubulações e conexões em boas condições e fixadas",
    descricao: "Sem vazamentos, ressecamento ou ponto de esmagamento; conexões com travas mecânicas.",
  },
  {
    codigo: "12.106.2",
    categoria: "PRESSURIZADOS",
    titulo: "Válvulas de segurança / alívio de pressão presentes e funcionais",
    descricao: "Calibração vigente; lacre íntegro; descarga direcionada para área segura.",
  },
  {
    codigo: "12.108.1",
    categoria: "PRESSURIZADOS",
    titulo: "Acumuladores hidráulicos/pneumáticos identificados e com bloqueio para manutenção",
    descricao: "Permite isolamento e dissipação da energia residual antes de intervenções.",
  },

  // ===== Transportadores (12.112 - 12.118) =====
  {
    codigo: "12.112.1",
    categoria: "TRANSPORTADORES",
    titulo: "Cordoalha/cabo de parada de emergência ao longo de todo o comprimento",
    descricao: "Acessível ao longo de transportadores contínuos; aciona parada em qualquer ponto.",
  },
  {
    codigo: "12.112.2",
    categoria: "TRANSPORTADORES",
    titulo: "Proteção em pontos de retorno, tambores e zonas de prensagem",
    descricao: "Sem acesso direto aos pontos de aprisionamento; proteções fixas ou intertravadas.",
  },

  // ===== Aspectos ergonômicos (12.93 - 12.99) =====
  {
    codigo: "12.93.1",
    categoria: "ERGONOMIA",
    titulo: "Posto de operação permite postura neutra (ajustável quando aplicável)",
    descricao: "Altura de comandos compatível com operadores em pé/sentado; alcance dentro de zona neutra.",
  },
  {
    codigo: "12.93.2",
    categoria: "ERGONOMIA",
    titulo: "Comandos manuais e pedais posicionados para evitar esforços/torções repetidas",
    descricao: "Pedais com proteção contra acionamento involuntário; força necessária dentro de limites NR-17.",
  },
  {
    codigo: "12.94.1",
    categoria: "ERGONOMIA",
    titulo: "Assentos/apoios disponíveis em postos de trabalho em pé prolongado",
  },

  // ===== Riscos adicionais (12.85 - 12.92) =====
  {
    codigo: "12.85.1",
    categoria: "RISCOS_ADICIONAIS",
    titulo: "Superfícies quentes acessíveis isoladas ou sinalizadas",
    descricao: "Temperaturas acima de 60 °C protegidas com isolamento ou proteções; sinalização visível.",
  },
  {
    codigo: "12.85.2",
    categoria: "RISCOS_ADICIONAIS",
    titulo: "Sistema de exaustão/captação local para emissões químicas",
    descricao: "Fumos, vapores ou aerodispersóides captados na fonte; manutenção e medição periódica.",
  },
  {
    codigo: "12.87.1",
    categoria: "RISCOS_ADICIONAIS",
    titulo: "Nível de ruído na operação dentro do limite (≤ 85 dB(A) sem proteção)",
    descricao: "Quando acima do limite, medidas coletivas/EPI obrigatórios e PCMSO específico.",
  },

  // ===== Manutenção, inspeção e reparos (12.131 - 12.147) =====
  {
    codigo: "12.131.1",
    categoria: "MANUTENCAO",
    titulo: "Procedimentos de bloqueio e etiquetagem (LOTO) implementados",
    descricao: "Bloqueio de todas as fontes de energia (elétrica, hidráulica, pneumática, mecânica) antes de manutenção.",
  },
  {
    codigo: "12.131.2",
    categoria: "MANUTENCAO",
    titulo: "Registro de manutenção preventiva e corretiva mantido",
    descricao: "Histórico documentado de intervenções, peças substituídas e responsáveis.",
  },
  {
    codigo: "12.131.3",
    categoria: "MANUTENCAO",
    titulo: "Manutenção realizada por profissional capacitado",
    descricao: "Capacitação específica para tipo de intervenção; aplicável também a prestadores externos.",
  },
  {
    codigo: "12.140.1",
    categoria: "MANUTENCAO",
    titulo: "Inspeção visual periódica de proteções, sensores e dispositivos de emergência",
    descricao: "Periodicidade definida em plano de manutenção; registro de não conformidades.",
  },

  // ===== Sinalização (12.116 - 12.125) =====
  {
    codigo: "12.116.1",
    categoria: "SINALIZACAO",
    titulo: "Identificação da máquina com placa de tara, capacidade e fabricante",
    descricao: "Visível, legível e em material resistente. Inclui ano de fabricação quando aplicável.",
  },
  {
    codigo: "12.117.1",
    categoria: "SINALIZACAO",
    titulo: "Sinalização de risco (advertências, proibições, EPI obrigatório) presente",
    descricao: "Pictogramas conforme NBR-7195; cores conforme NR-26.",
  },
  {
    codigo: "12.118.1",
    categoria: "SINALIZACAO",
    titulo: "Identificação e sentido de operação dos comandos visíveis e indeléveis",
  },

  // ===== Capacitação (12.135 - 12.139) =====
  {
    codigo: "12.135.1",
    categoria: "CAPACITACAO",
    titulo: "Operadores capacitados com carga horária mínima da NR-12",
    descricao: "Conteúdo e carga horária conforme tipo de máquina; certificado individual.",
  },
  {
    codigo: "12.135.2",
    categoria: "CAPACITACAO",
    titulo: "Reciclagem da capacitação realizada conforme periodicidade",
    descricao: "Mínimo a cada 2 anos ou após alteração significativa da máquina/procedimento.",
  },
  {
    codigo: "12.137.1",
    categoria: "CAPACITACAO",
    titulo: "Treinamento específico para função (operação x manutenção x preparação) realizado",
  },

  // ===== Procedimentos de trabalho (12.130 - 12.134) =====
  {
    codigo: "12.130.1",
    categoria: "PROCEDIMENTOS",
    titulo: "Manual de instruções da máquina em português disponível no posto",
    descricao: "Conteúdo completo: operação, manutenção, riscos residuais, dispositivos de segurança.",
  },
  {
    codigo: "12.130.2",
    categoria: "PROCEDIMENTOS",
    titulo: "Procedimentos operacionais padrão (POP) escritos e acessíveis",
    descricao: "Inclui partida, parada normal e emergencial, limpeza, ajustes e troca de ferramental.",
  },
  {
    codigo: "12.132.1",
    categoria: "PROCEDIMENTOS",
    titulo: "Análise de Risco (AR) da máquina documentada e revisada periodicamente",
    descricao: "Identificação de perigos, avaliação de riscos e medidas de controle (referência ISO 12100).",
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

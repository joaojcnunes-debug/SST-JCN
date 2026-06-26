import type { CaixaTexto } from "@/lib/drps/types";

export type ModuloTextoPadrao =
  | "sst"
  | "conformidade"
  | "nao_conformidade"
  | "analise_quimicos"
  | "apreciacao_maquinas"
  | "aep"
  | "aet"
  | "psicossocial";

export type OrientacaoPagina = "retrato" | "paisagem";

/** Quebra de página antes do capítulo. 'continua' = segue na mesma página do anterior. */
export type QuebraPagina = "nova" | "continua";

/** Posição lógica do capítulo no PDF final do relatório (V53). */
export type PosicaoPdf =
  | "inicio"
  | "apos_sumario"
  | "apos_setores"
  | "apos_conclusao"
  | "apos_medidas"
  | "fim";

export const POSICAO_PDF_LABELS: Record<PosicaoPdf, string> = {
  inicio: "Início — antes do sumário (capa, dedicatória)",
  apos_sumario: "Após o sumário (introdução, metodologia)",
  apos_setores: "Após a análise por setor (antes da conclusão geral)",
  apos_conclusao: "Após a conclusão geral (antes do plano)",
  apos_medidas: "Após medidas/monitoramento/revisão",
  fim: "Fim do PDF (considerações finais)",
};

export const POSICAO_PDF_ORDEM: PosicaoPdf[] = [
  "inicio",
  "apos_sumario",
  "apos_setores",
  "apos_conclusao",
  "apos_medidas",
  "fim",
];

export interface TextoPadraoCapitulo {
  id_capitulo: string;
  modulo: ModuloTextoPadrao;
  ordem: number;
  titulo: string;
  conteudo: string | null;
  /** URL pública da imagem de fundo. Quando setada, vira página inteira no PDF. */
  bg_imagem_url: string | null;
  /** Caixas posicionadas sobre a bg (só usadas quando há bg). */
  caixas_texto: CaixaTexto[] | null;
  /** Orientação da página deste capítulo no PDF. */
  orientacao: OrientacaoPagina;
  /** Inicia nova página ou continua na anterior. Ignorado se for capa. */
  quebra_pagina: QuebraPagina;
  /** V53: posição do capítulo no PDF do relatório. */
  posicao_pdf: PosicaoPdf;
  ativo: boolean;
  tipo: "fixo" | "editavel";
  slug_fixo: string | null;
  /** E5: texto travado — só admin edita o conteúdo. */
  bloqueado: boolean;
  /** E5: não pode ser ocultado/desativado no laudo. */
  obrigatorio: boolean;
  created_at: string;
  updated_at: string | null;
}

/** Snapshot de uma versão de um capítulo (tabela textos_padrao_versoes, Fase 2). */
export interface TextoPadraoVersao {
  id_versao: string;
  id_capitulo: string;
  versao: number;
  modulo: ModuloTextoPadrao;
  titulo: string;
  conteudo: string | null;
  bg_imagem_url: string | null;
  caixas_texto: CaixaTexto[] | null;
  orientacao: OrientacaoPagina | null;
  quebra_pagina: QuebraPagina | null;
  posicao_pdf: PosicaoPdf | null;
  tipo: "fixo" | "editavel" | null;
  slug_fixo: string | null;
  ordem: number | null;
  ativo: boolean | null;
  /** E-mail de quem salvou (null no baseline v1 e em escritas server-side). */
  editado_por: string | null;
  editado_em: string;
}

/** Capítulo gerado automaticamente pelo sistema (não editável pelo usuário). */
export interface FixoCapitulo {
  titulo: string;
  slug_fixo: string;
  descricao: string;
  ordem_base: number;
}

export interface ModuloConfig {
  modulo: ModuloTextoPadrao;
  titulo: string;
  descricao: string;
  destino: string;
  fixos: FixoCapitulo[];
  /** Posições efetivamente renderizadas no laudo deste módulo.
   *  O PosicaoPdfStepper mostra só essas — evita o usuário mover
   *  um capítulo para uma posição que nunca aparece no PDF. */
  posicoesDisponiveis: PosicaoPdf[];
  /** Quando true, o laudo é montado como uma LISTA ÚNICA de blocos ordenada
   *  por `ordem` (capítulos editáveis + seções do sistema intercalados),
   *  e o editor mostra tudo numa lista só reordenável. As seções do sistema
   *  são identificadas pelos slug_fixo dos capítulos `fixo`. */
  ordenacaoUnificada?: boolean;
}

export const MODULO_CONFIGS: Record<ModuloTextoPadrao, ModuloConfig> = {
  sst: {
    modulo: "sst",
    titulo: "Texto Padrão — SST JCN Consultoria",
    descricao:
      "Monte o laudo como lista única: arraste/reordene os capítulos editáveis em relação ao bloco do relatório (inventário, riscos, plano — gerado automaticamente). Textos com ordem menor saem antes do relatório; maiores, depois.",
    destino: "A ordem definida aqui vale para o relatório de inspeção, ficha NR-01 e PGR.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Corpo do Relatório (inventário, riscos, plano)", slug_fixo: "sst_corpo", descricao: "Corpo gerado automaticamente: resumo, inventário de riscos, plano de ação, PAE etc. Os textos editáveis ficam antes ou depois deste bloco conforme a ordem.", ordem_base: 2000 },
    ],
  },
  conformidade: {
    modulo: "conformidade",
    titulo: "Texto Padrão — Conformidade NR",
    descricao:
      "Capítulos reutilizáveis para os Relatórios de Conformidade NR. Inclua introdução, fundamentação legal, considerações finais — com variáveis dinâmicas.",
    destino: "A ordem definida aqui é a ordem do laudo de Conformidade.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Itens de Conformidade Avaliados",   slug_fixo: "conformidade_itens",      descricao: "Tabela de itens por NR avaliados — gerada automaticamente.", ordem_base: 2000 },
      { titulo: "Resultado Geral de Conformidade",   slug_fixo: "conformidade_resultado",  descricao: "Percentual de conformidade por NR — gerado automaticamente.", ordem_base: 3000 },
      { titulo: "Assinatura do Responsável Técnico", slug_fixo: "conformidade_assinatura", descricao: "Rodapé de assinatura — gerado automaticamente.", ordem_base: 9000 },
    ],
  },
  nao_conformidade: {
    modulo: "nao_conformidade",
    titulo: "Texto Padrão — Não Conformidade",
    descricao:
      "Monte o laudo como lista única: arraste/reordene livremente os capítulos editáveis e as seções do sistema. A ordem definida aqui é a ordem do laudo.",
    destino: "A ordem definida aqui é exatamente a ordem do Relatório de Não Conformidade.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Descrição da Não Conformidade",     slug_fixo: "nc_descricao",  descricao: "Dados da NC: título, data, setor e evidências — gerados automaticamente.", ordem_base: 2000 },
      { titulo: "Plano de Ação Corretiva",           slug_fixo: "nc_plano",      descricao: "Ações corretivas com responsáveis e prazos — geradas automaticamente.", ordem_base: 3000 },
      { titulo: "Assinatura do Responsável",         slug_fixo: "nc_assinatura", descricao: "Rodapé de assinatura — gerado automaticamente.", ordem_base: 9000 },
    ],
  },
  analise_quimicos: {
    modulo: "analise_quimicos",
    titulo: "Texto Padrão — Análise de Químicos",
    descricao:
      "Monte o laudo como lista única: arraste/reordene livremente os capítulos editáveis em relação ao bloco da Análise Química (gerado automaticamente).",
    destino: "A ordem definida aqui é exatamente a ordem do laudo de Análise de Químicos.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Análise Química (corpo do laudo)", slug_fixo: "quimicos_analise", descricao: "Corpo completo da análise: identificação, NR-15/16, aposentadoria, controles, parecer — gerado automaticamente.", ordem_base: 2000 },
      { titulo: "Assinatura do Responsável Técnico", slug_fixo: "quimicos_assinatura", descricao: "Rodapé de assinatura — gerado automaticamente.", ordem_base: 9000 },
    ],
  },
  apreciacao_maquinas: {
    modulo: "apreciacao_maquinas",
    titulo: "Texto Padrão — Apreciação de Máquinas (NR-12)",
    descricao:
      "Monte o laudo como lista única: arraste/reordene livremente os capítulos editáveis e as seções do sistema (checklist, apreciação de risco, plano de ação). A ordem definida aqui é a ordem do laudo.",
    destino: "A ordem definida aqui é exatamente a ordem do laudo de Apreciação NR-12.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Identificação da Máquina/Equipamento",  slug_fixo: "apreciacao_identificacao", descricao: "Dados de identificação: fabricante, modelo, ano, função — gerados automaticamente.", ordem_base: 2000 },
      { titulo: "Checklist NR-12",                       slug_fixo: "apreciacao_checklist",     descricao: "Resultado do checklist NR-12 por item e zona — gerado automaticamente.", ordem_base: 2500 },
      { titulo: "Apreciação de Risco (ISO 12100)",       slug_fixo: "apreciacao_risco",         descricao: "Análise de risco residual por zona/hazard — gerada automaticamente.", ordem_base: 3000 },
      { titulo: "Plano de Ação NR-12",                   slug_fixo: "apreciacao_plano",         descricao: "Ações de adequação com prioridade e prazo — gerado automaticamente.", ordem_base: 4000 },
      { titulo: "Assinatura do Responsável Técnico",     slug_fixo: "apreciacao_assinatura",    descricao: "Rodapé de assinatura — gerado automaticamente.", ordem_base: 9000 },
    ],
  },
  aep: {
    modulo: "aep",
    titulo: "Texto Padrão — AEP (Análise Ergonômica Preliminar)",
    descricao:
      "Monte o laudo AEP como uma lista única: arraste/reordene livremente os capítulos editáveis (introdução, base legal, etc.) e as seções do sistema. A capa e a folha de assinatura ficam sempre nas pontas.",
    destino: "A ordem definida aqui é exatamente a ordem do laudo AEP gerado.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Indicadores de Necessidade de AET", slug_fixo: "aep_escalonamento", descricao: "Lista de setores que exigem AET completa — gerado automaticamente.", ordem_base: 3000 },
      { titulo: "Triagem Ergonômica por Setor", slug_fixo: "aep_triagem", descricao: "Tabela de riscos ergonômicos por setor — gerado automaticamente.", ordem_base: 3500 },
      { titulo: "Considerações Finais e Encaminhamentos", slug_fixo: "aep_consideracoes", descricao: "Conclusão do relatório — gerado automaticamente.", ordem_base: 5000 },
      { titulo: "Assinatura do Responsável Técnico", slug_fixo: "aep_assinatura", descricao: "Rodapé de assinatura — gerado automaticamente.", ordem_base: 9000 },
    ],
  },
  aet: {
    modulo: "aet",
    titulo: "Texto Padrão — AET (Análise Ergonômica do Trabalho)",
    descricao:
      "Monte o laudo AET como uma lista única: arraste/reordene livremente os capítulos editáveis e as seções do sistema. A ordem definida aqui é a ordem do laudo.",
    destino: "A ordem definida aqui é exatamente a ordem do laudo AET gerado.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Agentes Ambientais por Setor", slug_fixo: "aet_agentes_ambientais", descricao: "Riscos ambientais por setor — gerado automaticamente.", ordem_base: 1090 },
      { titulo: "Análise Ergonômica do Trabalho", slug_fixo: "aet_analise_ergonomica", descricao: "Análise por setor (OWAS, biomecânica) — gerado automaticamente.", ordem_base: 1100 },
      { titulo: "Fatores Psicossociais (QPS)", slug_fixo: "aet_psicossocial", descricao: "Resultados do QPS Nordic — gerado automaticamente.", ordem_base: 2000 },
      { titulo: "Considerações Finais", slug_fixo: "aet_consideracoes_finais", descricao: "Conclusão do laudo — gerado automaticamente.", ordem_base: 5000 },
      { titulo: "Assinatura do Responsável Técnico", slug_fixo: "aet_assinatura", descricao: "Folha de assinatura — gerado automaticamente.", ordem_base: 5500 },
    ],
  },
  psicossocial: {
    modulo: "psicossocial",
    titulo: "Texto Padrão — DRPS (Psicossocial)",
    descricao:
      "Monte o laudo DRPS como uma lista única: arraste/reordene livremente os capítulos editáveis e as seções do sistema. A ordem definida aqui é a ordem do laudo.",
    destino: "A ordem definida aqui é exatamente a ordem do laudo DRPS gerado.",
    posicoesDisponiveis: ["inicio", "fim"],
    ordenacaoUnificada: true,
    fixos: [
      { titulo: "Caracterização dos Trabalhadores", slug_fixo: "drps_caracterizacao", descricao: "Dados quantitativos de trabalhadores por setor — gerado automaticamente.", ordem_base: 1500 },
      { titulo: "Análise por Setor", slug_fixo: "drps_analise_setor", descricao: "Tópicos × setores com matriz Gravidade × Probabilidade — gerado automaticamente.", ordem_base: 2000 },
      { titulo: "Conclusão Técnica Consolidada", slug_fixo: "drps_conclusao", descricao: "Consolidação dos riscos críticos e altos de todos os setores — gerada automaticamente.", ordem_base: 4000 },
      { titulo: "Plano de Medidas de Controle", slug_fixo: "drps_plano_medidas", descricao: "Plano anual de ações com responsáveis e prazos — gerado automaticamente.", ordem_base: 4500 },
      { titulo: "Revisão e Monitoramento", slug_fixo: "drps_revisao", descricao: "Checklist de revisão e equipe responsável — gerado automaticamente.", ordem_base: 5000 },
      { titulo: "Assinatura Técnica", slug_fixo: "drps_assinatura", descricao: "Rodapé de assinatura do responsável técnico — gerado automaticamente.", ordem_base: 9000 },
    ],
  },
};

/**
 * Capítulos do sistema COMUNS a todos os módulos — reposicionáveis como
 * qualquer seção fixa (modo unificado). São gerados automaticamente:
 *  - identificacao_empresa: bloco com os dados de identificação da empresa
 *    (substitui o antigo cabeçalho fixo, agora podendo ser movido).
 *  - sumario: índice com os títulos dos capítulos na ordem do laudo.
 * Ordem-base baixa para aparecerem no início por padrão; o usuário pode mover.
 */
export const FIXOS_COMUNS: FixoCapitulo[] = [
  {
    titulo: "Identificação da Empresa",
    slug_fixo: "identificacao_empresa",
    descricao:
      "Dados de identificação da empresa (razão social, CNPJ, endereço etc.) — gerado automaticamente. Pode ser reposicionado no laudo.",
    ordem_base: 50,
  },
  {
    titulo: "Sumário",
    slug_fixo: "sumario",
    descricao:
      "Índice com os títulos dos capítulos na ordem do laudo — gerado automaticamente. Pode ser reposicionado.",
    ordem_base: 80,
  },
];

// Injeta os fixos comuns no início da lista de fixos de cada módulo.
for (const cfg of Object.values(MODULO_CONFIGS)) {
  cfg.fixos = [...FIXOS_COMUNS, ...cfg.fixos];
}

// Tipos da feature "Texto Padrão" genérica (Painel SST, Conformidade,
// Análise de Químicos). O Psicossocial mantém sua estrutura própria em
// `lib/drps/types.ts` por compatibilidade.

import type { CaixaTexto } from "@/lib/drps/types";

export type ModuloTextoPadrao =
  | "sst"
  | "conformidade"
  | "nao_conformidade"
  | "analise_quimicos"
  | "apreciacao_maquinas";

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
  created_at: string;
  updated_at: string | null;
}

export interface ModuloConfig {
  /** Slug do módulo (chave da tabela). */
  modulo: ModuloTextoPadrao;
  /** Título da página ("Texto Padrão — Painel SST"). */
  titulo: string;
  /** Descrição curta exibida abaixo do título. */
  descricao: string;
  /** Onde os textos aparecem (frase explicativa). */
  destino: string;
}

export const MODULO_CONFIGS: Record<ModuloTextoPadrao, ModuloConfig> = {
  sst: {
    modulo: "sst",
    titulo: "Texto Padrão — Painel SST",
    descricao:
      "Capítulos reutilizáveis para os relatórios de Inspeção e PGR. Use as variáveis abaixo pra preencher empresa, CNPJ, datas etc. na hora da geração do PDF.",
    destino: "Aparecem nos relatórios de inspeção, ficha NR-01 e PGR.",
  },
  conformidade: {
    modulo: "conformidade",
    titulo: "Texto Padrão — Conformidade NR",
    descricao:
      "Capítulos reutilizáveis para os Relatórios de Conformidade NR. Inclua introdução, fundamentação legal, considerações finais — com variáveis dinâmicas.",
    destino: "Aparecem nos Relatórios de Conformidade (NR-24, NR-17 etc).",
  },
  nao_conformidade: {
    modulo: "nao_conformidade",
    titulo: "Texto Padrão — Não Conformidade",
    descricao:
      "Capítulos reutilizáveis para os Relatórios de Não Conformidade (RNC). Inclua introdução, base metodológica e considerações sobre o plano de ação.",
    destino: "Aparecem nos Relatórios de Não Conformidade.",
  },
  analise_quimicos: {
    modulo: "analise_quimicos",
    titulo: "Texto Padrão — Análise de Químicos",
    descricao:
      "Capítulos reutilizáveis para as análises de produtos químicos. Pode incluir disclaimers, metodologia, normas aplicáveis.",
    destino: "Aparecem no relatório de Análise de Químicos.",
  },
  apreciacao_maquinas: {
    modulo: "apreciacao_maquinas",
    titulo: "Texto Padrão — Apreciação de Máquinas (NR-12)",
    descricao:
      "Capítulos reutilizáveis para os laudos de Apreciação NR-12: introdução, fundamentação legal (ISOs 12100/13849), metodologia, considerações finais.",
    destino: "Aparecem no PDF do laudo da Apreciação NR-12, após a conclusão técnica.",
  },
};

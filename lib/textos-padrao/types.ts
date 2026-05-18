// Tipos da feature "Texto Padrão" genérica (Painel SST, Conformidade,
// Análise de Químicos). O Psicossocial mantém sua estrutura própria em
// `lib/drps/types.ts` por compatibilidade.

import type { CaixaTexto } from "@/lib/drps/types";

export type ModuloTextoPadrao = "sst" | "conformidade" | "analise_quimicos";

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
  analise_quimicos: {
    modulo: "analise_quimicos",
    titulo: "Texto Padrão — Análise de Químicos",
    descricao:
      "Capítulos reutilizáveis para as análises de produtos químicos. Pode incluir disclaimers, metodologia, normas aplicáveis.",
    destino: "Aparecem no relatório de Análise de Químicos.",
  },
};

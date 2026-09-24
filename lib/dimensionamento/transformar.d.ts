/* Tipos de `transformar.js` (DIM-01): documentos da API externa de SST → demanda e
   atendidas por unidade/mês/condição/porte.

   Mesma regra do `calculo.d.ts`: entradas precisas, saída com o que a rota e a tela
   leem. O corpo é cópia fiel da origem e não foi retipado — os 12 testes de
   `transformar.test.ts` é que garantem o comportamento. */

/** Linha de `/v1/sincronizacao`: frescor e cobertura por unidade. */
export interface LinhaCobertura {
  unidade: string;
  cobertura: string;
  ultima_varredura_em?: string | null;
  status_varredura?: string | null;
  documentos_sst?: number | string | null;
  cobertura_motivo?: string | null;
}

/** Linha de `/v1/documentos` (recorte externo: sem `url`, empresa denormalizada). */
export interface LinhaDocumento {
  id: string;
  unidade: string;
  tipo?: string;
  numero?: string;
  emitido_em?: string | null;
  vence_em?: string | null;
  vigente?: boolean;
  estado?: string;
  empresa_id?: string | number | null;
  empresa_cnpj?: string | null;
  empresa_razao_social?: string | null;
}

/** Unidade do cadastro local (`dim_unidades`), com o código que casa com a API. */
export interface UnidadeCadastro {
  id: string;
  nome: string;
  codigo_api?: string | null;
}

export interface Classificacao {
  porCnpj?: Record<string, unknown>;
  porCodigo?: Record<string, unknown>;
}

/** Uma unidade no lote pronto para gravar. `aplicar=false` ⇒ nada é escrito para ela. */
export interface UnidadeDoLote {
  codigo_api: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  cobertura: string;
  ultima_varredura_em: string | null;
  documentos: number;
  /** Cobertura `indisponivel`/`falha` ou unidade sem correspondente no cadastro ⇒ false. */
  aplicar: boolean;
  mensagem: string | null;
  demanda: Array<Record<string, unknown>>;
  atendidas: Record<string, Record<string, number>>;
  totalDemanda: number;
  totalAtendidas: number;
  [campo: string]: unknown;
}

export interface Lote {
  ano: number;
  unidades: UnidadeDoLote[];
  naoClassificados: Array<Record<string, unknown>>;
  resumo: {
    unidadesAplicadas: number;
    unidadesIgnoradas: Array<{ codigo_api: string; cobertura: string; mensagem: string | null }>;
    demanda: number;
    atendidas: number;
    semClassificacao: number;
  };
}

export declare const COBERTURA_UTILIZAVEL: string[];
export declare const PORTE_PADRAO: string;
export declare const CONDICAO_PADRAO: string;

/** Mês (1..12) de uma data ISO, quando ela pertence ao ano pedido; senão `null`. */
export declare function mesDoAno(data: string | null | undefined, ano: number | string): number | null;

/** Porte e condição do cliente: por CNPJ e, na falta, por código. Sem cadastro ⇒ padrão. */
export declare function classificar(
  doc: LinhaDocumento,
  classificacao?: Classificacao,
): { porte: string; condicao: string; classificado: boolean };

export declare function montarLote(entrada: {
  ano: number | string;
  cobertura?: LinhaCobertura[] | unknown[];
  documentos?: LinhaDocumento[] | unknown[];
  unidades?: UnidadeCadastro[] | unknown[];
  classificacao?: Classificacao;
}): Lote;

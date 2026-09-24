/**
 * Tipos do módulo Frota (v177).
 *
 * POR QUE AQUI E NÃO EM lib/supabase/types.ts: o módulo é um teste, e a remoção
 * em cinco passos é requisito de primeira classe. Tipo de entidade vivendo no
 * arquivo central faria a remoção mexer num arquivo compartilhado grande, com
 * chance de conflito. Aqui é `rm -r lib/frota`.
 *
 * A exceção deliberada são as 3 linhas do módulo em lib/supabase/types.ts
 * (ModuloPermitido, TODOS_MODULOS, ROTULO_MODULO): a permissão é do sistema, não
 * do módulo, e `git checkout` devolve.
 */

// ─── Enums (espelham os CHECK do banco — mudar aqui exige migration) ─────────

export const TIPOS_VEICULO = ["CARRO", "CAMINHONETE", "VAN", "CAMINHAO", "MOTO", "ONIBUS"] as const;
export type TipoVeiculo = (typeof TIPOS_VEICULO)[number];

export const STATUS_VEICULO = ["ATIVO", "MANUTENCAO", "INATIVO", "VENDIDO"] as const;
export type StatusVeiculo = (typeof STATUS_VEICULO)[number];

export const STATUS_CHECKLIST = ["RASCUNHO", "FINALIZADO"] as const;
export type StatusChecklist = (typeof STATUS_CHECKLIST)[number];

export const ANGULOS_FOTO = [
  "FRENTE",
  "LATERAL_DIREITA",
  "LATERAL_ESQUERDA",
  "TRASEIRA",
  "EXTRA",
] as const;
export type AnguloFoto = (typeof ANGULOS_FOTO)[number];

export const TIPOS_COMBUSTIVEL = [
  "GASOLINA",
  "ETANOL",
  "DIESEL_S10",
  "DIESEL_S500",
  "GNV",
  "ARLA32",
  "ELETRICO",
] as const;
export type TipoCombustivel = (typeof TIPOS_COMBUSTIVEL)[number];

export const FORMAS_PAGAMENTO = [
  "CARTAO_FROTA",
  "CARTAO_EMPRESA",
  "DINHEIRO",
  "PIX",
  "FATURADO",
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const TIPOS_SINISTRO = [
  "COLISAO",
  "CAPOTAMENTO",
  "ATROPELAMENTO",
  "ROUBO",
  "FURTO",
  "INCENDIO",
  "VIDROS",
  "FENOMENO_NATURAL",
  "TERCEIROS",
  "OUTRO",
] as const;
export type TipoSinistro = (typeof TIPOS_SINISTRO)[number];

export const GRAVIDADES_SINISTRO = ["LEVE", "MEDIA", "GRAVE"] as const;
export type GravidadeSinistro = (typeof GRAVIDADES_SINISTRO)[number];

export const STATUS_SINISTRO = [
  "ABERTO",
  "EM_ANALISE",
  "EM_REPARO",
  "ENCERRADO",
  "NEGADO",
] as const;
export type StatusSinistro = (typeof STATUS_SINISTRO)[number];

// ─── Rótulos para tela (o banco guarda o código; a tela mostra gente) ────────

export const ROTULO_TIPO_VEICULO: Record<TipoVeiculo, string> = {
  CARRO: "Carro",
  CAMINHONETE: "Caminhonete",
  VAN: "Van",
  CAMINHAO: "Caminhão",
  MOTO: "Moto",
  ONIBUS: "Ônibus",
};

export const ROTULO_STATUS_VEICULO: Record<StatusVeiculo, string> = {
  ATIVO: "Ativo",
  MANUTENCAO: "Em manutenção",
  INATIVO: "Inativo",
  VENDIDO: "Vendido",
};

export const ROTULO_COMBUSTIVEL: Record<TipoCombustivel, string> = {
  GASOLINA: "Gasolina",
  ETANOL: "Etanol",
  DIESEL_S10: "Diesel S10",
  DIESEL_S500: "Diesel S500",
  GNV: "GNV",
  ARLA32: "Arla 32",
  ELETRICO: "Elétrico",
};

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  CARTAO_FROTA: "Cartão frota",
  CARTAO_EMPRESA: "Cartão empresa",
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  FATURADO: "Faturado",
};

export const ROTULO_TIPO_SINISTRO: Record<TipoSinistro, string> = {
  COLISAO: "Colisão",
  CAPOTAMENTO: "Capotamento",
  ATROPELAMENTO: "Atropelamento",
  ROUBO: "Roubo",
  FURTO: "Furto",
  INCENDIO: "Incêndio",
  VIDROS: "Vidros",
  FENOMENO_NATURAL: "Fenômeno natural",
  TERCEIROS: "Causado por terceiros",
  OUTRO: "Outro",
};

export const ROTULO_STATUS_SINISTRO: Record<StatusSinistro, string> = {
  ABERTO: "Aberto",
  EM_ANALISE: "Em análise",
  EM_REPARO: "Em reparo",
  ENCERRADO: "Encerrado",
  NEGADO: "Negado",
};

// ─── Linhas do banco ────────────────────────────────────────────────────────

export type FrotaVeiculo = {
  id_veiculo: string;
  id_unidade: string;
  placa: string;
  modelo: string;
  marca: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  renavam: string | null;
  chassi: string | null;
  tipo: TipoVeiculo | null;
  /** As avarias que JÁ existem, preenchidas no cadastro. */
  avarias_padrao: string | null;
  observacoes: string | null;
  /** Gravado uma vez, no cadastro, e nunca mais alterado. */
  km_cadastro: number;
  /** Última atualização — sobe pela saída ou pelo abastecimento. Nunca regride. */
  km_atual: number | null;
  km_atual_em: string | null;
  /** 'SAIDA:<id>' | 'ABASTECIMENTO:<id>' — de onde veio a última atualização. */
  km_atual_origem: string | null;
  status: StatusVeiculo;
  foto_capa_path: string | null;
  foto_capa_thumb_path: string | null;
  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
};

export type FrotaVeiculoFoto = {
  id_foto: string;
  id_veiculo: string;
  thumb_path: string;
  vista_path: string;
  original_path: string | null;
  legenda: string | null;
  ordem: number;
  largura: number | null;
  altura: number | null;
  bytes: number | null;
  criado_por: string | null;
  criado_em: string;
};

export type FrotaChecklist = {
  id_checklist: string;
  id_veiculo: string;
  id_unidade: string;
  condutor_nome: string;
  data_saida: string;
  km_saida: number;
  /** O que o condutor viu NESTA saída (par de veiculo.avarias_padrao). */
  avarias_constatadas: string | null;
  observacoes: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_ponto_referencia: string | null;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  status: StatusChecklist;
  finalizado_em: string | null;
  finalizado_por: string | null;
  /**
   * O RETORNO (v178). `data_retorno` nula em saída FINALIZADA significa uma só
   * coisa, e é a informação central do painel: o veículo ainda está fora.
   *
   * `data_retorno` é quando o carro voltou; `retorno_em` é quando alguém
   * digitou. Os dois existem porque quem registra não é quem dirige — o carro
   * chega às 17h e o lançamento pode ser no dia seguinte.
   */
  data_retorno: string | null;
  /** Opcional: quem lança pode não ter o odômetro em mãos. */
  km_retorno: number | null;
  retorno_por: string | null;
  retorno_em: string | null;
  /** O que apareceu de novo na volta — o par de `avarias_constatadas`. */
  avarias_retorno: string | null;
  retorno_observacao: string | null;
  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
};

export type FrotaChecklistFoto = {
  id_foto: string;
  id_checklist: string;
  angulo: AnguloFoto;
  thumb_path: string;
  vista_path: string;
  original_path: string | null;
  legenda: string | null;
  ordem: number;
  criado_em: string;
};

/** Rota do trajeto — filha da SAÍDA, não do abastecimento. */
export type FrotaRota = {
  id_rota: string;
  id_checklist: string;
  ordem: number;
  origem: string;
  destino: string;
  km_percorrido: number | null;
  data: string | null;
  finalidade: string | null;
  observacao: string | null;
  criado_em: string;
};

export type FrotaAbastecimento = {
  id_abastecimento: string;
  id_veiculo: string;
  data_hora: string;
  condutor_nome: string;
  km_odometro: number | null;
  tipo_combustivel: TipoCombustivel;
  /** Independentes de propósito: sem soma automática. O cupom manda. */
  litros: number | null;
  valor_litro: number | null;
  valor_total: number | null;
  posto: string | null;
  cidade_uf: string | null;
  forma_pagamento: FormaPagamento | null;
  numero_cupom: string | null;
  tanque_cheio: boolean;
  id_checklist_origem: string | null;
  criado_por: string | null;
  criado_em: string;
};

/** Comprovante de qualquer formato — foto, PDF, entre outros. */
export type FrotaAbastecimentoAnexo = {
  id_anexo: string;
  id_abastecimento: string;
  arquivo_path: string;
  mime: string;
  nome_arquivo: string;
  bytes: number;
  /** Nulo quando não é imagem: PDF usa ícone. */
  thumb_path: string | null;
  criado_por: string | null;
  criado_em: string;
};

export type FrotaSinistro = {
  id_sinistro: string;
  id_veiculo: string;
  data_ocorrencia: string;
  hora_ocorrencia: string | null;
  tipo: TipoSinistro;
  gravidade: GravidadeSinistro | null;
  com_vitima: boolean;
  descricao: string;
  condutor_nome: string | null;
  local_ocorrencia: string | null;
  latitude: number | null;
  longitude: number | null;
  boletim_ocorrencia: string | null;
  seguradora: string | null;
  numero_aviso_sinistro: string | null;
  valor_franquia: number | null;
  valor_prejuizo: number | null;
  status: StatusSinistro;
  id_checklist_origem: string | null;
  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
};

export type FrotaSinistroFoto = {
  id_foto: string;
  id_sinistro: string;
  thumb_path: string;
  vista_path: string;
  original_path: string | null;
  legenda: string | null;
  ordem: number;
  criado_em: string;
};

/**
 * Colunas que a LISTAGEM de veículos realmente usa.
 *
 * Mesma disciplina de COLUNAS_LISTA_EQUIP (v163): a lista não faz `select("*")`
 * porque a tabela carrega renavam, chassi, avarias e observações que a lista
 * nunca desenha. Tupla `as const` de propósito — `FrotaVeiculoLista` sai daqui,
 * então tela que leia campo fora desta lista não compila. Sem isso, esquecer uma
 * coluna faria o campo virar `undefined` em silêncio, e um filtro comparando
 * `undefined` para de achar sem dar erro nenhum.
 */
export const COLUNAS_LISTA_VEICULO = [
  "id_veiculo",
  "id_unidade",
  "placa",
  "modelo",
  "marca",
  "ano_modelo",
  "cor",
  "tipo",
  "km_cadastro",
  "km_atual",
  "km_atual_em",
  "status",
  "foto_capa_thumb_path",
  "criado_em",
] as const;

export type FrotaVeiculoLista = Pick<FrotaVeiculo, (typeof COLUNAS_LISTA_VEICULO)[number]>;

// ════════════════════════════════════════════════════════════════════════════
// v178 — LOTAÇÃO E MANUTENÇÃO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lotação: em qual BASE o veículo esteve, e desde quando.
 *
 * Não confundir com saída. Saída é viagem (vai e volta, o carro continua sendo
 * da base). Lotação é mudança de endereço do patrimônio: as saídas seguintes
 * nascem carimbadas na base nova.
 *
 * `id_unidade_origem` nunca chega da tela — o trigger da v178 lê a base real do
 * veículo e carimba. Enviar origem diferente da real faz o banco recusar.
 */
export type FrotaLotacao = {
  id_lotacao: string;
  id_veiculo: string;
  /** Nula só na primeira lotação: o veículo não veio de lugar nenhum. */
  id_unidade_origem: string | null;
  id_unidade_destino: string;
  /** Quando o veículo mudou de base — não quando alguém digitou. */
  data_movimentacao: string;
  motivo: string | null;
  responsavel_nome: string | null;
  observacao: string | null;
  /** O trecho ("deu 210 km"). Opcional: quem lança pode não saber. */
  km_percorrido: number | null;
  /** A leitura do painel na chegada. Só este atualiza o km do veículo. */
  km_odometro: number | null;
  criado_por: string | null;
  criado_em: string;
};

export const TIPOS_MANUTENCAO = [
  "PREVENTIVA",
  "CORRETIVA",
  "REVISAO",
  "PNEUS",
  "ELETRICA",
  "FUNILARIA",
  "SOCORRO",
  "OUTRO",
] as const;
export type TipoManutencao = (typeof TIPOS_MANUTENCAO)[number];

export const STATUS_MANUTENCAO = [
  "AGENDADA",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;
export type StatusManutencao = (typeof STATUS_MANUTENCAO)[number];

export const ROTULO_TIPO_MANUTENCAO: Record<TipoManutencao, string> = {
  PREVENTIVA: "Preventiva",
  CORRETIVA: "Corretiva",
  REVISAO: "Revisão",
  PNEUS: "Pneus",
  ELETRICA: "Elétrica",
  FUNILARIA: "Funilaria e pintura",
  SOCORRO: "Socorro / guincho",
  OUTRO: "Outro",
};

export const ROTULO_STATUS_MANUTENCAO: Record<StatusManutencao, string> = {
  AGENDADA: "Agendada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

/** Manutenção em aberto é a que prende o veículo — é por ela que o painel filtra. */
export const STATUS_MANUTENCAO_ABERTA: readonly StatusManutencao[] = [
  "AGENDADA",
  "EM_ANDAMENTO",
];

export type FrotaManutencao = {
  id_manutencao: string;
  id_veiculo: string;
  tipo: TipoManutencao;
  status: StatusManutencao;
  data_entrada: string;
  /** Nula enquanto o veículo está na oficina. */
  data_saida: string | null;
  km_odometro: number | null;
  descricao: string;
  oficina: string | null;
  nota_fiscal: string | null;
  valor: number | null;
  /**
   * Duas colunas independentes porque a regra real é "o que vier primeiro":
   * revisão a cada 10.000 km OU 12 meses.
   */
  proxima_revisao_data: string | null;
  proxima_revisao_km: number | null;
  id_sinistro_origem: string | null;
  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
};

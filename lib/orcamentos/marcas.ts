/**
 * Comercial › Orçamentos (0.3.339): as 3 marcas em que o orçamento sai — dados da emissora e o padrão visual de cada
 * uma (cores das bases de conhecimento da Chabra e da Holos; a JCN usa as cores do sistema).
 *
 * Módulo puro. Os logos: a JCN usa o do sistema; Chabra e Holos saem com o nome da marca até o logo ser enviado.
 */

export type MarcaOrcamento = "chabra" | "holos" | "jcn";

export interface Marca {
  id: MarcaOrcamento;
  /** Nome curto (no topo do PDF quando não há logo, e nas listas). */
  nome: string;
  /** Subtítulo do nome (ex.: "Saúde e Segurança do Trabalho"). */
  subtitulo: string;
  /** Quem assina e aparece no rodapé. */
  razaoSocial: string;
  cnpj: string | null;
  endereco: string | null;
  contato: string | null;
  /** Cidade padrão da data ("Teresópolis, 27 de novembro de 2026."). */
  cidadePadrao: string;
  cores: {
    /** Cor principal: faixas, valores, etiquetas. */
    principal: string;
    /** Títulos e valores sobre fundo claro. */
    escura: string;
    /** Acento da marca. */
    acento: string;
    /** Círculo do check dos serviços e sublinhado das seções. */
    check: string;
    /** Etiqueta "PROPOSTA 1" e o alerta "Observação.". */
    destaque: string;
    /** Bloco do canto direito da faixa superior. */
    faixaCanto: string;
    /** Texto e rodapé. */
    grafite: string;
    /** Texto secundário. */
    cinza: string;
    /** Fundos claros (capa, quadro do cliente, linhas alternadas). */
    fundo: string;
    borda: string;
  };
}

export const MARCAS: Record<MarcaOrcamento, Marca> = {
  chabra: {
    id: "chabra",
    nome: "Chabra",
    subtitulo: "Saúde e Segurança do Trabalho",
    razaoSocial: "CHABRA SAÚDE E SEGURANÇA DO TRABALHO LTDA",
    cnpj: "31.427.455/0001-11",
    endereco: "Av. Lúcio Meira, 58, Sala 102, Várzea, Teresópolis/RJ",
    contato: "0800 555 0525 · comercial@chabra.com.br",
    cidadePadrao: "Teresópolis",
    cores: { principal: "#33AC62", escura: "#23864A", acento: "#E8363B", check: "#33AC62", destaque: "#E8363B", faixaCanto: "#E8363B", grafite: "#1F2A24", cinza: "#5F6B64", fundo: "#F3F8F5", borda: "#DBE8E0" },
  },
  holos: {
    id: "holos",
    nome: "Holos",
    subtitulo: "Clínica Médica · Grupo Chabra",
    razaoSocial: "HOLOS SERVIÇOS MÉDICOS LTDA",
    cnpj: "02.999.576/0001-30",
    endereco: "Av. Doutor Galdino do Valle Filho, 133, Centro, Nova Friburgo/RJ · CEP 28.625-010",
    contato: null,
    cidadePadrao: "Nova Friburgo",
    cores: { principal: "#E4353A", escura: "#C42A2F", acento: "#2E9E5B", check: "#2E9E5B", destaque: "#E4353A", faixaCanto: "#2F3237", grafite: "#2F3237", cinza: "#6B6E74", fundo: "#F2F3F5", borda: "#E2E4E8" },
  },
  jcn: {
    id: "jcn",
    nome: "JCN Consultoria",
    subtitulo: "Saúde e Segurança do Trabalho",
    razaoSocial: "JCN Consultoria",
    cnpj: null,
    endereco: null,
    contato: null,
    cidadePadrao: "Teresópolis",
    cores: { principal: "#0284C7", escura: "#075985", acento: "#F59E0B", check: "#0284C7", destaque: "#F59E0B", faixaCanto: "#F59E0B", grafite: "#1F2937", cinza: "#6B7280", fundo: "#F0F9FF", borda: "#E0F2FE" },
  },
};

export const LISTA_MARCAS: Marca[] = [MARCAS.chabra, MARCAS.holos, MARCAS.jcn];

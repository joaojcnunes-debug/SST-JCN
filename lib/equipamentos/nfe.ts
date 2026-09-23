// Parser de NF-e do modulo EQUIPAMENTOS.
//
// Copia do lib/epi/nfe.ts do painel-sst. NAO reusa o lib/epi/nfe.ts daqui de
// proposito: o do JCN exporta parseNfeXml com outra forma, porque o modulo de
// EPI seguiu caminho proprio (agente biometrico nativo). Forcar um dos dois a
// ceder faria os dois brigarem a cada equalizacao; separados, cada um evolui
// com o seu modulo.
// aceita nfeProc (com protocolo) ou NFe cru.

export interface EpiNfeItemParsed {
  cprod: string;
  xprod: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
}

export interface EpiNfeParsed {
  chnfe: string;
  fornecedor_cnpj: string;
  fornecedor_nome: string;
  numero_nf: string;
  data_emissao: string; // YYYY-MM-DD
  itens: EpiNfeItemParsed[];
}

/** Descendentes com o localName informado (ignora prefixo de namespace). */
function porLocal(escopo: Element | Document, nome: string): Element[] {
  const out: Element[] = [];
  const todos = escopo.getElementsByTagName("*");
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].localName === nome) out.push(todos[i] as Element);
  }
  return out;
}
const primeiro = (escopo: Element | Document, nome: string): Element | null => porLocal(escopo, nome)[0] ?? null;
const texto = (escopo: Element | Document | null, nome: string): string =>
  escopo ? (primeiro(escopo, nome)?.textContent?.trim() ?? "") : "";

/** Faz o parse do XML da NF-e. Lança erro se não parecer uma NF-e válida. */
export function parseNfe(xml: string): EpiNfeParsed {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Arquivo XML inválido.");
  }
  const infNFe = primeiro(doc, "infNFe");
  if (!infNFe) throw new Error("Elemento infNFe não encontrado — não parece uma NF-e.");

  const idAttr = infNFe.getAttribute("Id") ?? "";
  const chnfe = idAttr.replace(/\D/g, ""); // remove "NFe" e qualquer não-dígito

  const emit = primeiro(infNFe, "emit");
  const fornecedor_cnpj = texto(emit, "CNPJ") || texto(emit, "CPF");
  const fornecedor_nome = texto(emit, "xNome");

  const ide = primeiro(infNFe, "ide");
  const numero_nf = texto(ide, "nNF");
  const dh = texto(ide, "dhEmi") || texto(ide, "dEmi");
  const data_emissao = dh ? dh.slice(0, 10) : "";

  const itens: EpiNfeItemParsed[] = porLocal(infNFe, "det").map((det) => {
    const prod = primeiro(det, "prod");
    return {
      cprod: texto(prod, "cProd"),
      xprod: texto(prod, "xProd"),
      ncm: texto(prod, "NCM"),
      unidade: texto(prod, "uCom"),
      quantidade: Number(texto(prod, "qCom")) || 0,
      valor_unitario: Number(texto(prod, "vUnCom")) || 0,
    };
  }).filter((it) => it.cprod || it.xprod);

  if (chnfe.length !== 44) {
    throw new Error("Chave da NF-e (chNFe) não encontrada ou inválida (44 dígitos).");
  }
  return { chnfe, fornecedor_cnpj, fornecedor_nome, numero_nf, data_emissao, itens };
}

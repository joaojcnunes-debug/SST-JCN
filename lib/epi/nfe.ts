// Parser de NF-e (modelo 55, layout 4.00) a partir do XML.
// Roda no navegador via DOMParser — extrai o cabeçalho e os itens (det/prod)
// necessários para a conferência item↔EPI antes de dar entrada no estoque.
//
// Aceita tanto o XML de distribuição (nfeProc > NFe > infNFe) quanto o XML
// "cru" (NFe > infNFe). Namespaces são ignorados usando busca por localName.

import type { EpiNfeParsed, EpiNfeItemParsed } from "@/lib/epi/types";

/** Busca o 1º descendente cujo nome local (sem namespace) casa. */
function first(el: Element | Document, local: string): Element | null {
  const all = el.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === local) return all[i];
  }
  return null;
}

/** Todos os descendentes diretos/indiretos cujo nome local casa. */
function all(el: Element | Document, local: string): Element[] {
  const nodes = el.getElementsByTagName("*");
  const out: Element[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].localName === local) out.push(nodes[i]);
  }
  return out;
}

/** Texto direto de um filho (por localName) do elemento. */
function childText(el: Element | null, local: string): string {
  if (!el) return "";
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i].localName === local) {
      return (el.children[i].textContent ?? "").trim();
    }
  }
  return "";
}

function soDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export class NfeParseError extends Error {}

/**
 * Faz o parse do XML de uma NF-e e retorna cabeçalho + itens.
 * Lança NfeParseError se o XML não for uma NF-e reconhecível.
 */
export function parseNfeXml(xml: string): EpiNfeParsed {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new NfeParseError("XML inválido ou corrompido.");
  }

  const infNFe = first(doc, "infNFe");
  if (!infNFe) {
    throw new NfeParseError("XML não parece ser uma NF-e (infNFe ausente).");
  }

  // chNFe: atributo Id = "NFe" + 44 dígitos.
  const idAttr = infNFe.getAttribute("Id") ?? "";
  const chnfe = soDigitos(idAttr);
  if (chnfe.length !== 44) {
    throw new NfeParseError("Chave da NF-e (chNFe) não encontrada ou inválida.");
  }

  const emit = first(infNFe, "emit");
  const ide = first(infNFe, "ide");

  const fornecedor_cnpj = soDigitos(childText(emit, "CNPJ")) || null;
  const fornecedor_nome = childText(emit, "xNome") || null;
  const numero_nf = childText(ide, "nNF") || null;

  const dhEmi = childText(ide, "dhEmi") || childText(ide, "dEmi");
  const data_emissao = dhEmi ? dhEmi.slice(0, 10) : null;

  const itens: EpiNfeItemParsed[] = all(infNFe, "det").map((det) => {
    const prod = first(det, "prod");
    const qtd = Number(childText(prod, "qCom").replace(",", "."));
    const vun = childText(prod, "vUnCom").replace(",", ".");
    return {
      cprod: childText(prod, "cProd"),
      xprod: childText(prod, "xProd"),
      ncm: childText(prod, "NCM"),
      unidade: childText(prod, "uCom") || "un",
      quantidade: Number.isFinite(qtd) ? qtd : 0,
      valor_unitario: vun ? Number(vun) : null,
    };
  });

  if (itens.length === 0) {
    throw new NfeParseError("A NF-e não contém itens (det/prod).");
  }

  return {
    chnfe,
    fornecedor_cnpj,
    fornecedor_nome,
    numero_nf,
    data_emissao,
    itens,
  };
}

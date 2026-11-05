// Comercial › Liberar serviços (0.3.233, banco v321): a equipe decide, serviço por serviço, o que
// o vendedor vê. Puro (sem tela, sem banco) para testar.
//
// O botão da inspeção e da AEP manda o documento para a fila (`liberado_comercial_em`). Cada
// serviço indicado por ele fica em um destes estados:
//   pendente → na fila, esperando decisão. O vendedor não vê, se ainda houver o que vender;
//   liberado → decidido; o vendedor vê, com modalidades e orientação;
//   segurado → decidido; o vendedor não vê; o motivo fica registrado;
//   legado   → o documento já estava liberado antes da fila existir e ninguém decidiu nada: o
//              vendedor continua vendo (decisão do João em 05/11/2026). Dá para segurar.
//
// A DECISÃO VALE PARA O ENVIO QUE ELA VIU. Documento reenviado depois dela (reaberto, ajustado,
// ou nova inspeção da empresa) traz informação nova: o serviço volta para a fila.

import { A_VENDER, type EmpresaComercial, type Oportunidade, type Produto } from "@/lib/comercial/oportunidades";

export const MODALIDADES = ["EAD", "Presencial", "Ao vivo"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

/** Serviços vendidos em mais de um formato. A Etapa 3 soma as intervenções. */
export const PRODUTOS_COM_MODALIDADE: readonly Produto[] = ["Treinamentos NR"];

export type StatusDecisao = "LIBERADO" | "SEGURADO";
export type EstadoServico = "pendente" | "liberado" | "segurado" | "legado";

export interface DecisaoServico {
  id_empresa: string;
  produto: Produto;
  status: StatusDecisao;
  modalidades: string[];
  orientacao: string | null;
  motivo: string | null;
  decidido_por: string | null;
  decidido_em: string;
}

export interface ServicoNaFila {
  empresa: EmpresaComercial;
  oportunidade: Oportunidade;
  estado: EstadoServico;
  /** A decisão gravada, mesmo vencida: serve para preencher a próxima. */
  decisao: DecisaoServico | null;
  /** O documento foi reenviado depois da decisão gravada. */
  reenviado: boolean;
  /** Último envio dos documentos que indicam o serviço. */
  enviadoEm: string | null;
}

/** Quando cada documento que indica o serviço foi enviado. */
export function enviosDoServico(c: EmpresaComercial, o: Oportunidade): string[] {
  const envios: (string | null | undefined)[] = [];
  if (o.origens.includes("AEP")) envios.push(c.aepLiberadaEm);
  if (o.origens.includes("Inspeção")) envios.push(c.inspecao?.liberadoEm);
  return envios.filter((x): x is string => !!x).sort();
}

const instante = (x: string) => new Date(x).getTime();

export function avaliarServico(
  c: EmpresaComercial,
  o: Oportunidade,
  decisao: DecisaoServico | null | undefined,
  corte: string | null | undefined,
): Pick<ServicoNaFila, "estado" | "reenviado" | "enviadoEm"> {
  const envios = enviosDoServico(c, o);
  const enviadoEm = envios[envios.length - 1] ?? null;
  if (decisao) {
    const reenviado = !!enviadoEm && instante(enviadoEm) > instante(decisao.decidido_em);
    if (reenviado) return { estado: "pendente", reenviado, enviadoEm };
    return { estado: decisao.status === "LIBERADO" ? "liberado" : "segurado", reenviado, enviadoEm };
  }
  // Sem corte, o banco ainda não tem a v321: tudo continua como antes.
  const antesDaFila = !corte || envios.some((e) => instante(e) < instante(corte));
  return { estado: antesDaFila ? "legado" : "pendente", reenviado: false, enviadoEm };
}

const chave = (idEmpresa: string, produto: string) => `${idEmpresa}|${produto}`;

/**
 * Todos os serviços que ainda têm o que vender, com o estado de cada um. Serviço em andamento ou
 * realizado não pede decisão, então não entra.
 */
export function montarFila(
  lista: readonly EmpresaComercial[],
  decisoes: readonly DecisaoServico[],
  corte: string | null | undefined,
): ServicoNaFila[] {
  const porChave = new Map(decisoes.map((d) => [chave(d.id_empresa, d.produto), d]));
  const fila: ServicoNaFila[] = [];
  for (const c of lista) {
    for (const o of c.oportunidades) {
      if (!A_VENDER.includes(o.situacao)) continue;
      const decisao = porChave.get(chave(c.empresa.idEmpresa, o.produto)) ?? null;
      fila.push({ empresa: c, oportunidade: o, decisao, ...avaliarServico(c, o, decisao, corte) });
    }
  }
  return fila;
}

/**
 * O que o vendedor vê: tira o pendente e o segurado e leva modalidades e orientação para o cartão.
 * Em andamento e realizado continuam, para ele saber que não há o que vender; segurado não aparece
 * em situação nenhuma. Empresa sem nenhum serviço visível sai da lista.
 */
export function visaoDoVendedor(
  lista: readonly EmpresaComercial[],
  decisoes: readonly DecisaoServico[],
  corte: string | null | undefined,
): EmpresaComercial[] {
  const porChave = new Map(decisoes.map((d) => [chave(d.id_empresa, d.produto), d]));
  const resultado: EmpresaComercial[] = [];
  for (const c of lista) {
    const oportunidades: Oportunidade[] = [];
    for (const o of c.oportunidades) {
      const decisao = porChave.get(chave(c.empresa.idEmpresa, o.produto));
      const { estado } = avaliarServico(c, o, decisao, corte);
      if (estado === "segurado") continue;
      if (estado === "pendente" && A_VENDER.includes(o.situacao)) continue;
      oportunidades.push(
        estado === "liberado" && decisao
          ? {
              ...o,
              liberacao: {
                modalidades: decisao.modalidades ?? [],
                orientacao: decisao.orientacao,
                por: decisao.decidido_por,
                em: decisao.decidido_em,
              },
            }
          : o,
      );
    }
    if (oportunidades.length > 0) resultado.push({ ...c, oportunidades });
  }
  return resultado;
}

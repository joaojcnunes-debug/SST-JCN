// Consolidação › Liberar para o Comercial (0.3.233, banco v321). A equipe decide, serviço por
// serviço, o que o vendedor vê, num atendimento por empresa. Puro (sem tela, sem banco) para testar.
//
// O botão da inspeção e da AEP manda o documento para a fila (`liberado_comercial_em`). Cada
// serviço indicado por ele fica em um destes estados:
//   pendente → na fila, esperando decisão. O vendedor não vê, se ainda houver o que vender;
//   liberado → decidido; o vendedor vê, com modalidades e orientação, depois de CONCLUÍDO;
//   segurado → decidido; o vendedor não vê; o motivo fica registrado;
//   legado   → o documento já estava liberado antes da fila existir e ninguém decidiu nada: o
//              vendedor continua vendo (decisão do João em 05/11/2026). Dá para segurar.
//
// A DECISÃO VALE PARA O ENVIO QUE ELA VIU. Documento reenviado depois dela (reaberto, ajustado,
// ou nova inspeção da empresa) traz informação nova: o serviço volta para a fila.
//
// REABRIR tira do vendedor o que foi liberado e as intervenções, até concluir de novo. Espelha a
// inspeção: reaberta, ela sai do Comercial.

import {
  A_VENDER,
  empresaBase,
  type Cad,
  type EmpresaComercial,
  type Oportunidade,
  type Produto,
} from "@/lib/comercial/oportunidades";

export const MODALIDADES = ["EAD", "Presencial", "Ao vivo"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

/** Serviços vendidos em mais de um formato. As intervenções têm as modalidades no catálogo. */
export const PRODUTOS_COM_MODALIDADE: readonly Produto[] = ["Treinamentos NR"];

export type StatusDecisao = "LIBERADO" | "SEGURADO";
export type EstadoServico = "pendente" | "liberado" | "segurado" | "legado";
export type StatusAtendimento = "EM_ANDAMENTO" | "CONCLUIDO";
export type SituacaoEmpresa = "fila" | "andamento" | "concluida";

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

export interface AtendimentoComercial {
  id_empresa: string;
  status: StatusAtendimento;
  parecer: string | null;
  concluido_em: string | null;
  concluido_por: string | null;
  empresas?: Cad | null;
}

export interface IntervencaoIndicada {
  id_empresa: string;
  id_intervencao: string;
  nome: string;
  responsavel: string | null;
  modalidades: string[];
  orientacao: string | null;
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

export interface ResumoEmpresa {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  situacao: SituacaoEmpresa;
  /** Serviços esperando decisão. */
  pendentes: number;
  servicos: number;
  atendimento: AtendimentoComercial | null;
  /** Concluído, mas chegou serviço novo: precisa reabrir. */
  chegouServico: boolean;
  /** Sem atendimento: só tem o que já estava liberado antes da fila. */
  soAntesDaFila: boolean;
}

/** Uma linha por empresa, para a lista de atendimentos. */
export function resumirEmpresas(fila: readonly ServicoNaFila[], atendimentos: readonly AtendimentoComercial[]): ResumoEmpresa[] {
  const porEmpresa = new Map<string, ServicoNaFila[]>();
  for (const s of fila) {
    const id = s.empresa.empresa.idEmpresa;
    porEmpresa.set(id, [...(porEmpresa.get(id) ?? []), s]);
  }
  const atend = new Map(atendimentos.map((a) => [a.id_empresa, a]));
  const ids = new Set([...porEmpresa.keys(), ...atend.keys()]);
  const linhas: ResumoEmpresa[] = [];
  for (const id of ids) {
    const servicos = porEmpresa.get(id) ?? [];
    const a = atend.get(id) ?? null;
    const pendentes = servicos.filter((s) => s.estado === "pendente").length;
    const e = servicos[0]?.empresa.empresa;
    const situacao: SituacaoEmpresa =
      a?.status === "EM_ANDAMENTO" ? "andamento" : pendentes > 0 ? "fila" : "concluida";
    linhas.push({
      idEmpresa: id,
      nome: e?.nome ?? a?.empresas?.nome_empresa ?? "Empresa sem cadastro",
      cnpj: e?.cnpj ?? a?.empresas?.cnpj ?? null,
      municipio: e?.municipio ?? a?.empresas?.municipio ?? null,
      uf: e?.uf ?? a?.empresas?.uf ?? null,
      situacao,
      pendentes,
      servicos: servicos.length,
      atendimento: a,
      chegouServico: a?.status === "CONCLUIDO" && pendentes > 0,
      soAntesDaFila: !a && pendentes === 0,
    });
  }
  return linhas.sort((x, y) => y.pendentes - x.pendentes || x.nome.localeCompare(y.nome, "pt-BR"));
}

/** O que falta para concluir o atendimento; null quando pode. */
export function faltaParaConcluir(pendentes: number, parecer: string | null | undefined): string | null {
  if (pendentes > 0) return pendentes === 1 ? "Decida o serviço que está na fila." : `Decida os ${pendentes} serviços que estão na fila.`;
  if (!parecer?.trim()) return "Escreva o parecer.";
  return null;
}

/**
 * O que o vendedor vê: tira o pendente e o segurado, e o liberado de atendimento não concluído.
 * Leva modalidades, orientação, parecer e as intervenções para o cartão. Em andamento e realizado
 * continuam, para ele saber que não há o que vender; segurado não aparece em situação nenhuma.
 * Empresa sem nenhum serviço visível sai da lista.
 */
export function visaoDoVendedor(
  lista: readonly EmpresaComercial[],
  decisoes: readonly DecisaoServico[],
  corte: string | null | undefined,
  atendimentos: readonly AtendimentoComercial[] = [],
  indicadas: readonly IntervencaoIndicada[] = [],
): EmpresaComercial[] {
  const porChave = new Map(decisoes.map((d) => [chave(d.id_empresa, d.produto), d]));
  const concluidos = new Map(atendimentos.filter((a) => a.status === "CONCLUIDO").map((a) => [a.id_empresa, a]));
  const resultado = new Map<string, EmpresaComercial>();

  for (const c of lista) {
    const id = c.empresa.idEmpresa;
    const oportunidades: Oportunidade[] = [];
    for (const o of c.oportunidades) {
      const decisao = porChave.get(chave(id, o.produto));
      const { estado } = avaliarServico(c, o, decisao, corte);
      if (estado === "segurado") continue;
      if (estado === "pendente" && A_VENDER.includes(o.situacao)) continue;
      if (estado === "liberado" && !concluidos.has(id) && A_VENDER.includes(o.situacao)) continue;
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
    if (oportunidades.length > 0) resultado.set(id, { ...c, oportunidades });
  }

  for (const [id, a] of concluidos) {
    const dela = indicadas.filter((i) => i.id_empresa === id);
    const atual = resultado.get(id);
    if (dela.length > 0) {
      const oportunidade: Oportunidade = {
        produto: "Intervenção psicossocial",
        situacao: "aberta",
        origens: ["Psicossocial"],
        detalhes: dela.map((i) =>
          [i.nome, i.modalidades.length > 0 ? i.modalidades.join(", ") : null, i.orientacao].filter(Boolean).join(" · "),
        ),
        setores: [],
      };
      const base: EmpresaComercial = atual ?? {
        empresa: empresaBase(id, a.empresas ?? {}),
        telefone: a.empresas?.telefone?.trim() || null,
        email: a.empresas?.email?.trim() || null,
        oportunidades: [],
        expostosAet: 0,
        temAep: false,
        inspecao: null,
        aepLiberadaEm: null,
        aepLiberadaPor: null,
      };
      resultado.set(id, { ...base, oportunidades: [...base.oportunidades, oportunidade] });
    }
    const final = resultado.get(id);
    if (final && a.parecer) resultado.set(id, { ...final, parecerEquipe: a.parecer });
  }
  return [...resultado.values()];
}

// Módulo Comercial (2026-10-05): transforma o que a JCN já levantou no cliente
// em OPORTUNIDADES de venda — serviços indicados e que a empresa ainda não
// contratou. Puro (sem tela, sem banco) para testar. Dados da RPC
// `comercial_dados` (v267/v268).
//
// Da AEP ENTREGUE mais recente (regra da Sinalização):
//   • AET (vendida à parte): algum setor com "Necessita AET".
//   • DRPS / Questionário: 3+ alertas organizacionais (`recomendaQuestionario`).
// Da última INSPEÇÃO CONCLUÍDA (v268, escolha do usuário em 2026-10-05):
//   • Apreciação NR-12: máquina com "Necessita adequação NR-12" ou grau Alto/Crítico.
//   • Medição quantitativa: risco físico com "Necessita medição".
//   • Análise de Químicos: risco químico registrado.
//   • AEP: risco ergonômico registrado.
//   • DRPS / Questionário: risco psicossocial registrado.
//   • Treinamentos NR: treinamentos indicados na aba Treinamentos.
//
// Situação, pelo que a empresa já tem no sistema:
//   aberta    → indicada e nenhum documento do serviço existe (vender);
//   revisao   → DRPS/Questionário concluído ANTES da AEP/inspeção que o indicou
//               (v269): vender a revisão;
//   andamento → já existe um em rascunho/andamento (provavelmente vendido);
//   realizada → já existe um concluído/enviado depois da indicação.
// Medição quantitativa não tem módulo no sistema: fica sempre "aberta".
// Treinamentos: realizada quando TODA NR indicada já tem certificado emitido
// para a empresa; andamento quando só parte tem.

import { montarSinalizacao, type AepEntregue, type EmpresaSinalizada } from "@/lib/aep/sinalizacao";

export type SituacaoOportunidade = "aberta" | "revisao" | "andamento" | "realizada";

/** Situações que o comercial ainda pode vender. */
export const A_VENDER: SituacaoOportunidade[] = ["aberta", "revisao"];
export type Produto =
  | "AET"
  | "DRPS/Questionário"
  | "Apreciação NR-12"
  | "Medição quantitativa"
  | "Análise de Químicos"
  | "AEP"
  | "Treinamentos NR";
export type Origem = "AEP" | "Inspeção";

/** Ordem de exibição dos produtos. */
export const PRODUTOS: Produto[] = [
  "AET",
  "AEP",
  "DRPS/Questionário",
  "Apreciação NR-12",
  "Medição quantitativa",
  "Análise de Químicos",
  "Treinamentos NR",
];

export const NOME_PRODUTO: Record<Produto, string> = {
  AET: "AET – Análise Ergonômica do Trabalho",
  AEP: "AEP – Análise Ergonômica Preliminar",
  "DRPS/Questionário": "DRPS / Questionário Psicossocial",
  "Apreciação NR-12": "Apreciação de Máquinas (NR-12)",
  "Medição quantitativa": "Avaliação quantitativa (medição)",
  "Análise de Químicos": "Análise de Químicos",
  "Treinamentos NR": "Treinamentos NR",
};

export interface DocEmpresa {
  id_empresa: string;
  tipo: "AET" | "DRPS" | "QPS" | "AEP" | "APRECIACAO" | "QUIMICOS";
  status: string | null;
  /** Data do documento (v269): envio/conclusão/elaboração. */
  data?: string | null;
}

export interface CertificadoEmpresa {
  id_empresa: string;
  nr: string | null;
}

export interface InspecaoComercial {
  id_inspecao: string;
  id_empresa: string;
  concluida_em: string | null;
  responsavel: string | null;
  empresas?: unknown;
  maquinas: { nome: string | null; grau_risco: string | null; adequacao: boolean | null }[];
  medicoes: { agente: string | null; qual: string | null; setor: string | null }[];
  quimicos: string[];
  ergonomicos: number;
  psicossociais: number;
  treinamentos: { nr: string | null; titulo: string | null }[];
}

export interface SetorAet {
  nome: string;
  expostos: number;
  cargos: number;
}

export interface Oportunidade {
  produto: Produto;
  situacao: SituacaoOportunidade;
  /** De onde veio a indicação (pode ser das duas). */
  origens: Origem[];
  /** Itens que justificam: setores, máquinas, agentes, treinamentos… */
  detalhes: string[];
  /** Para AET: setores indicados (com expostos). */
  setores: SetorAet[];
}

export interface InfoInspecao {
  idInspecao: string;
  concluidaEm: string | null;
  responsavel: string | null;
}

export interface EmpresaComercial {
  empresa: EmpresaSinalizada;
  telefone: string | null;
  email: string | null;
  oportunidades: Oportunidade[];
  /** Trabalhadores expostos nos setores indicados para AET (base do orçamento). */
  expostosAet: number;
  /** A empresa tem AEP entregue (a base das oportunidades de AEP). */
  temAep: boolean;
  /** Última inspeção concluída usada. */
  inspecao: InfoInspecao | null;
}

const FASE: Record<string, "realizada" | "andamento"> = {
  CONCLUIDO: "realizada",
  FINALIZADO: "realizada",
  ENVIADO_CLIENTE: "realizada",
  RASCUNHO: "andamento",
  EM_ANDAMENTO: "andamento",
};

/** Melhor situação entre os documentos: realizada > andamento > aberta. */
export function situacaoPorDocs(status: (string | null)[]): SituacaoOportunidade {
  const fases = status.map((s) => FASE[s ?? ""]).filter(Boolean);
  if (fases.includes("realizada")) return "realizada";
  if (fases.includes("andamento")) return "andamento";
  return "aberta";
}

/**
 * Como `situacaoPorDocs`, mas um documento concluído ANTES da indicação
 * (data da AEP entregue / inspeção concluída) vira "revisao": a indicação é
 * mais nova que o documento. Sem data em algum dos lados, fica "realizada".
 */
export function situacaoComRevisao(lista: DocEmpresa[], dataIndicacao: string | null | undefined): SituacaoOportunidade {
  const sit = situacaoPorDocs(lista.map((d) => d.status));
  if (sit !== "realizada" || !dataIndicacao) return sit;
  const ultimaConcluida = lista
    .filter((d) => FASE[d.status ?? ""] === "realizada")
    .map((d) => d.data)
    .filter((x): x is string => !!x)
    .sort()
    .pop();
  if (ultimaConcluida && ultimaConcluida.slice(0, 10) < dataIndicacao.slice(0, 10)) return "revisao";
  return sit;
}

/** "NR-06", "NR 6" e "6" viram "6" — para casar treinamento com certificado. */
export function numeroNr(nr: string | null | undefined): string {
  const m = (nr ?? "").match(/\d+/);
  return m ? String(Number(m[0])) : (nr ?? "").trim().toLowerCase();
}

type Cad = {
  nome_empresa?: string;
  cnpj?: string | null;
  id_unidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
};

function empresaBase(id: string, cad: Cad): EmpresaSinalizada {
  return {
    idEmpresa: id,
    nome: cad.nome_empresa ?? "Empresa sem cadastro",
    cnpj: cad.cnpj ?? null,
    avaliacoes: [],
    totalSetores: 0,
    totalAlertas: 0,
    totalAltos: 0,
    pior: null,
    ultimaData: null,
    precisaAet: false,
    precisaQuestionario: false,
    realizadaPor: null,
    enviadoPor: null,
    temInspecao: false,
    idUnidade: cad.id_unidade ?? null,
    municipio: cad.municipio ?? null,
    uf: cad.uf ?? null,
  };
}

export function montarComercial(
  aeps: (AepEntregue & { empresas?: unknown })[],
  docs: DocEmpresa[],
  inspecoes: InspecaoComercial[] = [],
  certificados: CertificadoEmpresa[] = [],
): EmpresaComercial[] {
  // ── Base das AEPs: Sinalização (empresas com fator organizacional) + as que
  // só têm AET indicada pela ergonomia física/cognitiva.
  const sinal = new Map(montarSinalizacao(aeps).map((e) => [e.idEmpresa, e]));
  const ultimaAep = new Map<string, AepEntregue & { empresas?: unknown }>();
  for (const a of aeps) {
    const atual = ultimaAep.get(a.id_empresa);
    const data = (x: AepEntregue) => x.entregue_em ?? x.data_elaboracao ?? "";
    if (!atual || data(a) > data(atual)) ultimaAep.set(a.id_empresa, a);
  }
  const inspPorEmpresa = new Map(inspecoes.map((i) => [i.id_empresa, i]));
  const ids = new Set([...ultimaAep.keys(), ...inspPorEmpresa.keys()]);

  const resultado: EmpresaComercial[] = [];
  for (const id of ids) {
    const aep = ultimaAep.get(id);
    const insp = inspPorEmpresa.get(id);
    const cad = ((aep?.empresas ?? insp?.empresas) ?? {}) as Cad;

    let empresa = sinal.get(id);
    if (!empresa) {
      empresa = empresaBase(id, cad);
      if (aep) {
        empresa.precisaAet = (aep.setores ?? []).some((s) => s.necessita_aet);
        empresa.ultimaData = aep.entregue_em ?? aep.data_elaboracao ?? null;
        empresa.realizadaPor = aep.responsavel_elaboracao || null;
        empresa.enviadoPor = aep.enviado_por?.trim() || null;
        empresa.temInspecao = !!(aep as { id_inspecao?: string | null }).id_inspecao;
      }
    }

    const docsDa = docs.filter((d) => d.id_empresa === id);
    const sit = (...tipos: DocEmpresa["tipo"][]) =>
      situacaoPorDocs(docsDa.filter((d) => tipos.includes(d.tipo)).map((d) => d.status));
    const ops = new Map<Produto, Oportunidade>();
    const add = (produto: Produto, situacao: SituacaoOportunidade, origem: Origem, detalhes: string[], setores: SetorAet[] = []) => {
      const ja = ops.get(produto);
      if (ja) {
        if (!ja.origens.includes(origem)) ja.origens.push(origem);
        ja.detalhes.push(...detalhes.filter((d) => !ja.detalhes.includes(d)));
        return;
      }
      ops.set(produto, { produto, situacao, origens: [origem], detalhes: [...detalhes], setores });
    };

    // ── Da AEP entregue
    const setoresAet: SetorAet[] = (aep?.setores ?? [])
      .filter((s) => s.necessita_aet)
      .map((s) => ({
        nome: s.nome_setor || "Setor sem nome",
        expostos: Number(s.qtd_expostos) || 0,
        cargos: (s.cargos ?? []).filter((c) => c.cargo).length,
      }));
    if (aep && empresa.precisaAet) {
      add("AET", sit("AET"), "AEP", setoresAet.map((s) => s.nome), setoresAet);
    }
    // DRPS/Questionário: a indicação mais nova (AEP ou inspeção) define se o
    // documento existente ainda vale ou precisa de revisão.
    const docsQuest = docsDa.filter((d) => d.tipo === "DRPS" || d.tipo === "QPS");
    const dataIndicQuest = [
      aep && empresa.precisaQuestionario ? (aep.entregue_em ?? aep.data_elaboracao) : null,
      insp && insp.psicossociais > 0 ? insp.concluida_em : null,
    ]
      .filter((x): x is string => !!x)
      .sort()
      .pop();
    const sitQuest = situacaoComRevisao(docsQuest, dataIndicQuest);
    const revisaoQuest = (() => {
      if (sitQuest !== "revisao") return [];
      const ult = docsQuest
        .filter((d) => d.status === "CONCLUIDO" || d.status === "ENVIADO_CLIENTE")
        .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""))
        .pop();
      const br = (x: string | null | undefined) => (x ? x.slice(0, 10).split("-").reverse().join("/") : "");
      return ult ? [`${ult.tipo === "QPS" ? "Questionário" : "DRPS"} concluído em ${br(ult.data)}, antes da indicação de ${br(dataIndicQuest)}`] : [];
    })();
    if (aep && empresa.precisaQuestionario) {
      add("DRPS/Questionário", sitQuest, "AEP", [
        `${empresa.totalAlertas} fator(es) organizacional(is) na AEP`,
        ...revisaoQuest,
      ]);
    }

    // ── Da inspeção concluída
    if (insp) {
      if (insp.maquinas.length > 0) {
        add(
          "Apreciação NR-12",
          sit("APRECIACAO"),
          "Inspeção",
          insp.maquinas.map(
            (m) =>
              `${m.nome || "Máquina"}${m.grau_risco ? ` (grau ${m.grau_risco.toLowerCase()})` : ""}${m.adequacao ? " · necessita adequação" : ""}`,
          ),
        );
      }
      if (insp.medicoes.length > 0) {
        add(
          "Medição quantitativa",
          "aberta",
          "Inspeção",
          insp.medicoes.map((m) => [m.qual || m.agente || "Agente físico", m.setor].filter(Boolean).join(" · ")),
        );
      }
      if (insp.quimicos.length > 0) {
        add("Análise de Químicos", sit("QUIMICOS"), "Inspeção", insp.quimicos);
      }
      if (insp.ergonomicos > 0) {
        add("AEP", sit("AEP"), "Inspeção", [`${insp.ergonomicos} risco(s) ergonômico(s) na inspeção`]);
      }
      if (insp.psicossociais > 0) {
        add("DRPS/Questionário", sitQuest, "Inspeção", [
          `${insp.psicossociais} risco(s) psicossocial(is) na inspeção`,
          ...revisaoQuest,
        ]);
      }
      if (insp.treinamentos.length > 0) {
        const certs = new Set(certificados.filter((c) => c.id_empresa === id).map((c) => numeroNr(c.nr)));
        const comCert = insp.treinamentos.filter((t) => certs.has(numeroNr(t.nr)));
        const situacao: SituacaoOportunidade =
          comCert.length === insp.treinamentos.length ? "realizada" : comCert.length > 0 ? "andamento" : "aberta";
        add(
          "Treinamentos NR",
          situacao,
          "Inspeção",
          insp.treinamentos.map(
            (t) => `${[t.nr, t.titulo].filter(Boolean).join(" – ")}${certs.has(numeroNr(t.nr)) ? " · certificado emitido" : ""}`,
          ),
        );
      }
    }

    const oportunidades = PRODUTOS.map((p) => ops.get(p)).filter((o): o is Oportunidade => !!o);
    if (oportunidades.length === 0) continue;
    resultado.push({
      empresa,
      telefone: cad.telefone?.trim() || null,
      email: cad.email?.trim() || null,
      oportunidades,
      expostosAet: setoresAet.reduce((n, s) => n + s.expostos, 0),
      temAep: !!aep,
      inspecao: insp ? { idInspecao: insp.id_inspecao, concluidaEm: insp.concluida_em, responsavel: insp.responsavel } : null,
    });
  }

  const abertas = (c: EmpresaComercial) => c.oportunidades.filter((o) => A_VENDER.includes(o.situacao)).length;
  return resultado.sort((a, b) => abertas(b) - abertas(a) || a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"));
}

/** Uma linha por oportunidade, para exportar (CSV/Excel). */
export function linhasCsv(lista: EmpresaComercial[], nomeUnidade: (id: string | null) => string): string[][] {
  const cab = [
    "Empresa", "CNPJ", "Unidade", "Município/UF", "Telefone", "E-mail", "Produto", "Situação", "Origem",
    "Detalhes", "Trabalhadores expostos (AET)", "Nível AIHA", "AEP realizada por", "AEP enviada por", "AEP entregue em",
    "Inspeção", "Inspeção concluída em",
  ];
  const rot: Record<SituacaoOportunidade, string> = {
    aberta: "Aberta",
    revisao: "Revisão recomendada",
    andamento: "Em andamento",
    realizada: "Realizada",
  };
  const linhas = lista.flatMap((c) =>
    c.oportunidades.map((o) => [
      c.empresa.nome,
      c.empresa.cnpj ?? "",
      nomeUnidade(c.empresa.idUnidade),
      [c.empresa.municipio, c.empresa.uf].filter(Boolean).join("/"),
      c.telefone ?? "",
      c.email ?? "",
      NOME_PRODUTO[o.produto],
      rot[o.situacao],
      o.origens.join(" + "),
      o.detalhes.join(" | "),
      o.produto === "AET" ? String(c.expostosAet) : "",
      c.empresa.pior ?? "",
      c.temAep ? (c.empresa.realizadaPor ?? "") : "",
      c.temAep ? (c.empresa.enviadoPor ?? "") : "",
      c.temAep && c.empresa.ultimaData ? c.empresa.ultimaData.slice(0, 10) : "",
      c.inspecao?.idInspecao ?? "",
      c.inspecao?.concluidaEm ? c.inspecao.concluidaEm.slice(0, 10) : "",
    ]),
  );
  return [cab, ...linhas];
}

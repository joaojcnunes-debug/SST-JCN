import { criterioNivel1, criterioNivel2, RotuloDesconhecido } from "./mapa-aiha";

export const DATA_ESTEIRA = "2000-01-01";
export const VALIDADE_ESTEIRA = "2000-12-31";

/** D3.3 (operador, 23/09): tempo de exposicao ausente BLOQUEIA o setor.
 *  E afirmacao sobre exposicao de trabalhador -- entra em PGR/LTCAT e sustenta
 *  insalubridade/aposentadoria especial. Nao admite palpite. 10,1% dos riscos. */
const TEMPO_SGG: Record<string, string> = {
  "Permanente": "Permanente",
  "Intermitente": "Habitual/Intermitente",
  "Ocasional": "Eventual/Ocasional",
  "Habitual": "Habitual",
};

/** D3.2: meio descreve a via fisica do agente, nao a dose -- default permitido. */
const MEIO_SGG: Record<string, string> = {
  "corporal": "Corporal", "contato": "Contato", "cutâneo": "Cutâneo", "cutaneo": "Cutâneo",
  "respiratório": "Respiratório", "respiratorio": "Respiratório", "sonora": "Sonora",
  "visual": "Visual", "oral": "Oral",
};
const MEIO_PADRAO = "Não Aplicável";

export type RiscoPainel = {
  id_risco: string; agente: string | null; id_setor: string | null;
  probabilidade: string | null; severidade: string | null;
  tempo_exposicao: string | null; meio_propagacao: string[] | null;
  fonte_geradora: string | null; tecnica_utilizada: string | null;
  situacao: string | null; numero_cas: string | null; via_absorcao: string | null;
  tipo_agente_biologico: string | null; fator_ergonomico: string | null;
  fator_psicossocial: string | null; pontuacao_iapat: string | null;
  observacoes_risco: string | null;
};
export type Impedimento = { id_risco: string; agente: string; motivo: string };

/** fonte_geradora/medidas_* sao array JSON serializado em text (15.433 linhas),
 *  com ~77 registros em texto puro -- JSON.parse ingenuo quebra neles. */
export function parseLista(bruto: string | null | undefined): string[] {
  const s = (bruto ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* cai no texto puro */ }
  }
  return [s];
}

function observacoes(r: RiscoPainel, caEpis: string[]): string {
  const p: string[] = [];
  if (r.situacao) p.push(`Situação: ${r.situacao}`);
  if (r.numero_cas) p.push(`CAS: ${r.numero_cas}`);
  if (r.via_absorcao) p.push(`Via de absorção: ${r.via_absorcao}`);
  if (r.tipo_agente_biologico) p.push(`Agente biológico: ${r.tipo_agente_biologico}`);
  if (r.fator_ergonomico) p.push(`Fator ergonômico: ${r.fator_ergonomico}`);
  if (r.fator_psicossocial) p.push(`Fator psicossocial: ${r.fator_psicossocial}`);
  if (r.pontuacao_iapat) p.push(`IAPAT: ${r.pontuacao_iapat}`);
  if (caEpis.length) p.push(`EPIs (CA): ${caEpis.join("; ")}`);
  if (r.observacoes_risco) p.push(r.observacoes_risco);
  return p.join(" | ").slice(0, 4000);
}

export function montarRisco(r: RiscoPainel, caEpis: string[] = []) {
  const tempo = TEMPO_SGG[(r.tempo_exposicao ?? "").trim()];
  if (!tempo) throw new Error("tempo_exposicao ausente ou desconhecido");
  const meios = (r.meio_propagacao ?? [])
    .map((m) => MEIO_SGG[m.trim().toLowerCase()]).filter(Boolean) as string[];
  return {
    risco: (r.agente ?? "").trim(),
    envia_esocial: "Não",
    matriz_risco: "AIHA",
    peso_criterio_nivel_1: criterioNivel1(r.probabilidade),
    peso_criterio_nivel_2: criterioNivel2(r.severidade),
    peso_criterio_nivel_3: "", peso_criterio_nivel_4: "", peso_criterio_nivel_5: "",
    peso_criterio_classificacao_1: "", peso_criterio_classificacao_2: "",
    peso_criterio_classificacao_3: "", peso_criterio_classificacao_4: "",
    peso_criterio_classificacao_5: "",
    // nivel_risco/classificacao_risco NUNCA vao: quem deriva e o SGG (handoff 4 da fase 2).
    nivel_risco: "", classificacao_risco: "",
    tipo_avaliacao: r.tecnica_utilizada === "Quantitativa" ? "Qualitativa" : "Qualitativa",
    fontes_geradoras: parseLista(r.fonte_geradora),
    // MEIOS DE PROPAGACAO VAO VAZIOS DE PROPOSITO (medido 23/09).
    // O SGG valida o meio CONTRA O AGENTE (D40035), e nao so contra o catalogo
    // global: com o agente "Queda em mesmo nivel", TODOS os candidatos foram
    // recusados -- "Corporal" (que o painel usa em 6.391 riscos), "Nao Aplicavel"
    // e "Contato fisico", os tres presentes no catalogo de 19 meios do SGG.
    // Um meio invalido recusa a AVALIACAO INTEIRA, entao mandar e pior do que
    // omitir: sem o campo, o mesmo payload passou (sgg_id 42534). 108 dos 398
    // riscos reais do SGG tambem nao tem meio, ou seja, e opcional la.
    // Religar quando o export trouxer o vinculo agente -> meios (item 4 do
    // pedido a Laya); a lista do painel ja esta pronta em `meios`.
    meios_propagacao: [],
    tempo_exposicao: { tipo: tempo, detalhes: "" },
    quantitativas: [],
    dados_adicionais: { descricao: "", sugestoes: "", riscos: "", observacoes: observacoes(r, caEpis) },
    perigos: "", atividades: "",
    previdenciario: {
      aposentadoria_especial: "Não", gfip: "Em branco", fae: "",
      insalubridade: { grau: "N.A.", porcentagem: "0" },
      periculosidade: { grau: "N.A.", porcentagem: "0" },
    },
    eficacia_epi: "Não aplicável", eficacia_epc: "Não aplicável",
    // EPI/EPC/medidas ficam FORA nesta fase: sem o export dos vinculos, D40064
    // recusaria a avaliacao inteira.
    epis_recomendados: [], epis_utilizados: [], epcs_recomendados: [], epcs_utilizados: [],
    medidas_recomendadas: [], medidas_utilizadas: [],
  };
}

/** Monta o payload de UM setor. Devolve impedimentos em vez de lancar: a UI precisa
 *  nomear QUAL risco falta -- bloqueio sem o "o que" e beco sem saida para quem clica. */
export function montarPayloadSetor(args: {
  sggIdEmpresa: string; sggIdSetor: string; sggIdsCargos: string[];
  riscos: RiscoPainel[]; caPorRisco?: Record<string, string[]>;
}): { payload: Record<string, unknown> } | { impedimentos: Impedimento[] } {
  const impedimentos: Impedimento[] = [];
  const riscos: unknown[] = [];
  for (const r of args.riscos) {
    const agente = (r.agente ?? "").trim();
    if (!agente) { impedimentos.push({ id_risco: r.id_risco, agente: "(sem agente)", motivo: "risco sem agente" }); continue; }
    try {
      riscos.push(montarRisco(r, args.caPorRisco?.[r.id_risco] ?? []));
    } catch (e) {
      const motivo = e instanceof RotuloDesconhecido
        ? `${e.eixo} "${e.rotulo}" não existe na matriz — corrija o risco no painel`
        : "tempo de exposição não preenchido — obrigatório para enviar ao SGG";
      impedimentos.push({ id_risco: r.id_risco, agente, motivo });
    }
  }
  if (!args.sggIdsCargos.length) {
    impedimentos.push({ id_risco: "-", agente: "-", motivo: "setor sem cargos no SGG — não é possível enviar" });
  }
  if (impedimentos.length) return { impedimentos };
  if (!riscos.length) return { impedimentos: [{ id_risco: "-", agente: "-", motivo: "setor sem riscos" }] };
  return {
    payload: {
      empresa: args.sggIdEmpresa,
      id_setor: args.sggIdSetor,
      ids_cargos: args.sggIdsCargos.join(","),   // TODOS os cargos do setor -> D40016 impossivel
      data: DATA_ESTEIRA,
      data_validade: VALIDADE_ESTEIRA,
      riscos,
    },
  };
}

/**
 * Um envio anterior pode ser reprocessado?
 *
 * A unique de `sgg_envios` e (id_inspecao, id_setor, data) e NAO filtra status,
 * entao ela dispara tambem quando a tentativa anterior falhou. So e seguro
 * postar de novo quando o SGG RECUSOU com codigo (`D40027`, `D40082`, ...):
 * nesse caso nada foi criado la. Qualquer outro caso — `indeterminado`, erro sem
 * codigo, ou `codigo: "PARSE"` (corpo irreconhecivel, pode ter gravado) — exige
 * conferencia humana no SGG, porque a API nao tem DELETE.
 *
 * FONTE UNICA: a rota importa esta funcao. Nao reescrever a regra em outro lugar.
 */
export function podeReprocessar(status: string, sggCodigo: string | null | undefined): boolean {
  return status === "erro" && !!sggCodigo && /^D\d{4,5}$/.test(sggCodigo);
}

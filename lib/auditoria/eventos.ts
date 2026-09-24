// Leitura da trilha de auditoria (`auditoria_eventos`, v212): rótulos, descrição
// em português de cada evento, o que conta como "concluiu" e para onde o
// registro leva. Puro — sem React, sem Supabase — para ser testável.

import type { AuditoriaAcao, AuditoriaEvento } from "@/lib/supabase/types";
import { ROTULO_MODULO } from "@/lib/supabase/types";

/** Rótulo do módulo: os do hub mais os 3 que só existem na trilha. */
export const ROTULO_MODULO_AUDITORIA: Record<string, string> = {
  ...ROTULO_MODULO,
  painel: "Inspeções",
  psicossocial: "DRPS",
  questionarios_psicossociais: "Questionários",
  aet: "AET",
  aep: "AEP",
  gestao_chabra: "Gestão Chabra (tarefas)",
  sistema: "Sistema",
  pdfs: "PDFs gerados",
};

export function rotuloModulo(modulo: string): string {
  return ROTULO_MODULO_AUDITORIA[modulo] ?? modulo;
}

/**
 * Nome humano da tabela. As mais comuns têm tradução; as outras caem no nome
 * técnico com "_" trocado por espaço — melhor que esconder o evento.
 */
const ROTULO_TABELA: Record<string, string> = {
  inspecoes: "inspeção",
  riscos: "risco",
  setores: "setor",
  cargos: "cargo",
  epi_epc: "EPI/EPC",
  fotos: "foto",
  responsaveis: "responsável",
  complementos: "complemento",
  extintores: "extintor",
  treinamentos_nr: "treinamento",
  treinamentos_setor: "vínculo treinamento × setor",
  treinamentos_cargo: "vínculo treinamento × cargo",
  treinamentos_risco: "vínculo treinamento × risco",
  inspecao_maquinas: "máquina da inspeção",
  inspecao_maquinas_setores: "vínculo máquina × setor",
  inspecao_associados: "associado da inspeção",
  pae_contatos: "contato do PAE",
  acoes_5w2h: "ação 5W2H",
  anexos: "anexo",
  empresas: "empresa",
  unidades: "unidade",
  usuarios: "usuário",
  configuracoes: "configuração",
  textos_padrao: "texto padrão",
  novidades_avisos: "aviso de novidades",
  cnae_grau_risco: "CNAE × grau de risco",
  relatorios_conformidade: "relatório de conformidade",
  relatorios_conformidade_itens: "item de conformidade",
  relatorios_nao_conformidade: "relatório de não conformidade",
  relatorios_nao_conformidade_itens: "não conformidade",
  apreciacoes_maquinas: "apreciação NR-12",
  apreciacoes_maquinas_itens: "item da apreciação",
  apreciacao_fichas_maquina: "máquina do laudo",
  apreciacao_acoes: "ação da apreciação",
  apreciacao_riscos_hrn: "risco HRN",
  inventario_maquinas: "máquina do inventário",
  analises_quimicos: "análise de químicos",
  aet_relatorios: "AET",
  aet_acoes: "ação do AET",
  aep_relatorios: "AEP",
  drps_relatorios: "DRPS",
  drps_plano_acao_5w2h: "ação do plano DRPS",
  qps_aplicacoes: "aplicação de questionário",
  qps_respondentes: "respondente",
  qps_plano_acao_5w2h: "ação do plano 5W2H da QAP",
  qps_plano_medidas: "plano de medidas da QAP",
  qps_monitoramento: "monitoramento da QAP",
  qps_revisao: "revisão da QAP",
  investigacoes_acidente: "investigação de acidente",
  investigacao_acoes: "ação da investigação",
  equipamentos: "equipamento",
  equipamentos_movimentacoes: "movimentação de equipamento",
  equipamentos_entregas: "entrega de equipamento",
  equipamentos_devolucoes: "devolução de equipamento",
  transferencias: "transferência",
  frota_veiculos: "veículo",
  frota_checklists: "checklist de saída",
  frota_manutencoes: "manutenção de veículo",
  frota_sinistros: "sinistro",
  frota_abastecimentos: "abastecimento",
  dim_unidades: "unidade do dimensionamento",
  dim_funcoes: "função do dimensionamento",
  dim_colaboradores: "colaborador do dimensionamento",
  dim_colaborador_unidades: "alocação do dimensionamento",
  dim_demanda_mensal: "lançamento mensal do dimensionamento",
  dim_unidade_mes: "mês da unidade (dimensionamento)",
  dim_portes: "porte do dimensionamento",
  dim_clientes_porte: "porte de cliente (dimensionamento)",
  dim_parametros: "parâmetros do dimensionamento",
  escala_dias: "dia da escala",
  escala_padrao_semanal: "padrão semanal da escala",
  escala_supervisores: "supervisor da escala",
  escala_feriados: "feriado",
  gg_profissionais: "profissional",
  gg_ausencias: "ausência",
  gg_substituicoes: "substituição",
  gestao_tarefas: "tarefa",
  gestao_subtarefas: "subtarefa",
  gestao_comentarios: "comentário",
  pdfs_gerados: "PDF gerado",
  pdfs_assinados: "PDF assinado",
  colaboradores_chabra: "colaborador",
};

export function rotuloTabela(tabela: string): string {
  return ROTULO_TABELA[tabela] ?? tabela.replace(/_/g, " ");
}

export const ROTULO_ACAO: Record<AuditoriaAcao, string> = {
  criou: "criou",
  editou: "editou",
  excluiu: "excluiu",
};

/** Status que significam "terminou" — vale para os 34 `status` do painel. */
const STATUS_CONCLUIDO = /^(CONCLUID[AO]|FINALIZAD[AO]|ENTREGUE|ASSINAD[AO]|CONCLUIDO_CLIENTE|ENCERRAD[AO]|APROVAD[AO])$/i;

/**
 * "Concluiu" = editou e o `status` foi para um valor de conclusão. É filtro
 * derivado, não uma 4ª ação: o gatilho grava só criou/editou/excluiu.
 */
export function ehConclusao(ev: Pick<AuditoriaEvento, "acao" | "campos_alterados" | "depois">): boolean {
  if (ev.acao !== "editou" || !ev.campos_alterados.includes("status")) return false;
  const novo = ev.depois?.status;
  return typeof novo === "string" && STATUS_CONCLUIDO.test(novo.trim());
}

/**
 * Nome do registro para a lista: o título gravado, ou uma coluna "de nome" que
 * exista no antes/depois, ou o id. 99 das 167 tabelas não têm coluna de título.
 */
export function nomeDoRegistro(ev: Pick<AuditoriaEvento, "titulo" | "registro_id" | "antes" | "depois">): string {
  if (ev.titulo) return ev.titulo;
  const linha = { ...(ev.antes ?? {}), ...(ev.depois ?? {}) };
  for (const c of ["nome_empresa", "titulo", "nome", "descricao", "placa", "nr_titulo", "email"]) {
    const v = linha[c];
    if (typeof v === "string" && v.trim()) return v.length > 120 ? v.slice(0, 117) + "…" : v;
  }
  return ev.registro_id ?? "—";
}

/** Uma frase: "editou empresa TERE FRUTAS (telefone, e-mail)". */
export function descreverEvento(ev: AuditoriaEvento): string {
  const base = `${ROTULO_ACAO[ev.acao]} ${rotuloTabela(ev.tabela)} ${nomeDoRegistro(ev)}`;
  if (ev.acao !== "editou" || ev.campos_alterados.length === 0) return base;
  const campos = ev.campos_alterados.slice(0, 4).map(rotuloCampo).join(", ");
  const resto = ev.campos_alterados.length > 4 ? ` +${ev.campos_alterados.length - 4}` : "";
  return `${base} (${campos}${resto})`;
}

export function rotuloCampo(campo: string): string {
  return campo.replace(/^id_/, "").replace(/_/g, " ");
}

/** Valor para exibir no antes/depois. */
export function formatarValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    // ISO com hora → data/hora local; ISO só data fica como está.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString("pt-BR");
    }
    return v;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string" || typeof x === "number")) return v.join(", ") || "—";
    return JSON.stringify(v);
  }
  return JSON.stringify(v);
}

/** Gravações sem pessoa por trás (v256): o nome da origem para a lista. */
const ROTULO_ORIGEM_SEM_PESSOA: Record<string, string> = {
  "formulario-publico": "Formulário público",
  "google-agenda/aviso-do-google": "Google Agenda (mudança feita no Google)",
  "gestao/calendario-ics": "Calendário ICS",
};

/** Quem gravou, para a lista: nome, ou o e-mail, ou a origem sem pessoa. */
export function quemGravou(
  ev: Pick<AuditoriaEvento, "usuario_email" | "usuario_role" | "usuario_origem">,
  nomes: ReadonlyMap<string, string>,
): string {
  if (ev.usuario_email) return nomes.get(ev.usuario_email) ?? ev.usuario_email;
  if (ev.usuario_role === "service_role") {
    if (!ev.usuario_origem) return "Servidor (rota de serviço)";
    return ROTULO_ORIGEM_SEM_PESSOA[ev.usuario_origem] ?? `Servidor (${ev.usuario_origem})`;
  }
  if (ev.usuario_role && ev.usuario_role !== "authenticated") return `Banco (${ev.usuario_role})`;
  return "Desconhecido";
}

/**
 * Para onde o registro leva. Só as tabelas-documento têm tela própria; as
 * filhas (risco, setor, item) levam ao documento pai quando o pai está no
 * evento (`id_inspecao`, `id_relatorio`…). Sem tela, null.
 */
export function rotaDoRegistro(ev: Pick<AuditoriaEvento, "tabela" | "registro_id" | "antes" | "depois">): string | null {
  const linha = { ...(ev.antes ?? {}), ...(ev.depois ?? {}) };
  const id = ev.registro_id;
  const pai = (c: string) => (typeof linha[c] === "string" ? (linha[c] as string) : null);
  switch (ev.tabela) {
    case "inspecoes": return id ? `/inspecoes/${id}` : null;
    case "empresas": return id ? `/empresas/${id}` : null;
    case "aet_relatorios": return id ? `/aet/${id}` : null;
    case "aep_relatorios": return id ? `/aep/${id}` : null;
    case "drps_relatorios": return id ? `/psicossocial/${id}` : null;
    case "relatorios_conformidade": return id ? `/relatorio-conformidade/${id}` : null;
    case "relatorios_nao_conformidade": return id ? `/relatorio-nao-conformidade/${id}` : null;
    case "apreciacoes_maquinas": return id ? `/apreciacao-maquinas/${id}` : null;
    case "analises_quimicos": return id ? `/analise-quimicos/${id}` : null;
    case "qps_aplicacoes": return id ? `/questionarios-psicossociais/${id}` : null;
    case "investigacoes_acidente": return id ? `/investigacao-acidente/${id}` : null;
    case "equipamentos": return id ? `/equipamentos/${id}` : null;
    case "frota_veiculos": return id ? `/frota/${id}` : null;
    case "usuarios": return "/usuarios";
    default: {
      const insp = pai("id_inspecao");
      if (insp) return `/inspecoes/${insp}`;
      const apr = pai("id_apreciacao");
      if (apr) return `/apreciacao-maquinas/${apr}`;
      const aplic = pai("id_aplicacao");
      if (aplic) return `/questionarios-psicossociais/${aplic}`;
      return null;
    }
  }
}

/**
 * Tira o acento do que a pessoa digitou na busca livre. O índice (v213) é
 * calculado sem acento; com acento na consulta, "nitrílica" acha 0 e
 * "nitrilica" acha 1 — medido na cópia do banco antes de subir.
 */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Agrupa por dia (chave AAAA-MM-DD local) mantendo a ordem recebida. */
export function agruparPorDia<T extends { ocorrido_em: string }>(eventos: T[]): { dia: string; eventos: T[] }[] {
  const grupos: { dia: string; eventos: T[] }[] = [];
  for (const ev of eventos) {
    const d = new Date(ev.ocorrido_em);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.eventos.push(ev);
    else grupos.push({ dia, eventos: [ev] });
  }
  return grupos;
}

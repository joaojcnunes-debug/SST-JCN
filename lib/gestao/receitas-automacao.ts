// v300 (Pacote C): receitas prontas de automação — o ponto de partida mais usado nas ferramentas do
// levantamento (Trello Butler, ClickUp templates, Jira library). A receita só monta a regra; quem
// precisa de pessoas (rodízio, e-mail para fora) nasce desligada até alguém completar.
// Puro (sem React): testado em receitas-automacao.test.ts.

import type { AcaoAutomacao, CondicaoAutomacao, GatilhoAutomacao } from "@/lib/hooks/useGestao";

export interface StatusMin { slug: string; nome: string; tipo?: string | null; ordem?: number }

export interface Receita {
  id: string;
  titulo: string;
  descricao: string;
  gatilho: GatilhoAutomacao;
  condicao: CondicaoAutomacao;
  acoes: AcaoAutomacao[];
}

const id = (n: number) => `r${n}`;

/** As receitas para um quadro (usa os status dele: o 1º "não iniciado", o 1º "concluído", um de revisão). */
export function receitasDoQuadro(statuses: readonly StatusMin[]): Receita[] {
  const ord = [...statuses].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const inicial = ord.find((s) => s.tipo === "nao_iniciado") ?? ord[0];
  const concluido = ord.find((s) => s.tipo === "concluido");
  const revisao = ord.find((s) => /revis/i.test(s.nome) || /REVIS/.test(s.slug));
  const naoConcluida: CondicaoAutomacao | undefined = concluido
    ? { all: [{ campo: "status", op: "!=", valor: concluido.slug }] }
    : undefined;

  const lista: (Receita | null | undefined | false)[] = [
    concluido && {
      id: "concluida-avisar",
      titulo: "Ao concluir, avisar quem acompanha",
      descricao: "Quando a tarefa vai para concluído, todos os vinculados recebem um aviso.",
      gatilho: "status_muda",
      condicao: { all: [{ campo: "status_para", op: "=", valor: concluido.slug }] },
      acoes: [{ id: id(1), tipo: "notificar", valor: "Concluída: {titulo}" }],
    },
    {
      id: "nova-prazo",
      titulo: "Tarefa nova sem prazo ganha prazo de 3 dias úteis",
      descricao: "Quando a tarefa é criada sem prazo, o prazo vira hoje + 3 dias úteis.",
      gatilho: "tarefa_criada",
      condicao: { all: [{ campo: "prazo_estado", op: "=", valor: "vazio" }] },
      acoes: [{ id: id(1), tipo: "definir_prazo", base: "hoje", dias: "3", uteis: "true" }],
    },
    {
      id: "vespera-email",
      titulo: "E-mail aos responsáveis na véspera do prazo",
      descricao: "Um dia antes do prazo, os responsáveis recebem um e-mail.",
      gatilho: "prazo_proximo",
      condicao: { dias_antes: "1" },
      acoes: [{ id: id(1), tipo: "enviar_email", para: "responsaveis", assunto: "Vence amanhã: {titulo}", mensagem: "Prazo: {prazo}. Quadro: {quadro}." }],
    },
    {
      id: "atrasada-urgente",
      titulo: "Atrasada: prioridade Urgente e aviso",
      descricao: "Quando o prazo vence, a prioridade vira Urgente e os vinculados são avisados.",
      gatilho: "prazo_vencido",
      condicao: {},
      acoes: [
        { id: id(1), tipo: "definir_prioridade", valor: "Urgente" },
        { id: id(2), tipo: "notificar", valor: "Atrasada: {titulo} (prazo {prazo})" },
      ],
    },
    {
      id: "parada-cobrar",
      titulo: "Cobrar tarefa parada há 3 dias",
      descricao: "Sem nenhuma atividade há 3 dias: comentário de cobrança e aviso aos vinculados.",
      gatilho: "tarefa_parada",
      condicao: { parada: { quantidade: "3", unidade: "dias", base: "atualizacao" } },
      acoes: [
        { id: id(1), tipo: "comentar", texto: "{responsavel}, esta tarefa está parada há {dias_parada} dias. Alguma novidade?" },
        { id: id(2), tipo: "notificar", valor: "Parada há {dias_parada} dias: {titulo}" },
      ],
    },
    revisao && {
      id: "revisao-aprovacao",
      titulo: "Ao entrar em revisão, pedir aprovação",
      descricao: `Quando a tarefa vai para "${revisao.nome}", uma aprovação é solicitada aos gestores.`,
      gatilho: "status_muda",
      condicao: { all: [{ campo: "status_para", op: "=", valor: revisao.slug }] },
      acoes: [{ id: id(1), tipo: "solicitar_aprovacao" }],
    },
    {
      id: "comentario-urgente",
      titulo: "Comentário com “urgente” sobe a prioridade",
      descricao: "Se alguém comentar com a palavra urgente, a prioridade vira Urgente.",
      gatilho: "comentario_adicionado",
      condicao: { all: [{ campo: "comentario", op: "contains", valor: "urgente" }] },
      acoes: [{ id: id(1), tipo: "definir_prioridade", valor: "Urgente" }],
    },
    inicial && {
      id: "dependencia-liberada",
      titulo: "Dependências concluídas: voltar para a fila e avisar",
      descricao: `Quando as tarefas que bloqueiam são concluídas, a tarefa vai para "${inicial.nome}" e os vinculados são avisados.`,
      gatilho: "dependencia_liberada",
      condicao: {},
      acoes: [
        { id: id(1), tipo: "mover_status", valor: inicial.slug },
        { id: id(2), tipo: "notificar", valor: "Liberada (concluíram {bloqueadora}): {titulo}" },
      ],
    },
    {
      id: "pauta-semanal",
      titulo: "Pauta da reunião toda segunda às 8h",
      descricao: "Toda segunda-feira às 8h é criada a tarefa da pauta, com prazo no mesmo dia.",
      gatilho: "agendado",
      condicao: {
        agenda: { freq: "semanal", dias_semana: [1], hora: "08:00" },
        modo: "criar_tarefa",
        modelo_tarefa: { titulo: "Pauta da reunião de {data}", prioridade: "Media", prazo_dias: "0" },
      },
      acoes: [],
    },
    {
      id: "seguir-2-dias",
      titulo: "Tarefa nova: lembrar em 2 dias se não estiver concluída",
      descricao: "Dois dias depois de criada, se ainda não estiver concluída, os vinculados recebem um lembrete.",
      gatilho: "tarefa_criada",
      condicao: {},
      acoes: [
        { id: id(1), tipo: "aguardar", quantidade: "2", unidade: "dias" },
        { id: id(2), tipo: "notificar", valor: "Lembrete: {titulo}", ...(naoConcluida ? { condicao: naoConcluida } : {}) },
      ],
    },
    {
      id: "rodizio-novas",
      titulo: "Distribuir tarefas novas em rodízio",
      descricao: "Cada tarefa nova vai para a próxima pessoa da lista. Escolha as pessoas antes de ativar.",
      gatilho: "tarefa_criada",
      condicao: {},
      acoes: [{ id: id(1), tipo: "atribuir_rodizio", modo: "rodizio", emails: [] }],
    },
    {
      id: "sst-inspecao-elaboracao",
      titulo: "SST: inspeção concluída vira tarefa de elaboração",
      descricao: "Cada inspeção concluída (1ª vez) cria aqui a tarefa de elaborar o documento, com prazo de 5 dias úteis.",
      gatilho: "sst_inspecao_concluida",
      condicao: {
        modelo_tarefa: {
          titulo: "Elaborar documento: {empresa}",
          descricao: "Inspeção {id_inspecao} — visita em {data_inspecao} por {tecnico} ({unidade}).",
          prioridade: "Media", prazo_dias: "5", prazo_uteis: "true",
        },
      },
      acoes: [],
    },
    {
      id: "sst-extintor-recarga",
      titulo: "SST: extintor vencendo em 30 dias vira tarefa de recarga",
      descricao: "Cada extintor a 30 dias da validade cria aqui uma tarefa de recarga (uma vez por extintor e validade).",
      gatilho: "sst_vencimento",
      condicao: {
        fonte: "extintor", dias_antes: "30",
        modelo_tarefa: { titulo: "Recarga: {item} — {empresa} (vence {validade})", prioridade: "Alta", prazo_dias: "10", prazo_uteis: "true" },
      },
      acoes: [],
    },
    {
      id: "sst-documento-renovar",
      titulo: "SST: documento vencendo em 60 dias vira tarefa de renovação",
      descricao: "O documento mais recente de cada empresa a 60 dias da validade cria aqui a tarefa de renovação.",
      gatilho: "sst_vencimento",
      condicao: {
        fonte: "documento", dias_antes: "60",
        modelo_tarefa: { titulo: "Renovar documento: {empresa} (vence {validade})", prioridade: "Alta", prazo_dias: "20", prazo_uteis: "true" },
      },
      acoes: [{ id: id(1), tipo: "notificar", valor: "Documento de {empresa} vence em {dias_para_vencer} dias" }],
    },
    {
      id: "botao-urgente",
      titulo: "Botão: marcar como urgente e avisar",
      descricao: "Aparece no ⚡ da tarefa e das ações em massa: prioridade Urgente, etiqueta “urgente” e aviso.",
      gatilho: "manual",
      condicao: {},
      acoes: [
        { id: id(1), tipo: "definir_prioridade", valor: "Urgente" },
        { id: id(2), tipo: "adicionar_etiqueta", valor: "urgente" },
        { id: id(3), tipo: "notificar", valor: "{executado_por} marcou como urgente: {titulo}" },
      ],
    },
  ];
  return lista.filter((r): r is Receita => !!r);
}
